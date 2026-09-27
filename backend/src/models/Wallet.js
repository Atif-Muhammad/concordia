const mongoose = require('mongoose');

// Wallet / Treasury Account Schema
const WalletSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['BANK', 'DIGITAL_WALLET', 'CASH'],
    required: true,
  },
  // Bank fields
  bankName: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  accountTitle: { type: String, default: '' },
  branchCode: { type: String, default: '' },
  iban: { type: String, default: '' },

  // Digital Wallet fields
  provider: {
    type: String,
    default: '',
  },

  // Cash / Safe fields
  location: { type: String, default: '' },
  custodian: { type: String, default: '' },

  // Balances
  openingDebit: { type: Number, default: 0 },
  openingCredit: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

WalletSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
WalletSchema.set('toJSON', { virtuals: true });
WalletSchema.set('toObject', { virtuals: true });

// Wallet Transaction & Audit Log Schema
const WalletTransactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['OPENING_BALANCE', 'WALLET_CREATED', 'WALLET_UPDATED', 'DEPOSIT', 'CONTRA_TRANSFER', 'PAYROLL', 'FEE', 'EXPENSE', 'HOSTEL_FEE', 'REVERSAL', 'FEE_REVERSAL', 'EXPENSE_REVERSAL', 'INCOME_REVERSAL'],
    required: true,
  },
  category: {
    type: String,
    enum: ['PAYROLL', 'FEE', 'EXPENSE', 'TRANSFER', 'DEPOSIT', 'OTHER', 'HOSTEL_FEE', 'HOSTEL_EXPENSE', 'HOSTEL_INVENTORY_EXPENSE', 'INVENTORY_ITEM_EXPENSE', 'INVENTORY_MANUAL_EXPENSE', 'INVENTORY_EXPENSE', 'REVERSAL', 'FEE_REVERSAL', 'EXPENSE_REVERSAL', 'INCOME_REVERSAL'],
    default: 'OTHER',
  },
  isReversal: { type: Boolean, default: false },
  sourceWallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  destinationWallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  amount: { type: Number, required: true },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  payrollMonth: { type: String, default: '' },
  staffCount: { type: Number, default: 0 },
  payrollIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' }],
  staffDetails: [{
    payrollId: { type: String },
    staffId: { type: String },
    name: { type: String },
    designation: { type: String },
    amount: { type: Number },
  }],
  // Hostel fee fields
  challanId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' },
  challanNumber: { type: String, default: '' },
  studentName: { type: String, default: '' },
  rollNumber: { type: String, default: '' },
  month: { type: String, default: '' },
  paymentMode: { type: String, default: '' },
  sourceCategory: { type: String, default: '' },
  referenceNo: { type: String, default: '' },
  description: { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: { type: String, default: 'System' },
  balanceAfterSource: { type: Number, default: null },
  balanceAfterDestination: { type: Number, default: null },
}, { timestamps: true, strict: false });

WalletTransactionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
WalletTransactionSchema.set('toJSON', { virtuals: true });
WalletTransactionSchema.set('toObject', { virtuals: true });

const Wallet = mongoose.model('Wallet', WalletSchema);
const WalletTransaction = mongoose.model('WalletTransaction', WalletTransactionSchema);

module.exports = {
  Wallet,
  WalletTransaction,
};
