const financeService = require('../services/finance.service');

class FinanceController {
  // Income
  async getIncomes(req, res, next) {
    try {
      const incomes = await financeService.getIncomes(req.query);
      res.json(incomes);
    } catch (err) {
      next(err);
    }
  }

  async createIncome(req, res, next) {
    try {
      const income = await financeService.createIncome(req.body, req.user?.id || req.user?._id);
      res.status(201).json(income);
    } catch (err) {
      next(err);
    }
  }

  async deleteIncome(req, res, next) {
    try {
      await financeService.deleteIncome(req.params.id, req.user?.id || req.user?._id);
      res.json({ message: 'Income deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Expense
  async getExpenses(req, res, next) {
    try {
      const expenses = await financeService.getExpenses(req.query);
      res.json(expenses);
    } catch (err) {
      next(err);
    }
  }

  async createExpense(req, res, next) {
    try {
      const expense = await financeService.createExpense(
        req.body,
        req.user?.id || req.user?._id,
        req.user?.name
      );
      res.status(201).json(expense);
    } catch (err) {
      next(err);
    }
  }

  async deleteExpense(req, res, next) {
    try {
      await financeService.deleteExpense(req.params.id, req.user?.id || req.user?._id);
      res.json({ message: 'Expense deleted' });
    } catch (err) {
      next(err);
    }
  }

  async approveExpense(req, res, next) {
    try {
      const expense = await financeService.approveExpense(
        req.params.id,
        req.user?.id || req.user?._id,
        req.body?.walletId,
        req.user?.name
      );
      res.json(expense);
    } catch (err) {
      next(err);
    }
  }

  async rejectExpense(req, res, next) {
    try {
      const expense = await financeService.rejectExpense(
        req.params.id,
        req.user?.id || req.user?._id,
        req.body?.rejectionReason,
        req.user?.name
      );
      res.json(expense);
    } catch (err) {
      next(err);
    }
  }

  // Closings & Holdings Checkpoint
  async getClosingDashboard(req, res, next) {
    try {
      const dashboard = await financeService.getClosingDashboard();
      res.json(dashboard);
    } catch (err) {
      next(err);
    }
  }

  async getClosings(req, res, next) {
    try {
      const closings = await financeService.getClosings(req.query);
      res.json(closings);
    } catch (err) {
      next(err);
    }
  }

  async createClosing(req, res, next) {
    try {
      const closing = await financeService.createClosing(req.body, req.user?.id || req.user?._id);
      res.status(201).json(closing);
    } catch (err) {
      next(err);
    }
  }

  async updateClosing(req, res, next) {
    try {
      const closing = await financeService.updateClosing(req.params.id, req.body);
      res.json(closing);
    } catch (err) {
      next(err);
    }
  }

  async deleteClosing(req, res, next) {
    try {
      await financeService.deleteClosing(req.params.id);
      res.json({ message: 'Closing deleted' });
    } catch (err) {
      next(err);
    }
  }

  async getFinanceLedger(req, res, next) {
    try {
      const result = await financeService.getFinanceLedger(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getAnalytics(req, res, next) {
    try {
      const analytics = await financeService.getAnalytics(req.query);
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FinanceController();
