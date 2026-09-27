const express = require('express');
const router = express.Router();
const feeController = require('../controllers/fee.controller');
const { authMiddleware } = require('../middlewares/auth');

// Heads
router.get('/head/get/all', feeController.getHeads);
router.post('/head/create', authMiddleware, feeController.createHead);
router.patch('/head/update', authMiddleware, feeController.updateHead);
router.delete('/head/remove', authMiddleware, feeController.deleteHead);
router.delete('/head/delete', authMiddleware, feeController.deleteHead);

// Structures
router.get('/structure/get/all', feeController.getStructures);
router.post('/structure/create', authMiddleware, feeController.createStructure);
router.patch('/structure/update', authMiddleware, feeController.updateStructure);
router.delete('/structure/remove', authMiddleware, feeController.deleteStructure);
router.delete('/structure/delete', authMiddleware, feeController.deleteStructure);

// Challans & Installments
router.get('/installment-plans', feeController.getInstallmentPlans);
router.get('/challan/get/all', feeController.getChallans);
router.get('/challan/bulk', feeController.getChallans);
router.get('/challan/history', feeController.getChallans);
router.get('/challans', feeController.getChallans);
router.get('/installments/student/:studentId', feeController.getStudentInstallments);
router.get('/installments', (req, res, next) => {
  if (req.query.studentId) {
    return feeController.getStudentInstallments(req, res, next);
  }
  return feeController.getChallans(req, res, next);
});
// Extra Challans (Must be declared before /challans/:id)
router.get('/extra-challan/get/all', feeController.getExtraChallans);
router.get('/challans/extra', feeController.getExtraChallans);
router.get('/challans/extra/list', feeController.getExtraChallans);
router.post('/extra-challan/create', authMiddleware, feeController.createExtraChallan);
router.post('/challans/extra', authMiddleware, feeController.createExtraChallan);
router.patch('/extra-challan/update', authMiddleware, feeController.updateExtraChallan);
router.patch('/challans/extra/:id', authMiddleware, feeController.updateExtraChallan);
router.post('/challans/extra/:id/pay', authMiddleware, feeController.recordPayment);
router.delete('/extra-challan/remove', authMiddleware, feeController.deleteExtraChallan);
router.delete('/challans/extra/:id', authMiddleware, feeController.deleteExtraChallan);
router.delete('/challans/extra', authMiddleware, feeController.deleteExtraChallan);

router.post('/challan/create', authMiddleware, feeController.createChallan);
router.post('/challan/generate-from-plan', authMiddleware, feeController.createChallan);
router.post('/challans/generate', authMiddleware, feeController.createChallan);
router.post('/challans/bulk-generate', authMiddleware, feeController.bulkGenerateChallans);
router.post('/challan/bulk-generate', authMiddleware, feeController.bulkGenerateChallans);

router.get('/challans/:id', feeController.getChallanById);
router.get('/installments/:id', feeController.getChallanById);
router.get('/challans/:id/print', feeController.getChallanById);
router.patch('/challan/update', authMiddleware, feeController.updateChallan);
router.patch('/challans/:id/void', authMiddleware, (req, res, next) => {
  req.body.status = 'VOID';
  feeController.updateChallan(req, res, next);
});
router.delete('/challan/remove', authMiddleware, feeController.deleteChallan);
router.delete('/challan/delete', authMiddleware, feeController.deleteChallan);

// Payments
router.post('/payments', authMiddleware, feeController.recordPayment);
router.post('/challan/pay', authMiddleware, feeController.recordPayment);
router.get('/student-credit/:studentId', feeController.getStudentCreditBalance);
router.get('/student-credit', feeController.getStudentCreditBalance);
router.get('/challans/:challanId/receipts', feeController.getChallanReceipts);
router.get('/receipts/:challanId', feeController.getChallanReceipts);

// Settings
router.get('/settings', feeController.getSettings);
router.patch('/settings', authMiddleware, feeController.updateSettings);

// Reports
router.get('/reports/analytics', feeController.getFeeReportsAnalytics);
router.get('/reports/summary', feeController.getFeeReportSummary);
router.get('/reports/class-stats', feeController.getClassStats);
router.get('/reports/class-collection', feeController.getClassStats);
router.get('/reports/collection-summary', feeController.getFeeReportSummary);
router.get('/reports/revenue-over-time', feeController.getRevenueOverTime);

// Templates (Fee Challan Templates)
const configurationService = require('../services/configuration.service');

router.get('/template/get/all', async (req, res, next) => {
  try {
    const type = req.query.type || { $in: ['INSTALLMENT', 'EXTRA', 'HOSTEL', 'FEE_CHALLAN'] };
    const templates = await configurationService.getTemplates(type);
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

router.get('/template/get/default', async (req, res, next) => {
  try {
    const type = req.query.type || 'FEE_CHALLAN';
    const template = await configurationService.getDefaultTemplate(type);
    res.json(template || null);
  } catch (err) {
    next(err);
  }
});

router.post('/template/create', authMiddleware, async (req, res, next) => {
  try {
    const template = await configurationService.createTemplate(req.body);
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

router.patch('/template/update', authMiddleware, async (req, res, next) => {
  try {
    const id = req.query.id || req.body.id || req.body._id;
    const template = await configurationService.updateTemplate(id, req.body);
    res.json(template);
  } catch (err) {
    next(err);
  }
});

router.delete('/template/delete', authMiddleware, async (req, res, next) => {
  try {
    const id = req.query.id || req.body.id || req.body._id;
    await configurationService.deleteTemplate(id);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
