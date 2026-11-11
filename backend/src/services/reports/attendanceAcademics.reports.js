const mongoose = require('mongoose');
const {
  Attendance,
  Holiday,
  AttendanceSkip,
  Leave,
  Student,
  Program,
  Class,
  Section,
  Subject,
  SubjectClassMapping,
  TeacherMapping,
  SyllabusPlan,
  Staff,
  ActivityLog,
} = require('../../models');
const { ACTIVE_STUDENT_FILTER, isStudentActive } = require('../../utils/studentStatus');
const {
  parseMulti,
  applyMultiIdFilter,
  applyMultiStringFilter,
  matchesMultiValue,
  parseBooleanFlag,
  toObjectIds,
  resolveSession,
  formatNum,
  formatPct,
  pctValue,
  formatDate,
  fullName,
} = require('./reportHelpers');

// ---------------------------------------------------------------------------
// Shared Date, Calendar & Attendance Helpers (ponytail: single calendar helper)
// ---------------------------------------------------------------------------

function extractId(val) {
  if (!val) return '';
  if (typeof val === 'object') return String(val._id || val.id || '');
  return String(val);
}

function getReqUser(ctx) {
  if (!ctx) return null;
  if (ctx.reqUser !== undefined) return ctx.reqUser;
  return ctx.id || ctx._id ? ctx : null;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeYmd(input, fallback = todayYmd()) {
  if (!input) return fallback;
  const str = String(input).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : fallback;
}

function expandYmdRange(fromStr, toStr) {
  const dates = [];
  const start = normalizeYmd(fromStr, '');
  const end = normalizeYmd(toStr || fromStr, start);
  if (!start || !end || start > end) return dates;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd, 12, 0, 0);
  const last = new Date(ey, em - 1, ed, 12, 0, 0);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function loadHolidayAndSkipMaps(startStr, endStr, classIds = []) {
  const holidayFilter = {
    $or: [
      { date: { $gte: startStr, $lte: endStr } },
      { date: { $lte: endStr }, endDate: { $gte: startStr } },
    ],
  };
  const skipFilter = { date: { $gte: startStr, $lte: endStr } };
  if (classIds.length > 0) skipFilter.classId = { $in: classIds };

  const [holidays, skips] = await Promise.all([
    Holiday.find(holidayFilter).lean(),
    AttendanceSkip.find(skipFilter).lean(),
  ]);

  const holidayMap = new Map();
  holidays.forEach(h => {
    const dates = expandYmdRange(h.date, h.endDate || h.date);
    dates.forEach(d => {
      if (d >= startStr && d <= endStr) holidayMap.set(d, h.title || 'Holiday');
    });
  });

  const skipMap = new Map();
  skips.forEach(sk => {
    const cId = extractId(sk.classId);
    const secId = sk.sectionId ? extractId(sk.sectionId) : '*';
    skipMap.set(`${cId}_${secId}_${sk.date}`, sk.reason || 'Class Skip');
  });

  const isSkipForStudent = (student, dateStr) => {
    const cId = extractId(student.classId);
    const secId = extractId(student.sectionId);
    return skipMap.get(`${cId}_*_${dateStr}`) || (secId ? skipMap.get(`${cId}_${secId}_${dateStr}`) : null) || null;
  };

  return { holidayMap, skipMap, isSkipForStudent };
}

async function fetchActiveStudents(query = {}) {
  const filter = { ...ACTIVE_STUDENT_FILTER };
  applyMultiIdFilter(filter, 'programId', query.programId);
  applyMultiIdFilter(filter, 'classId', query.classId);
  applyMultiIdFilter(filter, 'sectionId', query.sectionId);

  return Student.find(filter)
    .populate('programId', 'name code')
    .populate('classId', 'name allowSections')
    .populate('sectionId', 'name')
    .sort({ rollNumber: 1 })
    .lean();
}

// ---------------------------------------------------------------------------
// 10. Page 28 — Daily Student Attendance
// ---------------------------------------------------------------------------

async function buildDailyStudentAttendance(query = {}) {
  const targetDate = normalizeYmd(query.asOfDate, todayYmd());
  const students = await fetchActiveStudents(query);
  const studentIds = students.map(s => s._id);
  const classIds = [...new Set(students.map(s => s.classId?._id || s.classId).filter(Boolean))];

  const [attRecords, approvedLeaves, { holidayMap, isSkipForStudent }] = await Promise.all([
    studentIds.length
      ? Attendance.find({ role: 'STUDENT', date: targetDate, studentId: { $in: studentIds } })
          .sort({ updatedAt: -1, markedAt: -1 })
          .lean()
      : [],
    studentIds.length
      ? Leave.find({
          applicantType: 'STUDENT',
          studentId: { $in: studentIds },
          status: { $regex: /^approved$/i },
          fromDate: { $lte: targetDate },
          toDate: { $gte: targetDate },
        }).lean()
      : [],
    loadHolidayAndSkipMaps(targetDate, targetDate, classIds),
  ]);

  const attMap = new Map();
  attRecords.forEach(r => {
    const sId = extractId(r.studentId);
    if (!attMap.has(sId)) attMap.set(sId, r);
  });
  const leaveMap = new Map(approvedLeaves.map(l => [extractId(l.studentId), l]));
  const holidayTitle = holidayMap.get(targetDate) || null;

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;
  let unmarkedCount = 0;

  const allRows = students.map(s => {
    const sId = String(s._id);
    const rec = attMap.get(sId);
    const lv = leaveMap.get(sId);
    const skipReason = isSkipForStudent(s, targetDate);

    let effectiveStatus = 'UNMARKED';
    let markedAtLabel = '—';

    if (rec && rec.status) {
      const hasManualCorrection = Array.isArray(rec.correctionAudit) && rec.correctionAudit.length > 0;
      const rawSt = String(rec.status).toUpperCase();
      if (lv && !hasManualCorrection && rawSt !== 'LEAVE') {
        effectiveStatus = 'LEAVE';
        markedAtLabel = 'Approved Leave';
      } else {
        if (rawSt === 'HALF_DAY') effectiveStatus = 'PRESENT';
        else if (rawSt === 'HD' || rawSt === 'HOLIDAY') effectiveStatus = 'HOLIDAY';
        else effectiveStatus = rawSt;
        markedAtLabel = rec.markedAt
          ? new Date(rec.markedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : 'Recorded';
      }
    } else if (lv) {
      effectiveStatus = 'LEAVE';
      markedAtLabel = 'Approved Leave';
    } else if (holidayTitle || skipReason) {
      effectiveStatus = holidayTitle ? 'HOLIDAY' : 'SKIP';
      markedAtLabel = holidayTitle || skipReason;
    }

    if (effectiveStatus === 'PRESENT') {
      presentCount += 1;
    } else if (effectiveStatus === 'LATE') {
      lateCount += 1;
      presentCount += 1;
    } else if (effectiveStatus === 'ABSENT') {
      absentCount += 1;
    } else if (effectiveStatus === 'LEAVE') {
      leaveCount += 1;
    } else if (effectiveStatus === 'UNMARKED') {
      unmarkedCount += 1;
    }

    return {
      rollNumber: s.rollNumber || '—',
      studentName: fullName(s) || 'Student',
      programName: s.programId?.name || '—',
      className: s.classId?.name || '—',
      sectionName: s.sectionId?.name || '—',
      status: effectiveStatus,
      markedAt: markedAtLabel,
      actionContext: {
        studentId: sId,
        classId: extractId(s.classId),
        sectionId: extractId(s.sectionId) || null,
        date: targetDate,
        attendanceId: rec ? String(rec._id) : null,
        newStatus: effectiveStatus === 'UNMARKED' ? 'PRESENT' : effectiveStatus,
      },
      _meta: {
        studentId: sId,
        classId: extractId(s.classId),
        sectionId: extractId(s.sectionId) || null,
        date: targetDate,
        attendanceId: rec ? String(rec._id) : null,
        correctionPending: Boolean(rec?.correctionPending),
        correctionCount: Array.isArray(rec?.correctionAudit) ? rec.correctionAudit.length : 0,
      },
    };
  });

  const statusValues = parseMulti(query.status)
    .map(s => s.trim().toUpperCase())
    .filter(s => s && s !== 'ALL');
  const rows = statusValues.length === 0
    ? allRows
    : allRows.filter(r => statusValues.includes(r.status));

  return {
    selectedFilters: [
      { label: 'Date', value: formatDate(targetDate) },
      ...(statusValues.length > 0 ? [{ label: 'Status', value: statusValues.join(', ') }] : []),
    ],
    kpis: [
      { label: 'Expected', value: formatNum(students.length) },
      { label: 'Present', value: formatNum(presentCount), tone: 'success' },
      { label: 'Absent', value: formatNum(absentCount), tone: absentCount > 0 ? 'danger' : 'default' },
      { label: 'Late', value: formatNum(lateCount), tone: lateCount > 0 ? 'warning' : 'default' },
    ],
    columns: [
      { key: 'rollNumber', label: 'Student ID', align: 'left' },
      { key: 'studentName', label: 'Student', align: 'left' },
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'className', label: 'Class', align: 'left' },
      { key: 'sectionName', label: 'Section', align: 'left' },
      { key: 'status', label: 'Status', align: 'center' },
      { key: 'markedAt', label: 'Marked at', align: 'right' },
    ],
    rows,
    totalsRow: null,
    insight: {
      severity: unmarkedCount > 0 || absentCount > 0 ? 'warning' : 'success',
      message: `${formatDate(targetDate)}: ${presentCount} present (incl. ${lateCount} late), ${absentCount} absent, ${leaveCount} on approved leave, ${unmarkedCount} unmarked out of ${students.length} expected active students.${holidayTitle ? ` Marked holiday: ${holidayTitle}.` : ''}`,
    },
  };
}

// ---------------------------------------------------------------------------
// 11. Page 29 — Monthly Student Attendance Register
// ---------------------------------------------------------------------------

async function buildMonthlyRegister(query = {}) {
  const defaultMonth = todayYmd().slice(0, 7);
  const targetMonth = /^\d{4}-\d{2}$/.test(String(query.month || '')) ? String(query.month) : defaultMonth;
  const [year, monthNum] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const startStr = `${targetMonth}-01`;
  const endStr = `${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;

  const students = await fetchActiveStudents(query);
  const studentIds = students.map(s => s._id);
  const classIds = [...new Set(students.map(s => s.classId?._id || s.classId).filter(Boolean))];

  const [attRecords, approvedLeaves, { holidayMap, isSkipForStudent }] = await Promise.all([
    studentIds.length
      ? Attendance.find({
          role: 'STUDENT',
          studentId: { $in: studentIds },
          date: { $gte: startStr, $lte: endStr },
        }).lean()
      : [],
    studentIds.length
      ? Leave.find({
          applicantType: 'STUDENT',
          studentId: { $in: studentIds },
          status: { $regex: /^approved$/i },
          fromDate: { $lte: endStr },
          toDate: { $gte: startStr },
        }).lean()
      : [],
    loadHolidayAndSkipMaps(startStr, endStr, classIds),
  ]);

  const attByStudentDate = new Map();
  const datesWithAnyAttendance = new Set();
  attRecords.forEach(r => {
    const sId = extractId(r.studentId);
    const dStr = normalizeYmd(r.date, '');
    if (!dStr) return;
    datesWithAnyAttendance.add(dStr);
    if (!attByStudentDate.has(sId)) attByStudentDate.set(sId, new Map());
    attByStudentDate.get(sId).set(dStr, String(r.status || '').toUpperCase());
  });

  const leaveByStudentDate = new Map();
  approvedLeaves.forEach(l => {
    const sId = extractId(l.studentId);
    if (!leaveByStudentDate.has(sId)) leaveByStudentDate.set(sId, new Set());
    const set = leaveByStudentDate.get(sId);
    expandYmdRange(l.fromDate, l.toDate || l.fromDate).forEach(d => {
      if (d >= startStr && d <= endStr) set.add(d);
    });
  });

  const today = todayYmd();
  let workingDays = 0;
  const dayMeta = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${targetMonth}-${String(d).padStart(2, '0')}`;
    const isSunday = new Date(year, monthNum - 1, d, 12, 0, 0).getDay() === 0;
    const isGlobalHoliday = holidayMap.has(dStr);
    const hasAtt = datesWithAnyAttendance.has(dStr);
    const isSundayOff = isSunday && !hasAtt;
    const allSkipped = students.length > 0 && !hasAtt && students.every(st => Boolean(isSkipForStudent(st, dStr)));
    if (!isGlobalHoliday && !isSundayOff && !allSkipped && (targetMonth < defaultMonth || dStr <= today || hasAtt)) {
      workingDays += 1;
    }
    dayMeta.push({ d, dStr, isGlobalHoliday, isSundayOff });
  }

  let totalPresent = 0;
  let totalAbsent = 0;
  let belowThresholdCount = 0;

  const rows = students.map(s => {
    const sId = String(s._id);
    const sAtt = attByStudentDate.get(sId) || new Map();
    const sLeave = leaveByStudentDate.get(sId) || new Set();
    let presentCount = 0;
    let absentCount = 0;

    const row = {
      rollNumber: s.rollNumber || '—',
      studentName: fullName(s) || 'Student',
    };

    dayMeta.forEach(({ d, dStr, isGlobalHoliday, isSundayOff }) => {
      const st = sAtt.get(dStr);
      let code = '—';
      if (st === 'PRESENT' || st === 'HALF_DAY') {
        code = 'P';
        presentCount += 1;
      } else if (st === 'LATE') {
        code = 'L';
        presentCount += 1;
      } else if (st === 'ABSENT') {
        code = 'A';
        absentCount += 1;
      } else if (st === 'LEAVE' || (!st && sLeave.has(dStr))) {
        code = 'LV';
      } else if (st === 'HOLIDAY' || st === 'HD' || isGlobalHoliday || isSundayOff) {
        code = 'H';
      } else if (isSkipForStudent(s, dStr)) {
        code = 'S';
      }
      row[`day_${d}`] = code;
    });

    const tracked = presentCount + absentCount;
    const pct = tracked > 0 ? (presentCount / tracked) * 100 : null;
    if (pct !== null && pct < 75) belowThresholdCount += 1;
    totalPresent += presentCount;
    totalAbsent += absentCount;

    row.presentCount = presentCount;
    row.absentCount = absentCount;
    row.attendancePct = pct === null ? '—' : `${pct.toFixed(1)}%`;
    return row;
  });

  const dayColumns = dayMeta.map(({ d }) => ({
    key: `day_${d}`,
    label: String(d),
    align: 'center',
  }));

  const columns = [
    { key: 'rollNumber', label: 'Roll no.', align: 'left' },
    { key: 'studentName', label: 'Student', align: 'left' },
    ...dayColumns,
    { key: 'presentCount', label: 'Present', align: 'right' },
    { key: 'absentCount', label: 'Absent', align: 'right' },
    { key: 'attendancePct', label: '%', align: 'right' },
  ];

  const totalsRow = rows.length
    ? {
        rollNumber: 'Total',
        studentName: `${students.length} students`,
        presentCount: totalPresent,
        absentCount: totalAbsent,
        attendancePct: formatPct(totalPresent, totalPresent + totalAbsent),
      }
    : null;

  return {
    selectedFilters: [{ label: 'Month', value: targetMonth }],
    kpis: [
      { label: 'Students', value: formatNum(students.length) },
      { label: 'Working days', value: formatNum(workingDays), tone: 'info' },
      { label: 'Class average %', value: formatPct(totalPresent, totalPresent + totalAbsent), tone: 'success' },
      { label: 'Below threshold', value: formatNum(belowThresholdCount), tone: belowThresholdCount > 0 ? 'warning' : 'default' },
    ],
    columns,
    rows,
    totalsRow,
    insight: {
      severity: belowThresholdCount > 0 ? 'warning' : 'info',
      message: `Register for ${targetMonth}: ${workingDays} working day(s) excluding holidays/skips/Sundays. Codes: P=Present, L=Late, A=Absent, LV=Leave, H=Holiday, S=Class Skip. ${belowThresholdCount} student(s) are below 75%.`,
    },
  };
}

