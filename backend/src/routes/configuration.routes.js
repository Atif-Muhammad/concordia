const express = require('express');
const router = express.Router();
const configurationController = require('../controllers/configuration.controller');
const activityLogController = require('../controllers/activityLog.controller');
const { authMiddleware } = require('../middlewares/auth');

// Activity Logs
router.get('/activity-logs', authMiddleware, activityLogController.getActivityLogs);
router.get('/activity-logs/filter-options', authMiddleware, activityLogController.getFilterOptions);
router.get('/activity-logs/:id', authMiddleware, activityLogController.getActivityLogById);
router.delete('/activity-logs/clear', authMiddleware, activityLogController.clearOldLogs);

// Institute settings
router.get('/institute-settings', configurationController.getInstituteSettings);
router.patch('/institute-settings', authMiddleware, configurationController.updateInstituteSettings);

// Report card templates
const rc = configurationController.createTemplateHandlers('REPORT_CARD');
router.get('/report-card-templates', rc.getAll);
router.get('/report-card-templates/default', rc.getDefault);
router.post('/report-card-templates', authMiddleware, rc.create);
router.patch('/report-card-templates/:id', authMiddleware, rc.update);
router.delete('/report-card-templates/:id', authMiddleware, rc.delete);

// Staff ID card templates
const sc = configurationController.createTemplateHandlers('STAFF_ID');
router.get('/staff-id-card-templates', sc.getAll);
router.get('/staff-id-card-templates/default', sc.getDefault);
router.post('/staff-id-card-templates', authMiddleware, sc.create);
router.patch('/staff-id-card-templates/:id', authMiddleware, sc.update);
router.delete('/staff-id-card-templates/:id', authMiddleware, sc.delete);

// Student ID card templates
const stc = configurationController.createTemplateHandlers('STUDENT_ID');
router.get('/student-id-card-templates', stc.getAll);
router.get('/student-id-card-templates/default', stc.getDefault);
router.post('/student-id-card-templates', authMiddleware, stc.create);
router.patch('/student-id-card-templates/:id', authMiddleware, stc.update);
router.delete('/student-id-card-templates/:id', authMiddleware, stc.delete);

// Fee challan templates
const fc = configurationController.createTemplateHandlers('FEE_CHALLAN');
router.get('/fee-challan-templates', fc.getAll);
router.get('/fee-challan-templates/default', fc.getDefault);
router.post('/fee-challan-templates', authMiddleware, fc.create);
router.patch('/fee-challan-templates/:id', authMiddleware, fc.update);
router.delete('/fee-challan-templates/:id', authMiddleware, fc.delete);

module.exports = router;
