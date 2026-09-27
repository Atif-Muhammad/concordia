const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hr.controller');
const attendanceController = require('../controllers/attendance.controller');
const { authMiddleware } = require('../middlewares/auth');

// Payroll Settings
router.get('/payroll-settings', hrController.getSettings);
router.patch('/payroll-settings', authMiddleware, hrController.updateSettings);

// Payroll Templates
router.get('/payroll-template', hrController.getTemplates);
router.post('/payroll-template', authMiddleware, hrController.createTemplate);
router.patch('/payroll-template', authMiddleware, hrController.updateTemplate);
router.delete('/payroll-template', authMiddleware, hrController.deleteTemplate);

// Payroll Sheet & History
router.get('/payroll-sheet', hrController.getPayrollSheet);
router.get('/payroll-history', hrController.getPayrollHistory);
router.get('/missing-payroll-staff', hrController.getMissingPayrollStaff);
router.get('/payroll-missing-staff', hrController.getMissingPayrollStaff);
router.post('/payroll', authMiddleware, hrController.upsertPayroll);
router.post('/payroll-generate', authMiddleware, hrController.generatePayroll);
router.post('/payroll/:payrollId/payment', authMiddleware, hrController.recordPayment);

// Staff Leaves Management
router.get('/leave-sheet', hrController.getLeaveSheet);
router.post('/leave', authMiddleware, hrController.upsertLeave);
router.delete('/staff-leaves/:id', authMiddleware, hrController.deleteStaffLeave);
router.patch('/staff-leaves/:id/status', authMiddleware, hrController.updateStaffLeaveStatus);
router.patch('/staff-leaves/:id/lock', authMiddleware, hrController.toggleLockStaffLeave);

// Advance Salary
router.get('/advance-salary', hrController.getAdvance);
router.post('/advance-salary', authMiddleware, hrController.createAdvance);
router.patch('/advance-salary', authMiddleware, hrController.updateAdvance);
router.delete('/advance-salary', authMiddleware, hrController.deleteAdvance);

// Staff Attendance
router.get('/staff-attendance', attendanceController.getStaffAttendance);
router.post('/staff-attendance', authMiddleware, attendanceController.bulkMarkStaffAttendance);
router.post('/staff-attendance/bulk', authMiddleware, attendanceController.bulkMarkStaffAttendance);
router.delete('/staff-attendance/record', authMiddleware, attendanceController.deleteStaffAttendanceRecord);
router.delete('/staff-attendance/by-date', authMiddleware, attendanceController.deleteStaffAttendanceByDate);
router.get('/staff-leave-balance/:staffId', attendanceController.getStaffLeaveBalance);
router.get('/staff/:staffId/attendance', attendanceController.getStaffAttendanceHistory);

// Holidays
router.get('/holidays', attendanceController.getHolidays);
router.post('/holidays', authMiddleware, attendanceController.createHoliday);
router.delete('/holidays', authMiddleware, attendanceController.deleteHoliday);

// Reports
router.get('/reports/analytics', hrController.getAnalytics);

module.exports = router;
