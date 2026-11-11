const mongoose = require('mongoose');
const { AcademicSession, InstituteSettings, User } = require('../../models');
const {
  parseMulti,
  toObjectIds,
  applyMultiIdFilter,
  applyMultiStringFilter,
  matchesMultiValue,
  parseBooleanFlag,
} = require('../../utils/filterHelpers');

/** Resolve date range defaults (inclusive start/end). */
function resolveDateRange(dateFrom, dateTo, defaultDaysBack = 90) {
  const end = dateTo ? new Date(dateTo) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = dateFrom ? new Date(dateFrom) : new Date(end.getTime() - defaultDaysBack * 86400000);
  start.setHours(0, 0, 0, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return { start, end, startStr, endStr };
}

/** Resolve active or requested AcademicSession (supports single or comma-separated IDs). */
async function resolveSession(sessionId) {
  const sessionIds = toObjectIds(sessionId);
  if (sessionIds.length === 1) {
    const doc = await AcademicSession.findById(sessionIds[0]).lean();
    if (doc) return { sessionId: String(doc._id), sessionObjId: doc._id, sessionLabel: doc.name, sessionDoc: doc };
  } else if (sessionIds.length > 1) {
    const docs = await AcademicSession.find({ _id: { $in: sessionIds } }).select('name').lean();
    if (docs.length > 0) {
      return {
        sessionId: docs.map(d => String(d._id)).join(','),
        sessionObjId: docs[0]._id,
        sessionLabel: docs.map(d => d.name).join(', '),
        sessionDoc: docs[0],
      };
    }
  }
  const active = await AcademicSession.findOne({ $or: [{ isActive: true }, { isActive: 'true' }] }).lean();
  if (active) {
    return { sessionId: String(active._id), sessionObjId: active._id, sessionLabel: active.name, sessionDoc: active };
  }
  return { sessionId: '', sessionObjId: null, sessionLabel: 'Current Session', sessionDoc: null };
}

function formatRs(n) {
  const num = Number(n || 0);
  const abs = Math.abs(Math.round(num));
  const formatted = abs.toLocaleString('en-PK');
  return num < 0 ? `-Rs ${formatted}` : `Rs ${formatted}`;
}

function formatNum(n) {
  return Math.round(Number(n || 0)).toLocaleString('en-US');
}

function formatPct(num, den, digits = 1) {
  if (!den || Number(den) === 0) return '0.0%';
  return `${((Number(num || 0) / Number(den)) * 100).toFixed(digits)}%`;
}

function pctValue(num, den, digits = 1) {
  if (!den || Number(den) === 0) return 0;
  return Number(((Number(num || 0) / Number(den)) * 100).toFixed(digits));
}

function formatDate(d) {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatShortDate(d) {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function daysBetween(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  return Math.max(0, Math.floor((db.getTime() - da.getTime()) / 86400000));
}

function fullName(doc) {
  if (!doc) return '';
  if (doc.name) return doc.name;
  return [doc.fName, doc.lName].filter(Boolean).join(' ').trim();
}

function maskValue(val, showLast = 4) {
  const s = String(val || '');
  if (!s) return 'Restricted';
  if (s.length <= showLast) return '••••';
  return '••••' + s.slice(-showLast);
}

/** Check whether user has elevated/private permission (matches backend rbac conventions). */
async function loadUserPermissions(reqUser) {
  if (!reqUser) return { isSuper: false, permissions: {} };
  if (reqUser.role === 'SUPER_ADMIN' || reqUser.role === 'Super Admin') {
    return { isSuper: true, permissions: { all: true } };
  }
  const dbUser = await User.findById(reqUser.id).select('role permissions name email').lean();
  if (!dbUser) return { isSuper: false, permissions: {} };
  const isSuper = dbUser.role === 'SUPER_ADMIN' || dbUser.role === 'Super Admin' || dbUser.permissions?.all === true;
  return { isSuper, permissions: dbUser.permissions || {}, userDoc: dbUser };
}

function canViewPrivateData(permCtx, moduleLabel, subModuleId, extraAction = null) {
  if (!permCtx) return false;
  if (permCtx.isSuper || permCtx.permissions?.all === true) return true;
  const actions = permCtx.permissions?.actions || permCtx.permissions?.crud;
  if (!actions || typeof actions !== 'object') return false;
  const mKey = Object.keys(actions).find(k => k.toLowerCase() === String(moduleLabel).toLowerCase());
  const modActions = mKey ? actions[mKey] : null;
  if (!modActions || typeof modActions !== 'object') return false;
  const subKey = Object.keys(modActions).find(k => k.toLowerCase() === String(subModuleId).toLowerCase());
  const subObj = subKey ? modActions[subKey] : modActions._root;
  if (!subObj || typeof subObj !== 'object') return false;
  if (extraAction && subObj[extraAction] === true) return true;
  return subObj.update === true || subObj.approvals === true || subObj.read === true;
}

async function getInstitutionMeta(reqUser, sessionLabel = '') {
  const settings = await InstituteSettings.findOne().lean().catch(() => null);
  const instName = (settings?.instituteName || 'CONCORDIA COLLEGE PESHAWAR').toUpperCase();
  return {
    institutionName: instName,
    brandTitle: `${instName} | ERP REPORT CENTRE`,
    tagline: settings?.tagline || '',
    address: settings?.address || '',
    phone: settings?.phone || '',
    logoUrl: settings?.logoUrl || '',
    principalSignatureUrl: settings?.principalSignatureUrl || '',
    accountsSignatureUrl: settings?.accountsSignatureUrl || '',
    sessionLabel: sessionLabel || 'Current Session',
    generatedAt: new Date().toISOString(),
    generatedBy: reqUser?.name || reqUser?.email || 'Administrator',
    generatedByRole: reqUser?.role || 'ADMIN',
    disclaimer: 'Confidential — for authorized institutional use only',
  };
}

/** Build standardized report envelope. */
function buildReportEnvelope({
  def,
  meta,
  selectedFilters = [],
  kpis = [],
  columns = [],
  rows = [],
  totalsRow = null,
  secondaryTables = [],
  charts = [],
  insight = { severity: 'info', message: '' },
  rawExtra = null,
}) {
  return {
    meta,
    report: {
      key: def.key,
      pageNumber: def.pageNumber,
      module: def.module,
      category: def.category || def.module,
      title: def.title,
      purpose: def.purpose,
      filterSchema: def.filterSchema || [],
      selectedFilters,
      inlineActions: def.inlineActions || [],
      signatures: def.signatures || null,
    },
    kpis: kpis.slice(0, 4),
    columns,
    rows,
    totalsRow,
    secondaryTables,
    charts,
    insight,
    rawExtra,
  };
}

module.exports = {
  parseMulti,
  toObjectIds,
  applyMultiIdFilter,
  applyMultiStringFilter,
  matchesMultiValue,
  parseBooleanFlag,
  resolveDateRange,
  resolveSession,
  formatRs,
  formatNum,
  formatPct,
  pctValue,
  formatDate,
  formatShortDate,
  daysBetween,
  fullName,
  maskValue,
  loadUserPermissions,
  canViewPrivateData,
  getInstitutionMeta,
  buildReportEnvelope,
};
