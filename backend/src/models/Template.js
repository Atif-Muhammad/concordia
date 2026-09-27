const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['REPORT_CARD', 'STAFF_ID', 'STUDENT_ID', 'FEE_CHALLAN', 'PAYROLL', 'INSTALLMENT', 'EXTRA', 'HOSTEL'],
    required: true
  },
  htmlContent: { type: String, required: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

TemplateSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
TemplateSchema.set('toJSON', { virtuals: true });
TemplateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Template', TemplateSchema);
