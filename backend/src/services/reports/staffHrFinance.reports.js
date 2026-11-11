const mongoose = require('mongoose');
const {
  Staff,
  Department,
  Attendance,
  Leave,
  Payroll,
  FinanceIncome,
  FinanceExpense,
  HostelExpense,
  InventoryExpense,
  FeePaymentReceipt,
  Holiday,
  Wallet,
  WalletTransaction,
  User,
} = require('../../models');
const {
  parseMulti,
  toObjectIds,
  applyMultiIdFilter,
  applyMultiStringFilter,
  matchesMultiValue,
  resolveDateRange,
  formatRs,
  formatNum,
  formatPct,
  pctValue,
  formatDate,
  daysBetween,
  maskValue,
  loadUserPermissions,
  canViewPrivateData,
} = require('./reportHelpers');

// ---------------------------------------------------------------------------
// Shared Helpers (ponytail: keep permission, date, and dept matching concise)
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
  // Preserve explicit YYYY-MM-DD strings without UTC-offset shifting
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
  return { month: target, year, m, daysInMonth, startStr, endStr, start, end };
}

function enumerateDateStrings(startStr, endStr) {
  const dates = [];
  if (!startStr) return dates;
  const [sY, sM, sD] = String(startStr).slice(0, 10).split('-').map(Number);
  const [eY, eM, eD] = String(endStr || startStr).slice(0, 10).split('-').map(Number);
  if (!sY || !sM || !sD) return dates;
  const cur = new Date(sY, sM - 1, sD, 12, 0, 0);
  const last = new Date(eY || sY, (eM || sM) - 1, eD || sD, 12, 0, 0);
  while (cur <= last) {
    dates.push(toLocalDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function resolveContext(ctxOrUser) {
  if (ctxOrUser && ctxOrUser.permCtx) return ctxOrUser;
  const reqUser = ctxOrUser?.reqUser || (ctxOrUser && (ctxOrUser.id || ctxOrUser._id || ctxOrUser.role) ? ctxOrUser : null);
  let permCtx = await loadUserPermissions(reqUser);
  // ponytail: allow inline test permissions when no DB User exists for mock reqUser
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
  return { reqUser, permCtx, sessionCtx: ctxOrUser?.sessionCtx || {} };
}

function staffDeptName(staff) {
  return staff?.departmentId?.name || staff?.empDepartment || 'Unassigned';
}

async function resolveDepartmentFilter(departmentId) {
  const raw = parseMulti(departmentId).filter((v) => v !== '*' && !/^all$/i.test(v));
  if (raw.length === 0) return null;
  const idStrs = new Set();
  const nameLowers = new Set();
  const objIds = [];
  for (const v of raw) {
    if (mongoose.Types.ObjectId.isValid(v)) {
      idStrs.add(String(v));
      objIds.push(new mongoose.Types.ObjectId(v));
    } else {
      nameLowers.add(v.trim().toLowerCase());
    }
  }
  if (objIds.length > 0) {
    const depts = await Department.find({ _id: { $in: objIds } }).select('name').lean();
    for (const d of depts) {
      if (d?.name) nameLowers.add(d.name.trim().toLowerCase());
    }
  }
  return { idStrs, nameLowers };
}

function matchesDepartment(staff, deptFilter) {
  if (!deptFilter) return true;
  const sDeptId = staff?.departmentId?._id ? String(staff.departmentId._id) : (staff?.departmentId ? String(staff.departmentId) : '');
  const sDeptName = staffDeptName(staff).toLowerCase();
  if (sDeptId && deptFilter.idStrs?.has(sDeptId)) return true;
  if (sDeptName && deptFilter.nameLowers?.has(sDeptName)) return true;
  return false;
}

function buildSelectedFilters(entries) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'ALL' && value !== 'all')
    .map(([key, value, label]) => ({ key, label: label || key, value: String(value) }));
}

async function resolveLinkedStaffId(reqUser) {
  if (!reqUser) return null;
  if (reqUser.staffId && mongoose.Types.ObjectId.isValid(reqUser.staffId)) {
    return String(reqUser.staffId);
  }
  let userDoc = null;
  if (reqUser.id && mongoose.Types.ObjectId.isValid(reqUser.id)) {
    userDoc = await User.findById(reqUser.id).select('refId email').lean();
  }
  if (userDoc?.refId) return String(userDoc.refId);
  const email = userDoc?.email || reqUser.email;
  if (email) {
    const staff = await Staff.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, 'i') }).select('_id').lean();
    if (staff) return String(staff._id);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Page 32 — Staff & Faculty Employee Register
// ---------------------------------------------------------------------------

