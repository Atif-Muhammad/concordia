const mongoose = require('mongoose');

const StockMovementSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  type: { type: String, enum: ['OPENING', 'RECEIPT', 'ISSUE', 'ADJUSTMENT'], required: true },
  quantity: { type: Number, required: true },
  referenceType: { type: String, default: '' },
  referenceNo: { type: String, default: '' },
  storeName: { type: String, default: 'Main store' },
  remarks: { type: String, default: '' },
  performedByName: { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: String, default: () => new Date().toISOString().slice(0, 10) },
}, { timestamps: true });
StockMovementSchema.virtual('id').get(function () { return this._id.toHexString(); });
StockMovementSchema.set('toJSON', { virtuals: true });
StockMovementSchema.set('toObject', { virtuals: true });
StockMovementSchema.index({ itemId: 1, date: -1 });

const POItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  category: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 },
}, { _id: false });

const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  poDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  supplierName: { type: String, required: true },
  itemCategory: { type: String, default: '' },
  items: [POItemSchema],
  totalValue: { type: Number, default: 0 },
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  grnStatus: { type: String, enum: ['PENDING', 'PARTIAL', 'RECEIVED'], default: 'PENDING' },
  grnDate: { type: String, default: '' },
  grnRemarks: { type: String, default: '' },
  status: { type: String, enum: ['OPEN', 'CLOSED', 'CANCELLED'], default: 'OPEN' },
  invoiceNo: { type: String, default: '' },
  paymentStatus: { type: String, enum: ['UNPAID', 'PAID', 'PARTIAL'], default: 'UNPAID' },
  createdByName: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
PurchaseOrderSchema.virtual('id').get(function () { return this._id.toHexString(); });
PurchaseOrderSchema.set('toJSON', { virtuals: true });
PurchaseOrderSchema.set('toObject', { virtuals: true });
PurchaseOrderSchema.index({ poDate: -1 });

const StockMovement = mongoose.model('StockMovement', StockMovementSchema);
const PurchaseOrder = mongoose.model('PurchaseOrder', PurchaseOrderSchema);

module.exports = { StockMovement, PurchaseOrder };
