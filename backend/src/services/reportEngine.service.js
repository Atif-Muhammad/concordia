const { GradeScheme, ReportExportLog, ActivityLog } = require('../models');
const {
  loadUserPermissions,
  getInstitutionMeta,
  buildReportEnvelope,
  resolveSession,
} = require('./reports/reportHelpers');

const admissionsReports = require('./reports/admissions.reports');
const studentsReports = require('./reports/students.reports');
const feesReports = require('./reports/fees.reports');
const examinationReports = require('./reports/examination.reports');
const attendanceAcademicsReports = require('./reports/attendanceAcademics.reports');
const staffHrFinanceReports = require('./reports/staffHrFinance.reports');
const operationsExecutiveReports = require('./reports/operationsExecutive.reports');

const MODULES = [
  admissionsReports,
  studentsReports,
  feesReports,
  examinationReports,
  attendanceAcademicsReports,
  staffHrFinanceReports,
  operationsExecutiveReports,
];

const REPORT_CATALOG = MODULES.flatMap(m => m.CATALOG || []);
const REPORT_DEF_MAP = new Map(REPORT_CATALOG.map(d => [d.key, d]));
const REPORT_HANDLERS = Object.assign({}, ...MODULES.map(m => m.HANDLERS || {}));
const REPORT_ACTIONS = Object.assign({}, ...MODULES.map(m => m.ACTIONS || {}));

function hasReportAccess(permCtx, def) {
  if (!def) return false;
  if (permCtx.isSuper || permCtx.permissions?.all === true) return true;
  const actions = permCtx.permissions?.actions || permCtx.permissions?.crud;
  const subModulesMap = permCtx.permissions?.subModules;
  const modulesArr = permCtx.permissions?.modules;

  // Check Report Centre module permissions first
  const checkMod = (modLabel, subId) => {
    const mKey = actions && typeof actions === 'object'
      ? Object.keys(actions).find(k => k.toLowerCase() === modLabel.toLowerCase())
      : null;
    const modObj = mKey ? actions[mKey] : null;
    if (modObj && typeof modObj === 'object' && Object.keys(modObj).length > 0) {
      if (subId && modObj[subId]?.read === true) return true;
      if (modObj.reports?.read === true || modObj._root?.read === true) return true;
      const anyReport = Object.keys(modObj).some(
        k => (k.toLowerCase().includes('report') || k === subId) && modObj[k]?.read === true
      );
      return anyReport;
    }

    const sKey = subModulesMap && typeof subModulesMap === 'object'
      ? Object.keys(subModulesMap).find(k => k.toLowerCase() === modLabel.toLowerCase())
      : null;
    const list = sKey ? subModulesMap[sKey] : null;
    if (Array.isArray(list)) {
      return list.includes(subId) || list.includes('reports');
    }

    if (Array.isArray(modulesArr)) {
      if (modulesArr.some(m => m.toLowerCase() === modLabel.toLowerCase())) return true;
    }
    return false;
  };

  if (checkMod('Report Centre', def.categoryKey || def.module)) return true;
  if (def.rbacModule && checkMod(def.rbacModule, def.rbacSubModule || 'reports')) return true;
  if (def.altRbacModule && checkMod(def.altRbacModule, def.altRbacSubModule || 'reports')) return true;
  return false;
}

class ReportEngineService {
  async getCatalog(reqUser) {
    const permCtx = await loadUserPermissions(reqUser);
    const items = REPORT_CATALOG
      .filter(def => hasReportAccess(permCtx, def))
      .sort((a, b) => a.pageNumber - b.pageNumber);
    return { reports: items };
  }

  getDefinition(reportKey) {
    return REPORT_DEF_MAP.get(reportKey) || null;
  }

