const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const models = require('../src/models');
const staffHrMod = require('../src/services/reports/staffHrFinance.reports');
const opsExecMod = require('../src/services/reports/operationsExecutive.reports');

const OID = (hex) => new mongoose.Types.ObjectId(String(hex).padStart(24, '0'));

function makeChain(result) {
  const chain = {
    populate() { return chain; },
    select() { return chain; },
    sort() { return chain; },
    limit() { return chain; },
    skip() { return chain; },
    lean() { return Promise.resolve(result); },
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(result).catch(onRejected);
    },
  };
  return chain;
}

const ADMIN_USER = {
  id: OID('aa01').toString(),
  name: 'Admin User',
  role: 'admin',
  permissions: {
    Staff: { directory: { read: true }, reports: { read: true } },
    'HR & Payroll': { payroll: { read: true, update: true }, reports: { read: true } },
    Finance: { reports: { read: true } },
    'Front Office': { reports: { read: true }, complaint: { read: true, create: true, update: true } },
    Complaints: { _root: { read: true, create: true, update: true }, reports: { read: true } },
    Inventory: { inventory: { read: true, create: true, update: true }, expenses: { read: true, update: true }, _root: { read: true, create: true, update: true }, reports: { read: true } },
    Boarding: { revenue: { read: true } },
    'Executive Dashboard': { _root: { read: true } },
    Students: { reports: { read: true } },
    Reports: { _root: { read: true } },
  },
};

const BASIC_USER = {
  id: OID('bb02').toString(),
  name: 'Viewer User',
  role: 'staff',
  permissions: {
    Staff: { reports: { read: true } },
    'HR & Payroll': { reports: { read: true } },
    Complaints: { reports: { read: true } },
  },
};

let originals = [];

function stubMethod(obj, method, impl) {
  originals.push({ obj, method, orig: obj[method] });
  obj[method] = impl;
}

test.afterEach(() => {
  while (originals.length > 0) {
    const { obj, method, orig } = originals.pop();
    obj[method] = orig;
  }
});

function setupDefaultUserAndSessionStubs(customUserDoc = null) {
  stubMethod(models.User, 'findById', () => makeChain(customUserDoc));
  stubMethod(models.AcademicSession, 'findById', () => makeChain({
    _id: OID('5e01'),
    title: '2026-2027',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isCurrent: true,
  }));
  stubMethod(models.AcademicSession, 'findOne', () => makeChain({
    _id: OID('5e01'),
    title: '2026-2027',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isCurrent: true,
  }));
}

// ============================================================================
// CATALOG & STRUCTURE TESTS
// ============================================================================

test('Catalog & handler exports for Pages 32-48 match exact keys without campus fields', () => {
  assert.deepEqual(
    staffHrMod.CATALOG.map(c => [c.pageNumber, c.key]),
    [
      [32, 'staff-employee-register'],
      [33, 'staff-attendance-punctuality'],
      [34, 'hr-leave-register'],
      [35, 'payroll-monthly-register'],
      [36, 'finance-income-expense'],
      [37, 'finance-cash-bank-book'],
    ]
  );
  for (const c of staffHrMod.CATALOG) {
    assert.equal(typeof staffHrMod.HANDLERS[c.key], 'function');
  }

  assert.deepEqual(
    opsExecMod.CATALOG.map(c => [c.pageNumber, c.key]),
    [
      [38, 'front-office-visitor-inquiry'],
      [39, 'complaints-resolution-tracker'],
      [40, 'boarding-hostel-occupancy'],
      [41, 'inventory-stock-on-hand'],
      [42, 'inventory-purchase-grn'],
      [43, 'executive-monthly-overview'],
      [44, 'combined-student-risk-watchlist'],
      [45, 'combined-class-health'],
      [46, 'combined-admission-first-fee'],
      [47, 'combined-management-exceptions'],
      [48, 'report-centre-audit-log'],
    ]
  );
  for (const c of opsExecMod.CATALOG) {
    assert.equal(typeof opsExecMod.HANDLERS[c.key], 'function');
  }
  assert.deepEqual(Object.keys(opsExecMod.ACTIONS).sort(), [
    'create-purchase-order',
    'record-stock-movement',
    'update-complaint-sla',
    'update-po-grn',
  ]);

  const catalogJson = JSON.stringify([...staffHrMod.CATALOG, ...opsExecMod.CATALOG]);
  assert.equal(/campus/i.test(catalogJson), false, 'Catalog metadata must not reference campus');
});

// ============================================================================
// PAGES 32-37: STAFF, HR & FINANCE REPORTS
// ============================================================================

