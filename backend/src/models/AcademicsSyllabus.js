const mongoose = require('mongoose');

const TopicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  plannedDate: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  completedDate: { type: String, default: '' },
  delayReason: { type: String, default: '' },
  updatedByName: { type: String, default: '' },
  updatedAt: { type: Date, default: null },
}, { _id: true });

const SyllabusPlanSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  term: { type: String, default: 'Full Year' },
  topics: [TopicSchema],
}, { timestamps: true });
SyllabusPlanSchema.virtual('id').get(function () { return this._id.toHexString(); });
SyllabusPlanSchema.set('toJSON', { virtuals: true });
SyllabusPlanSchema.set('toObject', { virtuals: true });
SyllabusPlanSchema.index({ sessionId: 1, classId: 1, subjectId: 1 });

const SyllabusPlan = mongoose.model('SyllabusPlan', SyllabusPlanSchema);

module.exports = { SyllabusPlan };
