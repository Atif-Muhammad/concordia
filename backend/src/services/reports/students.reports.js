const mongoose = require('mongoose');
const {
  Student,
  Program,
  Class,
  Section,
  AcademicSession,
  Attendance,
  FeeChallan,
  ExtraChallan,
  ExamResult,
  FrontOfficeInquiry,
} = require('../../models');
const {
  ACTIVE_STUDENT_FILTER,
  buildStudentStatusCondition,
  isStudentActive,
} = require('../../utils/studentStatus');
const { buildStudentSearchCondition, escapeRegex } = require('../../utils/studentSearch');
const {
  parseMulti,
  toObjectIds,
  applyMultiIdFilter,
  applyMultiStringFilter,
  formatRs,
  formatNum,
  formatPct,
  formatDate,
  fullName,
  maskValue,
  loadUserPermissions,
  canViewPrivateData,
  resolveSession,
} = require('./reportHelpers');

const STANDARD_DOC_LABELS = {
  photograph: 'Passport Photograph',
  cnicCopy: 'CNIC / Form B Copy',
  matricDmc: 'Matric DMC',
  guardianContact: 'Guardian Contact / CNIC',
  characterCertificate: 'Character Certificate',
  pictures: 'Passport Photograph',
  formB: 'Form B / CNIC Copy',
  dmcMatric: 'Matric DMC',
  dmcIntermediate: 'Intermediate DMC',
  fatherCnic: 'Father / Guardian CNIC',
  migration: 'Migration Certificate',
  affidavit: 'Affidavit / Character Certificate',
  admissionForm: 'Admission Form',
};
const STANDARD_DOC_KEYS = [
  'photograph',
  'cnicCopy',
  'matricDmc',
  'guardianContact',
  'characterCertificate',
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

function buildSessionCondition(sessionId) {
  const sIds = toObjectIds(sessionId);
  if (sIds.length === 0) return null;
  const val = sIds.length === 1 ? sIds[0] : { $in: sIds };
  return { $or: [{ sessionId: val }, { 'academicRecords.sessionId': val }] };
}

function resolveStatusFilter(rawStatus, defaultActive = true) {
  const values = parseMulti(rawStatus)
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  if (values.length === 0) {
    return { cond: defaultActive ? ACTIVE_STUDENT_FILTER : null, label: defaultActive ? 'ACTIVE (Default)' : 'ALL', isDefaultActive: defaultActive };
  }
  if (values.includes('ALL')) return { cond: null, label: 'ALL', isDefaultActive: false };
  if (values.length === 1 && values[0] === 'ACTIVE') return { cond: ACTIVE_STUDENT_FILTER, label: 'ACTIVE', isDefaultActive: false };
  const statusOr = [];
  if (values.includes('ACTIVE')) statusOr.push(ACTIVE_STUDENT_FILTER);
  const other = values.filter((v) => v !== 'ACTIVE');
  if (other.length > 0) statusOr.push(buildStudentStatusCondition(other.join(',')));
  return {
    cond: statusOr.length === 1 ? statusOr[0] : { $or: statusOr },
    label: values.join(', '),
    isDefaultActive: false,
  };
}

async function resolveSelectedStudentFilters(query = {}, extra = {}) {
  const out = [];
  const lookups = [
    ['sessionId', AcademicSession, 'Session'],
    ['programId', Program, 'Program'],
    ['classId', Class, 'Class'],
    ['sectionId', Section, 'Section'],
  ];
  await Promise.all(
    lookups.map(async ([key, Model, label]) => {
      if (!query[key] || query[key] === 'all') return;
      const ids = toObjectIds(query[key]);
      if (ids.length === 0) return;
      const docs = await Model.find({ _id: { $in: ids } }).select('name').lean();
      out.push({ label, value: docs.map((d) => d.name).join(', ') || String(query[key]) });
    })
  );
  if (query.dateFrom || query.dateTo) {
    out.push({
      label: 'Date Range',
      value: `${query.dateFrom ? formatDate(query.dateFrom) : 'Start'} – ${query.dateTo ? formatDate(query.dateTo) : 'Today'}`,
    });
  }
  Object.entries(extra).forEach(([k, lbl]) => {
    if (query[k] && query[k] !== 'all') out.push({ label: lbl, value: String(query[k]) });
  });
  return out;
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

// =============================================================================
// Page 7: Students — Master Student Register
// =============================================================================
async function runMasterRegister(query = {}, ctxOrUser = null) {
  const { permCtx } = await resolveCtx(query, ctxOrUser);
  const andConds = [];

  const sessCond = buildSessionCondition(query.sessionId);
  if (sessCond) andConds.push(sessCond);

  const idFilter = {};
  applyMultiIdFilter(idFilter, 'programId', query.programId);
  applyMultiIdFilter(idFilter, 'classId', query.classId);
  applyMultiIdFilter(idFilter, 'sectionId', query.sectionId);
  if (Object.keys(idFilter).length > 0) andConds.push(idFilter);

  const genderCond = {};
  applyMultiStringFilter(genderCond, 'gender', query.gender, { caseInsensitive: true });
  if (Object.keys(genderCond).length > 0) {
    andConds.push(genderCond);
  }

  const { cond: statusCond, label: statusLabel, isDefaultActive } = resolveStatusFilter(query.status, true);
  if (statusCond) andConds.push(statusCond);

  const canReadPrivate = canViewPrivateData(permCtx, 'Students', 'records', 'read');
  if (query.search && String(query.search).trim()) {
    const extraFields = canReadPrivate
      ? ['parentOrGuardianPhone', 'studentCnic', 'admissionFormNumber']
      : ['admissionFormNumber'];
    const searchCond = buildStudentSearchCondition(query.search, { extraFields });
    if (searchCond) andConds.push(searchCond);
  }

  const mongoQuery = andConds.length > 0 ? { $and: andConds } : {};
  const [students, selectedFilters] = await Promise.all([
    Student.find(mongoQuery)
      .populate('programId', 'name')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .sort({ rollNumber: 1, fName: 1 })
      .lean(),
    resolveSelectedStudentFilters(query, {
      gender: 'Gender',
      search: 'Search',
    }),
  ]);
  selectedFilters.push({ label: 'Status', value: statusLabel });
  let femaleCount = 0;
  let maleCount = 0;
  const programSet = new Set();

  const rows = students.map((s) => {
    const g = String(s.gender || '').trim();
    if (/^female$/i.test(g)) femaleCount += 1;
    else if (/^male$/i.test(g)) maleCount += 1;
    if (s.programId?._id || s.programId) programSet.add(String(s.programId?._id || s.programId));

    return {
      id: String(s._id),
      rollNumber: s.rollNumber || '—',
      studentName: fullName(s) || '—',
      programName: s.programId?.name || '—',
      className: s.classId?.name || '—',
      sectionName: s.sectionId?.name || '—',
      gender: g || '—',
      guardianPhone: canReadPrivate
        ? (s.parentOrGuardianPhone || '—')
        : maskValue(s.parentOrGuardianPhone),
      status: s.status || 'ACTIVE',
      drilldownKey: 'students-profile-360',
      drilldownFilters: { studentId: String(s._id) },
    };
  });

  const firstKpiLabel = isDefaultActive || statusLabel === 'ACTIVE' ? 'Active students' : 'Matching students';

  return {
    selectedFilters,
    kpis: [
      { label: firstKpiLabel, value: formatNum(rows.length) },
      { label: 'Female', value: formatNum(femaleCount) },
      { label: 'Male', value: formatNum(maleCount) },
      { label: 'Programs', value: formatNum(programSet.size) },
    ],
    columns: [
      { key: 'rollNumber', label: 'Student ID' },
      { key: 'studentName', label: 'Student name' },
      { key: 'programName', label: 'Program' },
      { key: 'className', label: 'Class' },
      { key: 'sectionName', label: 'Section' },
      { key: 'gender', label: 'Gender' },
      { key: 'guardianPhone', label: 'Guardian phone' },
    ],
    rows,
    totalsRow: null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: !canReadPrivate ? 'warning' : 'info',
      message: !canReadPrivate
        ? `Showing ${rows.length} students. Guardian contact numbers are masked based on your Students records permissions.`
        : `Showing ${rows.length} student records across ${programSet.size} program(s) (${maleCount} male, ${femaleCount} female).`,
    },
  };
}

// =============================================================================
// Page 8: Students — Class & Section Strength
// =============================================================================
async function runClassStrength(query = {}, ctxOrUser = null) {
  await resolveCtx(query, ctxOrUser);
  const andConds = [];

  const sessCond = buildSessionCondition(query.sessionId);
  if (sessCond) andConds.push(sessCond);

  const idFilter = {};
  applyMultiIdFilter(idFilter, 'programId', query.programId);
  applyMultiIdFilter(idFilter, 'classId', query.classId);
  applyMultiIdFilter(idFilter, 'sectionId', query.sectionId);
  if (Object.keys(idFilter).length > 0) andConds.push(idFilter);

  const { cond: statusCond, label: statusLabel } = resolveStatusFilter(query.status, true);
  if (statusCond) andConds.push(statusCond);

  const mongoQuery = andConds.length > 0 ? { $and: andConds } : {};

  const [rawStudents, programs, classes, sections, selectedFilters] = await Promise.all([
    Student.find(mongoQuery).select('_id programId classId sectionId gender').lean(),
    Program.find().select('name').lean(),
    Class.find().select('name programId').lean(),
    Section.find().select('name classId capacity').lean(),
    resolveSelectedStudentFilters(query),
  ]);
  selectedFilters.push({ label: 'Status', value: statusLabel });

  const progMap = new Map(programs.map((p) => [String(p._id), p]));
  const classMap = new Map(classes.map((c) => [String(c._id), c]));
  const secMap = new Map(sections.map((s) => [String(s._id), s]));

  // Deduplicate distinct student _id and group by (programId, classId, sectionId)
  const seenStudents = new Set();
  const groups = new Map();
  const distinctPrograms = new Set();

  for (const s of rawStudents) {
    const sid = String(s._id);
    if (seenStudents.has(sid)) continue;
    seenStudents.add(sid);

    const pId = String(s.programId || '');
    const cId = String(s.classId || '');
    const secId = s.sectionId ? String(s.sectionId) : 'UNASSIGNED';
    if (pId) distinctPrograms.add(pId);

    const key = `${pId}::${cId}::${secId}`;
    let bucket = groups.get(key);
    if (!bucket) {
      const pDoc = progMap.get(pId);
      const cDoc = classMap.get(cId);
      const secDoc = secId !== 'UNASSIGNED' ? secMap.get(secId) : null;
      bucket = {
        programId: pId,
        classId: cId,
        sectionId: secId === 'UNASSIGNED' ? '' : secId,
        programName: pDoc?.name || 'Unassigned',
        className: cDoc?.name || 'Unassigned',
        sectionName: secDoc?.name || 'Unassigned',
        male: 0,
        female: 0,
        total: 0,
        capacityNum: secDoc && secDoc.capacity !== undefined && secDoc.capacity !== null ? Number(secDoc.capacity) : null,
      };
      groups.set(key, bucket);
    }

    const g = String(s.gender || '').trim();
    if (/^male$/i.test(g)) bucket.male += 1;
    else if (/^female$/i.test(g)) bucket.female += 1;
    bucket.total += 1;
  }

  const rows = Array.from(groups.values())
    .sort(
      (a, b) =>
        a.programName.localeCompare(b.programName) ||
        a.className.localeCompare(b.className) ||
        a.sectionName.localeCompare(b.sectionName)
    )
    .map((b) => {
      const cap = b.capacityNum;
      return {
        id: `${b.programId}-${b.classId}-${b.sectionId || 'none'}`,
        programName: b.programName,
        className: b.className,
        sectionName: b.sectionName,
        male: b.male,
        female: b.female,
        total: b.total,
        capacity: cap !== null ? cap : '—',
        occupancyPct: cap && cap > 0 ? formatPct(b.total, cap) : '—',
        _capNum: cap || 0,
        drilldownKey: 'students-master-register',
        drilldownFilters: {
          programId: b.programId || undefined,
          classId: b.classId || undefined,
          sectionId: b.sectionId || undefined,
        },
      };
    });

  const totalStrength = rows.reduce((sum, r) => sum + r.total, 0);
  const totalMale = rows.reduce((sum, r) => sum + r.male, 0);
  const totalFemale = rows.reduce((sum, r) => sum + r.female, 0);
  const totalCap = rows.reduce((sum, r) => sum + r._capNum, 0);
  const avgPerSection = rows.length > 0 ? (totalStrength / rows.length).toFixed(1) : '0';

  const overcrowded = rows.filter((r) => r._capNum > 0 && r.total > r._capNum);

  return {
    selectedFilters,
    kpis: [
      { label: 'Total strength', value: formatNum(totalStrength) },
      { label: 'Programs', value: formatNum(distinctPrograms.size) },
      { label: 'Sections', value: formatNum(rows.length) },
      { label: 'Average per section', value: avgPerSection },
    ],
    columns: [
      { key: 'programName', label: 'Program' },
      { key: 'className', label: 'Class' },
      { key: 'sectionName', label: 'Section' },
      { key: 'male', label: 'Male', align: 'right' },
      { key: 'female', label: 'Female', align: 'right' },
      { key: 'total', label: 'Total', align: 'right' },
      { key: 'capacity', label: 'Capacity', align: 'right' },
      { key: 'occupancyPct', label: 'Occupancy %', align: 'right' },
    ],
    rows,
    totalsRow: rows.length > 0
      ? {
          programName: 'Total',
          className: '',
          sectionName: `${rows.length} section(s)`,
          male: totalMale,
          female: totalFemale,
          total: totalStrength,
          capacity: totalCap > 0 ? totalCap : '—',
          occupancyPct: totalCap > 0 ? formatPct(totalStrength, totalCap) : '—',
        }
      : null,
    charts: rows.length > 0
      ? [{
          type: 'bar',
          title: 'Section Strength Distribution',
          xKey: 'label',
          data: rows.slice(0, 15).map((r) => ({
            label: `${r.className}${r.sectionName !== 'Unassigned' ? ` (${r.sectionName})` : ''}`,
            male: r.male,
            female: r.female,
          })),
          series: [
            { dataKey: 'male', label: 'Male' },
            { dataKey: 'female', label: 'Female' },
          ],
        }]
      : [],
    secondaryTables: [],
    insight: {
      severity: overcrowded.length > 0 ? 'warning' : 'info',
      message:
        overcrowded.length > 0
          ? `${overcrowded.length} section(s) exceed configured capacity (${overcrowded.map((r) => `${r.className} - ${r.sectionName}`).join(', ')}).`
          : `Total headcount is ${totalStrength} across ${rows.length} section(s) (average ${avgPerSection} students/section).`,
    },
  };
}

// =============================================================================
// Page 9: Students — Student 360° Profile
// =============================================================================
async function runStudentProfile360(query = {}, ctxOrUser = null) {
  const { permCtx } = await resolveCtx(query, ctxOrUser);
  const selectedFilters = await resolveSelectedStudentFilters(query);

  let student = null;
  if (query.studentId && mongoose.Types.ObjectId.isValid(query.studentId)) {
    student = await Student.findById(query.studentId)
      .populate('programId', 'name')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('sessionId', 'name')
      .lean();
  } else {
    const andConds = [ACTIVE_STUDENT_FILTER];
    const sessCond = buildSessionCondition(query.sessionId);
    if (sessCond) andConds.push(sessCond);
    const idFilter = {};
    applyMultiIdFilter(idFilter, 'programId', query.programId);
    applyMultiIdFilter(idFilter, 'classId', query.classId);
    applyMultiIdFilter(idFilter, 'sectionId', query.sectionId);
    if (Object.keys(idFilter).length > 0) andConds.push(idFilter);

    student = await Student.findOne({ $and: andConds })
      .populate('programId', 'name')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('sessionId', 'name')
      .sort({ rollNumber: 1, createdAt: -1 })
      .lean();
  }

  if (!student) {
    return {
      selectedFilters,
      kpis: [
        { label: 'Attendance %', value: '0.0%' },
        { label: 'Fee paid (Rs)', value: formatRs(0) },
        { label: 'Fee balance (Rs)', value: formatRs(0) },
        { label: 'Latest exam %', value: '—' },
      ],
      columns: [
        { key: 'area', label: 'Area' },
        { key: 'details', label: 'Details' },
        { key: 'statusUpdate', label: 'Status / latest update' },
      ],
      rows: [],
      totalsRow: null,
      charts: [],
      secondaryTables: [],
      insight: {
        severity: 'info',
        message: 'No matching active student found. Use the Student or Class filters above to select a student for the 360° profile.',
      },
    };
  }

  selectedFilters.unshift({
    label: 'Student',
    value: `${fullName(student)} (${student.rollNumber || String(student._id).slice(-6)})`,
  });

  const [attendanceRecs, feeChallans, extraChallans, examResults, linkedInquiry] = await Promise.all([
    Attendance.find({ studentId: student._id, role: { $regex: /^student$/i } })
      .sort({ date: -1 })
      .lean(),
    FeeChallan.find({ studentId: student._id, status: { $nin: ['VOID', 'SUPERSEDED'] } })
      .sort({ dueDate: -1 })
      .lean(),
    ExtraChallan.find({ studentId: student._id, status: { $nin: ['VOID', 'SUPERSEDED'] } })
      .sort({ dueDate: -1 })
      .lean(),
    ExamResult.find({ studentId: student._id })
      .populate('examId', 'examName type startDate')
      .sort({ createdAt: -1 })
      .lean(),
    student.inquiryId ? FrontOfficeInquiry.findById(student.inquiryId).lean() : Promise.resolve(null),
  ]);

  const showPrivate = canViewPrivateData(permCtx, 'Students', 'records');

  // Attendance calculation (exclude holidays / unmarked)
  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  for (const a of attendanceRecs) {
    const st = String(a.status || '').toUpperCase();
    if (st === 'PRESENT' || st === 'LATE') presentDays += 1;
    else if (st === 'ABSENT') absentDays += 1;
    else if (st === 'LEAVE' || st === 'HALF_DAY') leaveDays += 1;
  }
  const markedDays = presentDays + absentDays + leaveDays;
  const attPctStr = formatPct(presentDays, markedDays);
  const latestAttDate = attendanceRecs[0]?.date || '';

  // Fee calculation (consistent with dashboard.service.js)
  let feePaid = 0;
  let feeBalance = 0;
  let overdueCount = 0;

  const allChallans = [
    ...feeChallans.map((c) => ({ ...c, _type: 'Fee Challan' })),
    ...extraChallans.map((c) => ({ ...c, _type: 'Extra Challan' })),
  ];

  if (allChallans.length > 0) {
    for (const c of allChallans) {
      const paid = Number(c.paidAmount || 0);
      const total = Number(c.totalAmount ?? c.netPayable ?? c.amount ?? 0);
      const st = String(c.status || '').toUpperCase();
      feePaid += paid;
      if (!['PAID', 'SETTLED'].includes(st)) {
        feeBalance += Math.max(0, total - paid);
        if (st === 'OVERDUE') overdueCount += 1;
      }
    }
  } else if (Array.isArray(student.installments) && student.installments.length > 0) {
    for (const inst of student.installments) {
      const st = String(inst.status || '').toUpperCase();
      if (['VOID', 'SUPERSEDED'].includes(st)) continue;
      const paid = Number(inst.paidAmount || 0);
      const total = Number(inst.totalAmount ?? inst.amount ?? inst.basePayable ?? 0);
      feePaid += paid;
      if (!['PAID', 'SETTLED'].includes(st)) {
        feeBalance += Math.max(0, total - paid);
        if (st === 'OVERDUE') overdueCount += 1;
      }
    }
  }

  // Documents breakdown
  const rawDocs = toPlainDocsMap(student.documents);
  const docKeys = Object.keys(rawDocs);
  const submittedDocs = [];
  const missingDocs = [];
  if (docKeys.length > 0) {
    for (const k of docKeys) {
      const lbl = STANDARD_DOC_LABELS[k] || k;
      if (rawDocs[k] === true || rawDocs[k] === 'true' || rawDocs[k] === 1) submittedDocs.push(lbl);
      else missingDocs.push(lbl);
    }
  } else {
    for (const k of STANDARD_DOC_KEYS) missingDocs.push(STANDARD_DOC_LABELS[k]);
  }

  const latestExam = examResults[0] || null;
  const latestExamPct = latestExam ? `${Number(latestExam.percentage || 0).toFixed(1)}%` : '—';

  const rows = [
    {
      id: 'personal',
      area: 'Personal',
      details: `${fullName(student)} • ID: ${student.rollNumber || '—'} • Gender: ${student.gender || '—'} • DOB: ${formatDate(student.dob)}${showPrivate && student.studentCnic ? ` • CNIC: ${student.studentCnic}` : ''}`,
      statusUpdate: `Status: ${student.status || 'ACTIVE'}`,
    },
    {
      id: 'guardian',
      area: 'Guardian',
      details: `Guardian: ${student.fatherOrguardian || '—'} • Phone: ${showPrivate ? (student.parentOrGuardianPhone || '—') : maskValue(student.parentOrGuardianPhone)}${showPrivate && student.parentOrGuardianEmail ? ` • Email: ${student.parentOrGuardianEmail}` : ''}`,
      statusUpdate: showPrivate ? (student.address || 'Guardian contact verified') : 'Private details masked',
    },
    {
      id: 'admission',
      area: 'Admission',
      details: `Program: ${student.programId?.name || '—'} • Class: ${student.classId?.name || '—'} • Section: ${student.sectionId?.name || 'Unassigned'} • Session: ${student.sessionId?.name || student.session || '—'}${student.admissionFormNumber ? ` • Form #: ${student.admissionFormNumber}` : ''}`,
      statusUpdate: `Admitted ${formatDate(student.admissionDate || student.createdAt)}${linkedInquiry ? ` (Inquiry INQ-${String(linkedInquiry._id).slice(-6).toUpperCase()})` : ''}`,
    },
    {
      id: 'documents',
      area: 'Documents',
      details: `${submittedDocs.length} submitted${missingDocs.length ? ` • Pending: ${missingDocs.join(', ')}` : ' • All checked documents complete'}`,
      statusUpdate: missingDocs.length > 0 ? `Incomplete (${missingDocs.length} pending)` : 'Complete',
    },
    {
      id: 'fee',
      area: 'Fee',
      details: `Paid: ${formatRs(feePaid)} • Balance: ${formatRs(feeBalance)}${student.isScholarship100 ? ' • 100% Scholarship' : ''}`,
      statusUpdate: feeBalance > 0 ? (overdueCount > 0 ? `${overdueCount} overdue challan(s)` : 'Balance pending') : 'Cleared',
    },
    {
      id: 'attendance',
      area: 'Attendance',
      details: `Present: ${presentDays} / ${markedDays} working days • Absent: ${absentDays} • Leave: ${leaveDays}`,
      statusUpdate: markedDays > 0 ? `${attPctStr} overall${latestAttDate ? ` (Last: ${formatDate(latestAttDate)})` : ''}` : 'No attendance records',
    },
    {
      id: 'exams',
      area: 'Exams',
      details: latestExam
        ? `${latestExam.examId?.examName || 'Exam'}: ${latestExam.obtainedMarks}/${latestExam.totalMarks} (${latestExamPct})${latestExam.grade ? ` • Grade ${latestExam.grade}` : ''}${latestExam.position ? ` • Position #${latestExam.position}` : ''}`
        : 'No published examination results',
      statusUpdate:
        examResults.length > 0
          ? `${examResults.length} exam result(s)${showPrivate && latestExam?.remarks ? ` • ${latestExam.remarks}` : ''}`
          : 'Awaiting results',
    },
  ];

  const secondaryTables = [];
  if (allChallans.length > 0) {
    secondaryTables.push({
      title: 'Fee Challan History',
      columns: [
        { key: 'challanNo', label: 'Challan #' },
        { key: 'type', label: 'Type' },
        { key: 'month', label: 'Month / Due Date' },
        { key: 'total', label: 'Total (Rs)', align: 'right' },
        { key: 'paid', label: 'Paid (Rs)', align: 'right' },
        { key: 'status', label: 'Status' },
      ],
      rows: allChallans.slice(0, 12).map((c) => ({
        challanNo: c.challanNo || '—',
        type: c._type,
        month: c.month || formatDate(c.dueDate),
        total: formatRs(c.totalAmount ?? c.netPayable ?? c.amount ?? 0),
        paid: formatRs(c.paidAmount || 0),
        status: c.status || 'PENDING',
      })),
    });
  }
  if (examResults.length > 0) {
    secondaryTables.push({
      title: 'Examination History',
      columns: [
        { key: 'examName', label: 'Exam' },
        { key: 'obtained', label: 'Obtained', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
        { key: 'percentage', label: 'Percentage', align: 'right' },
        { key: 'grade', label: 'Grade' },
      ],
      rows: examResults.map((er) => ({
        examName: er.examId?.examName || 'Exam',
        obtained: er.obtainedMarks,
        total: er.totalMarks,
        percentage: `${Number(er.percentage || 0).toFixed(1)}%`,
        grade: er.grade || '—',
      })),
    });
  }

  const alerts = [];
  if (markedDays > 0 && (presentDays / markedDays) < 0.75) alerts.push(`low attendance (${attPctStr})`);
  if (feeBalance > 0) alerts.push(`outstanding balance of ${formatRs(feeBalance)}`);
  if (missingDocs.length > 0) alerts.push(`${missingDocs.length} pending document(s)`);

  return {
    selectedFilters,
    kpis: [
      { label: 'Attendance %', value: markedDays > 0 ? attPctStr : '0.0%' },
      { label: 'Fee paid (Rs)', value: formatRs(feePaid) },
      { label: 'Fee balance (Rs)', value: formatRs(feeBalance) },
      { label: 'Latest exam %', value: latestExamPct },
    ],
    columns: [
      { key: 'area', label: 'Area' },
      { key: 'details', label: 'Details' },
      { key: 'statusUpdate', label: 'Status / latest update' },
    ],
    rows,
    totalsRow: null,
    charts: [],
    secondaryTables,
    insight: {
      severity: alerts.length > 0 ? 'warning' : 'info',
      message:
        alerts.length > 0
          ? `Action items for ${fullName(student)}: ${alerts.join('; ')}.`
          : `${fullName(student)} is in good standing across attendance, fees, documents, and academics.`,
    },
  };
}

// =============================================================================
// Page 10: Students — Status Movement & Withdrawals
// =============================================================================
function classifyMovementType(newStatus = '', action = '') {
  const s = String(newStatus || '').trim().toUpperCase().replace(/\s+/g, '_');
  const a = String(action || '').trim().toUpperCase();
  if (a === 'REJOIN' || s === 'REJOINED') return 'REJOIN';
  if (a === 'PROMOTE' || a === 'DEMOTE' || s === 'PROMOTED' || s === 'DEMOTED') return 'PROMOTED';
  if (s === 'STRUCK_OFF' || a === 'STRUCK_OFF' || s === 'WITHDRAWN') return 'STRUCK_OFF';
  if (s === 'EXPELLED' || a === 'EXPEL' || s === 'SUSPENDED') return 'EXPELLED';
  if (s === 'GRADUATED' || s === 'PASSED_OUT' || a === 'PASSOUT') return 'GRADUATED';
  if (s === 'TRANSFERRED' || a === 'TRANSFER') return 'TRANSFERRED';
  if (s === 'CANCELLED' || a === 'CANCEL') return 'CANCELLED';
  if (s === 'PENDING') return 'PENDING';
  if (a === 'JOINED' || a === 'ADMIT' || s === 'ACTIVE') return 'JOINED';
  return s || a || 'OTHER';
}

async function runStatusMovement(query = {}, ctxOrUser = null) {
  await resolveCtx(query, ctxOrUser);
  const stuQuery = {};
  applyMultiIdFilter(stuQuery, 'programId', query.programId);

  const [students, selectedFilters] = await Promise.all([
    Student.find(stuQuery)
      .populate('programId', 'name')
      .lean(),
    resolveSelectedStudentFilters(query, {
      movementType: 'Movement Type',
      reason: 'Reason',
    }),
  ]);

  let dateStart = null;
  let dateEnd = null;
  if (query.dateFrom) {
    const d = new Date(query.dateFrom);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      dateStart = d;
    }
  }
  if (query.dateTo) {
    const d = new Date(query.dateTo);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      dateEnd = d;
    }
  }

  const movementValues = parseMulti(query.movementType)
    .filter((v) => !/^all$/i.test(v))
    .map((v) => v.trim().toUpperCase());
  const reasonFilter = String(query.reason || '').trim().toLowerCase();

  let currentActive = 0;
  let withdrawnStruckExpelled = 0;
  let transferredGraduated = 0;
  let pendingDecisions = 0;

  const events = [];

  for (const s of students) {
    const upperCurStatus = String(s.status || 'ACTIVE').trim().toUpperCase().replace(/\s+/g, '_');
    if (isStudentActive(s)) {
      currentActive += 1;
    } else if (['STRUCK_OFF', 'EXPELLED', 'CANCELLED'].includes(upperCurStatus)) {
      withdrawnStruckExpelled += 1;
    } else if (['TRANSFERRED', 'GRADUATED', 'PASSED_OUT'].includes(upperCurStatus) || s.passedOut === true) {
      transferredGraduated += 1;
    } else if (upperCurStatus === 'PENDING') {
      pendingDecisions += 1;
    }

    const baseInfo = {
      studentId: String(s._id),
      rollNumber: s.rollNumber || '—',
      studentName: fullName(s) || '—',
      programName: s.programId?.name || '—',
    };

    const history = Array.isArray(s.statusHistory) ? s.statusHistory : [];
    const academicRecs = Array.isArray(s.academicRecords) ? s.academicRecords : [];

    for (const h of history) {
      const effectiveRaw = h.date || h.createdAt || s.statusDate || s.updatedAt;
      const newStatus = String(h.newStatus || s.status || 'ACTIVE').toUpperCase();
      events.push({
        ...baseInfo,
        id: `${s._id}-sh-${h._id || effectiveRaw}`,
        previousStatus: h.previousStatus || 'NEW',
        newStatus,
        effectiveDateRaw: effectiveRaw,
        effectiveDate: formatDate(effectiveRaw),
        reason: h.reason || s.statusReason || h.action || 'Status updated',
        movementCategory: classifyMovementType(newStatus, h.action),
      });
    }

    for (let i = 0; i < academicRecs.length; i += 1) {
      const ar = academicRecs[i];
      const arStatus = String(ar.status || '').toUpperCase();
      if (!['PROMOTED', 'DEMOTED', 'REJOINED', 'TRANSFERRED', 'COMPLETED'].includes(arStatus)) continue;
      const effectiveRaw = ar.endDate || ar.startDate || ar.createdAt;
      const tMs = effectiveRaw ? new Date(effectiveRaw).getTime() : 0;
      const dupInHistory = history.some(
        (h) => h.date && Math.abs(new Date(h.date).getTime() - tMs) < 60000
      );
      if (dupInHistory) continue;

      events.push({
        ...baseInfo,
        id: `${s._id}-ar-${ar._id || i}`,
        previousStatus: i > 0 ? String(academicRecs[i - 1].status || 'ACTIVE').toUpperCase() : 'ACTIVE',
        newStatus: arStatus,
        effectiveDateRaw: effectiveRaw,
        effectiveDate: formatDate(effectiveRaw),
        reason: ar.reason || `Academic transition (${arStatus})`,
        movementCategory: classifyMovementType(arStatus, arStatus),
      });
    }

    if (history.length === 0) {
      // Fallback for non-active students without statusHistory
      if (!isStudentActive(s)) {
        const effectiveNewStatus =
          s.passedOut && upperCurStatus === 'ACTIVE' ? 'GRADUATED' : upperCurStatus;
        const effectiveRaw = s.graduationDate || s.statusDate || s.updatedAt || s.createdAt;
        const defaultReason =
          effectiveNewStatus === 'GRADUATED'
            ? 'Passed out / Graduated'
            : effectiveNewStatus === 'PENDING'
              ? 'Pending admission decision'
              : 'Status changed';
        events.push({
          ...baseInfo,
          id: `${s._id}-fallback-status`,
          previousStatus: effectiveNewStatus === 'PENDING' ? 'NEW' : 'ACTIVE',
          newStatus: effectiveNewStatus,
          effectiveDateRaw: effectiveRaw,
          effectiveDate: formatDate(effectiveRaw),
          reason: s.statusReason || defaultReason,
          movementCategory: classifyMovementType(effectiveNewStatus, ''),
        });
      }

      // Emit initial admission / joined event for active students (or when specifically filtering JOINED)
      if ((isStudentActive(s) || movementValues.includes('JOINED')) && (s.admissionDate || s.createdAt)) {
        const joinRaw = s.admissionDate || s.createdAt;
        events.push({
          ...baseInfo,
          id: `${s._id}-joined`,
          previousStatus: 'NEW',
          newStatus: 'ACTIVE',
          effectiveDateRaw: joinRaw,
          effectiveDate: formatDate(joinRaw),
          reason: 'Admitted / Joined',
          movementCategory: 'JOINED',
        });
      }
    }
  }

  const filteredEvents = events
    .filter((ev) => {
      if (dateStart || dateEnd) {
        const dt = ev.effectiveDateRaw ? new Date(ev.effectiveDateRaw) : null;
        if (!dt || Number.isNaN(dt.getTime())) return false;
        if (dateStart && dt < dateStart) return false;
        if (dateEnd && dt > dateEnd) return false;
      }
      if (movementValues.length > 0 && !movementValues.includes(ev.movementCategory)) {
        return false;
      }
      if (reasonFilter && !String(ev.reason || '').toLowerCase().includes(reasonFilter)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.effectiveDateRaw || 0) - new Date(a.effectiveDateRaw || 0))
    .map((ev) => ({
      id: ev.id,
      rollNumber: ev.rollNumber,
      studentName: ev.studentName,
      programName: ev.programName,
      previousStatus: ev.previousStatus,
      newStatus: ev.newStatus,
      effectiveDate: ev.effectiveDate,
      reason: ev.reason,
      drilldownKey: 'students-profile-360',
      drilldownFilters: { studentId: ev.studentId },
    }));

  return {
    selectedFilters,
    kpis: [
      { label: 'Current active', value: formatNum(currentActive) },
      { label: 'Withdrawn/Struck Off/Expelled', value: formatNum(withdrawnStruckExpelled) },
      { label: 'Transferred/Graduated', value: formatNum(transferredGraduated) },
      { label: 'Pending decisions', value: formatNum(pendingDecisions) },
    ],
    columns: [
      { key: 'rollNumber', label: 'Student ID' },
      { key: 'studentName', label: 'Student' },
      { key: 'programName', label: 'Program' },
      { key: 'previousStatus', label: 'Previous status' },
      { key: 'newStatus', label: 'New status' },
      { key: 'effectiveDate', label: 'Effective date' },
      { key: 'reason', label: 'Reason' },
    ],
    rows: filteredEvents,
    totalsRow: null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: withdrawnStruckExpelled > 0 || pendingDecisions > 0 ? 'warning' : 'info',
      message: `${filteredEvents.length} movement event(s) matched. Current population: ${currentActive} active, ${withdrawnStruckExpelled} withdrawn/struck off/expelled, ${transferredGraduated} transferred/graduated, ${pendingDecisions} pending.`,
    },
  };
}

