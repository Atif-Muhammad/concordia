const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  applicantType: { type: String, enum: ['STUDENT', 'STAFF'], required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  leaveType: { type: String, default: 'CASUAL' },
  fromDate: { type: String, required: true },
  toDate: { type: String, required: true },
  reason: { type: String, default: '' },
  days: { type: Number, default: 1 },
  month: { type: String }, // YYYY-MM
  locked: { type: Boolean, default: false },
  status: { type: String, default: 'PENDING' },
  actionAudit: [{
    action: { type: String },
    byName: { type: String },
    at: { type: Date, default: Date.now },
    notes: { type: String }
  }],
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

LeaveSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
LeaveSchema.set('toJSON', { virtuals: true });
LeaveSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Leave', LeaveSchema);
