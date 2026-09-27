const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollPrefix: { type: String, default: '' },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  year: { type: Number, default: null },
  semester: { type: Number, default: null },
  isSemester: { type: Boolean, default: false },
  allowSections: { type: Boolean, default: true },
}, { timestamps: true });

ClassSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ClassSchema.virtual('feeStructures', {
  ref: 'FeeStructure',
  localField: '_id',
  foreignField: 'classId',
});
ClassSchema.set('toJSON', { virtuals: true });
ClassSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Class', ClassSchema);
