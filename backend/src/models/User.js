const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STAFF', 'Teacher', 'Staff'],
    default: 'ADMIN'
  },
  phone: { type: String },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  permissions: {
    all: { type: Boolean, default: false },
    modules: [{ type: String }],
    subModules: { type: Map, of: [String], default: {} },
    actions: { type: mongoose.Schema.Types.Mixed, default: {} },
    crud: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  isStaff: { type: Boolean, default: false },
  isTeaching: { type: Boolean, default: false },
  isNonTeaching: { type: Boolean, default: false },
  refId: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

UserSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
