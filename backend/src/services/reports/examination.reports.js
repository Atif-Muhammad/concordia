const mongoose = require('mongoose');
const {
  Exam,
  ExamMarks,
  ExamResult,
  GradeScheme,
  Student,
  Subject,
  Program,
  Class,
  Section,
  Staff,
  TeacherMapping,
  Attendance,
  Leave,
  ActivityLog,
} = require('../../models');
const { ACTIVE_STUDENT_FILTER, isStudentActive } = require('../../utils/studentStatus');
const {
  parseMulti,
  toObjectIds,
  applyMultiIdFilter,
  applyMultiStringFilter,
  matchesMultiValue,
  parseBooleanFlag,
  resolveSession,
  formatNum,
  formatPct,
  pctValue,
  formatDate,
  fullName,
} = require('./reportHelpers');

// ---------------------------------------------------------------------------
// Shared Grade Scheme Helpers (ponytail: single canonical boundary resolver)
// ---------------------------------------------------------------------------

function buildDefaultGradeScheme(passPct = 50) {
  const pass = Number.isFinite(Number(passPct)) ? Math.max(0, Math.min(100, Number(passPct))) : 50;
  const bands = [
    { grade: 'A+', minPct: 90, maxPct: 100, gpa: 4.0, interpretation: 'Outstanding' },
    { grade: 'A', minPct: 80, maxPct: 89.99, gpa: 3.7, interpretation: 'Excellent' },
    { grade: 'B', minPct: 70, maxPct: 79.99, gpa: 3.0, interpretation: 'Very Good' },
    { grade: 'C', minPct: 60, maxPct: 69.99, gpa: 2.5, interpretation: 'Good' },
  ];
  if (pass < 60) {
    bands.push({ grade: 'D', minPct: pass, maxPct: 59.99, gpa: 2.0, interpretation: 'Pass' });
  }
  if (pass > 0) {
    bands.push({
      grade: 'Fail',
      minPct: 0,
      maxPct: Number(Math.max(0, pass - 0.01).toFixed(2)),
      gpa: 0.0,
      interpretation: 'Below pass threshold',
    });
  }
  return {
    id: 'default',
    name: 'Standard Default Grade Scheme',
    isDefault: true,
    passPercentage: pass,
    tieBreakRule: 'HIGHEST_PERCENTAGE',
    bands,
  };
}

async function resolveGradeScheme(gradeSchemeId, exam = null) {
  if (gradeSchemeId && gradeSchemeId !== 'all' && gradeSchemeId !== 'default' && mongoose.Types.ObjectId.isValid(gradeSchemeId)) {
    const chosen = await GradeScheme.findById(gradeSchemeId).lean();
    if (chosen && Array.isArray(chosen.bands) && chosen.bands.length > 0) {
      return { ...chosen, id: String(chosen._id) };
    }
  }
  if (exam?.gradeSchemeId) {
    if (typeof exam.gradeSchemeId === 'object' && Array.isArray(exam.gradeSchemeId.bands) && exam.gradeSchemeId.bands.length > 0) {
      return { ...exam.gradeSchemeId, id: String(exam.gradeSchemeId._id || exam.gradeSchemeId.id) };
    }
    const refId = exam.gradeSchemeId?._id || exam.gradeSchemeId;
    if (mongoose.Types.ObjectId.isValid(refId)) {
      const linked = await GradeScheme.findById(refId).lean();
      if (linked && Array.isArray(linked.bands) && linked.bands.length > 0) {
        return { ...linked, id: String(linked._id) };
      }
    }
  }
  const dbDefault = await GradeScheme.findOne({ isDefault: true }).sort({ updatedAt: -1 }).lean();
  if (dbDefault && Array.isArray(dbDefault.bands) && dbDefault.bands.length > 0) {
    return { ...dbDefault, id: String(dbDefault._id) };
  }
  return buildDefaultGradeScheme(exam?.passPercentage ?? 50);
}

function computeGradeWithScheme(pct, scheme) {
  const numPct = Number(pct || 0);
  const activeScheme = scheme && Array.isArray(scheme.bands) && scheme.bands.length > 0
    ? scheme
    : buildDefaultGradeScheme(scheme?.passPercentage ?? 50);
  const passPct = Number(activeScheme.passPercentage ?? 50);
  const sortedBands = [...activeScheme.bands].sort((a, b) => Number(b.minPct) - Number(a.minPct));
  const matched =
    sortedBands.find(b => numPct >= Number(b.minPct) && numPct <= Number(b.maxPct ?? 100)) ||
    sortedBands.find(b => numPct >= Number(b.minPct)) ||
    sortedBands[sortedBands.length - 1];

  return {
    grade: matched?.grade || (numPct >= passPct ? 'Pass' : 'Fail'),
    gpa: matched?.gpa ?? null,
    interpretation: matched?.interpretation || '',
    isPass: numPct >= passPct,
  };
}

// ---------------------------------------------------------------------------
// Internal Query & Cohort Helpers
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

function getEffectivePassPct(exam, scheme) {
  return Number(exam?.passPercentage ?? scheme?.passPercentage ?? 50);
}

async function fetchMatchingExams(query = {}) {
  const examFilter = {};
  if (query.examId && query.examId !== 'all' && query.examId !== '*') {
    applyMultiIdFilter(examFilter, '_id', query.examId);
  } else {
    if (query.sessionId && query.sessionId !== 'all' && query.sessionId !== '*' && mongoose.Types.ObjectId.isValid(query.sessionId)) {
      examFilter.sessionId = new mongoose.Types.ObjectId(query.sessionId);
    }
    applyMultiIdFilter(examFilter, 'programId', query.programId);
    applyMultiIdFilter(examFilter, 'classId', query.classId);
  }
  return Exam.find(examFilter)
    .populate('programId', 'name code')
    .populate('classId', 'name allowSections')
    .populate('sessionId', 'name')
    .populate('schedule.subjectId', 'name code')
    .sort({ startDate: -1, createdAt: -1 })
    .lean();
}

async function fetchActiveCohortStudents(query = {}, exams = []) {
  const studentFilter = { ...ACTIVE_STUDENT_FILTER };
  if (query.studentId && mongoose.Types.ObjectId.isValid(query.studentId)) {
    studentFilter._id = new mongoose.Types.ObjectId(query.studentId);
  } else {
    applyMultiIdFilter(studentFilter, 'programId', query.programId);
    applyMultiIdFilter(studentFilter, 'classId', query.classId);
    applyMultiIdFilter(studentFilter, 'sectionId', query.sectionId);
    applyMultiStringFilter(studentFilter, 'gender', query.gender, { caseInsensitive: true });
    if (!query.programId && !query.classId && exams.length > 0) {
      const pairs = [];
      const seen = new Set();
      exams.forEach(ex => {
        const pId = extractId(ex.programId);
        const cId = extractId(ex.classId);
        if (pId && cId && !seen.has(`${pId}_${cId}`)) {
          seen.add(`${pId}_${cId}`);
          pairs.push({ programId: pId, classId: cId });
        }
      });
      if (pairs.length > 0) studentFilter.$or = pairs;
    }
  }
  return Student.find(studentFilter)
    .populate('programId', 'name code')
    .populate('classId', 'name allowSections')
    .populate('sectionId', 'name')
    .sort({ rollNumber: 1 })
    .lean();
}

async function fetchExamMarks(examIds, { subjectIds = [], studentIds = [] } = {}) {
  if (!examIds || examIds.length === 0) return [];
  const filter = { examId: { $in: examIds } };
  if (subjectIds.length > 0) filter.subjectId = { $in: subjectIds };
  if (studentIds.length > 0) filter.studentId = { $in: studentIds };

  const marks = await ExamMarks.find(filter)
    .populate('subjectId', 'name code')
    .lean();

  // Resolve any unpopulated subject names cleanly from Subject model
  const missingSubIds = [...new Set(
    marks
      .filter(m => !m.subjectId?.name && mongoose.Types.ObjectId.isValid(m.subjectId))
      .map(m => String(m.subjectId))
  )];
  const subjectNameMap = new Map();
  if (missingSubIds.length > 0) {
    const subs = await Subject.find({ _id: { $in: missingSubIds } }).select('name code').lean();
    subs.forEach(s => subjectNameMap.set(String(s._id), s));
  }

  return marks.map(m => {
    const sId = extractId(m.subjectId);
    const subDoc = m.subjectId?.name ? m.subjectId : subjectNameMap.get(sId);
    return {
      ...m,
      subjectIdStr: sId,
      subjectName: subDoc?.name || 'Subject',
      subjectCode: subDoc?.code || '',
      studentIdStr: extractId(m.studentId),
      examIdStr: extractId(m.examId),
    };
  });
}

function summarizeStudentMarksForExam(marks = [], passPct = 50) {
  const nonExempt = marks.filter(m => !m.isExempt);
  if (nonExempt.length === 0) {
    return {
      status: marks.length > 0 ? 'EXEMPT' : 'PENDING',
      isAppeared: false,
      isAbsent: false,
      isWithheld: false,
      isPass: false,
      obtained: 0,
      total: 0,
      pct: 0,
    };
  }
  const allAbsent = nonExempt.every(m => m.isAbsent);
  if (allAbsent) {
    return {
      status: 'ABSENT',
      isAppeared: false,
      isAbsent: true,
      isWithheld: false,
      isPass: false,
      obtained: 0,
      total: 0,
      pct: 0,
    };
  }
  const anyWithheld = nonExempt.some(m => m.isWithheld);
  const anyAbsent = nonExempt.some(m => m.isAbsent);
  let obtained = 0;
  let total = 0;
  nonExempt.forEach(m => {
    const tot = Number(m.totalMarks || 100);
    total += tot;
    obtained += m.isAbsent ? 0 : Number(m.obtainedMarks || 0);
  });
  const pct = total > 0 ? (obtained / total) * 100 : 0;
  const isPass = !anyWithheld && pct >= passPct;
  return {
    status: anyWithheld ? 'WITHHELD' : (isPass ? 'PASSED' : 'FAILED'),
    isAppeared: true,
    isAbsent: false,
    anyAbsent,
    isWithheld: anyWithheld,
    isPass,
    obtained,
    total,
    pct,
  };
}

