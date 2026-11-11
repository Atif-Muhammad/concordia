const mongoose = require('mongoose');
const {
  FrontOfficeInquiry,
  Student,
  Program,
  AcademicSession,
  ActivityLog,
} = require('../../models');
const { ACTIVE_STUDENT_FILTER, isStudentActive, buildStudentStatusCondition } = require('../../utils/studentStatus');
const { buildStudentSearchCondition, escapeRegex } = require('../../utils/studentSearch');
const {
  parseMulti,
  applyMultiIdFilter,
  applyMultiStringFilter,
  toObjectIds,
  formatNum,
  formatPct,
  pctValue,
  formatDate,
  daysBetween,
  fullName,
  loadUserPermissions,
  resolveSession,
} = require('./reportHelpers');

const STANDARD_DOC_LABELS = {
  photograph: 'Passport Photograph',
  cnicCopy: 'CNIC / Form B Copy',
  matricDmc: 'Matric DMC',
  guardianContact: 'Guardian Contact / CNIC',
  characterCertificate: 'Character Certificate',
};
const STANDARD_DOC_KEYS = Object.keys(STANDARD_DOC_LABELS);

const EXTRA_DOC_LABELS = {
  pictures: 'Passport Photograph',
  photos: 'Passport Photograph',
  formB: 'Form B / CNIC Copy',
  dmcMatric: 'Matric DMC',
  dmcIntermediate: 'Intermediate DMC',
  fatherCnic: 'Father / Guardian CNIC',
  migration: 'Migration Certificate',
  affidavit: 'Affidavit / Character Certificate',
  admissionForm: 'Admission Form',
};

const DOC_ALIAS_GROUPS = {
  photograph: ['photograph', 'pictures', 'photos', 'photo'],
  cnicCopy: ['cniccopy', 'formb', 'bform', 'fathercnic'],
  matricDmc: ['matricdmc', 'dmcmatric', 'matric'],
  guardianContact: ['guardiancontact', 'fathercnic', 'guardiancnic'],
  characterCertificate: ['charactercertificate', 'affidavit'],
};

const SOURCE_OPTIONS = [
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Website', label: 'Website' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Phone', label: 'Phone' },
];

// ponytail: support both reportEngine ctx ({ reqUser, permCtx, sessionCtx }) and direct (query, user) calls
async function resolveCtx(query = {}, ctxOrUser = null) {
  if (ctxOrUser && (ctxOrUser.permCtx || ctxOrUser.sessionCtx || ctxOrUser.reqUser !== undefined)) {
    return {
      reqUser: ctxOrUser.reqUser || null,
      permCtx: ctxOrUser.permCtx || await loadUserPermissions(ctxOrUser.reqUser || null),
      sessionCtx: ctxOrUser.sessionCtx || await resolveSession(query.sessionId),
    };
  }
  const [permCtx, sessionCtx] = await Promise.all([
    loadUserPermissions(ctxOrUser),
    resolveSession(query.sessionId),
  ]);
  return { reqUser: ctxOrUser, permCtx, sessionCtx };
}

function buildDateBounds(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null;
  const bounds = {};
  if (dateFrom) {
    const start = new Date(dateFrom);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      bounds.$gte = start;
    }
  }
  if (dateTo) {
    const end = new Date(dateTo);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      bounds.$lte = end;
    }
  }
  return Object.keys(bounds).length > 0 ? bounds : null;
}