test('Page 32 staff-employee-register: masks phone/CNIC/salary for unprivileged and exposes for privileged', async () => {
  setupDefaultUserAndSessionStubs(null);
  const deptA = { _id: OID('d1'), name: 'Computer Science' };
  const deptB = { _id: OID('d2'), name: 'Administration' };
  const staffDocs = [
    {
      _id: OID('a1'), staffId: 'EMP-01', name: 'Dr. Ali Raza', email: 'ali@test.edu',
      phone: '03001234567', cnic: '35202-1234567-1', isTeaching: true, staffType: 'TEACHING',
      designation: 'Senior Lecturer', departmentId: deptA, joinDate: new Date('2024-02-01'),
      status: 'ACTIVE', basicPay: 95000,
    },
    {
      _id: OID('a2'), staffId: 'EMP-02', name: 'Sana Khan', email: 'sana@test.edu',
      phone: '03007654321', cnic: '35202-7654321-2', isTeaching: false, isNonTeaching: true,
      designation: 'Accounts Officer', departmentId: deptB, joinDate: new Date('2024-05-15'),
      status: 'ACTIVE', basicPay: 65000,
    },
  ];
  stubMethod(models.Department, 'find', () => makeChain([deptA, deptB]));
  stubMethod(models.Staff, 'find', () => makeChain(staffDocs));

  const maskedRes = await staffHrMod.HANDLERS['staff-employee-register']({}, BASIC_USER);
  assert.equal(maskedRes.kpis[0].value, '2');
  assert.equal(maskedRes.kpis[1].value, '1');
  assert.equal(maskedRes.kpis[2].value, '1');
  assert.equal(maskedRes.kpis[3].value, '2');
  assert.equal(maskedRes.columns.some(c => c.key === 'basicPay'), false);
  assert.equal(maskedRes.rows[0].basicPay, 'Restricted');
  assert.equal(JSON.stringify(maskedRes).includes('35202-1234567-1'), false);

  const privRes = await staffHrMod.HANDLERS['staff-employee-register']({}, ADMIN_USER);
  assert.equal(privRes.columns.some(c => c.key === 'phone'), true);
  assert.equal(privRes.columns.some(c => c.key === 'basicPay'), true);
  assert.equal(privRes.rows[0].phone, '03001234567');
  assert.equal(privRes.rows[0].basicPay, 'Rs 95,000');
});

test('Page 33 staff-attendance-punctuality: separates approved Leave from unapproved absent', async () => {
  setupDefaultUserAndSessionStubs(null);
  const deptA = { _id: OID('d1'), name: 'Sciences' };
  const s1 = { _id: OID('a1'), staffId: 'E1', name: 'Tariq Mahmood', departmentId: deptA, status: 'ACTIVE' };
  stubMethod(models.Department, 'find', () => makeChain([deptA]));
  stubMethod(models.Staff, 'find', () => makeChain([s1]));
  stubMethod(models.Holiday, 'find', () => makeChain([]));
  // 2 present + 1 late (=3 present) + 1 unapproved ABSENT + 1 ABSENT covered by approved leave
  stubMethod(models.Attendance, 'find', () => makeChain([
    { staffId: s1._id, role: 'STAFF', date: '2026-10-05', status: 'PRESENT' },
    { staffId: s1._id, role: 'STAFF', date: '2026-10-06', status: 'PRESENT' },
    { staffId: s1._id, role: 'STAFF', date: '2026-10-07', status: 'LATE' },
    { staffId: s1._id, role: 'STAFF', date: '2026-10-08', status: 'ABSENT' }, // overlaps approved leave!
    { staffId: s1._id, role: 'STAFF', date: '2026-10-09', status: 'ABSENT' }, // unapproved absent!
  ]));
  stubMethod(models.Leave, 'find', () => makeChain([
    { staffId: s1._id, applicantType: 'STAFF', fromDate: '2026-10-08', toDate: '2026-10-08', status: 'APPROVED' },
  ]));

  const res = await staffHrMod.HANDLERS['staff-attendance-punctuality']({ month: '2026-10' }, ADMIN_USER);
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].present, 3);
  assert.equal(res.rows[0].late, 1);
  assert.equal(res.rows[0].approvedLeave, 1);
  assert.equal(res.rows[0].absent, 1); // strictly unapproved only
  assert.equal(res.kpis.find(k => k.label === 'Unapproved absences').value, '1');
});

test('Page 34 hr-leave-register: computes applications KPI and Policy-Year Leave Balances secondaryTable', async () => {
  setupDefaultUserAndSessionStubs(null);
  const s1 = {
    _id: OID('a1'), staffId: 'E1', name: 'Hina Aslam',
    departmentId: { _id: OID('d1'), name: 'English' }, status: 'ACTIVE',
    leaveSettings: { casualAllowed: 12, sickAllowed: 10, annualAllowed: 14 },
  };
  stubMethod(models.Department, 'find', () => makeChain([s1.departmentId]));
  stubMethod(models.Staff, 'find', () => makeChain([s1]));
  stubMethod(models.Leave, 'find', () => makeChain([
    { _id: OID('f1'), staffId: { _id: s1._id, name: s1.name, departmentId: s1.departmentId }, applicantType: 'STAFF', leaveType: 'CASUAL', fromDate: '2026-10-05', toDate: '2026-10-06', days: 2, status: 'APPROVED', approvedBy: { name: 'Principal' } },
    { _id: OID('f2'), staffId: { _id: s1._id, name: s1.name, departmentId: s1.departmentId }, applicantType: 'STAFF', leaveType: 'SICK', fromDate: '2026-10-12', toDate: '2026-10-14', days: 3, status: 'PENDING' },
    { _id: OID('f3'), staffId: { _id: s1._id, name: s1.name, departmentId: s1.departmentId }, applicantType: 'STAFF', leaveType: 'ANNUAL', fromDate: '2026-10-20', toDate: '2026-10-20', days: 1, status: 'REJECTED' },
  ]));
  // Ensure policyLeaves (without populate) also extract staffId cleanly — note Leave.find runs for both; handle plain ObjectId or populated object?
  // Wait: let's also stub Leave.find based on query shape!
  let callNum = 0;
  stubMethod(models.Leave, 'find', () => {
    callNum += 1;
    if (callNum === 1) {
      return makeChain([
        { _id: OID('f1'), staffId: s1, applicantType: 'STAFF', leaveType: 'CASUAL', fromDate: '2026-10-05', toDate: '2026-10-06', days: 2, status: 'APPROVED', approvedBy: { name: 'Principal' } },
        { _id: OID('f2'), staffId: s1, applicantType: 'STAFF', leaveType: 'SICK', fromDate: '2026-10-12', toDate: '2026-10-14', days: 3, status: 'PENDING' },
        { _id: OID('f3'), staffId: s1, applicantType: 'STAFF', leaveType: 'ANNUAL', fromDate: '2026-10-20', toDate: '2026-10-20', days: 1, status: 'REJECTED' },
      ]);
    }
    return makeChain([
      { _id: OID('f1'), staffId: s1._id, applicantType: 'STAFF', leaveType: 'CASUAL', fromDate: '2026-10-05', toDate: '2026-10-06', days: 2, status: 'APPROVED' },
      { _id: OID('f2'), staffId: s1._id, applicantType: 'STAFF', leaveType: 'SICK', fromDate: '2026-10-12', toDate: '2026-10-14', days: 3, status: 'PENDING' },
      { _id: OID('f3'), staffId: s1._id, applicantType: 'STAFF', leaveType: 'ANNUAL', fromDate: '2026-10-20', toDate: '2026-10-20', days: 1, status: 'REJECTED' },
    ]);
  });

  const res = await staffHrMod.HANDLERS['hr-leave-register']({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }, ADMIN_USER);
  assert.equal(res.kpis[0].value, '3');
  assert.equal(res.kpis[1].value, '1');
  assert.equal(res.kpis[2].value, '1');
  assert.equal(res.kpis[3].value, '1');
  assert.equal(res.secondaryTables.length, 1);
  assert.equal(res.secondaryTables[0].title, 'Policy-Year Leave Balances');
  const bal = res.secondaryTables[0].rows[0];
  // opening 12+10+14 = 36, used = 2, pending = 3, closing = 31
  assert.equal(bal.openingQuota, 36);
  assert.equal(bal.used, 2);
  assert.equal(bal.pending, 3);
  assert.equal(bal.closingBalance, 31);
});