function sortMeritRows(list, tieBreakRule = 'HIGHEST_PERCENTAGE') {
  return [...list].sort((a, b) => {
    if (Math.abs(b.pct - a.pct) > 1e-6) return b.pct - a.pct;
    if (tieBreakRule === 'EARLIER_ROLL') {
      return String(a.rollNumber || '').localeCompare(String(b.rollNumber || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }
    if (tieBreakRule === 'HIGHER_CORE_MARKS' && (b.coreMarks ?? b.obtained) !== (a.coreMarks ?? a.obtained)) {
      return (b.coreMarks ?? b.obtained) - (a.coreMarks ?? a.obtained);
    }
    if (b.obtained !== a.obtained) return b.obtained - a.obtained;
    return String(a.rollNumber || '').localeCompare(String(b.rollNumber || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

function buildSelectedFilters({ exam, query = {}, scheme = null, extra = [] }) {
  const filters = [];
  if (exam) {
    const progName = exam.programId?.name || exam.programName || '';
    const clsName = exam.classId?.name || exam.className || '';
    const ctx = [progName, clsName].filter(Boolean).join(' — ');
    filters.push({ label: 'Exam & Program', value: ctx ? `${exam.examName} (${ctx})` : exam.examName });
  } else if (query.examId) filters.push({ label: 'Exam & Program', value: 'Selected Exam(s)' });
  if (query.programId && query.programId !== 'all') filters.push({ label: 'Program', value: 'Filtered' });
  if (query.classId && query.classId !== 'all') filters.push({ label: 'Class', value: 'Filtered' });
  if (query.sectionId && query.sectionId !== 'all') filters.push({ label: 'Section', value: 'Filtered' });
  if (scheme) filters.push({ label: 'Grade Scheme', value: scheme.name });
  extra.forEach(item => {
    if (item?.value) filters.push(item);
  });
  return filters;
}

// ---------------------------------------------------------------------------
// 1. Page 19 — Institutional Examination Analysis
// ---------------------------------------------------------------------------

async function buildInstitutionalAnalysis(query = {}) {
  const exams = await fetchMatchingExams(query);
  const examIds = exams.map(e => e._id);
  const subjectIds = toObjectIds(query.subjectId);
  const students = exams.length ? await fetchActiveCohortStudents(query, exams) : [];
  const studentMap = new Map(students.map(s => [String(s._id), s]));
  const marks = exams.length ? await fetchExamMarks(examIds, { subjectIds }) : [];

  const marksByExamStudent = new Map();
  marks.forEach(m => {
    if (!studentMap.has(m.studentIdStr)) return;
    const key = `${m.examIdStr}_${m.studentIdStr}`;
    if (!marksByExamStudent.has(key)) marksByExamStudent.set(key, []);
    marksByExamStudent.get(key).push(m);
  });

  // Resolve scheme per exam once
  const schemeCache = new Map();
  for (const ex of exams) {
    schemeCache.set(String(ex._id), await resolveGradeScheme(null, ex));
  }

  const reqStatuses = parseMulti(query.resultStatus)
    .map(s => s.trim().toUpperCase())
    .filter(s => s && s !== 'ALL');
  const programBuckets = new Map();

  for (const ex of exams) {
    const exId = String(ex._id);
    const exProgId = extractId(ex.programId);
    const exClassId = extractId(ex.classId);
    const exProgName = ex.programId?.name || 'General Program';
    const scheme = schemeCache.get(exId);
    const passPct = getEffectivePassPct(ex, scheme);

    if (!programBuckets.has(exProgId)) {
      programBuckets.set(exProgId, {
        programId: exProgId,
        programName: exProgName,
        registered: 0,
        appeared: 0,
        absent: 0,
        passed: 0,
        failed: 0,
        withheld: 0,
        sumObtained: 0,
        sumMax: 0,
      });
    }
    const bucket = programBuckets.get(exProgId);

    // Cohort for this exam: active students in its program/class OR with marks in this exam
    const cohortStudents = students.filter(s => {
      const sProg = extractId(s.programId);
      const sCls = extractId(s.classId);
      return (sProg === exProgId && sCls === exClassId) || marksByExamStudent.has(`${exId}_${String(s._id)}`);
    });

    for (const st of cohortStudents) {
      const stMarks = marksByExamStudent.get(`${exId}_${String(st._id)}`) || [];
      const summary = summarizeStudentMarksForExam(stMarks, passPct);

      const matchesFilter =
        reqStatuses.length === 0 ||
        reqStatuses.some(stKey =>
          (stKey === 'PASSED' && summary.isAppeared && summary.isPass) ||
          (stKey === 'FAILED' && summary.isAppeared && !summary.isPass && !summary.isWithheld) ||
          (stKey === 'ABSENT' && summary.isAbsent)
        );

      if (reqStatuses.length === 0 || matchesFilter) {
        bucket.registered += 1;
      }
      if (!matchesFilter) continue;

      if (summary.isAbsent) {
        bucket.absent += 1;
      } else if (summary.isAppeared) {
        bucket.appeared += 1;
        bucket.sumObtained += summary.obtained;
        bucket.sumMax += summary.total;
        if (summary.isWithheld) bucket.withheld += 1;
        else if (summary.isPass) bucket.passed += 1;
        else bucket.failed += 1;
      }
    }
  }

  const rows = Array.from(programBuckets.values())
    .filter(b => reqStatuses.length === 0 || b.registered > 0)
    .sort((a, b) => a.programName.localeCompare(b.programName))
    .map(b => ({
      programId: b.programId,
      programName: b.programName,
      registered: b.registered,
      appeared: b.appeared,
      absent: b.absent,
      passed: b.passed,
      failed: b.failed,
      passPct: formatPct(b.passed, b.appeared),
      avgPct: formatPct(b.sumObtained, b.sumMax),
    }));

  // CRITICAL MATH INVARIANT (Page 19): Weighted totalsRow — never average program % rows!
  const totals = Array.from(programBuckets.values()).reduce(
    (acc, b) => ({
      registered: acc.registered + b.registered,
      appeared: acc.appeared + b.appeared,
      absent: acc.absent + b.absent,
      passed: acc.passed + b.passed,
      failed: acc.failed + b.failed,
      withheld: acc.withheld + b.withheld,
      sumObtained: acc.sumObtained + b.sumObtained,
      sumMax: acc.sumMax + b.sumMax,
    }),
    { registered: 0, appeared: 0, absent: 0, passed: 0, failed: 0, withheld: 0, sumObtained: 0, sumMax: 0 }
  );

  const totalsRow = rows.length
    ? {
        programName: 'Institution total',
        registered: totals.registered,
        appeared: totals.appeared,
        absent: totals.absent,
        passed: totals.passed,
        failed: totals.failed,
        passPct: formatPct(totals.passed, totals.appeared),
        avgPct: formatPct(totals.sumObtained, totals.sumMax),
      }
    : null;

  const pendingMarksCount = Math.max(0, totals.registered - totals.appeared - totals.absent);
  const insightMsg = rows.length === 0
    ? 'No examination records match the selected filters.'
    : `Institutional pass rate is ${formatPct(totals.passed, totals.appeared)} across ${totals.appeared} appeared student-exam entries (${totals.absent} absent kept separate from ${totals.failed} academic failures${totals.withheld ? `, ${totals.withheld} withheld` : ''}${pendingMarksCount ? `, ${pendingMarksCount} pending mark entries` : ''}). Totals use weighted aggregate counts and marks.`;

  return {
    selectedFilters: buildSelectedFilters({
      exam: exams.length === 1 ? exams[0] : null,
      query,
      extra: reqStatuses.length > 0 ? [{ label: 'Result Status', value: reqStatuses.join(', ') }] : [],
    }),
    kpis: [
      { label: 'Registered', value: formatNum(totals.registered) },
      { label: 'Appeared', value: formatNum(totals.appeared), tone: 'info' },
      { label: 'Absent', value: formatNum(totals.absent), tone: totals.absent > 0 ? 'warning' : 'default' },
      { label: 'Overall pass rate (%)', value: formatPct(totals.passed, totals.appeared), tone: 'success' },
    ],
    columns: [
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'registered', label: 'Registered', align: 'right' },
      { key: 'appeared', label: 'Appeared', align: 'right' },
      { key: 'absent', label: 'Absent', align: 'right' },
      { key: 'passed', label: 'Passed', align: 'right' },
      { key: 'failed', label: 'Failed', align: 'right' },
      { key: 'passPct', label: 'Pass %', align: 'right' },
      { key: 'avgPct', label: 'Average %', align: 'right' },
    ],
    rows,
    totalsRow,
    charts: rows.length
      ? [{
          id: 'institutional-pass-rate',
          title: 'Program Pass % Comparison',
          type: 'bar',
          xKey: 'programName',
          yKey: 'passRate',
          dataKey: 'passRate',
          series: [
            { dataKey: 'passRate', label: 'Pass %', color: '#F7941E' },
            { dataKey: 'avgRate', label: 'Avg Marks %', color: '#2563eb' },
          ],
          data: Array.from(programBuckets.values()).map(b => ({
            programName: b.programName,
            passRate: pctValue(b.passed, b.appeared),
            avgRate: pctValue(b.sumObtained, b.sumMax),
          })),
        }]
      : [],
    insight: {
      severity: totals.failed > totals.passed ? 'warning' : 'info',
      message: insightMsg,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Page 20 — Class Result Gazette
// ---------------------------------------------------------------------------

async function buildClassGazette(query = {}) {
  const exams = await fetchMatchingExams(query);
  const exam = exams[0] || null;
  if (!exam) {
    return {
      selectedFilters: buildSelectedFilters({ query }),
      kpis: [
        { label: 'Students', value: '0' },
        { label: 'Appeared', value: '0' },
        { label: 'Absent', value: '0' },
        { label: 'Pass rate', value: '0.0%' },
      ],
      columns: [
        { key: 'rollNumber', label: 'Roll no.', align: 'left' },
        { key: 'studentName', label: 'Student', align: 'left' },
        { key: 'total', label: 'Total', align: 'right' },
        { key: 'percentage', label: '%', align: 'right' },
        { key: 'grade', label: 'Grade', align: 'center' },
      ],
      rows: [],
      totalsRow: null,
      insight: { severity: 'warning', message: 'No examination found for the selected filters.' },
    };
  }

  const scheme = await resolveGradeScheme(query.gradeSchemeId, exam);
  const passPct = getEffectivePassPct(exam, scheme);
  const cohortQuery = {
    programId: query.programId || extractId(exam.programId),
    classId: query.classId || extractId(exam.classId),
    sectionId: query.sectionId,
  };
  const students = await fetchActiveCohortStudents(cohortQuery, [exam]);
  const studentIds = students.map(s => s._id);
  const marks = await fetchExamMarks([exam._id], { studentIds });

  // Build unique subject list from Exam.schedule + ExamMarks
  const subjectMap = new Map();
  (exam.schedule || []).forEach(item => {
    const sId = extractId(item.subjectId);
    if (!sId) return;
    subjectMap.set(sId, {
      subjectId: sId,
      subjectName: item.subjectId?.name || 'Subject',
      defaultTotal: Number(item.totalMarks || 100),
    });
  });
  marks.forEach(m => {
    if (!m.subjectIdStr) return;
    if (!subjectMap.has(m.subjectIdStr)) {
      subjectMap.set(m.subjectIdStr, {
        subjectId: m.subjectIdStr,
        subjectName: m.subjectName || 'Subject',
        defaultTotal: Number(m.totalMarks || 100),
      });
    } else if (subjectMap.get(m.subjectIdStr).subjectName === 'Subject' && m.subjectName) {
      subjectMap.get(m.subjectIdStr).subjectName = m.subjectName;
    }
  });
  const subjects = Array.from(subjectMap.values());

  const marksByStudent = new Map();
  marks.forEach(m => {
    if (!marksByStudent.has(m.studentIdStr)) marksByStudent.set(m.studentIdStr, new Map());
    marksByStudent.get(m.studentIdStr).set(m.subjectIdStr, m);
  });

  let appearedCount = 0;
  let absentCount = 0;
  let passedCount = 0;
  let cohortObtained = 0;
  let cohortMax = 0;

  const rows = students.map(st => {
    const sId = String(st._id);
    const stSubMap = marksByStudent.get(sId) || new Map();
    const row = {
      studentId: sId,
      rollNumber: st.rollNumber || '—',
      studentName: fullName(st) || 'Student',
    };

    const stMarksList = [];
    subjects.forEach(sub => {
      const m = stSubMap.get(sub.subjectId);
      const colKey = `sub_${sub.subjectId}`;
      if (!m) {
        row[colKey] = '—';
        return;
      }
      stMarksList.push(m);
      const tot = Number(m.totalMarks || sub.defaultTotal || 100);
      if (m.isExempt) row[colKey] = 'Exempt';
      else if (m.isWithheld) row[colKey] = 'Withheld';
      else if (m.isAbsent) row[colKey] = `AB (0/${tot})`;
      else row[colKey] = `${Number(m.obtainedMarks || 0)}/${tot}`;
    });

    const summary = summarizeStudentMarksForExam(stMarksList, passPct);
    if (summary.isAbsent) {
      absentCount += 1;
      row.total = 'Absent';
      row.percentage = '—';
      row.grade = 'AB';
    } else if (!summary.isAppeared) {
      row.total = summary.status === 'EXEMPT' ? 'Exempt' : '—';
      row.percentage = '—';
      row.grade = summary.status === 'EXEMPT' ? 'EX' : '—';
    } else {
      appearedCount += 1;
      cohortObtained += summary.obtained;
      cohortMax += summary.total;
      if (summary.isPass) passedCount += 1;
      const g = summary.isWithheld
        ? 'WH'
        : computeGradeWithScheme(summary.pct, { ...scheme, passPercentage: passPct }).grade;
      row.total = `${summary.obtained} / ${summary.total}`;
      row.percentage = `${summary.pct.toFixed(1)}%`;
      row.grade = g;
    }
    return row;
  });

  const columns = [
    { key: 'rollNumber', label: 'Roll no.', align: 'left' },
    { key: 'studentName', label: 'Student', align: 'left' },
    ...subjects.map(sub => ({ key: `sub_${sub.subjectId}`, label: sub.subjectName, align: 'center' })),
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'percentage', label: '%', align: 'right' },
    { key: 'grade', label: 'Grade', align: 'center' },
  ];

  const totalsRow = rows.length
    ? {
        rollNumber: 'Cohort Summary',
        studentName: `${students.length} students (${appearedCount} appeared, ${absentCount} absent)`,
        total: `${cohortObtained} / ${cohortMax}`,
        percentage: formatPct(cohortObtained, cohortMax),
        grade: `${formatPct(passedCount, appearedCount)} Pass`,
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters({
      exam,
      query,
      scheme,
      extra: [{ label: 'Class', value: exam.classId?.name || 'Selected Class' }],
    }),
    kpis: [
      { label: 'Students', value: formatNum(students.length) },
      { label: 'Appeared', value: formatNum(appearedCount), tone: 'info' },
      { label: 'Absent', value: formatNum(absentCount), tone: absentCount > 0 ? 'warning' : 'default' },
      { label: 'Pass rate', value: formatPct(passedCount, appearedCount), tone: 'success' },
    ],
    columns,
    rows,
    totalsRow,
    insight: {
      severity: 'info',
      message: `Gazette for ${exam.examName} (${exam.programId?.name || ''} - ${exam.classId?.name || ''}) using "${scheme.name}" (pass threshold ${passPct}%).`,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Page 21 — Individual Student Result Card
// ---------------------------------------------------------------------------

async function buildStudentResultCard(query = {}) {
  let student = null;
  if (query.studentId && mongoose.Types.ObjectId.isValid(query.studentId)) {
    student = await Student.findById(query.studentId)
      .populate('programId', 'name code')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean();
  } else {
    const fallbackStudents = await fetchActiveCohortStudents(query, []);
    student = fallbackStudents[0] || null;
  }

  let exam = null;
  if (query.examId && mongoose.Types.ObjectId.isValid(query.examId)) {
    exam = await Exam.findById(query.examId)
      .populate('programId', 'name code')
      .populate('classId', 'name')
      .populate('schedule.subjectId', 'name code')
      .lean();
  } else if (student) {
    const examFilter = { classId: student.classId?._id || student.classId };
    if (query.sessionId && mongoose.Types.ObjectId.isValid(query.sessionId)) {
      examFilter.sessionId = new mongoose.Types.ObjectId(query.sessionId);
    }
    exam = await Exam.findOne(examFilter)
      .populate('programId', 'name code')
      .populate('classId', 'name')
      .populate('schedule.subjectId', 'name code')
      .sort({ startDate: -1 })
      .lean();
    if (!exam) {
      const anyMark = await ExamMarks.findOne({ studentId: student._id }).sort({ createdAt: -1 }).lean();
      if (anyMark) {
        exam = await Exam.findById(anyMark.examId)
          .populate('programId', 'name code')
          .populate('classId', 'name')
          .populate('schedule.subjectId', 'name code')
          .lean();
      }
    }
  }

  const columns = [
    { key: 'subjectName', label: 'Subject', align: 'left' },
    { key: 'totalMarks', label: 'Maximum marks', align: 'right' },
    { key: 'obtainedMarks', label: 'Obtained', align: 'right' },
    { key: 'percentage', label: 'Percentage', align: 'right' },
    { key: 'grade', label: 'Grade', align: 'center' },
    { key: 'teacherRemarks', label: 'Teacher remarks', align: 'left' },
  ];

  if (!student || !exam) {
    return {
      selectedFilters: buildSelectedFilters({ exam, query }),
      kpis: [
        { label: 'Total marks', value: '0 / 0' },
        { label: 'Percentage', value: '0.0%' },
        { label: 'Grade', value: '—' },
        { label: 'Class position', value: '—' },
      ],
      columns,
      rows: [],
      totalsRow: null,
      secondaryTables: [],
      insight: { severity: 'warning', message: 'Select an active student and examination to generate the student result card.' },
    };
  }

  const scheme = await resolveGradeScheme(query.gradeSchemeId, exam);
  const passPct = getEffectivePassPct(exam, scheme);
  const marks = await fetchExamMarks([exam._id], { studentIds: [student._id] });
  const markBySub = new Map(marks.map(m => [m.subjectIdStr, m]));

  // Merge scheduled subjects with any marks
  const subjects = [];
  const seenSub = new Set();
  (exam.schedule || []).forEach(s => {
    const sId = extractId(s.subjectId);
    if (sId && !seenSub.has(sId)) {
      seenSub.add(sId);
      subjects.push({ subjectId: sId, subjectName: s.subjectId?.name || 'Subject', totalMarks: Number(s.totalMarks || 100) });
    }
  });
  marks.forEach(m => {
    if (m.subjectIdStr && !seenSub.has(m.subjectIdStr)) {
      seenSub.add(m.subjectIdStr);
      subjects.push({ subjectId: m.subjectIdStr, subjectName: m.subjectName, totalMarks: Number(m.totalMarks || 100) });
    }
  });

  const rows = subjects.map(sub => {
    const m = markBySub.get(sub.subjectId);
    if (!m) {
      return {
        subjectName: sub.subjectName,
        totalMarks: sub.totalMarks,
        obtainedMarks: '—',
        percentage: '—',
        grade: '—',
        teacherRemarks: 'Marks not entered',
      };
    }
    const tot = Number(m.totalMarks || sub.totalMarks || 100);
    if (m.isExempt) {
      return {
        subjectName: sub.subjectName,
        totalMarks: tot,
        obtainedMarks: 'Exempt',
        percentage: '—',
        grade: 'EX',
        teacherRemarks: m.teacherRemarks || 'Exempted',
      };
    }
    if (m.isWithheld) {
      return {
        subjectName: sub.subjectName,
        totalMarks: tot,
        obtainedMarks: 'Withheld',
        percentage: '—',
        grade: 'WH',
        teacherRemarks: m.teacherRemarks || 'Result withheld',
      };
    }
    if (m.isAbsent) {
      return {
        subjectName: sub.subjectName,
        totalMarks: tot,
        obtainedMarks: 'Absent',
        percentage: '—',
        grade: 'AB',
        teacherRemarks: m.teacherRemarks || 'Absent in paper',
      };
    }
    const obt = Number(m.obtainedMarks || 0);
    const subPct = pctValue(obt, tot);
    const g = computeGradeWithScheme(subPct, { ...scheme, passPercentage: passPct });
    return {
      subjectName: sub.subjectName,
      totalMarks: tot,
      obtainedMarks: obt,
      percentage: `${subPct.toFixed(1)}%`,
      grade: g.grade,
      teacherRemarks: m.teacherRemarks || (g.isPass ? 'Satisfactory' : 'Needs Improvement'),
    };
  });

  const summary = summarizeStudentMarksForExam(marks, passPct);
  const overallGrade = summary.isAbsent
    ? 'AB'
    : summary.isWithheld
      ? 'WH'
      : !summary.isAppeared
        ? '—'
        : computeGradeWithScheme(summary.pct, { ...scheme, passPercentage: passPct }).grade;

  // Compute class position dynamically across active students in the exam's class
  const classStudents = await fetchActiveCohortStudents({
    classId: extractId(exam.classId),
    programId: extractId(exam.programId),
  }, [exam]);
  const classMarks = await fetchExamMarks([exam._id], { studentIds: classStudents.map(s => s._id) });
  const classMarksByStu = new Map();
  classMarks.forEach(m => {
    if (!classMarksByStu.has(m.studentIdStr)) classMarksByStu.set(m.studentIdStr, []);
    classMarksByStu.get(m.studentIdStr).push(m);
  });

  const rankedPeers = [];
  classStudents.forEach(peer => {
    const pSum = summarizeStudentMarksForExam(classMarksByStu.get(String(peer._id)) || [], passPct);
    if (pSum.isAppeared && !pSum.isWithheld && !pSum.anyAbsent) {
      rankedPeers.push({
        studentId: String(peer._id),
        rollNumber: peer.rollNumber || '',
        obtained: pSum.obtained,
        pct: pSum.pct,
      });
    }
  });
  const sortedPeers = sortMeritRows(rankedPeers, scheme.tieBreakRule);
  const rankIdx = sortedPeers.findIndex(p => p.studentId === String(student._id));
  const positionLabel = rankIdx >= 0 ? `${rankIdx + 1} / ${sortedPeers.length}` : '—';

  // Attendance summary for this student
  const attQuery = { role: 'STUDENT', studentId: student._id };
  if (exam.endDate) attQuery.date = { $lte: exam.endDate };
  const [attRecords, approvedLeaves] = await Promise.all([
    Attendance.find(attQuery).lean(),
    Leave.find({
      applicantType: 'STUDENT',
      studentId: student._id,
      status: { $regex: /^approved$/i },
    }).lean(),
  ]);
  let attPresent = 0;
  let attAbsent = 0;
  let attLeave = 0;
  const attDateSet = new Set();
  attRecords.forEach(r => {
    attDateSet.add(r.date);
    const st = String(r.status || '').toUpperCase();
    if (['PRESENT', 'LATE', 'HALF_DAY'].includes(st)) attPresent += 1;
    else if (st === 'ABSENT') attAbsent += 1;
    else if (st === 'LEAVE') attLeave += 1;
  });
  // Count approved leave days (up to exam.endDate if known) not already recorded in Attendance
  approvedLeaves.forEach(lv => {
    if (!lv.fromDate) return;
    const from = new Date(`${String(lv.fromDate).slice(0, 10)}T12:00:00`);
    const toRaw = String(lv.toDate || lv.fromDate).slice(0, 10);
    const capStr = exam.endDate && String(exam.endDate).slice(0, 10) < toRaw ? String(exam.endDate).slice(0, 10) : toRaw;
    const to = new Date(`${capStr}T12:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!attDateSet.has(dStr)) attLeave += 1;
    }
  });
  const attWorking = attPresent + attAbsent;

  const secondaryTables = [
    {
      title: 'Grading Boundaries Legend',
      columns: [
        { key: 'grade', label: 'Grade', align: 'center' },
        { key: 'range', label: 'Percentage Range', align: 'center' },
        { key: 'gpa', label: 'GPA', align: 'right' },
        { key: 'interpretation', label: 'Interpretation', align: 'left' },
      ],
      rows: [...(scheme.bands || [])]
        .sort((a, b) => Number(b.minPct) - Number(a.minPct))
        .map(b => ({
          grade: b.grade,
          range: `${b.minPct}% – ${b.maxPct ?? 100}%`,
          gpa: b.gpa != null ? Number(b.gpa).toFixed(1) : '—',
          interpretation: b.interpretation || '—',
        })),
    },
    {
      title: 'Attendance Summary',
      columns: [
        { key: 'metric', label: 'Metric', align: 'left' },
        { key: 'value', label: 'Value', align: 'right' },
      ],
      rows: [
        { metric: 'Tracked Working Days', value: formatNum(attWorking) },
        { metric: 'Present (incl. Late)', value: formatNum(attPresent) },
        { metric: 'Absent', value: formatNum(attAbsent) },
        { metric: 'Approved Leave', value: formatNum(attLeave) },
        { metric: 'Attendance %', value: attWorking > 0 ? formatPct(attPresent, attWorking) : '—' },
      ],
    },
  ];

  const totalsRow = {
    subjectName: 'Total',
    totalMarks: summary.total,
    obtainedMarks: summary.isAbsent ? 'Absent' : summary.isWithheld ? 'Withheld' : summary.obtained,
    percentage: summary.isAppeared ? `${summary.pct.toFixed(1)}%` : '—',
    grade: overallGrade,
    teacherRemarks: summary.isPass ? 'Passed' : summary.isAbsent ? 'Absent' : summary.isWithheld ? 'Withheld' : 'Needs Improvement',
  };

  return {
    selectedFilters: buildSelectedFilters({
      exam,
      query,
      scheme,
      extra: [
        { label: 'Student', value: `${fullName(student)} (${student.rollNumber || 'N/A'})` },
        { label: 'Program / Class', value: `${student.programId?.name || ''} - ${student.classId?.name || ''}` },
      ],
    }),
    kpis: [
      { label: 'Total marks', value: `${summary.obtained} / ${summary.total}` },
      { label: 'Percentage', value: summary.isAppeared ? `${summary.pct.toFixed(1)}%` : '0.0%', tone: 'info' },
      { label: 'Grade', value: overallGrade, tone: summary.isPass ? 'success' : 'warning' },
      { label: 'Class position', value: positionLabel },
    ],
    columns,
    rows,
    totalsRow,
    secondaryTables,
    insight: {
      severity: summary.isPass ? 'success' : 'warning',
      message: `${fullName(student)} (${student.rollNumber}) scored ${summary.obtained}/${summary.total} (${summary.pct.toFixed(1)}%, Grade ${overallGrade}) in ${exam.examName}. Class position: ${positionLabel}.`,
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Page 22 — Subject-wise Performance
// ---------------------------------------------------------------------------

async function buildSubjectPerformance(query = {}) {
  const exams = await fetchMatchingExams(query);
  const examIds = exams.map(e => e._id);
  const examMap = new Map(exams.map(e => [String(e._id), e]));
  const schemeMap = new Map();
  for (const ex of exams) {
    schemeMap.set(String(ex._id), await resolveGradeScheme(null, ex));
  }

  let subjectIds = toObjectIds(query.subjectId);
  let allowedClassSubjectKeys = null;

  // Teacher filter applies ONLY via TeacherMapping while subject identity stays from ExamMarks/Subject
  const reqTeacherIds = toObjectIds(query.teacherId);
  if (reqTeacherIds.length > 0) {
    const tmFilter = {
      teacherId: reqTeacherIds.length === 1 ? reqTeacherIds[0] : { $in: reqTeacherIds },
      subjectId: { $ne: null },
    };
    applyMultiIdFilter(tmFilter, 'classId', query.classId);
    const tMappings = await TeacherMapping.find(tmFilter).select('classId subjectId').lean();
    allowedClassSubjectKeys = new Set(
      tMappings.map(tm => `${tm.classId ? String(tm.classId) : '*'}_${String(tm.subjectId)}`)
    );
    const mappedSubjectIds = [...new Set(tMappings.map(tm => String(tm.subjectId)))].map(id => new mongoose.Types.ObjectId(id));
    if (mappedSubjectIds.length === 0) {
      return {
        selectedFilters: buildSelectedFilters({ query, extra: [{ label: 'Teacher', value: 'No mapped subjects' }] }),
        kpis: [
          { label: 'Subjects', value: '0' },
          { label: 'Overall average', value: '0.0%' },
          { label: 'Highest subject pass rate', value: '—' },
          { label: 'Lowest subject average', value: '—' },
        ],
        columns: [
          { key: 'subjectName', label: 'Subject', align: 'left' },
          { key: 'appeared', label: 'Appeared', align: 'right' },
          { key: 'passed', label: 'Passed', align: 'right' },
          { key: 'failed', label: 'Failed', align: 'right' },
          { key: 'avgPct', label: 'Average %', align: 'right' },
          { key: 'highestPct', label: 'Highest %', align: 'right' },
          { key: 'passPct', label: 'Pass %', align: 'right' },
        ],
        rows: [],
        totalsRow: null,
        insight: { severity: 'warning', message: 'Selected teacher has no subject mappings for the filtered exams.' },
      };
    }
    if (subjectIds.length > 0) {
      const mappedSet = new Set(mappedSubjectIds.map(String));
      subjectIds = subjectIds.filter(id => mappedSet.has(String(id)));
    } else {
      subjectIds = mappedSubjectIds;
    }
  }

  const students = exams.length ? await fetchActiveCohortStudents(query, exams) : [];
  const activeStudentSet = new Set(students.map(s => String(s._id)));
  const marks = exams.length ? await fetchExamMarks(examIds, { subjectIds }) : [];

  const subjectBuckets = new Map();
  let grandObtained = 0;
  let grandMax = 0;
  let grandAppeared = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  marks.forEach(m => {
    if (!activeStudentSet.has(m.studentIdStr)) return;
    if (m.isExempt || m.isAbsent) return;
    const ex = examMap.get(m.examIdStr);
    const clsId = extractId(m.classId) || extractId(ex?.classId);
    if (allowedClassSubjectKeys) {
      if (!allowedClassSubjectKeys.has(`${clsId}_${m.subjectIdStr}`) && !allowedClassSubjectKeys.has(`*_${m.subjectIdStr}`)) {
        return;
      }
    }

    if (!subjectBuckets.has(m.subjectIdStr)) {
      subjectBuckets.set(m.subjectIdStr, {
        subjectId: m.subjectIdStr,
        subjectName: m.subjectName,
        appeared: 0,
        passed: 0,
        failed: 0,
        sumObtained: 0,
        sumMax: 0,
        highestPct: 0,
      });
    }
    const b = subjectBuckets.get(m.subjectIdStr);
    const tot = Number(m.totalMarks || 100);
    const obt = Number(m.obtainedMarks || 0);
    const pct = tot > 0 ? (obt / tot) * 100 : 0;
    const passThreshold = getEffectivePassPct(ex, schemeMap.get(m.examIdStr));

    b.appeared += 1;
    b.sumObtained += obt;
    b.sumMax += tot;
    if (pct > b.highestPct) b.highestPct = pct;

    grandAppeared += 1;
    grandObtained += obt;
    grandMax += tot;

    if (!m.isWithheld && pct >= passThreshold) {
      b.passed += 1;
      grandPassed += 1;
    } else {
      b.failed += 1;
      grandFailed += 1;
    }
  });

  const bucketList = Array.from(subjectBuckets.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  const rows = bucketList.map(b => ({
    subjectId: b.subjectId,
    subjectName: b.subjectName,
    appeared: b.appeared,
    passed: b.passed,
    failed: b.failed,
    avgPct: formatPct(b.sumObtained, b.sumMax),
    highestPct: `${b.highestPct.toFixed(1)}%`,
    passPct: formatPct(b.passed, b.appeared),
    _avgNum: pctValue(b.sumObtained, b.sumMax),
    _passNum: pctValue(b.passed, b.appeared),
  }));

  const bestPass = rows.length ? [...rows].sort((a, b) => b._passNum - a._passNum)[0] : null;
  const lowestAvg = rows.length ? [...rows].sort((a, b) => a._avgNum - b._avgNum)[0] : null;

  const totalsRow = rows.length
    ? {
        subjectName: 'All Subjects (Weighted)',
        appeared: grandAppeared,
        passed: grandPassed,
        failed: grandFailed,
        avgPct: formatPct(grandObtained, grandMax),
        highestPct: `${Math.max(...bucketList.map(b => b.highestPct), 0).toFixed(1)}%`,
        passPct: formatPct(grandPassed, grandAppeared),
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters({ exam: exams.length === 1 ? exams[0] : null, query }),
    kpis: [
      { label: 'Subjects', value: formatNum(rows.length) },
      { label: 'Overall average', value: formatPct(grandObtained, grandMax), tone: 'info' },
      { label: 'Highest subject pass rate', value: bestPass ? `${bestPass.subjectName} (${bestPass.passPct})` : '—', tone: 'success' },
      { label: 'Lowest subject average', value: lowestAvg ? `${lowestAvg.subjectName} (${lowestAvg.avgPct})` : '—', tone: 'warning' },
    ],
    columns: [
      { key: 'subjectName', label: 'Subject', align: 'left' },
      { key: 'appeared', label: 'Appeared', align: 'right' },
      { key: 'passed', label: 'Passed', align: 'right' },
      { key: 'failed', label: 'Failed', align: 'right' },
      { key: 'avgPct', label: 'Average %', align: 'right' },
      { key: 'highestPct', label: 'Highest %', align: 'right' },
      { key: 'passPct', label: 'Pass %', align: 'right' },
    ],
    rows,
    totalsRow,
    insight: {
      severity: 'info',
      message: rows.length
        ? `Analyzed ${rows.length} subject(s) across ${grandAppeared} non-absent paper attempts. Overall weighted average is ${formatPct(grandObtained, grandMax)}.`
        : 'No subject examination marks found for the selected filters.',
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Page 23 — Position Holders & Merit List
// ---------------------------------------------------------------------------

async function buildPositionHolders(query = {}) {
  const exams = await fetchMatchingExams(query);
  const exam = exams[0] || null;
  if (!exam) {
    return {
      selectedFilters: buildSelectedFilters({ query }),
      kpis: [
        { label: 'Cohort size', value: '0' },
        { label: 'Appeared', value: '0' },
        { label: 'Merit positions shown', value: '0' },
        { label: 'Top score', value: '—' },
      ],
      columns: [
        { key: 'position', label: 'Position', align: 'center' },
        { key: 'studentName', label: 'Student', align: 'left' },
        { key: 'rollNumber', label: 'Roll no.', align: 'left' },
        { key: 'total', label: 'Total', align: 'right' },
        { key: 'percentage', label: 'Percentage', align: 'right' },
        { key: 'grade', label: 'Grade', align: 'center' },
      ],
      rows: [],
      totalsRow: null,
      insight: { severity: 'warning', message: 'No examination found for the selected merit list filters.' },
    };
  }

  const scheme = await resolveGradeScheme(query.gradeSchemeId, exam);
  const passPct = getEffectivePassPct(exam, scheme);
  const tieBreakRule = scheme.tieBreakRule || 'HIGHEST_PERCENTAGE';
  const cohortQuery = {
    programId: query.programId || extractId(exam.programId),
    classId: query.classId || extractId(exam.classId),
    sectionId: query.sectionId,
    gender: query.gender,
  };
  const students = await fetchActiveCohortStudents(cohortQuery, [exam]);
  const marks = await fetchExamMarks([exam._id], { studentIds: students.map(s => s._id) });

  const marksByStu = new Map();
  marks.forEach(m => {
    if (!marksByStu.has(m.studentIdStr)) marksByStu.set(m.studentIdStr, []);
    marksByStu.get(m.studentIdStr).push(m);
  });

  const eligible = [];
  const excludedRows = [];
  let appearedCount = 0;

  students.forEach(st => {
    const sId = String(st._id);
    const stMarks = marksByStu.get(sId) || [];
    const summary = summarizeStudentMarksForExam(stMarks, passPct);
    const name = fullName(st) || 'Student';
    const roll = st.rollNumber || '—';

    if (summary.isAppeared) appearedCount += 1;

    // CRITICAL: Exclude isAbsent (any absent paper or all absent) / isWithheld from merit positions
    if (summary.isAbsent || summary.anyAbsent || summary.isWithheld || !summary.isAppeared) {
      const label = summary.isWithheld ? 'Withheld' : (summary.isAbsent || summary.anyAbsent ? 'Absent' : 'Pending');
      excludedRows.push({
        position: '—',
        studentName: name,
        rollNumber: roll,
        total: summary.isAppeared ? `${summary.obtained} / ${summary.total}` : '—',
        percentage: summary.isAppeared ? `${summary.pct.toFixed(1)}%` : '—',
        grade: label,
      });
      return;
    }

    const gradeObj = computeGradeWithScheme(summary.pct, { ...scheme, passPercentage: passPct });
    eligible.push({
      studentId: sId,
      studentName: name,
      rollNumber: roll,
      obtained: summary.obtained,
      total: summary.total,
      pct: summary.pct,
      grade: gradeObj.grade,
    });
  });

  const sorted = sortMeritRows(eligible, tieBreakRule);
  const rankedRows = [];
  let lastRank = 0;
  let prev = null;

  sorted.forEach((item, idx) => {
    let rank = idx + 1;
    // With EARLIER_ROLL tie-break, roll order breaks ties deterministically so each gets distinct rank.
    // With HIGHEST_PERCENTAGE, exact pct+obtained ties share rank (standard competition ranking).
    if (
      tieBreakRule !== 'EARLIER_ROLL' &&
      prev &&
      Math.abs(prev.pct - item.pct) <= 1e-6 &&
      prev.obtained === item.obtained
    ) {
      rank = lastRank;
    }
    lastRank = rank;
    prev = item;
    rankedRows.push({
      position: rank,
      studentName: item.studentName,
      rollNumber: item.rollNumber,
      total: `${item.obtained} / ${item.total}`,
      percentage: `${item.pct.toFixed(1)}%`,
      grade: item.grade,
    });
  });

  const rows = [...rankedRows, ...excludedRows];
  const ruleExplanation =
    tieBreakRule === 'EARLIER_ROLL'
      ? 'EARLIER_ROLL: ties in percentage are broken strictly by ascending student roll number.'
      : tieBreakRule === 'HIGHER_CORE_MARKS'
        ? 'HIGHER_CORE_MARKS: ties in percentage are broken by higher total marks obtained.'
        : 'HIGHEST_PERCENTAGE: candidates are ranked by descending overall percentage (exact ties share merit position).';

  return {
    selectedFilters: buildSelectedFilters({
      exam,
      query,
      scheme,
      extra: query.gender && query.gender !== 'ALL' ? [{ label: 'Gender', value: query.gender }] : [],
    }),
    kpis: [
      { label: 'Cohort size', value: formatNum(students.length) },
      { label: 'Appeared', value: formatNum(appearedCount), tone: 'info' },
      { label: 'Merit positions shown', value: formatNum(rankedRows.length), tone: 'success' },
      { label: 'Top score', value: rankedRows.length ? `${rankedRows[0].percentage} (${rankedRows[0].studentName})` : '—' },
    ],
    columns: [
      { key: 'position', label: 'Position', align: 'center' },
      { key: 'studentName', label: 'Student', align: 'left' },
      { key: 'rollNumber', label: 'Roll no.', align: 'left' },
      { key: 'total', label: 'Total', align: 'right' },
      { key: 'percentage', label: 'Percentage', align: 'right' },
      { key: 'grade', label: 'Grade', align: 'center' },
    ],
    rows,
    totalsRow: null,
    insight: {
      severity: 'info',
      message: `Tie-break rule applied — ${ruleExplanation} Absent/withheld students (${excludedRows.length}) are excluded from merit positions and listed after ranked rows with "—".`,
    },
  };
}

// ---------------------------------------------------------------------------
// 6. Page 24 — Failures & Supplementary Candidates
// ---------------------------------------------------------------------------

async function buildFailuresSupplementary(query = {}) {
  const exams = await fetchMatchingExams(query);
  const examIds = exams.map(e => e._id);
  const examMap = new Map(exams.map(e => [String(e._id), e]));
  const schemeMap = new Map();
  for (const ex of exams) {
    schemeMap.set(String(ex._id), await resolveGradeScheme(null, ex));
  }

  const subjectIds = toObjectIds(query.subjectId);
  const students = exams.length ? await fetchActiveCohortStudents(query, exams) : [];
  const studentMap = new Map(students.map(s => [String(s._id), s]));
  const marks = exams.length ? await fetchExamMarks(examIds, { subjectIds }) : [];

  const groupedByExamStu = new Map();
  marks.forEach(m => {
    if (!studentMap.has(m.studentIdStr)) return;
    const key = `${m.examIdStr}_${m.studentIdStr}`;
    if (!groupedByExamStu.has(key)) groupedByExamStu.set(key, []);
    groupedByExamStu.get(key).push(m);
  });

  const failureRows = [];
  const exceptionRows = []; // Separated isAbsent / isWithheld / isExempt records
  let totalSubjectFailures = 0;
  let multipleSubjectFailures = 0;
  let singleSubjectFailures = 0;

  for (const [key, stMarks] of groupedByExamStu.entries()) {
    const [examIdStr, studentIdStr] = key.split('_');
    const exam = examMap.get(examIdStr);
    const student = studentMap.get(studentIdStr);
    if (!exam || !student) continue;

    const scheme = schemeMap.get(examIdStr);
    const passPct = Number(exam.passPercentage || scheme?.passPercentage || 50);
    const supplMode = exam.supplEligibility || 'PER_SUBJECT';

    const programName = student.programId?.name || exam.programId?.name || 'Program';
    const className = student.classId?.name || exam.classId?.name || 'Class';
    const sName = fullName(student) || 'Student';

    const academicFailed = [];
    let attemptedObtained = 0;
    let attemptedTotal = 0;

    stMarks.forEach(m => {
      if (m.isExempt || m.isWithheld || m.isAbsent) {
        const flag = m.isExempt ? 'Exempt' : m.isWithheld ? 'Withheld' : 'Absent';
        exceptionRows.push({
          studentName: sName,
          programName,
          className,
          failedSubjects: m.subjectName,
          marks: flag === 'Absent' ? `AB (0/${m.totalMarks || 100})` : flag,
          passMark: `${Math.ceil(((m.totalMarks || 100) * passPct) / 100)}/${m.totalMarks || 100} (${passPct}%)`,
          action: `${flag} — Excluded from academic failures`,
          _category: 'ABSENT_WITHHELD',
        });
        return;
      }
      const tot = Number(m.totalMarks || 100);
      const obt = Number(m.obtainedMarks || 0);
      attemptedObtained += obt;
      attemptedTotal += tot;
      const pct = tot > 0 ? (obt / tot) * 100 : 0;
      if (pct < passPct) {
        academicFailed.push({
          subjectName: m.subjectName,
          obt,
          tot,
          passMarkVal: Math.ceil((tot * passPct) / 100),
        });
      }
    });

    if (academicFailed.length === 0) continue;

    const overallPct = attemptedTotal > 0 ? (attemptedObtained / attemptedTotal) * 100 : 0;
    const isPerExamFail = supplMode === 'PER_EXAM' && overallPct < passPct;
    const failedCount = academicFailed.length;

    // Under PER_EXAM, if aggregate >= passPct, student passed aggregate; only flag if failed aggregate or single/multi under PER_SUBJECT
    if (supplMode === 'PER_EXAM' && overallPct >= passPct) continue;

    totalSubjectFailures += failedCount;
    if (failedCount === 1) singleSubjectFailures += 1;
    else multipleSubjectFailures += 1;

    let actionLabel = '';
    let category = 'SUPPLEMENTARY';
    if (supplMode === 'PER_EXAM') {
      actionLabel = isPerExamFail ? 'Repeat Full Exam (PER_EXAM)' : 'Re-appear';
      category = 'REPEAT';
    } else if (failedCount === 1) {
      actionLabel = 'Supplementary Eligible (PER_SUBJECT)';
      category = 'SUPPLEMENTARY';
    } else {
      actionLabel = `Multiple Failures (${failedCount}) — Repeat / Multi-Suppl`;
      category = 'REPEAT';
    }

    failureRows.push({
      studentName: sName,
      programName,
      className,
      failedSubjects: academicFailed.map(f => f.subjectName).join(', '),
      marks: academicFailed.map(f => `${f.obt}/${f.tot}`).join(', '),
      passMark: academicFailed.map(f => `${f.passMarkVal}/${f.tot}`).join(', '),
      action: actionLabel,
      _category: category,
    });
  }

  const eligValues = parseMulti(query.eligibility)
    .map(s => s.trim().toUpperCase())
    .filter(s => s && s !== 'ALL');
  let rows = failureRows;
  if (eligValues.length > 0) {
    const combined = [];
    if (eligValues.includes('SUPPLEMENTARY')) {
      combined.push(...failureRows.filter(r => r._category === 'SUPPLEMENTARY'));
    }
    if (eligValues.includes('REPEAT')) {
      combined.push(...failureRows.filter(r => r._category === 'REPEAT'));
    }
    if (eligValues.includes('ABSENT_WITHHELD')) {
      combined.push(...exceptionRows);
    }
    rows = combined;
  }

  const columns = [
    { key: 'studentName', label: 'Student', align: 'left' },
    { key: 'programName', label: 'Program', align: 'left' },
    { key: 'className', label: 'Class', align: 'left' },
    { key: 'failedSubjects', label: 'Failed subject(s)', align: 'left' },
    { key: 'marks', label: 'Marks', align: 'right' },
    { key: 'passMark', label: 'Pass mark', align: 'right' },
    { key: 'action', label: 'Action', align: 'left' },
  ];

  const secondaryTables = exceptionRows.length > 0 && !(eligValues.length === 1 && eligValues[0] === 'ABSENT_WITHHELD')
    ? [{
        title: 'Absent / Withheld / Exempt Subject Entries (Separated from Academic Failures)',
        columns,
        rows: exceptionRows,
      }]
    : [];

  return {
    selectedFilters: buildSelectedFilters({
      exam: exams.length === 1 ? exams[0] : null,
      query,
      extra: eligValues.length > 0 ? [{ label: 'Eligibility', value: eligValues.join(', ') }] : [],
    }),
    kpis: [
      { label: 'Students failed', value: formatNum(failureRows.length), tone: failureRows.length > 0 ? 'danger' : 'success' },
      { label: 'Subject failures', value: formatNum(totalSubjectFailures) },
      { label: 'Multiple subject failures', value: formatNum(multipleSubjectFailures), tone: 'warning' },
      { label: 'Single subject failures', value: formatNum(singleSubjectFailures), tone: 'info' },
    ],
    columns,
    rows,
    totalsRow: null,
    secondaryTables,
    insight: {
      severity: failureRows.length > 0 ? 'warning' : 'success',
      message: `${failureRows.length} student(s) have actual academic failures (${singleSubjectFailures} single-subject, ${multipleSubjectFailures} multi-subject). ${exceptionRows.length} absent/withheld/exempt paper entries are tracked separately and never counted as academic failures.`,
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Page 25 — Grade Distribution
// ---------------------------------------------------------------------------

async function buildGradeDistribution(query = {}) {
  const exams = await fetchMatchingExams(query);
  const primaryExam = exams[0] || null;
  const scheme = await resolveGradeScheme(query.gradeSchemeId, primaryExam);
  const explicitSchemeRequested = Boolean(
    query.gradeSchemeId && query.gradeSchemeId !== 'all' && query.gradeSchemeId !== 'default'
  );
  const passPct = explicitSchemeRequested
    ? Number(scheme?.passPercentage ?? primaryExam?.passPercentage ?? 50)
    : getEffectivePassPct(primaryExam, scheme);

  const examIds = exams.map(e => e._id);
  const students = exams.length ? await fetchActiveCohortStudents(query, exams) : [];
  const studentSet = new Set(students.map(s => String(s._id)));
  const marks = exams.length ? await fetchExamMarks(examIds) : [];

  const marksByExamStu = new Map();
  marks.forEach(m => {
    if (!studentSet.has(m.studentIdStr)) return;
    const key = `${m.examIdStr}_${m.studentIdStr}`;
    if (!marksByExamStu.has(key)) marksByExamStu.set(key, []);
    marksByExamStu.get(key).push(m);
  });

  const sortedBands = [...(scheme.bands || [])].sort((a, b) => Number(b.minPct) - Number(a.minPct));
  const countsByGrade = new Map(sortedBands.map(b => [b.grade, 0]));

  let appearedCount = 0;
  let passedCount = 0;
  let failedCount = 0;
  let absentOrWithheld = 0;

  for (const stMarks of marksByExamStu.values()) {
    const summary = summarizeStudentMarksForExam(stMarks, passPct);
    if (!summary.isAppeared || summary.isWithheld) {
      if (summary.isAbsent || summary.isWithheld) absentOrWithheld += 1;
      continue;
    }
    appearedCount += 1;
    if (summary.isPass) passedCount += 1;
    else failedCount += 1;

    const gObj = computeGradeWithScheme(summary.pct, { ...scheme, passPercentage: passPct });
    countsByGrade.set(gObj.grade, (countsByGrade.get(gObj.grade) || 0) + 1);
  }

  const rows = sortedBands.map(b => {
    const count = countsByGrade.get(b.grade) || 0;
    return {
      grade: b.grade,
      bandRange: `${b.minPct}% – ${b.maxPct ?? 100}%`,
      students: count,
      share: formatPct(count, appearedCount),
      interpretation: b.interpretation || '—',
      _sharePct: pctValue(count, appearedCount),
    };
  });

  const topBandCount = sortedBands
    .filter(b => /^(A\+|A)$/i.test(String(b.grade).trim()))
    .reduce((sum, b) => sum + (countsByGrade.get(b.grade) || 0), 0);

  return {
    selectedFilters: buildSelectedFilters({ exam: exams.length === 1 ? primaryExam : null, query, scheme }),
    kpis: [
      { label: 'Appeared', value: formatNum(appearedCount), tone: 'info' },
      { label: 'Passed', value: formatNum(passedCount), tone: 'success' },
      { label: 'Failed', value: formatNum(failedCount), tone: failedCount > 0 ? 'danger' : 'default' },
      { label: 'Top Grade Band (A / A+)', value: `${formatNum(topBandCount)} (${formatPct(topBandCount, appearedCount)})` },
    ],
    columns: [
      { key: 'grade', label: 'Grade', align: 'center' },
      { key: 'bandRange', label: 'Percentage band', align: 'center' },
      { key: 'students', label: 'Students', align: 'right' },
      { key: 'share', label: 'Share of appeared', align: 'right' },
      { key: 'interpretation', label: 'Interpretation', align: 'left' },
    ],
    rows,
    totalsRow: appearedCount > 0
      ? {
          grade: 'Total',
          bandRange: `Pass >= ${passPct}%`,
          students: appearedCount,
          share: '100.0%',
          interpretation: `${passedCount} Passed / ${failedCount} Failed`,
        }
      : null,
    charts: [
      {
        id: 'grade-distribution-bar',
        title: 'Grade Distribution',
        type: 'bar',
        xKey: 'grade',
        yKey: 'students',
        dataKey: 'students',
        series: [{ dataKey: 'students', label: 'Students', color: '#F7941E' }],
        data: rows.map(r => ({ grade: r.grade, students: r.students, sharePct: r._sharePct })),
      },
    ],
    insight: {
      severity: 'info',
      message: `Evaluated ${appearedCount} appeared result(s) against "${scheme.name}" (Pass >= ${passPct}%).${absentOrWithheld ? ` ${absentOrWithheld} absent/withheld record(s) excluded from grade bands.` : ''}`,
    },
    rawExtra: { gradeScheme: scheme },
  };
}

// ---------------------------------------------------------------------------
// 8. Page 26 — Marks Entry & Verification Status
// ---------------------------------------------------------------------------

async function buildMarksVerification(query = {}) {
  const exams = await fetchMatchingExams(query);
  const examIds = exams.map(e => e._id);
  const subjectIdsFilter = toObjectIds(query.subjectId);
  const subjectFilterSet = new Set(subjectIdsFilter.map(String));

  // Active enrolled students grouped by (programId, classId)
  const students = exams.length ? await fetchActiveCohortStudents({}, exams) : [];
  const activeCountByCohort = new Map();
  const activeStudentSet = new Set();
  students.forEach(s => {
    activeStudentSet.add(String(s._id));
    const key = `${extractId(s.programId)}_${extractId(s.classId)}`;
    activeCountByCohort.set(key, (activeCountByCohort.get(key) || 0) + 1);
  });

  // Teacher mappings for subject teacher lookup & teacherId filter
  const tmFilter = { mappingType: 'SUBJECT', subjectId: { $ne: null } };
  const reqTeacherIds = toObjectIds(query.teacherId);
  applyMultiIdFilter(tmFilter, 'teacherId', query.teacherId);
  const teacherMappings = await TeacherMapping.find(tmFilter).populate('teacherId', 'name staffId').lean();
  const teacherByClassSubject = new Map();
  teacherMappings.forEach(tm => {
    const key = `${extractId(tm.classId)}_${extractId(tm.subjectId)}`;
    if (!teacherByClassSubject.has(key)) teacherByClassSubject.set(key, []);
    if (tm.teacherId?.name) teacherByClassSubject.get(key).push(tm.teacherId.name);
  });

  const marks = await fetchExamMarks(examIds, { subjectIds: subjectIdsFilter });
  const marksByExamSub = new Map();
  marks.forEach(m => {
    if (!activeStudentSet.has(m.studentIdStr)) return;
    const key = `${m.examIdStr}_${m.subjectIdStr}`;
    if (!marksByExamSub.has(key)) marksByExamSub.set(key, []);
    marksByExamSub.get(key).push(m);
  });

  const allRows = [];
  for (const ex of exams) {
    const exId = String(ex._id);
    const progId = extractId(ex.programId);
    const clsId = extractId(ex.classId);
    const expected = activeCountByCohort.get(`${progId}_${clsId}`) || 0;

    // Scheduled subjects + any unscheduled subjects with entered marks
    const subEntries = new Map();
    (ex.schedule || []).forEach(item => {
      const sId = extractId(item.subjectId);
      if (sId) subEntries.set(sId, item.subjectId?.name || 'Subject');
    });
    marks.forEach(m => {
      if (m.examIdStr === exId && m.subjectIdStr && !subEntries.has(m.subjectIdStr)) {
        subEntries.set(m.subjectIdStr, m.subjectName || 'Subject');
      }
    });

    for (const [subId, subName] of subEntries.entries()) {
      if (subjectFilterSet.size > 0 && !subjectFilterSet.has(subId)) continue;
      const teachers = teacherByClassSubject.get(`${clsId}_${subId}`) || [];
      if (reqTeacherIds.length > 0 && teachers.length === 0) {
        continue;
      }

      const subMarks = marksByExamSub.get(`${exId}_${subId}`) || [];
      const entered = subMarks.length;
      const verified = subMarks.filter(m => m.verified === true).length;
      const pending = Math.max(0, entered - verified);
      const missing = Math.max(0, expected - entered);

      let rowStatus = 'VERIFIED';
      if (entered === 0 || missing > 0) rowStatus = entered === 0 ? 'MISSING' : (pending > 0 ? 'PENDING_VERIFICATION' : 'MISSING');
      else if (pending > 0) rowStatus = 'PENDING_VERIFICATION';

      const lockTag = ex.resultLocked ? 'Locked' : 'Unlocked';
      const statusLabel =
        entered === 0
          ? `Missing (${expected})`
          : missing > 0
            ? `Partial (${missing} missing, ${pending} unverified)`
            : pending > 0
              ? `Pending Verification (${pending})`
              : 'Verified';

      allRows.push({
        programName: ex.programId?.name || 'Program',
        subjectName: subName,
        teacherName: teachers.length ? [...new Set(teachers)].join(', ') : 'Unassigned',
        expected,
        entered,
        verified,
        pending,
        lockStatus: `${statusLabel} • ${lockTag}`,
        _rowStatus: rowStatus,
        _missing: missing,
        actionContext: {
          examId: exId,
          subjectId: subId,
          verified: pending > 0 || entered === 0 ? 'true' : 'false',
          resultLocked: ex.resultLocked ? 'false' : 'true',
        },
        _meta: {
          examId: exId,
          examName: ex.examName,
          subjectId: subId,
          resultLocked: Boolean(ex.resultLocked),
        },
      });
    }
  }

  const statusValues = parseMulti(query.status)
    .map(s => s.trim().toUpperCase())
    .filter(s => s && s !== 'ALL');
  const rows = statusValues.length === 0
    ? allRows
    : allRows.filter(r => statusValues.some(st => {
        if (st === 'MISSING') return r._missing > 0 || r.entered === 0;
        if (st === 'PENDING_VERIFICATION') return r.pending > 0;
        if (st === 'VERIFIED') return r.entered > 0 && r.pending === 0 && r._missing === 0;
        return true;
      }));

  const totals = rows.reduce(
    (acc, r) => ({
      expected: acc.expected + r.expected,
      entered: acc.entered + r.entered,
      missing: acc.missing + r._missing,
      verified: acc.verified + r.verified,
      pending: acc.pending + r.pending,
    }),
    { expected: 0, entered: 0, missing: 0, verified: 0, pending: 0 }
  );

  return {
    selectedFilters: buildSelectedFilters({
      exam: exams.length === 1 ? exams[0] : null,
      query,
      extra: statusValues.length > 0 ? [{ label: 'Verification Status', value: statusValues.join(', ') }] : [],
    }),
    kpis: [
      { label: 'Expected mark entries', value: formatNum(totals.expected) },
      { label: 'Entered', value: formatNum(totals.entered), tone: 'info' },
      { label: 'Missing', value: formatNum(totals.missing), tone: totals.missing > 0 ? 'danger' : 'success' },
      { label: 'Verified', value: formatNum(totals.verified), tone: 'success' },
    ],
    columns: [
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'subjectName', label: 'Subject', align: 'left' },
      { key: 'teacherName', label: 'Teacher', align: 'left' },
      { key: 'expected', label: 'Expected', align: 'right' },
      { key: 'entered', label: 'Entered', align: 'right' },
      { key: 'verified', label: 'Verified', align: 'right' },
      { key: 'pending', label: 'Pending', align: 'right' },
      { key: 'lockStatus', label: 'Verification / Lock', align: 'left' },
    ],
    rows,
    totalsRow: rows.length
      ? {
          programName: 'Total',
          subjectName: `${rows.length} paper(s)`,
          teacherName: '—',
          expected: totals.expected,
          entered: totals.entered,
          verified: totals.verified,
          pending: totals.pending,
          lockStatus: `${totals.missing} missing`,
        }
      : null,
    insight: {
      severity: totals.missing > 0 || totals.pending > 0 ? 'warning' : 'success',
      message: `${totals.entered} of ${totals.expected} expected entries recorded (${totals.verified} verified, ${totals.pending} pending verification, ${totals.missing} missing).`,
    },
  };
}

// ---------------------------------------------------------------------------
// 9. Page 27 — Exam Attendance & Absenteeism
// ---------------------------------------------------------------------------

async function buildExamAttendanceAbsenteeism(query = {}) {
  const exams = await fetchMatchingExams(query);
  const examIds = exams.map(e => e._id);
  const subjectIdsFilter = toObjectIds(query.subjectId);
  const subjectFilterSet = new Set(subjectIdsFilter.map(String));

  const students = exams.length ? await fetchActiveCohortStudents({}, exams) : [];
  const activeCountByCohort = new Map();
  const activeStudentSet = new Set();
  students.forEach(s => {
    activeStudentSet.add(String(s._id));
    const key = `${extractId(s.programId)}_${extractId(s.classId)}`;
    activeCountByCohort.set(key, (activeCountByCohort.get(key) || 0) + 1);
  });

  // Strictly join Exam.schedule with ExamMarks (isAbsent, isExempt); never daily class Attendance
  const marks = await fetchExamMarks(examIds, { subjectIds: subjectIdsFilter });
  const marksByExamSub = new Map();
  marks.forEach(m => {
    if (!activeStudentSet.has(m.studentIdStr)) return;
    const key = `${m.examIdStr}_${m.subjectIdStr}`;
    if (!marksByExamSub.has(key)) marksByExamSub.set(key, []);
    marksByExamSub.get(key).push(m);
  });

  const dateFrom = query.dateFrom ? String(query.dateFrom).slice(0, 10) : '';
  const dateTo = query.dateTo ? String(query.dateTo).slice(0, 10) : '';

  const rows = [];
  let totalRegistered = 0;
  let totalAppeared = 0;
  let totalAbsent = 0;
  let totalExempt = 0;

  for (const ex of exams) {
    const exId = String(ex._id);
    const cohortCount = activeCountByCohort.get(`${extractId(ex.programId)}_${extractId(ex.classId)}`) || 0;
    const progName = ex.programId?.name || 'Program';

    const scheduledItems = [...(ex.schedule || [])];
    const scheduledSubIds = new Set(scheduledItems.map(s => extractId(s.subjectId)));

    // Include any marks whose subject wasn't listed in schedule
    marks.forEach(m => {
      if (m.examIdStr === exId && m.subjectIdStr && !scheduledSubIds.has(m.subjectIdStr)) {
        scheduledSubIds.add(m.subjectIdStr);
        scheduledItems.push({
          subjectId: { _id: m.subjectIdStr, name: m.subjectName },
          date: ex.startDate,
        });
      }
    });

    for (const item of scheduledItems) {
      const subId = extractId(item.subjectId);
      if (!subId) continue;
      if (subjectFilterSet.size > 0 && !subjectFilterSet.has(subId)) continue;
      const paperDate = String(item.date || ex.startDate || '').slice(0, 10);
      if (dateFrom && paperDate && paperDate < dateFrom) continue;
      if (dateTo && paperDate && paperDate > dateTo) continue;

      const subMarks = marksByExamSub.get(`${exId}_${subId}`) || [];
      const exempt = subMarks.filter(m => m.isExempt).length;
      const absent = subMarks.filter(m => !m.isExempt && m.isAbsent).length;
      const appeared = subMarks.filter(m => !m.isExempt && !m.isAbsent).length;
      const registered = Math.max(appeared + absent, cohortCount - exempt);

      totalRegistered += registered;
      totalAppeared += appeared;
      totalAbsent += absent;
      totalExempt += exempt;

      rows.push({
        date: paperDate ? formatDate(paperDate) : '—',
        _rawDate: paperDate,
        subjectName: item.subjectId?.name || subMarks[0]?.subjectName || 'Subject',
        programName: progName,
        registered,
        appeared,
        absent,
        attendancePct: formatPct(appeared, registered),
      });
    }
  }

  rows.sort((a, b) => (a._rawDate || '').localeCompare(b._rawDate || ''));

  const totalsRow = rows.length
    ? {
        date: 'Total',
        subjectName: `${rows.length} paper(s)`,
        programName: 'All Programs',
        registered: totalRegistered,
        appeared: totalAppeared,
        absent: totalAbsent,
        attendancePct: formatPct(totalAppeared, totalRegistered),
      }
    : null;

  return {
    selectedFilters: buildSelectedFilters({
      exam: exams.length === 1 ? exams[0] : null,
      query,
      extra: [
        dateFrom ? { label: 'From Date', value: dateFrom } : null,
        dateTo ? { label: 'To Date', value: dateTo } : null,
      ].filter(Boolean),
    }),
    kpis: [
      { label: 'Expected paper entries', value: formatNum(totalRegistered) },
      { label: 'Appeared', value: formatNum(totalAppeared), tone: 'info' },
      { label: 'Absent', value: formatNum(totalAbsent), tone: totalAbsent > 0 ? 'warning' : 'default' },
      { label: 'Exam attendance %', value: formatPct(totalAppeared, totalRegistered), tone: 'success' },
    ],
    columns: [
      { key: 'date', label: 'Date', align: 'left' },
      { key: 'subjectName', label: 'Subject', align: 'left' },
      { key: 'programName', label: 'Program', align: 'left' },
      { key: 'registered', label: 'Registered', align: 'right' },
      { key: 'appeared', label: 'Appeared', align: 'right' },
      { key: 'absent', label: 'Absent', align: 'right' },
      { key: 'attendancePct', label: 'Attendance %', align: 'right' },
    ],
    rows,
    totalsRow,
    insight: {
      severity: totalAbsent > 0 ? 'warning' : 'info',
      message: `Computed strictly from Exam.schedule and ExamMarks (${totalAppeared} appeared, ${totalAbsent} absent${totalExempt ? `, ${totalExempt} exempt excluded` : ''}). Daily class attendance is excluded.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Inline Actions
// ---------------------------------------------------------------------------

function parseCustomBandsText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const entries = rawText.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
  const parsed = [];
  for (const item of entries) {
    const m = item.match(/^([A-Za-z0-9+\-]+)\s*[:=]\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?(?:\s*[:|]\s*(\d+(?:\.\d+)?))?$/);
    if (!m) continue;
    const minPct = Number(m[2]);
    const maxPct = m[3] !== undefined ? Number(m[3]) : 100;
    const gpa = m[4] !== undefined ? Number(m[4]) : null;
    if (Number.isFinite(minPct) && Number.isFinite(maxPct)) {
      parsed.push({ grade: m[1].trim(), minPct, maxPct, gpa, interpretation: '' });
    }
  }
  return parsed;
}

function buildPresetGradeBands(preset = 'STANDARD', passPct = 50) {
  const key = String(preset || 'STANDARD').toUpperCase();
  if (key === 'LENIENT') {
    return [
      { grade: 'A+', minPct: 85, maxPct: 100, gpa: 4.0, interpretation: 'Outstanding' },
      { grade: 'A', minPct: 75, maxPct: 84.99, gpa: 3.7, interpretation: 'Excellent' },
      { grade: 'B', minPct: 65, maxPct: 74.99, gpa: 3.0, interpretation: 'Very Good' },
      { grade: 'C', minPct: 55, maxPct: 64.99, gpa: 2.5, interpretation: 'Good' },
      { grade: 'D', minPct: Math.min(Number(passPct || 40), 54), maxPct: 54.99, gpa: 2.0, interpretation: 'Pass' },
      { grade: 'Fail', minPct: 0, maxPct: Number(Math.max(0, Math.min(Number(passPct || 40), 54) - 0.01).toFixed(2)), gpa: 0.0, interpretation: 'Below pass' },
    ];
  }
  if (key === 'STRICT') {
    return [
      { grade: 'A+', minPct: 92, maxPct: 100, gpa: 4.0, interpretation: 'Outstanding' },
      { grade: 'A', minPct: 85, maxPct: 91.99, gpa: 3.7, interpretation: 'Excellent' },
      { grade: 'B', minPct: 75, maxPct: 84.99, gpa: 3.0, interpretation: 'Very Good' },
      { grade: 'C', minPct: 65, maxPct: 74.99, gpa: 2.5, interpretation: 'Good' },
      { grade: 'D', minPct: Math.max(Number(passPct || 55), 50), maxPct: 64.99, gpa: 2.0, interpretation: 'Pass' },
      { grade: 'Fail', minPct: 0, maxPct: Number(Math.max(0, Math.max(Number(passPct || 55), 50) - 0.01).toFixed(2)), gpa: 0.0, interpretation: 'Below pass' },
    ];
  }
  return buildDefaultGradeScheme(passPct).bands;
}

async function saveGradeSchemeAction(payload = {}, ctx = {}) {
  const reqUser = getReqUser(ctx);
  const name = String(payload.name || '').trim();
  const passPercentage = Number(payload.passPercentage ?? 50);

  let bands;
  if (Array.isArray(payload.bands)) {
    bands = payload.bands;
  } else {
    const customBands = parseCustomBandsText(payload.bandsText);
    bands = customBands.length > 0 ? customBands : buildPresetGradeBands(payload.preset, passPercentage);
  }

  if (!name || bands.length === 0) {
    const err = new Error('Scheme name and at least one grade range are required');
    err.statusCode = 400;
    throw err;
  }
  const cleanBands = bands.map(b => ({
    grade: String(b.grade || '').trim(),
    minPct: Number(b.minPct ?? 0),
    maxPct: Number(b.maxPct ?? 100),
    gpa: b.gpa !== undefined && b.gpa !== null && b.gpa !== '' ? Number(b.gpa) : null,
    interpretation: String(b.interpretation || ''),
  }));
  const isDefault = parseBooleanFlag(payload.isDefault, false);
  const schemeData = {
    name,
    passPercentage,
    tieBreakRule: ['HIGHEST_PERCENTAGE', 'HIGHER_CORE_MARKS', 'EARLIER_ROLL'].includes(payload.tieBreakRule)
      ? payload.tieBreakRule
      : 'HIGHEST_PERCENTAGE',
    isDefault,
    bands: cleanBands,
  };
  if (payload.sessionId && mongoose.Types.ObjectId.isValid(payload.sessionId)) {
    schemeData.sessionId = payload.sessionId;
  }

  const targetId = payload.id || payload.gradeSchemeId;
  let saved;
  if (targetId && targetId !== 'default' && mongoose.Types.ObjectId.isValid(targetId)) {
    if (isDefault) await GradeScheme.updateMany({ _id: { $ne: targetId } }, { $set: { isDefault: false } });
    saved = await GradeScheme.findByIdAndUpdate(targetId, { $set: schemeData }, { new: true }).lean();
  } else {
    if (isDefault) await GradeScheme.updateMany({}, { $set: { isDefault: false } });
    saved = (await GradeScheme.create(schemeData)).toObject();
  }

  await ActivityLog.create({
    userId: reqUser?.id || null,
    userName: reqUser?.name || reqUser?.email || 'Administrator',
    userEmail: reqUser?.email || '',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Examination',
    subModule: 'Results',
    action: 'SAVE_GRADE_SCHEME',
    actionType: targetId && targetId !== 'default' ? 'UPDATE' : 'CREATE',
    description: `Saved grade scheme "${saved.name}" (pass ${saved.passPercentage}%, tie-break ${saved.tieBreakRule})`,
    endpoint: '/api/reports/exam-grade-distribution/action',
    status: 'SUCCESS',
  }).catch(() => {});

  return { saved: true, message: `Saved grading rules "${saved.name}".`, gradeScheme: saved };
}

async function verifySubjectMarksAction(payload = {}, ctx = {}) {
  const reqUser = getReqUser(ctx);
  const { examId, subjectId } = payload;
  if (!mongoose.Types.ObjectId.isValid(examId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
    const err = new Error('Please choose a valid exam paper row before verifying marks');
    err.statusCode = 400;
    throw err;
  }
  const verified = payload.verified !== undefined ? parseBooleanFlag(payload.verified, true) : true;
  const update = {
    verified,
    verifiedBy: verified ? (reqUser?.id || null) : null,
    verifiedAt: verified ? new Date() : null,
  };
  const res = await ExamMarks.updateMany({ examId, subjectId }, { $set: update });

  await ActivityLog.create({
    userId: reqUser?.id || null,
    userName: reqUser?.name || reqUser?.email || 'Administrator',
    userEmail: reqUser?.email || '',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Examination',
    subModule: 'Marks Entry',
    action: verified ? 'VERIFY_SUBJECT_MARKS' : 'UNVERIFY_SUBJECT_MARKS',
    actionType: 'UPDATE',
    description: `${verified ? 'Verified' : 'Unverified'} ${res.modifiedCount || 0} marks entries for exam ${examId}, subject ${subjectId}`,
    endpoint: '/api/reports/exam-marks-verification/action',
    targetEntity: { entityType: 'ExamMarks', entityId: `${examId}_${subjectId}` },
    status: 'SUCCESS',
  }).catch(() => {});

  return { verified, examId, subjectId, modifiedCount: res.modifiedCount || 0, message: `Subject marks ${verified ? 'verified' : 'reopened for review'}.` };
}

async function toggleExamLockAction(payload = {}, ctx = {}) {
  const reqUser = getReqUser(ctx);
  const { examId } = payload;
  if (!mongoose.Types.ObjectId.isValid(examId)) {
    const err = new Error('Please select a valid exam row to lock or unlock');
    err.statusCode = 400;
    throw err;
  }
  const exam = await Exam.findById(examId);
  if (!exam) {
    const err = new Error('Exam not found');
    err.statusCode = 404;
    throw err;
  }
  const nextLocked = payload.resultLocked !== undefined && payload.resultLocked !== ''
    ? parseBooleanFlag(payload.resultLocked, !Boolean(exam.resultLocked))
    : !Boolean(exam.resultLocked);
  exam.resultLocked = nextLocked;
  if (nextLocked && !exam.publishedAt) {
    exam.publishedAt = new Date();
    exam.publishedByName = reqUser?.name || reqUser?.email || 'Administrator';
  }
  await exam.save();

  await ActivityLog.create({
    userId: reqUser?.id || null,
    userName: reqUser?.name || reqUser?.email || 'Administrator',
    userEmail: reqUser?.email || '',
    userRole: reqUser?.role || 'ADMIN',
    module: 'Examination',
    subModule: 'Results',
    action: nextLocked ? 'LOCK_EXAM_RESULTS' : 'UNLOCK_EXAM_RESULTS',
    actionType: 'STATUS',
    description: `${nextLocked ? 'Locked' : 'Unlocked'} exam "${exam.examName}" results`,
    endpoint: '/api/reports/exam-marks-verification/action',
    targetEntity: { entityType: 'Exam', entityId: String(exam._id), name: exam.examName },
    status: 'SUCCESS',
  }).catch(() => {});

  return { examId: String(exam._id), resultLocked: exam.resultLocked };
}

// ---------------------------------------------------------------------------
// Catalog & Exports
// ---------------------------------------------------------------------------

const makeExamProgramFilter = () => ({
  key: 'examId',
  label: 'Exam & Program',
  type: 'select',
  optionsSource: 'exams',
  multi: false,
  searchable: true,
});

const CATALOG = [
  {
    key: 'exam-institutional-analysis',
    pageNumber: 19,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'results',
    title: 'Institutional Examination Analysis',
    purpose: 'Analyze institutional pass rates, absenteeism, and weighted marks performance across programs.',
    filterSchema: [
      makeExamProgramFilter(),
      { key: 'sessionId', label: 'Academic Session', type: 'select', optionsSource: 'sessions' },
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'subjectId', label: 'Subject', type: 'select', optionsSource: 'subjects' },
      {
        key: 'resultStatus',
        label: 'Result Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PASSED', label: 'Passed' },
          { value: 'FAILED', label: 'Failed' },
          { value: 'ABSENT', label: 'Absent' },
        ],
      },
    ],
  },
  {
    key: 'exam-class-gazette',
    pageNumber: 20,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'results',
    title: 'Class Result Gazette',
    purpose: 'Official subject-by-subject class result sheet with totals, percentages, grades, and approval signatures.',
    signatures: ['Class Teacher', 'Examination In-Charge', 'Principal'],
    filterSchema: [
      makeExamProgramFilter(),
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'sectionId', label: 'Section', type: 'select', optionsSource: 'sections' },
      { key: 'gradeSchemeId', label: 'Grade Scheme', type: 'select', optionsSource: 'gradeSchemes' },
    ],
  },
  {
    key: 'exam-student-result-card',
    pageNumber: 21,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'results',
    title: 'Individual Student Result Card',
    purpose: 'Detailed subject-wise transcript for an individual student with grading legend and attendance summary.',
    filterSchema: [
      { key: 'studentId', label: 'Student', type: 'select', optionsSource: 'students' },
      makeExamProgramFilter(),
      { key: 'sessionId', label: 'Academic Session', type: 'select', optionsSource: 'sessions' },
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
    ],
  },
  {
    key: 'exam-subject-performance',
    pageNumber: 22,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'results',
    title: 'Subject-wise Performance',
    purpose: 'Evaluate pass rates, average percentages, and top scores per subject across cohorts and teachers.',
    filterSchema: [
      makeExamProgramFilter(),
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'subjectId', label: 'Subject', type: 'select', optionsSource: 'subjects' },
      { key: 'teacherId', label: 'Teacher', type: 'select', optionsSource: 'teachers' },
    ],
  },
  {
    key: 'exam-position-holders',
    pageNumber: 23,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'results',
    title: 'Position Holders & Merit List',
    purpose: 'Rank eligible appeared candidates using configured grade-scheme tie-break rules.',
    filterSchema: [
      makeExamProgramFilter(),
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'sectionId', label: 'Section', type: 'select', optionsSource: 'sections' },
      {
        key: 'gender',
        label: 'Gender',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'Male', label: 'Male' },
          { value: 'Female', label: 'Female' },
          { value: 'Other', label: 'Other' },
        ],
      },
    ],
  },
  {
    key: 'exam-failures-supplementary',
    pageNumber: 24,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'results',
    title: 'Failures & Supplementary Candidates',
    purpose: 'Identify subject-level academic failures and supplementary eligibility separately from absent or withheld entries.',
    filterSchema: [
      makeExamProgramFilter(),
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'subjectId', label: 'Subject', type: 'select', optionsSource: 'subjects' },
      {
        key: 'eligibility',
        label: 'Eligibility',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All Academic Failures' },
          { value: 'SUPPLEMENTARY', label: 'Supplementary Eligible' },
          { value: 'REPEAT', label: 'Repeat / Multi-Subject' },
          { value: 'ABSENT_WITHHELD', label: 'Absent / Withheld / Exempt' },
        ],
      },
    ],
  },
  {
    key: 'exam-grade-distribution',
    pageNumber: 25,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'results',
    title: 'Grade Distribution',
    purpose: 'Analyze distribution of appeared students across configured grade bands with inline scheme configuration.',
    inlineActions: [
      {
        name: 'save-grade-scheme',
        key: 'save-grade-scheme',
        label: 'Grading Setup',
        scope: 'report',
        fields: [
          { key: 'name', label: 'Scheme Name', type: 'text', defaultValue: 'Standard Grading', placeholder: 'e.g. Standard 2026' },
          { key: 'passPercentage', label: 'Pass Percentage (%)', type: 'number', defaultValue: 50, placeholder: '50' },
          {
            key: 'preset',
            label: 'Grade Scale',
            type: 'select',
            defaultValue: 'STANDARD',
            options: [
              { value: 'STANDARD', label: 'Standard (A+ 90, A 80, B 70, C 60, D 50)' },
              { value: 'LENIENT', label: 'Relaxed (A+ 85, A 75, B 65, C 55, D 40)' },
              { value: 'STRICT', label: 'Strict (A+ 92, A 85, B 75, C 65, D 55)' },
            ],
          },
          {
            key: 'tieBreakRule',
            label: 'Position Tie-Break',
            type: 'select',
            defaultValue: 'HIGHEST_PERCENTAGE',
            options: [
              { value: 'HIGHEST_PERCENTAGE', label: 'Higher Total % First' },
              { value: 'HIGHER_CORE_MARKS', label: 'Highest Subject Mark First' },
              { value: 'EARLIER_ROLL', label: 'Earlier Roll Number' },
            ],
          },
          { key: 'bandsText', label: 'Custom Ranges (Optional)', type: 'text', placeholder: 'Optional: A+:90-100, A:80-89, B:70-79, C:60-69, D:50-59, F:0-49' },
          {
            key: 'isDefault',
            label: 'Set as Default',
            type: 'select',
            defaultValue: 'true',
            options: [
              { value: 'true', label: 'Yes — Set as Default' },
              { value: 'false', label: 'No — Keep Additional' },
            ],
          },
        ],
      },
    ],
    filterSchema: [
      makeExamProgramFilter(),
      { key: 'classId', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'gradeSchemeId', label: 'Grade Scheme', type: 'select', optionsSource: 'gradeSchemes' },
    ],
  },
  {
    key: 'exam-marks-verification',
    pageNumber: 26,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'marks',
    altRbacModule: 'Examination',
    altRbacSubModule: 'results',
    title: 'Marks Entry & Verification Status',
    purpose: 'Track subject marks completion, verification sign-off, and exam result locking.',
    inlineActions: [
      {
        name: 'verify-subject-marks',
        key: 'verify-subject-marks',
        label: 'Verify Marks',
        scope: 'row',
        fields: [
          {
            key: 'verified',
            label: 'Verification Status',
            type: 'select',
            defaultValue: 'true',
            options: [
              { value: 'true', label: 'Verify & Approve Marks' },
              { value: 'false', label: 'Mark Pending Review' },
            ],
          },
        ],
      },
      {
        name: 'toggle-exam-lock',
        key: 'toggle-exam-lock',
        label: 'Lock / Unlock',
        scope: 'row',
        fields: [
          {
            key: 'resultLocked',
            label: 'Result Lock',
            type: 'select',
            defaultValue: 'true',
            options: [
              { value: 'true', label: 'Lock Exam Results' },
              { value: 'false', label: 'Unlock Exam Results' },
            ],
          },
        ],
      },
    ],
    filterSchema: [
      makeExamProgramFilter(),
      { key: 'subjectId', label: 'Subject', type: 'select', optionsSource: 'subjects' },
      { key: 'teacherId', label: 'Teacher', type: 'select', optionsSource: 'teachers' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
          { value: 'VERIFIED', label: 'Verified' },
          { value: 'MISSING', label: 'Missing Marks' },
        ],
      },
    ],
  },
  {
    key: 'exam-attendance-absenteeism',
    pageNumber: 27,
    module: 'Examination',
    category: 'Examination',
    categoryKey: 'examination',
    rbacModule: 'Examination',
    rbacSubModule: 'exams',
    altRbacModule: 'Examination',
    altRbacSubModule: 'results',
    title: 'Exam Attendance & Absenteeism',
    purpose: 'Monitor paper-by-paper examination attendance and absenteeism from scheduled papers and exam marks.',
    filterSchema: [
      makeExamProgramFilter(),
      { key: 'dateFrom', label: 'From Date', type: 'date' },
      { key: 'dateTo', label: 'To Date', type: 'date' },
      { key: 'subjectId', label: 'Subject', type: 'select', optionsSource: 'subjects' },
    ],
  },
];

const HANDLERS = {
  'exam-institutional-analysis': buildInstitutionalAnalysis,
  'exam-class-gazette': buildClassGazette,
  'exam-student-result-card': buildStudentResultCard,
  'exam-subject-performance': buildSubjectPerformance,
  'exam-position-holders': buildPositionHolders,
  'exam-failures-supplementary': buildFailuresSupplementary,
  'exam-grade-distribution': buildGradeDistribution,
  'exam-marks-verification': buildMarksVerification,
  'exam-attendance-absenteeism': buildExamAttendanceAbsenteeism,
};

const ACTIONS = {
  'save-grade-scheme': saveGradeSchemeAction,
  'verify-subject-marks': verifySubjectMarksAction,
  'toggle-exam-lock': toggleExamLockAction,
};

module.exports = {
  CATALOG,
  HANDLERS,
  ACTIONS,
  resolveGradeScheme,
  computeGradeWithScheme,
};
