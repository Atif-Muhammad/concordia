const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authMiddleware } = require('../middlewares/auth');

router.get('/get/admins', authMiddleware, adminController.getAdmins);
router.post('/create/admin', authMiddleware, adminController.createAdmin);
router.patch('/update/admin', authMiddleware, adminController.updateAdmin);
router.delete('/remove/admin', authMiddleware, adminController.deleteAdmin);
router.patch('/mark/teacher', authMiddleware, adminController.markTeacher);
router.get('/get/teacher/attendance', authMiddleware, adminController.getTeacherAttendance);

module.exports = router;
