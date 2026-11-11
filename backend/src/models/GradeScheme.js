const mongoose = require('mongoose');

const GradeBandSchema = new mongoose.Schema({
  grade: { type: String, required: true },
  minPct: { type: Number, required: true },
  maxPct: { type: Number, required: true },
  gpa: { type: Number, default: null },
  interpretation: { type: String, default: '' },
}, { _id: false });

const GradeSchemeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  effectiveFrom: { type: Date, default: Date.now },
  isDefault: { type: Boolean, default: false },
  passPercentage: { type: Number, default: 50 },
  tieBreakRule: {
    type: String,
    enum: ['HIGHEST_PERCENTAGE', 'HIGHER_CORE_MARKS', 'EARLIER_ROLL'],
    default: 'HIGHEST_PERCENTAGE',
  },
  bands: [GradeBandSchema],
}, { timestamps: true });
GradeSchemeSchema.virtual('id').get(function () { return this._id.toHexString(); });
GradeSchemeSchema.set('toJSON', { virtuals: true });
GradeSchemeSchema.set('toObject', { virtuals: true });

const GradeScheme = mongoose.model('GradeScheme', GradeSchemeSchema);

module.exports = { GradeScheme };
