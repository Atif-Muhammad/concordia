const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const upload = require('../middlewares/upload');
const { authMiddleware } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');

router.get('/get/all', studentController.getStudents);
router.get('/get/all/passout', studentController.getStudents);
router.get('/search', studentController.search);
router.get('/roll-number/latest', studentController.getLatestRollNumber);
router.get('/roll-number/latest/batch', studentController.getLatestRollNumbersBatch);

router.get('/attendance/:studentId', studentController.getAttendance);
router.get('/attendance-report/:studentId', studentController.getAttendance);
router.get('/results/:studentId', studentController.getResults);
router.get('/result-report/:studentId', studentController.getResults);
router.get('/:studentId', studentController.getStudentById);

router.post('/create', authMiddleware, checkPermission('Students', '_root', 'create'), upload.single('photo'), studentController.createStudent);
router.patch('/update', authMiddleware, checkPermission('Students', '_root', 'update'), upload.single('photo'), studentController.updateStudent);
router.delete('/remove', authMiddleware, checkPermission('Students', '_root', 'delete'), studentController.deleteStudent);

// Lifecycle actions
router.patch('/promote', authMiddleware, checkPermission('Students', '_root', 'update'), studentController.promoteStudents);
router.patch('/demote', authMiddleware, checkPermission('Students', '_root', 'update'), studentController.demoteStudents);
router.patch('/expel', authMiddleware, checkPermission('Students', '_root', 'update'), studentController.expelStudents);
router.patch('/passout', authMiddleware, checkPermission('Students', '_root', 'update'), studentController.passoutStudents);
router.patch('/rejoin', authMiddleware, checkPermission('Students', '_root', 'update'), studentController.rejoinStudent);
router.patch('/struck-off', authMiddleware, checkPermission('Students', '_root', 'update'), studentController.struckOffStudents);

module.exports = router;
