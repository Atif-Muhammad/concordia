const mongoose = require('mongoose');
const {
  FrontOfficeInquiry,
  FrontOfficeVisitor,
  FrontOfficeComplaint,
  HostelRoom,
  HostelRegistration,
  HostelAllocation,
  InventoryItem,
  InventoryExpense,
  StockMovement,
  PurchaseOrder,
  Student,
  Program,
  Class,
  Staff,
  Attendance,
  FeeChallan,
  FeePaymentReceipt,
  Exam,
  ExamResult,
  ReportExportLog,
  ActivityLog,
  User,
} = require('../../models');
const { ACTIVE_STUDENT_FILTER, withActiveStudentFilter } = require('../../utils/studentStatus');
const {
  parseMulti,
  applyMultiIdFilter,
  applyMultiStringFilter,
  matchesMultiValue,
  parseBooleanFlag,
  toObjectIds,
  resolveDateRange,
  resolveSession,
  formatRs,
  formatNum,
  formatPct,
  pctValue,
  formatDate,
  daysBetween,
  fullName,
  maskValue,
  loadUserPermissions,
  canViewPrivateData,
} = require('./reportHelpers');

// ---------------------------------------------------------------------------
// Shared Helpers (ponytail: local context, date & permission checks)
// ---------------------------------------------------------------------------

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toLocalDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeDateRange(dateFrom, dateTo, defaultDaysBack = 90) {
  const base = resolveDateRange(dateFrom, dateTo, defaultDaysBack);
  const startStr = dateFrom && /^\d{4}-\d{2}-\d{2}/.test(String(dateFrom))
    ? String(dateFrom).slice(0, 10)
    : toLocalDateStr(base.start);
  const endStr = dateTo && /^\d{4}-\d{2}-\d{2}/.test(String(dateTo))
    ? String(dateTo).slice(0, 10)
    : toLocalDateStr(base.end);
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = sy && sm && sd ? new Date(sy, sm - 1, sd, 0, 0, 0, 0) : base.start;
  const end = ey && em && ed ? new Date(ey, em - 1, ed, 23, 59, 59, 999) : base.end;
  return { start, end, startStr, endStr };
}

function monthBounds(monthParam) {
  const target = monthParam && /^\d{4}-\d{2}$/.test(String(monthParam).trim())
    ? String(monthParam).trim()
    : toLocalDateStr(new Date()).slice(0, 7);
  const [year, m] = target.split('-').map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();
  const startStr = `${target}-01`;
  const endStr = `${target}-${String(daysInMonth).padStart(2, '0')}`;
  const start = new Date(year, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, m - 1, daysInMonth, 23, 59, 59, 999);
  const prevDate = new Date(year, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevDays = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate();
  const prevStartStr = `${prevMonth}-01`;
  const prevEndStr = `${prevMonth}-${String(prevDays).padStart(2, '0')}`;
  const prevStart = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1, 0, 0, 0, 0);
  const prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDays, 23, 59, 59, 999);
  return {
    month: target,
    startStr,
    endStr,
    start,
    end,
    prevMonth,
    prevStartStr,
    prevEndStr,
    prevStart,
    prevEnd,
  };
}

async function resolveContext(ctxOrUser) {
  if (ctxOrUser && ctxOrUser.permCtx) return ctxOrUser;
  const reqUser = ctxOrUser?.reqUser || (ctxOrUser && (ctxOrUser.id || ctxOrUser._id || ctxOrUser.role) ? ctxOrUser : null);
  let permCtx = await loadUserPermissions(reqUser);
  // ponytail: allow inline mock permissions in direct unit tests without a DB User
  if (!permCtx.userDoc && reqUser?.permissions && !permCtx.isSuper) {
    const raw = reqUser.permissions;
    const normalized = (raw.actions || raw.crud || raw.modules || raw.subModules)
      ? raw
      : { actions: raw, crud: raw };
    permCtx = {
      isSuper: Boolean(raw.all),
      permissions: normalized,
    };
  }
  const sessionCtx = ctxOrUser?.sessionCtx || await resolveSession();
  return { reqUser, permCtx, sessionCtx, def: ctxOrUser?.def || null };
}

function canMutate(permCtx, checks = []) {
  if (!permCtx) return false;
  if (permCtx.isSuper || permCtx.permissions?.all === true) return true;
  const actions = permCtx.permissions?.actions || permCtx.permissions?.crud || permCtx.permissions;
  if (!actions || typeof actions !== 'object') return false;
  return checks.some(([modLabel, subId]) => {
    const mKey = Object.keys(actions).find(k => k.toLowerCase() === modLabel.toLowerCase());
    const modObj = mKey ? actions[mKey] : null;
    if (!modObj || typeof modObj !== 'object') return false;
    const sKey = Object.keys(modObj).find(k => k.toLowerCase() === subId.toLowerCase());
    const subObj = sKey ? modObj[sKey] : modObj._root;
    if (!subObj || typeof subObj !== 'object') return false;
    return subObj.create === true || subObj.update === true || subObj.approvals === true;
  });
}

function assertWriteAccess(ctx, checks, message = 'Forbidden: insufficient permissions for this action') {
  if (!ctx?.reqUser && !ctx?.permCtx) return;
  if (!canMutate(ctx.permCtx, checks)) {
    const err = new Error(message);
    err.statusCode = 403;
    throw err;
  }
}

function buildSelectedFilters(entries) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'ALL' && value !== 'all')
    .map(([key, value, label]) => ({ key, label: label || key, value: String(value) }));
}

function extractId(val) {
  if (!val) return '';
  if (typeof val === 'object') return String(val._id || val.id || '');
  return String(val);
}

function applyStudentSessionProgramFilter(baseFilter, sessionId, programId, classId = null) {
  const filter = withActiveStudentFilter(baseFilter);
  if (sessionId && sessionId !== 'all' && sessionId !== '*' && mongoose.Types.ObjectId.isValid(sessionId)) {
    const sObjId = new mongoose.Types.ObjectId(sessionId);
    const sessionCond = {
      $or: [
        { sessionId: sObjId },
        { 'academicRecords.sessionId': sObjId },
        { 'installments.sessionId': sObjId },
      ],
    };
    filter.$and = Array.isArray(filter.$and) ? [...filter.$and, sessionCond] : [sessionCond];
  }
  applyMultiIdFilter(filter, 'programId', programId);
  if (classId) applyMultiIdFilter(filter, 'classId', classId);
  return filter;
}

// ---------------------------------------------------------------------------
// Page 38 — Front Office Visitor & Inquiry Register
// ---------------------------------------------------------------------------

