const feeService = require('../services/fee.service');

class FeeController {
  // Heads
  async getHeads(req, res, next) {
    try {
      const heads = await feeService.getHeads();
      res.json(heads);
    } catch (err) {
      next(err);
    }
  }

  async createHead(req, res, next) {
    try {
      const head = await feeService.createHead(req.body);
      res.status(201).json(head);
    } catch (err) {
      next(err);
    }
  }

  async updateHead(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const head = await feeService.updateHead(id, req.body);
      res.json(head);
    } catch (err) {
      next(err);
    }
  }

  async deleteHead(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await feeService.deleteHead(id);
      res.json({ message: 'Fee head deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Structures
  async getStructures(req, res, next) {
    try {
      const structures = await feeService.getStructures();
      res.json(structures);
    } catch (err) {
      next(err);
    }
  }

  async createStructure(req, res, next) {
    try {
      const structure = await feeService.createStructure(req.body);
      res.status(201).json(structure);
    } catch (err) {
      next(err);
    }
  }

  async updateStructure(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const structure = await feeService.updateStructure(id, req.body);
      res.json(structure);
    } catch (err) {
      next(err);
    }
  }

  async deleteStructure(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await feeService.deleteStructure(id);
      res.json({ message: 'Fee structure deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Challans
  async getChallans(req, res, next) {
    try {
      const challans = await feeService.getChallans(req.query);
      res.json(challans);
    } catch (err) {
      next(err);
    }
  }

  async getChallanById(req, res, next) {
    try {
      const challan = await feeService.getChallanById(req.params.id);
      res.json(challan);
    } catch (err) {
      next(err);
    }
  }

  async createChallan(req, res, next) {
    try {
      const challan = await feeService.createChallan(req.body);
      res.status(201).json(challan);
    } catch (err) {
      next(err);
    }
  }

  async updateChallan(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const challan = await feeService.updateChallan(id, req.body);
      res.json(challan);
    } catch (err) {
      next(err);
    }
  }

  async deleteChallan(req, res, next) {
    try {
      const id = req.query.id || req.params.id || req.body?.id;
      const userId = req.user?.id || req.user?._id;
      await feeService.deleteChallan(id, userId);
      res.json({ message: 'Challan deleted' });
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req, res, next) {
    try {
      const payload = {
        ...req.body,
        challanId: req.body.challanId || req.params.id || req.body.id,
      };
      const userId = req.user?.id || req.user?._id;
      const payment = await feeService.recordPayment(payload, userId);
      res.json(payment);
    } catch (err) {
      next(err);
    }
  }

  // Extra Challans
  async getExtraChallans(req, res, next) {
    try {
      const challans = await feeService.getExtraChallans(req.query);
      res.json(challans);
    } catch (err) {
      next(err);
    }
  }

  async createExtraChallan(req, res, next) {
    try {
      const challan = await feeService.createExtraChallan(req.body);
      res.status(201).json(challan);
    } catch (err) {
      next(err);
    }
  }

  async updateExtraChallan(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const challan = await feeService.updateExtraChallan(id, req.body);
      res.json(challan);
    } catch (err) {
      next(err);
    }
  }

  async deleteExtraChallan(req, res, next) {
    try {
      const id = req.query.id || req.params.id || req.body?.id;
      const userId = req.user?.id || req.user?._id;
      await feeService.deleteExtraChallan(id, userId);
      res.json({ message: 'Extra challan deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Settings
  async getSettings(req, res, next) {
    try {
      const settings = await feeService.getSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const settings = await feeService.updateSettings(req.body);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  // Analytics & Reports
  async getFeeReportsAnalytics(req, res, next) {
    try {
      const analytics = await feeService.getFeeReportsAnalytics(req.query);
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  }

  async getFeeReportSummary(req, res, next) {
    try {
      const summary = await feeService.getFeeReportSummary(req.query);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }

  async getRevenueOverTime(req, res, next) {
    try {
      const data = await feeService.getRevenueOverTime(req.query);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getClassStats(req, res, next) {
    try {
      const stats = await feeService.getClassStats(req.query);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }

  async getAnalytics(req, res, next) {
    try {
      const analytics = await feeService.getAnalytics(req.query);
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  }

  // Installment Plans & Bulk Challans
  async getInstallmentPlans(req, res, next) {
    try {
      const plans = await feeService.getInstallmentPlans(req.query);
      res.json(plans);
    } catch (err) {
      next(err);
    }
  }

  async bulkGenerateChallans(req, res, next) {
    try {
      const result = await feeService.bulkGenerateChallans(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getStudentCreditBalance(req, res, next) {
    try {
      const studentId = req.params.studentId || req.query.studentId;
      const credit = await feeService.getStudentCreditBalance(studentId);
      res.json(credit);
    } catch (err) {
      next(err);
    }
  }

  async getChallanReceipts(req, res, next) {
    try {
      const challanId = req.params.challanId || req.query.challanId;
      const receipts = await feeService.getChallanReceipts(challanId);
      res.json(receipts);
    } catch (err) {
      next(err);
    }
  }

  async getStudentInstallments(req, res, next) {
    try {
      const studentId = req.params.studentId || req.query.studentId;
      const installments = await feeService.getStudentInstallments(studentId);
      res.json(installments);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FeeController();
