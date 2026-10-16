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

  async recordCustomActivity(req, res, next) {
    try {
      const { module, subModule, action, actionType, details } = req.body;
      const user = req.user;
      const userName = user?.name || user?.email || 'System User';
      const userEmail = user?.email || '';
      const userRole = user?.role || 'STAFF';
      const staffId = user?.staffId || '';

      const { ActivityLog } = require('../models');
      const log = await ActivityLog.create({
        userId: user?.id || user?._id || null,
        staffId,
        userName,
        userEmail,
        userRole,
        module: module || 'System',
        subModule: subModule || '',
        action: action || 'Action Performed',
        actionType: actionType || 'ACTION',
        details: details || `User: ${userName}, Action: ${action}`,
        description: details || `User: ${userName}, Action: ${action}`,
        method: 'POST',
        endpoint: req.originalUrl || req.url,
        status: 'SUCCESS',
        statusCode: 200,
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '',
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date(),
      });

      res.status(201).json({ success: true, log });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ActivityLogController();
