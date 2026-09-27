const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  endDate: { type: String }, // YYYY-MM-DD (optional range)
  title: { type: String, default: 'Holiday' },
  type: { type: String, default: 'National' },
  description: { type: String, default: '' }
}, { timestamps: true });

HolidaySchema.virtual('id').get(function () {
  return this._id.toHexString();
});
HolidaySchema.set('toJSON', { virtuals: true });
HolidaySchema.set('toObject', { virtuals: true });

const AttendanceSkipSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  date: { type: String, required: true },
  reason: { type: String, default: '' }
}, { timestamps: true });

AttendanceSkipSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
AttendanceSkipSchema.set('toJSON', { virtuals: true });
AttendanceSkipSchema.set('toObject', { virtuals: true });

const Holiday = mongoose.model('Holiday', HolidaySchema);
const AttendanceSkip = mongoose.model('AttendanceSkip', AttendanceSkipSchema);

module.exports = { Holiday, AttendanceSkip };