test('Page 35 payroll-monthly-register: enforces self-service scoping and strictly separates netPay vs paidAmount', async () => {
  const s1 = { _id: OID('a1'), name: 'Ali Raza', email: 'ali@test.edu', departmentId: { _id: OID('d1'), name: 'CS' } };
  const s2 = { _id: OID('a2'), name: 'Zainab Bibi', email: 'zainab@test.edu', departmentId: { _id: OID('d1'), name: 'CS' } };
  const payrollDocs = [
    { _id: OID('91'), staffId: s1, month: '2026-10', basicSalary: 80000, totalAllowances: 20000, totalDeductions: 5000, netSalary: 95000, paidAmount: 50000, status: 'PARTIALLY_PAID' },
    { _id: OID('92'), staffId: s2, month: '2026-10', basicSalary: 70000, totalAllowances: 10000, totalDeductions: 2000, netSalary: 78000, paidAmount: 78000, status: 'PAID' },
  ];

  stubMethod(models.User, 'findById', (id) => makeChain(
    String(id) === BASIC_USER.id
      ? { _id: OID('bb02'), refId: s1._id, email: 'ali@test.edu', permissions: { actions: BASIC_USER.permissions } }
      : null
  ));
  stubMethod(models.Staff, 'findOne', () => makeChain(s1));
  stubMethod(models.Department, 'find', () => makeChain([{ _id: OID('d1'), name: 'CS' }]));
  stubMethod(models.Payroll, 'find', (q) => {
    const filtered = q.staffId
      ? payrollDocs.filter(p => String(p.staffId._id) === String(q.staffId))
      : payrollDocs;
    return makeChain(filtered);
  });

  const selfRes = await staffHrMod.HANDLERS['payroll-monthly-register']({ month: '2026-10' }, BASIC_USER);
  assert.equal(selfRes.rows.length, 1);
  assert.equal(selfRes.rows[0].employeeName, 'Ali Raza');
  assert.equal(selfRes.rows[0].netPay, 'Rs 95,000');
  assert.equal(selfRes.rows[0].paidAmount, 'Rs 50,000');
  assert.equal(selfRes.rows[0].status, 'PARTIALLY_PAID');

  const adminRes = await staffHrMod.HANDLERS['payroll-monthly-register']({ month: '2026-10' }, ADMIN_USER);
  assert.equal(adminRes.rows.length, 2);
  assert.equal(adminRes.kpis[0].value, 'Rs 180,000'); // (80+20) + (70+10)
  assert.equal(adminRes.kpis[1].value, 'Rs 7,000');
  assert.equal(adminRes.kpis[2].value, 'Rs 173,000'); // 95+78
});

