const dashboardService = require('../services/dashboard.service');

class DashboardController {
  async getStats(req, res, next) {
    try {
      const stats = await dashboardService.getStats(req.query.sessionId);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }

  async getPath(req, res, next) {
    try {
      const { path } = req.params;
      const { sessionId } = req.query;

      switch (path) {
        case 'students': {
          const data = await dashboardService.getStudentsStats(sessionId);
          return res.json(data);
        }
        case 'fees': {
          const data = await dashboardService.getFeesStats(sessionId);
          return res.json(data);
        }
        case 'attendance': {
          const data = await dashboardService.getAttendanceStats(sessionId);
          return res.json(data);
        }
        case 'staff': {
          const data = await dashboardService.getStaffStats(sessionId);
          return res.json(data);
        }
        case 'finance': {
          const data = await dashboardService.getFinanceStats(sessionId);
          return res.json(data);
        }
        case 'charts': {
          const data = await dashboardService.getChartsData(sessionId);
          return res.json(data);
        }
        default: {
          const stats = await dashboardService.getStats(sessionId);
          return res.json(stats);
        }
      }
    } catch (err) {
      next(err);
    }
  }

  async getAverageTuition(req, res, next) {
    try {
      const data = await dashboardService.getAverageTuitionByClass(req.query.sessionId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DashboardController();
