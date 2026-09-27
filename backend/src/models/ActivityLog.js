const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  staffId: { type: String, default: '' }, // e.g. "T-0001", "NT-0002"
  userName: { type: String, default: 'System' },
  userEmail: { type: String, default: '' },
  userRole: { type: String, default: 'STAFF' },
  module: { type: String, required: true, index: true },
  subModule: { type: String, default: '', index: true },
  action: { type: String, default: 'ACTION' }, // CREATE, UPDATE, DELETE, READ, LOGIN, LOGOUT, GENERATE, PAYMENT, etc.
  description: { type: String, required: true },
  method: { type: String, default: 'POST' },
  endpoint: { type: String, required: true },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS', index: true },
  statusCode: { type: Number, default: 200 },
  failureReason: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  params: { type: mongoose.Schema.Types.Mixed },
  body: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

ActivityLogSchema.index({ timestamp: -1 });
ActivityLogSchema.index({ module: 1, timestamp: -1 });
ActivityLogSchema.index({ staffId: 1, timestamp: -1 });
ActivityLogSchema.index({ status: 1, timestamp: -1 });

ActivityLogSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ActivityLogSchema.set('toJSON', { virtuals: true });
ActivityLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