test('Page 36 finance-income-expense: discloses CASH vs ACCRUAL basis and produces bar chart', async () => {
  setupDefaultUserAndSessionStubs(null);
  stubMethod(models.FeePaymentReceipt, 'find', (q) => {
    assert.equal(q.status?.$ne, 'VOID');
    return makeChain([{ amountPaid: 120000, paidDate: new Date('2026-10-10'), status: 'ACTIVE', challanType: 'FeeChallan' }]);
  });
  stubMethod(models.FinanceIncome, 'find', () => makeChain([{ category: 'Transport Fee', amount: 15000, date: '2026-10-12' }]));
  stubMethod(models.Payroll, 'find', () => makeChain([{ netSalary: 80000, paidAmount: 50000, status: 'PARTIALLY_PAID' }]));
  stubMethod(models.FinanceExpense, 'find', () => makeChain([{ category: 'Utilities', amount: 10000, status: 'Approved', date: '2026-10-15' }]));
  stubMethod(models.HostelExpense, 'find', () => makeChain([{ title: 'Mess Gas', category: 'Mess', amount: 5000, date: '2026-10-18' }]));
  stubMethod(models.InventoryExpense, 'find', () => makeChain([{ expenseType: 'Stationery', amount: 3000, date: '2026-10-19' }]));

  const cashRes = await staffHrMod.HANDLERS['finance-income-expense']({ month: '2026-10', basis: 'CASH' }, ADMIN_USER);
  assert.match(cashRes.insight.message, /Cash basis/i);
  assert.equal(cashRes.charts[0].type, 'bar');
  assert.equal(cashRes.charts[0].xKey, 'category');
  assert.deepEqual(cashRes.charts[0].series.map((s) => s.dataKey), ['income', 'expense']);
  assert.equal(typeof cashRes.charts[0].data[0].income, 'number');
  assert.equal(typeof cashRes.charts[0].data[0].expense, 'number');
  // Income = 120000 + 15000 = 135000; Cash Expense = 50000 + 10000 + 5000 + 3000 = 68000; Net = 67000
  assert.equal(cashRes.kpis[0].value, 'Rs 135,000');
  assert.equal(cashRes.kpis[1].value, 'Rs 68,000');
  assert.equal(cashRes.kpis[2].value, 'Rs 67,000');

  const accRes = await staffHrMod.HANDLERS['finance-income-expense']({ month: '2026-10', basis: 'ACCRUAL' }, ADMIN_USER);
  assert.match(accRes.insight.message, /Accrual basis/i);
  // Accrual Expense = 80000 (netSalary) + 18000 = 98000
  assert.equal(accRes.kpis[1].value, 'Rs 98,000');
});

test('Page 37 finance-cash-bank-book: computes chronological running balance & Cash vs Bank closing table', async () => {
  setupDefaultUserAndSessionStubs(null);
  const cashW = { _id: OID('c1'), name: 'Main Cash Drawer', type: 'CASH', currentBalance: 45000, openingDebit: 20000, openingCredit: 0, status: 'ACTIVE' };
  const bankW = { _id: OID('b1'), name: 'HBL Main Bank', type: 'BANK', currentBalance: 100000, openingDebit: 100000, openingCredit: 0, status: 'ACTIVE' };
  stubMethod(models.Wallet, 'find', () => makeChain([cashW, bankW]));
  stubMethod(models.WalletTransaction, 'find', () => makeChain([
    // Pre-period cash deposit +10,000 => Cash opening = 30,000; Total opening = 130,000
    { _id: OID('11'), destinationWallet: cashW._id, transactionType: 'DEPOSIT', amount: 10000, date: '2026-09-25', description: 'Pre-period' },
    // In-period transactions:
    { _id: OID('12'), destinationWallet: cashW._id, transactionType: 'FEE_PAYMENT', amount: 25000, date: '2026-10-05', referenceNo: 'RV-01', description: 'Student fee receipt' },
    { _id: OID('13'), sourceWallet: cashW._id, transactionType: 'EXPENSE', amount: 10000, date: '2026-10-08', referenceNo: 'PV-02', description: 'Stationery payment' },
  ]));

  const res = await staffHrMod.HANDLERS['finance-cash-bank-book']({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }, ADMIN_USER);
  assert.equal(res.rows.length, 2);
  assert.equal(res.kpis[0].value, 'Rs 130,000'); // Opening
  assert.equal(res.kpis[1].value, 'Rs 25,000');  // Receipts
  assert.equal(res.kpis[2].value, 'Rs 10,000');  // Payments
  assert.equal(res.kpis[3].value, 'Rs 145,000'); // Closing
  assert.equal(res.rows[0].balance, 'Rs 155,000');
  assert.equal(res.rows[1].balance, 'Rs 145,000');
  assert.equal(res.secondaryTables.length, 1);
  assert.equal(res.secondaryTables[0].rows.some(r => r.type === 'CASH' && r.closingBalance === 'Rs 45,000'), true);
  assert.equal(res.secondaryTables[0].rows.some(r => r.type === 'BANK' && r.closingBalance === 'Rs 100,000'), true);
});

// ============================================================================
// PAGES 38-48: OPERATIONS & EXECUTIVE COMBINED REPORTS
// ============================================================================

test('Page 38 front-office-visitor-inquiry: combines visitors & inquiries with conversion KPIs', async () => {
  setupDefaultUserAndSessionStubs(null);
  stubMethod(models.FrontOfficeVisitor, 'find', () => makeChain([
    { _id: OID('f1'), visitorName: 'Mr. Kamran', purpose: 'Fee Inquiry', visitDate: '2026-10-05', assignedOfficerName: 'Admin Desk', outTime: '11:30' },
  ]));
  stubMethod(models.FrontOfficeInquiry, 'find', () => makeChain([
    { _id: OID('e1'), studentName: 'Ayesha', inquiryType: 'Admission', programInterest: { name: 'BSCS' }, assignedOfficerName: 'Sara', status: 'CONVERTED', createdAt: new Date('2026-10-06') },
    { _id: OID('e2'), studentName: 'Bilal', inquiryType: 'Admission', programInterest: { name: 'BBA' }, assignedOfficerName: 'Sara', status: 'FOLLOW_UP', followUpDate: new Date('2026-10-01'), createdAt: new Date('2026-10-07') },
  ]));
  stubMethod(models.Student, 'find', () => makeChain([]));

  const res = await opsExecMod.HANDLERS['front-office-visitor-inquiry']({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }, ADMIN_USER);
  assert.equal(res.rows.length, 3);
  assert.equal(res.kpis[0].value, '1');
  assert.equal(res.kpis[1].value, '2');
  assert.equal(res.kpis[2].value, '1'); // follow-up due
  assert.equal(res.kpis[3].value, '1'); // converted
});

