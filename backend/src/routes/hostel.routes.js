const express = require('express');
const router = express.Router();
const hostelController = require('../controllers/hostel.controller');
const { optionalAuth } = require('../middlewares/auth');

// Rooms
router.get('/rooms', hostelController.getRooms);
router.post('/rooms', optionalAuth, hostelController.createRoom);
router.patch('/rooms/:id', optionalAuth, hostelController.updateRoom);
router.delete('/rooms/:id', optionalAuth, hostelController.deleteRoom);

// Allocations
router.post('/allocations', optionalAuth, hostelController.allocateRoom);
router.delete('/allocations/:id', optionalAuth, hostelController.deallocateStudent);

// Registrations
router.get('/registrations', hostelController.getRegistrations);
router.get('/registrations-search', hostelController.searchRegistrations);
router.get('/registrations/:id', hostelController.getRegistrationById);
router.get('/registrations/:id/history', hostelController.getRegistrationHistory);
router.get('/registrations/by-student/:studentId', hostelController.getRegistrationByStudent);
router.get('/room/by-student/:studentId', hostelController.getRoomByStudent);
router.post('/registrations', optionalAuth, hostelController.createRegistration);
router.patch('/registrations/:id', optionalAuth, hostelController.updateRegistration);
router.delete('/registrations/:id', optionalAuth, hostelController.deleteRegistration);
router.patch('/registrations/:id/terminate', optionalAuth, hostelController.terminate);
router.patch('/registrations/:id/withdraw', optionalAuth, hostelController.withdraw);
router.patch('/registrations/:id/readmit', optionalAuth, hostelController.readmit);

// Registration Payments & Credits
router.get('/registrations/:registrationId/credit', hostelController.getRegistrationCredit);
router.get('/registrations/:registrationId/payments', hostelController.getRegistrationPayments);
router.post('/registrations/:registrationId/payments', optionalAuth, hostelController.createRegistrationPayment);
router.delete('/registrations/:registrationId/payments/:paymentId', optionalAuth, hostelController.deleteRegistrationPayment);

// Expenses
router.get('/expenses', hostelController.getExpenses);
router.post('/expenses', optionalAuth, hostelController.createExpense);
router.patch('/expenses/:id', optionalAuth, hostelController.updateExpense);
router.delete('/expenses/:id', optionalAuth, hostelController.deleteExpense);

// Inventory
router.get('/inventory', hostelController.getInventory);
router.post('/inventory', optionalAuth, hostelController.createInventory);
router.patch('/inventory/:id', optionalAuth, hostelController.updateInventory);
router.delete('/inventory/:id', optionalAuth, hostelController.deleteInventory);

// Challans
router.get('/challans', hostelController.getChallans);
router.get('/challans/:id/print', hostelController.printChallan);
router.get('/external-challans/by-registration/:registrationId', hostelController.getChallans);
router.post('/challans', optionalAuth, hostelController.createChallan);
router.post('/external-challans', optionalAuth, hostelController.createChallan);
router.patch('/challans/:id', optionalAuth, hostelController.updateChallan);
router.patch('/external-challans/:id', optionalAuth, hostelController.updateChallan);
router.delete('/challans/:id', optionalAuth, hostelController.deleteChallan);
router.delete('/external-challans/:id', optionalAuth, hostelController.deleteChallan);
router.post('/challans/:challanId/payment', optionalAuth, hostelController.recordPayment);

// Revenue & Analytics
router.get('/revenue', hostelController.getRevenue);
router.get('/reports/analytics', hostelController.getReportsAnalytics);

module.exports = router;
