const mongoose = require('mongoose');
const {
  FeePaymentReceipt,
  FeeChallan,
  ExtraChallan,
  FeeHead,
  StudentCreditLedger,
  FeeReminderLog,
  FeeConcessionRequest,
  FinanceClosing,
  Student,
  Program,
  Class,
  User,
  Staff,
  AcademicSession,
  ActivityLog,
} = require('../../models');
const { ACTIVE_STUDENT_FILTER } = require('../../utils/studentStatus');
const { buildStudentSearchCondition, buildFlexibleWhitespaceRegex } = require('../../utils/studentSearch');
const {
  parseMulti,
  toObjectIds,
  applyMultiIdFilter,
  resolveDateRange,
  resolveSession,
  formatRs,
  formatNum,
  formatPct,
  pctValue,
  formatDate,
  fullName,
} = require('./reportHelpers');

// ---------------------------------------------------------------------------
// Shared internal helpers (ponytail: single source of truth across P11-P18)
// ---------------------------------------------------------------------------

async function normalizeContext(ctx, query = {}) {
  const isEngineCtx = Boolean(ctx && typeof ctx === 'object' && ('reqUser' in ctx || 'sessionCtx' in ctx || 'def' in ctx));
  const reqUser = isEngineCtx ? ctx.reqUser : (ctx || null);
  const sessionCtx = (isEngineCtx && ctx.sessionCtx) ? ctx.sessionCtx : await resolveSession(query?.sessionId);
  return { reqUser, sessionCtx };
}

function getExplicitSessionObjectId(query = {}) {
  const raw = query.sessionId;
  if (!raw || raw === 'all' || raw === '*' || raw === 'ALL') return null;
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(String(raw)) : null;
}

/** Convert Date or YYYY-MM-DD string to exact UTC midnight ms for timezone-safe day math. */
function toDayUtcMs(val) {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    const [y, m, d] = val.trim().split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  const dt = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(dt.getTime())) return null;
  // Date-only ISO strings parse as 00:00:00.000Z; preserve UTC calendar day for those
  if (dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0 && dt.getUTCMilliseconds() === 0) {
    return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
  }
  return Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function dayDiff(laterVal, earlierVal) {
  const a = toDayUtcMs(laterVal);
  const b = toDayUtcMs(earlierVal);
  if (a == null || b == null) return 0;
  return Math.round((a - b) / 86400000);
}

function toYmd(val, fallback = new Date()) {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const dt = val ? new Date(val) : new Date(fallback);
  if (Number.isNaN(dt.getTime())) return new Date(fallback).toISOString().slice(0, 10);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveDayBounds(dateFrom, dateTo, defaultDaysBack = 90) {
  const { start, end } = resolveDateRange(dateFrom, dateTo, defaultDaysBack);
  const startStr = typeof dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)
    ? dateFrom
    : toYmd(start);
  const endStr = typeof dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
    ? dateTo
    : toYmd(end);
  return { start, end, startStr, endStr };
}

function buildStudentDisplayName(s) {
  if (!s) return 'Unknown Student';
  const name = fullName(s) || 'Unknown Student';
  return s.rollNumber ? `${name} (${s.rollNumber})` : name;
}

function resolveProgramName(student) {
  return student?.programId?.name || '—';
}

function resolveClassName(student) {
  return student?.classId?.name || '—';
}

async function resolveCashierUserIds(cashierParam) {
  const rawVals = parseMulti(cashierParam);
  if (rawVals.length === 0) return null;
  const objIds = toObjectIds(cashierParam);
  if (objIds.length === 0) return [];
  // Support passing either User._id or Staff._id (mapped via User.refId or matching email/name)
  const [directUsers, staffDocs] = await Promise.all([
    User.find({ _id: { $in: objIds } }).select('_id').lean(),
    Staff.find({ _id: { $in: objIds } }).select('_id email name').lean(),
  ]);
  const ids = new Set(directUsers.map(u => String(u._id)));
  if (staffDocs.length > 0) {
    const emails = staffDocs.map(s => s.email).filter(Boolean);
    const names = staffDocs.map(s => s.name).filter(Boolean);
    const matched = await User.find({
      $or: [
        { refId: { $in: staffDocs.map(s => s._id) } },
        ...(emails.length ? [{ email: { $in: emails } }] : []),
        ...(names.length ? [{ name: { $in: names } }] : []),
      ],
    }).select('_id').lean();
    matched.forEach(u => ids.add(String(u._id)));
  }
  return Array.from(ids).map(id => new mongoose.Types.ObjectId(id));
}

async function loadFeeHeadFilterContext(feeHeadIdParam) {
  const headIds = toObjectIds(feeHeadIdParam);
  if (headIds.length === 0) return null;
  const heads = await FeeHead.find({ _id: { $in: headIds } }).select('_id name isTuition').lean();
  return {
    ids: new Set(headIds.map(String)),
    names: new Set(heads.map(h => String(h.name || '').trim().toLowerCase()).filter(Boolean)),
    includesTuition: heads.some(h => h.isTuition === true || /tuition/i.test(h.name || '')),
    labels: heads.map(h => h.name).filter(Boolean),
  };
}

function challanMatchesFeeHead(challan, headCtx, receipt = null) {
  if (!headCtx) return true;
  const headsList = [
    ...(Array.isArray(challan?.challanHeads) ? challan.challanHeads : []),
    ...(Array.isArray(challan?.selectedHeads) ? challan.selectedHeads : []),
    ...(Array.isArray(challan?.heads) ? challan.heads : []),
  ];
  for (const h of headsList) {
    const hid = String(h?.headId?._id || h?.headId || '');
    const hName = String(h?.name || h?.headName || '').trim().toLowerCase();
    if ((hid && headCtx.ids.has(hid)) || (hName && headCtx.names.has(hName))) return true;
  }
  if (headCtx.includesTuition) {
    if (receipt && Number(receipt.allocatedToTuition || 0) > 0) return true;
    if (challan && (Number(challan.basePayable ?? challan.amount ?? 0) > 0) && !Array.isArray(challan.heads)) return true;
  }
  return false;
}

function extractChallanFeeHeadLabel(challan, challanType = 'FeeChallan', receipt = null) {
  if (!challan || typeof challan !== 'object') {
    if (challanType === 'HostelChallan') return 'Hostel Fee';
    if (challanType === 'ExtraChallan') return 'Extra Challan';
    return 'Tuition Fee';
  }
  if (challanType === 'HostelChallan') return 'Hostel Fee';
  const headItems = [
    ...(Array.isArray(challan.challanHeads) ? challan.challanHeads : []),
    ...(Array.isArray(challan.heads) ? challan.heads : []),
    ...(Array.isArray(challan.selectedHeads) ? challan.selectedHeads : []),
  ];
  const names = [...new Set(headItems.map(h => h?.name || h?.headName).filter(Boolean))];
  const hasTuition = Number(receipt?.allocatedToTuition || 0) > 0 || (challanType === 'FeeChallan' && Number(challan.basePayable ?? challan.amount ?? 0) > 0);
  if (names.length > 0) {
    if (hasTuition && !names.some(n => /tuition/i.test(n))) return `Tuition, ${names.join(', ')}`;
    return names.join(', ');
  }
  return challanType === 'ExtraChallan' ? 'Extra Challan' : 'Tuition Fee';
}

function computeFeeChallanNumbers(c, fallbackAmount = 0) {
  const base = Number(c.basePayable ?? c.amount ?? fallbackAmount ?? 0);
  const heads = Number(c.headsAmount ?? (Array.isArray(c.challanHeads)
    ? c.challanHeads.reduce((s, h) => s + Number(h.amount || 0), 0)
    : (Array.isArray(c.selectedHeads) ? c.selectedHeads.reduce((s, h) => s + Number(h?.amount || 0), 0) : 0)));
  const arrears = Number(c.arrearsAmount || 0);
  const late = Number(c.lateFeeAmount ?? c.fineAmount ?? 0);
  const discount = Number(c.discountAmount ?? c.discount ?? 0);
  const advance = Number(c.advanceApplied || 0);
  const gross = c.grossAmount != null ? Number(c.grossAmount) : (base + heads + arrears + late);
  const netRaw = c.netPayable != null
    ? Number(c.netPayable)
    : (c.totalAmount != null ? Number(c.totalAmount) : Math.max(0, gross - discount - advance));
  const amountDue = Math.max(0, netRaw);
  const paidAmount = Number(c.paidAmount || 0);
  const settledViaArrears = Number(c.settledViaArrearsAmount || 0);
  const st = String(c.status || 'PENDING').toUpperCase();
  const isSettled = st === 'SETTLED';
  // Partial payments MUST never be zeroed out even if status was inconsistently saved as PAID
  const isActuallyPaid = (st === 'PAID' && paidAmount >= amountDue) || isSettled;
  const balance = isActuallyPaid ? 0 : Math.max(0, amountDue - paidAmount - settledViaArrears);
  return { base, heads, arrears, late, discount, advance, gross, amountDue, paidAmount, settledViaArrears, balance, isSettled };
}

function buildActiveStudentQuery(query = {}) {
  const conds = [ACTIVE_STUDENT_FILTER];
  const progFilter = {};
  applyMultiIdFilter(progFilter, 'programId', query.programId);
  if (progFilter.programId) conds.push(progFilter);

  const classFilter = {};
  applyMultiIdFilter(classFilter, 'classId', query.classId);
  if (classFilter.classId) conds.push(classFilter);

  const sessId = getExplicitSessionObjectId(query);
  if (sessId) {
    conds.push({
      $or: [
        { sessionId: sessId },
        { 'academicRecords.sessionId': sessId },
        { 'installments.sessionId': sessId },
      ],
    });
  }

  if (query.search && String(query.search).trim()) {
    const searchCond = buildStudentSearchCondition(query.search, { extraFields: ['parentOrGuardianPhone'] });
    if (searchCond) conds.push(searchCond);
  }
  return conds.length === 1 ? conds[0] : { $and: conds };
}

/**
 * Sync active students' installments with live FeeChallan (+ optional ExtraChallan) without double-counting.
 */
async function collectActiveStudentObligations(query = {}, { includeExtraChallans = false, asOfRefDate = new Date() } = {}) {
  const studentFilter = buildActiveStudentQuery(query);
  const explicitSessId = getExplicitSessionObjectId(query);
  const headCtx = await loadFeeHeadFilterContext(query.feeHeadId);

  const students = await Student.find(studentFilter)
    .select('fName lName fatherOrguardian rollNumber parentOrGuardianPhone programId classId sessionId installments tuitionFee isScholarship100')
    .populate('programId', 'name code')
    .populate('classId', 'name')
    .lean();

  if (students.length === 0) return { students: [], items: [], headCtx };

  const studentIds = students.map(s => s._id);
  const challanFilter = { studentId: { $in: studentIds }, status: { $nin: ['VOID', 'SUPERSEDED'] } };
  if (explicitSessId) {
    challanFilter.$or = [{ sessionId: explicitSessId }, { sessionId: null }, { sessionId: { $exists: false } }];
  }

  const [challans, extraChallans] = await Promise.all([
    FeeChallan.find(challanFilter).populate('challanHeads.headId', 'name isTuition').lean(),
    includeExtraChallans
      ? ExtraChallan.find({ studentId: { $in: studentIds }, status: { $nin: ['VOID', 'SUPERSEDED', 'SETTLED'] } }).lean()
      : Promise.resolve([]),
  ]);

  const challansByStudent = new Map();
  for (const ch of challans) {
    const sid = String(ch.studentId);
    if (!challansByStudent.has(sid)) challansByStudent.set(sid, []);
    challansByStudent.get(sid).push(ch);
  }

  const extrasByStudent = new Map();
  for (const ec of extraChallans) {
    const sid = String(ec.studentId);
    if (!extrasByStudent.has(sid)) extrasByStudent.set(sid, []);
    extrasByStudent.get(sid).push(ec);
  }

  const items = [];
  for (const student of students) {
    const sid = String(student._id);
    const sChallans = challansByStudent.get(sid) || [];
    const matchedChallanIds = new Set();

    const instList = Array.isArray(student.installments) ? student.installments : [];
    for (const inst of instList) {
      if (explicitSessId && inst.sessionId && String(inst.sessionId) !== String(explicitSessId)) continue;

      const matched = sChallans.find(ch =>
        !matchedChallanIds.has(String(ch._id)) && (
          (ch.installmentId && inst._id && String(ch.installmentId) === String(inst._id)) ||
          (ch.installmentNumber != null && inst.installmentNumber != null && Number(ch.installmentNumber) === Number(inst.installmentNumber)) ||
          (ch.month && inst.month && String(ch.month).trim().toLowerCase() === String(inst.month).trim().toLowerCase())
        )
      );

      if (matched) {
        matchedChallanIds.add(String(matched._id));
        if (!challanMatchesFeeHead(matched, headCtx)) continue;
        const nums = computeFeeChallanNumbers(matched, inst.amount);
        const dueDate = matched.dueDate || inst.dueDate;
        const overdueDays = dueDate ? dayDiff(asOfRefDate, dueDate) : 0;
        let status;
        if (nums.balance <= 0) status = 'PAID';
        else if (nums.paidAmount > 0) status = 'PARTIAL';
        else if (overdueDays > 0) status = 'OVERDUE';
        else status = 'PENDING';

        items.push({
          student,
          studentId: sid,
          challanId: String(matched._id),
          challanNo: matched.challanNo || '',
          installmentNumber: matched.installmentNumber ?? inst.installmentNumber ?? 1,
          month: matched.month || inst.month || '',
          dueDate,
          amountDue: nums.amountDue,
          paidAmount: nums.paidAmount,
          balance: nums.balance,
          status,
          sourceType: 'FeeChallan',
        });
      } else {
        const rawSt = String(inst.status || 'PENDING').toUpperCase();
        if (['VOID', 'SUPERSEDED', 'SETTLED'].includes(rawSt)) continue;
        if (headCtx && !headCtx.includesTuition) continue;

        const gross = Number(inst.totalAmount ?? inst.amount ?? inst.basePayable ?? 0);
        const disc = Number(inst.discountAmount ?? inst.discount ?? 0);
        const amountDue = student.isScholarship100 ? 0 : Math.max(0, gross - disc);
        const paidAmount = Number(inst.paidAmount || 0);
        const isPaid = rawSt === 'PAID' && paidAmount >= amountDue;
        const balance = isPaid ? 0 : Math.max(0, amountDue - paidAmount);
        const dueDate = inst.dueDate;
        const overdueDays = dueDate ? dayDiff(asOfRefDate, dueDate) : 0;
        let status;
        if (balance <= 0) status = 'PAID';
        else if (paidAmount > 0) status = 'PARTIAL';
        else if (overdueDays > 0) status = 'OVERDUE';
        else status = 'PENDING';

        items.push({
          student,
          studentId: sid,
          challanId: null,
          challanNo: '',
          installmentNumber: inst.installmentNumber ?? 1,
          month: inst.month || '',
          dueDate,
          amountDue,
          paidAmount,
          balance,
          status,
          sourceType: 'InstallmentPlan',
        });
      }
    }

    // Any live FeeChallans without a matching Student.installments entry
    for (const ch of sChallans) {
      if (matchedChallanIds.has(String(ch._id))) continue;
      if (!challanMatchesFeeHead(ch, headCtx)) continue;
      const nums = computeFeeChallanNumbers(ch, 0);
      const dueDate = ch.dueDate;
      const overdueDays = dueDate ? dayDiff(asOfRefDate, dueDate) : 0;
      let status;
      if (nums.balance <= 0) status = 'PAID';
      else if (nums.paidAmount > 0) status = 'PARTIAL';
      else if (overdueDays > 0) status = 'OVERDUE';
      else status = 'PENDING';

      items.push({
        student,
        studentId: sid,
        challanId: String(ch._id),
        challanNo: ch.challanNo || '',
        installmentNumber: ch.installmentNumber ?? 1,
        month: ch.month || '',
        dueDate,
        amountDue: nums.amountDue,
        paidAmount: nums.paidAmount,
        balance: nums.balance,
        status,
        sourceType: 'FeeChallan',
      });
    }

    if (includeExtraChallans) {
      const sExtras = extrasByStudent.get(sid) || [];
      for (const ec of sExtras) {
        if (!challanMatchesFeeHead(ec, headCtx)) continue;
        const totalDue = Math.max(
          0,
          ec.totalAmount != null
            ? Number(ec.totalAmount)
            : Number(ec.amount || 0) + Number(ec.arrearsAmount || 0) + Number(ec.lateFeeFine || 0) - Number(ec.discount || 0)
        );
        const paidAmount = Number(ec.paidAmount || 0);
        const settledArr = Number(ec.settledViaArrearsAmount || 0);
        const isPaid = String(ec.status || '').toUpperCase() === 'PAID' && paidAmount >= totalDue;
        const balance = isPaid ? 0 : Math.max(0, totalDue - paidAmount - settledArr);
        const overdueDays = ec.dueDate ? dayDiff(asOfRefDate, ec.dueDate) : 0;
        let status;
        if (balance <= 0) status = 'PAID';
        else if (paidAmount > 0) status = 'PARTIAL';
        else if (overdueDays > 0) status = 'OVERDUE';
        else status = 'PENDING';

        items.push({
          student,
          studentId: sid,
          challanId: String(ec._id),
          challanNo: ec.challanNo || '',
          installmentNumber: null,
          month: 'Extra Challan',
          dueDate: ec.dueDate,
          amountDue: totalDue,
          paidAmount,
          balance,
          status,
          sourceType: 'ExtraChallan',
        });
      }
    }
  }

  return { students, items, headCtx };
}

