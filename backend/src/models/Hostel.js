const mongoose = require('mongoose');

// HostelRoom
const HostelRoomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true },
  capacity: { type: Number, required: true },
  currentOccupancy: { type: Number, default: 0 },
  type: { type: String, default: 'Double' },
  roomType: { type: String, default: 'Double' },
  hostelName: { type: String, default: 'Main Hostel' },
  feePerBed: { type: Number, default: 0 },
  description: { type: String, default: '' }
}, { timestamps: true });

HostelRoomSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
HostelRoomSchema.virtual('status').get(function () {
  return (this.currentOccupancy >= this.capacity) ? 'occupied' : 'vacant';
});
HostelRoomSchema.set('toJSON', { virtuals: true });
HostelRoomSchema.set('toObject', { virtuals: true });

// HostelAllocation
const HostelAllocationSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRoom', required: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRegistration' },
  studentId: { type: mongoose.Schema.Types.Mixed },
  externalName: { type: String, default: '' },
  allocationDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

HostelAllocationSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
HostelAllocationSchema.set('toJSON', { virtuals: true });
HostelAllocationSchema.set('toObject', { virtuals: true });

// HostelRegistration
const HostelRegistrationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  registrationType: { type: String, enum: ['internal', 'external'], default: 'internal' },
  externalName: { type: String, default: '' },
  externalInstitute: { type: String, default: '' },
  externalGuardianName: { type: String, default: '' },
  externalGuardianNumber: { type: String, default: '' },
  guardianCnic: { type: String, default: '' },
  studentCnic: { type: String, default: '' },
  address: { type: String, default: '' },
  decidedFeePerMonth: { type: Number, required: true },
  registrationDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRoom' },
  hostelName: { type: String, default: 'Main Hostel' },
  status: {
    type: String,
    enum: ['active', 'terminated', 'withdrawn', 'ACTIVE', 'TERMINATED', 'WITHDRAWN'],
    default: 'active',
    set: (v) => (v ? v.toLowerCase() : 'active')
  },
  terminationReason: { type: String, default: '' },
  history: [{
    action: { type: String },
    previousStatus: { type: String },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

HostelRegistrationSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
HostelRegistrationSchema.virtual('student').get(function () {
  return this.studentId && typeof this.studentId === 'object' && this.studentId._id ? this.studentId : null;
});
HostelRegistrationSchema.set('toJSON', { virtuals: true });
HostelRegistrationSchema.set('toObject', { virtuals: true });

// HostelExpense
const HostelExpenseSchema = new mongoose.Schema({
  title: { type: String },
  expenseTitle: { type: String },
  amount: { type: Number, required: true },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  category: { type: String, default: 'Mess/Food' },
  description: { type: String, default: '' },
  remarks: { type: String, default: '' },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  walletName: { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
}, { timestamps: true });

HostelExpenseSchema.pre('save', function () {
  if (!this.title && this.expenseTitle) this.title = this.expenseTitle;
  if (!this.expenseTitle && this.title) this.expenseTitle = this.title;
  if (!this.description && this.remarks) this.description = this.remarks;
  if (!this.remarks && this.description) this.remarks = this.description;
});

HostelExpenseSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
HostelExpenseSchema.set('toJSON', { virtuals: true });
HostelExpenseSchema.set('toObject', { virtuals: true });

// HostelInventory
const HostelInventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  category: { type: String, default: 'Furniture' },
  quantity: { type: Number, default: 1 },
  condition: { type: String, default: 'Good' },
  assignedRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRoom' },
  allocatedToRoom: { type: String, default: '' },
  hostelName: { type: String, default: 'Main Hostel' },
  description: { type: String, default: '' },
  isExpense: { type: Boolean, default: false },
  expenseAmount: { type: Number, default: 0 },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  walletName: { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
}, { timestamps: true });

HostelInventorySchema.virtual('id').get(function () {
  return this._id.toHexString();
});
HostelInventorySchema.set('toJSON', { virtuals: true });
HostelInventorySchema.set('toObject', { virtuals: true });

// HostelChallan
const HostelChallanPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now },
  paymentMethod: { type: String, default: 'Cash' },
  paidBy: { type: String, default: 'Cash' },
  remarks: { type: String, default: '' },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  walletName: { type: String, default: '' },
  walletType: { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
}, { _id: true });

const HostelChallanHeadSchema = new mongoose.Schema({
  feeHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeHead' },
  headName: { type: String, required: true },
  amount: { type: Number, required: true }
}, { _id: false });

