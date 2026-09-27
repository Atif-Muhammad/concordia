const activityLogService = require('../services/activityLog.service');

class ActivityLogController {
  async getActivityLogs(req, res, next) {
    try {
      const result = await activityLogService.getActivityLogs(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getActivityLogById(req, res, next) {
    try {
      const log = await activityLogService.getActivityLogById(req.params.id);
      if (!log) {
        return res.status(404).json({ message: 'Activity log not found' });
      }
      res.json(log);
    } catch (err) {
      next(err);
    }
  }

  async getFilterOptions(req, res, next) {
    try {
      const options = await activityLogService.getFilterOptions();
      res.json(options);
    } catch (err) {
      next(err);
    }
  }

  async clearOldLogs(req, res, next) {
    try {
      const days = req.body?.days || req.query?.days || 90;
      const result = await activityLogService.clearOldLogs(days);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ActivityLogController();