function normalizeSource(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Walk-in';
  const low = s.toLowerCase();
  if (low === 'walk-in' || low === 'walk in' || low === 'walkin') return 'Walk-in';
  if (low === 'website' || low === 'web') return 'Website';
  if (low === 'facebook' || low === 'fb') return 'Facebook';
  if (low === 'referral' || low === 'reference') return 'Referral';
  if (low === 'phone' || low === 'phone call' || low === 'call') return 'Phone';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPlainDocsMap(rawDocs) {
  if (!rawDocs) return {};
  if (rawDocs instanceof Map) return Object.fromEntries(rawDocs.entries());
  if (typeof rawDocs === 'string') {
    try {
      const parsed = JSON.parse(rawDocs);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof rawDocs === 'object' ? rawDocs : {};
}

function getMissingStudentDocs(student) {
  const rawDocs = toPlainDocsMap(student?.documents);
  const keys = Object.keys(rawDocs);
  if (keys.length > 0) {
    return keys
      .filter((k) => rawDocs[k] === false || rawDocs[k] === 'false' || rawDocs[k] === 0)
      .map((k) => ({ docKey: k, label: STANDARD_DOC_LABELS[k] || EXTRA_DOC_LABELS[k] || formatDocKeyLabel(k) }));
  }
  return STANDARD_DOC_KEYS.map((k) => ({ docKey: k, label: STANDARD_DOC_LABELS[k] }));
}

function formatDocKeyLabel(key) {
  return String(key || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase()) || 'Document';
}

function makeInquiryCode(inq) {
  return inq?.inquiryCode || `INQ-${String(inq?._id || '').slice(-6).toUpperCase()}`;
}

function resolveOfficerName(inq) {
  if (inq?.assignedOfficerName) return inq.assignedOfficerName;
  if (inq?.assignedOfficerId && typeof inq.assignedOfficerId === 'object' && inq.assignedOfficerId.name) {
    return inq.assignedOfficerId.name;
  }
  return 'Unassigned';
}

function isNonCancelledStudent(student) {
  return Boolean(student) && !/^cancelled$/i.test(String(student.status || '').trim());
}

/**
 * Cross-match inquiries to admitted Student documents (primary: Student.inquiryId,
 * fallback: phone/CNIC for APPROVED inquiries without linked inquiryId).
 */
async function matchStudentsForInquiries(inquiries = []) {
  if (!inquiries.length) return new Map();
  const inqIds = inquiries.map((i) => i._id);
  const linked = await Student.find({ inquiryId: { $in: inqIds } })
    .populate('programId', 'name')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .populate('sessionId', 'name')
    .lean();

  const studentMap = new Map();
  for (const s of linked) {
    if (s.inquiryId && isNonCancelledStudent(s)) {
      studentMap.set(String(s.inquiryId), s);
    }
  }

  const unlinkedApproved = inquiries.filter(
    (i) => !studentMap.has(String(i._id)) && (i.status === 'APPROVED' || i.applicationStatus === 'APPROVED')
  );
  if (unlinkedApproved.length > 0) {
    const phones = unlinkedApproved.map((i) => i.contactNumber).filter(Boolean);
    const cnics = unlinkedApproved.map((i) => i.studentCnic).filter(Boolean);
    if (phones.length > 0 || cnics.length > 0) {
      const orConds = [];
      if (phones.length > 0) orConds.push({ parentOrGuardianPhone: { $in: phones } });
      if (cnics.length > 0) orConds.push({ studentCnic: { $in: cnics } });
      const fallback = await Student.find({ $or: orConds })
        .populate('programId', 'name')
        .populate('classId', 'name')
        .populate('sectionId', 'name')
        .populate('sessionId', 'name')
        .lean();

      for (const fs of fallback) {
        if (!isNonCancelledStudent(fs)) continue;
        const match = unlinkedApproved.find(
          (i) =>
            (i.studentCnic && fs.studentCnic && i.studentCnic === fs.studentCnic) ||
            (i.contactNumber && fs.parentOrGuardianPhone && i.contactNumber === fs.parentOrGuardianPhone)
        );
        if (match && !studentMap.has(String(match._id))) {
          studentMap.set(String(match._id), fs);
        }
      }
    }
  }
  return studentMap;
}

async function resolveSelectedFilters(query = {}, labels = {}) {
  const out = [];
  if (query.sessionId && query.sessionId !== 'all') {
    const ids = toObjectIds(query.sessionId);
    if (ids.length > 0) {
      const docs = await AcademicSession.find({ _id: { $in: ids } }).select('name').lean();
      out.push({ label: 'Session', value: docs.map((d) => d.name).join(', ') || String(query.sessionId) });
    }
  }
  if (query.programId && query.programId !== 'all') {
    const ids = toObjectIds(query.programId);
    if (ids.length > 0) {
      const docs = await Program.find({ _id: { $in: ids } }).select('name').lean();
      out.push({ label: 'Program', value: docs.map((d) => d.name).join(', ') || String(query.programId) });
    }
  }
  if (query.dateFrom || query.dateTo) {
    out.push({
      label: 'Date Range',
      value: `${query.dateFrom ? formatDate(query.dateFrom) : 'Start'} – ${query.dateTo ? formatDate(query.dateTo) : 'Today'}`,
    });
  }
  Object.entries(labels).forEach(([k, lbl]) => {
    if (query[k] && query[k] !== 'all') {
      out.push({ label: lbl, value: String(query[k]) });
    }
  });
  return out;
}

function getNextFollowUpDate(inq) {
  const followUps = Array.isArray(inq?.followUps) ? inq.followUps : [];
  const pending = followUps
    .filter((f) => String(f.status || 'PENDING').toUpperCase() === 'PENDING' && f.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (pending.length > 0) return pending[0].date;
  return inq?.followUpDate || null;
}

// =============================================================================
// Page 2: Admissions — Inquiry & Lead Register
// =============================================================================
async function runInquiryRegister(query = {}, ctxOrUser = null) {
  await resolveCtx(query, ctxOrUser);
  const mongoQuery = {};
  const dateBounds = buildDateBounds(query.dateFrom, query.dateTo);
  if (dateBounds) mongoQuery.createdAt = dateBounds;
  applyMultiIdFilter(mongoQuery, 'programInterest', query.programId);

  const [inquiries, selectedFilters] = await Promise.all([
    FrontOfficeInquiry.find(mongoQuery)
      .populate('programInterest', 'name')
      .populate('assignedOfficerId', 'name staffId')
      .sort({ createdAt: -1 })
      .lean(),
    resolveSelectedFilters(query, { source: 'Source', status: 'Status', search: 'Search' }),
  ]);

  const studentMap = await matchStudentsForInquiries(inquiries);
  const now = new Date();
  const sourceValues = parseMulti(query.source)
    .filter((s) => !/^all$/i.test(s))
    .map((s) => normalizeSource(s).toLowerCase());
  const statusValues = parseMulti(query.status)
    .filter((s) => !/^all$/i.test(s))
    .map((s) => s.trim().toUpperCase());
  const searchLower = String(query.search || '').trim().toLowerCase();

  const enriched = [];
  for (const inq of inquiries) {
    const student = studentMap.get(String(inq._id)) || null;
    const isEnrolled = Boolean(student);
    const followUps = Array.isArray(inq.followUps) ? inq.followUps : [];
    const inqStatus = String(inq.status || 'NEW').toUpperCase();
    const appStatus = String(inq.applicationStatus || '').toUpperCase();
    const isContacted = followUps.length > 0 || inqStatus !== 'NEW';
    const isApplication = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(appStatus) || isEnrolled;

    let statusLabel = 'New';
    if (isEnrolled) statusLabel = 'Enrolled';
    else if (inqStatus === 'REJECTED' || appStatus === 'REJECTED') statusLabel = 'Rejected';
    else if (inqStatus === 'APPROVED' || appStatus === 'APPROVED') statusLabel = 'Approved';
    else if (['SUBMITTED', 'UNDER_REVIEW'].includes(appStatus) || inq.appliedAt) statusLabel = 'Applied';
    else if (followUps.length > 0) statusLabel = 'Follow-up';

    const source = normalizeSource(inq.inquiryType);
    if (sourceValues.length > 0 && !sourceValues.includes(source.toLowerCase())) continue;

    if (statusValues.length > 0) {
      const matchStatus = statusValues.some((sv) =>
        (sv === 'ENROLLED' && isEnrolled) ||
        (sv === 'APPLIED' && (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(appStatus) || Boolean(inq.appliedAt)) && !isEnrolled) ||
        (sv === 'FOLLOW-UP' && statusLabel === 'Follow-up') ||
        (sv === 'APPROVED' && (inqStatus === 'APPROVED' || appStatus === 'APPROVED')) ||
        (sv === 'REJECTED' && (inqStatus === 'REJECTED' || appStatus === 'REJECTED')) ||
        (sv === 'NEW' && statusLabel === 'New')
      );
      if (!matchStatus) continue;
    }

    const inquiryCode = makeInquiryCode(inq);
    const officerName = resolveOfficerName(inq);
    const programName = inq.programInterest?.name || 'General';
    if (searchLower) {
      const hay = [
        inquiryCode,
        inq.studentName,
        inq.fatherName,
        inq.contactNumber,
        inq.studentCnic,
        programName,
        officerName,
        source,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(searchLower)) continue;
    }

    const nextFollowUpRaw = getNextFollowUpDate(inq);
    const followUpOverdueDays =
      !isEnrolled && inqStatus !== 'REJECTED' && nextFollowUpRaw && new Date(nextFollowUpRaw) < now
        ? daysBetween(nextFollowUpRaw, now)
        : 0;

    enriched.push({
      id: String(inq._id),
      inquiryCode,
      studentName: inq.studentName || '—',
      programName,
      source,
      officerName,
      statusLabel,
      followUpOverdueDays,
      nextFollowUpDate: nextFollowUpRaw ? formatDate(nextFollowUpRaw) : '—',
      isContacted,
      isApplication,
      isEnrolled,
      isRejected: inqStatus === 'REJECTED' || appStatus === 'REJECTED',
      drilldownKey: isEnrolled ? 'students-profile-360' : undefined,
      drilldownFilters: isEnrolled && student ? { studentId: String(student._id) } : undefined,
      actionContext: {
        inquiryId: String(inq._id),
        studentName: inq.studentName,
        applicationStatus: inq.applicationStatus || 'INQUIRY',
        assignedOfficerName: officerName === 'Unassigned' ? '' : officerName,
      },
    });
  }

  const totalCount = enriched.length;
  const contactedCount = enriched.filter((r) => r.isContacted).length;
  const applicationsCount = enriched.filter((r) => r.isApplication).length;
  const enrolledCount = enriched.filter((r) => r.isEnrolled).length;

  const uncontactedPending = enriched.filter((r) => !r.isContacted && !r.isEnrolled && !r.isRejected).length;
  const overdueFollowUps = enriched.filter((r) => r.followUpOverdueDays > 0).length;
  const pendingFollowUpTotal = enriched.filter(
    (r) => !r.isEnrolled && !r.isRejected && (!r.isContacted || r.followUpOverdueDays > 0)
  ).length;

  return {
    selectedFilters,
    kpis: [
      { label: 'Total inquiries', value: formatNum(totalCount) },
      { label: 'Contacted', value: formatNum(contactedCount) },
      { label: 'Applications', value: formatNum(applicationsCount), drilldownKey: 'admissions-application-register' },
      { label: 'Enrolled', value: formatNum(enrolledCount), drilldownKey: 'admissions-enrollment-summary' },
    ],
    columns: [
      { key: 'inquiryCode', label: 'Inquiry ID' },
      { key: 'studentName', label: 'Applicant' },
      { key: 'programName', label: 'Program' },
      { key: 'source', label: 'Source' },
      { key: 'officerName', label: 'Officer' },
      { key: 'statusLabel', label: 'Status' },
    ],
    rows: enriched,
    totalsRow: null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: pendingFollowUpTotal > 0 ? 'warning' : 'info',
      message:
        pendingFollowUpTotal > 0
          ? `Follow up ${pendingFollowUpTotal} inquiries pending contact / follow-up (${uncontactedPending} uncontacted, ${overdueFollowUps} overdue follow-up).`
          : 'All active admission inquiries have been contacted and are on track.',
    },
  };
}

// =============================================================================
// Page 3: Admissions — Application Register
// =============================================================================
async function runApplicationRegister(query = {}, ctxOrUser = null) {
  await resolveCtx(query, ctxOrUser);
  const sessionIds = toObjectIds(query.sessionId);
  const programIds = toObjectIds(query.programId);

  const inqFilter = {
    $or: [
      { applicationStatus: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] } },
      { appliedAt: { $ne: null } },
      { status: { $in: ['APPROVED', 'REJECTED'] } },
    ],
  };
  if (sessionIds.length > 0) inqFilter.sessionId = sessionIds.length === 1 ? sessionIds[0] : { $in: sessionIds };
  if (programIds.length > 0) inqFilter.programInterest = programIds.length === 1 ? programIds[0] : { $in: programIds };

  const studentFilter = {
    $or: [
      { inquiryId: { $ne: null } },
      { admissionFormNumber: { $nin: ['', null] } },
      { status: { $regex: /^pending$/i } },
    ],
  };
  if (sessionIds.length > 0) {
    studentFilter.$and = [
      {
        $or: [
          { sessionId: sessionIds.length === 1 ? sessionIds[0] : { $in: sessionIds } },
          { 'academicRecords.sessionId': sessionIds.length === 1 ? sessionIds[0] : { $in: sessionIds } },
        ],
      },
    ];
  }
  if (programIds.length > 0) {
    studentFilter.programId = programIds.length === 1 ? programIds[0] : { $in: programIds };
  }

  const [inquiries, candidateStudents, selectedFilters] = await Promise.all([
    FrontOfficeInquiry.find(inqFilter)
      .populate('programInterest', 'name')
      .sort({ appliedAt: -1, createdAt: -1 })
      .lean(),
    Student.find(studentFilter)
      .populate('programId', 'name')
      .sort({ admissionDate: -1, createdAt: -1 })
      .lean(),
    resolveSelectedFilters(query, { applicationStatus: 'Application Status', search: 'Search' }),
  ]);

  const linkedMap = await matchStudentsForInquiries(inquiries);
  const consumedStudentIds = new Set();
  for (const s of linkedMap.values()) consumedStudentIds.add(String(s._id));

  // Also include inquiries referenced directly via Student.inquiryId even if inquiry status was NEW
  const extraInqIds = candidateStudents
    .map((s) => s.inquiryId)
    .filter((id) => id && !inquiries.some((i) => String(i._id) === String(id)));
  if (extraInqIds.length > 0) {
    const extraInqs = await FrontOfficeInquiry.find({ _id: { $in: extraInqIds } })
      .populate('programInterest', 'name')
      .lean();
    for (const ei of extraInqs) {
      if (sessionIds.length > 0 && ei.sessionId && !sessionIds.some((id) => String(id) === String(ei.sessionId))) {
        continue;
      }
      if (programIds.length > 0 && ei.programInterest && !programIds.some((id) => String(id) === String(ei.programInterest._id || ei.programInterest))) {
        continue;
      }
      inquiries.push(ei);
      const matchStu = candidateStudents.find((s) => String(s.inquiryId) === String(ei._id));
      if (matchStu && isNonCancelledStudent(matchStu)) {
        linkedMap.set(String(ei._id), matchStu);
        consumedStudentIds.add(String(matchStu._id));
      }
    }
  }

  const dateBounds = buildDateBounds(query.dateFrom, query.dateTo);
  const appStatusValues = parseMulti(query.applicationStatus)
    .filter((s) => !/^all$/i.test(s))
    .map((s) => s.trim().toUpperCase());
  const searchLower = String(query.search || '').trim().toLowerCase();

  const records = [];

  const pushRecord = ({ inq = null, student = null }) => {
    const appliedRaw = inq?.appliedAt || inq?.createdAt || student?.admissionDate || student?.createdAt;
    if (dateBounds && appliedRaw) {
      const dt = new Date(appliedRaw);
      if (dateBounds.$gte && dt < dateBounds.$gte) return;
      if (dateBounds.$lte && dt > dateBounds.$lte) return;
    }

    const inqStatus = String(inq?.status || '').toUpperCase();
    const rawAppStatus = String(inq?.applicationStatus || '').toUpperCase();
    const stuStatus = String(student?.status || '').toUpperCase();

    let normStatus = 'SUBMITTED';
    if (student && !['CANCELLED', 'PENDING'].includes(stuStatus)) {
      normStatus = 'APPROVED';
    } else if (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(rawAppStatus)) {
      normStatus = rawAppStatus;
    } else if (inqStatus === 'APPROVED') {
      normStatus = 'APPROVED';
    } else if (inqStatus === 'REJECTED' || stuStatus === 'CANCELLED') {
      normStatus = 'REJECTED';
    } else if (stuStatus === 'PENDING') {
      normStatus = 'PENDING';
    }

    if (appStatusValues.length > 0) {
      const matchedAppStatus = appStatusValues.some((sv) =>
        sv === 'PENDING' ? ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(normStatus) : normStatus === sv
      );
      if (!matchedAppStatus) return;
    }

    const missingInqDocs = (inq?.missingDocuments || []).filter((d) => d.status !== 'COMPLETE');
    const missingStuDocs = student ? getMissingStudentDocs(student) : [];
    const seenDocKeys = new Set(missingInqDocs.map((d) => d.docKey).filter(Boolean));
    const combinedMissingCount =
      missingInqDocs.length + missingStuDocs.filter((d) => !seenDocKeys.has(d.docKey)).length;

    const isIncomplete = combinedMissingCount > 0;
    const applicationId =
      inq?.applicationId ||
      student?.admissionFormNumber ||
      (inq ? `APP-${String(inq._id).slice(-6).toUpperCase()}` : `APP-${String(student._id).slice(-6).toUpperCase()}`);
    const applicant = inq?.studentName || fullName(student) || '—';
    const programName = inq?.programInterest?.name || student?.programId?.name || 'General';

    if (searchLower) {
      const hay = [applicationId, applicant, programName, student?.rollNumber, inq?.contactNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(searchLower)) return;
    }

    const decisionMap = {
      SUBMITTED: 'Submitted',
      UNDER_REVIEW: 'Under Review',
      APPROVED: student && !['CANCELLED', 'PENDING'].includes(stuStatus) ? 'Approved (Enrolled)' : 'Approved',
      REJECTED: stuStatus === 'CANCELLED' ? 'Rejected / Cancelled' : 'Rejected',
      PENDING: 'Pending Decision',
    };

    records.push({
      id: String(inq?._id || student?._id),
      applicationId,
      applicant,
      programName,
      appliedOn: formatDate(appliedRaw),
      documentsStatus: isIncomplete ? `Incomplete (${combinedMissingCount})` : 'Complete',
      decision: decisionMap[normStatus] || normStatus,
      isComplete: !isIncomplete,
      isIncomplete,
      isUnderReview: normStatus === 'UNDER_REVIEW',
      drilldownKey: student ? 'students-profile-360' : isIncomplete ? 'admissions-missing-documents' : undefined,
      drilldownFilters: student ? { studentId: String(student._id) } : undefined,
    });
  };

  for (const inq of inquiries) {
    pushRecord({ inq, student: linkedMap.get(String(inq._id)) || null });
  }
  for (const stu of candidateStudents) {
    if (consumedStudentIds.has(String(stu._id))) continue;
    pushRecord({ inq: null, student: stu });
  }

  const completeCount = records.filter((r) => r.isComplete).length;
  const incompleteCount = records.filter((r) => r.isIncomplete).length;
  const underReviewCount = records.filter((r) => r.isUnderReview).length;

  return {
    selectedFilters,
    kpis: [
      { label: 'Applications', value: formatNum(records.length) },
      { label: 'Complete', value: formatNum(completeCount) },
      { label: 'Incomplete', value: formatNum(incompleteCount), drilldownKey: 'admissions-missing-documents' },
      { label: 'Under review', value: formatNum(underReviewCount) },
    ],
    columns: [
      { key: 'applicationId', label: 'Application ID' },
      { key: 'applicant', label: 'Applicant' },
      { key: 'programName', label: 'Program' },
      { key: 'appliedOn', label: 'Applied on' },
      { key: 'documentsStatus', label: 'Documents' },
      { key: 'decision', label: 'Decision' },
    ],
    rows: records,
    totalsRow: null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: incompleteCount > 0 ? 'warning' : 'info',
      message:
        incompleteCount > 0
          ? `${incompleteCount} applications have incomplete documents and ${underReviewCount} are awaiting review decision.`
          : `${records.length} applications reviewed; all submitted files have complete documentation.`,
    },
  };
}

