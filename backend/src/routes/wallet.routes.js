const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { optionalAuth } = require('../middlewares/auth');

// Wallet routes
router.get('/', optionalAuth, walletController.getWallets);
router.post('/', optionalAuth, walletController.createWallet);
router.get('/history', optionalAuth, walletController.getTransactionHistory);
router.post('/deposit', optionalAuth, walletController.depositFunds);
router.post('/transfer', optionalAuth, walletController.transferFunds);
router.post('/payroll-deduction', optionalAuth, walletController.deductPayroll);
router.get('/payroll-logs', optionalAuth, walletController.getPayrollDeductionLogs);
router.get('/hostel-logs', optionalAuth, walletController.getHostelFeeLogs);
router.get('/tuition-fee-logs', optionalAuth, walletController.getTuitionFeeLogs);
router.get('/fee-logs', optionalAuth, walletController.getTuitionFeeLogs);
router.get('/expense-logs', optionalAuth, walletController.getExpenseLogs);
router.get('/:id', optionalAuth, walletController.getWalletById);
router.put('/:id', optionalAuth, walletController.updateWallet);
router.delete('/:id', optionalAuth, walletController.deleteWallet);

module.exports = router;
