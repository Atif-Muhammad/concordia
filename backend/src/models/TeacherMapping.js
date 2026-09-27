const mongoose = require('mongoose');

const TeacherMappingSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  mappingType: { type: String, enum: ['CLASS', 'SUBJECT'], default: 'CLASS' }
}, { timestamps: true });

TeacherMappingSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
TeacherMappingSchema.set('toJSON', { virtuals: true });
TeacherMappingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TeacherMapping', TeacherMappingSchema);
