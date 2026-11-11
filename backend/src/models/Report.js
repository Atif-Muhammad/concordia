const mongoose = require('mongoose');

// Saved report views — users can save filter+column combos for quick access
const SavedReportViewSchema = new mongoose.Schema({
  reportKey: { type: String, required: true, index: true },
  module: { type: String, default: '' },
  reportTitle: { type: String, default: '' },
  name: { type: String, required: true },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  columns: [String],
  isShared: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: '' },
}, { timestamps: true });
SavedReportViewSchema.virtual('id').get(function () { return this._id.toHexString(); });
SavedReportViewSchema.set('toJSON', { virtuals: true });
SavedReportViewSchema.set('toObject', { virtuals: true });

// Report export/print audit log — tracks who exported what, when, in what format
const ReportExportLogSchema = new mongoose.Schema({
  reportKey: { type: String, required: true, index: true },
  module: { type: String, default: '' },
  reportName: { type: String, default: '' },
  filtersSummary: { type: String, default: '' },
  format: { type: String, enum: ['PDF', 'EXCEL', 'PRINT', 'VIEW'], default: 'VIEW' },
  recordCount: { type: Number, default: 0 },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
  failureReason: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, default: '' },
  userRole: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: true });
ReportExportLogSchema.virtual('id').get(function () { return this._id.toHexString(); });
ReportExportLogSchema.set('toJSON', { virtuals: true });
ReportExportLogSchema.set('toObject', { virtuals: true });
ReportExportLogSchema.index({ timestamp: -1 });
ReportExportLogSchema.index({ reportKey: 1, timestamp: -1 });

const SavedReportView = mongoose.model('SavedReportView', SavedReportViewSchema);
const ReportExportLog = mongoose.model('ReportExportLog', ReportExportLogSchema);

module.exports = { SavedReportView, ReportExportLog };
