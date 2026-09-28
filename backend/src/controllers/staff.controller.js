const staffService = require('../services/staff.service');
const { Staff } = require('../models');
const { saveProfileImage, deleteProfileImage } = require('../utils/profileStorage');

function safeNum(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (Array.isArray(val)) val = val[val.length - 1];
  const n = Number(val);
  return isNaN(n) ? defaultVal : n;
}

class StaffController {
  async getStaff(req, res, next) {
    try {
      const staff = await staffService.getStaff(req.query);
      res.json(staff);
    } catch (err) {
      next(err);
    }
  }

  async getAllStaff(req, res, next) {
    return this.getStaff(req, res, next);
  }

  async getStaffById(req, res, next) {
    try {
      const staff = await staffService.getStaffById(req.params.id);
      if (!staff) return res.status(404).json({ message: 'Staff not found' });
      res.json(staff);
    } catch (err) {
      next(err);
    }
  }

  async createStaff(req, res, next) {
    try {
      let body = { ...req.body };
      if (body.isTeaching !== undefined) body.isTeaching = String(body.isTeaching) === 'true';
      if (body.isNonTeaching !== undefined) body.isNonTeaching = String(body.isNonTeaching) === 'true';
      if (body.isSupportingStaff !== undefined) body.isSupportingStaff = String(body.isSupportingStaff) === 'true';
      if (body.isSupportingStaff) {
        body.isTeaching = false;
        body.isNonTeaching = false;
        body.permissions = { modules: [], subModules: {}, actions: {}, crud: {} };
      }
      if (typeof body.permissions === 'string') {
        try { body.permissions = JSON.parse(body.permissions); } catch (e) {}
      }
      if (typeof body.documents === 'string') {
        try { body.documents = JSON.parse(body.documents); } catch (e) {}
      }
      if (body.basicPay !== undefined) {
        body.basicPay = safeNum(body.basicPay, 0);
      }
      if (!body.departmentId || body.departmentId === 'none' || body.departmentId === '') {
        body.departmentId = null;
      }
      const autoAbsentDeduction = body.basicPay !== undefined && body.basicPay > 0
        ? Math.round(body.basicPay / 30)
        : safeNum(body.absentDeduction ?? body.leaveSettings?.absentDeduction, 0);
      const maxLateMinutes = safeNum(body.maxLateMinutes ?? body.leaveSettings?.maxLateMinutes, 0);
      body.absentDeduction = autoAbsentDeduction;
      body.maxLateMinutes = maxLateMinutes;

      body.leaveSettings = {
        sickAllowed: safeNum(body.sickAllowed ?? body.leaveSettings?.sickAllowed, 0),
        sickDeduction: safeNum(body.sickDeduction ?? body.leaveSettings?.sickDeduction, 0),
        annualAllowed: safeNum(body.annualAllowed ?? body.leaveSettings?.annualAllowed, 0),
        annualDeduction: safeNum(body.annualDeduction ?? body.leaveSettings?.annualDeduction, 0),
        casualAllowed: safeNum(body.casualAllowed ?? body.leaveSettings?.casualAllowed, 0),
        casualDeduction: safeNum(body.casualDeduction ?? body.leaveSettings?.casualDeduction, 0),
        absentDeduction: autoAbsentDeduction,
        maxLateMinutes,
      };

      const staff = await staffService.createStaff(body);
      if (req.file) {
        const staffIdentifier = staff.staffId || staff._id.toString();
        const photoUrl = await saveProfileImage('staff', staffIdentifier, req.file);
        staff.photo_url = photoUrl;
        await staff.save();
      }
      res.status(201).json(staff);
    } catch (err) {
      next(err);
    }
  }

