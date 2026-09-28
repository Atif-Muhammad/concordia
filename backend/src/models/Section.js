const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  capacity: { type: Number, default: 50 },
  room: { type: String, default: null }
}, { timestamps: true });

SectionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
SectionSchema.set('toJSON', { virtuals: true });
SectionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Section', SectionSchema);
