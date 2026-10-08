const bcrypt = require('bcryptjs');
const { Staff, StaffIdSettings, Department, User } = require('../models');

class StaffService {
  async getStaff(filters = {}) {
    const query = {};
    if (filters.isTeaching !== undefined) query.isTeaching = filters.isTeaching === 'true' || filters.isTeaching === true;
    if (filters.isNonTeaching !== undefined) query.isNonTeaching = filters.isNonTeaching === 'true' || filters.isNonTeaching === true;
    if (filters.isSupportingStaff !== undefined) query.isSupportingStaff = filters.isSupportingStaff === 'true' || filters.isSupportingStaff === true;
    if (filters.status && filters.status !== 'all') query.status = filters.status;
    if (filters.search) {
      const re = new RegExp(filters.search, 'i');
      query.$or = [
        { name: re },
        { staffId: re },
        { fatherName: re },
        { phone: re },
        { email: re },
        { designation: re }
      ];
    }

    return Staff.find(query).populate('departmentId').sort({ createdAt: -1 });
  }

  async getStaffById(id) {
    return Staff.findById(id).populate('departmentId');
  }

  generateStaffIdFromJoinDate(joinDate) {
    let year = '';
    let month = '';
    if (joinDate) {
      const parts = String(joinDate).split('T')[0].split('-');
      if (parts.length >= 2 && parts[0].length === 4) {
        year = parts[0].slice(-2);
        month = parts[1].padStart(2, '0');
      } else {
        const d = new Date(joinDate);
        if (!isNaN(d.getTime())) {
          year = String(d.getFullYear()).slice(-2);
          month = String(d.getMonth() + 1).padStart(2, '0');
        }
      }
    }
    if (!year || !month) {
      const now = new Date();
      year = String(now.getFullYear()).slice(-2);
      month = String(now.getMonth() + 1).padStart(2, '0');
    }
    const rand2 = Math.floor(10 + Math.random() * 90).toString();
    return `${year}${month}${rand2}`;
  }

  async getPrefixForRoles(roles = {}) {
    const settings = await this.getStaffIdSettings();
    if (roles.isSupportingStaff === true || roles.isSupportingStaff === 'true') {
      return (settings && settings.supportingPrefix) ? settings.supportingPrefix : 'SS-';
    }
    const isTeaching = roles.isTeaching === true || roles.isTeaching === 'true';
    const isNonTeaching = roles.isNonTeaching === true || roles.isNonTeaching === 'true';
    if (isTeaching && isNonTeaching) {
      return (settings && settings.dualPrefix) ? settings.dualPrefix : 'D-';
    }
    if (isTeaching) {
      return (settings && settings.teachingPrefix) ? settings.teachingPrefix : 'T-';
    }
    if (isNonTeaching) {
      return (settings && settings.nonTeachingPrefix) ? settings.nonTeachingPrefix : 'NT-';
    }
    return (settings && settings.teachingPrefix) ? settings.teachingPrefix : 'T-';
  }

  async generateUniqueStaffId(joinDate, roles = {}) {
    const prefix = await this.getPrefixForRoles(roles);
    let attempts = 0;
    let staffId = '';
    let exists = true;
    while (exists && attempts < 50) {
      attempts++;
      const num = this.generateStaffIdFromJoinDate(joinDate);
      staffId = `${prefix}${num}`;
      const match = await Staff.findOne({ staffId }).select('_id').lean();
      exists = !!match;
    }
    return staffId;
  }

  async createStaff(data) {
    // Generate staffId if not provided (format: Prefix + YYMMRR from join date)
    if (!data.staffId) {
      data.staffId = await this.generateUniqueStaffId(data.joinDate, {
        isTeaching: data.isTeaching,
        isNonTeaching: data.isNonTeaching,
        isSupportingStaff: data.isSupportingStaff
      });
    }

    if (data.password) {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      data.password = hashedPassword;
      // also create user account for portal login
      if (data.email) {
        await User.findOneAndUpdate(
          { email: data.email },
          {
            name: data.name,
            email: data.email,
            password: hashedPassword,
            role: data.isTeaching ? 'TEACHER' : 'STAFF',
            isStaff: true,
            isTeaching: data.isTeaching,
            isNonTeaching: data.isNonTeaching,
            designation: data.designation || '',
            permissions: data.permissions || { all: false, modules: [], subModules: {} }
          },
          { upsert: true }
        );
      }
    }

    if (data.basicPay !== undefined) {
      data.basicPay = Number(data.basicPay) || 0;
      if (!data.baseSalary) {
        data.baseSalary = data.basicPay;
      }
      // Auto-generate absent deduction = basicPay / 30
      const calculatedAbsent = data.basicPay > 0 ? Math.round(data.basicPay / 30) : 0;
      data.absentDeduction = calculatedAbsent;
      if (!data.leaveSettings) data.leaveSettings = {};
      data.leaveSettings.absentDeduction = calculatedAbsent;
    }

    const staff = await Staff.create(data);
    return staff;
  }

  async updateStaff(id, data) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const existingStaff = await Staff.findById(id);
    if (!existingStaff) {
      throw new Error('Staff not found');
    }

