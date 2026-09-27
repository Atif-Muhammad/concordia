const adminService = require('../services/admin.service');

class AdminController {
  async getAdmins(req, res, next) {
    try {
      const admins = await adminService.getAdmins();
      res.json(admins);
    } catch (err) {
      next(err);
    }
  }

  async createAdmin(req, res, next) {
    try {
      const admin = await adminService.createAdmin(req.body);
      res.status(201).json(admin);
    } catch (err) {
      next(err);
    }
  }

  async updateAdmin(req, res, next) {
    try {
      const adminId = req.query.adminID || req.params.id;
      const admin = await adminService.updateAdmin(adminId, req.body);
      res.json(admin);
    } catch (err) {
      next(err);
    }
  }

  async deleteAdmin(req, res, next) {
    try {
      const adminId = req.query.adminID || req.params.id;
      await adminService.deleteAdmin(adminId);
      res.json({ message: 'Admin deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async markTeacher(req, res, next) {
    try {
      const id = req.query.id || req.body.id;
      const { status, date } = req.body;
      const record = await adminService.markTeacherAttendance(id, status, date);
      res.json(record);
    } catch (err) {
      next(err);
    }
  }

  async getTeacherAttendance(req, res, next) {
    try {
      const { date } = req.query;
      const records = await adminService.getTeacherAttendance(date);
      res.json(records);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