test('Page 39 complaints-resolution-tracker & update-complaint-sla action: enforces privacy & updates SLA', async () => {
  setupDefaultUserAndSessionStubs(null);
  const compDoc = {
    _id: OID('c1'), category: 'Facilities', priority: 'High', status: 'Pending',
    details: 'Confidential grievance text', actionTaken: 'Private investigation notes',
    slaDueDate: new Date('2025-01-01'), createdAt: new Date('2025-01-01'),
    assignedToIds: [{ _id: OID('a1'), name: 'Estate Officer' }],
    save: async () => compDoc,
  };
  stubMethod(models.FrontOfficeComplaint, 'find', () => makeChain([compDoc]));
  stubMethod(models.FrontOfficeComplaint, 'findById', () => makeChain(compDoc));
  stubMethod(models.ActivityLog, 'create', () => Promise.resolve({}));

  const unpriv = await opsExecMod.HANDLERS['complaints-resolution-tracker']({}, BASIC_USER);
  assert.equal(JSON.stringify(unpriv.rows).includes('Confidential grievance text'), false);

  const priv = await opsExecMod.HANDLERS['complaints-resolution-tracker']({}, ADMIN_USER);
  assert.equal(priv.kpis[3].value, '1'); // Overdue

  await assert.rejects(
    () => opsExecMod.ACTIONS['update-complaint-sla'](
      { complaintId: compDoc._id.toString(), escalated: true },
      { reqUser: BASIC_USER, permCtx: { isSuper: false, permissions: { actions: BASIC_USER.permissions } } }
    ),
    (err) => err.statusCode === 403
  );

  const actRes = await opsExecMod.ACTIONS['update-complaint-sla'](
    { complaintId: compDoc._id.toString(), escalated: true, complainantNotified: true, status: 'Resolved' },
    { reqUser: ADMIN_USER, permCtx: { isSuper: false, permissions: { actions: ADMIN_USER.permissions } } }
  );
  assert.equal(actRes.success, true);
  assert.equal(compDoc.escalated, true);
  assert.equal(compDoc.complainantNotified, true);
  assert.equal(compDoc.status, 'Resolved');
});

test('Page 40 boarding-hostel-occupancy: respects active students & emits pie chart', async () => {
  setupDefaultUserAndSessionStubs(null);
  stubMethod(models.HostelRoom, 'find', () => makeChain([
    { _id: OID('a001'), hostelName: 'Jinnah Hall', blockFloor: 'Block A', roomNumber: '101', capacity: 4 },
  ]));
  stubMethod(models.HostelAllocation, 'find', () => makeChain([
    { _id: OID('b001'), roomId: OID('a001'), bedNumber: 'B1', registrationId: OID('c001'), studentId: OID('501'), status: 'active', allocationDate: new Date('2026-09-01') },
    { _id: OID('b002'), roomId: OID('a001'), bedNumber: 'B2', registrationId: OID('c002'), studentId: OID('502'), status: 'active', allocationDate: new Date('2026-09-01') },
  ]));
  stubMethod(models.HostelRegistration, 'find', () => makeChain([
    { _id: OID('c001'), roomId: OID('a001'), hostelName: 'Jinnah Hall', studentId: OID('501'), status: 'active' },
    { _id: OID('c002'), roomId: OID('a001'), hostelName: 'Jinnah Hall', studentId: OID('502'), status: 'active' },
  ]));
  // Only 501 matches active student list; 502 is withdrawn/alumni and excluded!
  stubMethod(models.Student, 'find', (filter) => {
    assert.ok(JSON.stringify(filter).includes('status'), 'Must filter active students');
    return makeChain([{ _id: OID('501'), fName: 'Hamza', lName: 'Tariq', programId: { name: 'BSCS' }, status: 'Active' }]);
  });

  const res = await opsExecMod.HANDLERS['boarding-hostel-occupancy']({}, ADMIN_USER);
  assert.equal(res.kpis[0].value, '4'); // total beds
  assert.equal(res.kpis[1].value, '1'); // only active student counts
  assert.equal(res.kpis[2].value, '3'); // vacant
  assert.equal(res.charts[0].type, 'pie');
  assert.equal(res.charts[0].nameKey, 'name');
  assert.equal(res.charts[0].dataKey, 'value');
  assert.equal(res.charts[0].series[0].dataKey, 'value');
  assert.deepEqual(res.charts[0].data, [
    { name: 'Occupied', value: 1 },
    { name: 'Vacant', value: 3 },
  ]);

  stubMethod(models.HostelRoom, 'find', () => makeChain([]));
  stubMethod(models.HostelAllocation, 'find', () => makeChain([]));
  stubMethod(models.HostelRegistration, 'find', () => makeChain([]));
  const emptyRes = await opsExecMod.HANDLERS['boarding-hostel-occupancy']({}, ADMIN_USER);
  assert.deepEqual(emptyRes.charts[0].data, []);
});

