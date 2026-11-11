const mongoose = require('mongoose');

// Fee reminder/follow-up log for defaulter tracking (P14/P15)
const FeeReminderLogSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  challanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeChallan' },
  installmentNumber: { type: Number, default: null },
  channel: { type: String, enum: ['SMS', 'WHATSAPP', 'CALL', 'EMAIL', 'IN_PERSON'], default: 'SMS' },
  status: { type: String, enum: ['NOT_SENT', 'QUEUED', 'SENT', 'RESPONDED', 'FAILED'], default: 'NOT_SENT' },
  contactOutcome: { type: String, default: '' },
  nextFollowUpDate: { type: Date, default: null },
  remarks: { type: String, default: '' },
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  loggedByName: { type: String, default: '' },
}, { timestamps: true });
FeeReminderLogSchema.virtual('id').get(function () { return this._id.toHexString(); });
FeeReminderLogSchema.set('toJSON', { virtuals: true });
FeeReminderLogSchema.set('toObject', { virtuals: true });
FeeReminderLogSchema.index({ studentId: 1, createdAt: -1 });

// Fee concession request & approval workflow (P17)
const FeeConcessionRequestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  concessionType: {
    type: String,
    enum: ['SCHOLARSHIP', 'SIBLING', 'STAFF', 'MERIT', 'NEED_BASED', 'SPECIAL'],
    required: true,
  },
  grossAmount: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  reason: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedByName: { type: String, default: '' },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedByName: { type: String, default: '' },
  rejectedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: '' },
}, { timestamps: true });
FeeConcessionRequestSchema.virtual('id').get(function () { return this._id.toHexString(); });
FeeConcessionRequestSchema.set('toJSON', { virtuals: true });
FeeConcessionRequestSchema.set('toObject', { virtuals: true });

const FeeReminderLog = mongoose.model('FeeReminderLog', FeeReminderLogSchema);
const FeeConcessionRequest = mongoose.model('FeeConcessionRequest', FeeConcessionRequestSchema);

module.exports = { FeeReminderLog, FeeConcessionRequest };