async function loadLatestReminderMap(studentIds) {
  if (!studentIds || studentIds.length === 0) return new Map();
  const logs = await FeeReminderLog.find({ studentId: { $in: studentIds } })
    .sort({ createdAt: -1 })
    .lean();

  const map = new Map();
  for (const log of logs) {
    const sid = String(log.studentId);
    const chKey = log.challanId ? `${sid}:ch:${log.challanId}` : null;
    const instKey = log.installmentNumber != null ? `${sid}:inst:${log.installmentNumber}` : null;
    const isStudentLevel = !log.challanId && log.installmentNumber == null;
    const stuKey = isStudentLevel ? `${sid}:stu` : null;
    if (chKey && !map.has(chKey)) map.set(chKey, log);
    if (instKey && !map.has(instKey)) map.set(instKey, log);
    if (stuKey && !map.has(stuKey)) map.set(stuKey, log);
  }
  return { map, logs };
}

function pickLatestReminder(reminderCtx, studentId, challanId, installmentNumber) {
  if (!reminderCtx?.map) return null;
  const m = reminderCtx.map;
  if (challanId && m.has(`${studentId}:ch:${challanId}`)) return m.get(`${studentId}:ch:${challanId}`);
  if (installmentNumber != null && m.has(`${studentId}:inst:${installmentNumber}`)) return m.get(`${studentId}:inst:${installmentNumber}`);
  return m.get(`${studentId}:stu`) || null;
}

async function getFilterLabels(query = {}, extra = []) {
  const filters = [...extra];
  if (query.programId && query.programId !== 'all') {
    const ids = toObjectIds(query.programId);
    if (ids.length) {
      const progs = await Program.find({ _id: { $in: ids } }).select('name').lean();
      filters.push({ label: 'Program', value: progs.map(p => p.name).join(', ') || 'Selected' });
    }
  }
  if (query.classId && query.classId !== 'all') {
    const ids = toObjectIds(query.classId);
    if (ids.length) {
      const classes = await Class.find({ _id: { $in: ids } }).select('name').lean();
      filters.push({ label: 'Class', value: classes.map(c => c.name).join(', ') || 'Selected' });
    }
  }
  const sessId = getExplicitSessionObjectId(query);
  if (sessId) {
    const sess = await AcademicSession.findById(sessId).select('name').lean();
    if (sess) filters.push({ label: 'Session', value: sess.name });
  }
  return filters;
}

async function buildCashierOptions() {
  const users = await User.find({ status: 'ACTIVE' }).select('_id name role').sort({ name: 1 }).lean();
  return users.map(u => ({ value: String(u._id), label: u.name }));
}

function classifyPaymentMethod(mode) {
  const s = String(mode || 'Cash').trim();
  if (/online|jazzcash|easypaisa|raast|card|pos|wallet|app/i.test(s)) return 'online';
  if (/bank|transfer|ibft|cheque|check|dd|pay.?order|deposit/i.test(s)) return 'bankTransfer';
  return 'cash';
}

function logReportActivity(reqUser, action, description, target = {}) {
  ActivityLog.create({
    userId: reqUser?.id || null,
    userName: reqUser?.name || reqUser?.email || 'Administrator',
    userEmail: reqUser?.email || '',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Fee Management',
    subModule: 'reports',
    action,
    actionType: 'REPORT_ACTION',
    description,
    method: 'POST',
    endpoint: '/api/reports/fees/action',
    status: 'SUCCESS',
    statusCode: 200,
    targetEntity: target,
  }).catch(() => {});
}

