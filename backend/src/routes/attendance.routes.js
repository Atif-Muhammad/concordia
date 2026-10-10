const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authMiddleware } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');

// Student attendance
router.get('/student/fetch', attendanceController.fetchStudentAttendance);
router.get('/report', attendanceController.getAttendanceReport);
router.patch('/student/update', authMiddleware, checkPermission('Attendance', 'mark', 'update'), attendanceController.updateStudentAttendance);
router.delete('/student/record', authMiddleware, checkPermission('Attendance', 'mark', 'delete'), attendanceController.deleteStudentRecord);
router.post('/generate', authMiddleware, checkPermission('Attendance', 'mark', 'create'), attendanceController.updateStudentAttendance);
router.post('/skip', authMiddleware, checkPermission('Attendance', 'mark', 'create'), attendanceController.createSkip);
router.get('/skip', attendanceController.getSkips);
router.delete('/skip', authMiddleware, checkPermission('Attendance', 'mark', 'delete'), attendanceController.deleteSkip);

// Leaves
router.get('/leaves/get', attendanceController.getLeaves);
router.post('/leaves/create', authMiddleware, checkPermission('Attendance', 'leave', 'create'), attendanceController.createLeave);
router.patch('/leaves/update', authMiddleware, checkPermission('Attendance', 'leave', 'update'), attendanceController.updateLeave);

// Missing Attendance Audits
router.get('/missing/classes-summary', attendanceController.getMissingAttendanceClassesSummary);
router.get('/missing/subjects-summary', attendanceController.getMissingAttendanceSubjectsSummary);
router.get('/missing/students-summary', attendanceController.getMissingAttendanceStudentsSummary);

module.exports = router;