// ---------------------------------------------------------------------------
// 12. Page 30 — Low Attendance & Shortage List
// ---------------------------------------------------------------------------

async function buildLowAttendanceShortage(query = {}, ctx = {}) {
  const sessionCtx = ctx?.sessionCtx || (await resolveSession(query.sessionId));
  const endDate = normalizeYmd(query.asOfDate, todayYmd());
  const sessionStart = sessionCtx?.sessionDoc?.startDate
    ? normalizeYmd(
        sessionCtx.sessionDoc.startDate instanceof Date
          ? sessionCtx.sessionDoc.startDate.toISOString()
          : sessionCtx.sessionDoc.startDate,
        `${endDate.slice(0, 4)}-01-01`
      )
    : `${endDate.slice(0, 4)}-01-01`;
  const startDate = sessionStart <= endDate ? sessionStart : `${endDate.slice(0, 4)}-01-01`;

  const parsedThreshold = Number(query.threshold ?? 75);
  const threshold = Number.isFinite(parsedThreshold) ? Math.max(0, Math.min(100, parsedThreshold)) : 75;
  const leaveMode = ['EXCLUDE_LEAVE', 'COUNT_AS_PRESENT', 'COUNT_AS_ABSENT'].includes(String(query.leaveMode || '').toUpperCase())
    ? String(query.leaveMode).toUpperCase()
    : 'EXCLUDE_LEAVE';

  const students = await fetchActiveStudents(query);
  const studentIds = students.map(s => s._id);
  const classIds = [...new Set(students.map(s => s.classId?._id || s.classId).filter(Boolean))];

  const [attRecords, approvedLeaves, { holidayMap, isSkipForStudent }] = await Promise.all([
    studentIds.length
      ? Attendance.find({
          role: 'STUDENT',
          studentId: { $in: studentIds },
          date: { $gte: startDate, $lte: endDate },
        }).lean()
      : [],
    studentIds.length
      ? Leave.find({
          applicantType: 'STUDENT',
          studentId: { $in: studentIds },
          status: { $regex: /^approved$/i },
          fromDate: { $lte: endDate },
          toDate: { $gte: startDate },
        }).lean()
      : [],
    loadHolidayAndSkipMaps(startDate, endDate, classIds),
  ]);

  const attByStudentDate = new Map();
  let correctionsPendingCount = 0;

  attRecords.forEach(r => {
    if (r.correctionPending) correctionsPendingCount += 1;
    const sId = extractId(r.studentId);
    const dStr = normalizeYmd(r.date, '');
    if (!dStr) return;
    if (!attByStudentDate.has(sId)) attByStudentDate.set(sId, new Map());
    attByStudentDate.get(sId).set(dStr, r);
  });

  const leaveByStudent = new Map();
  approvedLeaves.forEach(l => {
    const sId = extractId(l.studentId);
    if (!leaveByStudent.has(sId)) leaveByStudent.set(sId, new Set());
    const set = leaveByStudent.get(sId);
    expandYmdRange(l.fromDate, l.toDate || l.fromDate).forEach(d => {
      if (d >= startDate && d <= endDate) set.add(d);
    });
  });

  let guardianContactsPending = 0;
  const shortageRows = [];

  students.forEach(s => {
    const sId = String(s._id);
    const sAtt = attByStudentDate.get(sId) || new Map();
    const sLeaveDates = leaveByStudent.get(sId) || new Set();

    let present = 0;
    let absent = 0;
    let leave = 0;
    let absentWithoutNote = 0;

    sAtt.forEach((rec, dStr) => {
      if (holidayMap.has(dStr) || isSkipForStudent(s, dStr)) return;
      const st = String(rec.status || '').toUpperCase();
      if (st === 'PRESENT' || st === 'LATE' || st === 'HALF_DAY') present += 1;
      else if (st === 'ABSENT') {
        absent += 1;
        if (!String(rec.notes || '').trim()) absentWithoutNote += 1;
      } else if (st === 'LEAVE') leave += 1;
    });

    sLeaveDates.forEach(dStr => {
      if (!sAtt.has(dStr) && !holidayMap.has(dStr) && !isSkipForStudent(s, dStr)) {
        leave += 1;
      }
    });

    if (absentWithoutNote > 0) guardianContactsPending += 1;

    let effectiveNum = present;
    let effectiveDenom = present + absent;
    if (leaveMode === 'COUNT_AS_PRESENT') {
      effectiveNum = present + leave;
      effectiveDenom = present + absent + leave;
    } else if (leaveMode === 'COUNT_AS_ABSENT') {
      effectiveNum = present;
      effectiveDenom = present + absent + leave;
    }

    if (effectiveDenom <= 0) return;
    const pct = (effectiveNum / effectiveDenom) * 100;
    if (pct >= threshold) return;

    const alert =
      pct < Math.max(0, threshold - 25)
        ? 'Critical Shortage'
        : pct < Math.max(0, threshold - 10)
          ? 'High Risk'
          : 'Below Threshold';

    shortageRows.push({
      studentName: fullName(s) || 'Student',
      programName: s.programId?.name || '—',
      workingDays: effectiveDenom,
      present,
      absent,
      leave,
      attendancePct: `${pct.toFixed(1)}%`,
      alert,
      _pct: pct,
    });
  });

  shortageRows.sort((a, b) => a._pct - b._pct);

  const leaveRuleText =
    leaveMode === 'COUNT_AS_PRESENT'
      ? 'COUNT_AS_PRESENT: approved leave days count toward both working days and attended days.'
      : leaveMode === 'COUNT_AS_ABSENT'
        ? 'COUNT_AS_ABSENT: approved leave days count in working days as missed attendance.'
        : 'EXCLUDE_LEAVE: approved leave days are excluded from working days denominator (Attendance % = Present / (Present + Absent)).';

  return {
    selectedFilters: [
      { label: 'As of Date', value: formatDate(endDate) },
      { label: 'Threshold', value: `${threshold}%` },
      { label: 'Leave Rule', value: leaveMode },
    ],
    kpis: [
      { label: 'Students below threshold', value: formatNum(shortageRows.length), tone: shortageRows.length > 0 ? 'danger' : 'success' },
      { label: 'Configured threshold', value: `${threshold}%` },
      { label: 'Guardian contacts pending', value: formatNum(guardianContactsPending), tone: guardianContactsPending > 0 ? 'warning' : 'default' },
      { label: 'Attendance corrections pending', value: formatNum(correctionsPendingCount), tone: correctionsPendingCount > 0 ? 'warning' : 'default' },
    ],
    columns: [
      { key: 'studentName', label: 'Student', align: 'left' },
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'workingDays', label: 'Working days', align: 'right' },
      { key: 'present', label: 'Present', align: 'right' },
      { key: 'absent', label: 'Absent', align: 'right' },
      { key: 'leave', label: 'Leave', align: 'right' },
      { key: 'attendancePct', label: 'Attendance %', align: 'right' },
      { key: 'alert', label: 'Alert', align: 'center' },
    ],
    rows: shortageRows,
    totalsRow: null,
    insight: {
      severity: shortageRows.length > 0 ? 'warning' : 'success',
      message: `Evaluated attendance from ${formatDate(startDate)} to ${formatDate(endDate)} excluding holidays/skips. Rule applied — ${leaveRuleText}`,
    },
  };
}