const REMINDER_ACTION_DEF = {
  name: 'log-fee-reminder',
  label: 'Log Reminder',
  scope: 'row',
  fields: [
    {
      key: 'channel',
      label: 'Channel',
      type: 'select',
      defaultValue: 'SMS',
      options: [
        { value: 'SMS', label: 'SMS' },
        { value: 'WHATSAPP', label: 'WhatsApp' },
        { value: 'CALL', label: 'Phone Call' },
        { value: 'EMAIL', label: 'Email' },
        { value: 'IN_PERSON', label: 'In Person' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'SENT',
      options: [
        { value: 'NOT_SENT', label: 'Not Sent' },
        { value: 'QUEUED', label: 'Queued' },
        { value: 'SENT', label: 'Sent' },
        { value: 'RESPONDED', label: 'Responded' },
        { value: 'FAILED', label: 'Failed' },
      ],
    },
    { key: 'contactOutcome', label: 'Contact Outcome', type: 'text', placeholder: 'e.g. Parent promised payment' },
    { key: 'nextFollowUpDate', label: 'Next Follow-up Date', type: 'date' },
    { key: 'remarks', label: 'Remarks', type: 'text', placeholder: 'Follow-up notes...' },
  ],
};

// ---------------------------------------------------------------------------
// Catalog definitions (Pages 11 - 18)
// ---------------------------------------------------------------------------

const CATALOG = [
  {
    key: 'fees-collection-register',
    pageNumber: 11,
    module: 'Fee Management',
    category: 'Fee Management',
    categoryKey: 'Fee Management',
    rbacModule: 'Fee Management',
    rbacSubModule: 'reports',
    title: 'Fees — Fee Collection Register',
    purpose: 'List all posted fee receipts and collection totals.',
    signatures: ['Fee Clerk / Cashier', 'Accounts Officer', 'Principal'],
    filterSchema: [
      { key: 'dateFrom', label: 'Date from', type: 'date' },
      { key: 'dateTo', label: 'Date to', type: 'date' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'feeHeadId', label: 'Fee head', type: 'feeHead' },
      {
        key: 'paymentMode',
        label: 'Payment method',
        type: 'select',
        options: [
          { value: 'Cash', label: 'Cash' },
          { value: 'Bank Transfer', label: 'Bank Transfer' },
          { value: 'Online', label: 'Online' },
          { value: 'Cheque', label: 'Cheque' },
        ],
      },
      { key: 'cashierId', label: 'Cashier', type: 'cashier' },
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Receipt #, challan #, student...' },
    ],
  },
  {
    key: 'fees-student-ledger',
    pageNumber: 12,
    module: 'Fee Management',
    category: 'Fee Management',
    categoryKey: 'Fee Management',
    rbacModule: 'Fee Management',
    rbacSubModule: 'student-history',
    title: 'Fees — Individual Student Fee Ledger',
    purpose: 'Show every charge, installment, payment, waiver, refund and balance for one student.',
    signatures: ['Fee Clerk', 'Accounts Officer', 'Principal'],
    filterSchema: [
      { key: 'studentId', label: 'Student', type: 'student' },
      { key: 'sessionId', label: 'Academic session', type: 'session' },
      { key: 'feeHeadId', label: 'Fee head', type: 'feeHead' },
      { key: 'dateFrom', label: 'Date from', type: 'date' },
      { key: 'dateTo', label: 'Date to', type: 'date' },
    ],
  },
  {
    key: 'fees-installment-schedule',
    pageNumber: 13,
    module: 'Fee Management',
    category: 'Fee Management',
    categoryKey: 'Fee Management',
    rbacModule: 'Fee Management',
    rbacSubModule: 'installment-reports',
    title: 'Fees — Installment Schedule & Status',
    purpose: "View each student's installment plan, due dates and payment status.",
    signatures: ['Fee Clerk', 'Accounts Officer', 'Principal'],
    filterSchema: [
      { key: 'sessionId', label: 'Academic session', type: 'session' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'dateFrom', label: 'Due from', type: 'date' },
      { key: 'dateTo', label: 'Due to', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'PAID', label: 'PAID' },
          { value: 'PARTIAL', label: 'PARTIAL' },
          { value: 'OVERDUE', label: 'OVERDUE' },
          { value: 'PENDING', label: 'PENDING' },
        ],
      },
    ],
  },
  {
    key: 'fees-defaulters-overdue',
    pageNumber: 14,
    module: 'Fee Management',
    category: 'Fee Management',
    categoryKey: 'Fee Management',
    rbacModule: 'Fee Management',
    rbacSubModule: 'pending-reports',
    title: 'Fees — Defaulters & Overdue Installments',
    purpose: 'Identify overdue installment balances and prioritize follow-up.',
    signatures: ['Fee Clerk', 'Accounts Officer', 'Principal'],
    inlineActions: [REMINDER_ACTION_DEF],
    filterSchema: [
      { key: 'asOfDate', label: 'As of date', type: 'date' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'classId', label: 'Class', type: 'class' },
      { key: 'minOverdueDays', label: 'Min overdue days', type: 'number', defaultValue: 1, placeholder: '1' },
      { key: 'minBalance', label: 'Min balance (Rs)', type: 'number', placeholder: '0' },
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Student name, roll no...' },
    ],
  },
  {
    key: 'fees-upcoming-reminders',
    pageNumber: 15,
    module: 'Fee Management',
    category: 'Fee Management',
    categoryKey: 'Fee Management',
    rbacModule: 'Fee Management',
    rbacSubModule: 'reports',
    title: 'Fees — Upcoming Installment Reminder List',
    purpose: 'Prepare reminders for installments becoming due soon.',
    signatures: ['Fee Clerk', 'Accounts Officer'],
    inlineActions: [REMINDER_ACTION_DEF],
    filterSchema: [
      {
        key: 'dueWindowDays',
        label: 'Due window',
        type: 'select',
        defaultValue: '15',
        options: [
          { value: '7', label: 'Next 7 days' },
          { value: '15', label: 'Next 15 days' },
          { value: '30', label: 'Next 30 days' },
        ],
      },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'classId', label: 'Class', type: 'class' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'Upcoming', label: 'Upcoming (All Unpaid)' },
          { value: 'PENDING', label: 'Pending Only' },
          { value: 'PARTIAL', label: 'Partial Only' },
        ],
      },
    ],
  },
  {
    key: 'fees-receivables-ageing',
    pageNumber: 16,
    module: 'Fee Management',
    category: 'Fee Management',
    categoryKey: 'Fee Management',
    rbacModule: 'Fee Management',
    rbacSubModule: 'reports',
    title: 'Fees — Outstanding Receivables Ageing',
    purpose: 'Summarize unpaid balances by age to support cash-flow planning.',
    signatures: ['Accounts Officer', 'Finance Manager', 'Principal'],
    filterSchema: [
      { key: 'asOfDate', label: 'As of date', type: 'date' },
      { key: 'programId', label: 'Program', type: 'program' },
      { key: 'feeHeadId', label: 'Fee head', type: 'feeHead' },
    ],
  },
  {
    key: 'fees-discounts-concessions',
    pageNumber: 17,
    module: 'Fee Management',
    category: 'Fee Management',
    categoryKey: 'Fee Management',
    rbacModule: 'Fee Management',
    rbacSubModule: 'reports',
    title: 'Fees — Discounts, Scholarships & Concessions',
    purpose: 'Track fee reductions, approvals and their effect on receivables.',
    signatures: ['Accounts Officer', 'Principal'],
    inlineActions: [
      {
        name: 'create-concession',
        label: 'Add Concession',
        scope: 'report',
        fields: [
          { key: 'studentId', label: 'Student ID or Roll No.', type: 'text', placeholder: 'Enter Student ID or Roll No.' },
          {
            key: 'concessionType',
            label: 'Concession Type',
            type: 'select',
            defaultValue: 'SCHOLARSHIP',
            options: [
              { value: 'SCHOLARSHIP', label: 'Scholarship' },
              { value: 'SIBLING', label: 'Sibling' },
              { value: 'STAFF', label: 'Staff' },
              { value: 'MERIT', label: 'Merit' },
              { value: 'NEED_BASED', label: 'Need Based' },
              { value: 'SPECIAL', label: 'Special' },
            ],
          },
          { key: 'grossAmount', label: 'Gross Fee (Rs)', type: 'number', placeholder: '0' },
          { key: 'amount', label: 'Concession Amount (Rs)', type: 'number', placeholder: '0' },
          { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Reason / authority...' },
        ],
      },
      {
        name: 'approve-concession',
        label: 'Approve',
        scope: 'row',
        fields: [{ key: 'remarks', label: 'Approval Remarks', type: 'text', placeholder: 'Optional approval note...' }],
      },
      {
        name: 'reject-concession',
        label: 'Reject',
        scope: 'row',
        fields: [{ key: 'remarks', label: 'Rejection Reason', type: 'text', placeholder: 'Reason for rejection...' }],
      },
    ],
    filterSchema: [
      { key: 'sessionId', label: 'Academic session', type: 'session' },
      { key: 'programId', label: 'Program', type: 'program' },
      {
        key: 'concessionType',
        label: 'Concession type',
        type: 'select',
        options: [
          { value: 'SCHOLARSHIP', label: 'Scholarship' },
          { value: 'SIBLING', label: 'Sibling' },
          { value: 'STAFF', label: 'Staff' },
          { value: 'MERIT', label: 'Merit' },
          { value: 'NEED_BASED', label: 'Need Based' },
          { value: 'SPECIAL', label: 'Special' },
          { value: 'CHALLAN_DISCOUNT', label: 'Challan Discount' },
        ],
      },
      {
        key: 'approvalStatus',
        label: 'Approval status',
        type: 'select',
        options: [
          { value: 'APPROVED', label: 'APPROVED' },
          { value: 'PENDING', label: 'PENDING' },
          { value: 'REJECTED', label: 'REJECTED' },
        ],
      },
    ],
  },
  {
    key: 'fees-cashier-reconciliation',
    pageNumber: 18,
    module: 'Fee Management',
    category: 'Fee Management',
    categoryKey: 'Fee Management',
    rbacModule: 'Fee Management',
    rbacSubModule: 'reports',
    altRbacModule: 'Finance',
    altRbacSubModule: 'closing',
    title: 'Fees — Cashier & Payment Method Reconciliation',
    purpose: 'Reconcile receipts by cashier and payment method for a selected day.',
    signatures: ['Cashier', 'Accounts Officer', 'Finance Manager'],
    inlineActions: [
      {
        name: 'save-cashier-reconciliation',
        label: 'Close Counter',
        scope: 'row',
        fields: [
          { key: 'openingCash', label: 'Opening Cash (Rs)', type: 'number', defaultValue: 0, rowKey: '_openingCash' },
          { key: 'cashCounted', label: 'Counted Cash (Rs)', type: 'number', defaultValue: 0, rowKey: '_cashCounted' },
          { key: 'bankReference', label: 'Deposit Slip #', type: 'text', placeholder: 'Bank deposit slip #', rowKey: '_bankReference' },
          { key: 'remarks', label: 'Notes', type: 'text', placeholder: 'Variance / closing notes...' },
        ],
      },
    ],
    filterSchema: [
      { key: 'dateFrom', label: 'Date from', type: 'date' },
      { key: 'dateTo', label: 'Date to', type: 'date' },
      { key: 'cashierId', label: 'Cashier', type: 'cashier' },
      {
        key: 'receiptStatus',
        label: 'Receipt status',
        type: 'select',
        defaultValue: 'POSTED',
        options: [
          { value: 'POSTED', label: 'Posted Only' },
          { value: 'VOID', label: 'Void Only' },
          { value: 'ALL', label: 'All (Posted + Void)' },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Report Handlers
// ---------------------------------------------------------------------------

// Page 11: Fee Collection Register
async function buildCollectionRegister(query = {}, ctx = null) {
  await normalizeContext(ctx, query);
  const { start, end, startStr, endStr } = resolveDayBounds(query.dateFrom, query.dateTo, 90);
  const programIds = new Set(toObjectIds(query.programId).map(String));
  const paymentModes = parseMulti(query.paymentMode)
    .filter(m => !/^all$/i.test(m))
    .map(m => m.toLowerCase());
  const [cashierIds, headCtx, cashierOptions] = await Promise.all([
    resolveCashierUserIds(query.cashierId),
    loadFeeHeadFilterContext(query.feeHeadId),
    buildCashierOptions(),
  ]);
  const cashierSet = cashierIds ? new Set(cashierIds.map(String)) : null;

  const dateCond = {
    $or: [
      { paidDate: { $gte: start, $lte: end } },
      { paidDate: null, createdAt: { $gte: start, $lte: end } },
    ],
  };

  const [postedRaw, voidReceiptsRaw, voidChallansRaw] = await Promise.all([
    FeePaymentReceipt.find({
      status: { $ne: 'VOID' },
      receiptType: { $nin: ['ADVANCE_SETTLEMENT', 'ARREARS_SETTLEMENT'] },
      ...dateCond,
    })
      .populate({
        path: 'studentId',
        select: 'fName lName rollNumber programId',
        populate: { path: 'programId', select: 'name' },
      })
      .populate('challanId')
      .populate('recordedBy', 'name role email')
      .sort({ paidDate: -1, createdAt: -1 })
      .lean(),
    FeePaymentReceipt.find({
      status: 'VOID',
      $or: [
        { voidedAt: { $gte: start, $lte: end } },
        { paidDate: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
      ],
    })
      .populate({
        path: 'studentId',
        select: 'fName lName rollNumber programId',
        populate: { path: 'programId', select: 'name' },
      })
      .populate('challanId', 'challanNo')
      .sort({ voidedAt: -1, createdAt: -1 })
      .lean(),
    FeeChallan.find({
      status: 'VOID',
      updatedAt: { $gte: start, $lte: end },
    })
      .populate({
        path: 'studentId',
        select: 'fName lName rollNumber programId',
        populate: { path: 'programId', select: 'name' },
      })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const searchRegex = query.search && String(query.search).trim()
    ? buildFlexibleWhitespaceRegex(query.search)
    : null;

  const matchesCommonFilters = (student, extraTexts = []) => {
    if (programIds.size > 0) {
      const pid = String(student?.programId?._id || student?.programId || '');
      if (!programIds.has(pid)) return false;
    }
    if (searchRegex) {
      const hay = [
        fullName(student),
        student?.rollNumber,
        student?.programId?.name,
        ...extraTexts,
      ].filter(Boolean).join(' ');
      if (!searchRegex.test(hay)) return false;
    }
    return true;
  };

  const filteredPosted = [];
  const methodTotals = { Cash: 0, 'Bank Transfer': 0, Online: 0, Cheque: 0 };

  for (const r of postedRaw) {
    const student = r.studentId;
    const challan = r.challanId;
    const recById = String(r.recordedBy?._id || r.recordedBy || '');
    if (cashierSet && !cashierSet.has(recById)) continue;
    const modeRaw = String(r.paymentMode || 'Cash').trim();
    if (paymentModes.length > 0 && !paymentModes.some(pm => modeRaw.toLowerCase().includes(pm) || pm.includes(modeRaw.toLowerCase()))) {
      continue;
    }
    if (!challanMatchesFeeHead(challan, headCtx, r)) continue;
    if (!matchesCommonFilters(student, [r.receiptNo, challan?.challanNo, r.remarks, modeRaw])) continue;

    const amt = Number(r.amountPaid || 0);
    filteredPosted.push({ r, student, challan, amt, modeRaw });

    if (/online/i.test(modeRaw)) methodTotals.Online += amt;
    else if (/cheque|check/i.test(modeRaw)) methodTotals.Cheque += amt;
    else if (/bank|transfer/i.test(modeRaw)) methodTotals['Bank Transfer'] += amt;
    else methodTotals.Cash += amt;
  }

  const voidedReceipts = voidReceiptsRaw.filter(vr =>
    matchesCommonFilters(vr.studentId, [vr.receiptNo, vr.challanId?.challanNo, vr.voidReason])
  );
  const voidedChallans = voidChallansRaw.filter(vc =>
    matchesCommonFilters(vc.studentId, [vc.challanNo, vc.remarks])
  );

  const totalCollected = filteredPosted.reduce((s, x) => s + x.amt, 0);
  const receiptCount = filteredPosted.length;
  const avgReceipt = receiptCount > 0 ? Math.round(totalCollected / receiptCount) : 0;
  const voidedExcludedCount = voidedReceipts.length;

  const columns = [
    { key: 'receiptNo', label: 'Receipt no.', align: 'left' },
    { key: 'paidDate', label: 'Date', align: 'left' },
    { key: 'studentName', label: 'Student', align: 'left' },
    { key: 'programName', label: 'Program', align: 'left' },
    { key: 'feeHead', label: 'Fee head', align: 'left' },
    { key: 'amountPaid', label: 'Amount', align: 'right' },
    { key: 'paymentMode', label: 'Method', align: 'left' },
  ];

  const rows = filteredPosted.map(({ r, student, challan, amt, modeRaw }) => {
    const sid = student?._id ? String(student._id) : null;
    return {
      id: String(r._id),
      receiptNo: r.receiptNo,
      paidDate: formatDate(r.paidDate || r.createdAt),
      studentName: buildStudentDisplayName(student),
      programName: resolveProgramName(student),
      feeHead: extractChallanFeeHeadLabel(challan, r.challanType, r),
      amountPaid: formatRs(amt),
      paymentMode: modeRaw,
      drilldownKey: sid ? 'fees-student-ledger' : undefined,
      drilldownFilters: sid ? { studentId: sid } : undefined,
      _raw: { amountPaid: amt, paidDate: r.paidDate || r.createdAt, cashierName: r.recordedBy?.name || 'Counter' },
    };
  });

  const totalsRow = {
    receiptNo: 'TOTAL',
    paidDate: '',
    studentName: `${formatNum(receiptCount)} posted receipts`,
    programName: '',
    feeHead: '',
    amountPaid: formatRs(totalCollected),
    paymentMode: '',
  };

  const voidAuditRows = [
    ...voidedReceipts.map(vr => ({
      type: 'Voided Receipt',
      referenceNo: vr.receiptNo,
      date: formatDate(vr.voidedAt || vr.paidDate || vr.createdAt),
      studentName: buildStudentDisplayName(vr.studentId),
      amount: formatRs(vr.amountPaid || 0),
      reason: vr.voidReason || vr.remarks || 'Receipt voided',
    })),
    ...voidedChallans.map(vc => ({
      type: 'Voided Challan',
      referenceNo: vc.challanNo,
      date: formatDate(vc.updatedAt || vc.createdAt),
      studentName: buildStudentDisplayName(vc.studentId),
      amount: formatRs(vc.netPayable ?? vc.totalAmount ?? vc.amount ?? 0),
      reason: vc.remarks || 'Challan voided',
    })),
  ];

  const secondaryTables = [
    {
      title: 'Voided Receipts & Challans Audit — excluded from totals',
      columns: [
        { key: 'type', label: 'Type', align: 'left' },
        { key: 'referenceNo', label: 'Receipt / Challan no.', align: 'left' },
        { key: 'date', label: 'Date', align: 'left' },
        { key: 'studentName', label: 'Student', align: 'left' },
        { key: 'amount', label: 'Amount', align: 'right' },
        { key: 'reason', label: 'Reason / Remarks', align: 'left' },
      ],
      rows: voidAuditRows,
    },
  ];

  const chartData = Object.entries(methodTotals)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  const charts = chartData.length
    ? [{ type: 'bar', title: 'Collection by Payment Method', xKey: 'name', dataKey: 'value', data: chartData }]
    : [];

  const selectedFilters = await getFilterLabels(query, [
    { label: 'Date Range', value: `${startStr} to ${endStr}` },
    ...(paymentModes.length ? [{ label: 'Method', value: parseMulti(query.paymentMode).join(', ') }] : []),
    ...(headCtx ? [{ label: 'Fee Head', value: headCtx.labels.join(', ') }] : []),
    ...(query.search ? [{ label: 'Search', value: String(query.search).trim() }] : []),
  ]);

  const topMethod = chartData.sort((a, b) => b.value - a.value)[0];
  const insightMsg = receiptCount === 0
    ? `No posted fee receipts recorded between ${startStr} and ${endStr}.`
    : `Collected ${formatRs(totalCollected)} across ${formatNum(receiptCount)} posted receipts (avg ${formatRs(avgReceipt)}).${topMethod ? ` Top method: ${topMethod.name} (${formatRs(topMethod.value)}).` : ''} Excluded ${voidedReceipts.length} voided receipt(s) and ${voidedChallans.length} voided challan(s) from totals.`;

  return {
    selectedFilters,
    kpis: [
      { key: 'collected', label: 'Collected', value: formatRs(totalCollected), rawValue: totalCollected },
      { key: 'receipts', label: 'Receipts', value: formatNum(receiptCount), rawValue: receiptCount },
      { key: 'averageReceipt', label: 'Average receipt', value: formatRs(avgReceipt), rawValue: avgReceipt },
      { key: 'voidedExcluded', label: 'Voided receipts excluded', value: formatNum(voidedExcludedCount), rawValue: voidedExcludedCount },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables,
    charts,
    insight: {
      severity: voidedReceipts.length > 0 ? 'warning' : 'info',
      message: insightMsg,
    },
    rawExtra: {
      filterOptions: { cashierId: cashierOptions },
      totalCollected,
      receiptCount,
      avgReceipt,
      voidedExcludedCount,
      voidedChallansCount: voidedChallans.length,
    },
  };
}

// Page 12: Individual Student Fee Ledger
async function buildStudentLedger(query = {}, ctx = null) {
  await normalizeContext(ctx, query);
  const explicitSessId = getExplicitSessionObjectId(query);
  const headCtx = await loadFeeHeadFilterContext(query.feeHeadId);

  let student = null;
  if (query.studentId && mongoose.Types.ObjectId.isValid(query.studentId)) {
    student = await Student.findById(query.studentId)
      .populate('programId', 'name')
      .populate('classId', 'name')
      .populate('sessionId', 'name')
      .lean();
  } else if (query.studentId && String(query.studentId).trim()) {
    const cond = buildStudentSearchCondition(query.studentId);
    if (cond) {
      student = await Student.findOne(cond)
        .populate('programId', 'name')
        .populate('classId', 'name')
        .populate('sessionId', 'name')
        .lean();
    }
  } else {
    student = await Student.findOne(ACTIVE_STUDENT_FILTER)
      .sort({ rollNumber: 1 })
      .populate('programId', 'name')
      .populate('classId', 'name')
      .populate('sessionId', 'name')
      .lean();
    if (!student) {
      student = await Student.findOne()
        .sort({ createdAt: -1 })
        .populate('programId', 'name')
        .populate('classId', 'name')
        .populate('sessionId', 'name')
        .lean();
    }
  }

  const columns = [
    { key: 'date', label: 'Date', align: 'left' },
    { key: 'transaction', label: 'Transaction', align: 'left' },
    { key: 'installment', label: 'Installment', align: 'left' },
    { key: 'debit', label: 'Debit / billed', align: 'right' },
    { key: 'credit', label: 'Credit / paid', align: 'right' },
    { key: 'balance', label: 'Balance', align: 'right' },
  ];

  if (!student) {
    return {
      selectedFilters: [],
      kpis: [
        { key: 'totalBilled', label: 'Total billed', value: formatRs(0), rawValue: 0 },
        { key: 'approvedConcession', label: 'Approved concession', value: formatRs(0), rawValue: 0 },
        { key: 'paid', label: 'Paid', value: formatRs(0), rawValue: 0 },
        { key: 'outstanding', label: 'Outstanding', value: formatRs(0), rawValue: 0 },
      ],
      columns,
      rows: [],
      totalsRow: null,
      secondaryTables: [],
      charts: [],
      insight: { severity: 'info', message: 'No student record found for the selected ledger query.' },
      rawExtra: { openingBalance: 0, totalCharges: 0, totalCredits: 0, closingBalance: 0 },
    };
  }

  const sid = student._id;
  const challanSessionCond = explicitSessId
    ? { $or: [{ sessionId: explicitSessId }, { sessionId: null }, { sessionId: { $exists: false } }] }
    : {};

  const [allChallans, extraChallans, concessionReqs, refundedCredits] = await Promise.all([
    FeeChallan.find({ studentId: sid, ...challanSessionCond })
      .populate('challanHeads.headId', 'name isTuition')
      .sort({ createdAt: 1 })
      .lean(),
    ExtraChallan.find({ studentId: sid, status: { $nin: ['VOID', 'SUPERSEDED'] } })
      .sort({ createdAt: 1 })
      .lean(),
    FeeConcessionRequest.find({
      studentId: sid,
      ...(explicitSessId ? { $or: [{ sessionId: explicitSessId }, { sessionId: null }] } : {}),
    })
      .populate('approvedBy', 'name')
      .sort({ createdAt: 1 })
      .lean(),
    StudentCreditLedger.find({ studentId: sid, status: 'REFUNDED' }).sort({ updatedAt: 1 }).lean(),
  ]);

  const activeChallans = allChallans.filter(c => !['VOID', 'SUPERSEDED'].includes(String(c.status || '').toUpperCase()));
  const supersededIds = new Set(
    allChallans
      .filter(c => String(c.status || '').toUpperCase() === 'SUPERSEDED')
      .map(c => String(c._id))
  );
  const activeChallanIds = activeChallans.map(c => c._id);
  const extraIds = extraChallans.map(ec => ec._id);
  const activeIdSet = new Set(activeChallanIds.map(String));

  const receipts = await FeePaymentReceipt.find({
    status: { $ne: 'VOID' },
    receiptType: { $nin: ['ADVANCE_SETTLEMENT', 'ARREARS_SETTLEMENT'] },
    $or: [
      { studentId: sid },
      ...(activeChallanIds.length ? [{ challanId: { $in: activeChallanIds } }] : []),
      ...(extraIds.length ? [{ challanId: { $in: extraIds } }] : []),
    ],
  })
    .populate('challanId')
    .sort({ paidDate: 1, createdAt: 1 })
    .lean();

  // Keep only receipts belonging to non-void/non-superseded challans (or orphan direct student receipts)
  const voidOrSupersededIds = new Set(
    allChallans
      .filter(c => ['VOID', 'SUPERSEDED'].includes(String(c.status || '').toUpperCase()))
      .map(c => String(c._id))
  );

  const entries = [];
  let totalChallanDiscountCredits = 0;

  // 1. FeeChallan charges & challan-level discounts
  for (const ch of activeChallans) {
    if (!challanMatchesFeeHead(ch, headCtx)) continue;
    const base = Number(ch.basePayable ?? ch.amount ?? 0);
    const heads = Number(ch.headsAmount ?? (Array.isArray(ch.challanHeads)
      ? ch.challanHeads.reduce((s, h) => s + Number(h.amount || 0), 0)
      : (Array.isArray(ch.selectedHeads) ? ch.selectedHeads.reduce((s, h) => s + Number(h?.amount || 0), 0) : 0)));
    const late = Number(ch.lateFeeAmount ?? ch.fineAmount ?? 0);

    // If this challan carries arrears from a SUPERSEDED challan (or unbilled installment), include only non-active arrears
    let unbilledOrSupersededArrears = 0;
    if (Array.isArray(ch.arrearAllocations) && ch.arrearAllocations.length > 0) {
      for (const alloc of ch.arrearAllocations) {
        const srcId = alloc.sourceChallanId ? String(alloc.sourceChallanId) : '';
        if (!srcId || supersededIds.has(srcId) || !activeIdSet.has(srcId)) {
          unbilledOrSupersededArrears += Number(alloc.amountCarriedForward || 0);
        }
      }
    } else if (Number(ch.arrearsAmount || 0) > 0 && Array.isArray(ch.supersedes) && ch.supersedes.some(id => supersededIds.has(String(id)))) {
      unbilledOrSupersededArrears = Number(ch.arrearsAmount || 0);
    }

    const debitAmt = Math.max(0, base + heads + late + unbilledOrSupersededArrears);
    const instLabel = ch.installmentNumber
      ? `Inst #${ch.installmentNumber}${ch.month ? ` (${ch.month})` : ''}`
      : (ch.month || 'Challan');
    const chargeDate = ch.createdAt || ch.dueDate || new Date();

    if (debitAmt > 0) {
      entries.push({
        dt: new Date(chargeDate),
        order: 1,
        kind: 'CHARGE',
        transaction: `Challan #${ch.challanNo}${late > 0 ? ` (incl. Rs ${Math.round(late)} late fee)` : ''}`,
        installment: instLabel,
        debit: debitAmt,
        credit: 0,
      });
    }

    const disc = Number(ch.discountAmount ?? ch.discount ?? 0);
    if (disc > 0) {
      totalChallanDiscountCredits += disc;
      entries.push({
        dt: new Date(chargeDate),
        order: 2,
        kind: 'CONCESSION',
        transaction: ch.isScholarship100
          ? `100% Scholarship — Challan #${ch.challanNo}`
          : `Challan Discount / Waiver — #${ch.challanNo}`,
        installment: instLabel,
        debit: 0,
        credit: disc,
      });
    }
  }

  // 2. ExtraChallan charges & discounts
  for (const ec of extraChallans) {
    if (!challanMatchesFeeHead(ec, headCtx)) continue;
    const chargeAmt = Math.max(0, Number(ec.amount || 0) + Number(ec.lateFeeFine || 0));
    const ecDate = ec.createdAt || ec.dueDate || new Date();
    if (chargeAmt > 0) {
      entries.push({
        dt: new Date(ecDate),
        order: 1,
        kind: 'CHARGE',
        transaction: `Extra Challan #${ec.challanNo}${ec.remarks ? ` — ${ec.remarks}` : ''}`,
        installment: 'Extra Challan',
        debit: chargeAmt,
        credit: 0,
      });
    }
    const ecDisc = Number(ec.discount || 0);
    if (ecDisc > 0) {
      totalChallanDiscountCredits += ecDisc;
      entries.push({
        dt: new Date(ecDate),
        order: 2,
        kind: 'CONCESSION',
        transaction: `Extra Challan Discount — #${ec.challanNo}`,
        installment: 'Extra Challan',
        debit: 0,
        credit: ecDisc,
      });
    }
  }

  // 3. Approved FeeConcessionRequest credits (NEVER include PENDING or REJECTED in ledger balance!)
  const pendingConcessions = [];
  const rejectedConcessions = [];
  for (const cr of concessionReqs) {
    const st = String(cr.status || 'PENDING').toUpperCase();
    if (st === 'PENDING') {
      pendingConcessions.push(cr);
      continue;
    }
    if (st === 'REJECTED') {
      rejectedConcessions.push(cr);
      continue;
    }
    if (st === 'APPROVED') {
      if (headCtx && !headCtx.includesTuition) continue;
      const amt = Number(cr.amount || 0);
      // Avoid double counting if auto-created duplicate of student 100% scholarship already on challans
      if (
        student.isScholarship100 &&
        cr.concessionType === 'SCHOLARSHIP' &&
        totalChallanDiscountCredits > 0 &&
        Math.abs(totalChallanDiscountCredits - amt) < 1
      ) {
        continue;
      }
      if (amt > 0) {
        entries.push({
          dt: new Date(cr.approvedAt || cr.updatedAt || cr.createdAt || new Date()),
          order: 2,
          kind: 'CONCESSION',
          transaction: `Approved Concession (${cr.concessionType})${cr.reason ? ` — ${cr.reason}` : ''}`,
          installment: 'Waiver / Concession',
          debit: 0,
          credit: amt,
        });
      }
    }
  }

  // 4. FeePaymentReceipt credits (+ fallback if a challan had direct paidAmount with missing receipts)
  const receiptsByChallan = new Map();
  for (const r of receipts) {
    const chId = String(r.challanId?._id || r.challanId || '');
    if (chId && voidOrSupersededIds.has(chId)) continue;
    if (headCtx && !challanMatchesFeeHead(r.challanId, headCtx, r)) continue;
    const amt = Number(r.amountPaid || 0);
    if (amt <= 0) continue;

    if (chId) receiptsByChallan.set(chId, (receiptsByChallan.get(chId) || 0) + amt);
    const chObj = typeof r.challanId === 'object' ? r.challanId : null;
    entries.push({
      dt: new Date(r.paidDate || r.createdAt || new Date()),
      order: 3,
      kind: 'PAYMENT',
      transaction: `Payment Receipt #${r.receiptNo} (${r.paymentMode || 'Cash'})${chObj?.challanNo ? ` — Challan #${chObj.challanNo}` : ''}`,
      installment: chObj?.installmentNumber ? `Inst #${chObj.installmentNumber}` : (chObj?.month || 'Payment'),
      debit: 0,
      credit: amt,
    });
  }

  for (const ch of activeChallans) {
    if (!challanMatchesFeeHead(ch, headCtx)) continue;
    const paidAmt = Number(ch.paidAmount || 0);
    const recSum = receiptsByChallan.get(String(ch._id)) || 0;
    const gap = paidAmt - recSum;
    if (gap > 0.5) {
      entries.push({
        dt: new Date(ch.paidDate || ch.updatedAt || ch.createdAt || new Date()),
        order: 3,
        kind: 'PAYMENT',
        transaction: `Direct Challan Payment (${ch.paymentMode || ch.paidBy || 'Cash'}) — #${ch.challanNo}`,
        installment: ch.installmentNumber ? `Inst #${ch.installmentNumber}` : (ch.month || 'Payment'),
        debit: 0,
        credit: gap,
      });
    }
  }
  for (const ec of extraChallans) {
    if (!challanMatchesFeeHead(ec, headCtx)) continue;
    const paidAmt = Number(ec.paidAmount || 0);
    const recSum = receiptsByChallan.get(String(ec._id)) || 0;
    const gap = paidAmt - recSum;
    if (gap > 0.5) {
      entries.push({
        dt: new Date(ec.paidDate || ec.updatedAt || ec.createdAt || new Date()),
        order: 3,
        kind: 'PAYMENT',
        transaction: `Direct Extra Challan Payment (${ec.paymentMode || ec.paidBy || 'Cash'}) — #${ec.challanNo}`,
        installment: 'Extra Challan',
        debit: 0,
        credit: gap,
      });
    }
  }

  // 5. StudentCreditLedger refunds (status === 'REFUNDED' reverses prior overpayment credit -> Debit)
  for (const cl of refundedCredits) {
    if (headCtx && !headCtx.includesTuition) continue;
    const allocatedSum = (cl.allocations || []).reduce((s, a) => s + Number(a.amountApplied || 0), 0);
    const refundAmt = Number(cl.remainingAmount > 0 ? cl.remainingAmount : Math.max(0, Number(cl.amount || 0) - allocatedSum));
    if (refundAmt > 0) {
      entries.push({
        dt: new Date(cl.updatedAt || cl.createdAt || new Date()),
        order: 4,
        kind: 'REFUND',
        transaction: `Credit Refund Issued${cl.sourceChallanNo ? ` (Ref Challan #${cl.sourceChallanNo})` : ''}${cl.notes ? ` — ${cl.notes}` : ''}`,
        installment: 'Refund',
        debit: refundAmt,
        credit: 0,
      });
    }
  }

  // Sort strictly chronologically
  entries.sort((a, b) => (a.dt.getTime() - b.dt.getTime()) || (a.order - b.order));

  // Apply optional dateFrom / dateTo cleanly while preserving exact openingBalance + totalCharges - totalCredits = closingBalance
  const hasFrom = Boolean(query.dateFrom);
  const hasTo = Boolean(query.dateTo);
  const fromBound = hasFrom ? new Date(query.dateFrom) : null;
  if (fromBound) fromBound.setHours(0, 0, 0, 0);
  const toBound = hasTo ? new Date(query.dateTo) : null;
  if (toBound) toBound.setHours(23, 59, 59, 999);

  let openingBalance = 0;
  const visibleEntries = [];
  for (const e of entries) {
    const t = e.dt.getTime();
    if (fromBound && t < fromBound.getTime()) {
      openingBalance += e.debit - e.credit;
      continue;
    }
    if (toBound && t > toBound.getTime()) continue;
    visibleEntries.push(e);
  }

  let runningBalance = openingBalance;
  let totalCharges = 0;
  let totalCredits = 0;
  let totalFeeBilled = 0;
  let totalConcession = 0;
  let totalPaid = 0;
  let totalRefunded = 0;

  const rows = [];
  if (hasFrom && openingBalance !== 0) {
    rows.push({
      date: formatDate(fromBound),
      transaction: 'Opening Balance Brought Forward',
      installment: 'B/F',
      debit: '—',
      credit: '—',
      balance: formatRs(openingBalance),
      _raw: { debit: 0, credit: 0, balance: openingBalance, kind: 'OPENING' },
    });
  }

  for (const e of visibleEntries) {
    runningBalance += e.debit - e.credit;
    totalCharges += e.debit;
    totalCredits += e.credit;
    if (e.kind === 'CHARGE') totalFeeBilled += e.debit;
    else if (e.kind === 'REFUND') totalRefunded += e.debit;
    else if (e.kind === 'CONCESSION') totalConcession += e.credit;
    else if (e.kind === 'PAYMENT') totalPaid += e.credit;

    rows.push({
      date: formatDate(e.dt),
      transaction: e.transaction,
      installment: e.installment,
      debit: e.debit > 0 ? formatRs(e.debit) : '—',
      credit: e.credit > 0 ? formatRs(e.credit) : '—',
      balance: formatRs(runningBalance),
      _raw: { debit: e.debit, credit: e.credit, balance: runningBalance, kind: e.kind },
    });
  }

  const closingBalance = openingBalance + totalCharges - totalCredits;

  const totalsRow = {
    date: '',
    transaction: `Closing Balance — ${buildStudentDisplayName(student)}`,
    installment: hasFrom ? `Opening: ${formatRs(openingBalance)}` : '',
    debit: formatRs(totalCharges),
    credit: formatRs(totalCredits),
    balance: formatRs(closingBalance),
  };

  const pendingTotalAmt = pendingConcessions.reduce((s, p) => s + Number(p.amount || 0), 0);
  const secondaryTables = [];
  if (pendingConcessions.length > 0 || rejectedConcessions.length > 0) {
    secondaryTables.push({
      title: 'Pending / Rejected Concession Requests — NOT subtracted from student balance',
      columns: [
        { key: 'type', label: 'Type', align: 'left' },
        { key: 'amount', label: 'Requested amount', align: 'right' },
        { key: 'status', label: 'Status', align: 'left' },
        { key: 'reason', label: 'Reason', align: 'left' },
        { key: 'date', label: 'Requested on', align: 'left' },
      ],
      rows: [...pendingConcessions, ...rejectedConcessions].map(cr => ({
        type: cr.concessionType,
        amount: formatRs(cr.amount || 0),
        status: cr.status,
        reason: cr.reason || '—',
        date: formatDate(cr.createdAt),
      })),
    });
  }

  const selectedFilters = await getFilterLabels(query, [
    { label: 'Student', value: buildStudentDisplayName(student) },
    { label: 'Program / Class', value: `${resolveProgramName(student)} / ${resolveClassName(student)}` },
    ...(hasFrom || hasTo ? [{ label: 'Date Range', value: `${hasFrom ? query.dateFrom : 'Start'} to ${hasTo ? query.dateTo : 'Today'}` }] : []),
    ...(headCtx ? [{ label: 'Fee Head', value: headCtx.labels.join(', ') }] : []),
  ]);

  const pendingNote = pendingConcessions.length > 0
    ? ` Note: ${pendingConcessions.length} PENDING concession request(s) totaling ${formatRs(pendingTotalAmt)} are excluded and NOT deducted from the student's balance until approved.`
    : '';

  return {
    selectedFilters,
    kpis: [
      { key: 'totalBilled', label: 'Total billed', value: formatRs(totalFeeBilled + totalRefunded), rawValue: totalFeeBilled + totalRefunded },
      { key: 'approvedConcession', label: 'Approved concession', value: formatRs(totalConcession), rawValue: totalConcession },
      { key: 'paid', label: 'Paid', value: formatRs(totalPaid), rawValue: totalPaid },
      { key: 'outstanding', label: 'Outstanding', value: formatRs(closingBalance), rawValue: closingBalance },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables,
    charts: [],
    insight: {
      severity: closingBalance > 0 || pendingConcessions.length > 0 ? 'warning' : 'info',
      message: `${buildStudentDisplayName(student)}: Opening ${formatRs(openingBalance)} + Charges ${formatRs(totalCharges)} - Credits ${formatRs(totalCredits)} = Closing balance ${formatRs(closingBalance)}.${pendingNote}`,
    },
    rawExtra: {
      studentId: String(sid),
      openingBalance,
      totalCharges,
      totalCredits,
      closingBalance,
      totalFeeBilled,
      totalConcession,
      totalPaid,
      totalRefunded,
      pendingConcessionCount: pendingConcessions.length,
      pendingConcessionAmount: pendingTotalAmt,
    },
  };
}

// Page 13: Installment Schedule & Status
async function buildInstallmentSchedule(query = {}, ctx = null) {
  await normalizeContext(ctx, query);
  const { items } = await collectActiveStudentObligations(query, { includeExtraChallans: false });

  const hasFrom = Boolean(query.dateFrom);
  const hasTo = Boolean(query.dateTo);
  const fromMs = hasFrom ? toDayUtcMs(query.dateFrom) : null;
  const toMs = hasTo ? toDayUtcMs(query.dateTo) : null;
  const statusValues = parseMulti(query.status)
    .filter(s => !/^all$/i.test(s))
    .map(s => s.trim().toUpperCase());

  const dateFiltered = items.filter(it => {
    if (!fromMs && !toMs) return true;
    const dueMs = toDayUtcMs(it.dueDate);
    if (dueMs == null) return false;
    if (fromMs && dueMs < fromMs) return false;
    if (toMs && dueMs > toMs) return false;
    return true;
  });

  const finalItems = statusValues.length > 0
    ? dateFiltered.filter(it => statusValues.includes(it.status))
    : dateFiltered;

  finalItems.sort((a, b) => {
    const da = toDayUtcMs(a.dueDate) || 0;
    const db = toDayUtcMs(b.dueDate) || 0;
    if (da !== db) return da - db;
    return String(a.student?.rollNumber || '').localeCompare(String(b.student?.rollNumber || ''));
  });

  let paidCount = 0;
  let partialCount = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  let totalDueAmt = 0;
  let totalPaidAmt = 0;
  let totalBalanceAmt = 0;

  for (const it of finalItems) {
    totalDueAmt += it.amountDue;
    totalPaidAmt += it.paidAmount;
    totalBalanceAmt += it.balance;
    if (it.status === 'PAID') paidCount++;
    else if (it.status === 'PARTIAL') partialCount++;
    else if (it.status === 'OVERDUE') overdueCount++;
    else pendingCount++;
  }

  const columns = [
    { key: 'studentName', label: 'Student', align: 'left' },
    { key: 'programName', label: 'Program', align: 'left' },
    { key: 'installmentNumber', label: 'Inst. no.', align: 'right' },
    { key: 'dueDate', label: 'Due date', align: 'left' },
    { key: 'amountDue', label: 'Amount due', align: 'right' },
    { key: 'paidAmount', label: 'Paid', align: 'right' },
    { key: 'balance', label: 'Balance', align: 'right' },
    { key: 'status', label: 'Status', align: 'left' },
  ];

  const rows = finalItems.map((it, idx) => ({
    id: `${it.studentId}-${it.challanId || it.installmentNumber || idx}`,
    studentName: buildStudentDisplayName(it.student),
    programName: resolveProgramName(it.student),
    installmentNumber: it.installmentNumber ?? '—',
    dueDate: formatDate(it.dueDate),
    amountDue: formatRs(it.amountDue),
    paidAmount: formatRs(it.paidAmount),
    balance: formatRs(it.balance),
    status: it.status,
    drilldownKey: 'fees-student-ledger',
    drilldownFilters: { studentId: it.studentId },
    _raw: {
      amountDue: it.amountDue,
      paidAmount: it.paidAmount,
      balance: it.balance,
      status: it.status,
    },
  }));

  const totalsRow = {
    studentName: 'TOTAL',
    programName: `${formatNum(finalItems.length)} installments`,
    installmentNumber: '',
    dueDate: '',
    amountDue: formatRs(totalDueAmt),
    paidAmount: formatRs(totalPaidAmt),
    balance: formatRs(totalBalanceAmt),
    status: '',
  };

  const chartData = [
    { name: 'PAID', value: paidCount },
    { name: 'PARTIAL', value: partialCount },
    { name: 'OVERDUE', value: overdueCount },
    { name: 'PENDING', value: pendingCount },
  ].filter(d => d.value > 0);

  const selectedFilters = await getFilterLabels(query, [
    ...(hasFrom || hasTo ? [{ label: 'Due Date Range', value: `${hasFrom ? query.dateFrom : 'Start'} to ${hasTo ? query.dateTo : 'Any'}` }] : []),
    ...(statusValues.length > 0 ? [{ label: 'Status', value: statusValues.join(', ') }] : []),
  ]);

  return {
    selectedFilters,
    kpis: [
      { key: 'scheduled', label: 'Installments scheduled', value: formatNum(finalItems.length), rawValue: finalItems.length },
      { key: 'paid', label: 'Paid', value: formatNum(paidCount), rawValue: paidCount },
      { key: 'partial', label: 'Partial', value: formatNum(partialCount), rawValue: partialCount },
      { key: 'overdue', label: 'Overdue / due', value: formatNum(overdueCount), rawValue: overdueCount },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables: [],
    charts: chartData.length ? [{ type: 'pie', title: 'Installment Status Distribution', nameKey: 'name', dataKey: 'value', data: chartData }] : [],
    insight: {
      severity: overdueCount > 0 || partialCount > 0 ? 'warning' : 'info',
      message: `${formatNum(finalItems.length)} installment(s) scheduled: ${paidCount} paid, ${partialCount} partial (${formatRs(totalBalanceAmt)} unpaid remaining across open/partial plans), ${overdueCount} overdue, ${pendingCount} pending.`,
    },
    rawExtra: {
      totalScheduled: finalItems.length,
      paidCount,
      partialCount,
      overdueCount,
      pendingCount,
      totalDueAmt,
      totalPaidAmt,
      totalBalanceAmt,
    },
  };
}

// Page 14: Defaulters & Overdue Installments
async function buildDefaultersOverdue(query = {}, ctx = null) {
  await normalizeContext(ctx, query);
  const asOfRef = query.asOfDate ? new Date(query.asOfDate) : new Date();
  const minOverdueDays = Math.max(1, Number(query.minOverdueDays ?? 1));
  const minBalance = Math.max(0, Number(query.minBalance ?? 0));

  const { students, items } = await collectActiveStudentObligations(query, {
    includeExtraChallans: true,
    asOfRefDate: asOfRef,
  });

  const reminderCtx = await loadLatestReminderMap(students.map(s => s._id));

  const overdueItems = [];
  for (const it of items) {
    if (it.balance <= 0 || it.balance < minBalance) continue;
    const daysOverdue = dayDiff(asOfRef, it.dueDate);
    if (daysOverdue < minOverdueDays) continue;
    const latestReminder = pickLatestReminder(reminderCtx, it.studentId, it.challanId, it.installmentNumber);
    overdueItems.push({ ...it, daysOverdue, latestReminder });
  }

  overdueItems.sort((a, b) => (b.daysOverdue - a.daysOverdue) || (b.balance - a.balance));

  const uniqueStudents = new Set(overdueItems.map(i => i.studentId));
  let totalDue = 0;
  let totalPaid = 0;
  let totalOverdueBalance = 0;
  let over30Count = 0;

  for (const it of overdueItems) {
    totalDue += it.amountDue;
    totalPaid += it.paidAmount;
    totalOverdueBalance += it.balance;
    if (it.daysOverdue > 30) over30Count++;
  }

  const columns = [
    { key: 'studentName', label: 'Student', align: 'left' },
    { key: 'programName', label: 'Program', align: 'left' },
    { key: 'guardianPhone', label: 'Guardian contact', align: 'left' },
    { key: 'dueDate', label: 'Due date', align: 'left' },
    { key: 'daysOverdue', label: 'Days overdue', align: 'right' },
    { key: 'amountDue', label: 'Due', align: 'right' },
    { key: 'paidAmount', label: 'Paid', align: 'right' },
    { key: 'balance', label: 'Balance', align: 'right' },
  ];

  const rows = overdueItems.map((it, idx) => ({
    id: `${it.studentId}-${it.challanId || it.installmentNumber || idx}`,
    studentName: buildStudentDisplayName(it.student),
    programName: resolveProgramName(it.student),
    guardianPhone: it.student?.parentOrGuardianPhone || '—',
    dueDate: formatDate(it.dueDate),
    daysOverdue: it.daysOverdue,
    amountDue: formatRs(it.amountDue),
    paidAmount: formatRs(it.paidAmount),
    balance: formatRs(it.balance),
    drilldownKey: 'fees-student-ledger',
    drilldownFilters: { studentId: it.studentId },
    actionContext: {
      studentId: it.studentId,
      challanId: it.challanId,
      installmentNumber: it.installmentNumber,
    },
    _raw: {
      daysOverdue: it.daysOverdue,
      amountDue: it.amountDue,
      paidAmount: it.paidAmount,
      balance: it.balance,
      latestReminderStatus: it.latestReminder?.status || 'NOT_SENT',
      latestReminderChannel: it.latestReminder?.channel || '',
    },
  }));

  const totalsRow = {
    studentName: 'TOTAL',
    programName: `${formatNum(uniqueStudents.size)} students`,
    guardianPhone: '',
    dueDate: '',
    daysOverdue: '',
    amountDue: formatRs(totalDue),
    paidAmount: formatRs(totalPaid),
    balance: formatRs(totalOverdueBalance),
  };

  const secondaryTables = [
    {
      title: 'Follow-up & Reminder Log Status',
      columns: [
        { key: 'studentName', label: 'Student', align: 'left' },
        { key: 'balance', label: 'Overdue balance', align: 'right' },
        { key: 'channel', label: 'Last channel', align: 'left' },
        { key: 'status', label: 'Reminder status', align: 'left' },
        { key: 'outcome', label: 'Outcome / Next follow-up', align: 'left' },
      ],
      rows: overdueItems.map(it => ({
        studentName: buildStudentDisplayName(it.student),
        balance: formatRs(it.balance),
        channel: it.latestReminder?.channel || '—',
        status: it.latestReminder?.status || 'NOT_SENT',
        outcome: it.latestReminder
          ? [it.latestReminder.contactOutcome, it.latestReminder.nextFollowUpDate ? `Next: ${formatDate(it.latestReminder.nextFollowUpDate)}` : ''].filter(Boolean).join(' · ') || 'Logged'
          : 'No reminder logged yet',
      })),
    },
  ];

  const selectedFilters = await getFilterLabels(query, [
    { label: 'As of Date', value: toYmd(asOfRef) },
    { label: 'Min Overdue Days', value: String(minOverdueDays) },
    ...(minBalance > 0 ? [{ label: 'Min Balance', value: formatRs(minBalance) }] : []),
    ...(query.search ? [{ label: 'Search', value: String(query.search).trim() }] : []),
  ]);

  return {
    selectedFilters,
    kpis: [
      { key: 'overdueInstallments', label: 'Overdue installments', value: formatNum(overdueItems.length), rawValue: overdueItems.length },
      { key: 'overdueBalance', label: 'Overdue balance', value: formatRs(totalOverdueBalance), rawValue: totalOverdueBalance },
      { key: 'studentsAffected', label: 'Students affected', value: formatNum(uniqueStudents.size), rawValue: uniqueStudents.size },
      { key: 'over30Days', label: 'Over 30 days', value: formatNum(over30Count), rawValue: over30Count },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables,
    charts: [],
    insight: {
      severity: overdueItems.length > 0 ? 'warning' : 'info',
      message: overdueItems.length === 0
        ? `No overdue installments found as of ${toYmd(asOfRef)} (>= ${minOverdueDays} days overdue).`
        : `${formatNum(overdueItems.length)} overdue installment(s) totaling ${formatRs(totalOverdueBalance)} across ${uniqueStudents.size} student(s); ${over30Count} item(s) are overdue by more than 30 days.`,
    },
    rawExtra: {
      asOfDate: toYmd(asOfRef),
      totalOverdueBalance,
      studentsAffected: uniqueStudents.size,
      over30Count,
    },
  };
}

// Page 15: Upcoming Installment Reminder List
async function buildUpcomingReminders(query = {}, ctx = null) {
  await normalizeContext(ctx, query);
  const windowDays = Math.max(1, Number(query.dueWindowDays || 15));
  const todayRef = new Date();
  const todayUtcMs = toDayUtcMs(todayRef);
  const windowEndUtcMs = todayUtcMs + windowDays * 86400000;
  const statusValues = parseMulti(query.status)
    .filter(s => !['all', 'upcoming', 'unpaid'].includes(s.toLowerCase()))
    .map(s => s.trim().toUpperCase());

  const { students, items } = await collectActiveStudentObligations(query, {
    includeExtraChallans: true,
    asOfRefDate: todayRef,
  });

  const reminderCtx = await loadLatestReminderMap(students.map(s => s._id));
  const upcomingItems = [];

  for (const it of items) {
    if (it.balance <= 0) continue;
    const dueMs = toDayUtcMs(it.dueDate);
    // CRITICAL RULE: strictly todayStart <= dueDate <= windowEnd; NEVER include overdue items!
    if (dueMs == null || dueMs < todayUtcMs || dueMs > windowEndUtcMs) continue;
    const displayStatus = it.paidAmount > 0 ? 'PARTIAL' : 'PENDING';
    if (statusValues.length > 0 && !statusValues.includes(displayStatus)) continue;
    const latestReminder = pickLatestReminder(reminderCtx, it.studentId, it.challanId, it.installmentNumber);
    upcomingItems.push({ ...it, displayStatus, latestReminder });
  }

  upcomingItems.sort((a, b) => (toDayUtcMs(a.dueDate) - toDayUtcMs(b.dueDate)) || (b.balance - a.balance));

  const uniqueStudents = new Set(upcomingItems.map(i => i.studentId));
  const totalDueInWindow = upcomingItems.reduce((s, i) => s + i.balance, 0);
  const loggedAttemptsCount = upcomingItems.filter(i => i.latestReminder && i.latestReminder.status !== 'NOT_SENT').length;

  const columns = [
    { key: 'studentName', label: 'Student', align: 'left' },
    { key: 'programName', label: 'Program', align: 'left' },
    { key: 'guardianPhone', label: 'Guardian', align: 'left' },
    { key: 'dueDate', label: 'Due date', align: 'left' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'reminderChannel', label: 'Reminder channel', align: 'left' },
    { key: 'reminderStatus', label: 'Reminder status', align: 'left' },
  ];

  const rows = upcomingItems.map((it, idx) => ({
    id: `${it.studentId}-${it.challanId || it.installmentNumber || idx}`,
    studentName: buildStudentDisplayName(it.student),
    programName: resolveProgramName(it.student),
    guardianPhone: it.student?.parentOrGuardianPhone || '—',
    dueDate: formatDate(it.dueDate),
    amount: formatRs(it.balance),
    reminderChannel: it.latestReminder?.channel || '—',
    reminderStatus: it.latestReminder?.status || 'Not sent',
    drilldownKey: 'fees-student-ledger',
    drilldownFilters: { studentId: it.studentId },
    actionContext: {
      studentId: it.studentId,
      challanId: it.challanId,
      installmentNumber: it.installmentNumber,
    },
    _raw: {
      amount: it.balance,
      status: it.displayStatus,
      dueDate: it.dueDate,
    },
  }));

  const totalsRow = {
    studentName: 'TOTAL',
    programName: `${formatNum(uniqueStudents.size)} students`,
    guardianPhone: '',
    dueDate: '',
    amount: formatRs(totalDueInWindow),
    reminderChannel: '',
    reminderStatus: `${loggedAttemptsCount} logged`,
  };

  const selectedFilters = await getFilterLabels(query, [
    { label: 'Due Window', value: `Next ${windowDays} days (${toYmd(todayRef)} to ${toYmd(new Date(windowEndUtcMs))})` },
    ...(statusValues.length > 0 ? [{ label: 'Status', value: statusValues.join(', ') }] : []),
  ]);

  return {
    selectedFilters,
    kpis: [
      { key: 'upcomingInstallments', label: 'Upcoming installments', value: formatNum(upcomingItems.length), rawValue: upcomingItems.length },
      { key: 'dueInWindow', label: 'Due in window', value: formatRs(totalDueInWindow), rawValue: totalDueInWindow },
      { key: 'studentsToNotify', label: 'Students to notify', value: formatNum(uniqueStudents.size), rawValue: uniqueStudents.size },
      { key: 'reminderAttempts', label: 'Reminder attempts logged', value: formatNum(loggedAttemptsCount), rawValue: loggedAttemptsCount },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables: [],
    charts: [],
    insight: {
      severity: 'info',
      message: `${formatNum(upcomingItems.length)} upcoming installment(s) totaling ${formatRs(totalDueInWindow)} are due within the next ${windowDays} days across ${uniqueStudents.size} student(s). ${loggedAttemptsCount} reminder(s) already logged.`,
    },
    rawExtra: {
      windowDays,
      totalDueInWindow,
      studentsToNotify: uniqueStudents.size,
      reminderAttemptsLogged: loggedAttemptsCount,
    },
  };
}

// Page 16: Outstanding Receivables Ageing
async function buildReceivablesAgeing(query = {}, ctx = null) {
  await normalizeContext(ctx, query);
  const asOfRef = query.asOfDate ? new Date(query.asOfDate) : new Date();
  const { items, headCtx } = await collectActiveStudentObligations(query, {
    includeExtraChallans: true,
    asOfRefDate: asOfRef,
  });

  const bucketDefs = [
    { key: 'notYetDue', label: 'Not yet due', priority: 'Monitor', min: -Infinity, max: 0 },
    { key: 'days1To30', label: '1–30 days', priority: 'Reminder', min: 1, max: 30 },
    { key: 'days31To60', label: '31–60 days', priority: 'Follow-up', min: 31, max: 60 },
    { key: 'days61Plus', label: '61+ days', priority: 'Escalate', min: 61, max: Infinity },
  ];

  const bucketMap = new Map(
    bucketDefs.map(b => [b.key, { ...b, students: new Set(), amount: 0 }])
  );
  const breakdownMap = new Map();
  const allUnpaidStudents = new Set();

  for (const it of items) {
    if (it.balance <= 0) continue;
    const bal = Number(it.balance);
    allUnpaidStudents.add(it.studentId);
    const daysOverdue = it.dueDate ? dayDiff(asOfRef, it.dueDate) : 0;

    let matchedKey = 'notYetDue';
    if (daysOverdue >= 61) matchedKey = 'days61Plus';
    else if (daysOverdue >= 31) matchedKey = 'days31To60';
    else if (daysOverdue >= 1) matchedKey = 'days1To30';

    const b = bucketMap.get(matchedKey);
    b.amount += bal;
    b.students.add(it.studentId);

    const pName = resolveProgramName(it.student);
    const cName = resolveClassName(it.student);
    const bk = `${pName}::${cName}`;
    if (!breakdownMap.has(bk)) {
      breakdownMap.set(bk, {
        programName: pName,
        className: cName,
        students: new Set(),
        notYetDue: 0,
        days1To30: 0,
        days31To60: 0,
        days61Plus: 0,
        total: 0,
      });
    }
    const br = breakdownMap.get(bk);
    br.students.add(it.studentId);
    br[matchedKey] += bal;
    br.total += bal;
  }

  const bucketList = bucketDefs.map(d => bucketMap.get(d.key));
  const totalOutstanding = bucketList.reduce((s, b) => s + b.amount, 0);
  const zeroTo30Amt = bucketMap.get('notYetDue').amount + bucketMap.get('days1To30').amount;
  const days31To60Amt = bucketMap.get('days31To60').amount;
  const days61PlusAmt = bucketMap.get('days61Plus').amount;

  const columns = [
    { key: 'bucket', label: 'Age bucket', align: 'left' },
    { key: 'students', label: 'Students', align: 'right' },
    { key: 'amountOutstanding', label: 'Amount outstanding', align: 'right' },
    { key: 'shareOfTotal', label: 'Share of total', align: 'right' },
    { key: 'actionPriority', label: 'Action priority', align: 'left' },
  ];

  const rows = bucketList.map(b => ({
    bucket: b.label,
    students: b.students.size,
    amountOutstanding: formatRs(b.amount),
    shareOfTotal: formatPct(b.amount, totalOutstanding),
    actionPriority: b.priority,
    _raw: {
      bucketKey: b.key,
      students: b.students.size,
      amount: b.amount,
      sharePct: pctValue(b.amount, totalOutstanding),
    },
  }));

  const totalsRow = {
    bucket: 'TOTAL',
    students: allUnpaidStudents.size,
    amountOutstanding: formatRs(totalOutstanding),
    shareOfTotal: totalOutstanding > 0 ? '100.0%' : '0.0%',
    actionPriority: '',
  };

  const breakdownRows = Array.from(breakdownMap.values())
    .sort((a, b) => b.total - a.total)
    .map(br => ({
      programName: br.programName,
      className: br.className,
      students: br.students.size,
      notYetDue: formatRs(br.notYetDue),
      days1To30: formatRs(br.days1To30),
      days31To60: formatRs(br.days31To60),
      days61Plus: formatRs(br.days61Plus),
      totalOutstanding: formatRs(br.total),
    }));

  const secondaryTables = [
    {
      title: 'Program / Class Breakdown',
      columns: [
        { key: 'programName', label: 'Program', align: 'left' },
        { key: 'className', label: 'Class', align: 'left' },
        { key: 'students', label: 'Students', align: 'right' },
        { key: 'notYetDue', label: 'Not yet due', align: 'right' },
        { key: 'days1To30', label: '1–30 days', align: 'right' },
        { key: 'days31To60', label: '31–60 days', align: 'right' },
        { key: 'days61Plus', label: '61+ days', align: 'right' },
        { key: 'totalOutstanding', label: 'Total outstanding', align: 'right' },
      ],
      rows: breakdownRows,
    },
  ];

  const charts = [
    {
      type: 'bar',
      title: 'Receivables Ageing by Bucket',
      xKey: 'name',
      dataKey: 'value',
      data: bucketList.map(b => ({ name: b.label, value: Math.round(b.amount) })),
    },
  ];

  const selectedFilters = await getFilterLabels(query, [
    { label: 'As of Date', value: toYmd(asOfRef) },
    ...(headCtx ? [{ label: 'Fee Head', value: headCtx.labels.join(', ') }] : []),
  ]);

  return {
    selectedFilters,
    kpis: [
      { key: 'totalOutstanding', label: 'Total outstanding', value: formatRs(totalOutstanding), rawValue: totalOutstanding },
      { key: 'days0To30', label: '0–30 days', value: formatRs(zeroTo30Amt), rawValue: zeroTo30Amt },
      { key: 'days31To60', label: '31–60 days', value: formatRs(days31To60Amt), rawValue: days31To60Amt },
      { key: 'days61Plus', label: '61+ days', value: formatRs(days61PlusAmt), rawValue: days61PlusAmt },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables,
    charts,
    insight: {
      severity: days61PlusAmt > 0 || days31To60Amt > 0 ? 'warning' : 'info',
      message: `Total outstanding receivables: ${formatRs(totalOutstanding)} across ${allUnpaidStudents.size} active student(s) (Not yet due: ${formatRs(bucketMap.get('notYetDue').amount)}, 1–30d: ${formatRs(bucketMap.get('days1To30').amount)}, 31–60d: ${formatRs(days31To60Amt)}, 61+d: ${formatRs(days61PlusAmt)}).`,
    },
    rawExtra: {
      totalOutstanding,
      zeroTo30Amt,
      notYetDueAmt: bucketMap.get('notYetDue').amount,
      days1To30Amt: bucketMap.get('days1To30').amount,
      days31To60Amt,
      days61PlusAmt,
      bucketTotalsSum: totalOutstanding,
    },
  };
}

// Page 17: Discounts, Scholarships & Concessions
async function buildDiscountsConcessions(query = {}, ctx = null) {
  await normalizeContext(ctx, query);
  const explicitSessId = getExplicitSessionObjectId(query);
  const programIds = new Set(toObjectIds(query.programId).map(String));
  const typeValues = parseMulti(query.concessionType)
    .filter(v => !/^all$/i.test(v))
    .map(v => v.trim().toUpperCase());
  const approvalValues = parseMulti(query.approvalStatus)
    .filter(v => !/^all$/i.test(v))
    .map(v => v.trim().toUpperCase());

  const reqFilter = explicitSessId
    ? { $or: [{ sessionId: explicitSessId }, { sessionId: null }, { sessionId: { $exists: false } }] }
    : {};

  const challanCond = {
    status: { $nin: ['VOID', 'SUPERSEDED'] },
    $or: [
      { discountAmount: { $gt: 0 } },
      { discount: { $gt: 0 } },
      { isScholarship100: true },
    ],
  };
  if (explicitSessId) challanCond.sessionId = explicitSessId;

  const [concessionReqs, discountedChallans, discountedExtras, scholarshipStudents] = await Promise.all([
    FeeConcessionRequest.find(reqFilter)
      .populate({
        path: 'studentId',
        select: 'fName lName rollNumber programId tuitionFee installments isScholarship100 scholarshipAuthority',
        populate: { path: 'programId', select: 'name' },
      })
      .populate('approvedBy', 'name')
      .populate('rejectedBy', 'name')
      .sort({ createdAt: -1 })
      .lean(),
    FeeChallan.find(challanCond)
      .populate({
        path: 'studentId',
        select: 'fName lName rollNumber programId tuitionFee isScholarship100 scholarshipAuthority',
        populate: { path: 'programId', select: 'name' },
      })
      .lean(),
    ExtraChallan.find({ status: { $nin: ['VOID', 'SUPERSEDED'] }, discount: { $gt: 0 } })
      .populate({
        path: 'studentId',
        select: 'fName lName rollNumber programId tuitionFee',
        populate: { path: 'programId', select: 'name' },
      })
      .lean(),
    Student.find({
      ...ACTIVE_STUDENT_FILTER,
      isScholarship100: true,
      ...(explicitSessId ? { sessionId: explicitSessId } : {}),
    })
      .select('fName lName rollNumber programId tuitionFee installments isScholarship100 scholarshipAuthority')
      .populate('programId', 'name')
      .lean(),
  ]);

  const allEntries = [];
  const approvedReqByStudent = new Map();

  for (const cr of concessionReqs) {
    const student = cr.studentId;
    if (!student) continue;
    const pid = String(student.programId?._id || student.programId || '');
    if (programIds.size > 0 && !programIds.has(pid)) continue;

    const status = String(cr.status || 'PENDING').toUpperCase();
    const sid = String(student._id);
    const instTotal = Array.isArray(student.installments)
      ? student.installments.reduce((s, i) => s + Number(i.amount || 0), 0)
      : 0;
    const concessionAmt = Number(cr.amount || 0);
    const grossFee = Math.max(concessionAmt, Number(cr.grossAmount || student.tuitionFee || instTotal || 0));
    // CRITICAL RULE: Pending / Rejected requests MUST NEVER reduce netFee
    const netFee = status === 'APPROVED' ? Math.max(0, grossFee - concessionAmt) : grossFee;
    const approvedLabel = status === 'APPROVED'
      ? (cr.approvedByName || cr.approvedBy?.name || 'Approved')
      : status === 'REJECTED'
        ? `REJECTED (${cr.rejectedByName || cr.rejectedBy?.name || 'Admin'})`
        : 'PENDING APPROVAL';

    if (status === 'APPROVED') {
      approvedReqByStudent.set(sid, (approvedReqByStudent.get(sid) || 0) + concessionAmt);
    }

    const disabledActions = [];
    if (status === 'APPROVED') disabledActions.push('approve-concession');
    if (status === 'REJECTED') disabledActions.push('reject-concession');

    allEntries.push({
      id: String(cr._id),
      studentId: sid,
      student,
      concessionType: cr.concessionType,
      status,
      grossFee,
      concession: concessionAmt,
      netFee,
      reason: cr.reason || cr.concessionType,
      approvedBy: approvedLabel,
      actionContext: { requestId: String(cr._id), studentId: sid, status },
      disabledActions: disabledActions.length ? disabledActions : undefined,
    });
  }

  // Group Challan discounts & 100% scholarships by student without double-counting FeeConcessionRequest
  const challanByStudent = new Map();
  for (const ch of discountedChallans) {
    const student = ch.studentId;
    if (!student) continue;
    const pid = String(student.programId?._id || student.programId || '');
    if (programIds.size > 0 && !programIds.has(pid)) continue;
    const sid = String(student._id);
    const disc = Number(ch.discountAmount ?? ch.discount ?? 0);
    const baseGross = Number(ch.grossAmount ?? (Number(ch.basePayable ?? ch.amount ?? 0) + Number(ch.headsAmount || 0)));
    const cur = challanByStudent.get(sid) || {
      student,
      grossFee: 0,
      concession: 0,
      isScholarship: Boolean(ch.isScholarship100 || student.isScholarship100),
      reasons: new Set(),
    };
    cur.grossFee += Math.max(baseGross, disc);
    cur.concession += disc;
    if (ch.isScholarship100) cur.reasons.add('100% Scholarship');
    else if (disc > 0) cur.reasons.add('Challan Discount');
    challanByStudent.set(sid, cur);
  }

  for (const ec of discountedExtras) {
    const student = ec.studentId;
    if (!student) continue;
    const pid = String(student.programId?._id || student.programId || '');
    if (programIds.size > 0 && !programIds.has(pid)) continue;
    const sid = String(student._id);
    const disc = Number(ec.discount || 0);
    const cur = challanByStudent.get(sid) || {
      student,
      grossFee: 0,
      concession: 0,
      isScholarship: Boolean(student.isScholarship100),
      reasons: new Set(),
    };
    cur.grossFee += Math.max(Number(ec.amount || 0), disc);
    cur.concession += disc;
    cur.reasons.add('Extra Challan Discount');
    challanByStudent.set(sid, cur);
  }

  for (const [sid, data] of challanByStudent.entries()) {
    if (data.concession <= 0) continue;
    // Skip synthetic scholarship duplicate if already tracked as an approved FeeConcessionRequest of matching amount
    const approvedReqAmt = approvedReqByStudent.get(sid) || 0;
    if (data.isScholarship && approvedReqAmt > 0 && Math.abs(approvedReqAmt - data.concession) < 1) continue;

    allEntries.push({
      id: `challan-disc-${sid}`,
      studentId: sid,
      student: data.student,
      concessionType: data.isScholarship ? 'SCHOLARSHIP' : 'CHALLAN_DISCOUNT',
      status: 'APPROVED',
      grossFee: data.grossFee,
      concession: data.concession,
      netFee: Math.max(0, data.grossFee - data.concession),
      reason: Array.from(data.reasons).join(', '),
      approvedBy: data.student.scholarshipAuthority || 'Approved on Challan',
      actionContext: { requestId: null, studentId: sid, status: 'APPROVED' },
      disabledActions: ['approve-concession', 'reject-concession'],
    });
  }

  // Active 100% scholarship students with no challans or requests yet
  for (const stu of scholarshipStudents) {
    const sid = String(stu._id);
    const pid = String(stu.programId?._id || stu.programId || '');
    if (programIds.size > 0 && !programIds.has(pid)) continue;
    if (challanByStudent.has(sid) || approvedReqByStudent.has(sid)) continue;
    const instTotal = Array.isArray(stu.installments)
      ? stu.installments.reduce((s, i) => s + Number(i.amount || 0), 0)
      : 0;
    const grossFee = Number(stu.tuitionFee || instTotal || 0);
    if (grossFee <= 0) continue;

    allEntries.push({
      id: `scholarship-${sid}`,
      studentId: sid,
      student: stu,
      concessionType: 'SCHOLARSHIP',
      status: 'APPROVED',
      grossFee,
      concession: grossFee,
      netFee: 0,
      reason: '100% Scholarship',
      approvedBy: stu.scholarshipAuthority || 'Scholarship Authority (Approved)',
      actionContext: { requestId: null, studentId: sid, status: 'APPROVED' },
      disabledActions: ['approve-concession', 'reject-concession'],
    });
  }

  // Apply type & approvalStatus filters
  const typeFiltered = typeValues.length > 0
    ? allEntries.filter(e => typeValues.includes(String(e.concessionType || '').toUpperCase()))
    : allEntries;

  const visibleEntries = approvalValues.length > 0
    ? typeFiltered.filter(e => approvalValues.includes(e.status))
    : typeFiltered;

  // CRITICAL: Approved KPIs strictly ONLY count APPROVED rows (NEVER Pending or Rejected!)
  const approvedEntries = typeFiltered.filter(e => e.status === 'APPROVED');
  const pendingEntries = typeFiltered.filter(e => e.status === 'PENDING');
  const includesApproved = approvalValues.length === 0 || approvalValues.includes('APPROVED');

  const approvedTotal = !includesApproved
    ? 0
    : approvedEntries.reduce((s, e) => s + e.concession, 0);
  const approvedStudents = !includesApproved
    ? new Set()
    : new Set(approvedEntries.map(e => e.studentId));
  const avgApproved = approvedStudents.size > 0 ? Math.round(approvedTotal / approvedStudents.size) : 0;

  const columns = [
    { key: 'studentName', label: 'Student', align: 'left' },
    { key: 'programName', label: 'Program', align: 'left' },
    { key: 'grossFee', label: 'Gross fee', align: 'right' },
    { key: 'concession', label: 'Concession', align: 'right' },
    { key: 'netFee', label: 'Net fee', align: 'right' },
    { key: 'reason', label: 'Reason', align: 'left' },
    { key: 'approvedBy', label: 'Approved by / Status', align: 'left' },
  ];

  const mapRow = (e) => ({
    id: e.id,
    studentName: buildStudentDisplayName(e.student),
    programName: resolveProgramName(e.student),
    grossFee: formatRs(e.grossFee),
    concession: formatRs(e.concession),
    netFee: formatRs(e.netFee),
    reason: e.reason,
    approvedBy: e.approvedBy,
    drilldownKey: 'fees-student-ledger',
    drilldownFilters: { studentId: e.studentId },
    actionContext: e.actionContext,
    ...(e.disabledActions ? { disabledActions: e.disabledActions } : {}),
    _raw: {
      status: e.status,
      concessionType: e.concessionType,
      grossFee: e.grossFee,
      concession: e.concession,
      netFee: e.netFee,
    },
  });

  const rows = visibleEntries.map(mapRow);
  const visibleApproved = visibleEntries.filter(e => e.status === 'APPROVED');
  const totalsRow = {
    studentName: 'TOTAL (APPROVED ONLY)',
    programName: `${formatNum(approvedStudents.size)} approved students`,
    grossFee: formatRs(visibleApproved.reduce((s, e) => s + e.grossFee, 0)),
    concession: formatRs(approvedTotal),
    netFee: formatRs(visibleApproved.reduce((s, e) => s + e.netFee, 0)),
    reason: '',
    approvedBy: pendingEntries.length ? `${pendingEntries.length} pending excluded` : '',
  };

  const secondaryTables = [];
  if (pendingEntries.length > 0) {
    secondaryTables.push({
      title: 'Pending Concession Requests — excluded from approved concession totals',
      columns,
      rows: pendingEntries.map(mapRow),
    });
  }

  const selectedFilters = await getFilterLabels(query, [
    ...(typeValues.length > 0 ? [{ label: 'Concession Type', value: typeValues.join(', ') }] : []),
    ...(approvalValues.length > 0 ? [{ label: 'Approval Status', value: approvalValues.join(', ') }] : []),
  ]);

  return {
    selectedFilters,
    kpis: [
      { key: 'approvedConcessions', label: 'Approved concessions', value: formatRs(approvedTotal), rawValue: approvedTotal },
      { key: 'students', label: 'Students', value: formatNum(approvedStudents.size), rawValue: approvedStudents.size },
      { key: 'pendingApprovals', label: 'Pending approvals', value: formatNum(pendingEntries.length), rawValue: pendingEntries.length },
      { key: 'averageConcession', label: 'Average concession', value: formatRs(avgApproved), rawValue: avgApproved },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables,
    charts: [],
    insight: {
      severity: pendingEntries.length > 0 ? 'warning' : 'info',
      message: `Approved concessions total ${formatRs(approvedTotal)} across ${approvedStudents.size} student(s) (avg ${formatRs(avgApproved)}).${pendingEntries.length > 0 ? ` ${pendingEntries.length} pending request(s) totaling ${formatRs(pendingEntries.reduce((s, e) => s + e.concession, 0))} are awaiting approval and excluded from fee reductions.` : ''}`,
    },
    rawExtra: {
      approvedTotal,
      approvedStudentsCount: approvedStudents.size,
      pendingCount: pendingEntries.length,
      pendingTotal: pendingEntries.reduce((s, e) => s + e.concession, 0),
      avgApproved,
    },
  };
}

// Page 18: Cashier & Payment Method Reconciliation
async function buildCashierReconciliation(query = {}, ctx = null) {
  await normalizeContext(ctx, query);
  const { start, end, startStr, endStr } = resolveDayBounds(query.dateFrom, query.dateTo, 0);
  const receiptStatus = String(query.receiptStatus || 'POSTED').trim().toUpperCase();
  const [cashierIds, cashierOptions] = await Promise.all([
    resolveCashierUserIds(query.cashierId),
    buildCashierOptions(),
  ]);
  const cashierSet = cashierIds ? new Set(cashierIds.map(String)) : null;

  const statusCond = receiptStatus === 'VOID'
    ? { status: 'VOID' }
    : receiptStatus === 'ALL'
      ? {}
      : { status: { $ne: 'VOID' } };

  const [receipts, closings] = await Promise.all([
    FeePaymentReceipt.find({
      ...statusCond,
      receiptType: { $nin: ['ADVANCE_SETTLEMENT', 'ARREARS_SETTLEMENT'] },
      $or: [
        { paidDate: { $gte: start, $lte: end } },
        { paidDate: null, createdAt: { $gte: start, $lte: end } },
      ],
    })
      .populate('recordedBy', 'name role email')
      .lean(),
    FinanceClosing.find({
      date: { $gte: startStr, $lte: endStr },
      'cashierReconciliation.0': { $exists: true },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const groupMap = new Map();
  for (const r of receipts) {
    const recId = r.recordedBy?._id ? String(r.recordedBy._id) : (r.recordedBy ? String(r.recordedBy) : 'counter');
    if (cashierSet && !cashierSet.has(recId)) continue;
    const cashierName = r.recordedBy?.name || 'Counter';
    if (!groupMap.has(recId)) {
      groupMap.set(recId, {
        cashierId: recId === 'counter' ? null : recId,
        cashierName,
        cash: 0,
        bankTransfer: 0,
        online: 0,
        receiptCount: 0,
        total: 0,
      });
    }
    const g = groupMap.get(recId);
    const amt = Number(r.amountPaid || 0);
    const bucket = classifyPaymentMethod(r.paymentMode);
    g[bucket] += amt;
    g.receiptCount += 1;
    g.total += amt;
  }

  // Merge saved cashier closing details from FinanceClosing
  const closingByCashier = new Map();
  for (const cl of closings) {
    for (const cr of (cl.cashierReconciliation || [])) {
      const k = cr.cashierId ? String(cr.cashierId) : `name:${String(cr.cashierName || '').toLowerCase()}`;
      if (!closingByCashier.has(k)) closingByCashier.set(k, { ...cr, closingDate: cl.date });
      if (cr.cashierName && !closingByCashier.has(`name:${String(cr.cashierName).toLowerCase()}`)) {
        closingByCashier.set(`name:${String(cr.cashierName).toLowerCase()}`, { ...cr, closingDate: cl.date });
      }
    }
  }

  const columns = [
    { key: 'cashierName', label: 'Cashier', align: 'left' },
    { key: 'cash', label: 'Cash', align: 'right' },
    { key: 'bankTransfer', label: 'Bank transfer', align: 'right' },
    { key: 'online', label: 'Online', align: 'right' },
    { key: 'receiptCount', label: 'Receipts', align: 'right' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'variance', label: 'Variance', align: 'right' },
    { key: 'reconciledStatus', label: 'Closing status', align: 'left' },
  ];

  let grandCash = 0;
  let grandBank = 0;
  let grandOnline = 0;
  let grandCount = 0;
  let grandTotal = 0;
  let grandVariance = 0;
  let hasAnyClosing = false;

  const rows = Array.from(groupMap.values())
    .sort((a, b) => b.total - a.total)
    .map(g => {
      grandCash += g.cash;
      grandBank += g.bankTransfer;
      grandOnline += g.online;
      grandCount += g.receiptCount;
      grandTotal += g.total;

      const closing = (g.cashierId && closingByCashier.get(g.cashierId)) ||
        closingByCashier.get(`name:${g.cashierName.toLowerCase()}`) ||
        null;

      if (closing) {
        hasAnyClosing = true;
        grandVariance += Number(closing.variance || 0);
      }

      return {
        id: g.cashierId || 'counter',
        cashierName: g.cashierName,
        cash: formatRs(g.cash),
        bankTransfer: formatRs(g.bankTransfer),
        online: formatRs(g.online),
        receiptCount: g.receiptCount,
        total: formatRs(g.total),
        variance: closing ? formatRs(closing.variance || 0) : '—',
        reconciledStatus: closing
          ? `Reconciled (${closing.approvedByName || 'Accounts'}${closing.bankReference ? ` · Ref: ${closing.bankReference}` : ''})`
          : 'Pending closing',
        actionContext: {
          cashierId: g.cashierId,
          cashierName: g.cashierName,
          date: endStr,
          cashCollected: g.cash,
          bankTransfer: g.bankTransfer,
          onlineCollected: g.online,
        },
        _openingCash: closing ? Number(closing.openingCash || 0) : 0,
        _cashCounted: closing ? Number(closing.cashCounted || 0) : g.cash,
        _bankReference: closing ? (closing.bankReference || '') : '',
        _raw: {
          cash: g.cash,
          bankTransfer: g.bankTransfer,
          online: g.online,
          receiptCount: g.receiptCount,
          total: g.total,
          variance: closing ? Number(closing.variance || 0) : null,
        },
      };
    });

  const totalsRow = {
    cashierName: 'TOTAL',
    cash: formatRs(grandCash),
    bankTransfer: formatRs(grandBank),
    online: formatRs(grandOnline),
    receiptCount: grandCount,
    total: formatRs(grandTotal),
    variance: hasAnyClosing ? formatRs(grandVariance) : '—',
    reconciledStatus: '',
  };

  const savedClosingRows = [];
  for (const cl of closings) {
    for (const cr of (cl.cashierReconciliation || [])) {
      savedClosingRows.push({
        date: cl.date,
        cashierName: cr.cashierName || 'Counter',
        openingCash: formatRs(cr.openingCash || 0),
        cashCollected: formatRs(cr.cashCollected || 0),
        cashCounted: formatRs(cr.cashCounted || 0),
        variance: formatRs(cr.variance || 0),
        bankReference: cr.bankReference || '—',
        approvedByName: cr.approvedByName || cl.closedByName || '—',
      });
    }
  }

  const secondaryTables = savedClosingRows.length
    ? [{
      title: 'Saved Cashier Closing Details',
      columns: [
        { key: 'date', label: 'Closing date', align: 'left' },
        { key: 'cashierName', label: 'Cashier', align: 'left' },
        { key: 'openingCash', label: 'Opening cash', align: 'right' },
        { key: 'cashCollected', label: 'System cash', align: 'right' },
        { key: 'cashCounted', label: 'Counted cash', align: 'right' },
        { key: 'variance', label: 'Variance', align: 'right' },
        { key: 'bankReference', label: 'Bank ref', align: 'left' },
        { key: 'approvedByName', label: 'Approved by', align: 'left' },
      ],
      rows: savedClosingRows,
    }]
    : [];

  const charts = rows.length
    ? [{
      type: 'bar',
      title: 'Collection by Cashier & Method',
      xKey: 'name',
      series: [
        { dataKey: 'cash', label: 'Cash' },
        { dataKey: 'bankTransfer', label: 'Bank Transfer' },
        { dataKey: 'online', label: 'Online' },
      ],
      data: rows.map(r => ({
        name: r.cashierName,
        cash: Math.round(r._raw.cash),
        bankTransfer: Math.round(r._raw.bankTransfer),
        online: Math.round(r._raw.online),
      })),
    }]
    : [];

  const selectedFilters = await getFilterLabels(query, [
    { label: 'Date Range', value: startStr === endStr ? startStr : `${startStr} to ${endStr}` },
    { label: 'Receipt Status', value: receiptStatus },
  ]);

  return {
    selectedFilters,
    kpis: [
      { key: 'totalReceipts', label: 'Total receipts', value: formatRs(grandTotal), rawValue: grandTotal },
      { key: 'receiptsCount', label: 'Receipts count', value: formatNum(grandCount), rawValue: grandCount },
      { key: 'cash', label: 'Cash', value: formatRs(grandCash), rawValue: grandCash },
      { key: 'bankOnline', label: 'Bank / online', value: formatRs(grandBank + grandOnline), rawValue: grandBank + grandOnline },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables,
    charts,
    insight: {
      severity: hasAnyClosing && Math.abs(grandVariance) > 0 ? 'warning' : 'info',
      message: grandCount === 0
        ? `No ${receiptStatus.toLowerCase()} fee receipts recorded for ${startStr === endStr ? startStr : `${startStr} to ${endStr}`}.`
        : `Reconciled ${formatRs(grandTotal)} across ${formatNum(grandCount)} receipt(s): Cash ${formatRs(grandCash)}, Bank transfer ${formatRs(grandBank)}, Online ${formatRs(grandOnline)}.${hasAnyClosing ? ` Net recorded cash variance: ${formatRs(grandVariance)}.` : ' Use row "Reconcile" action to log physical cash counts.'}`,
    },
    rawExtra: {
      filterOptions: { cashierId: cashierOptions },
      grandTotal,
      grandCount,
      grandCash,
      grandBank,
      grandOnline,
      grandVariance,
    },
  };
}

// ---------------------------------------------------------------------------
// Inline Report Actions
// ---------------------------------------------------------------------------

async function handleLogFeeReminder(payload = {}, ctx = null) {
  const { reqUser } = await normalizeContext(ctx);
  const { studentId, challanId, installmentNumber, contactOutcome, nextFollowUpDate, remarks } = payload;

  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    const err = new Error('Valid studentId is required to log a fee reminder');
    err.statusCode = 400;
    throw err;
  }

  const allowedChannels = ['SMS', 'WHATSAPP', 'CALL', 'EMAIL', 'IN_PERSON'];
  const allowedStatuses = ['NOT_SENT', 'QUEUED', 'SENT', 'RESPONDED', 'FAILED'];
  const channel = allowedChannels.includes(String(payload.channel || '').toUpperCase())
    ? String(payload.channel).toUpperCase()
    : 'SMS';
  const status = allowedStatuses.includes(String(payload.status || '').toUpperCase())
    ? String(payload.status).toUpperCase()
    : 'SENT';

  const record = await FeeReminderLog.create({
    studentId,
    challanId: challanId && mongoose.Types.ObjectId.isValid(challanId) ? challanId : undefined,
    installmentNumber: installmentNumber != null && installmentNumber !== '' ? Number(installmentNumber) : null,
    channel,
    status,
    contactOutcome: String(contactOutcome || '').trim(),
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
    remarks: String(remarks || '').trim(),
    loggedBy: reqUser?.id || null,
    loggedByName: reqUser?.name || reqUser?.email || 'Administrator',
  });

  logReportActivity(
    reqUser,
    'LOG_FEE_REMINDER',
    `Logged ${channel} fee reminder (${status}) for student ${studentId}`,
    { entityType: 'FeeReminderLog', entityId: String(record._id) }
  );

  return { ok: true, message: `${channel} reminder logged (${status}).`, record };
}

async function handleCreateConcession(payload = {}, ctx = null) {
  const { reqUser } = await normalizeContext(ctx);
  const rawStudent = String(payload.studentId || '').trim();
  if (!rawStudent) {
    const err = new Error('Student ID or Roll Number is required');
    err.statusCode = 400;
    throw err;
  }

  const student = mongoose.Types.ObjectId.isValid(rawStudent)
    ? await Student.findById(rawStudent).lean()
    : await Student.findOne({ rollNumber: rawStudent }).lean();

  if (!student) {
    const err = new Error(`Student not found: ${rawStudent}`);
    err.statusCode = 404;
    throw err;
  }

  const amount = Number(payload.amount || 0);
  if (amount <= 0) {
    const err = new Error('Concession amount must be greater than 0');
    err.statusCode = 400;
    throw err;
  }

  const validTypes = ['SCHOLARSHIP', 'SIBLING', 'STAFF', 'MERIT', 'NEED_BASED', 'SPECIAL'];
  const cType = validTypes.includes(String(payload.concessionType || '').toUpperCase())
    ? String(payload.concessionType).toUpperCase()
    : 'SPECIAL';

  const grossAmount = Number(payload.grossAmount || student.tuitionFee || amount);

  const record = await FeeConcessionRequest.create({
    studentId: student._id,
    sessionId: payload.sessionId || student.sessionId || undefined,
    concessionType: cType,
    grossAmount,
    amount,
    reason: String(payload.reason || '').trim(),
    status: 'PENDING',
    createdBy: reqUser?.id || null,
    createdByName: reqUser?.name || reqUser?.email || 'Administrator',
  });

  logReportActivity(
    reqUser,
    'CREATE_CONCESSION_REQUEST',
    `Created PENDING ${cType} concession request of ${formatRs(amount)} for ${fullName(student)}`,
    { entityType: 'FeeConcessionRequest', entityId: String(record._id) }
  );

  return { ok: true, message: 'Concession request submitted (Pending approval).', record };
}

async function handleApproveConcession(payload = {}, ctx = null) {
  const { reqUser } = await normalizeContext(ctx);
  const { requestId, remarks } = payload;

  if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
    const err = new Error('Only pending/existing FeeConcessionRequest records can be approved via this action');
    err.statusCode = 400;
    throw err;
  }

  const doc = await FeeConcessionRequest.findById(requestId);
  if (!doc) {
    const err = new Error('Concession request not found');
    err.statusCode = 404;
    throw err;
  }
  if (doc.status === 'APPROVED') {
    return { ok: true, message: 'Concession request is already approved.', record: doc };
  }

  doc.status = 'APPROVED';
  doc.approvedBy = reqUser?.id || null;
  doc.approvedByName = reqUser?.name || reqUser?.email || 'Administrator';
  doc.approvedAt = new Date();
  if (remarks) doc.reason = doc.reason ? `${doc.reason} (${String(remarks).trim()})` : String(remarks).trim();
  await doc.save();

  logReportActivity(
    reqUser,
    'APPROVE_CONCESSION',
    `Approved ${doc.concessionType} concession of ${formatRs(doc.amount)}`,
    { entityType: 'FeeConcessionRequest', entityId: String(doc._id) }
  );

  return { ok: true, message: `Approved ${formatRs(doc.amount)} concession request.`, record: doc };
}

async function handleRejectConcession(payload = {}, ctx = null) {
  const { reqUser } = await normalizeContext(ctx);
  const { requestId, remarks } = payload;

  if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
    const err = new Error('Valid FeeConcessionRequest requestId is required');
    err.statusCode = 400;
    throw err;
  }

  const doc = await FeeConcessionRequest.findById(requestId);
  if (!doc) {
    const err = new Error('Concession request not found');
    err.statusCode = 404;
    throw err;
  }

  doc.status = 'REJECTED';
  doc.rejectedBy = reqUser?.id || null;
  doc.rejectedByName = reqUser?.name || reqUser?.email || 'Administrator';
  doc.rejectedAt = new Date();
  if (remarks) doc.reason = doc.reason ? `${doc.reason} [Rejected: ${String(remarks).trim()}]` : `Rejected: ${String(remarks).trim()}`;
  await doc.save();

  logReportActivity(
    reqUser,
    'REJECT_CONCESSION',
    `Rejected ${doc.concessionType} concession request of ${formatRs(doc.amount)}`,
    { entityType: 'FeeConcessionRequest', entityId: String(doc._id) }
  );

  return { ok: true, message: 'Concession request rejected.', record: doc };
}

async function handleSaveCashierReconciliation(payload = {}, ctx = null) {
  const { reqUser } = await normalizeContext(ctx);
  const dateStr = toYmd(payload.date);
  const cashierId = payload.cashierId && mongoose.Types.ObjectId.isValid(payload.cashierId)
    ? new mongoose.Types.ObjectId(String(payload.cashierId))
    : null;
  const cashierName = String(payload.cashierName || 'Counter').trim();

  const openingCash = Number(payload.openingCash || 0);
  const cashCollected = Number(payload.cashCollected || 0);
  const bankTransfer = Number(payload.bankTransfer || 0);
  const onlineCollected = Number(payload.onlineCollected || 0);
  const cashCounted = Number(payload.cashCounted ?? cashCollected);
  const variance = cashCounted - (openingCash + cashCollected);

  const entry = {
    cashierId,
    cashierName,
    openingCash,
    cashCollected,
    bankTransfer,
    onlineCollected,
    cashCounted,
    variance,
    bankReference: String(payload.bankReference || '').trim(),
    approvedByName: reqUser?.name || reqUser?.email || 'Administrator',
    approvedAt: new Date(),
  };

  let closing = await FinanceClosing.findOne({ date: dateStr }).sort({ createdAt: -1 });
  if (closing) {
    const list = Array.isArray(closing.cashierReconciliation) ? closing.cashierReconciliation : [];
    const idx = list.findIndex(item =>
      (cashierId && item.cashierId && String(item.cashierId) === String(cashierId)) ||
      (item.cashierName && item.cashierName.toLowerCase() === cashierName.toLowerCase())
    );
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    closing.cashierReconciliation = list;
    if (payload.remarks) closing.remarks = String(payload.remarks).trim();
    await closing.save();
  } else {
    closing = await FinanceClosing.create({
      date: dateStr,
      type: 'CASHIER_RECONCILIATION',
      closedBy: reqUser?.id || null,
      closedByName: reqUser?.name || reqUser?.email || 'Administrator',
      remarks: String(payload.remarks || 'Cashier reconciliation saved from Fee Report').trim(),
      cashierReconciliation: [entry],
    });
  }

  logReportActivity(
    reqUser,
    'SAVE_CASHIER_RECONCILIATION',
    `Saved cashier reconciliation for ${cashierName} on ${dateStr} (variance: ${formatRs(variance)})`,
    { entityType: 'FinanceClosing', entityId: String(closing._id) }
  );

  return {
    ok: true,
    message: `Saved reconciliation for ${cashierName} (variance: ${formatRs(variance)}).`,
    record: entry,
    closingId: String(closing._id),
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const HANDLERS = {
  'fees-collection-register': buildCollectionRegister,
  'fees-student-ledger': buildStudentLedger,
  'fees-installment-schedule': buildInstallmentSchedule,
  'fees-defaulters-overdue': buildDefaultersOverdue,
  'fees-upcoming-reminders': buildUpcomingReminders,
  'fees-receivables-ageing': buildReceivablesAgeing,
  'fees-discounts-concessions': buildDiscountsConcessions,
  'fees-cashier-reconciliation': buildCashierReconciliation,
};

const ACTIONS = {
  'log-fee-reminder': handleLogFeeReminder,
  'create-concession': handleCreateConcession,
  'approve-concession': handleApproveConcession,
  'reject-concession': handleRejectConcession,
  'save-cashier-reconciliation': handleSaveCashierReconciliation,
};

module.exports = { CATALOG, HANDLERS, ACTIONS };