  async runReport(reportKey, query = {}, reqUser = null) {
    const def = REPORT_DEF_MAP.get(reportKey);
    if (!def) {
      const err = new Error(`Unknown report key: ${reportKey}`);
      err.statusCode = 404;
      throw err;
    }

    const permCtx = await loadUserPermissions(reqUser);
    if (reqUser && !hasReportAccess(permCtx, def)) {
      const err = new Error(`Forbidden: no permission to view report "${def.title}"`);
      err.statusCode = 403;
      throw err;
    }

    const handler = REPORT_HANDLERS[reportKey];
    if (!handler) {
      const err = new Error(`No handler registered for report: ${reportKey}`);
      err.statusCode = 500;
      throw err;
    }

    const sessionCtx = await resolveSession(query.sessionId);
    const meta = await getInstitutionMeta(reqUser, sessionCtx.sessionLabel);

    const result = await handler(query, { reqUser, permCtx, sessionCtx, def });

    return buildReportEnvelope({
      def,
      meta,
      selectedFilters: result.selectedFilters || [],
      kpis: result.kpis || [],
      columns: result.columns || [],
      rows: result.rows || [],
      totalsRow: result.totalsRow || null,
      secondaryTables: result.secondaryTables || [],
      charts: result.charts || [],
      insight: result.insight || { severity: 'info', message: '' },
      rawExtra: result.rawExtra || null,
    });
  }

  async runAction(reportKey, actionName, payload = {}, reqUser = null) {
    const def = REPORT_DEF_MAP.get(reportKey);
    if (!def) {
      const err = new Error(`Unknown report key: ${reportKey}`);
      err.statusCode = 404;
      throw err;
    }
    const permCtx = await loadUserPermissions(reqUser);
    if (reqUser && !hasReportAccess(permCtx, def)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    const actionHandler = REPORT_ACTIONS[actionName];
    if (!actionHandler) {
      const err = new Error(`Unknown report action: ${actionName}`);
      err.statusCode = 400;
      throw err;
    }
    return actionHandler(payload, { reqUser, permCtx, def });
  }

  async logExport(reportKey, body = {}, reqUser = null) {
    const def = REPORT_DEF_MAP.get(reportKey);
    const format = ['PDF', 'EXCEL', 'PRINT', 'VIEW'].includes(String(body.format || '').toUpperCase())
      ? String(body.format).toUpperCase()
      : 'VIEW';

    // Page 48 privacy rule: store filter summary & counts only, never exported row data / PII
    const log = await ReportExportLog.create({
      reportKey,
      module: def?.module || body.module || '',
      reportName: def?.title || body.reportName || reportKey,
      filtersSummary: String(body.filtersSummary || 'Default filters').slice(0, 500),
      format,
      recordCount: Number(body.recordCount || 0),
      status: body.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
      failureReason: String(body.failureReason || '').slice(0, 300),
      userId: reqUser?.id || null,
      userName: reqUser?.name || reqUser?.email || 'Administrator',
      userRole: reqUser?.role || 'ADMIN',
      timestamp: new Date(),
    });

    // Also mirror lightweight entry into ActivityLog
    ActivityLog.create({
      userId: reqUser?.id || null,
      userName: log.userName,
      userEmail: reqUser?.email || '',
      userRole: log.userRole,
      module: 'Report Centre',
      subModule: log.module || 'Reports',
      action: `EXPORT_${format}`,
      actionType: 'REPORT_EXPORT',
      description: `${log.userName} exported "${log.reportName}" as ${format} (${log.recordCount} rows)`,
      details: log.filtersSummary,
      method: 'POST',
      endpoint: `/api/reports/${reportKey}/export-log`,
      status: log.status,
      statusCode: 200,
    }).catch(() => {});

    return log;
  }

  async getGradeSchemes() {
    return GradeScheme.find().sort({ isDefault: -1, createdAt: -1 }).lean();
  }
}

module.exports = new ReportEngineService();
module.exports.REPORT_CATALOG = REPORT_CATALOG;
module.exports.hasReportAccess = hasReportAccess;