test('Page 41 inventory-stock-on-hand & record-stock-movement: exact StockMovement ledger formula up to asOfDate', async () => {
  setupDefaultUserAndSessionStubs(null);
  const itemNoMoves = { _id: OID('101'), sku: 'SKU-1', itemName: 'Chalk Box', category: 'Supplies', quantity: 25, openingStock: null, reorderLevel: 5, unit: 'box', unitPrice: 100 };
  const itemWithMoves = { _id: OID('102'), sku: 'SKU-2', itemName: 'A4 Paper Ream', category: 'Stationery', quantity: 150, openingStock: 50, reorderLevel: 40, unit: 'ream', unitPrice: 1000, save: async () => itemWithMoves };

  stubMethod(models.InventoryItem, 'find', () => makeChain([itemNoMoves, itemWithMoves]));
  stubMethod(models.InventoryItem, 'findById', () => makeChain(itemWithMoves));
  stubMethod(models.StockMovement, 'find', () => makeChain([
    { itemId: itemWithMoves._id, type: 'RECEIPT', quantity: 20, date: '2026-10-05' },
    { itemId: itemWithMoves._id, type: 'ISSUE', quantity: 15, date: '2026-10-10' },
    { itemId: itemWithMoves._id, type: 'ADJUSTMENT', quantity: -5, date: '2026-10-12' },
    { itemId: itemWithMoves._id, type: 'RECEIPT', quantity: 100, date: '2026-11-20' }, // after asOfDate!
  ]));
  let createdMovement = null;
  stubMethod(models.StockMovement, 'create', async (doc) => { createdMovement = doc; return doc; });
  stubMethod(models.ActivityLog, 'create', () => Promise.resolve({}));

  const res = await opsExecMod.HANDLERS['inventory-stock-on-hand']({ asOfDate: '2026-10-31' }, ADMIN_USER);
  const r1 = res.rows.find(r => r.sku === 'SKU-1');
  const r2 = res.rows.find(r => r.sku === 'SKU-2');
  assert.equal(r1.onHand, 25);
  assert.equal(r2.onHand, 50); // 50 + 20 - 5 - 15 = 50 (Nov 20 excluded)

  const act = await opsExecMod.ACTIONS['record-stock-movement'](
    { itemId: itemWithMoves._id.toString(), type: 'ISSUE', quantity: 10 },
    { reqUser: ADMIN_USER, permCtx: { isSuper: false, permissions: { actions: ADMIN_USER.permissions } } }
  );
  assert.equal(act.success, true);
  assert.equal(createdMovement.type, 'ISSUE');
  assert.equal(itemWithMoves.quantity, 140);
});

test('Page 42 inventory-purchase-grn & update-po-grn: legacy fallback & RECEIVED creates RECEIPT movement + increments item qty', async () => {
  setupDefaultUserAndSessionStubs(null);
  stubMethod(models.PurchaseOrder, 'find', () => makeChain([]));
  stubMethod(models.PurchaseOrder, 'countDocuments', () => Promise.resolve(0));
  stubMethod(models.InventoryExpense, 'find', () => makeChain([
    { _id: OID('e1'), expenseType: 'IT Equipment', vendor: 'Tech Co', amount: 85000, date: '2026-10-12', inventoryItemId: { itemName: 'Projector', category: 'IT', supplier: 'Tech Co' } },
  ]));

  const legacyRes = await opsExecMod.HANDLERS['inventory-purchase-grn']({}, ADMIN_USER);
  assert.equal(legacyRes.rows.length, 1);
  assert.equal(legacyRes.rows[0].supplierName, 'Tech Co');
  assert.equal(legacyRes.rows[0].totalValue, 'Rs 85,000');

  const invItem = { _id: OID('102'), itemName: 'A4 Paper', quantity: 10, openingStock: null, unitPrice: 500, save: async () => invItem };
  const poDoc = {
    _id: OID('201'), poNumber: 'PO-2026-0001', approvalStatus: 'PENDING', grnStatus: 'PENDING_RECEIPT', status: 'OPEN',
    items: [{ itemId: invItem._id, itemName: 'A4 Paper', category: 'Stationery', quantity: 30, unitPrice: 500 }],
    save: async () => poDoc,
  };
  stubMethod(models.PurchaseOrder, 'findById', () => makeChain(poDoc));
  stubMethod(models.InventoryItem, 'findById', () => makeChain(invItem));
  let receiptCreated = null;
  stubMethod(models.StockMovement, 'create', async (doc) => { receiptCreated = doc; return doc; });
  stubMethod(models.ActivityLog, 'create', () => Promise.resolve({}));

  let createdPo = null;
  stubMethod(models.PurchaseOrder, 'create', async (doc) => { createdPo = doc; return { ...doc, _id: OID('202') }; });
  const poCreateRes = await opsExecMod.ACTIONS['create-purchase-order'](
    { supplierName: 'Pak Stationery', items: [{ itemName: 'A4 Paper', category: 'Stationery', quantity: 20, unitPrice: 500 }] },
    { reqUser: ADMIN_USER, permCtx: { isSuper: false, permissions: { actions: ADMIN_USER.permissions } } }
  );
  assert.equal(poCreateRes.success, true);
  assert.equal(createdPo.totalValue, 10000);

  await opsExecMod.ACTIONS['update-po-grn'](
    { poId: poDoc._id.toString(), approvalStatus: 'APPROVED', grnStatus: 'RECEIVED' },
    { reqUser: ADMIN_USER, permCtx: { isSuper: false, permissions: { actions: ADMIN_USER.permissions } } }
  );
  assert.equal(poDoc.grnStatus, 'RECEIVED');
  assert.equal(receiptCreated.type, 'RECEIPT');
  assert.equal(receiptCreated.quantity, 30);
  assert.equal(invItem.quantity, 40);
});