// =============================================================================
// Page 4: Admissions — Enrollment & Admission Summary
// =============================================================================
async function runEnrollmentSummary(query = {}, ctxOrUser = null) {
  await resolveCtx(query, ctxOrUser);
  const andConds = [];
  const sessionIds = toObjectIds(query.sessionId);
  if (sessionIds.length > 0) {
    andConds.push({
      $or: [
        { sessionId: sessionIds.length === 1 ? sessionIds[0] : { $in: sessionIds } },
        { 'academicRecords.sessionId': sessionIds.length === 1 ? sessionIds[0] : { $in: sessionIds } },
      ],
    });
  }
  const programIds = toObjectIds(query.programId);
  if (programIds.length > 0) {
    andConds.push({ programId: programIds.length === 1 ? programIds[0] : { $in: programIds } });
  }
  const dateBounds = buildDateBounds(query.dateFrom, query.dateTo);
  if (dateBounds) {
    andConds.push({ admissionDate: dateBounds });
  }
  const genderCond = {};
  applyMultiStringFilter(genderCond, 'gender', query.gender, { caseInsensitive: true });
  if (Object.keys(genderCond).length > 0) {
    andConds.push(genderCond);
  }

  const rawStatuses = parseMulti(query.status).filter((s) => !/^all$/i.test(s));
  const hasExplicitStatus = rawStatuses.length > 0;
  if (hasExplicitStatus) {
    const statusOr = [];
    let needsActive = false;
    const otherStatuses = [];
    for (const s of rawStatuses) {
      const up = s.toUpperCase();
      if (up === 'ENROLLED' || up === 'ACTIVE') needsActive = true;
      else otherStatuses.push(up);
    }
    if (needsActive) statusOr.push(ACTIVE_STUDENT_FILTER);
    if (otherStatuses.length > 0) statusOr.push(buildStudentStatusCondition(otherStatuses.join(',')));
    if (statusOr.length === 1) andConds.push(statusOr[0]);
    else if (statusOr.length > 1) andConds.push({ $or: statusOr });
  }

  const mongoQuery = andConds.length > 0 ? { $and: andConds } : {};
  const [rawStudents, allPrograms, selectedFilters] = await Promise.all([
    Student.find(mongoQuery)
      .populate('programId', 'name')
      .populate('classId', 'name')
      .sort({ admissionDate: -1, rollNumber: 1 })
      .lean(),
    Program.find().select('name').lean(),
    resolveSelectedFilters(query, { status: 'Status', gender: 'Gender' }),
  ]);

  // Strict deduplication by unique Student._id
  const uniqueMap = new Map();
  for (const s of rawStudents) {
    const id = String(s._id);
    if (!uniqueMap.has(id)) uniqueMap.set(id, s);
  }
  const uniqueStudents = Array.from(uniqueMap.values());

  // Exclude CANCELLED / non-active from Active enrollment KPI unless explicitly filtered
  const activePool = hasExplicitStatus ? uniqueStudents : uniqueStudents.filter(isStudentActive);

  const progCounts = new Map();
  for (const s of activePool) {
    const pId = String(s.programId?._id || s.programId || '');
    const pName = s.programId?.name || 'Unassigned';
    const cur = progCounts.get(pName) || { programId: pId, programName: pName, count: 0 };
    cur.count += 1;
    progCounts.set(pName, cur);
  }
  for (const p of allPrograms) {
    if (progCounts.size < 3 && !progCounts.has(p.name)) {
      progCounts.set(p.name, { programId: String(p._id), programName: p.name, count: 0 });
    }
  }
  const topPrograms = Array.from(progCounts.values())
    .sort((a, b) => b.count - a.count || a.programName.localeCompare(b.programName))
    .slice(0, 3);

  const kpis = [
    { label: 'Enrolled', value: formatNum(activePool.length) },
    ...topPrograms.map((tp) => ({
      label: tp.programName,
      value: formatNum(tp.count),
      drilldownKey: 'students-master-register',
      drilldownFilters: tp.programId ? { programId: tp.programId } : {},
    })),
  ];

  const rows = uniqueStudents.map((s) => ({
    id: String(s._id),
    rollNumber: s.rollNumber || '—',
    studentName: fullName(s) || '—',
    programName: s.programId?.name || '—',
    className: s.classId?.name || '—',
    gender: s.gender || '—',
    admissionDate: formatDate(s.admissionDate || s.createdAt),
    status: s.status || 'ACTIVE',
    drilldownKey: 'students-profile-360',
    drilldownFilters: { studentId: String(s._id) },
  }));

  const cancelledOrInactive = uniqueStudents.length - activePool.length;
  const chartData = Array.from(progCounts.values()).map((p) => ({
    program: p.programName,
    enrolled: p.count,
  }));

  return {
    selectedFilters,
    kpis,
    columns: [
      { key: 'rollNumber', label: 'Student ID' },
      { key: 'studentName', label: 'Student' },
      { key: 'programName', label: 'Program' },
      { key: 'className', label: 'Class' },
      { key: 'gender', label: 'Gender' },
      { key: 'admissionDate', label: 'Admission date' },
      { key: 'status', label: 'Status' },
    ],
    rows,
    totalsRow: null,
    charts: chartData.length > 0
      ? [{
          type: 'bar',
          title: 'Confirmed Enrollment by Program',
          xKey: 'program',
          data: chartData,
          series: [{ dataKey: 'enrolled', label: 'Enrolled Students' }],
        }]
      : [],
    secondaryTables: [],
    insight: {
      severity: cancelledOrInactive > 0 ? 'warning' : 'info',
      message: hasExplicitStatus
        ? `Showing ${uniqueStudents.length} unique students matching status "${rawStatuses.join(', ')}".`
        : `${activePool.length} active enrolled students confirmed (${cancelledOrInactive} cancelled / non-active records excluded from active KPI).`,
    },
  };
}

