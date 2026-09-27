const mongoose = require('mongoose');

const AcademicSessionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  isActive: { type: Boolean, default: false }
}, { timestamps: true });

AcademicSessionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
AcademicSessionSchema.set('toJSON', { virtuals: true });
AcademicSessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AcademicSession', AcademicSessionSchema);