test('Page 43 executive-monthly-overview: returns drilldownKey & drilldownFilters on every row', async () => {
  setupDefaultUserAndSessionStubs(null);
  stubMethod(models.Student, 'find', () => makeChain([{ _id: OID('501'), admissionDate: new Date('2026-10-10'), status: 'Active' }]));
  stubMethod(models.FeePaymentReceipt, 'find', () => makeChain([{ amountPaid: 50000, paidDate: new Date('2026-10-10'), status: 'ACTIVE' }]));
  stubMethod(models.FeeChallan, 'find', () => makeChain([{ netPayable: 20000, paidAmount: 0, dueDate: new Date('2026-10-20'), status: 'UNPAID' }]));
  stubMethod(models.Attendance, 'find', () => makeChain([{ studentId: OID('501'), role: 'STUDENT', date: '2026-10-10', status: 'PRESENT' }]));
  stubMethod(models.Exam, 'find', () => makeChain([{ _id: OID('301'), startDate: new Date('2026-10-12'), passPercentage: 50 }]));
  stubMethod(models.ExamResult, 'find', () => makeChain([{ studentId: OID('501'), examId: OID('301'), percentage: 80 }]));
  stubMethod(models.FrontOfficeComplaint, 'find', () => makeChain([{ _id: OID('c1'), slaDueDate: new Date('2026-10-25'), createdAt: new Date('2026-10-05'), priority: 'Medium' }]));
  stubMethod(models.FrontOfficeComplaint, 'countDocuments', () => Promise.resolve(2));

  const res = await opsExecMod.HANDLERS['executive-monthly-overview']({ month: '2026-10' }, ADMIN_USER);
  assert.equal(res.rows.length, 6);
  for (const row of res.rows) {
    assert.ok(row.drilldownKey, `Missing drilldownKey on row ${row.area}`);
    assert.equal(typeof row.drilldownFilters, 'object');
  }
});

test('Page 44 combined-student-risk-watchlist: deduplicates students across multiple attendance, fee & exam records', async () => {
  setupDefaultUserAndSessionStubs(null);
  const stu1 = { _id: OID('501'), rollNumber: 'R-01', fName: 'Omar', lName: 'Farooq', programId: { name: 'BSCS' }, status: 'Active' };
  stubMethod(models.Student, 'find', () => makeChain([stu1]));
  stubMethod(models.Attendance, 'find', () => makeChain([
    { studentId: stu1._id, status: 'PRESENT' },
    { studentId: stu1._id, status: 'ABSENT' },
    { studentId: stu1._id, status: 'ABSENT' }, // 33.3%
  ]));
  stubMethod(models.FeeChallan, 'find', () => makeChain([
    { studentId: stu1._id, netPayable: 8000, paidAmount: 0, status: 'UNPAID' },
    { studentId: stu1._id, netPayable: 7000, paidAmount: 0, status: 'OVERDUE' }, // Rs 15,000 total
  ]));
  stubMethod(models.ExamResult, 'find', () => makeChain([
    { studentId: stu1._id, examId: { totalMarks: 100, startDate: '2026-10-01' }, percentage: 40, createdAt: new Date('2026-10-01') },
    { studentId: stu1._id, examId: { totalMarks: 100, startDate: '2026-10-15' }, percentage: 35, createdAt: new Date('2026-10-15') },
  ]));

  const res = await opsExecMod.HANDLERS['combined-student-risk-watchlist']({}, ADMIN_USER);
  assert.equal(res.rows.length, 1, 'Must never duplicate student rows');
  assert.match(res.rows[0].studentName, /R-01/);
  assert.equal(res.rows[0].feeBalance, 'Rs 15,000');
  assert.equal(res.rows[0].latestExamPct, '35.0%');
});

test('Page 45 combined-class-health: explicitly includes underlying source date windows in insight', async () => {
  setupDefaultUserAndSessionStubs(null);
  const prog = { _id: OID('401'), name: 'BSCS' };
  const cls = { _id: OID('402'), name: 'Sem 1' };
  const stu = { _id: OID('501'), programId: prog, classId: cls, status: 'Active' };
  stubMethod(models.Student, 'find', () => makeChain([stu]));
  stubMethod(models.Attendance, 'find', () => makeChain([{ studentId: stu._id, status: 'PRESENT', date: '2026-10-01' }]));
  stubMethod(models.FeeChallan, 'find', () => makeChain([{ studentId: stu._id, netPayable: 50000, paidAmount: 40000, status: 'PARTIAL' }]));
  stubMethod(models.ExamResult, 'find', () => makeChain([{ studentId: stu._id, examId: { passPercentage: 50, startDate: '2026-10-31' }, percentage: 75 }]));

  const res = await opsExecMod.HANDLERS['combined-class-health']({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }, ADMIN_USER);
  assert.equal(res.rows.length, 1);
  assert.match(res.insight.message, /2026-10-01/);
  assert.match(res.insight.message, /2026-10-31/);
});

test('Page 46 combined-admission-first-fee: strictly joins inquiry -> student -> installmentNumber 1', async () => {
  setupDefaultUserAndSessionStubs(null);
  const inq = { _id: OID('601'), studentName: 'Maryam', applicationId: 'APP-01', status: 'CONVERTED', programInterest: { name: 'BBA' }, createdAt: new Date('2026-09-10') };
  const stu = { _id: OID('501'), fName: 'Maryam', lName: 'Noor', inquiryId: inq._id, admissionDate: new Date('2026-09-12'), status: 'Active' };
  stubMethod(models.FrontOfficeInquiry, 'find', () => makeChain([inq]));
  stubMethod(models.Student, 'find', () => makeChain([stu]));
  stubMethod(models.FeeChallan, 'find', () => makeChain([
    { _id: OID('701'), studentId: stu._id, installmentNumber: 1, netPayable: 45000, paidAmount: 45000, status: 'PAID', paidDate: new Date('2026-09-13') },
    { _id: OID('702'), studentId: stu._id, installmentNumber: 2, netPayable: 99000, paidAmount: 0, status: 'UNPAID' }, // Installment 2 ignored!
  ]));
  stubMethod(models.FeePaymentReceipt, 'find', () => makeChain([
    { challanId: OID('701'), studentId: stu._id, challanType: 'FeeChallan', amountPaid: 45000, paidDate: new Date('2026-09-13'), status: 'ACTIVE' },
  ]));

  const res = await opsExecMod.HANDLERS['combined-admission-first-fee']({}, ADMIN_USER);
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].firstInstStatus, 'PAID');
  assert.equal(res.rows[0].firstFeeDue, 'Rs 45,000');
  assert.equal(res.rows[0].paid, 'Rs 45,000');
  assert.equal(res.rows[0].balance, 'Rs 0');
});

