const mongoose = require('mongoose');

const FinanceCategorySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['INCOME', 'EXPENSE'],
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  subCategories: [{
    type: String,
    trim: true,
  }],
  isDefault: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

FinanceCategorySchema.index({ type: 1, name: 1 }, { unique: true });

FinanceCategorySchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FinanceCategorySchema.set('toJSON', { virtuals: true });
FinanceCategorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FinanceCategory', FinanceCategorySchema);
