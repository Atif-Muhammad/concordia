const reportEngine = require('../services/reportEngine.service');

class ReportController {
  async getCatalog(req, res, next) {
    try {
      const data = await reportEngine.getCatalog(req.user);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async runReport(req, res, next) {
    try {
      const { reportKey } = req.params;
      const data = await reportEngine.runReport(reportKey, req.query, req.user);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async runAction(req, res, next) {
    try {
      const { reportKey } = req.params;
      const { action, payload } = req.body || {};
      const data = await reportEngine.runAction(reportKey, action, payload, req.user);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async logExport(req, res, next) {
    try {
      const { reportKey } = req.params;
      const log = await reportEngine.logExport(reportKey, req.body, req.user);
      res.status(201).json(log);
    } catch (err) {
      next(err);
    }
  }

  async getGradeSchemes(req, res, next) {
    try {
      const schemes = await reportEngine.getGradeSchemes();
      res.json(schemes);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