const HostelChallanSchema = new mongoose.Schema({
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRegistration' },
  hostelRegistrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRegistration' },
  challanNo: { type: String, required: true, unique: true },
  challanNumber: { type: String },
  hostelRegNumber: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  hostelFee: { type: Number, default: 0 },
  heads: [HostelChallanHeadSchema],
  fineAmount: { type: Number, default: 0 },
  lateFeeFine: { type: Number, default: 0 },
  arrearsAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  dueDate: { type: Date, required: true },
  paidAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'SUPERSEDED', 'SETTLED', 'VOID'],
    default: 'PENDING'
  },
  paidDate: { type: Date },
  paidAt: { type: Date },
  paidBy: { type: String, default: 'Cash' },
  paymentMode: { type: String, default: 'Cash' },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  walletName: { type: String, default: '' },
  month: { type: String },
  numberOfMonths: { type: Number, default: 1 },
  advanceApplied: { type: Number, default: 0 },
  advanceFromChallanNo: { type: String, default: '' },
  advanceFromMonth: { type: String, default: '' },
  advanceFromChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' },
  advanceAllocations: [{
    sourceChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' },
    sourceChallanNo: { type: String, default: '' },
    sourceMonth: { type: String, default: '' },
    amountApplied: { type: Number, default: 0 }
  }],
  excessCreditGenerated: { type: Number, default: 0 },
  creditRemaining: { type: Number, default: 0 },
  creditAdjustedTo: [{
    targetChallanNo: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    month: { type: String, default: '' }
  }],
  remarks: { type: String, default: '' },
  supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' },
  supersedes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' }],
  settledViaArrearsAmount: { type: Number, default: 0 },
  settledByChallanNo: { type: String, default: '' },
  settledByChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' },
  settledByMonth: { type: String, default: '' },
  arrearAllocations: [{
    sourceChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' },
    sourceChallanNo: { type: String, default: '' },
    sourceMonth: { type: String, default: '' },
    originalDueAmount: { type: Number, default: 0 },
    amountCarriedForward: { type: Number, default: 0 },
    amountSettled: { type: Number, default: 0 }
  }],
  payments: [HostelChallanPaymentSchema]
}, { timestamps: true });

HostelChallanSchema.pre('save', function () {
  if (!this.registrationId && this.hostelRegistrationId) this.registrationId = this.hostelRegistrationId;
  if (!this.hostelRegistrationId && this.registrationId) this.hostelRegistrationId = this.registrationId;
  if (!this.challanNo && this.challanNumber) this.challanNo = this.challanNumber;
  if (!this.challanNumber && this.challanNo) this.challanNumber = this.challanNo;
  if (!this.amount && this.totalAmount) this.amount = this.totalAmount;
  if (!this.totalAmount && this.amount) this.totalAmount = this.amount;
  if (!this.paidDate && this.paidAt) this.paidDate = this.paidAt;
  if (!this.paidAt && this.paidDate) this.paidAt = this.paidDate;
  if (!this.paidBy && this.paymentMode) this.paidBy = this.paymentMode;
  if (!this.paymentMode && this.paidBy) this.paymentMode = this.paidBy;
  if (!this.challanNumber && this.challanNo) this.challanNumber = this.challanNo;
});

HostelChallanSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
HostelChallanSchema.virtual('hostelRegistration').get(function () {
  return this.registrationId && typeof this.registrationId === 'object' && this.registrationId._id ? this.registrationId : null;
});
HostelChallanSchema.virtual('student').get(function () {
  const reg = this.registrationId && typeof this.registrationId === 'object' ? this.registrationId : null;
  return reg && reg.studentId && typeof reg.studentId === 'object' && reg.studentId._id ? reg.studentId : null;
});
HostelChallanSchema.set('toJSON', { virtuals: true });
HostelChallanSchema.set('toObject', { virtuals: true });

// HostelCreditLedger (Advance Payments Tracking for Hostel)
const HostelCreditLedgerSchema = new mongoose.Schema({
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRegistration', required: true },
  studentId: { type: mongoose.Schema.Types.Mixed },
  sourceChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' },
  sourceChallanNo: { type: String, default: '' },
  sourceMonth: { type: String, default: '' },
  amount: { type: Number, required: true },
  availableBalance: { type: Number, required: true },
  status: { type: String, enum: ['AVAILABLE', 'CONSUMED', 'REFUNDED'], default: 'AVAILABLE' },
  allocations: [{
    targetChallanId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelChallan' },
    targetChallanNo: { type: String, default: '' },
    targetMonth: { type: String, default: '' },
    amountApplied: { type: Number, default: 0 },
    appliedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

HostelCreditLedgerSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
HostelCreditLedgerSchema.set('toJSON', { virtuals: true });
HostelCreditLedgerSchema.set('toObject', { virtuals: true });

const HostelRoom = mongoose.model('HostelRoom', HostelRoomSchema);
const HostelAllocation = mongoose.model('HostelAllocation', HostelAllocationSchema);
const HostelRegistration = mongoose.model('HostelRegistration', HostelRegistrationSchema);
const HostelExpense = mongoose.model('HostelExpense', HostelExpenseSchema);
const HostelInventory = mongoose.model('HostelInventory', HostelInventorySchema);
const HostelChallan = mongoose.model('HostelChallan', HostelChallanSchema);
const HostelCreditLedger = mongoose.model('HostelCreditLedger', HostelCreditLedgerSchema);

module.exports = {
  HostelRoom,
  HostelAllocation,
  HostelRegistration,
  HostelExpense,
  HostelInventory,
  HostelChallan,
  HostelCreditLedger
};
