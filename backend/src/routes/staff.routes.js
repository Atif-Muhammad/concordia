const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const attendanceController = require('../controllers/attendance.controller');
const upload = require('../middlewares/upload');
const { authMiddleware } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');

// Staff ID settings
router.get('/staff-id-settings', staffController.getStaffIdSettings);
router.patch('/staff-id-settings', authMiddleware, checkPermission('Staff', 'settings', 'update'), staffController.updateStaffIdSettings);
router.get('/staff-id-preview', staffController.previewStaffId);

// Staff CRUD
router.get('/staff', staffController.getStaff);
router.get('/staff/:id', staffController.getStaffById);
router.post('/staff', authMiddleware, checkPermission('Staff', 'directory', 'create'), upload.single('photo'), staffController.createStaff);
router.patch('/staff/:id', authMiddleware, checkPermission('Staff', 'directory', 'update'), upload.single('photo'), staffController.updateStaff);
router.delete('/staff/:id', authMiddleware, checkPermission('Staff', 'directory', 'delete'), staffController.deleteStaff);
router.post('/staff/:id/salary-revision', authMiddleware, checkPermission('Staff', 'directory', 'update'), staffController.reviseSalary);
router.get('/staff/:id/salary-history', staffController.getSalaryHistory);
router.get('/staff/:id/attendance', attendanceController.getStaffAttendanceHistory);

// Legacy employee endpoints
router.get('/get/employees', staffController.getStaff);
router.post('/create/employee', authMiddleware, checkPermission('Staff', 'directory', 'create'), upload.single('photo'), staffController.createStaff);
router.patch('/update/employee', authMiddleware, checkPermission('Staff', 'directory', 'update'), upload.single('photo'), staffController.updateStaff);
router.delete('/delete/employee', authMiddleware, checkPermission('Staff', 'directory', 'delete'), staffController.deleteStaff);
router.delete('/delete/employees', authMiddleware, checkPermission('Staff', 'directory', 'delete'), staffController.deleteStaff);

module.exports = router;
