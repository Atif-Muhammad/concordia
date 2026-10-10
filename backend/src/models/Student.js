const mongoose = require('mongoose');

const StudentInstallmentSchema = new mongoose.Schema({
  installmentNumber: { type: Number, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  month: { type: String },
  session: { type: String },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  basePayable: { type: Number },
  pendingAmount: { type: Number },
  totalAmount: { type: Number },
  lateFeeRatePerDay: { type: Number, default: 0 },
  challanGenerated: { type: Boolean, default: false },
  paidAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'VOID', 'SUPERSEDED', 'SETTLED'],
    default: 'PENDING'
  }
}, { _id: true });

const AcademicRecordSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  rollNumber: { type: String },
  session: { type: String },
  isCurrent: { type: Boolean, default: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  status: { type: String, default: 'ACTIVE' },
  reason: { type: String, default: '' },
}, { _id: true, timestamps: true });

const StatusHistorySchema = new mongoose.Schema({
  previousStatus: { type: String },
  newStatus: { type: String, required: true },
  action: { type: String },
  reason: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  details: { type: mongoose.Schema.Types.Mixed },
}, { _id: true, timestamps: true });

const StudentSchema = new mongoose.Schema({
  fName: { type: String, required: true },
  lName: { type: String, default: '' },
  fatherOrguardian: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  parentOrGuardianEmail: { type: String, default: '' },
  parentOrGuardianPhone: { type: String, required: true },
  parentCNIC: { type: String, default: '' },
  studentCnic: { type: String, default: '' },
  address: { type: String, default: '' },
  gender: { type: String, enum: ['Male', 'Female', 'Other', 'male', 'female', 'other'], required: true },
  religion: { type: String, default: 'Islam' },
  dob: { type: Date, required: true },
  admissionDate: { type: Date, default: Date.now },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  tuitionFee: { type: Number, default: 0 },
  advanceBalance: { type: Number, default: 0 },
  numberOfInstallments: { type: Number, default: 1 },
  lateFeeFine: { type: Number, default: 0 },
  installments: [StudentInstallmentSchema],
  academicRecords: [AcademicRecordSchema],
  statusHistory: [StatusHistorySchema],
  documents: { type: Map, of: Boolean, default: {} },
  admissionFormNumber: { type: String, default: '' },
  previousBoardName: { type: String, default: '' },
  previousBoardRollNumber: { type: String, default: '' },
  obtainedMarks: { type: Number },
  totalMarks: { type: Number },
  photo_url: { type: String, default: '' },
  passedOut: { type: Boolean, default: false },
  statusDate: { type: Date, default: Date.now },
  statusReason: { type: String, default: '' },
  graduationDate: { type: Date },
  status: {
    type: String,
    enum: ['ACTIVE', 'GRADUATED', 'EXPELLED', 'STRUCK_OFF', 'Active', 'Graduated', 'Expelled', 'Struck Off'],
    default: 'ACTIVE'
  },
  session: { type: String, default: '' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FrontOfficeInquiry' }
}, { timestamps: true });

StudentSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
StudentSchema.virtual('program', {
  ref: 'Program',
  localField: 'programId',
  foreignField: '_id',
  justOne: true
});
StudentSchema.virtual('class', {
  ref: 'Class',
  localField: 'classId',
  foreignField: '_id',
  justOne: true
});
StudentSchema.virtual('section', {
  ref: 'Section',
  localField: 'sectionId',
  foreignField: '_id',
  justOne: true
});
StudentSchema.virtual('feeInstallments').get(function () {
  return this.installments || [];
});
StudentSchema.virtual('feeInstallments').set(function (val) {
  this.installments = val;
});
StudentSchema.set('toJSON', { virtuals: true });
StudentSchema.set('toObject', { virtuals: true });
StudentSchema.index({ programId: 1, classId: 1, sectionId: 1 });
StudentSchema.index({ sessionId: 1 });
StudentSchema.index({ status: 1 });

module.exports = mongoose.model('Student', StudentSchema);
