const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const fChallans = await db.collection('feechallans').find({ paidDate: { $exists: true, $ne: null } }).limit(2).toArray();
  console.log('FeeChallan paidDate sample:', fChallans.map(c => ({
    id: c._id,
    no: c.challanNo,
    paidDate: c.paidDate,
    type: typeof c.paidDate,
    isDate: c.paidDate instanceof Date
  })));

  const eChallans = await db.collection('extrachallans').find({ paidDate: { $exists: true, $ne: null } }).limit(2).toArray();
  console.log('\nExtraChallan paidDate sample:', eChallans.map(c => ({
    id: c._id,
    no: c.challanNo,
    paidDate: c.paidDate,
    type: typeof c.paidDate,
    isDate: c.paidDate instanceof Date
  })));

  const hChallans = await db.collection('hostelchallans').find({ paidDate: { $exists: true, $ne: null } }).limit(2).toArray();
  console.log('\nHostelChallan paidDate sample:', hChallans.map(c => ({
    id: c._id,
    no: c.challanNo || c.challanNumber,
    paidDate: c.paidDate,
    type: typeof c.paidDate,
    isDate: c.paidDate instanceof Date,
    payments: c.payments
  })));

  const receipts = await db.collection('feepaymentreceipts').find({}).limit(5).toArray();
  console.log('\nReceipts sample:', receipts.map(r => ({
    id: r._id,
    no: r.receiptNo,
    challanType: r.challanType,
    challanId: r.challanId,
    amountPaid: r.amountPaid,
    paidDate: r.paidDate,
    isDate: r.paidDate instanceof Date
  })));

  // Also count receipts by challanType
  const receiptCounts = await db.collection('feepaymentreceipts').aggregate([
    { $group: { _id: '$challanType', count: { $sum: 1 } } }
  ]).toArray();
  console.log('\nReceipt counts by type:', receiptCounts);

  await mongoose.disconnect();
}
check().catch(console.error);
