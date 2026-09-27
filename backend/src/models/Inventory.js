const mongoose = require('mongoose');

// InventoryItem
const InventoryItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  totalValue: { type: Number, default: 0 },
  purchaseDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  supplier: { type: String, required: true },
  condition: { type: String, enum: ['New', 'Good', 'Fair', 'Needs Repair', 'Damaged'], default: 'New' },
  location: { type: String, required: true },
  assignedTo: { type: String, default: 'Unassigned' },
  assignedToName: { type: String, default: '' },
  assignedDate: { type: String },
  warrantyExpiry: { type: String, default: '' },
  description: { type: String, default: '' },
  isExpense: { type: Boolean, default: false },
  expenseAmount: { type: Number, default: 0 },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  walletName: { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
}, { timestamps: true });

InventoryItemSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
InventoryItemSchema.set('toJSON', { virtuals: true });
InventoryItemSchema.set('toObject', { virtuals: true });

// InventoryExpense
const InventoryExpenseSchema = new mongoose.Schema({
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  expenseType: { type: String, enum: ['Maintenance', 'Repair', 'Upgrade', 'Replacement', 'Other'], default: 'Maintenance' },
  amount: { type: Number, required: true },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  description: { type: String, default: '' },
  vendor: { type: String, default: '' },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  walletName: { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
}, { timestamps: true });

InventoryExpenseSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
InventoryExpenseSchema.set('toJSON', { virtuals: true });
InventoryExpenseSchema.set('toObject', { virtuals: true });

const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);
const InventoryExpense = mongoose.model('InventoryExpense', InventoryExpenseSchema);

module.exports = {
  InventoryItem,
  InventoryExpense
};
