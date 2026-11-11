/**
 * Canonical frontend active-student check.
 * A student is active iff passedOut !== true and status (when present) is ACTIVE (case-insensitive).
 */
export function isStudentActive(student) {
  if (!student || typeof student !== 'object') return false;
  if (student.passedOut === true) return false;
  if (student.status === undefined || student.status === null || student.status === '') {
    return true;
  }
  return /^active$/i.test(String(student.status).trim());
}

const STUDENT_STATUS_LABELS = {
  ACTIVE: 'Active',
  EXPELLED: 'Expelled',
  STRUCK_OFF: 'Struck Off',
  GRADUATED: 'Graduated',
  PASSED_OUT: 'Passed Out',
};

const normalizeStatusToken = (val = '') =>
  String(val || '').trim().toUpperCase().replace(/\s+/g, '_');

export function getChallanStudentStatus(challan) {
  if (!challan || typeof challan !== 'object') return '';
  const nested = challan.student && typeof challan.student === 'object'
    ? challan.student
    : (challan.studentId && typeof challan.studentId === 'object' ? challan.studentId : null);
  const raw = normalizeStatusToken(challan.studentStatus || nested?.status);
  const isPassedOut = challan.studentPassedOut === true || nested?.passedOut === true;
  if (raw && raw !== 'ACTIVE') return raw;
  if (isPassedOut) return 'GRADUATED';
  return raw;
}

export function getStudentStatusCode(student) {
  if (!student || typeof student !== 'object') return '';
  const raw = normalizeStatusToken(student.status);
  if (raw && raw !== 'ACTIVE') return raw;
  if (student.passedOut === true) return 'GRADUATED';
  return raw || 'ACTIVE';
}

export function formatStudentStatusLabel(statusCode = '') {
  const normalized = normalizeStatusToken(statusCode);
  if (!normalized) return 'Active';
  if (STUDENT_STATUS_LABELS[normalized]) return STUDENT_STATUS_LABELS[normalized];
  return normalized
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export function getStudentStatusTextTone(statusCode = '') {
  switch (normalizeStatusToken(statusCode)) {
    case 'EXPELLED':
      return { textClass: 'text-rose-600 dark:text-rose-400', printColor: '#dc2626' };
    case 'STRUCK_OFF':
      return { textClass: 'text-amber-600 dark:text-amber-400', printColor: '#d97706' };
    case 'GRADUATED':
    case 'PASSED_OUT':
      return { textClass: 'text-blue-600 dark:text-blue-400', printColor: '#2563eb' };
    default:
      return { textClass: 'text-muted-foreground', printColor: '#64748b' };
  }
}

export function isChallanStudentActive(challan) {
  if (!challan || typeof challan !== 'object') return false;
  const nested = challan.student && typeof challan.student === 'object'
    ? challan.student
    : (challan.studentId && typeof challan.studentId === 'object' ? challan.studentId : null);
  if (challan.studentPassedOut === true || nested?.passedOut === true) return false;
  const status = getChallanStudentStatus(challan);
  if (!status) return true;
  return status === 'ACTIVE';
}

export function getStudentStatusCounts(source) {
  const s = source?.students && typeof source.students === 'object' ? source.students : source;
  const byStatus = s?.byStatus || source?.byStatus || {};
  return {
    active: Number(byStatus.active ?? s?.active ?? s?.activeStudents ?? source?.activeStudents ?? 0),
    expelled: Number(byStatus.expelled ?? s?.expelledStudents ?? s?.expelled ?? 0),
    struckOff: Number(byStatus.struckOff ?? s?.struckOffStudents ?? s?.struckOff ?? 0),
    passedOut: Number(byStatus.passedOut ?? s?.passedOutStudents ?? s?.passedOut ?? 0),
  };
}
