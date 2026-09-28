const mongoose = require('mongoose');

// FinanceIncome
const FinanceIncomeSchema = new mongoose.Schema({
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  category: { type: String, required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  walletName: { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
  source: { type: String, default: '' }
}, { timestamps: true });

FinanceIncomeSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FinanceIncomeSchema.set('toJSON', { virtuals: true });
FinanceIncomeSchema.set('toObject', { virtuals: true });

// FinanceExpense
const FinanceExpenseSchema = new mongoose.Schema({
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  category: { type: String, required: true },
  subCategory: { type: String, default: '' },
  description: { type: String, default: '' },
  amount: { type: Number, required: true },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  walletName: { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'PENDING', 'APPROVED', 'REJECTED'],
    default: 'Pending'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedByName: { type: String, default: '' },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedByName: { type: String, default: '' },
  rejectedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: '' },
  notes: { type: String, default: '' },
  source: { type: String, default: '' }
}, { timestamps: true });

FinanceExpenseSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FinanceExpenseSchema.set('toJSON', { virtuals: true });
FinanceExpenseSchema.set('toObject', { virtuals: true });

// FinanceClosing - Holdings Checkpoint & Audit
const FinanceClosingSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  closingDateTime: { type: Date, default: Date.now },
  type: { type: String, default: 'HOLDINGS_CHECKPOINT' },
  previousClosingDate: { type: Date, default: null },
  previousClosingId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceClosing', default: null },
  totalHolding: { type: Number, default: 0 },
  totalInflows: { type: Number, default: 0 },
  totalOutflows: { type: Number, default: 0 },
  netChange: { type: Number, default: 0 },
  walletsSnapshot: [{
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
    walletName: { type: String, default: '' },
    walletType: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    balanceBefore: { type: Number, default: 0 },
    inflowsSinceLastClosing: { type: Number, default: 0 },
    outflowsSinceLastClosing: { type: Number, default: 0 },
    netChange: { type: Number, default: 0 },
    balanceAtClosing: { type: Number, default: 0 },
  }],
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedByName: { type: String, default: 'System' },
  remarks: { type: String, default: '' },
  totalIncome: { type: Number, default: 0 },
  totalExpense: { type: Number, default: 0 },
  incomeCount: { type: Number, default: 0 },
  expenseCount: { type: Number, default: 0 }
}, { timestamps: true });

FinanceClosingSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FinanceClosingSchema.set('toJSON', { virtuals: true });
FinanceClosingSchema.set('toObject', { virtuals: true });

const FinanceIncome = mongoose.model('FinanceIncome', FinanceIncomeSchema);
const FinanceExpense = mongoose.model('FinanceExpense', FinanceExpenseSchema);
const FinanceClosing = mongoose.model('FinanceClosing', FinanceClosingSchema);

module.exports = {
  FinanceIncome,
  FinanceExpense,
  FinanceClosing
};
