const mongoose = require('mongoose');

const InstituteSettingsSchema = new mongoose.Schema({
  instituteName: { type: String, default: 'Concordia College Peshawar' },
  tagline: { type: String, default: '' },
  address: { type: String, default: '60-C, Near NCS School, University Town Peshawar' },
  phone: { type: String, default: '091-5619915' },
  email: { type: String, default: '' },
  website: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  principalSignatureUrl: { type: String, default: '' },
  accountsSignatureUrl: { type: String, default: '' },
  lateFeeRatePerDay: { type: Number, default: 0 },
  hostelLateFee: { type: Number, default: 0 }
}, { timestamps: true });

InstituteSettingsSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
InstituteSettingsSchema.set('toJSON', { virtuals: true });
InstituteSettingsSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('InstituteSettings', InstituteSettingsSchema);