async function buildStaffEmployeeRegister(query = {}, ctxOrUser = null) {
  const { permCtx } = await resolveContext(ctxOrUser);
  const canViewPrivate =
    canViewPrivateData(permCtx, 'Staff', 'directory') ||
    canViewPrivateData(permCtx, 'HR & Payroll', 'payroll');

  const deptFilter = await resolveDepartmentFilter(query.departmentId);
  const mongoFilter = {};
  applyMultiStringFilter(mongoFilter, 'status', query.status, { caseInsensitive: true });
  applyMultiStringFilter(mongoFilter, 'designation', query.designation, { caseInsensitive: true });
  if (query.dateFrom || query.dateTo) {
    const { start, end } = safeDateRange(query.dateFrom, query.dateTo, 3650);
    mongoFilter.joinDate = {};
    if (query.dateFrom) mongoFilter.joinDate.$gte = start;
    if (query.dateTo) mongoFilter.joinDate.$lte = end;
  }
  if (query.search && String(query.search).trim()) {
    const re = new RegExp(escapeRegex(String(query.search).trim()), 'i');
    mongoFilter.$or = [
      { name: re },
      { staffId: re },
      { designation: re },
      { empDepartment: re },
      { fatherName: re },
    ];
  }

  const allStaff = await Staff.find(mongoFilter)
    .populate('departmentId', 'name code')
    .sort({ name: 1 })
    .lean();

  const staffList = allStaff.filter(s => matchesDepartment(s, deptFilter));
  const activeStaff = staffList.filter(s => String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  const isTeach = s => Boolean(s.isTeaching) || String(s.staffType || '').toUpperCase() === 'TEACHING';
  const teachingCount = activeStaff.filter(isTeach).length;
  const adminSupportCount = activeStaff.filter(s => !isTeach(s) || s.isNonTeaching || s.isSupportingStaff).length;
  const deptSet = new Set(staffList.map(s => staffDeptName(s)).filter(Boolean));

  let totalBasicPay = 0;
  const rows = staffList.map(s => {
    const rawBasic = Number(s.basicPay || s.baseSalary || 0);
    if (canViewPrivate) totalBasicPay += rawBasic;
    return {
      _rowId: String(s._id),
      staffId: s.staffId || '—',
      name: s.name || '—',
      department: staffDeptName(s),
      designation: s.designation || '—',
      joinDate: formatDate(s.joinDate),
      status: String(s.status || 'ACTIVE').toUpperCase(),
      phone: canViewPrivate ? (s.phone || '—') : maskValue(s.phone, 4),
      cnic: canViewPrivate ? (s.cnic || '—') : maskValue(s.cnic, 4),
      basicPay: canViewPrivate ? formatRs(rawBasic) : 'Restricted',
      rawBasicPay: canViewPrivate ? rawBasic : null,
    };
  });

  const columns = [
    { key: 'staffId', label: 'Employee ID', align: 'left' },
    { key: 'name', label: 'Name', align: 'left' },
    { key: 'department', label: 'Department', align: 'left' },
    { key: 'designation', label: 'Designation', align: 'left' },
    { key: 'joinDate', label: 'Joining date', align: 'left' },
    { key: 'status', label: 'Status', align: 'center' },
  ];
  if (canViewPrivate) {
    columns.push(
      { key: 'phone', label: 'Phone', align: 'left' },
      { key: 'cnic', label: 'CNIC', align: 'left' },
      { key: 'basicPay', label: 'Basic pay', align: 'right' }
    );
  }

  const totalsRow = rows.length
    ? {
        staffId: 'Total',
        name: `${rows.length} staff member(s)`,
        department: `${deptSet.size} dept(s)`,
        designation: `${teachingCount} teaching / ${adminSupportCount} admin-support`,
        joinDate: '—',
        status: `${activeStaff.length} Active`,
        ...(canViewPrivate ? { phone: '—', cnic: '—', basicPay: formatRs(totalBasicPay) } : {}),
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters([
      ['departmentId', deptFilter?.nameLower || query.departmentId, 'Department'],
      ['designation', query.designation, 'Designation'],
      ['status', query.status, 'Status'],
      ['dateFrom', query.dateFrom, 'Joined from'],
      ['dateTo', query.dateTo, 'Joined to'],
      ['search', query.search, 'Search'],
    ]),
    kpis: [
      { label: 'Active employees', value: formatNum(activeStaff.length), tone: 'info' },
      { label: 'Teaching staff', value: formatNum(teachingCount), tone: 'success' },
      { label: 'Admin / support', value: formatNum(adminSupportCount), tone: 'default' },
      { label: 'Departments', value: formatNum(deptSet.size), tone: 'default' },
    ],
    columns,
    rows,
    totalsRow,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: canViewPrivate ? 'info' : 'warning',
      message: canViewPrivate
        ? `Showing ${rows.length} employee record(s) (${activeStaff.length} active across ${deptSet.size} department(s)).`
        : `Showing ${rows.length} employee record(s). Phone, CNIC, and salary columns are masked because you lack Staff directory or Payroll access.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 33 — Staff Attendance & Punctuality
// ---------------------------------------------------------------------------

async function buildStaffAttendancePunctuality(query = {}) {
  const { month, startStr, endStr } = monthBounds(query.month);
  const deptFilter = await resolveDepartmentFilter(query.departmentId);

  const staffFilter = {};
  applyMultiIdFilter(staffFilter, '_id', query.staffId);
  const reqStatuses = parseMulti(query.status)
    .map(s => s.trim().toUpperCase())
    .filter(s => ['ACTIVE', 'TERMINATED', 'RETIRED'].includes(s));
  if (reqStatuses.length > 0) {
    staffFilter.status = reqStatuses.length === 1 ? reqStatuses[0] : { $in: reqStatuses };
  } else if (!staffFilter._id && (!query.status || query.status === 'ACTIVE')) {
    staffFilter.status = 'ACTIVE';
  }

  const allStaff = await Staff.find(staffFilter).populate('departmentId', 'name').sort({ name: 1 }).lean();
  const staffList = allStaff.filter(s => matchesDepartment(s, deptFilter));
  const staffIds = staffList.map(s => s._id);

  const [attendanceRecords, approvedLeaves, holidays] = await Promise.all([
    staffIds.length
      ? Attendance.find({
          staffId: { $in: staffIds },
          role: { $in: ['STAFF', 'TEACHER', 'staff', 'teacher'] },
          date: { $regex: `^${escapeRegex(month)}` },
        }).lean()
      : [],
    staffIds.length
      ? Leave.find({
          staffId: { $in: staffIds },
          applicantType: 'STAFF',
          status: { $regex: /^approved$/i },
          fromDate: { $lte: endStr },
          toDate: { $gte: startStr },
        }).lean()
      : [],
    Holiday.find({
      $or: [
        { date: { $regex: `^${escapeRegex(month)}` } },
        { date: { $lte: endStr }, endDate: { $gte: startStr } },
      ],
    }).lean(),
  ]);

  const holidayDates = new Set();
  holidays.forEach(h => {
    const s = String(h.date || '').slice(0, 10);
    const e = String(h.endDate || s).slice(0, 10);
    enumerateDateStrings(s, e).forEach(d => {
      if (d.startsWith(month)) holidayDates.add(d);
    });
  });

  // Approved leave dates per staff (kept strictly separate from unapproved absence)
  const approvedLeaveDatesByStaff = new Map();
  approvedLeaves.forEach(l => {
    const sid = String(l.staffId);
    if (!approvedLeaveDatesByStaff.has(sid)) approvedLeaveDatesByStaff.set(sid, new Set());
    const set = approvedLeaveDatesByStaff.get(sid);
    enumerateDateStrings(l.fromDate, l.toDate || l.fromDate).forEach(d => {
      if (d.startsWith(month) && !holidayDates.has(d)) set.add(d);
    });
  });

  const attByStaffDate = new Map();
  attendanceRecords.forEach(rec => {
    const sid = String(rec.staffId);
    if (!attByStaffDate.has(sid)) attByStaffDate.set(sid, new Map());
    attByStaffDate.get(sid).set(String(rec.date).slice(0, 10), rec);
  });

  let totalWorkingDays = 0;
  let totalPresent = 0;
  let totalApprovedLeave = 0;
  let totalUnapprovedAbsent = 0;
  let totalLate = 0;
  let totalAttNumerator = 0;

  let rows = staffList.map(s => {
    const sid = String(s._id);
    const leaveDates = approvedLeaveDatesByStaff.get(sid) || new Set();
    const recMap = attByStaffDate.get(sid) || new Map();

    const allDates = new Set([...recMap.keys(), ...leaveDates]);
    let present = 0;
    let halfDay = 0;
    let late = 0;
    let approvedLeave = 0;
    let unapprovedAbsent = 0;

    allDates.forEach(d => {
      if (holidayDates.has(d)) return;
      // Approved Leave overrides any non-present / absent entry so it never pollutes unapproved absence
      if (leaveDates.has(d)) {
        approvedLeave += 1;
        return;
      }
      const rec = recMap.get(d);
      if (!rec || !rec.status) return;
      const st = String(rec.status).toUpperCase();
      if (st === 'HOLIDAY' || st === 'HD') return;
      if (st === 'LEAVE') {
        approvedLeave += 1;
      } else if (st === 'LATE') {
        late += 1;
        present += 1;
      } else if (st === 'PRESENT') {
        present += 1;
      } else if (st === 'HALF_DAY' || st === 'HALF DAY') {
        halfDay += 1;
      } else if (st === 'ABSENT') {
        unapprovedAbsent += 1;
      }
    });

    const workingDays = present + halfDay + approvedLeave + unapprovedAbsent;
    const effectivePresent = present + halfDay * 0.5;
    // Attendance rate measures presence against working days excluding approved leaves? Or total tracked workingDays:
    // Match attendance.service.js convention: present / tracked working days
    const rate = workingDays > 0 ? pctValue(effectivePresent, workingDays) : 0;

    totalWorkingDays += workingDays;
    totalPresent += present;
    totalApprovedLeave += approvedLeave;
    totalUnapprovedAbsent += unapprovedAbsent;
    totalLate += late;
    totalAttNumerator += effectivePresent;

    return {
      _rowId: sid,
      name: s.name || '—',
      department: staffDeptName(s),
      workingDays,
      present,
      approvedLeave,
      absent: unapprovedAbsent,
      late,
      attendancePct: workingDays > 0 ? `${rate.toFixed(1)}%` : '0.0%',
      rawAttendancePct: rate,
    };
  });

  // Optional status filter on attendance behavior
  const statusUpper = String(query.status || '').toUpperCase();
  if (statusUpper === 'HAS_ABSENCE') rows = rows.filter(r => r.absent > 0);
  else if (statusUpper === 'HAS_LATE') rows = rows.filter(r => r.late > 0);
  else if (statusUpper === 'BELOW_85') rows = rows.filter(r => r.workingDays > 0 && r.rawAttendancePct < 85);

  const overallRate = formatPct(totalAttNumerator, totalWorkingDays);
  const totalsRow = rows.length
    ? {
        name: 'Total / Overall',
        department: `${rows.length} staff`,
        workingDays: totalWorkingDays,
        present: totalPresent,
        approvedLeave: totalApprovedLeave,
        absent: totalUnapprovedAbsent,
        late: totalLate,
        attendancePct: overallRate,
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters([
      ['month', month, 'Month'],
      ['departmentId', deptFilter?.nameLower || query.departmentId, 'Department'],
      ['staffId', query.staffId, 'Staff'],
      ['status', query.status, 'Status'],
    ]),
    kpis: [
      { label: 'Employees', value: formatNum(rows.length), tone: 'info' },
      { label: 'Attendance rate %', value: overallRate, tone: 'success' },
      { label: 'Late arrivals', value: formatNum(totalLate), tone: totalLate > 0 ? 'warning' : 'default' },
      { label: 'Unapproved absences', value: formatNum(totalUnapprovedAbsent), tone: totalUnapprovedAbsent > 0 ? 'danger' : 'default' },
    ],
    columns: [
      { key: 'name', label: 'Employee', align: 'left' },
      { key: 'department', label: 'Department', align: 'left' },
      { key: 'workingDays', label: 'Working days', align: 'right' },
      { key: 'present', label: 'Present', align: 'right' },
      { key: 'approvedLeave', label: 'Approved leave', align: 'right' },
      { key: 'absent', label: 'Absent', align: 'right' },
      { key: 'late', label: 'Late', align: 'right' },
      { key: 'attendancePct', label: 'Attendance %', align: 'right' },
    ],
    rows,
    totalsRow,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: totalUnapprovedAbsent > 0 ? 'warning' : 'info',
      message: `${month}: ${totalPresent} present days (${totalLate} late), ${totalApprovedLeave} approved leave days, and ${totalUnapprovedAbsent} unapproved absences tracked separately.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 34 — HR Leave Register & Policy-Year Leave Balances
// ---------------------------------------------------------------------------

async function buildHrLeaveRegister(query = {}) {
  const deptFilter = await resolveDepartmentFilter(query.departmentId);
  const leaveFilter = { applicantType: 'STAFF' };

  applyMultiStringFilter(leaveFilter, 'leaveType', query.leaveType, { caseInsensitive: true });
  applyMultiStringFilter(leaveFilter, 'status', query.status, { caseInsensitive: true });
  if (query.dateFrom || query.dateTo) {
    const { startStr, endStr } = safeDateRange(query.dateFrom, query.dateTo, 365);
    if (query.dateFrom) leaveFilter.toDate = { $gte: startStr };
    if (query.dateTo) leaveFilter.fromDate = { $lte: endStr };
  }

  const policyYear = query.dateFrom && /^\d{4}/.test(String(query.dateFrom))
    ? String(query.dateFrom).slice(0, 4)
    : String(new Date().getFullYear());
  const yearStart = `${policyYear}-01-01`;
  const yearEnd = `${policyYear}-12-31`;

  const [leaves, activeStaff, policyLeaves] = await Promise.all([
    Leave.find(leaveFilter)
      .populate({
        path: 'staffId',
        select: 'name staffId departmentId empDepartment',
        populate: { path: 'departmentId', select: 'name' },
      })
      .populate('approvedBy', 'name')
      .sort({ fromDate: -1, createdAt: -1 })
      .lean(),
    Staff.find({ status: 'ACTIVE' })
      .populate('departmentId', 'name')
      .select('name staffId departmentId empDepartment leaveSettings')
      .sort({ name: 1 })
      .lean(),
    Leave.find({
      applicantType: 'STAFF',
      fromDate: { $lte: yearEnd },
      toDate: { $gte: yearStart },
    }).lean(),
  ]);

  const filteredLeaves = leaves.filter(l => !deptFilter || (l.staffId && matchesDepartment(l.staffId, deptFilter)));

  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let totalDays = 0;

  const rows = filteredLeaves.map(l => {
    const st = String(l.status || 'PENDING').toUpperCase();
    if (st === 'APPROVED') approvedCount += 1;
    else if (st === 'REJECTED') rejectedCount += 1;
    else pendingCount += 1;

    const days = Number(l.days) || (daysBetween(l.fromDate, l.toDate || l.fromDate) + 1);
    totalDays += days;
    const auditApprover = Array.isArray(l.actionAudit)
      ? [...l.actionAudit].reverse().find(a => /APPROVED|REJECTED/i.test(a.action || ''))?.byName
      : '';
    const approver = l.approvedBy?.name || auditApprover || (st === 'APPROVED' ? 'HR Admin' : '—');

    return {
      _rowId: String(l._id),
      employeeName: l.staffId?.name || 'Unknown Staff',
      department: l.staffId ? staffDeptName(l.staffId) : '—',
      leaveType: String(l.leaveType || 'CASUAL').toUpperCase(),
      fromDate: formatDate(l.fromDate),
      toDate: formatDate(l.toDate),
      days,
      status: st,
      approvedBy: approver,
    };
  });

  // Policy-Year Leave Balances (opening quotas - used - pending = closing)
  const usedMap = new Map();
  const pendingMap = new Map();
  const addDays = (map, sid, typeKey, d) => {
    if (!map.has(sid)) map.set(sid, { casual: 0, sick: 0, annual: 0, total: 0 });
    const entry = map.get(sid);
    entry[typeKey] = (entry[typeKey] || 0) + d;
    entry.total += d;
  };

  policyLeaves.forEach(l => {
    const sid = l.staffId ? String(l.staffId) : '';
    if (!sid) return;
    const st = String(l.status || 'PENDING').toUpperCase();
    const d = Number(l.days) || (daysBetween(l.fromDate, l.toDate || l.fromDate) + 1);
    const lt = String(l.leaveType || 'CASUAL').toUpperCase();
    const typeKey = lt === 'SICK' || lt === 'SK' ? 'sick' : (lt === 'ANNUAL' || lt === 'AL' ? 'annual' : 'casual');
    if (st === 'APPROVED') addDays(usedMap, sid, typeKey, d);
    else if (st === 'PENDING') addDays(pendingMap, sid, typeKey, d);
  });

  const deptStaff = activeStaff.filter(s => matchesDepartment(s, deptFilter));
  const balanceRows = deptStaff.map(s => {
    const sid = String(s._id);
    const ls = s.leaveSettings || {};
    const openCasual = Number(ls.casualAllowed || 0);
    const openSick = Number(ls.sickAllowed || 0);
    const openAnnual = Number(ls.annualAllowed || 0);
    const openingQuota = openCasual + openSick + openAnnual;
    const usedObj = usedMap.get(sid) || { casual: 0, sick: 0, annual: 0, total: 0 };
    const pendingObj = pendingMap.get(sid) || { casual: 0, sick: 0, annual: 0, total: 0 };
    const closingBalance = openingQuota - usedObj.total - pendingObj.total;

    return {
      employeeName: s.name || '—',
      department: staffDeptName(s),
      openingQuota,
      used: usedObj.total,
      pending: pendingObj.total,
      closingBalance,
      casualClosing: openCasual - usedObj.casual - pendingObj.casual,
      sickClosing: openSick - usedObj.sick - pendingObj.sick,
      annualClosing: openAnnual - usedObj.annual - pendingObj.annual,
    };
  });

  const totalsRow = rows.length
    ? {
        employeeName: 'Total',
        leaveType: `${rows.length} application(s)`,
        fromDate: '—',
        toDate: '—',
        days: totalDays,
        status: `${approvedCount} Appr / ${pendingCount} Pend`,
        approvedBy: '—',
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters([
      ['dateFrom', query.dateFrom, 'From'],
      ['dateTo', query.dateTo, 'To'],
      ['departmentId', deptFilter?.nameLower || query.departmentId, 'Department'],
      ['leaveType', query.leaveType, 'Leave type'],
      ['status', query.status, 'Status'],
    ]),
    kpis: [
      { label: 'Applications', value: formatNum(rows.length), tone: 'info' },
      { label: 'Approved', value: formatNum(approvedCount), tone: 'success' },
      { label: 'Pending', value: formatNum(pendingCount), tone: pendingCount > 0 ? 'warning' : 'default' },
      { label: 'Rejected', value: formatNum(rejectedCount), tone: rejectedCount > 0 ? 'danger' : 'default' },
    ],
    columns: [
      { key: 'employeeName', label: 'Employee', align: 'left' },
      { key: 'leaveType', label: 'Leave type', align: 'left' },
      { key: 'fromDate', label: 'From', align: 'left' },
      { key: 'toDate', label: 'To', align: 'left' },
      { key: 'days', label: 'Days', align: 'right' },
      { key: 'status', label: 'Status', align: 'center' },
      { key: 'approvedBy', label: 'Approved by', align: 'left' },
    ],
    rows,
    totalsRow,
    charts: [],
    secondaryTables: [
      {
        title: 'Policy-Year Leave Balances',
        subtitle: `Policy year ${policyYear}: Closing = Opening quota - Used (approved) - Pending`,
        columns: [
          { key: 'employeeName', label: 'Employee', align: 'left' },
          { key: 'department', label: 'Department', align: 'left' },
          { key: 'openingQuota', label: 'Opening quota', align: 'right' },
          { key: 'used', label: 'Used', align: 'right' },
          { key: 'pending', label: 'Pending', align: 'right' },
          { key: 'closingBalance', label: 'Closing balance', align: 'right' },
        ],
        rows: balanceRows,
      },
    ],
    insight: {
      severity: pendingCount > 0 ? 'warning' : 'info',
      message: `${rows.length} leave application(s) totaling ${totalDays} day(s); ${pendingCount} pending approval. Policy-year ${policyYear} balances computed for ${balanceRows.length} active staff.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 35 — Monthly Payroll Register
// ---------------------------------------------------------------------------

async function buildPayrollMonthlyRegister(query = {}, ctxOrUser = null) {
  const { reqUser, permCtx } = await resolveContext(ctxOrUser);
  const { month } = monthBounds(query.month);
  const deptFilter = await resolveDepartmentFilter(query.departmentId);

  const hasFullPayrollAccess =
    permCtx.isSuper ||
    permCtx.permissions?.all === true ||
    canViewPrivateData(permCtx, 'HR & Payroll', 'payroll');

  const payrollFilter = { month };
  applyMultiStringFilter(payrollFilter, 'status', query.status, { caseInsensitive: true });

  let restrictedSelfOnly = false;
  let allowedStaffIdSet = new Set();
  if (!hasFullPayrollAccess) {
    restrictedSelfOnly = true;
    const selfStaffId = await resolveLinkedStaffId(reqUser);
    if (!selfStaffId) {
      return {
        selectedFilters: buildSelectedFilters([['month', month, 'Month']]),
        kpis: [
          { label: 'Gross payroll', value: formatRs(0) },
          { label: 'Deductions', value: formatRs(0) },
          { label: 'Net payroll', value: formatRs(0) },
          { label: 'Employees', value: '0' },
        ],
        columns: [
          { key: 'employeeName', label: 'Employee', align: 'left' },
          { key: 'department', label: 'Department', align: 'left' },
          { key: 'basicSalary', label: 'Basic', align: 'right' },
          { key: 'allowances', label: 'Allowances', align: 'right' },
          { key: 'deductions', label: 'Deductions', align: 'right' },
          { key: 'netPay', label: 'Net pay', align: 'right' },
          { key: 'paidAmount', label: 'Paid amount', align: 'right' },
          { key: 'status', label: 'Payment', align: 'center' },
        ],
        rows: [],
        totalsRow: null,
        charts: [],
        secondaryTables: [],
        insight: {
          severity: 'warning',
          message: 'Restricted view: you do not have HR & Payroll access and no linked staff record was found for your user.',
        },
      };
    }
    payrollFilter.staffId = new mongoose.Types.ObjectId(selfStaffId);
    allowedStaffIdSet = new Set([String(selfStaffId)]);
  } else {
    applyMultiIdFilter(payrollFilter, 'staffId', query.staffId);
    allowedStaffIdSet = new Set(toObjectIds(query.staffId).map(String));
  }

  const payrolls = await Payroll.find(payrollFilter)
    .populate({
      path: 'staffId',
      select: 'name staffId departmentId empDepartment designation basicPay baseSalary',
      populate: { path: 'departmentId', select: 'name' },
    })
    .sort({ createdAt: -1 })
    .lean();

  const filtered = payrolls.filter(p => {
    if (allowedStaffIdSet.size > 0 && !allowedStaffIdSet.has(String(p.staffId?._id || p.staffId))) {
      return false;
    }
    return !deptFilter || (p.staffId && matchesDepartment(p.staffId, deptFilter));
  });

  let totalBasic = 0;
  let totalAllowances = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let totalPaid = 0;

  const rows = filtered.map(p => {
    const s = p.staffId || {};
    const basic = Number(p.currentSalary || p.basicSalary || p.baseSalary || s.basicPay || 0);
    const allowances = Number(p.totalAllowances || 0) ||
      (Number(p.travelAllowance || 0) + Number(p.houseRentAllowance || 0) + Number(p.medicalAllowance || 0) +
       Number(p.extraAllowance || 0) + Number(p.insuranceAllowance || 0) + Number(p.otherAllowance || 0));
    const deductions = Number(p.totalDeductions || 0);
    const net = Number(p.netSalary ?? Math.max(0, basic + allowances - deductions));
    const paymentsSum = Array.isArray(p.payments) && p.payments.length > 0
      ? p.payments.reduce((acc, item) => acc + Number(item.amount || 0), 0)
      : null;
    const paid = paymentsSum !== null ? paymentsSum : Number(p.paidAmount || 0);
    const status = String(p.status || 'PENDING').toUpperCase();

    totalBasic += basic;
    totalAllowances += allowances;
    totalDeductions += deductions;
    totalNet += net;
    totalPaid += paid;

    return {
      _rowId: String(p._id),
      staffId: s._id ? String(s._id) : String(p.staffId || ''),
      employeeName: s.name || 'Unknown Staff',
      department: staffDeptName(s),
      basicSalary: formatRs(basic),
      allowances: formatRs(allowances),
      deductions: formatRs(deductions),
      netPay: formatRs(net),
      paidAmount: formatRs(paid),
      status,
      // Raw numeric fields kept distinct for programmatic assertions
      rawBasicSalary: basic,
      rawAllowances: allowances,
      rawDeductions: deductions,
      netSalary: net,
      rawPaidAmount: paid,
    };
  });

  const grossPayroll = totalBasic + totalAllowances;
  const totalsRow = rows.length
    ? {
        employeeName: 'Total',
        department: `${rows.length} employee(s)`,
        basicSalary: formatRs(totalBasic),
        allowances: formatRs(totalAllowances),
        deductions: formatRs(totalDeductions),
        netPay: formatRs(totalNet),
        paidAmount: formatRs(totalPaid),
        status: `${formatPct(totalPaid, totalNet)} Paid`,
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters([
      ['month', month, 'Month'],
      ['departmentId', deptFilter?.nameLower || query.departmentId, 'Department'],
      ['status', query.status, 'Payment status'],
      ['staffId', query.staffId, 'Staff'],
    ]),
    kpis: [
      { label: 'Gross payroll', value: formatRs(grossPayroll), tone: 'info' },
      { label: 'Deductions', value: formatRs(totalDeductions), tone: totalDeductions > 0 ? 'warning' : 'default' },
      { label: 'Net payroll', value: formatRs(totalNet), tone: 'success' },
      { label: 'Employees', value: formatNum(rows.length), tone: 'default' },
    ],
    columns: [
      { key: 'employeeName', label: 'Employee', align: 'left' },
      { key: 'department', label: 'Department', align: 'left' },
      { key: 'basicSalary', label: 'Basic', align: 'right' },
      { key: 'allowances', label: 'Allowances', align: 'right' },
      { key: 'deductions', label: 'Deductions', align: 'right' },
      { key: 'netPay', label: 'Net pay', align: 'right' },
      { key: 'paidAmount', label: 'Paid amount', align: 'right' },
      { key: 'status', label: 'Payment', align: 'center' },
    ],
    rows,
    totalsRow,
    charts: [],
    secondaryTables: [],
    insight: {
      severity: restrictedSelfOnly ? 'warning' : (totalNet > totalPaid ? 'info' : 'success'),
      message: restrictedSelfOnly
        ? `Privacy filter active: showing only your own payroll record for ${month}. Net pay (${formatRs(totalNet)}) and Paid amount (${formatRs(totalPaid)}) are shown separately.`
        : `${month} payroll: Net payable ${formatRs(totalNet)} vs actual paid ${formatRs(totalPaid)} (${formatRs(Math.max(0, totalNet - totalPaid))} unpaid balance).`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 36 — Finance Income & Expense Statement
// ---------------------------------------------------------------------------

async function buildFinanceIncomeExpense(query = {}) {
  const basis = String(query.basis || 'CASH').toUpperCase() === 'ACCRUAL' ? 'ACCRUAL' : 'CASH';
  const rawStatuses = parseMulti(query.status).map(s => s.trim()).filter(Boolean);
  const statusFilter = rawStatuses.length ? rawStatuses.join(', ') : 'Approved';
  const hasAllStatus = rawStatuses.some(s => /^all$/i.test(s));
  const range = query.month && query.month !== 'all'
    ? monthBounds(query.month)
    : safeDateRange(query.dateFrom, query.dateTo, 30);
  const { start, end, startStr, endStr } = range;

  const expenseStatusMatch = hasAllStatus
    ? { status: { $ne: 'Rejected' } }
    : rawStatuses.length > 0
      ? (() => {
          const cond = {};
          applyMultiStringFilter(cond, 'status', rawStatuses.join(','), { caseInsensitive: true });
          return cond;
        })()
      : { status: { $regex: /^approved$/i } };

  const startMonth = startStr.slice(0, 7);
  const endMonth = endStr.slice(0, 7);

  const [feeReceipts, directIncomes, financeExpenses, hostelExpenses, inventoryExpenses, payrolls] = await Promise.all([
    FeePaymentReceipt.find({
      status: { $ne: 'VOID' },
      paidDate: { $gte: start, $lte: end },
    }).lean(),
    FinanceIncome.find({ date: { $gte: startStr, $lte: endStr } }).lean(),
    FinanceExpense.find({ ...expenseStatusMatch, date: { $gte: startStr, $lte: endStr } }).lean(),
    HostelExpense.find({ date: { $gte: startStr, $lte: endStr } }).lean(),
    InventoryExpense.find({ date: { $gte: startStr, $lte: endStr } }).lean(),
    basis === 'ACCRUAL'
      ? Payroll.find({ month: { $gte: startMonth, $lte: endMonth } }).lean()
      : Payroll.find({
          $or: [
            { paymentDate: { $gte: start, $lte: end } },
            { 'payments.paidAt': { $gte: start, $lte: end } },
            { paymentDate: null, paidAmount: { $gt: 0 }, month: { $gte: startMonth, $lte: endMonth } },
          ],
        }).lean(),
  ]);

  const bucketMap = new Map();
  const addEntry = (cat, inc = 0, exp = 0) => {
    const key = String(cat || 'Uncategorized').trim() || 'Uncategorized';
    if (!bucketMap.has(key)) bucketMap.set(key, { category: key, income: 0, expense: 0 });
    const row = bucketMap.get(key);
    row.income += Number(inc || 0);
    row.expense += Number(exp || 0);
  };

  feeReceipts.forEach(r => {
    const label = r.challanType === 'HostelChallan'
      ? 'Hostel / Boarding Fees'
      : (r.challanType === 'ExtraChallan' ? 'Extra Challan Fees' : 'Tuition & Academic Fees');
    addEntry(label, Number(r.amountPaid || 0), 0);
  });

  let otherIncomeTotal = 0;
  directIncomes.forEach(inc => {
    const amt = Number(inc.amount || 0);
    otherIncomeTotal += amt;
    addEntry(inc.category || 'Other Income', amt, 0);
  });

  // Payroll: CASH uses actual payments in period; ACCRUAL uses accrued netSalary
  payrolls.forEach(p => {
    let amt = 0;
    if (basis === 'ACCRUAL') {
      amt = Number(p.netSalary || 0);
    } else if (Array.isArray(p.payments) && p.payments.length > 0) {
      const inRangePayments = p.payments.filter(pay => {
        const dt = pay.paidAt ? new Date(pay.paidAt) : (pay.paymentDate ? new Date(pay.paymentDate) : null);
        return dt && dt >= start && dt <= end;
      });
      amt = inRangePayments.length > 0
        ? inRangePayments.reduce((s, pay) => s + Number(pay.amount || 0), 0)
        : (p.paymentDate && new Date(p.paymentDate) >= start && new Date(p.paymentDate) <= end
          ? Number(p.paidAmount || 0)
          : (p.paymentDate ? 0 : Number(p.paidAmount || 0)));
    } else {
      amt = Number(p.paidAmount || 0);
    }
    if (amt > 0) addEntry('Staff Payroll', 0, amt);
  });

  financeExpenses.forEach(e => addEntry(e.category || 'General Operations', 0, Number(e.amount || 0)));
  hostelExpenses.forEach(e => addEntry(`Hostel — ${e.category || 'Operations'}`, 0, Number(e.amount || 0)));
  inventoryExpenses.forEach(e => addEntry(`Inventory — ${e.expenseType || 'Maintenance'}`, 0, Number(e.amount || 0)));

  let entries = Array.from(bucketMap.values());
  if (query.category && query.category !== 'ALL' && query.category !== 'all') {
    const target = String(query.category).trim().toLowerCase();
    entries = entries.filter(e => e.category.toLowerCase().includes(target));
  }
  entries.sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

  const totalIncome = entries.reduce((s, e) => s + e.income, 0);
  const totalExpense = entries.reduce((s, e) => s + e.expense, 0);
  const netMovement = totalIncome - totalExpense;

  const rows = entries.map(e => ({
    category: e.category,
    income: formatRs(e.income),
    expense: formatRs(e.expense),
    net: formatRs(e.income - e.expense),
    shareOfExpense: totalExpense > 0 ? formatPct(e.expense, totalExpense) : '0.0%',
    rawIncome: e.income,
    rawExpense: e.expense,
    rawNet: e.income - e.expense,
  }));

  const totalsRow = rows.length
    ? {
        category: 'Total',
        income: formatRs(totalIncome),
        expense: formatRs(totalExpense),
        net: formatRs(netMovement),
        shareOfExpense: totalExpense > 0 ? '100.0%' : '0.0%',
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters([
      ['month', query.month, 'Month'],
      ['dateFrom', startStr, 'From'],
      ['dateTo', endStr, 'To'],
      ['category', query.category, 'Category'],
      ['status', statusFilter, 'Expense status'],
      ['basis', basis, 'Accounting basis'],
    ]),
    kpis: [
      { label: 'Income', value: formatRs(totalIncome), tone: 'success' },
      { label: 'Expenses', value: formatRs(totalExpense), tone: totalExpense > totalIncome ? 'danger' : 'warning' },
      { label: 'Net movement', value: formatRs(netMovement), tone: netMovement >= 0 ? 'success' : 'danger' },
      { label: 'Other income', value: formatRs(otherIncomeTotal), tone: 'info' },
    ],
    columns: [
      { key: 'category', label: 'Category', align: 'left' },
      { key: 'income', label: 'Income', align: 'right' },
      { key: 'expense', label: 'Expense', align: 'right' },
      { key: 'net', label: 'Net', align: 'right' },
      { key: 'shareOfExpense', label: '% of expense', align: 'right' },
    ],
    rows,
    totalsRow,
    charts: rows.length
      ? [{
          id: 'income-vs-expense-bar',
          title: 'Income vs Expense by Category',
          type: 'bar',
          xKey: 'category',
          yKey: 'income',
          dataKey: 'income',
          series: [
            { dataKey: 'income', label: 'Income', color: '#16a34a' },
            { dataKey: 'expense', label: 'Expense', color: '#dc2626' },
          ],
          data: entries.map(e => ({ category: e.category, income: Number(e.income) || 0, expense: Number(e.expense) || 0 })),
        }]
      : [],
    secondaryTables: [],
    insight: {
      severity: netMovement < 0 ? 'warning' : 'info',
      message: basis === 'CASH'
        ? `Cash basis (${startStr} to ${endStr}): includes non-void FeePaymentReceipts and FinanceIncome against actual Payroll disbursements and ${statusFilter.toLowerCase()} operating expenses.`
        : `Accrual basis (${startStr} to ${endStr}): includes non-void FeePaymentReceipts and FinanceIncome against accrued monthly Payroll liabilities (netSalary) and ${statusFilter.toLowerCase()} operating expenses.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 37 — Cash & Bank Book
// ---------------------------------------------------------------------------

async function buildFinanceCashBankBook(query = {}) {
  const { startStr, endStr } = safeDateRange(query.dateFrom, query.dateTo, 30);

  const walletFilter = {};
  if (query.status) {
    applyMultiStringFilter(walletFilter, 'status', query.status, { uppercase: true });
  } else {
    walletFilter.status = 'ACTIVE';
  }
  applyMultiStringFilter(walletFilter, 'type', query.accountType, { uppercase: true });
  applyMultiIdFilter(walletFilter, '_id', query.walletId);

  const wallets = await Wallet.find(walletFilter).sort({ type: 1, name: 1 }).lean();
  const walletMap = new Map(wallets.map(w => [String(w._id), w]));
  const walletIds = wallets.map(w => w._id);

  const txList = walletIds.length
    ? await WalletTransaction.find({
        $or: [{ sourceWallet: { $in: walletIds } }, { destinationWallet: { $in: walletIds } }],
        transactionType: { $nin: ['OPENING_BALANCE', 'WALLET_CREATED', 'WALLET_UPDATED'] },
      })
        .sort({ date: 1, createdAt: 1 })
        .lean()
    : [];

  // Track per-wallet opening, pre-period net, in-period receipts/payments, post-period net
  const walletStats = new Map();
  wallets.forEach(w => {
    walletStats.set(String(w._id), {
      wallet: w,
      preNet: 0,
      inReceipts: 0,
      inPayments: 0,
      postNet: 0,
    });
  });

  const ledgerEvents = [];

  for (const tx of txList) {
    const txDate = String(tx.date || toLocalDateStr(tx.createdAt || new Date())).slice(0, 10);
    const amt = Number(tx.amount || 0);
    const srcId = tx.sourceWallet ? String(tx.sourceWallet) : null;
    const dstId = tx.destinationWallet ? String(tx.destinationWallet) : null;

    const recordImpact = (wId, delta) => {
      const st = walletStats.get(wId);
      if (!st) return;
      if (txDate < startStr) {
        st.preNet += delta;
      } else if (txDate > endStr) {
        st.postNet += delta;
      } else {
        const receipt = delta >= 0 ? delta : 0;
        const payment = delta < 0 ? Math.abs(delta) : 0;
        st.inReceipts += receipt;
        st.inPayments += payment;
        ledgerEvents.push({
          txDate,
          createdAt: tx.createdAt ? new Date(tx.createdAt).getTime() : 0,
          voucherNo: tx.referenceNo || tx.challanNumber || `TX-${String(tx._id).slice(-6).toUpperCase()}`,
          description: tx.description || tx.sourceCategory || tx.transactionType || 'Transaction',
          account: st.wallet.name,
          accountType: st.wallet.type,
          receipt,
          payment,
        });
      }
    };

    if (srcId && walletMap.has(srcId)) {
      recordImpact(srcId, -amt);
    }
    if (dstId && walletMap.has(dstId)) {
      recordImpact(dstId, amt);
    }
  }

  let totalOpening = 0;
  let totalReceipts = 0;
  let totalPayments = 0;
  let totalClosing = 0;
  let activeCashClosing = 0;
  let activeBankClosing = 0;

  const walletClosingRows = wallets.map(w => {
    const st = walletStats.get(String(w._id));
    const hasExplicitOpening = Number(w.openingDebit || 0) !== 0 || Number(w.openingCredit || 0) !== 0;
    // Use openingDebit - openingCredit + pre-period flows; if zero-opening wallet relies on currentBalance, back-calculate
    const opening = hasExplicitOpening
      ? (Number(w.openingDebit || 0) - Number(w.openingCredit || 0)) + st.preNet
      : (Number(w.currentBalance || 0) - (st.inReceipts - st.inPayments) - st.postNet);
    const closing = opening + st.inReceipts - st.inPayments;

    totalOpening += opening;
    totalReceipts += st.inReceipts;
    totalPayments += st.inPayments;
    totalClosing += closing;

    if (w.status === 'ACTIVE') {
      if (w.type === 'CASH') activeCashClosing += closing;
      else if (w.type === 'BANK') activeBankClosing += closing;
    }

    return {
      walletName: w.name,
      type: w.type,
      status: w.status,
      openingBalance: formatRs(opening),
      receipts: formatRs(st.inReceipts),
      payments: formatRs(st.inPayments),
      closingBalance: formatRs(closing),
    };
  });

  ledgerEvents.sort((a, b) => {
    const dCmp = a.txDate.localeCompare(b.txDate);
    return dCmp !== 0 ? dCmp : a.createdAt - b.createdAt;
  });

  let runningBalance = totalOpening;
  const rows = ledgerEvents.map(ev => {
    runningBalance += ev.receipt - ev.payment;
    return {
      date: formatDate(ev.txDate),
      voucherNo: ev.voucherNo,
      description: ev.description,
      account: ev.account,
      receipt: ev.receipt > 0 ? formatRs(ev.receipt) : '—',
      payment: ev.payment > 0 ? formatRs(ev.payment) : '—',
      balance: formatRs(runningBalance),
      rawReceipt: ev.receipt,
      rawPayment: ev.payment,
      rawBalance: runningBalance,
    };
  });

  const totalsRow = {
    date: 'Period Total',
    voucherNo: `${rows.length} entry(s)`,
    description: `Opening ${formatRs(totalOpening)} -> Closing ${formatRs(totalClosing)}`,
    account: `${wallets.length} wallet(s)`,
    receipt: formatRs(totalReceipts),
    payment: formatRs(totalPayments),
    balance: formatRs(totalClosing),
  };

  return {
    selectedFilters: buildSelectedFilters([
      ['dateFrom', startStr, 'From'],
      ['dateTo', endStr, 'To'],
      ['accountType', query.accountType, 'Account type'],
      ['walletId', query.walletId, 'Wallet'],
      ['status', query.status, 'Wallet status'],
    ]),
    kpis: [
      { label: 'Opening', value: formatRs(totalOpening), tone: 'default' },
      { label: 'Receipts', value: formatRs(totalReceipts), tone: 'success' },
      { label: 'Payments', value: formatRs(totalPayments), tone: 'warning' },
      { label: 'Closing', value: formatRs(totalClosing), tone: 'info' },
    ],
    columns: [
      { key: 'date', label: 'Date', align: 'left' },
      { key: 'voucherNo', label: 'Voucher', align: 'left' },
      { key: 'description', label: 'Description', align: 'left' },
      { key: 'account', label: 'Account', align: 'left' },
      { key: 'receipt', label: 'Receipt', align: 'right' },
      { key: 'payment', label: 'Payment', align: 'right' },
      { key: 'balance', label: 'Balance', align: 'right' },
    ],
    rows,
    totalsRow,
    charts: [],
    secondaryTables: [
      {
        title: 'Active Cash vs Bank Wallet Closing Balances',
        subtitle: `Cash closing: ${formatRs(activeCashClosing)} | Bank closing: ${formatRs(activeBankClosing)}`,
        columns: [
          { key: 'walletName', label: 'Account / Wallet', align: 'left' },
          { key: 'type', label: 'Type', align: 'center' },
          { key: 'status', label: 'Status', align: 'center' },
          { key: 'openingBalance', label: 'Opening balance', align: 'right' },
          { key: 'receipts', label: 'Receipts', align: 'right' },
          { key: 'payments', label: 'Payments', align: 'right' },
          { key: 'closingBalance', label: 'Closing balance', align: 'right' },
        ],
        rows: walletClosingRows,
      },
    ],
    insight: {
      severity: totalClosing < 0 ? 'warning' : 'info',
      message: `${startStr} to ${endStr}: Opening ${formatRs(totalOpening)} + Receipts ${formatRs(totalReceipts)} - Payments ${formatRs(totalPayments)} = Closing ${formatRs(totalClosing)} (Active Cash: ${formatRs(activeCashClosing)}, Active Bank: ${formatRs(activeBankClosing)}).`,
    },
  };
}

// ---------------------------------------------------------------------------
// Catalog & Exports
// ---------------------------------------------------------------------------

const CATALOG = [
  {
    key: 'staff-employee-register',
    pageNumber: 32,
    module: 'Staff',
    category: 'Staff',
    categoryKey: 'Staff',
    rbacModule: 'Staff',
    rbacSubModule: 'reports',
    title: 'Staff & Faculty Employee Register',
    purpose: 'Directory of teaching, administrative, and support personnel with RBAC-protected contact and salary visibility.',
    filterSchema: [
      { key: 'departmentId', label: 'Department', type: 'select', optionsSource: 'departments' },
      { key: 'designation', label: 'Designation', type: 'text' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'TERMINATED', label: 'Terminated' },
          { value: 'RETIRED', label: 'Retired' },
        ],
      },
      { key: 'dateFrom', label: 'Joined From', type: 'date' },
      { key: 'dateTo', label: 'Joined To', type: 'date' },
      { key: 'search', label: 'Search', type: 'text' },
    ],
  },
  {
    key: 'staff-attendance-punctuality',
    pageNumber: 33,
    module: 'HR & Payroll',
    category: 'HR & Payroll',
    categoryKey: 'HR & Payroll',
    rbacModule: 'HR & Payroll',
    rbacSubModule: 'reports',
    altRbacModule: 'Staff',
    altRbacSubModule: 'reports',
    title: 'Staff Attendance & Punctuality',
    purpose: 'Monthly staff presence, late arrivals, approved leaves, and unapproved absences tracked separately.',
    filterSchema: [
      { key: 'month', label: 'Month (YYYY-MM)', type: 'month' },
      { key: 'departmentId', label: 'Department', type: 'select', optionsSource: 'departments' },
      { key: 'staffId', label: 'Employee', type: 'select', optionsSource: 'staff' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'Active Staff' },
          { value: 'ALL', label: 'All Staff' },
          { value: 'HAS_ABSENCE', label: 'With Unapproved Absence' },
          { value: 'HAS_LATE', label: 'With Late Arrivals' },
          { value: 'BELOW_85', label: 'Below 85% Attendance' },
        ],
      },
    ],
  },
  {
    key: 'hr-leave-register',
    pageNumber: 34,
    module: 'HR & Payroll',
    category: 'HR & Payroll',
    categoryKey: 'HR & Payroll',
    rbacModule: 'HR & Payroll',
    rbacSubModule: 'reports',
    title: 'HR Leave Register & Balances',
    purpose: 'Staff leave applications register with policy-year quota, used, pending, and closing leave balances.',
    filterSchema: [
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'departmentId', label: 'Department', type: 'select', optionsSource: 'departments' },
      {
        key: 'leaveType',
        label: 'Leave Type',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'CASUAL', label: 'Casual' },
          { value: 'SICK', label: 'Sick' },
          { value: 'ANNUAL', label: 'Annual' },
        ],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
        ],
      },
    ],
  },
  {
    key: 'payroll-monthly-register',
    pageNumber: 35,
    module: 'HR & Payroll',
    category: 'HR & Payroll',
    categoryKey: 'HR & Payroll',
    rbacModule: 'HR & Payroll',
    rbacSubModule: 'reports',
    title: 'Monthly Payroll Register',
    purpose: 'Monthly employee salary register showing net pay separately from paid amount and RBAC self-service scoping.',
    filterSchema: [
      { key: 'month', label: 'Month (YYYY-MM)', type: 'month' },
      { key: 'departmentId', label: 'Department', type: 'select', optionsSource: 'departments' },
      {
        key: 'status',
        label: 'Payment Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PAID', label: 'Paid' },
          { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'UNPAID', label: 'Unpaid' },
        ],
      },
      { key: 'staffId', label: 'Employee', type: 'select', optionsSource: 'staff' },
    ],
  },
  {
    key: 'finance-income-expense',
    pageNumber: 36,
    module: 'Finance',
    category: 'Finance',
    categoryKey: 'Finance',
    rbacModule: 'Finance',
    rbacSubModule: 'reports',
    title: 'Income & Expense Statement',
    purpose: 'Category-wise institutional income vs expenditure summary supporting Cash and Accrual basis.',
    filterSchema: [
      { key: 'month', label: 'Month (YYYY-MM)', type: 'month' },
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'category', label: 'Category', type: 'text' },
      {
        key: 'status',
        label: 'Expense Status',
        type: 'select',
        options: [
          { value: 'Approved', label: 'Approved' },
          { value: 'Posted', label: 'Posted' },
          { value: 'ALL', label: 'All (excl. Rejected)' },
        ],
      },
      {
        key: 'basis',
        label: 'Basis',
        type: 'select',
        options: [
          { value: 'CASH', label: 'Cash Basis' },
          { value: 'ACCRUAL', label: 'Accrual Basis' },
        ],
      },
    ],
  },
  {
    key: 'finance-cash-bank-book',
    pageNumber: 37,
    module: 'Finance',
    category: 'Finance',
    categoryKey: 'Finance',
    rbacModule: 'Finance',
    rbacSubModule: 'reports',
    title: 'Cash & Bank Book',
    purpose: 'Chronological treasury ledger of cash, bank, and digital wallet inflows, outflows, and closing balances.',
    filterSchema: [
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      {
        key: 'accountType',
        label: 'Account Type',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'CASH', label: 'Cash' },
          { value: 'BANK', label: 'Bank' },
          { value: 'DIGITAL_WALLET', label: 'Digital Wallet' },
        ],
      },
      { key: 'walletId', label: 'Wallet / Account', type: 'select', optionsSource: 'wallets' },
      {
        key: 'status',
        label: 'Wallet Status',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
          { value: 'ALL', label: 'All' },
        ],
      },
    ],
  },
];

const HANDLERS = {
  'staff-employee-register': buildStaffEmployeeRegister,
  'staff-attendance-punctuality': buildStaffAttendancePunctuality,
  'hr-leave-register': buildHrLeaveRegister,
  'payroll-monthly-register': buildPayrollMonthlyRegister,
  'finance-income-expense': buildFinanceIncomeExpense,
  'finance-cash-bank-book': buildFinanceCashBankBook,
};

const ACTIONS = {};

module.exports = {
  CATALOG,
  HANDLERS,
  ACTIONS,
  buildStaffEmployeeRegister,
  buildStaffAttendancePunctuality,
  buildHrLeaveRegister,
  buildPayrollMonthlyRegister,
  buildFinanceIncomeExpense,
  buildFinanceCashBankBook,
};