  async updateStaff(req, res, next) {
    try {
      const id = req.params.id || req.query.id;
      let body = { ...req.body };

      const existingStaff = await Staff.findById(id) || await Staff.findOne({ staffId: id });
      const staffIdentifier = existingStaff?.staffId || id;

      if (req.file) {
        body.photo_url = await saveProfileImage('staff', staffIdentifier, req.file);
      } else if (body.removePhoto === 'true' || body.photo_url === '' || body.photo === '') {
        if (staffIdentifier) {
          await deleteProfileImage('staff', staffIdentifier);
        }
        body.photo_url = '';
      }

      if (body.isTeaching !== undefined) body.isTeaching = String(body.isTeaching) === 'true';
      if (body.isNonTeaching !== undefined) body.isNonTeaching = String(body.isNonTeaching) === 'true';
      if (body.isSupportingStaff !== undefined) body.isSupportingStaff = String(body.isSupportingStaff) === 'true';
      if (body.isSupportingStaff) {
        body.isTeaching = false;
        body.isNonTeaching = false;
        body.permissions = { modules: [], subModules: {}, actions: {}, crud: {} };
      }
      if (typeof body.permissions === 'string') {
        try { body.permissions = JSON.parse(body.permissions); } catch (e) {}
      }
      if (typeof body.documents === 'string') {
        try { body.documents = JSON.parse(body.documents); } catch (e) {}
      }
      if (body.basicPay !== undefined) {
        body.basicPay = safeNum(body.basicPay, 0);
      }
      if (!body.departmentId || body.departmentId === 'none' || body.departmentId === '') {
        body.departmentId = null;
      }

      const updateAbsentDeduction = body.basicPay !== undefined && body.basicPay > 0
        ? Math.round(body.basicPay / 30)
        : safeNum(body.absentDeduction ?? body.leaveSettings?.absentDeduction, 0);
      const updateMaxLateMinutes = safeNum(body.maxLateMinutes ?? body.leaveSettings?.maxLateMinutes, 0);
      body.absentDeduction = updateAbsentDeduction;
      body.maxLateMinutes = updateMaxLateMinutes;

      body.leaveSettings = {
        sickAllowed: safeNum(body.sickAllowed ?? body.leaveSettings?.sickAllowed, 0),
        sickDeduction: safeNum(body.sickDeduction ?? body.leaveSettings?.sickDeduction, 0),
        annualAllowed: safeNum(body.annualAllowed ?? body.leaveSettings?.annualAllowed, 0),
        annualDeduction: safeNum(body.annualDeduction ?? body.leaveSettings?.annualDeduction, 0),
        casualAllowed: safeNum(body.casualAllowed ?? body.leaveSettings?.casualAllowed, 0),
        casualDeduction: safeNum(body.casualDeduction ?? body.leaveSettings?.casualDeduction, 0),
        absentDeduction: updateAbsentDeduction,
        maxLateMinutes: updateMaxLateMinutes,
      };

      const staff = await staffService.updateStaff(id, body);
      res.json(staff);
    } catch (err) {
      next(err);
    }
  }

  async deleteStaff(req, res, next) {
    try {
      const id = req.params.id || req.query.id || req.body.id || req.body.ids;
      const ids = Array.isArray(id) ? id : [id].filter(Boolean);
      for (const singleId of ids) {
        const existingStaff = await Staff.findById(singleId) || await Staff.findOne({ staffId: singleId });
        const staffIdentifier = existingStaff?.staffId || singleId;
        if (staffIdentifier) {
          await deleteProfileImage('staff', staffIdentifier);
        }
        await staffService.deleteStaff(singleId);
      }
      res.json({ message: 'Staff deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async reviseSalary(req, res, next) {
    try {
      const id = req.params.id;
      const { type, percentage, remarks, effectiveDate } = req.body;
      const userId = req.user?.id || req.user?._id;

      if (!type || !['INCREMENT', 'DECREMENT'].includes(type)) {
        return res.status(400).json({ message: 'Valid type (INCREMENT or DECREMENT) is required' });
      }

      const pct = Number(percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: 'Percentage must be between 0 and 100' });
      }

      const updatedStaff = await staffService.reviseSalary(id, {
        type,
        percentage: pct,
        remarks,
        effectiveDate,
        userId
      });

      res.json({
        message: `Salary ${type.toLowerCase()} of ${pct}% applied successfully`,
        staff: updatedStaff
      });
    } catch (err) {
      next(err);
    }
  }

  async getSalaryHistory(req, res, next) {
    try {
      const id = req.params.id;
      const history = await staffService.getSalaryHistory(id);
      res.json(history);
    } catch (err) {
      next(err);
    }
  }

  async getStaffIdSettings(req, res, next) {
    try {
      const settings = await staffService.getStaffIdSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  async updateStaffIdSettings(req, res, next) {
    try {
      const settings = await staffService.updateStaffIdSettings(req.body);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  async previewStaffId(req, res, next) {
    try {
      const { isTeaching, isNonTeaching, isSupportingStaff, joinDate } = req.query;
      const preview = await staffService.previewStaffId({
        isTeaching: isTeaching === 'true',
        isNonTeaching: isNonTeaching === 'true',
        isSupportingStaff: isSupportingStaff === 'true',
        joinDate: joinDate || req.query.joinDate
      });
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StaffController();
