const mongoose = require('mongoose');
const { Department } = require('../models');

class DepartmentService {
  async getDepartments() {
    return Department.find()
      .populate('hod', 'name designation phone email')
      .sort({ name: 1 });
  }

  async getDepartmentNames() {
    return Department.find().select('name code').sort({ name: 1 });
  }

  async createDepartment(data) {
    const name = (data.name || data.departmentName || '').trim();
    if (!name) {
      throw new Error('Department name is required');
    }

    let hod = null;
    const rawHod = data.hod || data.headOfDepartment;
    if (rawHod && mongoose.Types.ObjectId.isValid(rawHod)) {
      hod = rawHod;
    }

    return Department.create({
      ...data,
      name,
      hod,
      headOfDepartment: data.headOfDepartment || '',
      description: data.description || '',
    });
  }

  async updateDepartment(depId, data) {
    const updateData = { ...data };
    if (data.departmentName && !data.name) {
      updateData.name = data.departmentName.trim();
    }
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }

    if (data.headOfDepartment !== undefined) {
      const rawHod = data.headOfDepartment;
      if (rawHod && mongoose.Types.ObjectId.isValid(rawHod)) {
        updateData.hod = rawHod;
      } else {
        updateData.hod = null;
      }
      updateData.headOfDepartment = data.headOfDepartment || '';
    }

    if (data.hod !== undefined) {
      if (data.hod && mongoose.Types.ObjectId.isValid(data.hod)) {
        updateData.hod = data.hod;
      } else {
        updateData.hod = null;
      }
    }

    return Department.findByIdAndUpdate(depId, updateData, { new: true })
      .populate('hod', 'name designation phone email');
  }

  async deleteDepartment(depId) {
    return Department.findByIdAndDelete(depId);
  }
}

module.exports = new DepartmentService();