test('Page 47 combined-management-exceptions: non-sensitive refs only, surfaces Student.documents & drilldowns', async () => {
  setupDefaultUserAndSessionStubs(null);
  const stu = { _id: OID('501'), rollNumber: 'ROLL-99', fName: 'SensitiveName', parentOrGuardianPhone: '03009999999', documents: { cnic: false, transcript: true }, status: 'Active' };
  stubMethod(models.Student, 'find', () => makeChain([stu]));
  stubMethod(models.FeeChallan, 'find', () => makeChain([
    { _id: OID('801'), studentId: stu._id, challanNo: 'CC-1001', dueDate: new Date('2025-01-01'), netPayable: 25000, paidAmount: 0, status: 'OVERDUE' },
  ]));
  stubMethod(models.Attendance, 'find', () => makeChain([
    { studentId: stu._id, status: 'ABSENT' },
  ]));
  stubMethod(models.FrontOfficeInquiry, 'find', () => makeChain([]));
  stubMethod(models.FrontOfficeComplaint, 'find', () => makeChain([
    { _id: OID('901'), priority: 'Critical', createdAt: new Date('2025-01-01'), assignedToIds: [{ name: 'Proctor' }] },
  ]));

  const res = await opsExecMod.HANDLERS['combined-management-exceptions']({}, ADMIN_USER);
  assert.equal(res.rows.length, 4); // Fee + Att + Student.documents + Complaint
  const json = JSON.stringify(res);
  assert.equal(json.includes('SensitiveName'), false);
  assert.equal(json.includes('03009999999'), false);
  assert.equal(res.rows.every(r => Boolean(r.drilldownKey)), true);
});

test('Page 48 report-centre-audit-log: lists export history & print/view count without sensitive payloads', async () => {
  setupDefaultUserAndSessionStubs(null);
  stubMethod(models.ReportExportLog, 'find', () => makeChain([
    { _id: OID('a01'), timestamp: new Date('2026-10-15T10:00:00Z'), userName: 'Admin', reportName: 'Employee Directory', format: 'EXCEL', recordCount: 42, filtersSummary: 'Status: ACTIVE', sensitiveSecret: 'secret-cnic' },
    { _id: OID('a02'), timestamp: new Date('2026-10-16T11:00:00Z'), userName: 'Principal', reportName: 'Fee Summary', format: 'PRINT', recordCount: 15, filtersSummary: 'All' },
  ]));

  const res = await opsExecMod.HANDLERS['report-centre-audit-log']({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }, ADMIN_USER);
  assert.equal(res.kpis[0].value, '2');
  assert.equal(res.kpis[2].value, '1'); // Excel exports
  assert.equal(res.kpis[3].label, 'Print / views');
  assert.equal(res.kpis[3].value, '1');
  assert.equal(JSON.stringify(res.rows).includes('secret-cnic'), false);
});

test('Operations inline actions reject invalid payloads and parse string booleans safely', async () => {
  setupDefaultUserAndSessionStubs(null);
  await assert.rejects(
    () => opsExecMod.ACTIONS['update-complaint-sla']({ complaintId: 'bad-id' }, ADMIN_USER),
    (err) => err.statusCode === 400
  );
  await assert.rejects(
    () => opsExecMod.ACTIONS['record-stock-movement']({ itemId: OID('a001').toString(), type: 'RECEIPT', quantity: 0 }, ADMIN_USER),
    (err) => err.statusCode === 400
  );
  await assert.rejects(
    () => opsExecMod.ACTIONS['create-purchase-order']({ supplierName: 'ABC' }, ADMIN_USER),
    (err) => err.statusCode === 400
  );
  await assert.rejects(
    () => opsExecMod.ACTIONS['update-po-grn']({ poId: '' }, ADMIN_USER),
    (err) => err.statusCode === 400
  );

  // String "false" for escalated should coerce to false, not Boolean("false") === true
  const complaintDoc = {
    _id: OID('c009'),
    status: 'Pending',
    priority: 'High',
    escalated: true,
    escalatedAt: new Date(),
    complainantNotified: true,
    saveCount: 0,
    async save() { this.saveCount += 1; },
  };
  stubMethod(models.FrontOfficeComplaint, 'findById', () => Promise.resolve(complaintDoc));
  const slaRes = await opsExecMod.ACTIONS['update-complaint-sla'](
    { complaintId: String(complaintDoc._id), status: 'In Progress', escalated: 'false', complainantNotified: 'false' },
    ADMIN_USER
  );
  assert.equal(slaRes.success, true);
  assert.equal(complaintDoc.escalated, false);
  assert.equal(complaintDoc.escalatedAt, null);
  assert.equal(complaintDoc.complainantNotified, false);
});
