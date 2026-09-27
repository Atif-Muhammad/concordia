const mongoose = require('mongoose');

// PayrollTemplate
const PayrollTemplateSchema = new mongoose.Schema({
  title: { type: String, required: false },
  name: { type: String },
  type: { type: String },
  htmlContent: { type: String },
  isDefault: { type: Boolean, default: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  basicSalary: { type: Number, default: 0 },
  allowances: [{
    name: { type: String, required: true },
    amount: { type: Number, required: true }
  }],
  deductions: [{
    name: { type: String, required: true },
    amount: { type: Number, required: true }
  }]
}, { timestamps: true });

PayrollTemplateSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
PayrollTemplateSchema.set('toJSON', { virtuals: true });
PayrollTemplateSchema.set('toObject', { virtuals: true });

// Payroll
const PayrollSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  month: { type: String, required: true }, // YYYY-MM
  basicSalary: { type: Number, required: true },
  baseSalary: { type: Number, default: 0 },
  currentSalary: { type: Number, default: 0 },
  totalAllowances: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netSalary: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  absentCount: { type: Number, default: 0 },
  absentRate: { type: Number, default: 0 },
  allowanceBreakdown: [{ name: String, amount: Number }],
  deductionBreakdown: [{ name: String, amount: Number }],
  advanceDeduction: { type: Number, default: 0 },
  leaveDeduction: { type: Number, default: 0 },
  absentDeduction: { type: Number, default: 0 },
  securityDeduction: { type: Number, default: 0 },
  incomeTax: { type: Number, default: 0 },
  eobi: { type: Number, default: 0 },
  lateArrivalDeduction: { type: Number, default: 0 },
  otherDeduction: { type: Number, default: 0 },
  travelAllowance: { type: Number, default: 0 },
  houseRentAllowance: { type: Number, default: 0 },
  medicalAllowance: { type: Number, default: 0 },
  extraAllowance: { type: Number, default: 0 },
  insuranceAllowance: { type: Number, default: 0 },
  otherAllowance: { type: Number, default: 0 },
  status: { type: String, enum: ['PENDING', 'PAID', 'UNPAID', 'partially_paid', 'PARTIALLY_PAID'], default: 'PENDING' },
  paymentDate: { type: Date },
  paidBy: { type: String, default: 'Cash' },
  paidFromWallet: {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
    walletName: { type: String, default: '' },
    walletType: { type: String, default: '' }
  },
  remarks: { type: String, default: '' },
  payments: [{
    id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    amount: { type: Number, required: true },
    paidBy: { type: String, default: 'Cash' },
    paymentMethod: { type: String, default: 'Cash' },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
    walletName: { type: String, default: '' },
    paymentDate: { type: String },
    paidAt: { type: Date, default: Date.now },
    paidByName: { type: String, default: 'Admin' },
    remarks: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    chequeNumber: { type: String, default: '' }
  }]
}, { timestamps: true, strict: false });

PayrollSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
PayrollSchema.set('toJSON', { virtuals: true });
PayrollSchema.set('toObject', { virtuals: true });

// AdvanceSalary
const AdvanceSalarySchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  amount: { type: Number, required: true },
  requestDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  releaseDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  deductionMonth: { type: String, required: true }, // YYYY-MM
  reason: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'DEDUCTED', 'ADJUSTED'], default: 'PENDING' },
  adjusted: { type: Boolean, default: false },
  adjustedSource: { type: String, default: '' },
  actionAudit: [{
    action: { type: String },
    byName: { type: String },
    month: { type: String },
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true, strict: false });

AdvanceSalarySchema.virtual('id').get(function () {
  return this._id.toHexString();
});
AdvanceSalarySchema.set('toJSON', { virtuals: true });
AdvanceSalarySchema.set('toObject', { virtuals: true });

// PayrollSettings
const PayrollSettingsSchema = new mongoose.Schema({
  defaultEobi: { type: Number, default: 0 },
  defaultTaxPercentage: { type: Number, default: 0 },
  salaryDisbursementDay: { type: Number, default: 1 },
  absentDeductionAmount: { type: Number, default: 0 },
  defaultAbsentDeduction: { type: Number, default: 0 }
}, { timestamps: true });

PayrollSettingsSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
PayrollSettingsSchema.set('toJSON', { virtuals: true });
PayrollSettingsSchema.set('toObject', { virtuals: true });

const PayrollTemplate = mongoose.model('PayrollTemplate', PayrollTemplateSchema);
const Payroll = mongoose.model('Payroll', PayrollSchema);
const AdvanceSalary = mongoose.model('AdvanceSalary', AdvanceSalarySchema);
const PayrollSettings = mongoose.model('PayrollSettings', PayrollSettingsSchema);

module.exports = {
  PayrollTemplate,
  Payroll,
  AdvanceSalary,
  PayrollSettings
};
