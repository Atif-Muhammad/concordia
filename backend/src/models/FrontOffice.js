const mongoose = require('mongoose');

// Follow Up Subdocument
const FollowUpSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  slab: { type: String, default: '' },
  remarks: { type: String, default: '' },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  }
}, { timestamps: true });

FollowUpSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
FollowUpSchema.set('toJSON', { virtuals: true });
FollowUpSchema.set('toObject', { virtuals: true });

// Inquiry
const InquirySchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  studentCnic: { type: String, default: '' },
  fatherName: { type: String, required: true },
  fatherCnic: { type: String, default: '' },
  contactNumber: { type: String, required: true },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  programInterest: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  previousInstitute: { type: String, default: '' },
  remarks: [{ text: String, date: { type: Date, default: Date.now } }],
  inquiryType: { type: String, default: '' },
  gender: { type: String, default: '' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  prospectusSold: { type: Boolean, default: false },
  prospectusFee: { type: Number, default: 0 },
  prospectusReceipt: { type: String, default: '' },
  followUps: [FollowUpSchema],
  followUpDate: { type: Date },
  followUpSlab: { type: String, default: '' },
  referenceBody: { type: String, default: '' },
  status: {
    type: String,
    enum: ['NEW', 'APPROVED', 'REJECTED'],
    default: 'NEW'
  }
}, { timestamps: true });

InquirySchema.virtual('id').get(function () {
  return this._id.toHexString();
});
InquirySchema.set('toJSON', { virtuals: true });
InquirySchema.set('toObject', { virtuals: true });

// Visitor
const VisitorSchema = new mongoose.Schema({
  visitorName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  phone: { type: String },
  ID: { type: String, required: true }, // IDCard
  IDCard: { type: String },
  purpose: { type: String, default: '' },
  persons: { type: Number, default: 1 },
  visitDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  date: { type: String },
  inTime: { type: String, default: '' },
  outTime: { type: String, default: '' },
  remarks: { type: String, default: '' }
}, { timestamps: true });

VisitorSchema.pre('save', function () {
  if (!this.phone && this.phoneNumber) this.phone = this.phoneNumber;
  if (!this.phoneNumber && this.phone) this.phoneNumber = this.phone;
  if (!this.IDCard && this.ID) this.IDCard = this.ID;
  if (!this.ID && this.IDCard) this.ID = this.IDCard;
  if (!this.date && this.visitDate) this.date = this.visitDate;
  if (!this.visitDate && this.date) this.visitDate = this.date;
});

VisitorSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
VisitorSchema.set('toJSON', { virtuals: true });
VisitorSchema.set('toObject', { virtuals: true });

// Complaint
const ComplaintSchema = new mongoose.Schema({
  type: { type: String, default: 'Student' },
  complainantName: { type: String, required: true },
  contact: { type: String, default: '' },
  details: { type: String, required: true },
  subject: { type: String, default: '' },
  category: { type: String, default: 'General' },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'In_Progress', 'Resolved', 'Dismissed', 'Rejected', 'pending', 'resolved', 'rejected'],
    default: 'Pending'
  },
  assignedToIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
  remarks: [{
    text: { type: String, default: '' },
    remark: { type: String, default: '' },
    authorName: { type: String, default: 'Staff' },
    date: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

ComplaintSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ComplaintSchema.virtual('assignedTo').get(function () {
  return this.assignedToIds;
});
ComplaintSchema.virtual('description').get(function () {
  return this.details;
});
ComplaintSchema.virtual('title').get(function () {
  return this.subject;
});
ComplaintSchema.set('toJSON', { virtuals: true });
ComplaintSchema.set('toObject', { virtuals: true });

// Contact
const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ['Emergency', 'Academic', 'Technical', 'Maintenance', 'Other'],
    default: 'Emergency'
  },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  details: { type: String, default: '' }
}, { timestamps: true });

ContactSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
ContactSchema.set('toJSON', { virtuals: true });
ContactSchema.set('toObject', { virtuals: true });

const FrontOfficeInquiry = mongoose.model('FrontOfficeInquiry', InquirySchema);
const FrontOfficeVisitor = mongoose.model('FrontOfficeVisitor', VisitorSchema);
const FrontOfficeComplaint = mongoose.model('FrontOfficeComplaint', ComplaintSchema);
const FrontOfficeContact = mongoose.model('FrontOfficeContact', ContactSchema);

module.exports = {
  FrontOfficeInquiry,
  FrontOfficeVisitor,
  FrontOfficeComplaint,
  FrontOfficeContact
};
