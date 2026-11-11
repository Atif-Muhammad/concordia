/**
 * Canonical active-student predicate & Mongo filter builder.
 * A student is active iff status is ACTIVE (case-insensitive) and passedOut !== true.
 */
const ACTIVE_STUDENT_FILTER = Object.freeze({
  status: { $regex: /^active$/i },
  passedOut: { $ne: true },
});

function buildStudentStatusCondition(status) {
  const s = String(status || '').trim().toUpperCase();
  if (s === 'ACTIVE') {
    return {
      status: { $regex: /^active$/i },
      passedOut: { $ne: true },
    };
  }
  if (s === 'GRADUATED') {
    return {
      $or: [
        { status: { $regex: /^(graduated|passed[ _-]out)$/i } },
        { passedOut: true, status: { $nin: ['EXPELLED', 'STRUCK_OFF', 'Expelled', 'Struck Off'] } },
      ],
    };
  }
  if (s === 'EXPELLED') {
    return { status: { $regex: /^expelled$/i } };
  }
  if (s === 'STRUCK_OFF') {
    return { status: { $regex: /^struck[ _-]off$/i } };
  }
  const pattern = String(status || '').replace(/[_\s-]+/g, '[ _-]');
  return { status: { $regex: new RegExp(`^${pattern}$`, 'i') } };
}

function isStudentActive(student) {
  if (!student || typeof student !== 'object') return false;
  if (student.passedOut === true) return false;
  return /^active$/i.test(String(student.status || '').trim());
}

function shouldFilterActiveStudents(flag) {
  if (flag === undefined || flag === null || flag === '') return true;
  const normalized = String(flag).trim().toLowerCase();
  return !['all', 'false', '0', 'inactive'].includes(normalized);
}

function withActiveStudentFilter(filter = {}) {
  const base = { ...filter };
  const activeConds = [
    { status: { $regex: /^active$/i } },
    { passedOut: { $ne: true } },
  ];
  if (Array.isArray(base.$and)) {
    base.$and = [...base.$and, ...activeConds];
    return base;
  }
  return {
    ...base,
    status: { $regex: /^active$/i },
    passedOut: { $ne: true },
  };
}

async function getActiveStudentIds(StudentModel, baseFilter = {}) {
  return StudentModel.find(withActiveStudentFilter(baseFilter)).distinct('_id');
}

function buildActiveStudentIdConstraint(activeIds, existingStudentId = undefined, { allowNull = false } = {}) {
  const activeSet = new Set(activeIds.map(id => String(id)));
  if (existingStudentId !== undefined && existingStudentId !== null) {
    if (typeof existingStudentId === 'object' && Array.isArray(existingStudentId.$in)) {
      return { $in: existingStudentId.$in.filter(id => activeSet.has(String(id))) };
    }
    return activeSet.has(String(existingStudentId)) ? existingStudentId : { $in: [] };
  }
  if (allowNull) {
    return { $in: [...activeIds, null] };
  }
  return { $in: activeIds };
}

module.exports = {
  ACTIVE_STUDENT_FILTER,
  buildStudentStatusCondition,
  isStudentActive,
  shouldFilterActiveStudents,
  withActiveStudentFilter,
  getActiveStudentIds,
  buildActiveStudentIdConstraint,
};