// =============================================================================
// Page 5: Admissions — Source & Conversion Analysis
// =============================================================================
async function runSourceConversion(query = {}, ctxOrUser = null) {
  await resolveCtx(query, ctxOrUser);
  const mongoQuery = {};
  const dateBounds = buildDateBounds(query.dateFrom, query.dateTo);
  if (dateBounds) mongoQuery.createdAt = dateBounds;
  applyMultiIdFilter(mongoQuery, 'programInterest', query.programId);

  const [inquiries, selectedFilters] = await Promise.all([
    FrontOfficeInquiry.find(mongoQuery)
      .populate('programInterest', 'name')
      .sort({ createdAt: -1 })
      .lean(),
    resolveSelectedFilters(query, { source: 'Source' }),
  ]);

  const studentMap = await matchStudentsForInquiries(inquiries);
  const sourceValues = parseMulti(query.source)
    .filter((s) => !/^all$/i.test(s))
    .map((s) => normalizeSource(s).toLowerCase());

  const channelMap = new Map();
  const applicantRows = [];
  let totalInquiries = 0;
  let totalApplications = 0;
  let totalEnrolled = 0;

  for (const inq of inquiries) {
    const channel = normalizeSource(inq.inquiryType || 'Walk-in');
    if (sourceValues.length > 0 && !sourceValues.includes(channel.toLowerCase())) continue;

    const student = studentMap.get(String(inq._id)) || null;
    const isEnrolled = Boolean(student);
    const appStatus = String(inq.applicationStatus || '').toUpperCase();
    const isApplied =
      isEnrolled ||
      ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(appStatus) ||
      Boolean(inq.appliedAt);

    totalInquiries += 1;
    if (isApplied) totalApplications += 1;
    if (isEnrolled) totalEnrolled += 1;

    const bucket = channelMap.get(channel) || { source: channel, inquiries: 0, applications: 0, enrolled: 0 };
    bucket.inquiries += 1;
    if (isApplied) bucket.applications += 1;
    if (isEnrolled) bucket.enrolled += 1;
    channelMap.set(channel, bucket);

    applicantRows.push({
      inquiryCode: makeInquiryCode(inq),
      applicant: inq.studentName || '—',
      programName: inq.programInterest?.name || 'General',
      source: channel,
      conversionStatus: isEnrolled ? 'Converted (Enrolled)' : inq.status === 'REJECTED' ? 'Rejected' : isApplied ? 'Applied (Pending)' : 'Inquiry Only',
      rollNumber: student?.rollNumber || '—',
    });
  }

  const rows = Array.from(channelMap.values())
    .sort((a, b) => b.enrolled - a.enrolled || b.inquiries - a.inquiries)
    .map((b) => ({
      source: b.source,
      inquiries: b.inquiries,
      applications: b.applications,
      enrolled: b.enrolled,
      conversionRate: formatPct(b.enrolled, b.inquiries),
      conversionPct: pctValue(b.enrolled, b.inquiries),
    }));

  const topChannel = rows.reduce((best, r) => (!best || r.conversionPct > best.conversionPct ? r : best), null);

  return {
    selectedFilters,
    kpis: [
      { label: 'Inquiries', value: formatNum(totalInquiries) },
      { label: 'Applications', value: formatNum(totalApplications) },
      { label: 'Enrolled', value: formatNum(totalEnrolled) },
      { label: 'Inquiry-to-enrollment %', value: formatPct(totalEnrolled, totalInquiries) },
    ],
    columns: [
      { key: 'source', label: 'Source' },
      { key: 'inquiries', label: 'Inquiries', align: 'right' },
      { key: 'applications', label: 'Applications', align: 'right' },
      { key: 'enrolled', label: 'Enrolled', align: 'right' },
      { key: 'conversionRate', label: 'Conversion %', align: 'right' },
    ],
    rows,
    totalsRow: {
      source: 'Total',
      inquiries: totalInquiries,
      applications: totalApplications,
      enrolled: totalEnrolled,
      conversionRate: formatPct(totalEnrolled, totalInquiries),
    },
    charts: rows.length > 0
      ? [{
          type: 'bar',
          title: 'Channel Breakdown — Inquiries, Applications & Enrolled',
          subtitle: 'Lead-to-enrollment funnel by acquisition source',
          xKey: 'source',
          data: rows.map((r) => ({
            source: r.source,
            inquiries: r.inquiries,
            applications: r.applications,
            enrolled: r.enrolled,
          })),
          series: [
            { dataKey: 'inquiries', label: 'Inquiries' },
            { dataKey: 'applications', label: 'Applications' },
            { dataKey: 'enrolled', label: 'Enrolled' },
          ],
        }]
      : [],
    secondaryTables: [
      {
        title: 'Converted & Pending Applicants by Source',
        columns: [
          { key: 'inquiryCode', label: 'Inquiry ID' },
          { key: 'applicant', label: 'Applicant' },
          { key: 'programName', label: 'Program' },
          { key: 'source', label: 'Source' },
          { key: 'conversionStatus', label: 'Status' },
          { key: 'rollNumber', label: 'Student ID' },
        ],
        rows: applicantRows,
      },
    ],
    insight: {
      severity: totalInquiries > 0 && totalEnrolled === 0 ? 'warning' : 'info',
      message: topChannel
        ? `${topChannel.source} leads conversion at ${topChannel.conversionRate} (${topChannel.enrolled}/${topChannel.inquiries}); overall inquiry-to-enrollment rate is ${formatPct(totalEnrolled, totalInquiries)}.`
        : 'No inquiry records match the selected filters.',
    },
  };
}