// ---------------------------------------------------------------------------
// 13. Page 31 — Syllabus Coverage & Lesson Progress
// ---------------------------------------------------------------------------

async function buildSyllabusCoverage(query = {}, ctx = {}) {
  const sessionCtx = ctx?.sessionCtx || (await resolveSession(query.sessionId));
  const isAllSessions = query.sessionId === 'all' || query.sessionId === '*';
  const explicitSession = !isAllSessions && query.sessionId && mongoose.Types.ObjectId.isValid(query.sessionId)
    ? new mongoose.Types.ObjectId(query.sessionId)
    : null;
  const effectiveSessionObjId = isAllSessions ? null : (explicitSession || sessionCtx?.sessionObjId || null);

  const planFilter = {};
  if (effectiveSessionObjId) planFilter.sessionId = effectiveSessionObjId;
  applyMultiIdFilter(planFilter, 'programId', query.programId);
  applyMultiIdFilter(planFilter, 'classId', query.classId);
  applyMultiIdFilter(planFilter, 'subjectId', query.subjectId);
  applyMultiIdFilter(planFilter, 'teacherId', query.teacherId);
  applyMultiStringFilter(planFilter, 'term', query.term);

  const plans = await SyllabusPlan.find(planFilter)
    .populate('programId', 'name code')
    .populate('classId', 'name programId')
    .populate('subjectId', 'name code')
    .populate('teacherId', 'name staffId')
    .lean();

  // Build fallback list from SubjectClassMapping + TeacherMapping for unconfigured subjects
  const classFilter = {};
  applyMultiIdFilter(classFilter, '_id', query.classId);
  applyMultiIdFilter(classFilter, 'programId', query.programId);
  const classes = await Class.find(classFilter).populate('programId', 'name code').lean();
  const classMap = new Map(classes.map(c => [String(c._id), c]));
  const classIds = classes.map(c => c._id);

  const sessionOrNull = effectiveSessionObjId
    ? { $or: [{ sessionId: effectiveSessionObjId }, { sessionId: null }, { sessionId: { $exists: false } }] }
    : {};

  const scmFilter = { classId: { $in: classIds }, ...sessionOrNull };
  const tmFilter = { classId: { $in: classIds }, mappingType: 'SUBJECT', subjectId: { $ne: null }, ...sessionOrNull };

  const [scms, tMappings] = classIds.length
    ? await Promise.all([
        SubjectClassMapping.find(scmFilter).populate('subjects.subjectId', 'name code').populate('subjectIds', 'name code').lean(),
        TeacherMapping.find(tmFilter).populate('teacherId', 'name staffId').populate('subjectId', 'name code').lean(),
      ])
    : [[], []];

  const teacherByClassSub = new Map();
  tMappings.forEach(tm => {
    const cId = extractId(tm.classId);
    const sId = extractId(tm.subjectId);
    if (!cId || !sId || !tm.teacherId) return;
    const key = `${cId}_${sId}`;
    if (!teacherByClassSub.has(key)) teacherByClassSub.set(key, []);
    teacherByClassSub.get(key).push({
      id: extractId(tm.teacherId),
      name: tm.teacherId.name || 'Teacher',
    });
  });

  const today = todayYmd();
  const configuredKeys = new Set();
  const rows = [];
  let totalPlanned = 0;
  let totalCompleted = 0;
  let onTrackCount = 0;
  let behindCount = 0;
  let lessonsPendingCount = 0;
  let unconfiguredCount = 0;

  plans.forEach(plan => {
    const cId = extractId(plan.classId);
    const sId = extractId(plan.subjectId);
    configuredKeys.add(`${cId}_${sId}`);
    const topics = Array.isArray(plan.topics) ? plan.topics : [];
    const plannedTopics = topics.length;
    const completedTopics = topics.filter(t => t.completed).length;
    const coverageNum = plannedTopics > 0 ? (completedTopics / plannedTopics) * 100 : 0;
    const pendingInPlan = topics.filter(t => !t.completed && (!t.plannedDate || t.plannedDate <= today)).length;
    lessonsPendingCount += pendingInPlan;

    let status = '0 topics configured';
    if (plannedTopics === 0) {
      unconfiguredCount += 1;
      behindCount += 1;
    } else if (coverageNum >= 70) {
      status = 'On Track';
      onTrackCount += 1;
    } else {
      status = 'Behind Plan';
      behindCount += 1;
    }

    totalPlanned += plannedTopics;
    totalCompleted += completedTopics;

    const mappedTeachers = teacherByClassSub.get(`${cId}_${sId}`) || [];
    const teacherName = plan.teacherId?.name || mappedTeachers[0]?.name || 'Unassigned';
    const nextTopic = topics.find(t => !t.completed) || topics[0] || null;

    rows.push({
      programName: plan.programId?.name || 'Program',
      className: plan.classId?.name || 'Class',
      subjectName: plan.subjectId?.name || 'Subject',
      teacherName,
      plannedTopics,
      completedTopics,
      coveragePct: `${coverageNum.toFixed(1)}%`,
      status,
      _coverageNum: coverageNum,
      actionContext: {
        planId: String(plan._id),
        sessionId: extractId(plan.sessionId),
        programId: extractId(plan.programId),
        classId: cId,
        subjectId: sId,
        teacherId: extractId(plan.teacherId) || mappedTeachers[0]?.id || '',
        term: plan.term || 'Full Year',
        nextTopicId: nextTopic?._id ? String(nextTopic._id) : '',
        completed: nextTopic ? String(!nextTopic.completed) : 'true',
      },
      disabledActions: topics.length === 0 ? ['toggle-topic-status'] : [],
      _meta: {
        planId: String(plan._id),
        sessionId: extractId(plan.sessionId),
        programId: extractId(plan.programId),
        classId: cId,
        subjectId: sId,
        teacherId: extractId(plan.teacherId) || mappedTeachers[0]?.id || '',
        term: plan.term || 'Full Year',
        topics,
      },
    });
  });

  // Fallback for SubjectClassMapping / TeacherMapping subjects with no SyllabusPlan yet
  const termValues = parseMulti(query.term).filter(t => !/^all$/i.test(t));
  const shouldIncludeFallbacks = termValues.length === 0 || termValues.some(t => /^full\s*year$/i.test(t));
  if (shouldIncludeFallbacks) {
    const subFilterSet = new Set(toObjectIds(query.subjectId).map(String));
    const teacherFilterSet = new Set(toObjectIds(query.teacherId).map(String));

    const candidatePairs = new Map();
    scms.forEach(scm => {
      const cId = extractId(scm.classId);
      const list = Array.isArray(scm.subjects) && scm.subjects.length
        ? scm.subjects.map(x => x.subjectId).filter(Boolean)
        : (scm.subjectIds || []);
      list.forEach(sub => {
        const sId = extractId(sub);
        if (cId && sId) candidatePairs.set(`${cId}_${sId}`, { cId, sId, subName: sub?.name || 'Subject' });
      });
    });
    tMappings.forEach(tm => {
      const cId = extractId(tm.classId);
      const sId = extractId(tm.subjectId);
      if (cId && sId && !candidatePairs.has(`${cId}_${sId}`)) {
        candidatePairs.set(`${cId}_${sId}`, { cId, sId, subName: tm.subjectId?.name || 'Subject' });
      }
    });

    candidatePairs.forEach(({ cId, sId, subName }, key) => {
      if (configuredKeys.has(key)) return;
      if (subFilterSet.size > 0 && !subFilterSet.has(sId)) return;
      const mappedTeachers = teacherByClassSub.get(key) || [];
      if (teacherFilterSet.size > 0 && !mappedTeachers.some(t => teacherFilterSet.has(t.id))) return;

      const cls = classMap.get(cId);
      unconfiguredCount += 1;
      behindCount += 1;

      rows.push({
        programName: cls?.programId?.name || 'Program',
        className: cls?.name || 'Class',
        subjectName: subName,
        teacherName: mappedTeachers.map(t => t.name).join(', ') || 'Unassigned',
        plannedTopics: 0,
        completedTopics: 0,
        coveragePct: '0.0%',
        status: '0 topics configured',
        _coverageNum: 0,
        actionContext: {
          planId: '',
          sessionId: effectiveSessionObjId ? String(effectiveSessionObjId) : '',
          programId: extractId(cls?.programId),
          classId: cId,
          subjectId: sId,
          teacherId: mappedTeachers[0]?.id || '',
          term: termValues.length ? termValues[0] : 'Full Year',
        },
        disabledActions: ['toggle-topic-status'],
        _meta: {
          planId: null,
          sessionId: effectiveSessionObjId ? String(effectiveSessionObjId) : '',
          programId: extractId(cls?.programId),
          classId: cId,
          subjectId: sId,
          teacherId: mappedTeachers[0]?.id || '',
          term: query.term && query.term !== 'ALL' ? query.term : 'Full Year',
          topics: [],
        },
      });
    });
  }

  rows.sort((a, b) =>
    `${a.programName}_${a.className}_${a.subjectName}`.localeCompare(`${b.programName}_${b.className}_${b.subjectName}`)
  );

  return {
    selectedFilters: [
      ...(effectiveSessionObjId && sessionCtx?.sessionLabel ? [{ label: 'Session', value: sessionCtx.sessionLabel }] : []),
      ...(query.term && query.term !== 'ALL' ? [{ label: 'Term', value: query.term }] : []),
    ],
    kpis: [
      { label: 'Average coverage %', value: formatPct(totalCompleted, totalPlanned), tone: 'info' },
      { label: 'Subjects on track (>= 70%)', value: formatNum(onTrackCount), tone: 'success' },
      { label: 'Behind plan (< 70%)', value: formatNum(behindCount), tone: behindCount > 0 ? 'warning' : 'default' },
      { label: 'Lessons pending update', value: formatNum(lessonsPendingCount), tone: lessonsPendingCount > 0 ? 'warning' : 'default' },
    ],
    columns: [
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'className', label: 'Class', align: 'left' },
      { key: 'subjectName', label: 'Subject', align: 'left' },
      { key: 'teacherName', label: 'Teacher', align: 'left' },
      { key: 'plannedTopics', label: 'Planned topics', align: 'right' },
      { key: 'completedTopics', label: 'Completed', align: 'right' },
      { key: 'coveragePct', label: 'Coverage', align: 'right' },
      { key: 'status', label: 'Status', align: 'center' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          programName: 'Total',
          className: `${rows.length} subject(s)`,
          subjectName: '—',
          teacherName: '—',
          plannedTopics: totalPlanned,
          completedTopics: totalCompleted,
          coveragePct: formatPct(totalCompleted, totalPlanned),
          status: `${onTrackCount} On Track / ${behindCount} Behind`,
        }
      : null,
    insight: {
      severity: behindCount > 0 ? 'warning' : 'success',
      message: `${onTrackCount} subject(s) are on track (>= 70%), ${behindCount} below target${unconfiguredCount ? ` (including ${unconfiguredCount} with "0 topics configured" from subject/teacher mappings)` : ''}, and ${lessonsPendingCount} lesson(s) pending update.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Inline Actions
// ---------------------------------------------------------------------------

async function correctAttendanceAction(payload = {}, ctx = {}) {
  const reqUser = getReqUser(ctx);
  const { studentId, newStatus, reason, attendanceId } = payload;
  const targetDate = normalizeYmd(payload.date, '');
  const normalizedStatus = String(newStatus || '').trim().toUpperCase();
  const allowedStatuses = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HALF_DAY'];

  if (!mongoose.Types.ObjectId.isValid(studentId) || !targetDate || !allowedStatuses.includes(normalizedStatus)) {
    const err = new Error('Valid studentId, date (YYYY-MM-DD), and newStatus are required');
    err.statusCode = 400;
    throw err;
  }

  const student = await Student.findById(studentId).lean();
  if (!student || !isStudentActive(student)) {
    const err = new Error('Active student not found');
    err.statusCode = 404;
    throw err;
  }

  let doc = null;
  if (attendanceId && mongoose.Types.ObjectId.isValid(attendanceId)) {
    doc = await Attendance.findById(attendanceId);
  }
  if (!doc) {
    doc = await Attendance.findOne({ studentId, date: targetDate, role: 'STUDENT' });
  }

  const previousStatus = doc?.status || 'UNMARKED';
  const auditEntry = {
    previousStatus,
    newStatus: normalizedStatus,
    reason: String(reason || 'Corrected via Daily Attendance Report').trim(),
    correctedBy: reqUser?.id || null,
    correctedByName: reqUser?.name || reqUser?.email || 'Administrator',
    correctedAt: new Date(),
  };

  if (doc) {
    doc.status = normalizedStatus;
    doc.correctionPending = parseBooleanFlag(payload.correctionPending, false);
    doc.markedAt = new Date();
    if (reqUser?.id) doc.markedBy = reqUser.id;
    if (reason) doc.notes = String(reason).trim();
    doc.correctionAudit = [...(doc.correctionAudit || []), auditEntry];
    await doc.save();
  } else {
    doc = await Attendance.create({
      role: 'STUDENT',
      studentId: student._id,
      date: targetDate,
      status: normalizedStatus,
      leaveType: normalizedStatus === 'LEAVE' ? 'CASUAL' : null,
      classId: payload.classId || student.classId,
      sectionId: payload.sectionId !== undefined ? payload.sectionId : (student.sectionId || null),
      sessionId: student.sessionId || null,
      notes: String(reason || '').trim(),
      markedBy: reqUser?.id || null,
      markedAt: new Date(),
      correctionPending: parseBooleanFlag(payload.correctionPending, false),
      correctionAudit: [auditEntry],
    });
  }

  await ActivityLog.create({
    userId: reqUser?.id || null,
    userName: auditEntry.correctedByName,
    userEmail: reqUser?.email || '',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Attendance',
    subModule: 'Reports',
    action: 'CORRECT_ATTENDANCE',
    actionType: 'UPDATE',
    description: `Corrected attendance for ${fullName(student)} on ${targetDate}: ${previousStatus} -> ${normalizedStatus}`,
    endpoint: '/api/reports/attendance-daily-student/action',
    targetEntity: { entityType: 'Attendance', entityId: String(doc._id), name: fullName(student) },
    status: 'SUCCESS',
  }).catch(() => {});

  return { corrected: true, attendance: doc.toObject() };
}

async function upsertSyllabusTopicAction(payload = {}, ctx = {}) {
  const reqUser = getReqUser(ctx);
  const title = String(payload.title || '').trim();
  if (!title) {
    const err = new Error('Topic title is required');
    err.statusCode = 400;
    throw err;
  }

  let plan = null;
  if (payload.planId && mongoose.Types.ObjectId.isValid(payload.planId)) {
    plan = await SyllabusPlan.findById(payload.planId);
  }

  if (!plan) {
    const { classId, subjectId } = payload;
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
      const err = new Error('Valid planId or (classId and subjectId) are required');
      err.statusCode = 400;
      throw err;
    }
    const sessionCtx = await resolveSession(payload.sessionId);
    const sessionObjId = mongoose.Types.ObjectId.isValid(payload.sessionId)
      ? new mongoose.Types.ObjectId(payload.sessionId)
      : sessionCtx.sessionObjId;
    if (!sessionObjId) {
      const err = new Error('An active academic session is required to create a syllabus plan');
      err.statusCode = 400;
      throw err;
    }

    let programId = payload.programId;
    if (!mongoose.Types.ObjectId.isValid(programId)) {
      const cls = await Class.findById(classId).select('programId').lean();
      programId = cls?.programId;
    }
    const term = String(payload.term || 'Full Year').trim() || 'Full Year';

    plan = await SyllabusPlan.findOne({ sessionId: sessionObjId, classId, subjectId, term });
    if (!plan) {
      plan = new SyllabusPlan({
        sessionId: sessionObjId,
        programId,
        classId,
        subjectId,
        teacherId: mongoose.Types.ObjectId.isValid(payload.teacherId) ? payload.teacherId : undefined,
        term,
        topics: [],
      });
    }
  }

  const actorName = reqUser?.name || reqUser?.email || 'Administrator';
  const isCompleted = parseBooleanFlag(payload.completed, false);
  if (payload.topicId && plan.topics.id(payload.topicId)) {
    const topic = plan.topics.id(payload.topicId);
    topic.title = title;
    if (payload.plannedDate !== undefined) topic.plannedDate = String(payload.plannedDate || '');
    if (payload.completed !== undefined) {
      topic.completed = isCompleted;
      topic.completedDate = isCompleted ? (payload.completedDate || todayYmd()) : '';
    }
    if (payload.delayReason !== undefined) topic.delayReason = String(payload.delayReason || '');
    topic.updatedByName = actorName;
    topic.updatedAt = new Date();
  } else {
    plan.topics.push({
      title,
      plannedDate: String(payload.plannedDate || ''),
      completed: isCompleted,
      completedDate: isCompleted ? (payload.completedDate || todayYmd()) : '',
      delayReason: String(payload.delayReason || ''),
      updatedByName: actorName,
      updatedAt: new Date(),
    });
  }

  if (mongoose.Types.ObjectId.isValid(payload.teacherId)) {
    plan.teacherId = payload.teacherId;
  }
  await plan.save();

  await ActivityLog.create({
    userId: reqUser?.id || null,
    userName: actorName,
    userEmail: reqUser?.email || '',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Academics',
    subModule: 'Reports',
    action: 'UPSERT_SYLLABUS_TOPIC',
    actionType: 'UPDATE',
    description: `Upserted syllabus topic "${title}" in plan ${plan._id}`,
    endpoint: '/api/reports/academics-syllabus-coverage/action',
    targetEntity: { entityType: 'SyllabusPlan', entityId: String(plan._id), name: title },
    status: 'SUCCESS',
  }).catch(() => {});

  return { saved: true, plan: plan.toObject() };
}

async function toggleTopicStatusAction(payload = {}, ctx = {}) {
  const reqUser = getReqUser(ctx);
  const planId = payload.planId;
  const topicId = payload.topicId || payload.nextTopicId;
  if (!mongoose.Types.ObjectId.isValid(planId) || !mongoose.Types.ObjectId.isValid(topicId)) {
    const err = new Error('Please add a topic first using "Add Topic", then update its completion status.');
    err.statusCode = 400;
    throw err;
  }
  const plan = await SyllabusPlan.findById(planId);
  if (!plan) {
    const err = new Error('Syllabus plan not found');
    err.statusCode = 404;
    throw err;
  }
  const topic = plan.topics.id(topicId);
  if (!topic) {
    const err = new Error('Syllabus topic not found');
    err.statusCode = 404;
    throw err;
  }

  const nextCompleted = payload.completed !== undefined && payload.completed !== ''
    ? parseBooleanFlag(payload.completed, !Boolean(topic.completed))
    : !Boolean(topic.completed);
  const actorName = reqUser?.name || reqUser?.email || 'Administrator';
  topic.completed = nextCompleted;
  topic.completedDate = nextCompleted ? (payload.completedDate || todayYmd()) : '';
  if (payload.delayReason !== undefined) topic.delayReason = String(payload.delayReason || '');
  topic.updatedByName = actorName;
  topic.updatedAt = new Date();
  await plan.save();

  await ActivityLog.create({
    userId: reqUser?.id || null,
    userName: actorName,
    userEmail: reqUser?.email || '',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Academics',
    subModule: 'Reports',
    action: 'TOGGLE_SYLLABUS_TOPIC',
    actionType: 'STATUS',
    description: `Marked syllabus topic "${topic.title}" as ${nextCompleted ? 'Completed' : 'Pending'}`,
    endpoint: '/api/reports/academics-syllabus-coverage/action',
    targetEntity: { entityType: 'SyllabusPlan', entityId: String(plan._id), name: topic.title },
    status: 'SUCCESS',
  }).catch(() => {});

  return { updated: true, plan: plan.toObject(), topic: topic.toObject() };
}

// ---------------------------------------------------------------------------
// Catalog & Exports
// ---------------------------------------------------------------------------

const CATALOG = [
  {
    key: 'attendance-daily-student',
    pageNumber: 28,
    module: 'Attendance',
    category: 'Attendance',
    categoryKey: 'attendance',
    rbacModule: 'Attendance',
    rbacSubModule: 'reports',
    title: 'Daily Student Attendance',
    purpose: 'Track daily attendance, approved leaves, holidays, and perform audited inline attendance corrections.',
    inlineActions: [
      {
        name: 'correct-attendance',
        key: 'correct-attendance',
        label: 'Edit Status',
        scope: 'row',
        fields: [
          {
            key: 'newStatus',
            label: 'Attendance Status',
            type: 'select',
            defaultValue: 'PRESENT',
            options: [
              { value: 'PRESENT', label: 'Present' },
              { value: 'ABSENT', label: 'Absent' },
              { value: 'LATE', label: 'Late' },
              { value: 'LEAVE', label: 'Leave' },
              { value: 'HALF_DAY', label: 'Half Day' },
            ],
          },
          { key: 'reason', label: 'Note / Reason', type: 'text', placeholder: 'e.g. Late arrival / Medical note' },
        ],
      },
    ],
    filterSchema: [
      { key: 'asOfDate', label: 'Date', type: 'date', defaultValue: todayYmd() },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'sectionId', label: 'Section', type: 'select', optionsSource: 'sections' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PRESENT', label: 'Present' },
          { value: 'ABSENT', label: 'Absent' },
          { value: 'LATE', label: 'Late' },
          { value: 'LEAVE', label: 'Leave' },
          { value: 'UNMARKED', label: 'Unmarked' },
        ],
      },
    ],
  },
  {
    key: 'attendance-monthly-register',
    pageNumber: 29,
    module: 'Attendance',
    category: 'Attendance',
    categoryKey: 'attendance',
    rbacModule: 'Attendance',
    rbacSubModule: 'class-reports',
    title: 'Monthly Student Attendance Register',
    purpose: 'Full month day-by-day attendance grid showing working days, holidays, skips, and student attendance rates.',
    filterSchema: [
      { key: 'month', label: 'Month', type: 'month', defaultValue: todayYmd().slice(0, 7) },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'sectionId', label: 'Section', type: 'select', optionsSource: 'sections' },
    ],
  },
  {
    key: 'attendance-low-shortage',
    pageNumber: 30,
    module: 'Attendance',
    category: 'Attendance',
    categoryKey: 'attendance',
    rbacModule: 'Attendance',
    rbacSubModule: 'most-absent',
    title: 'Low Attendance & Shortage List',
    purpose: 'Identify students falling below minimum attendance thresholds under configurable approved-leave rules.',
    filterSchema: [
      { key: 'asOfDate', label: 'As of Date', type: 'date', defaultValue: todayYmd() },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'threshold', label: 'Threshold (%)', type: 'number', defaultValue: 75 },
      {
        key: 'leaveMode',
        label: 'Leave Rule',
        type: 'select',
        defaultValue: 'EXCLUDE_LEAVE',
        options: [
          { value: 'EXCLUDE_LEAVE', label: 'Exclude Leave' },
          { value: 'COUNT_AS_PRESENT', label: 'Count Leave as Present' },
          { value: 'COUNT_AS_ABSENT', label: 'Count Leave as Absent' },
        ],
      },
    ],
  },
  {
    key: 'academics-syllabus-coverage',
    pageNumber: 31,
    module: 'Academics',
    category: 'Academics',
    categoryKey: 'academics',
    rbacModule: 'Academics',
    rbacSubModule: 'reports',
    title: 'Syllabus Coverage & Lesson Progress',
    purpose: 'Monitor planned vs completed syllabus topics across subjects and update lesson progress inline.',
    inlineActions: [
      {
        name: 'upsert-syllabus-topic',
        key: 'upsert-syllabus-topic',
        label: 'Add Topic',
        scope: 'row',
        fields: [
          { key: 'title', label: 'Topic Title', type: 'text', placeholder: 'e.g. Chapter 3: Derivatives' },
          {
            key: 'term',
            label: 'Term',
            type: 'select',
            defaultValue: 'Full Year',
            options: [
              { value: 'Full Year', label: 'Full Year' },
              { value: 'Term 1', label: 'Term 1' },
              { value: 'Term 2', label: 'Term 2' },
              { value: 'Mid Term', label: 'Mid Term' },
              { value: 'Final Term', label: 'Final Term' },
            ],
          },
          { key: 'plannedDate', label: 'Target Date', type: 'date' },
          {
            key: 'completed',
            label: 'Topic Status',
            type: 'select',
            defaultValue: 'false',
            options: [
              { value: 'false', label: 'In Progress' },
              { value: 'true', label: 'Completed' },
            ],
          },
          { key: 'delayReason', label: 'Note', type: 'text', placeholder: 'Optional note or delay reason' },
        ],
      },
      {
        name: 'toggle-topic-status',
        key: 'toggle-topic-status',
        label: 'Mark Topic Done',
        scope: 'row',
        fields: [
          {
            key: 'completed',
            label: 'Topic Status',
            type: 'select',
            defaultValue: 'true',
            options: [
              { value: 'true', label: 'Completed' },
              { value: 'false', label: 'Pending / In Progress' },
            ],
          },
          { key: 'delayReason', label: 'Note', type: 'text', placeholder: 'Optional completion note' },
        ],
      },
    ],
    filterSchema: [
      { key: 'sessionId', label: 'Academic Session', type: 'select', optionsSource: 'sessions' },
      { key: 'programId', label: 'Program', type: 'select', optionsSource: 'programs' },
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'subjectId', label: 'Subject', type: 'select', optionsSource: 'subjects' },
      { key: 'teacherId', label: 'Teacher', type: 'select', optionsSource: 'teachers' },
      {
        key: 'term',
        label: 'Term',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All Terms' },
          { value: 'Full Year', label: 'Full Year' },
          { value: 'Term 1', label: 'Term 1' },
          { value: 'Term 2', label: 'Term 2' },
          { value: 'Mid Term', label: 'Mid Term' },
          { value: 'Final Term', label: 'Final Term' },
        ],
      },
    ],
  },
];

const HANDLERS = {
  'attendance-daily-student': buildDailyStudentAttendance,
  'attendance-monthly-register': buildMonthlyRegister,
  'attendance-low-shortage': buildLowAttendanceShortage,
  'academics-syllabus-coverage': buildSyllabusCoverage,
};

const ACTIONS = {
  'correct-attendance': correctAttendanceAction,
  'upsert-syllabus-topic': upsertSyllabusTopicAction,
  'toggle-topic-status': toggleTopicStatusAction,
};

module.exports = {
  CATALOG,
  HANDLERS,
  ACTIONS,
};
