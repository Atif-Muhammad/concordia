const hrService = require('../services/hr.service');

class HrController {
  // Settings
  async getSettings(req, res, next) {
    try {
      const settings = await hrService.getPayrollSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const settings = await hrService.updatePayrollSettings(req.body);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  // Templates
  async getTemplates(req, res, next) {
    try {
      const templates = await hrService.getTemplates();
      res.json(templates);
    } catch (err) {
      next(err);
    }
  }

  async createTemplate(req, res, next) {
    try {
      const template = await hrService.createTemplate(req.body);
      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  }

  async updateTemplate(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const template = await hrService.updateTemplate(id, req.body);
      res.json(template);
    } catch (err) {
      next(err);
    }
  }

  async deleteTemplate(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await hrService.deleteTemplate(id);
      res.json({ message: 'Template deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Payroll
  async getPayrollSheet(req, res, next) {
    try {
      const { month, type, role } = req.query;
      const sheet = await hrService.getPayrollSheet(month, type || role || 'all');
      res.json(sheet);
    } catch (err) {
      next(err);
    }
  }

  async getMissingPayrollStaff(req, res, next) {
    try {
      const { month, type, role } = req.query;
      const staff = await hrService.getMissingPayrollStaff(month, type || role || 'all');
      res.json(staff);
    } catch (err) {
      next(err);
    }
  }

  async upsertPayroll(req, res, next) {
    try {
      const record = await hrService.upsertPayroll(req.body);
      res.json(record);
    } catch (err) {
      next(err);
    }
  }

  async getPayrollHistory(req, res, next) {
    try {
      const { staffId } = req.query;
      const history = await hrService.getPayrollHistory(staffId);
      res.json(history);
    } catch (err) {
      next(err);
    }
  }

  async generatePayroll(req, res, next) {
    try {
      const result = await hrService.generatePayroll(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req, res, next) {
    try {
      const { payrollId } = req.params;
      const record = await hrService.recordPayment(payrollId, req.body, req.user);
      res.json(record);
    } catch (err) {
      next(err);
    }
  }

  // Staff Leaves
  async getLeaveSheet(req, res, next) {
    try {
      const { month, type, role } = req.query;
      const records = await hrService.getLeaveSheet(month, type || role || 'all');
      res.json(records);
    } catch (err) {
      next(err);
    }
  }

  async upsertLeave(req, res, next) {
    try {
      const record = await hrService.upsertLeave(req.body, req.user);
      res.json(record);
    } catch (err) {
      next(err);
    }
  }

  async deleteStaffLeave(req, res, next) {
    try {
      const { id } = req.params;
      await hrService.deleteStaffLeave(id);
      res.json({ message: 'Leave record deleted' });
    } catch (err) {
      next(err);
    }
  }

  async updateStaffLeaveStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const record = await hrService.updateStaffLeaveStatus(id, status, req.user);
      res.json(record);
    } catch (err) {
      next(err);
    }
  }

  async toggleLockStaffLeave(req, res, next) {
    try {
      const { id } = req.params;
      const { locked } = req.body;
      const record = await hrService.toggleLockStaffLeave(id, locked, req.user);
      res.json(record);
    } catch (err) {
      next(err);
    }
  }

  // Advance Salary
  async getAdvance(req, res, next) {
    try {
      const advances = await hrService.getAdvances(req.query);
      res.json(advances);
    } catch (err) {
      next(err);
    }
  }

  async createAdvance(req, res, next) {
    try {
      const advance = await hrService.createAdvance(req.body);
      res.status(201).json(advance);
    } catch (err) {
      next(err);
    }
  }

  async updateAdvance(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const advance = await hrService.updateAdvance(id, req.body);
      res.json(advance);
    } catch (err) {
      next(err);
    }
  }

  async deleteAdvance(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await hrService.deleteAdvance(id);
      res.json({ message: 'Advance salary record deleted' });
    } catch (err) {
      next(err);
    }
  }

  async getAnalytics(req, res, next) {
    try {
      const analytics = await hrService.getAnalytics(req.query.month);
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new HrController();