// =============================================================================
// Page 6: Admissions — Missing Documents & Pending Actions
// =============================================================================
async function runMissingDocuments(query = {}, ctxOrUser = null) {
  await resolveCtx(query, ctxOrUser);
  const programIds = toObjectIds(query.programId);

  const inqQuery = {
    status: { $ne: 'REJECTED' },
    applicationStatus: { $ne: 'REJECTED' },
    'missingDocuments.0': { $exists: true },
  };
  if (programIds.length > 0) inqQuery.programInterest = programIds.length === 1 ? programIds[0] : { $in: programIds };

  const studentQuery = {
    $or: [ACTIVE_STUDENT_FILTER, { status: { $regex: /^pending$/i }, passedOut: { $ne: true } }],
  };
  if (programIds.length > 0) studentQuery.programId = programIds.length === 1 ? programIds[0] : { $in: programIds };

  const [inquiries, students, selectedFilters] = await Promise.all([
    FrontOfficeInquiry.find(inqQuery)
      .populate('programInterest', 'name')
      .populate('assignedOfficerId', 'name')
      .lean(),
    Student.find(studentQuery)
      .populate('programId', 'name')
      .populate('inquiryId', 'assignedOfficerName')
      .lean(),
    resolveSelectedFilters(query, { status: 'Status', missingItem: 'Missing Item', officerName: 'Officer' }),
  ]);

  const studentByInqId = new Map();
  for (const s of students) {
    if (s.inquiryId) studentByInqId.set(String(s.inquiryId._id || s.inquiryId), s);
  }
  const inqIds = inquiries.map((i) => i._id);
  const allLinkedForInq = inqIds.length > 0
    ? await Student.find({ inquiryId: { $in: inqIds } }).select('inquiryId status passedOut').lean()
    : [];
  const closedInqIds = new Set(
    allLinkedForInq
      .filter((s) => !isStudentActive(s) && !/^pending$/i.test(String(s.status || '')))
      .map((s) => String(s.inquiryId))
  );

  const now = new Date();
  const statusValues = parseMulti(query.status)
    .filter((s) => !/^all$/i.test(s))
    .map((s) => s.trim().toUpperCase());
  const itemValues = parseMulti(query.missingItem)
    .filter((s) => !/^all$/i.test(s))
    .map((s) => s.trim().toLowerCase());
  const officerFilter = String(query.officerName || '').trim().toLowerCase();

  const seenStudentDoc = new Set();
  const rawRows = [];

  const pushMissingRow = ({
    entityId,
    applicant,
    programName,
    docKey,
    missingDocument,
    assignedTo,
    docStatus,
    daysPending,
    nextAction,
    actionContext,
  }) => {
    if (statusValues.length > 0 && !statusValues.includes(docStatus)) return;
    if (itemValues.length > 0) {
      const kLow = String(docKey || '').toLowerCase();
      const lLow = String(missingDocument || '').toLowerCase();
      const matchedItem = itemValues.some((iv) => {
        const aliasKey = Object.keys(DOC_ALIAS_GROUPS).find((ak) => ak.toLowerCase() === iv);
        const aliases = aliasKey ? DOC_ALIAS_GROUPS[aliasKey] : [iv];
        return aliases.includes(kLow) || lLow.includes(iv);
      });
      if (!matchedItem) return;
    }
    if (officerFilter && !String(assignedTo || '').toLowerCase().includes(officerFilter)) return;

    rawRows.push({
      id: `${entityId}-${docKey}`,
      entityId,
      applicant,
      programName,
      missingDocument,
      assignedTo,
      daysPending,
      nextAction,
      docKey,
      docStatus,
      actionContext,
    });
  };

  for (const inq of inquiries) {
    if (closedInqIds.has(String(inq._id))) continue;
    const linkedStudent = studentByInqId.get(String(inq._id)) || null;
    const inqOfficer = resolveOfficerName(inq);
    for (const item of inq.missingDocuments || []) {
      const itemStatus = String(item.status || 'AWAITING_APPLICANT').toUpperCase();
      if (itemStatus === 'COMPLETE') continue;
      const docKey = item.docKey || item.label || 'document';
      if (linkedStudent) seenStudentDoc.add(`${linkedStudent._id}:${docKey}`);
      const assignedTo = item.assignedOfficerName || (inqOfficer !== 'Unassigned' ? inqOfficer : 'Admissions Desk');
      pushMissingRow({
        entityId: linkedStudent ? String(linkedStudent._id) : String(inq._id),
        applicant: inq.studentName || fullName(linkedStudent) || '—',
        programName: inq.programInterest?.name || linkedStudent?.programId?.name || 'General',
        docKey,
        missingDocument: item.label || STANDARD_DOC_LABELS[docKey] || EXTRA_DOC_LABELS[docKey] || formatDocKeyLabel(docKey),
        assignedTo,
        docStatus: itemStatus,
        daysPending: daysBetween(item.flaggedAt || inq.appliedAt || inq.createdAt, now),
        nextAction:
          item.nextAction ||
          (itemStatus === 'AWAITING_VERIFICATION' ? 'Verify submitted document' : 'Follow up with applicant'),
        actionContext: {
          sourceType: 'inquiry',
          inquiryId: String(inq._id),
          studentId: linkedStudent ? String(linkedStudent._id) : '',
          missingDocId: item._id ? String(item._id) : '',
          docKey,
          status: itemStatus,
          applicationStatus: inq.applicationStatus || 'UNDER_REVIEW',
          assignedOfficerName: assignedTo === 'Admissions Desk' ? '' : assignedTo,
          nextAction: item.nextAction || '',
        },
      });
    }
  }

  for (const s of students) {
    const missingDocs = getMissingStudentDocs(s);
    const inqRef = s.inquiryId && typeof s.inquiryId === 'object' ? s.inquiryId : null;
    const assignedTo = inqRef?.assignedOfficerName || 'Admissions Desk';
    for (const md of missingDocs) {
      if (seenStudentDoc.has(`${s._id}:${md.docKey}`)) continue;
      pushMissingRow({
        entityId: String(s._id),
        applicant: fullName(s) || s.rollNumber || '—',
        programName: s.programId?.name || 'General',
        docKey: md.docKey,
        missingDocument: md.label,
        assignedTo,
        docStatus: 'AWAITING_APPLICANT',
        daysPending: daysBetween(s.admissionDate || s.createdAt, now),
        nextAction: 'Collect from student / guardian',
        actionContext: {
          sourceType: 'student',
          studentId: String(s._id),
          inquiryId: inqRef?._id ? String(inqRef._id) : s.inquiryId ? String(s.inquiryId) : '',
          docKey: md.docKey,
          status: 'AWAITING_APPLICANT',
          applicationStatus: 'UNDER_REVIEW',
          assignedOfficerName: assignedTo === 'Admissions Desk' ? '' : assignedTo,
          nextAction: 'Collect from student / guardian',
        },
      });
    }
  }

  rawRows.sort((a, b) => b.daysPending - a.daysPending);
  const distinctEntities = new Set(rawRows.map((r) => r.entityId));
  const awaitingApplicant = rawRows.filter((r) => r.docStatus === 'AWAITING_APPLICANT').length;
  const awaitingVerification = rawRows.filter((r) => r.docStatus === 'AWAITING_VERIFICATION').length;

  return {
    selectedFilters,
    kpis: [
      { label: 'Incomplete files', value: formatNum(distinctEntities.size) },
      { label: 'Missing items', value: formatNum(rawRows.length) },
      { label: 'Awaiting applicant', value: formatNum(awaitingApplicant) },
      { label: 'Awaiting verification', value: formatNum(awaitingVerification) },
    ],
    columns: [
      { key: 'applicant', label: 'Applicant' },
      { key: 'programName', label: 'Program' },
      { key: 'missingDocument', label: 'Missing document' },
      { key: 'assignedTo', label: 'Assigned to' },
      { key: 'daysPending', label: 'Days pending', align: 'right' },
      { key: 'nextAction', label: 'Next action' },
    ],
    rows: rawRows,
    totalsRow: null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: rawRows.length > 0 ? 'warning' : 'info',
      message:
        rawRows.length > 0
          ? `${distinctEntities.size} incomplete files have ${rawRows.length} pending document items (${awaitingApplicant} awaiting applicant, ${awaitingVerification} awaiting verification).`
          : 'No missing documents pending across active applications and students.',
    },
  };
}

