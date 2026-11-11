const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authMiddleware } = require('../middlewares/auth');

router.use(authMiddleware);

router.get('/catalog', reportController.getCatalog);
router.get('/meta/grade-schemes', reportController.getGradeSchemes);
router.post('/:reportKey/export-log', reportController.logExport);
router.post('/:reportKey/action', reportController.runAction);
router.get('/:reportKey', reportController.runReport);

module.exports = router;
