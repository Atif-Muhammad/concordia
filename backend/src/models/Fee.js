const mongoose = require('mongoose');

// FeeHead
const FeeHeadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['monthly', 'annual', 'one-time', 'custom'], default: 'monthly' },
  isTuition: { type: Boolean, default: false },
  isFine: { type: Boolean, default: false },
  isLabFee: { type: Boolean, default: false },
  isLibraryFee: { type: Boolean, default: false },
  isRegistrationFee: { type: Boolean, default: false },
  isAdmissionFee: { type: Boolean, default: false },
  isProspectusFee: { type: Boolean, default: false },
  isExaminationFee: { type: Boolean, default: false },
  isAlliedCharges: { type: Boolean, default: false },
  isHostelFee: { type: Boolean, default: false },
  isOther: { type: Boolean, default: false }
}, { timestamps: true });

FeeHeadSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FeeHeadSchema.set('toJSON', { virtuals: true });
FeeHeadSchema.set('toObject', { virtuals: true });

// FeeStructure
const FeeStructureSchema = new mongoose.Schema({
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  feeHeads: [{
    headId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeHead' },
    amount: { type: Number, default: 0 }
  }],
  totalAmount: { type: Number, required: true },
  installments: { type: Number, default: 1 }
}, { timestamps: true });

FeeStructureSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FeeStructureSchema.virtual('program', {
  ref: 'Program',
  localField: 'programId',
  foreignField: '_id',
  justOne: true
});
FeeStructureSchema.virtual('class', {
  ref: 'Class',
  localField: 'classId',
  foreignField: '_id',
  justOne: true
});
FeeStructureSchema.set('toJSON', { virtuals: true });
FeeStructureSchema.set('toObject', { virtuals: true });

// ChallanFeeHead subdocument
const ChallanFeeHeadSchema = new mongoose.Schema({
  headId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeHead' },
  name: { type: String, required: true },
  category: { type: String, enum: ['monthly', 'annual', 'one-time', 'custom'], default: 'monthly' },
  amount: { type: Number, required: true, default: 0 },
  isCustom: { type: Boolean, default: false },
  appliedAt: { type: Date, default: Date.now }
}, { _id: true });

// ArrearAllocation subdocument
const ArrearAllocationSchema = new mongoose.Schema({
  sourceChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan', required: true },
  sourceChallanNo: { type: String, required: true },
  sourceInstallmentNumber: { type: Number },
  sourceMonth: { type: String },
  originalDueAmount: { type: Number, required: true, default: 0 },
  amountCarriedForward: { type: Number, required: true, default: 0 },
  amountSettled: { type: Number, default: 0 }
}, { _id: true });

// FeeChallan / FeeInstallment
const FeeChallanSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  challanNo: { type: String, required: true, unique: true },
  installmentNumber: { type: Number, default: 1 },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  fineAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'VOID', 'SUPERSEDED', 'SETTLED'],
    default: 'PENDING'
  },
  paidDate: { type: Date },
  paidTime: { type: String },
  paidBy: { type: String, default: 'Cash' },
  month: { type: String },
  session: { type: String },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  installmentId: { type: mongoose.Schema.Types.ObjectId },
  
  // Explicit itemized breakdown
  basePayable: { type: Number },
  challanHeads: [ChallanFeeHeadSchema],
  headsAmount: { type: Number, default: 0 },
  arrearsAmount: { type: Number, default: 0 },
  lateFeeAmount: { type: Number, default: 0 },
  grossAmount: { type: Number },
  discountAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  advanceApplied: { type: Number, default: 0 },
  netPayable: { type: Number },
  totalAmount: { type: Number },
  
  // Provenance Chains
  arrearAllocations: [ArrearAllocationSchema],
  supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan' },
  supersedes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan' }],
  settledViaArrearsAmount: { type: Number, default: 0 },
  settledByChallanNo: { type: String, default: '' },
  settledByChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan' },

  // Advance Payment Provenance Chains
  advanceAllocations: [{
    sourceChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan' },
    sourceChallanNo: { type: String },
    sourceMonth: { type: String },
    amountApplied: { type: Number, default: 0 },
    appliedAt: { type: Date, default: Date.now }
  }],
  advanceFromChallanNo: { type: String, default: '' },
  advanceFromChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan' },
  advanceFromMonth: { type: String, default: '' },
  excessCreditGenerated: { type: Number, default: 0 },

  selectedHeads: [{ type: mongoose.Schema.Types.Mixed }],
  absenteeCount: { type: Number, default: 0 },
  absenteeFineAmount: { type: Number, default: 0 },
  absenteeMonth: { type: String, default: '' },
  absenteeRate: { type: Number, default: 50 },
  remarks: { type: String, default: '' },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  walletName: { type: String }
}, { timestamps: true });

FeeChallanSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FeeChallanSchema.set('toJSON', { virtuals: true });
FeeChallanSchema.set('toObject', { virtuals: true });

// ExtraChallan
const ExtraChallanSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  challanNo: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  heads: [{
    headId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeHead' },
    name: { type: String },
    amount: { type: Number }
  }],
  paidAmount: { type: Number, default: 0 },
  lateFeeFine: { type: Number, default: 0 },
  totalAmount: { type: Number },
  discount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'VOID'],
    default: 'PENDING'
  },
  paidDate: { type: Date },
  paidBy: { type: String, default: 'Cash' },
  remarks: { type: String, default: '' },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  walletName: { type: String }
}, { timestamps: true });

ExtraChallanSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ExtraChallanSchema.set('toJSON', { virtuals: true });
ExtraChallanSchema.set('toObject', { virtuals: true });

// StudentCreditLedger (Advance Payments Ledger)
const StudentCreditLedgerSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  sourceChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan' },
  sourceChallanNo: { type: String },
  amount: { type: Number, required: true },
  remainingAmount: { type: Number, required: true },
  status: { type: String, enum: ['AVAILABLE', 'EXHAUSTED', 'REFUNDED'], default: 'AVAILABLE' },
  allocations: [{
    targetChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan' },
    targetChallanNo: { type: String },
    amountApplied: { type: Number, required: true },
    appliedAt: { type: Date, default: Date.now }
  }],
  notes: { type: String, default: '' }
}, { timestamps: true });

StudentCreditLedgerSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
StudentCreditLedgerSchema.set('toJSON', { virtuals: true });
StudentCreditLedgerSchema.set('toObject', { virtuals: true });

// FeePaymentReceipt (Itemized payment transaction history)
const FeePaymentReceiptSchema = new mongoose.Schema({
  receiptNo: { type: String, required: true, unique: true },
  challanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  amountPaid: { type: Number, required: true },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  paymentMode: { type: String, default: 'Cash' },
  paidDate: { type: Date, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  allocatedToArrears: { type: Number, default: 0 },
  allocatedToLateFee: { type: Number, default: 0 },
  allocatedToHeads: { type: Number, default: 0 },
  allocatedToTuition: { type: Number, default: 0 },
  excessCredited: { type: Number, default: 0 },
  advanceCreditUsed: { type: Number, default: 0 },
  remarks: { type: String, default: '' }
}, { timestamps: true });

FeePaymentReceiptSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FeePaymentReceiptSchema.set('toJSON', { virtuals: true });
FeePaymentReceiptSchema.set('toObject', { virtuals: true });

// FeeSettings
const FeeSettingsSchema = new mongoose.Schema({
  lateFeeRatePerDay: { type: Number, default: 0 },
  lateFeeFinePerDay: { type: Number, default: 0 },
  absenteeFinePerSubject: { type: Number, default: 50 },
  extraChallanLateFee: { type: Number, default: 0 },
  challanPrefix: { type: String, default: 'CH-' },
  defaultDueDays: { type: Number, default: 10 },
  bankName: { type: String, default: 'United Bank Limited' },
  accountNumber: { type: String, default: '' },
  accountTitle: { type: String, default: 'Concordia College' }
}, { timestamps: true });

FeeSettingsSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FeeSettingsSchema.set('toJSON', { virtuals: true });
FeeSettingsSchema.set('toObject', { virtuals: true });

const FeeHead = mongoose.model('FeeHead', FeeHeadSchema);
const FeeStructure = mongoose.model('FeeStructure', FeeStructureSchema);
const FeeChallan = mongoose.model('FeeChallan', FeeChallanSchema);
const ExtraChallan = mongoose.model('ExtraChallan', ExtraChallanSchema);
const StudentCreditLedger = mongoose.model('StudentCreditLedger', StudentCreditLedgerSchema);
const FeePaymentReceipt = mongoose.model('FeePaymentReceipt', FeePaymentReceiptSchema);
const FeeSettings = mongoose.model('FeeSettings', FeeSettingsSchema);

module.exports = {
  FeeHead,
  FeeStructure,
  FeeChallan,
  ExtraChallan,
  StudentCreditLedger,
  FeePaymentReceipt,
  FeeSettings
};