const CATALOG = [
  {
    key: 'students-master-register',
    pageNumber: 7,
    module: 'Students',
    categoryKey: 'Students',
    rbacModule: 'Students',
    rbacSubModule: 'reports',
    title: 'Students — Master Student Register',
    purpose: 'Search and export the complete student list using combined filters.',
    filterSchema: [
      { key: 'sessionId', label: 'Academic Session', type: 'session' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'classId', label: 'Class', type: 'class' },
      { key: 'sectionId', label: 'Section', type: 'section' },
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
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'GRADUATED', label: 'GRADUATED' },
          { value: 'EXPELLED', label: 'EXPELLED' },
          { value: 'STRUCK_OFF', label: 'STRUCK_OFF' },
          { value: 'PENDING', label: 'PENDING' },
          { value: 'ALL', label: 'ALL' },
        ],
      },
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Name, ID, guardian, phone...' },
    ],
  },
  {
    key: 'students-class-strength',
    pageNumber: 8,
    module: 'Students',
    categoryKey: 'Students',
    rbacModule: 'Students',
    rbacSubModule: 'reports',
    title: 'Students — Class & Section Strength',
    purpose: 'Show enrollment count and gender distribution by program, class and section.',
    filterSchema: [
      { key: 'sessionId', label: 'Academic Session', type: 'session' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'classId', label: 'Class', type: 'class' },
      { key: 'sectionId', label: 'Section', type: 'section' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'GRADUATED', label: 'GRADUATED' },
          { value: 'EXPELLED', label: 'EXPELLED' },
          { value: 'STRUCK_OFF', label: 'STRUCK_OFF' },
          { value: 'ALL', label: 'ALL' },
        ],
      },
    ],
  },
  {
    key: 'students-profile-360',
    pageNumber: 9,
    module: 'Students',
    categoryKey: 'Students',
    rbacModule: 'Students',
    rbacSubModule: 'individual-student-report',
    title: 'Students — Student 360° Profile',
    purpose: 'One printable profile bringing together admission, contact, attendance, fee and examination information.',
    filterSchema: [
      { key: 'studentId', label: 'Student', type: 'student' },
      { key: 'sessionId', label: 'Academic Session', type: 'session' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'classId', label: 'Class', type: 'class' },
      { key: 'sectionId', label: 'Section', type: 'section' },
    ],
    signatures: ['Class Advisor', 'Guardian', 'Principal'],
  },
  {
    key: 'students-status-movement',
    pageNumber: 10,
    module: 'Students',
    categoryKey: 'Students',
    rbacModule: 'Students',
    rbacSubModule: 'reports',
    title: 'Students — Status Movement & Withdrawals',
    purpose: 'Track students who joined, transferred, graduated, suspended or withdrew.',
    filterSchema: [
      { key: 'dateFrom', label: 'Date From', type: 'date' },
      { key: 'dateTo', label: 'Date To', type: 'date' },
      { key: 'programId', label: 'Program', type: 'program' },
      {
        key: 'movementType',
        label: 'Movement Type',
        type: 'select',
        options: [
          { value: 'JOINED', label: 'Joined / Admitted' },
          { value: 'PROMOTED', label: 'Promoted / Demoted' },
          { value: 'REJOIN', label: 'Re-joined' },
          { value: 'GRADUATED', label: 'Graduated' },
          { value: 'TRANSFERRED', label: 'Transferred' },
          { value: 'STRUCK_OFF', label: 'Struck Off / Withdrawn' },
          { value: 'EXPELLED', label: 'Expelled / Suspended' },
          { value: 'CANCELLED', label: 'Cancelled' },
          { value: 'PENDING', label: 'Pending' },
        ],
      },
      { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Filter by reason...' },
    ],
  },
];

const HANDLERS = {
  'students-master-register': runMasterRegister,
  'students-class-strength': runClassStrength,
  'students-profile-360': runStudentProfile360,
  'students-status-movement': runStatusMovement,
};

const ACTIONS = {};

module.exports = { CATALOG, HANDLERS, ACTIONS };
