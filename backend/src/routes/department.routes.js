const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { authMiddleware } = require('../middlewares/auth');

router.get('/get', departmentController.getDepartments);
router.get('/get/names', departmentController.getDepartmentNames);
router.post('/create', authMiddleware, departmentController.createDepartment);
router.patch('/update', authMiddleware, departmentController.updateDepartment);
router.delete('/remove', authMiddleware, departmentController.deleteDepartment);

module.exports = router;
