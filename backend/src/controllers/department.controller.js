const departmentService = require('../services/department.service');

class DepartmentController {
  async getDepartments(req, res, next) {
    try {
      const departments = await departmentService.getDepartments();
      res.json(departments);
    } catch (err) {
      next(err);
    }
  }

  async getDepartmentNames(req, res, next) {
    try {
      const names = await departmentService.getDepartmentNames();
      res.json(names);
    } catch (err) {
      next(err);
    }
  }

  async createDepartment(req, res, next) {
    try {
      const department = await departmentService.createDepartment(req.body);
      res.status(201).json(department);
    } catch (err) {
      next(err);
    }
  }

  async updateDepartment(req, res, next) {
    try {
      const depID = req.query.depID || req.params.id;
      const data = req.body.data || req.body;
      const department = await departmentService.updateDepartment(depID, data);
      res.json(department);
    } catch (err) {
      next(err);
    }
  }

  async deleteDepartment(req, res, next) {
    try {
      const depID = req.query.depID || req.params.id;
      await departmentService.deleteDepartment(depID);
      res.json({ message: 'Department removed successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DepartmentController();
