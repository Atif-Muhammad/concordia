const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
  dayOfWeek: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }
}, { _id: false });

const TimetableSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  slots: [SlotSchema]
}, { timestamps: true });

TimetableSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
TimetableSchema.set('toJSON', { virtuals: true });
TimetableSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Timetable', TimetableSchema);
