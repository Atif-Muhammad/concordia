const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authMiddleware } = require('../middlewares/auth');

// Items
router.get('/items', inventoryController.getItems);
router.get('/items/:id', inventoryController.getItemById);
router.post('/items', authMiddleware, inventoryController.createItem);
router.patch('/items/:id', authMiddleware, inventoryController.updateItem);
router.delete('/items/:id', authMiddleware, inventoryController.deleteItem);

// Expenses
router.get('/expenses', inventoryController.getExpenses);
router.get('/expenses/item/:itemId', inventoryController.getExpensesByItem);
router.post('/expenses', authMiddleware, inventoryController.createExpense);
router.patch('/expenses/:id', authMiddleware, inventoryController.updateExpense);
router.delete('/expenses/:id', authMiddleware, inventoryController.deleteExpense);

module.exports = router;
