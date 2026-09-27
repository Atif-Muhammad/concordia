const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String },
  type: { type: String, enum: ['Theory', 'Practical', 'Both'], default: 'Theory' },
  creditHours: { type: Number, default: null }
}, { timestamps: true });

SubjectSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
SubjectSchema.set('toJSON', { virtuals: true });
SubjectSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Subject', SubjectSchema);
