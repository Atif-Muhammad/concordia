const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  staffId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  fatherName: { type: String, default: '' },
  cnic: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  religion: { type: String, default: '' },
  password: { type: String },
  isTeaching: { type: Boolean, default: false },
  isNonTeaching: { type: Boolean, default: false },
  isSupportingStaff: { type: Boolean, default: false },
  staffType: {
    type: String,
    enum: ['PERMANENT', 'CONTRACT'],
    default: 'PERMANENT'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'TERMINATED', 'RETIRED'],
    default: 'ACTIVE'
  },
  basicPay: { type: Number, default: 0 },
  baseSalary: { type: Number, default: 0 },
  salaryHistory: [{
    type: {
      type: String,
      enum: ['INCREMENT', 'DECREMENT'],
      required: true
    },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    previousSalary: { type: Number, required: true },
    amountChanged: { type: Number, required: true },
    newSalary: { type: Number, required: true },
    dailyAbsentDeduction: { type: Number, required: true },
    effectiveDate: { type: Date, default: Date.now },
    remarks: { type: String, default: '' },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  joinDate: { type: Date },
  leaveDate: { type: Date },
  contractStart: { type: Date },
  contractEnd: { type: Date },
  specialization: { type: String, default: '' },
  highestDegree: { type: String, default: '' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  documents: {
    bsDegree: { type: Boolean, default: false },
    msDegree: { type: Boolean, default: false },
    phd: { type: Boolean, default: false },
    postDoc: { type: Boolean, default: false },
    experienceLetter: { type: Boolean, default: false },
    cv: { type: Boolean, default: false }
  },
  designation: { type: String, default: '' },
  empDepartment: { type: String, default: '' },
  permissions: {
    modules: [{ type: String }],
    subModules: { type: Map, of: [String], default: {} },
    actions: { type: mongoose.Schema.Types.Mixed, default: {} },
    crud: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  leaveSettings: {
    sickAllowed: { type: Number, default: 0 },
    sickDeduction: { type: Number, default: 0 },
    annualAllowed: { type: Number, default: 0 },
    annualDeduction: { type: Number, default: 0 },
    casualAllowed: { type: Number, default: 0 },
    casualDeduction: { type: Number, default: 0 },
    absentDeduction: { type: Number, default: 0 },
    maxLateMinutes: { type: Number, default: 0 }
  },
  absentDeduction: { type: Number, default: 0 },
  maxLateMinutes: { type: Number, default: 0 },
  photo_url: { type: String, default: '' }
}, { timestamps: true });

StaffSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
StaffSchema.set('toJSON', { virtuals: true });
StaffSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Staff', StaffSchema);
