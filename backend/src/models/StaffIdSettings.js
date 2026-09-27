const mongoose = require('mongoose');

const StaffIdSettingsSchema = new mongoose.Schema({
  teachingPrefix: { type: String, default: 'T-' },
  nonTeachingPrefix: { type: String, default: 'NT-' },
  dualPrefix: { type: String, default: 'D-' },
  supportingPrefix: { type: String, default: 'SS-' }
}, { timestamps: true });

StaffIdSettingsSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
StaffIdSettingsSchema.set('toJSON', { virtuals: true });
StaffIdSettingsSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StaffIdSettings', StaffIdSettingsSchema);
