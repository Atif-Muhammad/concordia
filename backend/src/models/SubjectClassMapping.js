const mongoose = require('mongoose');

const SubjectClassMappingSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  subjects: [{
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    creditHours: { type: Number, default: null }
  }],
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' }
}, { timestamps: true });

SubjectClassMappingSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
SubjectClassMappingSchema.set('toJSON', { virtuals: true });
SubjectClassMappingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SubjectClassMapping', SubjectClassMappingSchema);
