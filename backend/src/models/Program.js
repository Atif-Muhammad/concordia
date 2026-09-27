const mongoose = require('mongoose');

const ProgramSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, default: '' },
  level: {
    type: String,
    enum: ['INTERMEDIATE', 'UNDERGRADUATE', 'DIPLOMA', 'COACHING', 'SHORT_COURSE'],
    default: 'INTERMEDIATE',
  },
  description: { type: String, default: '' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  duration: { type: String, default: '1 year' },
  rollPrefix: { type: String, default: '' }
}, { timestamps: true });

ProgramSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ProgramSchema.set('toJSON', { virtuals: true });
ProgramSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Program', ProgramSchema);