async function buildFrontOfficeVisitorInquiry(query = {}) {
  const { start, end, startStr, endStr } = safeDateRange(query.dateFrom, query.dateTo, 90);

  const [visitors, inquiries] = await Promise.all([
    FrontOfficeVisitor.find({
      $or: [
        { visitDate: { $gte: startStr, $lte: endStr } },
        { date: { $gte: startStr, $lte: endStr } },
        { createdAt: { $gte: start, $lte: end } },
      ],
    })
      .populate('interestedProgramId', 'name')
      .populate('assignedOfficerId', 'name')
      .sort({ createdAt: -1 })
      .lean(),
    FrontOfficeInquiry.find({
      createdAt: { $gte: start, $lte: end },
    })
      .populate('programInterest', 'name')
      .populate('assignedOfficerId', 'name')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const inqIds = inquiries.map(i => i._id);
  const enrolledStudents = inqIds.length
    ? await Student.find({ inquiryId: { $in: inqIds } }).select('inquiryId _id').lean()
    : [];
  const enrolledByInq = new Set(enrolledStudents.map(s => String(s.inquiryId)));

  const now = new Date();
  const unified = [];

  visitors.forEach(v => {
    const dateVal = v.visitDate || v.date || toLocalDateStr(v.createdAt);
    const officer = v.assignedOfficerName || v.assignedOfficerId?.name || 'Reception';
    const hasFollowUpDue = Boolean(v.followUpDate && new Date(v.followUpDate) <= now && !/completed|closed|converted/i.test(v.outcome || ''));
    const outcome = v.outcome || (v.outTime ? 'Visited / Checked Out' : 'Walk-in Visit');

    unified.push({
      _rowId: `vis_${v._id}`,
      _type: 'VISITOR',
      _rawDate: String(dateVal).slice(0, 10),
      _inquiryType: 'VISITOR',
      _status: hasFollowUpDue ? 'FOLLOW_UP_DUE' : 'VISITED',
      _followUpDue: hasFollowUpDue,
      _converted: false,
      date: formatDate(dateVal),
      visitorCaller: v.visitorName || 'Visitor',
      purpose: v.purpose || 'Walk-in Visit',
      interestedProgram: v.interestedProgramId?.name || '—',
      officer,
      outcome,
    });
  });

  inquiries.forEach(inq => {
    const dateVal = toLocalDateStr(inq.createdAt);
    const officer = inq.assignedOfficerName || inq.assignedOfficerId?.name || 'Admissions Desk';
    const inqSt = String(inq.status || 'NEW').toUpperCase();
    const isConverted =
      enrolledByInq.has(String(inq._id)) ||
      inqSt === 'APPROVED' ||
      inqSt === 'CONVERTED' ||
      ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(String(inq.applicationStatus || '').toUpperCase()) ||
      Boolean(inq.applicationId);
    const isOpenInq = !['APPROVED', 'CONVERTED', 'REJECTED', 'CLOSED', 'DROPPED'].includes(inqSt);
    const hasPendingFollowUp =
      (Array.isArray(inq.followUps) && inq.followUps.some(f => f.status === 'PENDING')) ||
      Boolean(inq.followUpDate && new Date(inq.followUpDate) <= now && isOpenInq);

    const outcome = enrolledByInq.has(String(inq._id))
      ? 'Enrolled'
      : (isConverted ? `Application (${inq.applicationStatus || inq.status})` : (inq.status || 'NEW'));

    unified.push({
      _rowId: `inq_${inq._id}`,
      _type: 'INQUIRY',
      _rawDate: dateVal,
      _inquiryType: inq.inquiryType || 'Walk-in',
      _status: String(inq.status || 'NEW').toUpperCase(),
      _followUpDue: !isConverted && hasPendingFollowUp,
      _converted: isConverted,
      date: formatDate(inq.createdAt),
      visitorCaller: inq.studentName || 'Applicant',
      purpose: inq.inquiryType ? `Inquiry (${inq.inquiryType})` : 'Admission Inquiry',
      interestedProgram: inq.programInterest?.name || '—',
      officer,
      outcome,
    });
  });

  let rows = unified;
  const inqTypes = parseMulti(query.inquiryType).filter(v => !/^all$/i.test(v)).map(v => v.toLowerCase());
  if (inqTypes.length > 0) {
    rows = rows.filter(r => inqTypes.some(t => r._inquiryType.toLowerCase() === t || r.purpose.toLowerCase().includes(t)));
  }
  if (query.officerName && String(query.officerName).trim()) {
    const target = String(query.officerName).trim().toLowerCase();
    rows = rows.filter(r => r.officer.toLowerCase().includes(target));
  }
  const stValues = parseMulti(query.status).filter(v => !/^all$/i.test(v)).map(v => v.trim().toUpperCase());
  if (stValues.length > 0) {
    rows = rows.filter(r =>
      stValues.some(st => (st === 'FOLLOW_UP_DUE' ? r._followUpDue : st === 'CONVERTED' ? r._converted : r._status === st))
    );
  }

  rows.sort((a, b) => (b._rawDate || '').localeCompare(a._rawDate || ''));

  const visitorCount = rows.filter(r => r._type === 'VISITOR').length;
  const inquiryCount = rows.filter(r => r._type === 'INQUIRY').length;
  const followUpDueCount = rows.filter(r => r._followUpDue).length;
  const convertedCount = rows.filter(r => r._converted).length;

  return {
    selectedFilters: buildSelectedFilters([
      ['dateFrom', startStr, 'From'],
      ['dateTo', endStr, 'To'],
      ['inquiryType', query.inquiryType, 'Inquiry type'],
      ['officerName', query.officerName, 'Officer'],
      ['status', query.status, 'Status'],
    ]),
    kpis: [
      { label: 'Visitors', value: formatNum(visitorCount), tone: 'info' },
      { label: 'Admission inquiries', value: formatNum(inquiryCount), tone: 'default' },
      { label: 'Follow-ups due', value: formatNum(followUpDueCount), tone: followUpDueCount > 0 ? 'warning' : 'default' },
      { label: 'Converted to applications', value: formatNum(convertedCount), tone: 'success' },
    ],
    columns: [
      { key: 'date', label: 'Date', align: 'left' },
      { key: 'visitorCaller', label: 'Visitor / caller', align: 'left' },
      { key: 'purpose', label: 'Purpose', align: 'left' },
      { key: 'interestedProgram', label: 'Interested program', align: 'left' },
      { key: 'officer', label: 'Officer', align: 'left' },
      { key: 'outcome', label: 'Outcome', align: 'left' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          date: 'Total',
          visitorCaller: `${rows.length} reception interaction(s)`,
          purpose: `${visitorCount} visitor(s) / ${inquiryCount} inquiry(s)`,
          interestedProgram: '—',
          officer: '—',
          outcome: `${convertedCount} converted`,
        }
      : null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: followUpDueCount > 0 ? 'warning' : 'info',
      message: `${startStr} to ${endStr}: ${visitorCount} visitor(s) and ${inquiryCount} admission inquiry(s); ${followUpDueCount} follow-up(s) due and ${convertedCount} converted to applications.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 39 — Complaints & Grievance Resolution Tracker
// ---------------------------------------------------------------------------

async function buildComplaintsResolutionTracker(query = {}, ctxOrUser = null) {
  const { permCtx } = await resolveContext(ctxOrUser);
  const { start, end, startStr, endStr } = safeDateRange(query.dateFrom, query.dateTo, 180);

  const hasComplaintDetailAccess =
    permCtx.isSuper ||
    permCtx.permissions?.all === true ||
    canViewPrivateData(permCtx, 'Complaints', '_root') ||
    canViewPrivateData(permCtx, 'Front Office', 'complaint');

  const filter = { createdAt: { $gte: start, $lte: end } };
  applyMultiStringFilter(filter, 'category', query.category, { caseInsensitive: true });
  applyMultiStringFilter(filter, 'priority', query.priority, { caseInsensitive: true });
  const compStatuses = parseMulti(query.status).filter(v => !/^all$/i.test(v));
  if (compStatuses.length > 0) {
    const regexes = compStatuses.map(s => new RegExp(`^${escapeRegex(s).replace(/_/g, '[ _]')}$`, 'i'));
    filter.status = regexes.length === 1 ? regexes[0] : { $in: regexes };
  }

  const complaints = await FrontOfficeComplaint.find(filter)
    .populate('assignedToIds', 'name staffId')
    .sort({ createdAt: -1 })
    .lean();

  const now = new Date();
  let openCount = 0;
  let resolvedCount = 0;
  let overdueCount = 0;

  const rows = complaints.map(c => {
    const stRaw = String(c.status || 'Pending');
    const isResolved = ['resolved', 'dismissed', 'rejected'].includes(stRaw.toLowerCase());
    if (isResolved) resolvedCount += 1;
    else openCount += 1;

    const ageDays = isResolved && c.resolvedAt
      ? daysBetween(c.createdAt, c.resolvedAt)
      : daysBetween(c.createdAt, now);
    const slaDue = c.slaDueDate ? new Date(c.slaDueDate) : null;
    const isOverdue = !isResolved && (slaDue ? slaDue < now : ageDays > 7);
    if (isOverdue) overdueCount += 1;

    const assignedNames = Array.isArray(c.assignedToIds) && c.assignedToIds.length > 0
      ? c.assignedToIds.map(a => a?.name).filter(Boolean).join(', ')
      : 'Unassigned';

    const slaParts = [];
    if (isOverdue) slaParts.push('OVERDUE');
    else if (isResolved) slaParts.push('Closed');
    else slaParts.push('On Track');
    if (c.escalated) slaParts.push('Escalated');
    if (c.complainantNotified) slaParts.push('Notified');

    return {
      _rowId: String(c._id),
      caseId: `CMP-${String(c._id).slice(-6).toUpperCase()}`,
      receivedDate: formatDate(c.createdAt),
      category: c.category || 'General',
      priority: c.priority || 'Medium',
      assignedTo: assignedNames,
      status: stRaw,
      ageDays,
      slaStatus: slaParts.join(' · '),
      slaDueDate: slaDue ? formatDate(slaDue) : '—',
      isOverdue,
      escalated: Boolean(c.escalated),
      complainantNotified: Boolean(c.complainantNotified),
      actionContext: {
        complaintId: String(c._id),
        status: stRaw,
        priority: c.priority || 'Medium',
        escalated: c.escalated ? 'true' : 'false',
      },
      // Redact sensitive grievance narratives / complainant identity if user lacks Complaints/Front Office read/update
      complainantName: hasComplaintDetailAccess ? (c.complainantName || '—') : maskValue(c.complainantName, 2),
      details: hasComplaintDetailAccess ? (c.details || '—') : 'Restricted',
      actionTaken: hasComplaintDetailAccess ? (c.actionTaken || '—') : 'Restricted',
    };
  });

  return {
    selectedFilters: buildSelectedFilters([
      ['dateFrom', startStr, 'From'],
      ['dateTo', endStr, 'To'],
      ['category', query.category, 'Category'],
      ['priority', query.priority, 'Priority'],
      ['status', query.status, 'Status'],
    ]),
    kpis: [
      { label: 'Total cases', value: formatNum(rows.length), tone: 'info' },
      { label: 'Open', value: formatNum(openCount), tone: openCount > 0 ? 'warning' : 'default' },
      { label: 'Resolved', value: formatNum(resolvedCount), tone: 'success' },
      { label: 'Overdue', value: formatNum(overdueCount), tone: overdueCount > 0 ? 'danger' : 'default' },
    ],
    columns: [
      { key: 'caseId', label: 'Case ID', align: 'left' },
      { key: 'receivedDate', label: 'Received', align: 'left' },
      { key: 'category', label: 'Category', align: 'left' },
      { key: 'priority', label: 'Priority', align: 'center' },
      { key: 'assignedTo', label: 'Assigned to', align: 'left' },
      { key: 'status', label: 'Status', align: 'center' },
      { key: 'ageDays', label: 'Age', align: 'right' },
      { key: 'slaStatus', label: 'SLA / Escalation', align: 'left' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          caseId: 'Total',
          receivedDate: `${rows.length} case(s)`,
          category: '—',
          priority: '—',
          assignedTo: '—',
          status: `${openCount} Open / ${resolvedCount} Resolved`,
          ageDays: Math.round(rows.reduce((s, r) => s + r.ageDays, 0) / rows.length),
          slaStatus: `${overdueCount} overdue`,
        }
      : null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: overdueCount > 0 ? 'warning' : 'info',
      message: hasComplaintDetailAccess
        ? `${rows.length} complaint case(s): ${openCount} open, ${resolvedCount} resolved, ${overdueCount} SLA-overdue.`
        : `${rows.length} complaint case(s) (${overdueCount} overdue). Sensitive complaint narratives and complainant identities are restricted.`,
    },
  };
}

async function updateComplaintSlaAction(payload = {}, ctx = {}) {
  assertWriteAccess(
    ctx,
    [['Complaints', '_root'], ['Front Office', 'complaint']],
    'Forbidden: Complaints or Front Office update permission required'
  );
  const id = payload.complaintId || payload.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Valid complaintId is required');
    err.statusCode = 400;
    throw err;
  }
  const complaint = await FrontOfficeComplaint.findById(id);
  if (!complaint) {
    const err = new Error('Complaint not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.slaDueDate !== undefined && payload.slaDueDate !== '') {
    complaint.slaDueDate = payload.slaDueDate ? new Date(payload.slaDueDate) : null;
  }
  if (payload.escalated !== undefined && payload.escalated !== '') {
    complaint.escalated = parseBooleanFlag(payload.escalated, false);
    complaint.escalatedAt = complaint.escalated ? new Date() : null;
  }
  if (payload.complainantNotified !== undefined && payload.complainantNotified !== '') {
    complaint.complainantNotified = parseBooleanFlag(payload.complainantNotified, false);
  }
  if (payload.priority) complaint.priority = payload.priority;
  if (payload.actionTaken !== undefined) complaint.actionTaken = String(payload.actionTaken);
  if (payload.status) {
    complaint.status = payload.status;
    if (/resolved/i.test(payload.status) && !complaint.resolvedAt) {
      complaint.resolvedAt = new Date();
    }
  }

  await complaint.save();

  ActivityLog.create({
    userId: ctx.reqUser?.id || null,
    userName: ctx.reqUser?.name || ctx.reqUser?.email || 'Administrator',
    module: 'Complaints',
    subModule: 'SLA Tracker',
    action: 'UPDATE_COMPLAINT_SLA',
    actionType: 'UPDATE',
    description: `Updated complaint CMP-${String(complaint._id).slice(-6).toUpperCase()} SLA/escalation`,
    endpoint: '/api/reports/complaints-resolution-tracker/action',
    status: 'SUCCESS',
  }).catch(() => {});

  return { success: true, message: `Updated complaint ${complaint.status || 'case'}.`, complaint };
}

// ---------------------------------------------------------------------------
// Page 40 — Hostel & Boarding Occupancy
// ---------------------------------------------------------------------------

async function buildBoardingHostelOccupancy(query = {}) {
  const [rooms, allocations, registrations, activeStudents] = await Promise.all([
    HostelRoom.find().sort({ hostelName: 1, roomNumber: 1 }).lean(),
    HostelAllocation.find({ status: 'active' }).lean(),
    HostelRegistration.find()
      .populate({
        path: 'studentId',
        select: 'fName lName rollNumber programId status passedOut',
        populate: { path: 'programId', select: 'name' },
      })
      .populate('roomId')
      .sort({ registrationDate: -1 })
      .lean(),
    Student.find(ACTIVE_STUDENT_FILTER).select('_id').lean(),
  ]);

  const activeStudentSet = new Set(activeStudents.map(s => String(s._id)));
  const activeAllocations = allocations.filter(a => !a.studentId || activeStudentSet.has(String(a.studentId)));

  const occByRoom = new Map();
  const allocByRegOrStudent = new Map();
  activeAllocations.forEach(a => {
    const rId = a.roomId ? String(a.roomId) : '';
    if (rId) occByRoom.set(rId, (occByRoom.get(rId) || 0) + 1);
    if (a.registrationId) allocByRegOrStudent.set(String(a.registrationId), a);
    if (a.studentId) allocByRegOrStudent.set(`stu_${String(a.studentId)}`, a);
  });

  // Fallback to registration room counts when HostelAllocation rows aren't created yet
  const activeRegOccByRoom = new Map();
  registrations.forEach(reg => {
    if (String(reg.status || '').toLowerCase() !== 'active') return;
    if (reg.studentId && !activeStudentSet.has(String(reg.studentId._id || reg.studentId))) return;
    const rId = reg.roomId ? String(reg.roomId._id || reg.roomId) : '';
    if (rId) activeRegOccByRoom.set(rId, (activeRegOccByRoom.get(rId) || 0) + 1);
  });

  let filteredRooms = rooms;
  if (query.hostelName && query.hostelName !== 'ALL' && query.hostelName !== 'all') {
    const target = String(query.hostelName).trim().toLowerCase();
    filteredRooms = filteredRooms.filter(r => String(r.hostelName || 'Main Hostel').toLowerCase() === target);
  }
  if (query.blockFloor && query.blockFloor !== 'ALL' && query.blockFloor !== 'all') {
    const target = String(query.blockFloor).trim().toLowerCase();
    filteredRooms = filteredRooms.filter(r => String(r.blockFloor || '').toLowerCase().includes(target));
  }

  let totalBeds = 0;
  let occupiedBeds = 0;
  const matchedRoomIds = new Set();

  const roomStatusValues = parseMulti(query.roomStatus).filter(v => !/^all$/i.test(v)).map(v => v.toLowerCase());
  const roomStats = filteredRooms.map(room => {
    const rId = String(room._id);
    const cap = Number(room.capacity || 0);
    const occ = occByRoom.has(rId)
      ? occByRoom.get(rId)
      : Math.max(Number(room.currentOccupancy || 0), activeRegOccByRoom.get(rId) || 0);
    const rStatus = occ >= cap && cap > 0 ? 'occupied' : 'vacant';
    return { room, rId, cap, occ: Math.min(cap || occ, occ), rStatus };
  }).filter(item => {
    if (roomStatusValues.length > 0) {
      return roomStatusValues.includes(item.rStatus);
    }
    return true;
  });

  roomStats.forEach(item => {
    matchedRoomIds.add(item.rId);
    totalBeds += item.cap;
    occupiedBeds += item.occ;
  });
  const vacantBeds = Math.max(0, totalBeds - occupiedBeds);

  const residentStatusValues = query.residentStatus
    ? parseMulti(query.residentStatus).map(v => v.toLowerCase())
    : ['active'];
  const includeAllResidentStatus = residentStatusValues.length === 0 || residentStatusValues.includes('all');
  const rows = registrations
    .filter(reg => {
      const regStatus = String(reg.status || 'active').toLowerCase();
      if (!includeAllResidentStatus && !residentStatusValues.includes(regStatus)) return false;
      // Only include active internal students when filtering active residents
      if (regStatus === 'active' && reg.studentId && !activeStudentSet.has(String(reg.studentId._id || reg.studentId))) {
        return false;
      }
      if (query.hostelName || query.blockFloor || roomStatusValues.length > 0) {
        const rId = reg.roomId ? String(reg.roomId._id || reg.roomId) : '';
        return matchedRoomIds.has(rId);
      }
      return true;
    })
    .map(reg => {
      const stu = reg.studentId && typeof reg.studentId === 'object' ? reg.studentId : null;
      const room = reg.roomId && typeof reg.roomId === 'object' ? reg.roomId : null;
      const alloc = allocByRegOrStudent.get(String(reg._id)) || (stu ? allocByRegOrStudent.get(`stu_${stu._id}`) : null);
      const roomLabel = room?.roomNumber || 'Unassigned';
      const bedLabel = alloc?.bedNumber ? ` / Bed ${alloc.bedNumber}` : '';

      return {
        _rowId: String(reg._id),
        residentId: stu?.rollNumber || `EXT-${String(reg._id).slice(-5).toUpperCase()}`,
        studentName: stu ? fullName(stu) : (reg.externalName || 'External Resident'),
        programName: stu?.programId?.name || reg.externalInstitute || 'External',
        roomBed: `${roomLabel}${bedLabel}`,
        checkIn: formatDate(alloc?.allocationDate || reg.registrationDate),
        status: String(reg.status || 'active').toUpperCase(),
      };
    });

  return {
    selectedFilters: buildSelectedFilters([
      ['hostelName', query.hostelName, 'Hostel'],
      ['blockFloor', query.blockFloor, 'Block / floor'],
      ['roomStatus', query.roomStatus, 'Room status'],
      ['residentStatus', residentStatusValues.join(', ') || 'active', 'Resident status'],
    ]),
    kpis: [
      { label: 'Total beds', value: formatNum(totalBeds), tone: 'info' },
      { label: 'Occupied', value: formatNum(occupiedBeds), tone: 'success' },
      { label: 'Vacant', value: formatNum(vacantBeds), tone: vacantBeds > 0 ? 'warning' : 'default' },
      { label: 'Occupancy %', value: formatPct(occupiedBeds, totalBeds), tone: 'info' },
    ],
    columns: [
      { key: 'residentId', label: 'Resident ID', align: 'left' },
      { key: 'studentName', label: 'Student', align: 'left' },
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'roomBed', label: 'Room / bed', align: 'left' },
      { key: 'checkIn', label: 'Check-in', align: 'left' },
      { key: 'status', label: 'Status', align: 'center' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          residentId: 'Total',
          studentName: `${rows.length} resident(s)`,
          programName: `${roomStats.length} room(s)`,
          roomBed: `${occupiedBeds} / ${totalBeds} beds occupied`,
          checkIn: '—',
          status: formatPct(occupiedBeds, totalBeds),
        }
      : null,
    charts: occupiedBeds + vacantBeds > 0
      ? [{
          id: 'hostel-occupancy-pie',
          title: 'Bed Occupancy Distribution',
          type: 'pie',
          nameKey: 'name',
          dataKey: 'value',
          series: [{ dataKey: 'value', label: 'Beds' }],
          data: [
            { name: 'Occupied', value: occupiedBeds },
            { name: 'Vacant', value: vacantBeds },
          ].filter(d => d.value > 0),
        }]
      : [{
          id: 'hostel-occupancy-pie',
          title: 'Bed Occupancy Distribution',
          type: 'pie',
          nameKey: 'name',
          dataKey: 'value',
          series: [{ dataKey: 'value', label: 'Beds' }],
          data: [],
        }],
    secondaryTables: [],
    insight: {
      severity: vacantBeds === 0 && totalBeds > 0 ? 'warning' : 'info',
      message: `${occupiedBeds} of ${totalBeds} bed(s) occupied (${formatPct(occupiedBeds, totalBeds)}) across ${roomStats.length} room(s); ${rows.length} resident record(s) listed.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 41 — Inventory Stock-on-Hand & Reorder Alerts
// ---------------------------------------------------------------------------

async function buildInventoryStockOnHand(query = {}) {
  const asOfDateStr = query.asOfDate && /^\d{4}-\d{2}-\d{2}/.test(String(query.asOfDate))
    ? String(query.asOfDate).slice(0, 10)
    : toLocalDateStr(new Date());

  const itemFilter = {};
  if (query.storeName && query.storeName !== 'ALL' && query.storeName !== 'all') {
    itemFilter.storeName = new RegExp(`^${escapeRegex(query.storeName)}$`, 'i');
  }
  if (query.category && query.category !== 'ALL' && query.category !== 'all') {
    itemFilter.category = new RegExp(`^${escapeRegex(query.category)}$`, 'i');
  }

  const items = await InventoryItem.find(itemFilter).sort({ itemName: 1 }).lean();
  const itemIds = items.map(i => i._id);
  const movements = itemIds.length
    ? await StockMovement.find({ itemId: { $in: itemIds } }).lean()
    : [];

  const movByItem = new Map();
  movements.forEach(m => {
    const key = String(m.itemId);
    if (!movByItem.has(key)) movByItem.set(key, []);
    movByItem.get(key).push(m);
  });

  let totalStockValue = 0;
  let lowCount = 0;
  let outCount = 0;

  let rows = items.map(item => {
    const itemMovs = movByItem.get(String(item._id)) || [];
    const allNonOpening = itemMovs.filter(m => m.type !== 'OPENING');
    const movsUpToDate = itemMovs.filter(m => String(m.date || '').slice(0, 10) <= asOfDateStr);
    const nonOpeningUpToDate = movsUpToDate.filter(m => m.type !== 'OPENING');

    let onHand;
    if (allNonOpening.length === 0) {
      // Legacy inventory items without movements show item.quantity directly
      onHand = Number(item.quantity ?? item.openingStock ?? 0);
    } else {
      const openingMov = movsUpToDate.find(m => m.type === 'OPENING');
      const base = item.openingStock !== null && item.openingStock !== undefined
        ? Number(item.openingStock)
        : (openingMov ? Number(openingMov.quantity || 0) : Number(item.quantity || 0));
      const additions = nonOpeningUpToDate
        .filter(m => m.type === 'RECEIPT' || m.type === 'ADJUSTMENT')
        .reduce((s, m) => s + Number(m.quantity || 0), 0);
      const issues = nonOpeningUpToDate
        .filter(m => m.type === 'ISSUE')
        .reduce((s, m) => s + Number(m.quantity || 0), 0);
      onHand = base + additions - issues;
    }

    const reorderLevel = Number(item.reorderLevel ?? 5);
    const status = onHand <= 0 ? 'OUT' : (onHand <= reorderLevel ? 'LOW' : 'OK');
    const unitPrice = Number(item.unitPrice || 0) ||
      (Number(item.quantity || 0) > 0 && Number(item.totalValue || 0) > 0
        ? Number(item.totalValue) / Number(item.quantity)
        : 0);
    const value = Math.max(0, onHand) * unitPrice;

    return {
      _rowId: String(item._id),
      sku: item.sku || `SKU-${String(item._id).slice(-5).toUpperCase()}`,
      itemName: item.itemName,
      category: item.category || 'General',
      onHand,
      reorderLevel,
      unit: item.unit || 'Unit',
      status,
      storeName: item.storeName || 'Main store',
      stockValue: value,
      actionContext: {
        itemId: String(item._id),
        storeName: item.storeName || 'Main store',
        type: 'RECEIPT',
        quantity: 1,
      },
    };
  });

  const stockStatusValues = parseMulti(query.stockStatus)
    .filter(v => !/^all$/i.test(v))
    .map(v => v.trim().toUpperCase());
  if (stockStatusValues.length > 0) {
    rows = rows.filter(r => stockStatusValues.includes(r.status));
  }

  rows.forEach(r => {
    totalStockValue += r.stockValue;
    if (r.status === 'OUT') outCount += 1;
    else if (r.status === 'LOW') lowCount += 1;
  });

  const totalsRow = rows.length
    ? {
        sku: 'Total',
        itemName: `${rows.length} SKU(s)`,
        category: formatRs(totalStockValue),
        onHand: rows.reduce((s, r) => s + r.onHand, 0),
        reorderLevel: '—',
        unit: 'All',
        status: `${lowCount} Low / ${outCount} Out`,
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters([
      ['asOfDate', asOfDateStr, 'As of'],
      ['storeName', query.storeName, 'Store'],
      ['category', query.category, 'Category'],
      ['stockStatus', query.stockStatus, 'Stock status'],
    ]),
    kpis: [
      { label: 'Active SKUs', value: formatNum(rows.length), tone: 'info' },
      { label: 'Stock value', value: formatRs(totalStockValue), tone: 'success' },
      { label: 'Below reorder level', value: formatNum(lowCount), tone: lowCount > 0 ? 'warning' : 'default' },
      { label: 'Out of stock', value: formatNum(outCount), tone: outCount > 0 ? 'danger' : 'default' },
    ],
    columns: [
      { key: 'sku', label: 'SKU', align: 'left' },
      { key: 'itemName', label: 'Item', align: 'left' },
      { key: 'category', label: 'Category', align: 'left' },
      { key: 'onHand', label: 'On hand', align: 'right' },
      { key: 'reorderLevel', label: 'Reorder level', align: 'right' },
      { key: 'unit', label: 'Unit', align: 'center' },
      { key: 'status', label: 'Status', align: 'center' },
    ],
    rows,
    totalsRow,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: outCount > 0 || lowCount > 0 ? 'warning' : 'info',
      message: `As of ${asOfDateStr}: ${rows.length} SKU(s) valued at ${formatRs(totalStockValue)}; ${lowCount} below reorder level and ${outCount} out of stock.`,
    },
  };
}

async function recordStockMovementAction(payload = {}, ctx = {}) {
  assertWriteAccess(
    ctx,
    [['Inventory', 'inventory'], ['Inventory', '_root']],
    'Forbidden: Inventory create/update permission required'
  );
  const { itemId, type, quantity, referenceType, referenceNo, storeName, remarks, date } = payload;
  const moveType = String(type || '').toUpperCase();
  const qty = Number(quantity);

  if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
    const err = new Error('Valid itemId is required');
    err.statusCode = 400;
    throw err;
  }
  if (!['OPENING', 'RECEIPT', 'ISSUE', 'ADJUSTMENT'].includes(moveType)) {
    const err = new Error('Invalid movement type');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(qty) || qty === 0) {
    const err = new Error('Non-zero numeric quantity is required');
    err.statusCode = 400;
    throw err;
  }

  const item = await InventoryItem.findById(itemId);
  if (!item) {
    const err = new Error('Inventory item not found');
    err.statusCode = 404;
    throw err;
  }

  if (moveType !== 'OPENING' && (item.openingStock === null || item.openingStock === undefined)) {
    item.openingStock = Number(item.quantity || 0);
  }

  const movement = await StockMovement.create({
    itemId: item._id,
    type: moveType,
    quantity: qty,
    referenceType: String(referenceType || ''),
    referenceNo: String(referenceNo || ''),
    storeName: storeName || item.storeName || 'Main store',
    remarks: String(remarks || ''),
    performedBy: ctx.reqUser?.id || null,
    performedByName: ctx.reqUser?.name || ctx.reqUser?.email || 'Administrator',
    date: date ? String(date).slice(0, 10) : toLocalDateStr(new Date()),
  });

  if (moveType === 'OPENING') {
    item.openingStock = qty;
    item.quantity = qty;
  } else if (moveType === 'ISSUE') {
    item.quantity = Number(item.quantity || 0) - qty;
  } else {
    item.quantity = Number(item.quantity || 0) + qty;
  }
  item.totalValue = Math.max(0, Number(item.quantity || 0)) * Number(item.unitPrice || 0);
  await item.save();

  ActivityLog.create({
    userId: ctx.reqUser?.id || null,
    userName: ctx.reqUser?.name || 'Administrator',
    module: 'Inventory',
    subModule: 'Stock Movements',
    action: `STOCK_${moveType}`,
    actionType: 'CREATE',
    description: `${moveType} ${qty} of "${item.itemName}"`,
    endpoint: '/api/reports/inventory-stock-on-hand/action',
    status: 'SUCCESS',
  }).catch(() => {});

  return { success: true, message: `Updated stock for "${item.itemName}" (${moveType} ${qty}).`, movement, item };
}

// ---------------------------------------------------------------------------
// Page 42 — Purchase Orders & GRN Tracker
// ---------------------------------------------------------------------------

async function buildInventoryPurchaseGrn(query = {}) {
  const { startStr, endStr } = safeDateRange(query.dateFrom, query.dateTo, 180);

  const poFilter = {};
  if (query.dateFrom || query.dateTo) {
    poFilter.poDate = { $gte: startStr, $lte: endStr };
  }
  if (query.supplierName && String(query.supplierName).trim()) {
    poFilter.supplierName = new RegExp(escapeRegex(String(query.supplierName).trim()), 'i');
  }
  applyMultiStringFilter(poFilter, 'approvalStatus', query.approvalStatus, { uppercase: true });
  applyMultiStringFilter(poFilter, 'grnStatus', query.grnStatus, { uppercase: true });

  const pos = await PurchaseOrder.find(poFilter).sort({ poDate: -1, createdAt: -1 }).lean();

  let rows = [];
  let usingLegacyFallback = false;

  if (pos.length > 0) {
    rows = pos.map(po => {
      const val = Number(po.totalValue || 0) ||
        (Array.isArray(po.items) ? po.items.reduce((s, it) => s + Number(it.totalPrice || (it.quantity * it.unitPrice) || 0), 0) : 0);
      const grn = String(po.grnStatus || 'PENDING').toUpperCase();
      return {
        _rowId: String(po._id),
        poNumber: po.poNumber,
        poDate: formatDate(po.poDate),
        supplierName: po.supplierName || '—',
        itemCategory: po.itemCategory || po.items?.[0]?.category || 'General',
        totalValue: formatRs(val),
        received: grn === 'RECEIVED' && po.grnDate ? `RECEIVED (${po.grnDate})` : grn,
        status: `${po.approvalStatus || 'PENDING'} / ${po.status || 'OPEN'}`,
        rawValue: val,
        _grnStatus: grn,
        _approvalStatus: String(po.approvalStatus || 'PENDING').toUpperCase(),
        actionContext: {
          poId: String(po._id),
          approvalStatus: String(po.approvalStatus || 'PENDING').toUpperCase(),
          grnStatus: grn,
        },
      };
    });
  } else {
    const anyPoCount = await PurchaseOrder.countDocuments();
    if (anyPoCount === 0) {
      // Surface legacy InventoryExpense records cleanly when no POs exist yet
      usingLegacyFallback = true;
      const expFilter = {};
      if (query.dateFrom || query.dateTo) expFilter.date = { $gte: startStr, $lte: endStr };
      if (query.supplierName && String(query.supplierName).trim()) {
        expFilter.vendor = new RegExp(escapeRegex(String(query.supplierName).trim()), 'i');
      }
      const legacyExpenses = await InventoryExpense.find(expFilter)
        .populate('inventoryItemId', 'itemName category supplier')
        .sort({ date: -1 })
        .lean();

      rows = legacyExpenses.map(exp => ({
        _rowId: String(exp._id),
        poNumber: `EXP-${String(exp._id).slice(-6).toUpperCase()}`,
        poDate: formatDate(exp.date),
        supplierName: exp.vendor || exp.inventoryItemId?.supplier || 'Vendor',
        itemCategory: exp.inventoryItemId?.category || exp.expenseType || 'Inventory',
        totalValue: formatRs(exp.amount || 0),
        received: 'RECEIVED',
        status: 'LEGACY_EXPENSE',
        rawValue: Number(exp.amount || 0),
        _grnStatus: 'RECEIVED',
        _approvalStatus: 'APPROVED',
        disabledActions: ['update-po-grn'],
      }));
    }
  }

  const totalPoValue = rows.reduce((s, r) => s + r.rawValue, 0);
  const receivedCount = rows.filter(r => r._grnStatus === 'RECEIVED').length;
  const pendingReceiptCount = rows.filter(r => r._grnStatus !== 'RECEIVED' && r._approvalStatus !== 'REJECTED').length;

  return {
    selectedFilters: buildSelectedFilters([
      ['dateFrom', query.dateFrom, 'From'],
      ['dateTo', query.dateTo, 'To'],
      ['supplierName', query.supplierName, 'Supplier'],
      ['approvalStatus', query.approvalStatus, 'Approval status'],
      ['grnStatus', query.grnStatus, 'GRN status'],
    ]),
    kpis: [
      { label: 'Purchase orders', value: formatNum(rows.length), tone: 'info' },
      { label: 'PO value', value: formatRs(totalPoValue), tone: 'success' },
      { label: 'Received', value: formatNum(receivedCount), tone: 'success' },
      { label: 'Pending receipt', value: formatNum(pendingReceiptCount), tone: pendingReceiptCount > 0 ? 'warning' : 'default' },
    ],
    columns: [
      { key: 'poNumber', label: 'PO no.', align: 'left' },
      { key: 'poDate', label: 'Date', align: 'left' },
      { key: 'supplierName', label: 'Supplier', align: 'left' },
      { key: 'itemCategory', label: 'Item category', align: 'left' },
      { key: 'totalValue', label: 'PO value', align: 'right' },
      { key: 'received', label: 'Received', align: 'center' },
      { key: 'status', label: 'Status', align: 'center' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          poNumber: 'Total',
          poDate: `${rows.length} order(s)`,
          supplierName: '—',
          itemCategory: '—',
          totalValue: formatRs(totalPoValue),
          received: `${receivedCount} Received`,
          status: `${pendingReceiptCount} Pending`,
        }
      : null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: usingLegacyFallback ? 'info' : (pendingReceiptCount > 0 ? 'warning' : 'info'),
      message: usingLegacyFallback
        ? `No Purchase Orders recorded yet; surfacing ${rows.length} legacy InventoryExpense purchase record(s) totaling ${formatRs(totalPoValue)}.`
        : `${rows.length} purchase order(s) totaling ${formatRs(totalPoValue)}; ${receivedCount} received and ${pendingReceiptCount} awaiting GRN.`,
    },
  };
}

async function createPurchaseOrderAction(payload = {}, ctx = {}) {
  assertWriteAccess(
    ctx,
    [['Inventory', 'expenses'], ['Inventory', 'inventory'], ['Inventory', '_root']],
    'Forbidden: Inventory procurement permission required'
  );
  const supplierName = String(payload.supplierName || '').trim();
  if (!supplierName) {
    const err = new Error('supplierName is required');
    err.statusCode = 400;
    throw err;
  }
  const rawItems = Array.isArray(payload.items) && payload.items.length > 0
    ? payload.items
    : (payload.itemName || payload.itemCategory
        ? [{
            itemName: payload.itemName || payload.itemCategory || 'Purchase Item',
            category: payload.itemCategory || '',
            quantity: Number(payload.quantity || 1),
            unitPrice: Number(payload.unitPrice || 0),
          }]
        : []);
  if (rawItems.length === 0) {
    const err = new Error('Please enter an item name or category');
    err.statusCode = 400;
    throw err;
  }
  const items = rawItems.map(it => {
    const q = Number(it.quantity || 1);
    const up = Number(it.unitPrice || 0);
    return {
      itemName: String(it.itemName || 'Item').trim(),
      category: String(it.category || payload.itemCategory || ''),
      quantity: q,
      unitPrice: up,
      totalPrice: Number(it.totalPrice ?? q * up),
    };
  });
  const computedTotal = items.reduce((s, it) => s + it.totalPrice, 0);
  const poNumber = String(payload.poNumber || `PO-${Date.now().toString().slice(-6)}`).trim();

  const po = await PurchaseOrder.create({
    poNumber,
    poDate: payload.poDate ? String(payload.poDate).slice(0, 10) : toLocalDateStr(new Date()),
    supplierName,
    itemCategory: String(payload.itemCategory || items[0]?.category || ''),
    items,
    totalValue: Number(payload.totalValue ?? computedTotal),
    approvalStatus: payload.approvalStatus || 'PENDING',
    grnStatus: 'PENDING',
    status: 'OPEN',
    invoiceNo: String(payload.invoiceNo || ''),
    createdBy: ctx.reqUser?.id || null,
    createdByName: ctx.reqUser?.name || ctx.reqUser?.email || 'Administrator',
  });

  ActivityLog.create({
    userId: ctx.reqUser?.id || null,
    userName: ctx.reqUser?.name || 'Administrator',
    module: 'Inventory',
    subModule: 'Purchase Orders',
    action: 'CREATE_PURCHASE_ORDER',
    actionType: 'CREATE',
    description: `Created PO ${po.poNumber} for ${po.supplierName}`,
    endpoint: '/api/reports/inventory-purchase-grn/action',
    status: 'SUCCESS',
  }).catch(() => {});

  return { success: true, message: `Created purchase order ${po.poNumber}.`, purchaseOrder: po };
}

async function updatePoGrnAction(payload = {}, ctx = {}) {
  assertWriteAccess(
    ctx,
    [['Inventory', 'expenses'], ['Inventory', 'inventory'], ['Inventory', '_root']],
    'Forbidden: Inventory GRN update permission required'
  );
  const id = payload.poId || payload.purchaseOrderId || payload.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Valid poId is required');
    err.statusCode = 400;
    throw err;
  }
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    const err = new Error('Purchase order not found');
    err.statusCode = 404;
    throw err;
  }

  const wasReceived = String(po.grnStatus || '').toUpperCase() === 'RECEIVED';
  if (payload.approvalStatus) po.approvalStatus = String(payload.approvalStatus).toUpperCase();
  if (payload.grnStatus) po.grnStatus = String(payload.grnStatus).toUpperCase();
  if (payload.grnDate !== undefined) po.grnDate = String(payload.grnDate || '').slice(0, 10);
  if (payload.grnRemarks !== undefined) po.grnRemarks = String(payload.grnRemarks);
  if (payload.status) po.status = String(payload.status).toUpperCase();

  const movementsCreated = [];
  const isNowReceived = po.grnStatus === 'RECEIVED';
  if (isNowReceived && !wasReceived) {
    const grnDate = po.grnDate || toLocalDateStr(new Date());
    po.grnDate = grnDate;
    if (po.status === 'OPEN') po.status = 'CLOSED';

    const poItems = Array.isArray(po.items) && po.items.length > 0
      ? po.items
      : (payload.itemId ? [{ itemName: '', quantity: Number(payload.quantity || 1), unitPrice: 0, category: po.itemCategory }] : []);

    for (const line of poItems) {
      const qty = Number(line.quantity ?? line.orderedQty ?? 0);
      if (qty <= 0) continue;

      let invItem = null;
      const lineItemId = line.itemId || (poItems.length === 1 ? payload.itemId : null);
      if (lineItemId && mongoose.Types.ObjectId.isValid(lineItemId)) {
        invItem = await InventoryItem.findById(lineItemId);
      }
      if (!invItem && line.itemName) {
        invItem = await InventoryItem.findOne({
          itemName: new RegExp(`^${escapeRegex(line.itemName)}$`, 'i'),
        });
      }
      if (!invItem && line.itemName) {
        invItem = await InventoryItem.create({
          itemName: line.itemName,
          category: line.category || po.itemCategory || 'General',
          quantity: 0,
          openingStock: 0,
          unitPrice: Number(line.unitPrice || 0),
          totalValue: 0,
          supplier: po.supplierName || 'Vendor',
          location: payload.storeName || 'Main store',
          storeName: payload.storeName || 'Main store',
        });
      }
      if (!invItem) continue;

      if (invItem.openingStock === null || invItem.openingStock === undefined) {
        invItem.openingStock = Number(invItem.quantity || 0);
      }
      const mov = await StockMovement.create({
        itemId: invItem._id,
        type: 'RECEIPT',
        quantity: qty,
        referenceType: 'PURCHASE_ORDER',
        referenceNo: po.poNumber,
        storeName: payload.storeName || invItem.storeName || 'Main store',
        remarks: po.grnRemarks || `GRN received for ${po.poNumber}`,
        performedBy: ctx.reqUser?.id || null,
        performedByName: ctx.reqUser?.name || 'Administrator',
        date: grnDate,
      });
      movementsCreated.push(mov);

      invItem.quantity = Number(invItem.quantity || 0) + qty;
      if (line.unitPrice && !invItem.unitPrice) invItem.unitPrice = Number(line.unitPrice);
      invItem.totalValue = invItem.quantity * Number(invItem.unitPrice || 0);
      await invItem.save();
    }
  }

  await po.save();

  ActivityLog.create({
    userId: ctx.reqUser?.id || null,
    userName: ctx.reqUser?.name || 'Administrator',
    module: 'Inventory',
    subModule: 'GRN',
    action: 'UPDATE_PO_GRN',
    actionType: 'UPDATE',
    description: `Updated PO ${po.poNumber} GRN status to ${po.grnStatus}`,
    endpoint: '/api/reports/inventory-purchase-grn/action',
    status: 'SUCCESS',
  }).catch(() => {});

  return { success: true, purchaseOrder: po, movementsCreated };
}

// ---------------------------------------------------------------------------
// Page 43 — Executive Monthly Institutional Overview
// ---------------------------------------------------------------------------

async function buildExecutiveMonthlyOverview(query = {}) {
  const {
    month, startStr, endStr, start, end,
    prevMonth, prevStartStr, prevEndStr, prevStart, prevEnd,
  } = monthBounds(query.month);

  const studentFilter = applyStudentSessionProgramFilter({}, query.sessionId, query.programId);
  const activeStudents = await Student.find(studentFilter).select('_id admissionDate programId').lean();
  const activeStudentIds = activeStudents.map(s => s._id);

  const curAdmissions = activeStudents.filter(s => s.admissionDate && new Date(s.admissionDate) >= start && new Date(s.admissionDate) <= end).length;
  const prevAdmissions = activeStudents.filter(s => s.admissionDate && new Date(s.admissionDate) >= prevStart && new Date(s.admissionDate) <= prevEnd).length;

  const receiptScope = activeStudentIds.length ? { studentId: { $in: activeStudentIds } } : { _id: null };
  const examFilter = {};
  if (query.sessionId && query.sessionId !== 'all' && query.sessionId !== '*' && mongoose.Types.ObjectId.isValid(query.sessionId)) {
    examFilter.sessionId = new mongoose.Types.ObjectId(query.sessionId);
  }
  applyMultiIdFilter(examFilter, 'programId', query.programId);

  const [
    curReceipts,
    prevReceipts,
    unpaidChallans,
    curAttendance,
    prevAttendance,
    matchingExams,
    openComplaints,
    prevComplaints,
  ] = await Promise.all([
    FeePaymentReceipt.find({ ...receiptScope, status: { $ne: 'VOID' }, paidDate: { $gte: start, $lte: end } }).lean(),
    FeePaymentReceipt.find({ ...receiptScope, status: { $ne: 'VOID' }, paidDate: { $gte: prevStart, $lte: prevEnd } }).lean(),
    activeStudentIds.length
      ? FeeChallan.find({
          studentId: { $in: activeStudentIds },
          status: { $nin: ['PAID', 'SETTLED', 'VOID', 'SUPERSEDED'] },
        }).select('netPayable totalAmount amount paidAmount status dueDate').lean()
      : [],
    activeStudentIds.length
      ? Attendance.find({
          studentId: { $in: activeStudentIds },
          role: { $in: ['STUDENT', 'student'] },
          date: { $regex: `^${escapeRegex(month)}` },
        }).select('status').lean()
      : [],
    activeStudentIds.length
      ? Attendance.find({
          studentId: { $in: activeStudentIds },
          role: { $in: ['STUDENT', 'student'] },
          date: { $regex: `^${escapeRegex(prevMonth)}` },
        }).select('status').lean()
      : [],
    Exam.find(examFilter).select('_id startDate passPercentage').sort({ startDate: -1 }).lean(),
    FrontOfficeComplaint.find({
      status: { $nin: ['Resolved', 'Dismissed', 'Rejected', 'resolved', 'rejected'] },
    }).select('slaDueDate createdAt priority').lean(),
    FrontOfficeComplaint.countDocuments({
      createdAt: { $gte: prevStart, $lte: prevEnd },
      status: { $nin: ['Resolved', 'Dismissed', 'Rejected', 'resolved', 'rejected'] },
    }),
  ]);

  const curFees = curReceipts.reduce((s, r) => s + Number(r.amountPaid || 0), 0);
  const prevFees = prevReceipts.reduce((s, r) => s + Number(r.amountPaid || 0), 0);

  let totalOutstanding = 0;
  let overdueReceivableCount = 0;
  const now = new Date();
  unpaidChallans.forEach(c => {
    const total = Number(c.netPayable ?? c.totalAmount ?? c.amount ?? 0);
    const bal = Math.max(0, total - Number(c.paidAmount || 0));
    totalOutstanding += bal;
    if (bal > 0 && (c.status === 'OVERDUE' || (c.dueDate && new Date(c.dueDate) < now))) {
      overdueReceivableCount += 1;
    }
  });

  const calcAttPct = (list) => {
    let pres = 0;
    let tot = 0;
    list.forEach(a => {
      const st = String(a.status || '').toUpperCase();
      if (st === 'HOLIDAY' || st === 'HD' || !st) return;
      tot += 1;
      if (st === 'PRESENT' || st === 'LATE') pres += 1;
      else if (st === 'HALF_DAY') pres += 0.5;
    });
    return { pct: pctValue(pres, tot), total: tot };
  };
  const curAtt = calcAttPct(curAttendance);
  const prevAtt = calcAttPct(prevAttendance);

  const examMap = new Map(matchingExams.map(e => [String(e._id), e]));
  const examIds = matchingExams.map(e => e._id);
  const examResults = activeStudentIds.length && examIds.length
    ? await ExamResult.find({ studentId: { $in: activeStudentIds }, examId: { $in: examIds } }).lean()
    : [];

  let curPass = 0;
  let curExamTotal = 0;
  let prevPass = 0;
  let prevExamTotal = 0;
  examResults.forEach(r => {
    const ex = examMap.get(String(r.examId));
    const passThreshold = Number(ex?.passPercentage ?? 50);
    const passed = Number(r.percentage || 0) >= passThreshold;
    const exDate = String(ex?.startDate || toLocalDateStr(r.createdAt || '')).slice(0, 7);
    curExamTotal += 1;
    if (passed) curPass += 1;
    if (exDate === prevMonth) {
      prevExamTotal += 1;
      if (passed) prevPass += 1;
    }
  });
  const examPassRate = pctValue(curPass, curExamTotal);
  const prevExamPassRate = pctValue(prevPass, prevExamTotal);

  const overdueComplaints = openComplaints.filter(c =>
    (c.slaDueDate && new Date(c.slaDueDate) < now) || daysBetween(c.createdAt, now) > 7
  ).length;

  const baseDrill = {
    ...(query.sessionId ? { sessionId: query.sessionId } : {}),
    ...(query.programId ? { programId: query.programId } : {}),
  };

  let rows = [
    {
      area: 'Admissions',
      currentValue: `${curAdmissions} new (${activeStudents.length} active)`,
      comparison: `${prevAdmissions} in ${prevMonth}`,
      attention: curAdmissions < prevAdmissions ? 'Monitor intake pace' : 'On track',
      _needsAttention: curAdmissions < prevAdmissions,
      drilldownKey: 'admission-funnel',
      drilldownFilters: { ...baseDrill, dateFrom: startStr, dateTo: endStr },
    },
    {
      area: 'Fees collected',
      currentValue: formatRs(curFees),
      comparison: `${formatRs(prevFees)} in ${prevMonth}`,
      attention: curFees < prevFees ? 'Below prior month' : 'Healthy collection',
      _needsAttention: curFees < prevFees,
      drilldownKey: 'fee-collection-summary',
      drilldownFilters: { ...baseDrill, month },
    },
    {
      area: 'Outstanding receivables',
      currentValue: formatRs(totalOutstanding),
      comparison: `${overdueReceivableCount} overdue challan(s)`,
      attention: overdueReceivableCount > 0 ? 'Action required' : 'Clear',
      _needsAttention: overdueReceivableCount > 0 || totalOutstanding > 0,
      drilldownKey: 'fee-defaulters-aging',
      drilldownFilters: { ...baseDrill },
    },
    {
      area: 'Attendance %',
      currentValue: `${curAtt.pct.toFixed(1)}%`,
      comparison: `${prevAtt.pct.toFixed(1)}% in ${prevMonth}`,
      attention: curAtt.total > 0 && curAtt.pct < 75 ? 'Below 75% threshold' : 'Normal',
      _needsAttention: curAtt.total > 0 && curAtt.pct < 75,
      drilldownKey: 'attendance-monthly-summary',
      drilldownFilters: { ...baseDrill, month },
    },
    {
      area: 'Examination pass %',
      currentValue: `${examPassRate.toFixed(1)}%`,
      comparison: prevExamTotal > 0 ? `${prevExamPassRate.toFixed(1)}% in ${prevMonth}` : `${curPass}/${curExamTotal} passed`,
      attention: curExamTotal > 0 && examPassRate < 60 ? 'Academic review needed' : 'Satisfactory',
      _needsAttention: curExamTotal > 0 && examPassRate < 60,
      drilldownKey: 'exam-institutional-analysis',
      drilldownFilters: { ...baseDrill },
    },
    {
      area: 'Open complaints',
      currentValue: formatNum(openComplaints.length),
      comparison: `${prevComplaints} opened in ${prevMonth}`,
      attention: overdueComplaints > 0 ? `${overdueComplaints} SLA overdue` : (openComplaints.length > 0 ? 'In progress' : 'Clear'),
      _needsAttention: openComplaints.length > 0 || overdueComplaints > 0,
      drilldownKey: 'complaints-resolution-tracker',
      drilldownFilters: { status: 'Pending' },
    },
  ];

  if (String(query.dataStatus || '').toUpperCase() === 'ATTENTION_ONLY') {
    rows = rows.filter(r => r._needsAttention);
  }

  return {
    selectedFilters: buildSelectedFilters([
      ['month', month, 'Month'],
      ['sessionId', query.sessionId, 'Session'],
      ['programId', query.programId, 'Program'],
      ['dataStatus', query.dataStatus, 'View mode'],
    ]),
    kpis: [
      { label: 'Active students', value: formatNum(activeStudents.length), tone: 'info' },
      { label: 'Admissions this session', value: formatNum(activeStudents.length), tone: 'default' },
      { label: 'Fee collections', value: formatRs(curFees), tone: 'success' },
      { label: 'Exam pass rate', value: `${examPassRate.toFixed(1)}%`, tone: examPassRate >= 70 ? 'success' : 'warning' },
    ],
    columns: [
      { key: 'area', label: 'Area', align: 'left' },
      { key: 'currentValue', label: 'Current month / session', align: 'right' },
      { key: 'comparison', label: 'Comparison', align: 'right' },
      { key: 'attention', label: 'Status / attention', align: 'left' },
    ],
    rows,
    totalsRow: null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: overdueReceivableCount > 0 || overdueComplaints > 0 ? 'warning' : 'info',
      message: `Executive scorecard for ${month} vs ${prevMonth}: ${activeStudents.length} active student(s), ${formatRs(curFees)} collected, ${formatRs(totalOutstanding)} receivable, ${openComplaints.length} open complaint(s).`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 44 — Student Early-Warning & Risk Watchlist (Zero Duplicates)
// ---------------------------------------------------------------------------

async function buildStudentRiskWatchlist(query = {}) {
  const attThreshold = Number(query.attendanceBelow ?? 75);
  const feeThreshold = Number(query.feeBalanceAbove ?? 10000);
  const examThreshold = Number(query.examPctBelow ?? 50);

  const studentFilter = applyStudentSessionProgramFilter({}, query.sessionId, query.programId);
  const students = await Student.find(studentFilter)
    .populate('programId', 'name')
    .select('fName lName rollNumber programId')
    .lean();

  const studentIds = students.map(s => s._id);

  // Aggregate attendance %, unpaid fee balance, and latest exam % per unique studentId in parallel Maps FIRST
  const [attRecords, unpaidChallans, examResults] = studentIds.length
    ? await Promise.all([
        Attendance.find({
          studentId: { $in: studentIds },
          role: { $in: ['STUDENT', 'student'] },
        }).select('studentId status').lean(),
        FeeChallan.find({
          studentId: { $in: studentIds },
          status: { $nin: ['PAID', 'SETTLED', 'VOID', 'SUPERSEDED'] },
        }).select('studentId netPayable totalAmount amount paidAmount').lean(),
        ExamResult.find({ studentId: { $in: studentIds } })
          .populate('examId', 'startDate examName')
          .sort({ createdAt: -1 })
          .lean(),
      ])
    : [[], [], []];

  const attMap = new Map();
  attRecords.forEach(a => {
    const sid = String(a.studentId);
    const st = String(a.status || '').toUpperCase();
    if (st === 'HOLIDAY' || st === 'HD' || !st) return;
    if (!attMap.has(sid)) attMap.set(sid, { present: 0, total: 0 });
    const entry = attMap.get(sid);
    entry.total += 1;
    if (st === 'PRESENT' || st === 'LATE') entry.present += 1;
    else if (st === 'HALF_DAY') entry.present += 0.5;
  });

  const feeMap = new Map();
  unpaidChallans.forEach(c => {
    const sid = String(c.studentId);
    const total = Number(c.netPayable ?? c.totalAmount ?? c.amount ?? 0);
    const bal = Math.max(0, total - Number(c.paidAmount || 0));
    feeMap.set(sid, (feeMap.get(sid) || 0) + bal);
  });

  const latestExamMap = new Map();
  examResults.forEach(r => {
    const sid = String(r.studentId);
    const rDate = String(r.examId?.startDate || toLocalDateStr(r.createdAt || ''));
    const pct = (r.percentage !== undefined && r.percentage !== null)
      ? Number(r.percentage)
      : (Number(r.totalMarks) > 0 ? pctValue(r.obtainedMarks || 0, r.totalMarks) : 0);
    const existing = latestExamMap.get(sid);
    if (!existing || rDate > existing._date) {
      latestExamMap.set(sid, { percentage: pct, _date: rDate });
    }
  });

  let lowAttCount = 0;
  let feeRiskCount = 0;
  let academicRiskCount = 0;
  const rows = [];

  for (const stu of students) {
    const sid = String(stu._id);
    const attStats = attMap.get(sid);
    const attPct = attStats && attStats.total > 0 ? pctValue(attStats.present, attStats.total) : null;
    const feeBal = feeMap.get(sid) || 0;
    const examEntry = latestExamMap.get(sid);
    const examPct = examEntry ? examEntry.percentage : null;

    const attRisk = attPct !== null && attPct < attThreshold;
    const feeRisk = feeBal > feeThreshold;
    const examRisk = examPct !== null && examPct < examThreshold;

    if (!attRisk && !feeRisk && !examRisk) continue;

    if (attRisk) lowAttCount += 1;
    if (feeRisk) feeRiskCount += 1;
    if (examRisk) academicRiskCount += 1;

    const flags = [];
    const actions = [];
    if (attRisk) {
      flags.push('Low Attendance');
      actions.push('Attendance warning');
    }
    if (feeRisk) {
      flags.push('Fee Balance');
      actions.push('Fee follow-up');
    }
    if (examRisk) {
      flags.push('Low Exam');
      actions.push('Academic counseling');
    }

    rows.push({
      _rowId: sid,
      studentId: sid,
      studentName: `${fullName(stu)}${stu.rollNumber ? ` (${stu.rollNumber})` : ''}`,
      programName: stu.programId?.name || 'General',
      attendancePct: attPct !== null ? `${attPct.toFixed(1)}%` : 'N/A',
      feeBalance: formatRs(feeBal),
      latestExamPct: examPct !== null ? `${examPct.toFixed(1)}%` : 'N/A',
      riskFlags: flags.join(', '),
      suggestedAction: actions.join(' + '),
      _riskCount: flags.length,
      _rawFeeBalance: feeBal,
    });
  }

  rows.sort((a, b) => (b._riskCount - a._riskCount) || (b._rawFeeBalance - a._rawFeeBalance));

  return {
    selectedFilters: buildSelectedFilters([
      ['sessionId', query.sessionId, 'Session'],
      ['programId', query.programId, 'Program'],
      ['attendanceBelow', attThreshold, 'Attendance < %'],
      ['feeBalanceAbove', feeThreshold, 'Fee balance > Rs'],
      ['examPctBelow', examThreshold, 'Exam < %'],
    ]),
    kpis: [
      { label: 'Students flagged', value: formatNum(rows.length), tone: rows.length > 0 ? 'warning' : 'success' },
      { label: 'Low attendance', value: formatNum(lowAttCount), tone: lowAttCount > 0 ? 'warning' : 'default' },
      { label: 'Fee balance risk', value: formatNum(feeRiskCount), tone: feeRiskCount > 0 ? 'danger' : 'default' },
      { label: 'Academic risk', value: formatNum(academicRiskCount), tone: academicRiskCount > 0 ? 'danger' : 'default' },
    ],
    columns: [
      { key: 'studentName', label: 'Student', align: 'left' },
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'attendancePct', label: 'Attendance', align: 'right' },
      { key: 'feeBalance', label: 'Fee balance', align: 'right' },
      { key: 'latestExamPct', label: 'Latest exam', align: 'right' },
      { key: 'riskFlags', label: 'Risk flags', align: 'left' },
      { key: 'suggestedAction', label: 'Suggested action', align: 'left' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          studentName: 'Total Flagged',
          programName: `${rows.length} unique student(s)`,
          attendancePct: `${lowAttCount} flagged`,
          feeBalance: formatRs(rows.reduce((s, r) => s + r._rawFeeBalance, 0)),
          latestExamPct: `${academicRiskCount} flagged`,
          riskFlags: '—',
          suggestedAction: '—',
        }
      : null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: rows.length > 0 ? 'warning' : 'success',
      message: `${rows.length} unique active student(s) flagged (Attendance < ${attThreshold}%, Fee balance > ${formatRs(feeThreshold)}, or Latest exam < ${examThreshold}%).`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 45 — Program & Class Cohort Health Matrix
// ---------------------------------------------------------------------------

async function buildCombinedClassHealth(query = {}) {
  const studentFilter = applyStudentSessionProgramFilter({}, query.sessionId, query.programId, query.classId);
  const students = await Student.find(studentFilter)
    .populate('programId', 'name')
    .populate('classId', 'name')
    .select('programId classId')
    .lean();

  const studentIds = students.map(s => s._id);
  const studentCohortMap = new Map();
  const cohorts = new Map();

  students.forEach(s => {
    const pId = extractId(s.programId) || 'none';
    const cId = extractId(s.classId) || 'none';
    const key = `${pId}__${cId}`;
    const pName = s.programId?.name || 'General';
    const cName = s.classId?.name || 'Unassigned';
    studentCohortMap.set(String(s._id), key);
    if (!cohorts.has(key)) {
      cohorts.set(key, {
        key,
        programName: `${pName} — ${cName}`,
        strength: 0,
        attPresent: 0,
        attTotal: 0,
        examSumPct: 0,
        examCount: 0,
        examPassed: 0,
        feeOutstanding: 0,
      });
    }
    cohorts.get(key).strength += 1;
  });

  const hasDateRange = Boolean(query.dateFrom || query.dateTo);
  const { startStr: winFrom, endStr: winTo } = hasDateRange
    ? safeDateRange(query.dateFrom, query.dateTo, 90)
    : { startStr: '', endStr: '' };
  const attQuery = studentIds.length
    ? { studentId: { $in: studentIds }, role: { $in: ['STUDENT', 'student'] } }
    : { _id: null };
  if (query.month && /^\d{4}-\d{2}$/.test(String(query.month).trim())) {
    attQuery.date = { $regex: `^${escapeRegex(String(query.month).trim())}` };
  } else if (hasDateRange) {
    attQuery.date = { $gte: winFrom, $lte: winTo };
  }

  const [attRecords, examResults, unpaidChallans] = studentIds.length
    ? await Promise.all([
        Attendance.find(attQuery).select('studentId status date').lean(),
        ExamResult.find({ studentId: { $in: studentIds } }).populate('examId', 'passPercentage startDate').lean(),
        FeeChallan.find({
          studentId: { $in: studentIds },
          status: { $nin: ['PAID', 'SETTLED', 'VOID', 'SUPERSEDED'] },
        }).select('studentId netPayable totalAmount amount paidAmount').lean(),
      ])
    : [[], [], []];

  let minAttDate = '';
  let maxAttDate = '';
  attRecords.forEach(a => {
    const d = String(a.date || '').slice(0, 10);
    if (d) {
      if (!minAttDate || d < minAttDate) minAttDate = d;
      if (!maxAttDate || d > maxAttDate) maxAttDate = d;
    }
    const st = String(a.status || '').toUpperCase();
    if (st === 'HOLIDAY' || st === 'HD' || !st) return;
    const cohort = cohorts.get(studentCohortMap.get(String(a.studentId)));
    if (!cohort) return;
    cohort.attTotal += 1;
    if (st === 'PRESENT' || st === 'LATE') cohort.attPresent += 1;
    else if (st === 'HALF_DAY') cohort.attPresent += 0.5;
  });

  let latestExamDate = '';
  examResults.forEach(r => {
    const cohort = cohorts.get(studentCohortMap.get(String(r.studentId)));
    if (!cohort) return;
    const pct = (r.percentage !== undefined && r.percentage !== null)
      ? Number(r.percentage)
      : (Number(r.totalMarks) > 0 ? pctValue(r.obtainedMarks || 0, r.totalMarks) : 0);
    const passThreshold = Number(r.examId?.passPercentage ?? 50);
    const exDate = String(r.examId?.startDate || toLocalDateStr(r.createdAt || '')).slice(0, 10);
    if (exDate && (!latestExamDate || exDate > latestExamDate)) latestExamDate = exDate;
    cohort.examCount += 1;
    cohort.examSumPct += pct;
    if (pct >= passThreshold) cohort.examPassed += 1;
  });

  unpaidChallans.forEach(c => {
    const cohort = cohorts.get(studentCohortMap.get(String(c.studentId)));
    if (!cohort) return;
    const total = Number(c.netPayable ?? c.totalAmount ?? c.amount ?? 0);
    cohort.feeOutstanding += Math.max(0, total - Number(c.paidAmount || 0));
  });

  let totStrength = 0;
  let totAttPresent = 0;
  let totAttTotal = 0;
  let totExamSum = 0;
  let totExamCount = 0;
  let totExamPassed = 0;
  let totFeeOut = 0;

  const rows = Array.from(cohorts.values())
    .sort((a, b) => a.programName.localeCompare(b.programName))
    .map(c => {
      totStrength += c.strength;
      totAttPresent += c.attPresent;
      totAttTotal += c.attTotal;
      totExamSum += c.examSumPct;
      totExamCount += c.examCount;
      totExamPassed += c.examPassed;
      totFeeOut += c.feeOutstanding;

      const attPct = c.attTotal > 0 ? pctValue(c.attPresent, c.attTotal) : null;
      const examAvg = c.examCount > 0 ? c.examSumPct / c.examCount : null;
      const passPct = c.examCount > 0 ? pctValue(c.examPassed, c.examCount) : null;

      const actions = [];
      if (attPct !== null && attPct < 75) actions.push('Attendance intervention');
      if (passPct !== null && passPct < 60) actions.push('Academic review');
      if (c.feeOutstanding > 0) actions.push('Fee collection drive');

      return {
        programName: c.programName,
        strength: c.strength,
        attendancePct: attPct !== null ? `${attPct.toFixed(1)}%` : 'N/A',
        examAvgPct: examAvg !== null ? `${examAvg.toFixed(1)}%` : 'N/A',
        passPct: passPct !== null ? `${passPct.toFixed(1)}%` : 'N/A',
        feeOutstanding: formatRs(c.feeOutstanding),
        action: actions.length ? actions.join(' · ') : 'Healthy',
      };
    });

  const overallAttPct = formatPct(totAttPresent, totAttTotal);
  const overallPassPct = formatPct(totExamPassed, totExamCount);
  const overallAvgPct = totExamCount > 0 ? `${(totExamSum / totExamCount).toFixed(1)}%` : '0.0%';

  const sourceDatesDesc = [
    minAttDate
      ? `Attendance: ${minAttDate} to ${maxAttDate}`
      : (hasDateRange ? `Attendance window: ${winFrom} to ${winTo}` : 'Attendance: no records'),
    latestExamDate ? `Latest exam: ${latestExamDate}` : 'Exams: no results',
    `Receivables as of ${toLocalDateStr(new Date())}`,
  ].join(' | ');

  return {
    selectedFilters: buildSelectedFilters([
      ['sessionId', query.sessionId, 'Session'],
      ['programId', query.programId, 'Program'],
      ['classId', query.classId, 'Class'],
      ['month', query.month, 'Month'],
    ]),
    kpis: [
      { label: 'Students', value: formatNum(totStrength), tone: 'info' },
      { label: 'Attendance %', value: overallAttPct, tone: 'success' },
      { label: 'Exam pass rate %', value: overallPassPct, tone: 'success' },
      { label: 'Outstanding fees', value: formatRs(totFeeOut), tone: totFeeOut > 0 ? 'warning' : 'default' },
    ],
    columns: [
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'strength', label: 'Strength', align: 'right' },
      { key: 'attendancePct', label: 'Attendance %', align: 'right' },
      { key: 'examAvgPct', label: 'Exam average %', align: 'right' },
      { key: 'passPct', label: 'Pass %', align: 'right' },
      { key: 'feeOutstanding', label: 'Fee outstanding', align: 'right' },
      { key: 'action', label: 'Action', align: 'left' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          programName: 'Institutional Total',
          strength: totStrength,
          attendancePct: overallAttPct,
          examAvgPct: overallAvgPct,
          passPct: overallPassPct,
          feeOutstanding: formatRs(totFeeOut),
          action: `${rows.length} cohort(s)`,
        }
      : null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: totFeeOut > 0 ? 'info' : 'success',
      message: `${rows.length} cohort(s) analyzed (${totStrength} active students). Source dates — ${sourceDatesDesc}.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 46 — Admission-to-First-Fee Conversion Tracker
// ---------------------------------------------------------------------------

async function buildAdmissionFirstFee(query = {}) {
  const { start, end, startStr, endStr } = safeDateRange(query.dateFrom, query.dateTo, 180);

  const inqFilter = {};
  if (query.dateFrom || query.dateTo) {
    inqFilter.createdAt = { $gte: start, $lte: end };
  }
  applyMultiIdFilter(inqFilter, 'programInterest', query.programId);
  if (query.source && query.source !== 'ALL' && query.source !== 'all') {
    const re = new RegExp(escapeRegex(String(query.source).trim()), 'i');
    inqFilter.$or = [{ inquiryType: re }, { referenceBody: re }];
  }

  const inquiries = await FrontOfficeInquiry.find(inqFilter)
    .populate('programInterest', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const inqIds = inquiries.map(i => i._id);
  const students = inqIds.length
    ? await Student.find({ inquiryId: { $in: inqIds } })
        .populate('programId', 'name')
        .select('fName lName rollNumber inquiryId admissionDate programId installments status')
        .lean()
    : [];

  const studentByInq = new Map(students.map(s => [String(s.inquiryId), s]));
  const studentIds = students.map(s => s._id);

  const [challans, receipts] = studentIds.length
    ? await Promise.all([
        FeeChallan.find({
          studentId: { $in: studentIds },
          status: { $nin: ['VOID', 'SUPERSEDED'] },
        }).sort({ installmentNumber: 1, dueDate: 1, createdAt: 1 }).lean(),
        FeePaymentReceipt.find({
          studentId: { $in: studentIds },
          challanType: 'FeeChallan',
          status: { $ne: 'VOID' },
        }).sort({ paidDate: 1, createdAt: 1 }).lean(),
      ])
    : [[], []];

  const firstChallanByStudent = new Map();
  challans.forEach(c => {
    const sid = String(c.studentId);
    const existing = firstChallanByStudent.get(sid);
    if (!existing || (Number(c.installmentNumber) === 1 && Number(existing.installmentNumber) !== 1)) {
      firstChallanByStudent.set(sid, c);
    }
  });

  const receiptsByChallan = new Map();
  const firstReceiptByStudent = new Map();
  receipts.forEach(r => {
    const sid = String(r.studentId);
    const cid = r.challanId ? String(r.challanId) : '';
    if (cid && !receiptsByChallan.has(cid)) receiptsByChallan.set(cid, r);
    if (!firstReceiptByStudent.has(sid)) firstReceiptByStudent.set(sid, r);
  });

  let rows = inquiries.map(inq => {
    const stu = studentByInq.get(String(inq._id));
    const sid = stu ? String(stu._id) : '';
    const firstInst = stu && Array.isArray(stu.installments)
      ? (stu.installments.find(i => Number(i.installmentNumber) === 1) || stu.installments[0] || null)
      : null;
    const firstChallan = sid ? firstChallanByStudent.get(sid) : null;
    const firstReceipt = firstChallan
      ? (receiptsByChallan.get(String(firstChallan._id)) || null)
      : (sid ? firstReceiptByStudent.get(sid) : null);

    let firstInstStatus = 'PENDING';
    let firstPaymentDate = '—';
    if (!stu) {
      firstInstStatus = 'NOT_ENROLLED';
    } else if (
      firstReceipt ||
      ['PAID', 'SETTLED'].includes(String(firstChallan?.status || '').toUpperCase()) ||
      String(firstInst?.status || '').toUpperCase() === 'PAID'
    ) {
      firstInstStatus = 'PAID';
      firstPaymentDate = formatDate(firstReceipt?.paidDate || firstChallan?.paidDate);
    }

    const conversion = !stu
      ? 'Not Enrolled'
      : (firstInstStatus === 'PAID' ? 'Enrolled & Paid' : 'Enrolled (Fee Pending)');

    const firstFeeDue = Number(firstChallan?.netPayable ?? firstChallan?.totalAmount ?? firstChallan?.amount ?? firstInst?.amount ?? 0);
    const firstPaidAmt = Number(firstReceipt?.amountPaid ?? firstChallan?.paidAmount ?? (firstInstStatus === 'PAID' ? firstFeeDue : 0));
    const firstBal = Math.max(0, firstFeeDue - firstPaidAmt);

    return {
      _rowId: String(inq._id),
      _enrolled: Boolean(stu),
      _firstPaid: firstInstStatus === 'PAID',
      studentName: stu ? fullName(stu) : (inq.studentName || 'Applicant'),
      programName: stu?.programId?.name || inq.programInterest?.name || '—',
      appStatus: stu ? `Enrolled (${stu.status})` : (inq.applicationStatus || inq.status || 'NEW'),
      admissionDate: stu ? formatDate(stu.admissionDate) : '—',
      firstInstStatus,
      firstPaymentDate,
      conversion,
      firstFeeDue: formatRs(firstFeeDue),
      paid: formatRs(firstPaidAmt),
      balance: formatRs(firstBal),
    };
  });

  if (query.firstInstStatus && query.firstInstStatus !== 'ALL' && query.firstInstStatus !== 'all') {
    const target = String(query.firstInstStatus).toUpperCase();
    if (target === 'PAID') rows = rows.filter(r => r._firstPaid);
    else if (target === 'PENDING') rows = rows.filter(r => !r._firstPaid);
  }

  const enrolledCount = rows.filter(r => r._enrolled).length;
  const firstPaidCount = rows.filter(r => r._firstPaid).length;
  const convPct = formatPct(firstPaidCount, enrolledCount);

  return {
    selectedFilters: buildSelectedFilters([
      ['dateFrom', query.dateFrom ? startStr : null, 'From'],
      ['dateTo', query.dateTo ? endStr : null, 'To'],
      ['programId', query.programId, 'Program'],
      ['source', query.source, 'Source'],
      ['firstInstStatus', query.firstInstStatus, '1st installment'],
    ]),
    kpis: [
      { label: 'Applications', value: formatNum(rows.length), tone: 'info' },
      { label: 'Enrolled', value: formatNum(enrolledCount), tone: 'success' },
      { label: 'First payment made', value: formatNum(firstPaidCount), tone: 'success' },
      { label: 'Enrolled-to-paid %', value: convPct, tone: 'info' },
    ],
    columns: [
      { key: 'studentName', label: 'Applicant / student', align: 'left' },
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'appStatus', label: 'Application status', align: 'center' },
      { key: 'admissionDate', label: 'Admission date', align: 'left' },
      { key: 'firstInstStatus', label: 'First installment', align: 'center' },
      { key: 'firstPaymentDate', label: 'First payment date', align: 'left' },
      { key: 'conversion', label: 'Conversion', align: 'left' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          studentName: 'Total',
          programName: `${rows.length} inquiry(s)`,
          appStatus: `${enrolledCount} enrolled`,
          admissionDate: '—',
          firstInstStatus: `${firstPaidCount} paid`,
          firstPaymentDate: '—',
          conversion: `${convPct} enrolled-to-paid`,
        }
      : null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: enrolledCount > firstPaidCount ? 'warning' : 'info',
      message: `${rows.length} inquiry/application(s) tracked: ${enrolledCount} enrolled and ${firstPaidCount} settled installment #1 (${convPct}).`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 47 — Management Exceptions & Action Queue (Non-Sensitive Refs)
// ---------------------------------------------------------------------------

async function buildManagementExceptions(query = {}) {
  const hasRange = Boolean(query.dateFrom || query.dateTo);
  const { start, end, startStr, endStr } = safeDateRange(query.dateFrom, query.dateTo, 180);
  const now = new Date();

  const studentFilter = applyStudentSessionProgramFilter({}, null, query.programId);
  const activeStudents = await Student.find(studentFilter)
    .select('rollNumber programId admissionFormNumber documents')
    .lean();
  const activeStudentMap = new Map(activeStudents.map(s => [String(s._id), s]));
  const activeIds = activeStudents.map(s => s._id);

  const inqQuery = { 'missingDocuments.0': { $exists: true }, status: { $ne: 'REJECTED' } };
  applyMultiIdFilter(inqQuery, 'programInterest', query.programId);
  if (hasRange) inqQuery.createdAt = { $gte: start, $lte: end };

  const compQuery = {
    status: { $nin: ['Resolved', 'Dismissed', 'Rejected', 'resolved', 'rejected'] },
  };
  if (hasRange) compQuery.createdAt = { $gte: start, $lte: end };

  const [challans, attRecords, docInquiries, openComplaints] = await Promise.all([
    activeIds.length
      ? FeeChallan.find({
          studentId: { $in: activeIds },
          status: { $nin: ['PAID', 'SETTLED', 'VOID', 'SUPERSEDED'] },
        }).select('studentId challanNo dueDate netPayable totalAmount amount paidAmount status').lean()
      : [],
    activeIds.length
      ? Attendance.find({
          studentId: { $in: activeIds },
          role: { $in: ['STUDENT', 'student'] },
          ...(hasRange ? { date: { $gte: startStr, $lte: endStr } } : {}),
        }).select('studentId status').lean()
      : [],
    FrontOfficeInquiry.find(inqQuery)
      .select('applicationId assignedOfficerName missingDocuments')
      .lean(),
    FrontOfficeComplaint.find(compQuery)
      .populate('assignedToIds', 'name')
      .select('priority slaDueDate escalated createdAt assignedToIds')
      .lean(),
  ]);

  const exceptions = [];

  // 1. Overdue fee challans
  challans.forEach(c => {
    const due = c.dueDate ? new Date(c.dueDate) : null;
    const isOverdue = c.status === 'OVERDUE' || (due && due < now);
    if (!isOverdue) return;
    const total = Number(c.netPayable ?? c.totalAmount ?? c.amount ?? 0);
    const bal = Math.max(0, total - Number(c.paidAmount || 0));
    if (bal <= 0) return;
    const overdueDays = due ? daysBetween(due, now) : 0;
    const ref = c.challanNo && String(c.challanNo).startsWith('CC-')
      ? c.challanNo
      : (c.challanNo || `CC-${String(c._id).slice(-6).toUpperCase()}`);

    exceptions.push({
      _domain: 'FEE',
      _severity: overdueDays > 30 ? 'HIGH' : 'OVERDUE',
      module: 'Fee Management',
      recordRef: ref,
      exception: 'Overdue fee challan',
      ageOrValue: `${overdueDays}d overdue · ${formatRs(bal)}`,
      owner: 'Fee Desk',
      nextAction: 'Send payment reminder',
      drilldownKey: 'fee-defaulters-aging',
      drilldownFilters: query.programId ? { programId: query.programId } : {},
    });
  });

  // 2. Students <75% attendance
  const attAgg = new Map();
  attRecords.forEach(a => {
    const st = String(a.status || '').toUpperCase();
    if (st === 'HOLIDAY' || st === 'HD' || !st) return;
    const sid = String(a.studentId);
    if (!attAgg.has(sid)) attAgg.set(sid, { present: 0, total: 0 });
    const entry = attAgg.get(sid);
    entry.total += 1;
    if (st === 'PRESENT' || st === 'LATE') entry.present += 1;
    else if (st === 'HALF_DAY') entry.present += 0.5;
  });

  attAgg.forEach((stats, sid) => {
    if (stats.total === 0) return;
    const pct = pctValue(stats.present, stats.total);
    if (pct >= 75) return;
    const stu = activeStudentMap.get(sid);
    exceptions.push({
      _domain: 'ATTENDANCE',
      _severity: pct < 60 ? 'HIGH' : 'UNRESOLVED',
      module: 'Attendance',
      recordRef: stu?.rollNumber || `STU-${sid.slice(-6).toUpperCase()}`,
      exception: 'Student attendance < 75%',
      ageOrValue: `${pct.toFixed(1)}% (${stats.present}/${stats.total})`,
      owner: 'Class Coordinator',
      nextAction: 'Parent notice & counseling',
      drilldownKey: 'combined-student-risk-watchlist',
      drilldownFilters: { attendanceBelow: 75, ...(query.programId ? { programId: query.programId } : {}) },
    });
  });

  // 3. Incomplete admission documents
  const seenDocRefs = new Set();
  docInquiries.forEach(inq => {
    const pendingDocs = (inq.missingDocuments || []).filter(d => d.status !== 'COMPLETE');
    if (pendingDocs.length === 0) return;
    const appRef = inq.applicationId || `APP-${String(inq._id).slice(-6).toUpperCase()}`;
    seenDocRefs.add(appRef);
    exceptions.push({
      _domain: 'DOCS',
      _severity: 'UNRESOLVED',
      module: 'Admissions',
      recordRef: appRef,
      exception: `Incomplete documents (${pendingDocs.length})`,
      ageOrValue: pendingDocs.map(d => d.label || d.docKey).filter(Boolean).slice(0, 2).join(', ') || 'Missing file',
      owner: pendingDocs[0]?.assignedOfficerName || inq.assignedOfficerName || 'Admissions Officer',
      nextAction: pendingDocs[0]?.nextAction || 'Collect pending documents',
      drilldownKey: 'combined-admission-first-fee',
      drilldownFilters: query.programId ? { programId: query.programId } : {},
    });
  });
  activeStudents.forEach(s => {
    if (!s.documents) return;
    const entries = s.documents instanceof Map ? Array.from(s.documents.entries()) : Object.entries(s.documents);
    const missingKeys = entries.filter(([, val]) => val === false).map(([k]) => k);
    if (missingKeys.length === 0) return;
    const ref = s.admissionFormNumber || s.rollNumber || `APP-${String(s._id).slice(-6).toUpperCase()}`;
    if (seenDocRefs.has(ref)) return;
    exceptions.push({
      _domain: 'DOCS',
      _severity: 'UNRESOLVED',
      module: 'Admissions',
      recordRef: ref,
      exception: `Incomplete documents (${missingKeys.length})`,
      ageOrValue: missingKeys.slice(0, 2).join(', '),
      owner: 'Admissions Officer',
      nextAction: 'Collect pending documents',
      drilldownKey: 'combined-admission-first-fee',
      drilldownFilters: query.programId ? { programId: query.programId } : {},
    });
  });

  // 4. High / overdue open complaints
  openComplaints.forEach(c => {
    const ageDays = daysBetween(c.createdAt, now);
    const isOverdue = (c.slaDueDate && new Date(c.slaDueDate) < now) || ageDays > 7;
    const isHigh = ['High', 'Critical'].includes(c.priority);
    if (!isOverdue && !isHigh && !c.escalated) return;

    const ownerNames = Array.isArray(c.assignedToIds) && c.assignedToIds.length > 0
      ? c.assignedToIds.map(a => a?.name).filter(Boolean).join(', ')
      : 'Grievance Officer';

    exceptions.push({
      _domain: 'COMPLAINT',
      _severity: isOverdue ? 'OVERDUE' : 'HIGH',
      module: 'Complaints',
      recordRef: `CMP-${String(c._id).slice(-6).toUpperCase()}`,
      exception: `${c.priority || 'Medium'} priority complaint${isOverdue ? ' (SLA overdue)' : ''}`,
      ageOrValue: `${ageDays}d open`,
      owner: ownerNames,
      nextAction: 'Escalate & resolve SLA',
      drilldownKey: 'complaints-resolution-tracker',
      drilldownFilters: { status: 'Pending' },
    });
  });

  let rows = exceptions;
  const sevValues = parseMulti(query.severity)
    .filter(v => !/^all$/i.test(v))
    .map(v => v.trim().toUpperCase());
  if (sevValues.length > 0) {
    rows = rows.filter(r => sevValues.includes(r._severity));
  }
  if (query.owner && String(query.owner).trim()) {
    const target = String(query.owner).trim().toLowerCase();
    rows = rows.filter(r => r.owner.toLowerCase().includes(target));
  }

  const feeOverdueCount = rows.filter(r => r._domain === 'FEE').length;
  const lowAttCount = rows.filter(r => r._domain === 'ATTENDANCE').length;
  const pendingDocsCount = rows.filter(r => r._domain === 'DOCS').length;

  return {
    selectedFilters: buildSelectedFilters([
      ['dateFrom', query.dateFrom, 'From'],
      ['dateTo', query.dateTo, 'To'],
      ['programId', query.programId, 'Program'],
      ['severity', query.severity, 'Severity'],
      ['owner', query.owner, 'Owner'],
    ]),
    kpis: [
      { label: 'Open exceptions', value: formatNum(rows.length), tone: rows.length > 0 ? 'warning' : 'success' },
      { label: 'Fee overdue', value: formatNum(feeOverdueCount), tone: feeOverdueCount > 0 ? 'danger' : 'default' },
      { label: 'Low attendance', value: formatNum(lowAttCount), tone: lowAttCount > 0 ? 'warning' : 'default' },
      { label: 'Pending admission documents', value: formatNum(pendingDocsCount), tone: pendingDocsCount > 0 ? 'info' : 'default' },
    ],
    columns: [
      { key: 'module', label: 'Module', align: 'left' },
      { key: 'recordRef', label: 'Record', align: 'left' },
      { key: 'exception', label: 'Exception', align: 'left' },
      { key: 'ageOrValue', label: 'Age / value', align: 'right' },
      { key: 'owner', label: 'Assigned owner', align: 'left' },
      { key: 'nextAction', label: 'Next action', align: 'left' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          module: 'Total',
          recordRef: `${rows.length} exception(s)`,
          exception: `${feeOverdueCount} fee · ${lowAttCount} att · ${pendingDocsCount} docs`,
          ageOrValue: '—',
          owner: '—',
          nextAction: '—',
        }
      : null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: rows.length > 0 ? 'warning' : 'success',
      message: `${rows.length} non-sensitive management exception(s) queued across Fees, Attendance, Admissions, and Complaints.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 48 — Report Centre Audit & Export Log
// ---------------------------------------------------------------------------

async function buildReportCentreAuditLog(query = {}) {
  const { start, end, startStr, endStr } = safeDateRange(query.dateFrom, query.dateTo, 90);

  const logFilter = { timestamp: { $gte: start, $lte: end } };
  if (query.userName && String(query.userName).trim()) {
    logFilter.userName = new RegExp(escapeRegex(String(query.userName).trim()), 'i');
  }
  applyMultiStringFilter(logFilter, 'module', query.reportModule, { caseInsensitive: true });
  applyMultiStringFilter(logFilter, 'format', query.format, { uppercase: true });

  const logs = await ReportExportLog.find(logFilter)
    .select('timestamp userName reportName module filtersSummary format status recordCount')
    .sort({ timestamp: -1 })
    .lean();

  let pdfCount = 0;
  let excelCount = 0;
  let printViewCount = 0;
  const uniqueUsers = new Set();

  // Never expose sensitive data payloads — audit metadata only
  const rows = logs.map(log => {
    const fmt = String(log.format || 'VIEW').toUpperCase();
    if (fmt === 'PDF') pdfCount += 1;
    else if (fmt === 'EXCEL') excelCount += 1;
    else printViewCount += 1;
    if (log.userName) uniqueUsers.add(log.userName);
    return {
      _rowId: String(log._id),
      timestamp: log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 16) : '—',
      userName: log.userName || 'System',
      reportName: log.reportName || 'Report',
      filtersSummary: log.filtersSummary || 'Default filters',
      format: fmt,
      status: log.status || 'SUCCESS',
    };
  });

  return {
    selectedFilters: buildSelectedFilters([
      ['dateFrom', startStr, 'From'],
      ['dateTo', endStr, 'To'],
      ['userName', query.userName, 'User'],
      ['reportModule', query.reportModule, 'Module'],
      ['format', query.format, 'Format'],
    ]),
    kpis: [
      { label: 'Reports generated', value: formatNum(rows.length), tone: 'info' },
      { label: 'PDF exports', value: formatNum(pdfCount), tone: 'default' },
      { label: 'Excel exports', value: formatNum(excelCount), tone: 'default' },
      { label: 'Print / views', value: formatNum(printViewCount), tone: 'success' },
    ],
    columns: [
      { key: 'timestamp', label: 'Date/time', align: 'left' },
      { key: 'userName', label: 'User', align: 'left' },
      { key: 'reportName', label: 'Report name', align: 'left' },
      { key: 'filtersSummary', label: 'Filters applied', align: 'left' },
      { key: 'format', label: 'Format', align: 'center' },
      { key: 'status', label: 'Result', align: 'center' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          timestamp: 'Total',
          userName: `${rows.length} export/view event(s)`,
          reportName: `${pdfCount} PDF · ${excelCount} Excel`,
          filtersSummary: `${uniqueUsers.size} unique user(s)`,
          format: '—',
          status: '—',
        }
      : null,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: 'info',
      message: `${rows.length} report audit event(s) logged between ${startStr} and ${endStr} by ${uniqueUsers.size} user(s). Metadata only — no sensitive payloads stored.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Catalog, Handlers & Inline Actions
// ---------------------------------------------------------------------------

const CATALOG = [
  {
    key: 'front-office-visitor-inquiry',
    pageNumber: 38,
    module: 'Front Office',
    category: 'Front Office',
    categoryKey: 'Front Office',
    rbacModule: 'Front Office',
    rbacSubModule: 'reports',
    title: 'Front Office Visitor & Inquiry Register',
    purpose: 'Unified reception activity register combining visitors and admission inquiries.',
    filterSchema: [
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'inquiryType', label: 'Inquiry / Visit Type', type: 'text' },
      { key: 'officerName', label: 'Officer', type: 'text' },
      {
        key: 'status',
        label: 'Outcome / Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'NEW', label: 'New Inquiry' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'FOLLOW_UP_DUE', label: 'Follow-up Due' },
          { value: 'CONVERTED', label: 'Converted' },
        ],
      },
    ],
  },
  {
    key: 'complaints-resolution-tracker',
    pageNumber: 39,
    module: 'Complaints',
    category: 'Complaints',
    categoryKey: 'Complaints',
    rbacModule: 'Complaints',
    rbacSubModule: 'reports',
    altRbacModule: 'Front Office',
    altRbacSubModule: 'complaint',
    title: 'Complaints & Grievance Resolution Tracker',
    purpose: 'Track grievance aging, SLA overdue breaches, escalations, and complainant notifications.',
    inlineActions: [
      {
        name: 'update-complaint-sla',
        key: 'update-complaint-sla',
        label: 'Update Case',
        scope: 'row',
        fields: [
          {
            key: 'status',
            label: 'Case Status',
            type: 'select',
            defaultValue: 'In Progress',
            options: [
              { value: 'Pending', label: 'Pending' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Resolved', label: 'Resolved' },
              { value: 'Dismissed', label: 'Dismissed' },
            ],
          },
          {
            key: 'priority',
            label: 'Priority',
            type: 'select',
            defaultValue: 'Medium',
            options: [
              { value: 'Low', label: 'Low' },
              { value: 'Medium', label: 'Medium' },
              { value: 'High', label: 'High' },
              { value: 'Critical', label: 'Critical' },
            ],
          },
          {
            key: 'escalated',
            label: 'Escalate Case',
            type: 'select',
            defaultValue: 'false',
            options: [
              { value: 'false', label: 'Normal Handling' },
              { value: 'true', label: 'Escalate Case' },
            ],
          },
          { key: 'slaDueDate', label: 'Target Date', type: 'date' },
          { key: 'actionTaken', label: 'Action Note', type: 'text', placeholder: 'What step was taken?' },
        ],
      },
    ],
    filterSchema: [
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'category', label: 'Category', type: 'text' },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'Low', label: 'Low' },
          { value: 'Medium', label: 'Medium' },
          { value: 'High', label: 'High' },
          { value: 'Critical', label: 'Critical' },
        ],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'Pending', label: 'Pending' },
          { value: 'In Progress', label: 'In Progress' },
          { value: 'Resolved', label: 'Resolved' },
        ],
      },
    ],
  },
  {
    key: 'boarding-hostel-occupancy',
    pageNumber: 40,
    module: 'Boarding',
    category: 'Boarding',
    categoryKey: 'Boarding',
    rbacModule: 'Boarding',
    rbacSubModule: 'revenue',
    title: 'Hostel & Boarding Occupancy',
    purpose: 'Bed capacity, room vacancy split, and active/past boarding resident roster.',
    filterSchema: [
      { key: 'hostelName', label: 'Hostel Name', type: 'text' },
      { key: 'blockFloor', label: 'Block / Floor', type: 'text' },
      {
        key: 'roomStatus',
        label: 'Room Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All Rooms' },
          { value: 'vacant', label: 'Vacant' },
          { value: 'occupied', label: 'Occupied' },
        ],
      },
      {
        key: 'residentStatus',
        label: 'Resident Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'terminated', label: 'Terminated' },
          { value: 'withdrawn', label: 'Withdrawn' },
          { value: 'ALL', label: 'All' },
        ],
      },
    ],
  },
  {
    key: 'inventory-stock-on-hand',
    pageNumber: 41,
    module: 'Inventory',
    category: 'Inventory',
    categoryKey: 'Inventory',
    rbacModule: 'Inventory',
    rbacSubModule: 'reports',
    title: 'Inventory Stock-on-Hand',
    purpose: 'Reconstruct stock balances from opening stock and ledger movements up to as-of date.',
    inlineActions: [
      {
        name: 'record-stock-movement',
        key: 'record-stock-movement',
        label: 'Update Stock',
        scope: 'row',
        fields: [
          {
            key: 'type',
            label: 'Change Type',
            type: 'select',
            defaultValue: 'RECEIPT',
            options: [
              { value: 'RECEIPT', label: 'Stock In (Add)' },
              { value: 'ISSUE', label: 'Stock Out (Issue)' },
              { value: 'ADJUSTMENT', label: 'Stock Adjustment (+/-)' },
              { value: 'OPENING', label: 'Set Opening Balance' },
            ],
          },
          { key: 'quantity', label: 'Quantity', type: 'number', defaultValue: 1, placeholder: 'Enter quantity' },
          { key: 'referenceNo', label: 'Slip / Ref No.', type: 'text', placeholder: 'Optional reference' },
          { key: 'remarks', label: 'Note', type: 'text', placeholder: 'Reason or remarks' },
        ],
      },
    ],
    filterSchema: [
      { key: 'asOfDate', label: 'As-of Date', type: 'date' },
      { key: 'storeName', label: 'Store', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      {
        key: 'stockStatus',
        label: 'Stock Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'OK', label: 'OK' },
          { value: 'LOW', label: 'Below Reorder' },
          { value: 'OUT', label: 'Out of Stock' },
        ],
      },
    ],
  },
  {
    key: 'inventory-purchase-grn',
    pageNumber: 42,
    module: 'Inventory',
    category: 'Inventory',
    categoryKey: 'Inventory',
    rbacModule: 'Inventory',
    rbacSubModule: 'reports',
    title: 'Purchase Orders & GRN Tracker',
    purpose: 'Procurement tracking for purchase orders, approvals, goods receipt notes, and stock intake.',
    inlineActions: [
      {
        name: 'create-purchase-order',
        key: 'create-purchase-order',
        label: 'New Purchase',
        scope: 'report',
        fields: [
          { key: 'supplierName', label: 'Supplier Name', type: 'text', placeholder: 'e.g. Allied Stationers' },
          { key: 'itemCategory', label: 'Category', type: 'text', placeholder: 'e.g. Stationery, IT, Lab' },
          { key: 'itemName', label: 'Item Name', type: 'text', placeholder: 'e.g. A4 Paper Reams' },
          { key: 'quantity', label: 'Quantity', type: 'number', defaultValue: 1 },
          { key: 'unitPrice', label: 'Unit Price (Rs)', type: 'number', defaultValue: 0 },
          { key: 'poDate', label: 'Order Date', type: 'date' },
          { key: 'invoiceNo', label: 'Invoice / Ref No.', type: 'text', placeholder: 'Optional' },
        ],
      },
      {
        name: 'update-po-grn',
        key: 'update-po-grn',
        label: 'Receive / Update',
        scope: 'row',
        fields: [
          {
            key: 'approvalStatus',
            label: 'Approval Status',
            type: 'select',
            defaultValue: 'APPROVED',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ],
          },
          {
            key: 'grnStatus',
            label: 'Delivery Status',
            type: 'select',
            defaultValue: 'RECEIVED',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'PARTIAL', label: 'Partially Received' },
              { value: 'RECEIVED', label: 'Received' },
            ],
          },
          { key: 'grnDate', label: 'Received Date', type: 'date' },
          { key: 'grnRemarks', label: 'Delivery Note', type: 'text', placeholder: 'Optional remarks' },
        ],
      },
    ],
    filterSchema: [
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'supplierName', label: 'Supplier', type: 'text' },
      {
        key: 'approvalStatus',
        label: 'Approval Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
        ],
      },
      {
        key: 'grnStatus',
        label: 'GRN Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'PARTIAL', label: 'Partial' },
          { value: 'RECEIVED', label: 'Received' },
        ],
      },
    ],
  },
  {
    key: 'executive-monthly-overview',
    pageNumber: 43,
    module: 'Executive Dashboard',
    category: 'Executive',
    categoryKey: 'Executive Dashboard',
    rbacModule: 'Executive Dashboard',
    rbacSubModule: '_root',
    title: 'Executive Monthly Overview',
    purpose: 'Management scorecard comparing admissions, fee collections, receivables, attendance, exams, and complaints.',
    filterSchema: [
      { key: 'month', label: 'Month (YYYY-MM)', type: 'month' },
      { key: 'sessionId', label: 'Academic Session', type: 'select', optionsSource: 'sessions' },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      {
        key: 'dataStatus',
        label: 'Data Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All Areas' },
          { value: 'ATTENTION_ONLY', label: 'Attention Needed Only' },
        ],
      },
    ],
  },
  {
    key: 'combined-student-risk-watchlist',
    pageNumber: 44,
    module: 'Combined',
    category: 'Executive',
    categoryKey: 'Executive',
    rbacModule: 'Executive Dashboard',
    rbacSubModule: '_root',
    altRbacModule: 'Students',
    altRbacSubModule: 'reports',
    title: 'Student Early-Warning Risk Watchlist',
    purpose: 'Deduplicated cross-module student risk watchlist across attendance, fee arrears, and latest exam performance.',
    filterSchema: [
      { key: 'sessionId', label: 'Academic Session', type: 'select', optionsSource: 'sessions' },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      { key: 'attendanceBelow', label: 'Attendance Below %', type: 'number' },
      { key: 'feeBalanceAbove', label: 'Fee Balance Above (Rs)', type: 'number' },
      { key: 'examPctBelow', label: 'Exam % Below', type: 'number' },
    ],
  },
  {
    key: 'combined-class-health',
    pageNumber: 45,
    module: 'Combined',
    category: 'Executive',
    categoryKey: 'Executive',
    rbacModule: 'Executive Dashboard',
    rbacSubModule: '_root',
    altRbacModule: 'Academics',
    altRbacSubModule: 'reports',
    title: 'Program & Class Cohort Health',
    purpose: 'Cohort health scorecard combining student strength, attendance %, exam pass %, and fee receivables.',
    filterSchema: [
      { key: 'sessionId', label: 'Academic Session', type: 'select', optionsSource: 'sessions' },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'month', label: 'Attendance Month (YYYY-MM)', type: 'month' },
    ],
  },
  {
    key: 'combined-admission-first-fee',
    pageNumber: 46,
    module: 'Combined',
    category: 'Executive',
    categoryKey: 'Executive',
    rbacModule: 'Students',
    rbacSubModule: 'reports',
    altRbacModule: 'Fee Management',
    altRbacSubModule: 'reports',
    title: 'Admission-to-First-Fee Conversion',
    purpose: 'Track inquiries through enrollment and first installment payment completion.',
    filterSchema: [
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      { key: 'source', label: 'Inquiry Source', type: 'text' },
      {
        key: 'firstInstStatus',
        label: 'First Installment',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PAID', label: 'Paid' },
          { value: 'PENDING', label: 'Pending' },
        ],
      },
    ],
  },
  {
    key: 'combined-management-exceptions',
    pageNumber: 47,
    module: 'Combined',
    category: 'Executive',
    categoryKey: 'Executive',
    rbacModule: 'Executive Dashboard',
    rbacSubModule: '_root',
    title: 'Management Exceptions Queue',
    purpose: 'Actionable cross-module exception queue using non-sensitive record identifiers and report drill-downs.',
    filterSchema: [
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      {
        key: 'severity',
        label: 'Severity',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'HIGH', label: 'High' },
          { value: 'OVERDUE', label: 'Overdue' },
          { value: 'UNRESOLVED', label: 'Unresolved' },
        ],
      },
      { key: 'owner', label: 'Assigned Owner', type: 'text' },
    ],
  },
  {
    key: 'report-centre-audit-log',
    pageNumber: 48,
    module: 'Report Centre',
    category: 'Report Centre',
    categoryKey: 'Report Centre',
    rbacModule: 'Report Centre',
    rbacSubModule: 'audit-log',
    altRbacModule: 'Configuration',
    altRbacSubModule: 'logs',
    title: 'Report Centre Audit & Export Log',
    purpose: 'Track report views and PDF/Excel/Print exports without storing sensitive payloads.',
    filterSchema: [
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'userName', label: 'User', type: 'text' },
      { key: 'reportModule', label: 'Report Module', type: 'text' },
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PDF', label: 'PDF' },
          { value: 'EXCEL', label: 'Excel' },
          { value: 'PRINT', label: 'Print' },
          { value: 'VIEW', label: 'View' },
        ],
      },
    ],
  },
];

