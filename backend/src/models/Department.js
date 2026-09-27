const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, default: '' },
  description: { type: String, default: '' },
  headOfDepartment: { type: String, default: '' },
  hod: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
}, { timestamps: true });

DepartmentSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
DepartmentSchema.set('toJSON', { virtuals: true });
DepartmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Department', DepartmentSchema);
