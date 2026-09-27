const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher.controller');
const { authMiddleware, optionalAuth } = require('../middlewares/auth');

router.get('/get', teacherController.getTeachers);
router.get('/get/names', teacherController.getTeacherNames);
router.post('/create', authMiddleware, teacherController.createTeacher);
router.patch('/update', authMiddleware, teacherController.updateTeacher);
router.delete('/remove', authMiddleware, teacherController.deleteTeacher);
router.get('/subjects', optionalAuth, teacherController.getSubjects);
router.get('/subjects/by-class', optionalAuth, teacherController.getSubjects);
router.get('/get/classes', authMiddleware, teacherController.getClasses);
router.get('/get/class/students/attendance', teacherController.getClassStudentsAttendance);
router.patch('/update/class/students/attendance', authMiddleware, teacherController.updateClassStudentsAttendance);

// Leaves
router.get('/my-leaves', authMiddleware, teacherController.getMyLeaves);
router.post('/apply-leave', authMiddleware, teacherController.applyLeave);
router.delete('/cancel-leave/:id', authMiddleware, teacherController.cancelLeave);

// Complaints
router.get('/my-complaints', authMiddleware, teacherController.getMyComplaints);
router.get('/assigned-complaints', authMiddleware, teacherController.getAssignedComplaints);
router.post('/submit-complaint', authMiddleware, teacherController.submitComplaint);
router.patch('/complaints/:id/status', authMiddleware, teacherController.updateAssignedComplaintStatus);
router.post('/complaints/:id/remark', authMiddleware, teacherController.addComplaintRemark);

module.exports = router;
