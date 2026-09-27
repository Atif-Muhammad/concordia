const inventoryService = require('../services/inventory.service');

class InventoryController {
  // Items
  async getItems(req, res, next) {
    try {
      const items = await inventoryService.getItems();
      res.json(items);
    } catch (err) {
      next(err);
    }
  }

  async getItemById(req, res, next) {
    try {
      const item = await inventoryService.getItemById(req.params.id);
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async createItem(req, res, next) {
    try {
      const item = await inventoryService.createItem(req.body, req.user?.id || req.user?._id);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }

  async updateItem(req, res, next) {
    try {
      const item = await inventoryService.updateItem(req.params.id, req.body, req.user?.id || req.user?._id);
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async deleteItem(req, res, next) {
    try {
      await inventoryService.deleteItem(req.params.id, req.user?.id || req.user?._id);
      res.json({ message: 'Item deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Expenses
  async getExpenses(req, res, next) {
    try {
      const expenses = await inventoryService.getExpenses();
      res.json(expenses);
    } catch (err) {
      next(err);
    }
  }

  async getExpensesByItem(req, res, next) {
    try {
      const expenses = await inventoryService.getExpensesByItem(req.params.itemId);
      res.json(expenses);
    } catch (err) {
      next(err);
    }
  }

  async createExpense(req, res, next) {
    try {
      const expense = await inventoryService.createExpense(req.body, req.user?.id || req.user?._id);
      res.status(201).json(expense);
    } catch (err) {
      next(err);
    }
  }

  async updateExpense(req, res, next) {
    try {
      const expense = await inventoryService.updateExpense(req.params.id, req.body, req.user?.id || req.user?._id);
      res.json(expense);
    } catch (err) {
      next(err);
    }
  }

  async deleteExpense(req, res, next) {
    try {
      await inventoryService.deleteExpense(req.params.id, req.user?.id || req.user?._id);
      res.json({ message: 'Expense deleted' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InventoryController();