// =============================================================================
// Inline Operational Actions
// =============================================================================
async function updateInquiryStageAction(payload = {}, { reqUser } = {}) {
  let inquiryId = payload.inquiryId || (payload.sourceType === 'inquiry' ? payload.id : null);
  if (!inquiryId && payload.studentId && mongoose.Types.ObjectId.isValid(payload.studentId)) {
    const stu = await Student.findById(payload.studentId).select('inquiryId').lean();
    if (stu?.inquiryId) inquiryId = String(stu.inquiryId);
  }
  if (!inquiryId || !mongoose.Types.ObjectId.isValid(inquiryId)) {
    const err = new Error('Valid inquiryId is required to update inquiry stage');
    err.statusCode = 400;
    throw err;
  }

  const inquiry = await FrontOfficeInquiry.findById(inquiryId);
  if (!inquiry) {
    const err = new Error('Inquiry not found');
    err.statusCode = 404;
    throw err;
  }

  const validAppStatuses = ['INQUIRY', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', ''];
  if (payload.applicationStatus !== undefined && validAppStatuses.includes(String(payload.applicationStatus))) {
    inquiry.applicationStatus = String(payload.applicationStatus);
    if (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(inquiry.applicationStatus) && !inquiry.appliedAt) {
      inquiry.appliedAt = new Date();
    }
    if (inquiry.applicationStatus === 'APPROVED' && inquiry.status === 'NEW') inquiry.status = 'APPROVED';
    if (inquiry.applicationStatus === 'REJECTED') inquiry.status = 'REJECTED';
  }

  if (payload.status && ['NEW', 'APPROVED', 'REJECTED'].includes(String(payload.status).toUpperCase())) {
    inquiry.status = String(payload.status).toUpperCase();
  }

  if (payload.assignedOfficerName !== undefined) {
    inquiry.assignedOfficerName = String(payload.assignedOfficerName).trim();
  }
  if (payload.assignedOfficerId && mongoose.Types.ObjectId.isValid(payload.assignedOfficerId)) {
    inquiry.assignedOfficerId = payload.assignedOfficerId;
  }

  if (payload.followUpRemarks || payload.nextFollowUpDate) {
    const nextDt = payload.nextFollowUpDate ? new Date(payload.nextFollowUpDate) : new Date();
    inquiry.followUps.push({
      date: nextDt,
      remarks: String(payload.followUpRemarks || 'Updated from report').trim(),
      status: payload.nextFollowUpDate ? 'PENDING' : 'COMPLETED',
    });
    if (payload.nextFollowUpDate && !Number.isNaN(nextDt.getTime())) {
      inquiry.followUpDate = nextDt;
    }
  }

  await inquiry.save();

  ActivityLog.create({
    userId: reqUser?.id || null,
    userName: reqUser?.name || reqUser?.email || 'Administrator',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Front Office',
    subModule: 'inquiry',
    action: 'REPORT_UPDATE_INQUIRY_STAGE',
    description: `Updated inquiry stage for ${inquiry.studentName} (${inquiry.applicationStatus || inquiry.status})`,
  }).catch(() => {});

  return { ok: true, message: `Updated inquiry stage for ${inquiry.studentName}`, inquiry };
}

async function verifyMissingDocAction(payload = {}, { reqUser } = {}) {
  const targetStatus = ['COMPLETE', 'AWAITING_APPLICANT', 'AWAITING_VERIFICATION'].includes(
    String(payload.status || '').toUpperCase()
  )
    ? String(payload.status).toUpperCase()
    : 'COMPLETE';
  const docKey = String(payload.docKey || '').trim();
  const nextAction = payload.nextAction !== undefined ? String(payload.nextAction).trim() : undefined;

  let touched = false;

  if (payload.inquiryId && mongoose.Types.ObjectId.isValid(payload.inquiryId)) {
    const inquiry = await FrontOfficeInquiry.findById(payload.inquiryId);
    if (inquiry) {
      const idx = (inquiry.missingDocuments || []).findIndex(
        (d) =>
          (payload.missingDocId && String(d._id) === String(payload.missingDocId)) ||
          (docKey && d.docKey === docKey)
      );
      if (idx >= 0) {
        inquiry.missingDocuments[idx].status = targetStatus;
        if (nextAction !== undefined) inquiry.missingDocuments[idx].nextAction = nextAction;
        await inquiry.save();
        touched = true;
      }
    }
  }

  let student = null;
  if (payload.studentId && mongoose.Types.ObjectId.isValid(payload.studentId)) {
    student = await Student.findById(payload.studentId);
  } else if (payload.inquiryId && mongoose.Types.ObjectId.isValid(payload.inquiryId)) {
    student = await Student.findOne({ inquiryId: payload.inquiryId });
  }

  if (student && docKey) {
    if (!student.documents) student.documents = new Map();
    if (student.documents instanceof Map) {
      // ponytail: if Student.documents map was empty, seed standard checklist as false first so verifying 1 doc doesn't hide the other 4
      if (student.documents.size === 0) {
        for (const k of STANDARD_DOC_KEYS) student.documents.set(k, false);
      }
      student.documents.set(docKey, targetStatus === 'COMPLETE');
    } else {
      if (Object.keys(student.documents).length === 0) {
        for (const k of STANDARD_DOC_KEYS) student.documents[k] = false;
      }
      student.documents[docKey] = targetStatus === 'COMPLETE';
    }
    await student.save();
    touched = true;
  }

  if (!touched) {
    const err = new Error('Target inquiry or student document record not found');
    err.statusCode = 404;
    throw err;
  }

  ActivityLog.create({
    userId: reqUser?.id || null,
    userName: reqUser?.name || reqUser?.email || 'Administrator',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Students',
    subModule: 'document-reports',
    action: 'REPORT_VERIFY_MISSING_DOC',
    description: `Marked document "${docKey}" as ${targetStatus}`,
  }).catch(() => {});

  return { ok: true, message: `Document "${docKey || 'item'}" marked as ${targetStatus}` };
}

const UPDATE_INQUIRY_STAGE_DEF = {
  name: 'admissions-update-inquiry-stage',
  label: 'Update Status',
  scope: 'row',
  fields: [
    {
      key: 'applicationStatus',
      label: 'Status',
      type: 'select',
      defaultValue: 'UNDER_REVIEW',
      options: [
        { value: 'INQUIRY', label: 'Inquiry' },
        { value: 'SUBMITTED', label: 'Submitted' },
        { value: 'UNDER_REVIEW', label: 'Under Review' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
      ],
    },
    { key: 'assignedOfficerName', label: 'Assigned To', type: 'text', placeholder: 'Officer name' },
    { key: 'followUpRemarks', label: 'Note', type: 'text', placeholder: 'Notes from follow-up call' },
    { key: 'nextFollowUpDate', label: 'Next Follow-up', type: 'date' },
  ],
};

const VERIFY_MISSING_DOC_DEF = {
  name: 'admissions-verify-missing-doc',
  label: 'Update Document',
  scope: 'row',
  fields: [
    {
      key: 'status',
      label: 'Document Status',
      type: 'select',
      defaultValue: 'COMPLETE',
      options: [
        { value: 'COMPLETE', label: 'Verified / Complete' },
        { value: 'AWAITING_VERIFICATION', label: 'Needs Check' },
        { value: 'AWAITING_APPLICANT', label: 'Waiting for Student' },
      ],
    },
    { key: 'nextAction', label: 'Remarks', type: 'text', placeholder: 'e.g. Verified original document' },
  ],
};

const CATALOG = [
  {
    key: 'admissions-inquiry-register',
    pageNumber: 2,
    module: 'Admissions',
    categoryKey: 'Admissions',
    rbacModule: 'Front Office',
    rbacSubModule: 'inquiry',
    title: 'Admissions — Inquiry & Lead Register',
    purpose: 'Track every admission inquiry and its follow-up status.',
    filterSchema: [
      { key: 'dateFrom', label: 'Date From', type: 'date' },
      { key: 'dateTo', label: 'Date To', type: 'date' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'NEW', label: 'NEW' },
          { value: 'APPROVED', label: 'APPROVED' },
          { value: 'REJECTED', label: 'REJECTED' },
          { value: 'Follow-up', label: 'Follow-up' },
          { value: 'Applied', label: 'Applied' },
          { value: 'Enrolled', label: 'Enrolled' },
        ],
      },
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Applicant, phone, ID...' },
    ],
    inlineActions: [UPDATE_INQUIRY_STAGE_DEF],
  },
  {
    key: 'admissions-application-register',
    pageNumber: 3,
    module: 'Admissions',
    categoryKey: 'Admissions',
    rbacModule: 'Front Office',
    rbacSubModule: 'inquiry',
    title: 'Admissions — Application Register',
    purpose: 'Review submitted applications and their admission decision.',
    filterSchema: [
      { key: 'sessionId', label: 'Academic Session', type: 'session' },
      { key: 'programId', label: 'Program', type: 'program' },
      {
        key: 'applicationStatus',
        label: 'Application Status',
        type: 'select',
        options: [
          { value: 'SUBMITTED', label: 'SUBMITTED' },
          { value: 'UNDER_REVIEW', label: 'UNDER_REVIEW' },
          { value: 'APPROVED', label: 'APPROVED' },
          { value: 'REJECTED', label: 'REJECTED' },
          { value: 'PENDING', label: 'PENDING' },
        ],
      },
      { key: 'dateFrom', label: 'Date From', type: 'date' },
      { key: 'dateTo', label: 'Date To', type: 'date' },
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Application ID, applicant...' },
    ],
  },
  {
    key: 'admissions-enrollment-summary',
    pageNumber: 4,
    module: 'Admissions',
    categoryKey: 'Admissions',
    rbacModule: 'Students',
    rbacSubModule: 'reports',
    title: 'Admissions — Enrollment & Admission Summary',
    purpose: 'Confirm the number of students who completed admission.',
    filterSchema: [
      { key: 'sessionId', label: 'Academic Session', type: 'session' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'dateFrom', label: 'Admission From', type: 'date' },
      { key: 'dateTo', label: 'Admission To', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'Enrolled', label: 'Enrolled' },
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'CANCELLED', label: 'CANCELLED' },
          { value: 'STRUCK_OFF', label: 'STRUCK_OFF' },
          { value: 'EXPELLED', label: 'EXPELLED' },
          { value: 'GRADUATED', label: 'GRADUATED' },
        ],
      },
      {
        key: 'gender',
        label: 'Gender',
        type: 'select',
        options: [
          { value: 'Male', label: 'Male' },
          { value: 'Female', label: 'Female' },
          { value: 'Other', label: 'Other' },
        ],
      },
    ],
  },
  {
    key: 'admissions-source-conversion',
    pageNumber: 5,
    module: 'Admissions',
    categoryKey: 'Admissions',
    rbacModule: 'Students',
    rbacSubModule: 'conversion-report',
    altRbacModule: 'Front Office',
    altRbacSubModule: 'inquiry',
    title: 'Admissions — Source & Conversion Analysis',
    purpose: 'Compare which inquiry channels produce completed admissions.',
    filterSchema: [
      { key: 'dateFrom', label: 'Date From', type: 'date' },
      { key: 'dateTo', label: 'Date To', type: 'date' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS },
    ],
  },
  {
    key: 'admissions-missing-documents',
    pageNumber: 6,
    module: 'Admissions',
    categoryKey: 'Admissions',
    rbacModule: 'Students',
    rbacSubModule: 'document-reports',
    title: 'Admissions — Missing Documents & Pending Actions',
    purpose: 'Identify applications that cannot proceed because information or documents are missing.',
    filterSchema: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'AWAITING_APPLICANT', label: 'Awaiting Applicant' },
          { value: 'AWAITING_VERIFICATION', label: 'Awaiting Verification' },
        ],
      },
      { key: 'programId', label: 'Program', type: 'program' },
      {
        key: 'missingItem',
        label: 'Missing Item',
        type: 'select',
        options: STANDARD_DOC_KEYS.map((k) => ({ value: k, label: STANDARD_DOC_LABELS[k] })),
      },
      { key: 'officerName', label: 'Officer', type: 'text', placeholder: 'Filter by officer...' },
    ],
    inlineActions: [VERIFY_MISSING_DOC_DEF, UPDATE_INQUIRY_STAGE_DEF],
  },
];

const HANDLERS = {
  'admissions-inquiry-register': runInquiryRegister,
  'admissions-application-register': runApplicationRegister,
  'admissions-enrollment-summary': runEnrollmentSummary,
  'admissions-source-conversion': runSourceConversion,
  'admissions-missing-documents': runMissingDocuments,
};

const ACTIONS = {
  'admissions-update-inquiry-stage': updateInquiryStageAction,
  'admissions-verify-missing-doc': verifyMissingDocAction,
};

module.exports = { CATALOG, HANDLERS, ACTIONS };