const HANDLERS = {
  'front-office-visitor-inquiry': buildFrontOfficeVisitorInquiry,
  'complaints-resolution-tracker': buildComplaintsResolutionTracker,
  'boarding-hostel-occupancy': buildBoardingHostelOccupancy,
  'inventory-stock-on-hand': buildInventoryStockOnHand,
  'inventory-purchase-grn': buildInventoryPurchaseGrn,
  'executive-monthly-overview': buildExecutiveMonthlyOverview,
  'combined-student-risk-watchlist': buildStudentRiskWatchlist,
  'combined-class-health': buildCombinedClassHealth,
  'combined-admission-first-fee': buildAdmissionFirstFee,
  'combined-management-exceptions': buildManagementExceptions,
  'report-centre-audit-log': buildReportCentreAuditLog,
};

const ACTIONS = {
  'update-complaint-sla': updateComplaintSlaAction,
  'record-stock-movement': recordStockMovementAction,
  'create-purchase-order': createPurchaseOrderAction,
  'update-po-grn': updatePoGrnAction,
};

module.exports = {
  CATALOG,
  HANDLERS,
  ACTIONS,
  buildFrontOfficeVisitorInquiry,
  buildComplaintsResolutionTracker,
  buildBoardingHostelOccupancy,
  buildInventoryStockOnHand,
  buildInventoryPurchaseGrn,
  buildExecutiveMonthlyOverview,
  buildStudentRiskWatchlist,
  buildCombinedClassHealth,
  buildAdmissionFirstFee,
  buildManagementExceptions,
  buildReportCentreAuditLog,
};