    if (data.basicPay !== undefined) {
      data.basicPay = Number(data.basicPay) || 0;
      if (!existingStaff.baseSalary && !data.baseSalary) {
        data.baseSalary = existingStaff.basicPay || data.basicPay || 0;
      }
      const calculatedAbsent = data.basicPay > 0 ? Math.round(data.basicPay / 30) : 0;
      data.absentDeduction = calculatedAbsent;
      if (!data.leaveSettings) {
        data.leaveSettings = { ...(existingStaff.leaveSettings ? existingStaff.leaveSettings.toObject() : {}) };
      }
      data.leaveSettings.absentDeduction = calculatedAbsent;
    }

    const staff = await Staff.findByIdAndUpdate(id, data, { new: true });

    if (staff && staff.email) {
      const userUpdate = {};
      if (staff.name) userUpdate.name = staff.name;
      if (data.password) userUpdate.password = data.password;
      if (data.permissions) userUpdate.permissions = data.permissions;
      if (staff.isTeaching !== undefined) {
        userUpdate.isTeaching = staff.isTeaching;
        userUpdate.role = staff.isTeaching ? 'TEACHER' : 'STAFF';
      }
      if (staff.isNonTeaching !== undefined) userUpdate.isNonTeaching = staff.isNonTeaching;

      if (Object.keys(userUpdate).length > 0) {
        await User.findOneAndUpdate({ email: staff.email }, { $set: userUpdate });
      }
    }

    return staff;
  }

  async reviseSalary(id, { type, percentage, remarks, effectiveDate, userId }) {
    const staff = await Staff.findById(id);
    if (!staff) throw new Error('Staff not found');

    const pct = Number(percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      throw new Error('Percentage must be a valid number between 0 and 100');
    }

    if (!staff.baseSalary) {
      staff.baseSalary = Number(staff.basicPay) || 0;
    }

    // Previous salary: current basicPay (or baseSalary for first time)
    const prevSalary = Number(staff.basicPay) || Number(staff.baseSalary) || 0;
    const changeAmount = Math.round((prevSalary * pct) / 100);

    let newSalary = prevSalary;
    if (type === 'INCREMENT') {
      newSalary = prevSalary + changeAmount;
    } else if (type === 'DECREMENT') {
      newSalary = Math.max(0, prevSalary - changeAmount);
    } else {
      throw new Error('Revision type must be INCREMENT or DECREMENT');
    }

    // Daily absent deduction = new salary / 30
    const dailyAbsentDeduction = newSalary > 0 ? Math.round(newSalary / 30) : 0;

    const revisionEntry = {
      type,
      percentage: pct,
      previousSalary: prevSalary,
      amountChanged: type === 'INCREMENT' ? changeAmount : -changeAmount,
      newSalary,
      dailyAbsentDeduction,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      remarks: remarks || '',
      appliedBy: userId || null,
      createdAt: new Date()
    };

    if (!Array.isArray(staff.salaryHistory)) {
      staff.salaryHistory = [];
    }
    staff.salaryHistory.push(revisionEntry);
    staff.basicPay = newSalary;
    staff.absentDeduction = dailyAbsentDeduction;
    if (!staff.leaveSettings) staff.leaveSettings = {};
    staff.leaveSettings.absentDeduction = dailyAbsentDeduction;

    await staff.save();
    return staff;
  }

  async getSalaryHistory(id) {
    const staff = await Staff.findById(id).populate('salaryHistory.appliedBy', 'name email');
    if (!staff) throw new Error('Staff not found');

    const baseSalary = staff.baseSalary || staff.basicPay || 0;
    const history = (staff.salaryHistory || []).slice().sort((a, b) => new Date(b.effectiveDate || b.createdAt) - new Date(a.effectiveDate || a.createdAt));

    return {
      staffId: staff.staffId,
      name: staff.name,
      joinDate: staff.joinDate,
      baseSalary,
      currentSalary: staff.basicPay || 0,
      absentDeduction: staff.absentDeduction || (staff.basicPay ? Math.round(staff.basicPay / 30) : 0),
      salaryHistory: history
    };
  }

  async deleteStaff(id) {
    return Staff.findByIdAndDelete(id);
  }

  async getStaffIdSettings() {
    let settings = await StaffIdSettings.findOne();
    if (!settings) {
      settings = await StaffIdSettings.create({
        teachingPrefix: 'T-',
        nonTeachingPrefix: 'NT-',
        dualPrefix: 'D-',
        supportingPrefix: 'SS-'
      });
    } else if (!settings.supportingPrefix) {
      settings.supportingPrefix = 'SS-';
      await settings.save();
    }
    return settings;
  }

  async updateStaffIdSettings(data) {
    let settings = await StaffIdSettings.findOne();
    if (!settings) {
      settings = await StaffIdSettings.create(data);
    } else {
      settings = await StaffIdSettings.findByIdAndUpdate(settings._id, data, { new: true });
    }
    return settings;
  }

  async previewStaffId({ isTeaching, isNonTeaching, isSupportingStaff, joinDate }) {
    const staffId = await this.generateUniqueStaffId(joinDate, {
      isTeaching,
      isNonTeaching,
      isSupportingStaff
    });
    return { staffId };
  }
}

module.exports = new StaffService();
