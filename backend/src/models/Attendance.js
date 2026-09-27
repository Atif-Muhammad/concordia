const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  role: { type: String, enum: ['STUDENT', 'STAFF', 'TEACHER', 'student', 'staff', 'teacher'], required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  date: { type: String, required: true }, // YYYY-MM-DD
  status: {
    type: String,
    enum: ['PRESENT', 'ABSENT', 'LEAVE', 'LATE', 'HOLIDAY', 'HD', 'HALF_DAY', 'present', 'absent', 'leave', 'late', 'holiday', 'hd', 'half_day', null],
    default: null
  },
  leaveType: {
    type: String,
    enum: ['CASUAL', 'SICK', 'ANNUAL', 'casual', 'sick', 'annual', null],
    default: null
  },
  checkInTime: { type: String, default: '' },
  checkOutTime: { type: String, default: '' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  notes: { type: String, default: '' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  markedAt: { type: Date, default: Date.now }
}, { timestamps: true });

AttendanceSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
AttendanceSchema.set('toJSON', { virtuals: true });
AttendanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
