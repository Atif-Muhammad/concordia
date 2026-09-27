const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');
const { authMiddleware } = require('../middlewares/auth');

// Income
router.get('/income', financeController.getIncomes);
router.post('/income', authMiddleware, financeController.createIncome);
router.delete('/income/:id', authMiddleware, financeController.deleteIncome);

// Expense
router.get('/expense', financeController.getExpenses);
router.post('/expense', authMiddleware, financeController.createExpense);
router.delete('/expense/:id', authMiddleware, financeController.deleteExpense);
router.patch('/expense/:id/approve', authMiddleware, financeController.approveExpense);
router.patch('/expense/:id/reject', authMiddleware, financeController.rejectExpense);

// Closing
router.get('/closing/dashboard', financeController.getClosingDashboard);
router.get('/closing', financeController.getClosings);
router.post('/closing', authMiddleware, financeController.createClosing);
router.patch('/closing/:id', authMiddleware, financeController.updateClosing);
router.delete('/closing/:id', authMiddleware, financeController.deleteClosing);

// Ledger & Analytics
router.get('/ledger', financeController.getFinanceLedger);
router.get('/reports/analytics', financeController.getAnalytics);

module.exports = router;

