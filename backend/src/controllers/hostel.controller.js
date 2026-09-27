const hostelService = require('../services/hostel.service');

class HostelController {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ROOMS & ALLOCATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getRooms(req, res, next) {
    try {
      const rooms = await hostelService.getRooms();
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  }

  async createRoom(req, res, next) {
    try {
      const room = await hostelService.createRoom(req.body);
      res.status(201).json(room);
    } catch (err) {
      next(err);
    }
  }

  async updateRoom(req, res, next) {
    try {
      const room = await hostelService.updateRoom(req.params.id, req.body);
      res.json(room);
    } catch (err) {
      next(err);
    }
  }

  async deleteRoom(req, res, next) {
    try {
      await hostelService.deleteRoom(req.params.id);
      res.json({ message: 'Room deleted' });
    } catch (err) {
      next(err);
    }
  }

  async allocateRoom(req, res, next) {
    try {
      const allocation = await hostelService.allocateRoom(req.body);
      res.status(201).json(allocation);
    } catch (err) {
      next(err);
    }
  }

  async deallocateStudent(req, res, next) {
    try {
      const result = await hostelService.deallocateStudent(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTRATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getRegistrations(req, res, next) {
    try {
      const result = await hostelService.getRegistrations(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async searchRegistrations(req, res, next) {
    try {
      const query = req.query.q || req.query.search || '';
      const result = await hostelService.searchRegistrations(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getRegistrationById(req, res, next) {
    try {
      const reg = await hostelService.getRegistrationById(req.params.id);
      res.json(reg);
    } catch (err) {
      next(err);
    }
  }

  async getRegistrationByStudent(req, res, next) {
    try {
      const reg = await hostelService.getRegistrationByStudent(req.params.studentId);
      res.json(reg);
    } catch (err) {
      next(err);
    }
  }

  async getRoomByStudent(req, res, next) {
    try {
      const room = await hostelService.getRoomByStudent(req.params.studentId);
      res.json(room);
    } catch (err) {
      next(err);
    }
  }

  async createRegistration(req, res, next) {
    try {
      const reg = await hostelService.createRegistration(req.body);
      res.status(201).json(reg);
    } catch (err) {
      next(err);
    }
  }

  async updateRegistration(req, res, next) {
    try {
      const reg = await hostelService.updateRegistration(req.params.id, req.body);
      res.json(reg);
    } catch (err) {
      next(err);
    }
  }

  async deleteRegistration(req, res, next) {
    try {
      await hostelService.deleteRegistration(req.params.id);
      res.json({ message: 'Registration deleted' });
    } catch (err) {
      next(err);
    }
  }

  async terminate(req, res, next) {
    try {
      const reg = await hostelService.changeRegistrationStatus(req.params.id, 'terminated', req.body.reason);
      res.json(reg);
    } catch (err) {
      next(err);
    }
  }

  async withdraw(req, res, next) {
    try {
      const reg = await hostelService.changeRegistrationStatus(req.params.id, 'withdrawn', req.body.reason);
      res.json(reg);
    } catch (err) {
      next(err);
    }
  }

  async readmit(req, res, next) {
    try {
      const reg = await hostelService.changeRegistrationStatus(req.params.id, 'active', 'Readmitted');
      res.json(reg);
    } catch (err) {
      next(err);
    }
  }

  async getRegistrationHistory(req, res, next) {
    try {
      const history = await hostelService.getRegistrationHistory(req.params.id);
      res.json(history);
    } catch (err) {
      next(err);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EXPENSES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getExpenses(req, res, next) {
    try {
      const expenses = await hostelService.getExpenses(req.query);
      res.json(expenses);
    } catch (err) {
      next(err);
    }
  }

  async createExpense(req, res, next) {
    try {
      const expense = await hostelService.createExpense(req.body, req.user?.id || req.user?._id);
      res.status(201).json(expense);
    } catch (err) {
      next(err);
    }
  }

  async updateExpense(req, res, next) {
    try {
      const expense = await hostelService.updateExpense(req.params.id, req.body, req.user?.id || req.user?._id);
      res.json(expense);
    } catch (err) {
      next(err);
    }
  }

  async deleteExpense(req, res, next) {
    try {
      await hostelService.deleteExpense(req.params.id, req.user?.id || req.user?._id);
      res.json({ message: 'Expense deleted' });
    } catch (err) {
      next(err);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INVENTORY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getInventory(req, res, next) {
    try {
      const items = await hostelService.getInventory();
      res.json(items);
    } catch (err) {
      next(err);
    }
  }

  async createInventory(req, res, next) {
    try {
      const item = await hostelService.createInventory(req.body, req.user?.id || req.user?._id);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }

  async updateInventory(req, res, next) {
    try {
      const item = await hostelService.updateInventory(req.params.id, req.body, req.user?.id || req.user?._id);
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async deleteInventory(req, res, next) {
    try {
      await hostelService.deleteInventory(req.params.id, req.user?.id || req.user?._id);
      res.json({ message: 'Item deleted' });
    } catch (err) {
      next(err);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHALLANS & PAYMENTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getChallans(req, res, next) {
    try {
      const filters = {
        ...req.query,
        registrationId: req.params.registrationId || req.query.registrationId
      };
      const result = await hostelService.getChallans(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async createChallan(req, res, next) {
    try {
      const challan = await hostelService.createChallan(req.body);
      res.status(201).json(challan);
    } catch (err) {
      next(err);
    }
  }

  async updateChallan(req, res, next) {
    try {
      const challan = await hostelService.updateChallan(req.params.id, req.body || {});
      res.json(challan);
    } catch (err) {
      next(err);
    }
  }

  async deleteChallan(req, res, next) {
    try {
      await hostelService.deleteChallan(req.params.id, req.user?.id || req.user?._id);
      res.json({ message: 'Challan deleted' });
    } catch (err) {
      next(err);
    }
  }

  async printChallan(req, res, next) {
    try {
      const result = await hostelService.getChallans({ search: req.params.id });
      res.json(result.data?.[0] || result);
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req, res, next) {
    try {
      const id = req.params.challanId || req.params.id;
      const payment = await hostelService.recordPayment(id, req.body, req.user?.id || req.user?._id);
      res.json(payment);
    } catch (err) {
      next(err);
    }
  }

  async getRegistrationCredit(req, res, next) {
    try {
      const regId = req.params.registrationId || req.params.id;
      const credit = await hostelService.getRegistrationCredit(regId);
      res.json(credit);
    } catch (err) {
      next(err);
    }
  }

  async getRegistrationPayments(req, res, next) {
    try {
      const payments = await hostelService.getRegistrationPayments(req.params.registrationId);
      res.json(payments);
    } catch (err) {
      next(err);
    }
  }

  async createRegistrationPayment(req, res, next) {
    try {
      const payment = await hostelService.createRegistrationPayment(req.params.registrationId, req.body);
      res.status(201).json(payment);
    } catch (err) {
      next(err);
    }
  }

  async deleteRegistrationPayment(req, res, next) {
    try {
      const result = await hostelService.deleteRegistrationPayment(
        req.params.registrationId,
        req.params.paymentId,
        req.user?.id || req.user?._id
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REVENUE & ANALYTICS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getRevenue(req, res, next) {
    try {
      const report = await hostelService.getRevenueReport(req.query);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  async getReportsAnalytics(req, res, next) {
    try {
      const analytics = await hostelService.getReportsAnalytics(req.query);
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new HostelController();
