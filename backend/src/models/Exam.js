const mongoose = require('mongoose');

const ExamScheduleItemSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  totalMarks: { type: Number, default: 100 }
}, { _id: false });

const ExamSchema = new mongoose.Schema({
  examName: { type: String, required: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  session: { type: String, default: '' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  type: { type: String, default: 'Final' },
  description: { type: String, default: '' },
  schedule: [ExamScheduleItemSchema]
}, { timestamps: true });

ExamSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ExamSchema.virtual('schedules').get(function () {
  return this.schedule;
});
ExamSchema.virtual('program').get(function () {
  return this.programId;
});
ExamSchema.virtual('class').get(function () {
  return this.classId;
});
ExamSchema.set('toJSON', { virtuals: true });
ExamSchema.set('toObject', { virtuals: true });

// ExamMarks
const ExamMarksSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  obtainedMarks: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 100 },
  isAbsent: { type: Boolean, default: false }
}, { timestamps: true });

ExamMarksSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ExamMarksSchema.virtual('student').get(function () {
  return this.studentId;
});
ExamMarksSchema.virtual('exam').get(function () {
  return this.examId;
});
ExamMarksSchema.virtual('subject').get(function () {
  return this.subjectId?.name || (typeof this.subjectId === 'string' ? this.subjectId : '');
});
ExamMarksSchema.set('toJSON', { virtuals: true });
ExamMarksSchema.set('toObject', { virtuals: true });

// ExamResult
const ExamResultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  totalMarks: { type: Number, required: true },
  obtainedMarks: { type: Number, required: true },
  percentage: { type: Number, required: true },
  gpa: { type: Number },
  grade: { type: String },
  position: { type: Number },
  remarks: { type: String, default: '' }
}, { timestamps: true });

ExamResultSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ExamResultSchema.virtual('student').get(function () {
  return this.studentId;
});
ExamResultSchema.virtual('exam').get(function () {
  return this.examId;
});
ExamResultSchema.set('toJSON', { virtuals: true });
ExamResultSchema.set('toObject', { virtuals: true });

const Exam = mongoose.model('Exam', ExamSchema);
const ExamMarks = mongoose.model('ExamMarks', ExamMarksSchema);
const ExamResult = mongoose.model('ExamResult', ExamResultSchema);

module.exports = { Exam, ExamMarks, ExamResult };
