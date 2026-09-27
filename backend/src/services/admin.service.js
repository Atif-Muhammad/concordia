const bcrypt = require('bcryptjs');
const { User, Attendance, Staff } = require('../models');

class AdminService {
  async getAdmins() {
    return User.find({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } }).select('-password');
  }

  async createAdmin(data) {
    const { name, email, password, role, permissions, phone } = data;
    const hashedPassword = await bcrypt.hash(password || 'admin123', 10);
    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'ADMIN',
      phone,
      permissions: permissions || { all: false, modules: [], subModules: {} }
    });
    return admin;
  }

  async updateAdmin(adminId, data) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const updated = await User.findByIdAndUpdate(adminId, data, { new: true }).select('-password');
    return updated;
  }

  async deleteAdmin(adminId) {
    return User.findByIdAndDelete(adminId);
  }

  async markTeacherAttendance(teacherId, status, date) {
    const query = {
      staffId: teacherId,
      date,
      role: 'TEACHER'
    };
    return Attendance.findOneAndUpdate(
      query,
      { ...query, status, markedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  async getTeacherAttendance(date) {
    return Attendance.find({ role: 'TEACHER', date }).populate('staffId');
  }
}

module.exports = new AdminService();
