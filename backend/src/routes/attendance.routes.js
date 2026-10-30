const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authMiddleware } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { TeacherMapping, Staff } = require('../models');

/**
 * Middleware that allows authorized staff (via standard RBAC checkPermission)
 * OR teachers who are assigned as Class Teacher for the target class/section.
 */
const allowClassTeacherOrPermission = (moduleLabel, subModuleId, action) => {
  const rbacCheck = checkPermission(moduleLabel, subModuleId, action);
  return async (req, res, next) => {
    let rbacPassed = false;
    let rbacError = null;
    let rbacStatusCode = null;

    const fakeRes = {
      status: (code) => {
        rbacStatusCode = code;
        return {
          json: (err) => {
            rbacError = err;
          }
        };
      }
    };

    await rbacCheck(req, fakeRes, () => {
      rbacPassed = true;
    });

    if (rbacPassed) {
      return next();
    }

    // RBAC check failed - check if user is a teacher and assigned as Class Teacher for this class
    try {
      const classId = req.body?.classId || req.query?.classId;
      if (classId && req.user) {
        let staffId = req.user.refId || req.user.staffDbId;
        if (!staffId && (req.user.role === 'TEACHER' || req.user.role === 'Teacher')) {
          const staff = await Staff.findOne({
            $or: [{ userId: req.user.id }, { email: req.user.email }]
          }).select('_id');
          if (staff) staffId = staff._id;
        }

        if (staffId) {
          const sectionId = req.body?.sectionId || req.query?.sectionId;
          const query = {
            teacherId: staffId,
            classId,
            isClassTeacher: true,
          };
          if (sectionId && sectionId !== '*' && sectionId !== 'all') {
            query.$or = [{ sectionId }, { sectionId: null }, { sectionId: { $exists: false } }];
          }

          const mapping = await TeacherMapping.findOne(query);
          if (mapping) {
            return next();
          }
        }
      }
    } catch (err) {
      console.error('Error verifying class teacher permission:', err);
    }

    if (rbacStatusCode && rbacError) {
      return res.status(rbacStatusCode).json(rbacError);
    }
    return res.status(403).json({
      message: `Forbidden: Only assigned Class Teachers or authorized staff can mark attendance for this class.`
    });
  };
};

// Student attendance
router.get('/student/fetch', attendanceController.fetchStudentAttendance);
router.get('/report', attendanceController.getAttendanceReport);
router.patch('/student/update', authMiddleware, allowClassTeacherOrPermission('Attendance', 'mark', 'update'), attendanceController.updateStudentAttendance);
router.delete('/student/record', authMiddleware, allowClassTeacherOrPermission('Attendance', 'mark', 'delete'), attendanceController.deleteStudentRecord);
router.post('/generate', authMiddleware, allowClassTeacherOrPermission('Attendance', 'mark', 'create'), attendanceController.updateStudentAttendance);
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
router.get('/missing/export-report', attendanceController.getMissingAttendanceExportReport);

module.exports = router;
