const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  ActivityLog,
  Staff,
  User,
  Student,
  FeeChallan,
  ExtraChallan,
  FeeHead,
  FeeStructure,
  FeeSettings,
  FinanceExpense,
  FinanceIncome,
  FinanceClosing,
  FinanceCategory,
  InventoryItem,
  InventoryExpense,
  Wallet,
  WalletTransaction,
  FrontOfficeInquiry,
  FrontOfficeVisitor,
  FrontOfficeComplaint,
  FrontOfficeContact,
  Department,
  Holiday,
  AttendanceSkip,
  AcademicSession,
  Program,
  Class,
  Section,
  Subject,
  SubjectClassMapping,
  TeacherMapping,
  Timetable,
  Exam,
  ExamMarks,
  ExamResult,
  HostelRoom,
  HostelAllocation,
  HostelRegistration,
  HostelExpense,
  HostelInventory,
  HostelChallan,
  Payroll,
  PayrollTemplate,
  AdvanceSalary,
  Leave,
  StaffIdSettings,
  InstituteSettings,
  Template,
} = require('../models');

// URLs strictly excluded from logging to prevent spam and anonymous logs
const EXCLUDED_PATHS = [
  '/api/auth/user-who',
  '/api/auth/me',
  '/api/auth/refresh',
  '/api/auth/refresh-token',
  '/api/auth/verify',
  '/api/auth/check',
  '/api/health',
  '/api/configuration/activity-logs',
  '/profile',
  '/uploads',
  '/favicon.ico',
];

/**
 * Safely format numbers into currency/amounts
 */
const fmtAmt = (val) => {
  if (val === null || val === undefined || val === '') return '0';
  const n = Number(val);
  return isNaN(n) ? String(val) : n.toLocaleString('en-US');
};

/**
 * Format month string (e.g. '2026-10' -> 'October', '10' -> 'October')
 */
const formatMonthStr = (m) => {
  if (!m) return 'Current';
  const str = String(m).trim();
  const parts = str.split('-');
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const idx = parseInt(parts[1], 10) - 1;
    if (idx >= 0 && idx < 12) {
      return monthNames[idx];
    }
  }
  return str;
};

/**
 * Compute clean human-readable text diff of modified fields
 * e.g. "feeAmount: '5000' → '6000', dueDate: '10-Oct' → '15-Oct'"
 */
const getFieldChangesSummary = (beforeDoc, body, ignoredFields = []) => {
  if (!beforeDoc || !body || typeof body !== 'object') return '';
  const changes = [];
  const defaultIgnored = [
    '_id', 'id', 'updatedAt', 'createdAt', '__v', 'password', 'history', 'actionAudit',
    'studentId', 'staffId', 'programId', 'classId', 'sectionId', 'roomId', 'sessionId',
    'htmlContent', 'cssContent',
    'selectedHeads', 'challanHeads', 'feeHeads', 'heads', 'installments', 'documents',
    'subjects', 'mappings', 'items', 'rules', 'timetable', 'periods', 'logs'
  ];
  const ignore = new Set([...defaultIgnored, ...ignoredFields]);

  for (const [key, newVal] of Object.entries(body)) {
    if (ignore.has(key)) continue;
    if (newVal === undefined) continue;

    const oldVal = beforeDoc[key];

    // If both are dates or date-strings, check if they represent the exact same calendar day
    if (oldVal && newVal && (oldVal instanceof Date || typeof oldVal === 'string') && (newVal instanceof Date || typeof newVal === 'string')) {
      const d1 = new Date(oldVal);
      const d2 = new Date(newVal);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        if (d1.toISOString().split('T')[0] === d2.toISOString().split('T')[0]) {
          continue; // identical day, skip false diff
        }
      }
    }

    // Skip raw array/object dumps in generic scalar summary to avoid technical noise
    if (Array.isArray(newVal) || (typeof newVal === 'object' && newVal !== null && !(newVal instanceof Date))) {
      continue;
    }

    const oldStr = (oldVal !== null && oldVal !== undefined)
      ? (typeof oldVal === 'object' ? (oldVal._id || JSON.stringify(oldVal)) : String(oldVal))
      : '';
    const newStr = (newVal !== null && newVal !== undefined)
      ? (typeof newVal === 'object' ? (newVal._id || JSON.stringify(newVal)) : String(newVal))
      : '';

    if (oldStr !== newStr && newStr !== '') {
      changes.push(`${key}: '${oldStr || 'None'}' → '${newStr}'`);
    }
  }

  return changes.length > 0 ? changes.join(', ') : '';
};

/**
 * Dedicated clean diff for Challan Updates (e.g. Added Head 'Prospectus Fee' (PKR 1,200))
 */
const getChallanUpdateSummary = (beforeDoc, body) => {
  if (!beforeDoc && !body) return '';
  const changes = [];

  // 1. Fee Heads diff
  const extractHeads = (docOrArr) => {
    let arr = [];
    if (Array.isArray(docOrArr)) {
      arr = docOrArr;
    } else if (docOrArr && typeof docOrArr === 'object') {
      arr = docOrArr.challanHeads || docOrArr.selectedHeads || [];
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch (e) { arr = []; }
      }
    }
    return (Array.isArray(arr) ? arr : [])
      .filter(h => h && typeof h === 'object' && (h.name || h.title))
      .map(h => ({
        id: String(h.headId || h.id || h._id || h.name).toLowerCase().trim(),
        name: String(h.name || h.title).trim(),
        amount: Number(h.amount || 0),
      }));
  };

  const oldHeads = beforeDoc ? extractHeads(beforeDoc) : [];
  const newHeads = extractHeads(body);

  if (body.selectedHeads !== undefined || body.challanHeads !== undefined) {
    const oldMap = new Map();
    for (const h of oldHeads) {
      oldMap.set(h.id, h);
    }

    const newMap = new Map();
    for (const h of newHeads) {
      newMap.set(h.id, h);
    }

    // Check for added heads
    for (const [key, newH] of newMap.entries()) {
      if (!oldMap.has(key)) {
        changes.push(`Added Head '${newH.name}' (PKR ${fmtAmt(newH.amount)})`);
      } else {
        const oldH = oldMap.get(key);
        if (oldH.amount !== newH.amount) {
          changes.push(`Head '${newH.name}': PKR ${fmtAmt(oldH.amount)} → PKR ${fmtAmt(newH.amount)}`);
        }
      }
    }

    // Check for removed heads
    for (const [key, oldH] of oldMap.entries()) {
      if (!newMap.has(key)) {
        changes.push(`Removed Head '${oldH.name}'`);
      }
    }
  }

  // 2. Due Date diff (Normalize YYYY-MM-DD so ISO timestamp vs date string are not falsely flagged)
  if (body.dueDate !== undefined && beforeDoc?.dueDate !== undefined) {
    const norm = (d) => {
      if (!d) return '';
      try {
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? String(d).split('T')[0] : dt.toISOString().split('T')[0];
      } catch (e) {
        return String(d);
      }
    };
    const oldD = norm(beforeDoc.dueDate);
    const newD = norm(body.dueDate);
    if (oldD && newD && oldD !== newD) {
      changes.push(`Due Date: ${oldD} → ${newD}`);
    }
  }

  // 3. Tuition / Base Amount
  if (body.amount !== undefined && beforeDoc?.amount !== undefined) {
    const oldAmt = Number(beforeDoc.amount || 0);
    const newAmt = Number(body.amount || 0);
    if (oldAmt !== newAmt) {
      changes.push(`Tuition: PKR ${fmtAmt(oldAmt)} → PKR ${fmtAmt(newAmt)}`);
    }
  }

  // 4. Fine / Late Fee Amount
  if (body.fineAmount !== undefined || body.lateFeeAmount !== undefined) {
    const oldFine = Number(beforeDoc?.fineAmount ?? beforeDoc?.lateFeeAmount ?? 0);
    const newFine = Number(body.fineAmount ?? body.lateFeeAmount ?? 0);
    if (oldFine !== newFine) {
      changes.push(`Late Fine: PKR ${fmtAmt(oldFine)} → PKR ${fmtAmt(newFine)}`);
    }
  }

  // 5. Discount Amount
  if (body.discountAmount !== undefined || body.discount !== undefined) {
    const oldDisc = Number(beforeDoc?.discountAmount ?? beforeDoc?.discount ?? 0);
    const newDisc = Number(body.discountAmount ?? body.discount ?? 0);
    if (oldDisc !== newDisc) {
      changes.push(`Discount: PKR ${fmtAmt(oldDisc)} → PKR ${fmtAmt(newDisc)}`);
    }
  }

  // 6. Status change
  if (body.status && beforeDoc?.status && body.status !== beforeDoc.status) {
    changes.push(`Status: ${beforeDoc.status} → ${body.status}`);
  }

  // 7. Remarks
  if (body.remarks !== undefined) {
    const oldRem = String(beforeDoc?.remarks || '').trim();
    const newRem = String(body.remarks || '').trim();
    if (oldRem !== newRem && (oldRem !== '' || newRem !== '')) {
      changes.push(`Remarks: '${oldRem || 'None'}' → '${newRem}'`);
    }
  }

  return changes.length > 0 ? changes.join(', ') : '';
};

/**
 * Pre-fetch snapshot of existing document before PUT/PATCH/DELETE
 */
const preFetchBeforeDoc = async (req) => {
  const url = req.originalUrl || req.url;
  const cleanPath = url.split('?')[0].toLowerCase();

  const idFromQuery = req.query?.sessionID || req.query?.sessionId || req.query?.programID || req.query?.classID || req.query?.sectionID || req.query?.secID || req.query?.subjectID || req.query?.studentID || req.query?.studentId || req.query?.challanID || req.query?.challanId || req.query?.staffId || req.query?.id || req.query?._id || req.query?.roomId || req.query?.payrollId || req.query?.depID;
  const idFromBody = req.body?.sessionID || req.body?.sessionId || req.body?.programID || req.body?.classID || req.body?.sectionID || req.body?.secID || req.body?.subjectID || req.body?.studentID || req.body?.studentId || req.body?.challanId || req.body?.staffId || req.body?.id || req.body?._id || req.body?.roomId || req.body?.payrollId || req.body?.depID;
  const idFromPath = url.match(/\/([a-f0-9]{24})(?:[/?#]|$)/i)?.[1];
  const targetId = idFromQuery || idFromPath || idFromBody;

  let Model = null;
  if (cleanPath.startsWith('/api/finance/expense')) Model = FinanceExpense;
  else if (cleanPath.startsWith('/api/finance/income')) Model = FinanceIncome;
  else if (cleanPath.startsWith('/api/finance/categories')) Model = FinanceCategory;
  else if (cleanPath.startsWith('/api/student')) Model = Student;
  else if (cleanPath.startsWith('/api/fee-management/extra-challan') || cleanPath.startsWith('/api/fee/challans/extra') || cleanPath.startsWith('/api/fee/extra-challan')) Model = ExtraChallan;
  else if (cleanPath.startsWith('/api/fee-management/challan') || cleanPath.startsWith('/api/fee/challan')) Model = FeeChallan;
  else if (cleanPath.startsWith('/api/fee/head')) Model = FeeHead;
  else if (cleanPath.startsWith('/api/fee/structure')) Model = FeeStructure;
  else if (cleanPath.startsWith('/api/fee/settings')) Model = FeeSettings;
  else if (cleanPath.startsWith('/api/hr/staff-id-settings')) Model = StaffIdSettings;
  else if (cleanPath.startsWith('/api/hr/staff') || cleanPath.startsWith('/api/staff')) Model = Staff;
  else if (cleanPath.startsWith('/api/department')) Model = Department;
  else if (cleanPath.startsWith('/api/hr/advance-salary')) Model = AdvanceSalary;
  else if (cleanPath.startsWith('/api/hr/payroll-template')) Model = PayrollTemplate;
  else if (cleanPath.startsWith('/api/hr/payroll')) Model = Payroll;
  else if (cleanPath.startsWith('/api/hr/leave') || cleanPath.startsWith('/api/hr/staff-leaves')) Model = Leave;
  else if (cleanPath.startsWith('/api/hr/holidays')) Model = Holiday;
  else if (cleanPath.startsWith('/api/attendance/leave')) Model = Leave;
  else if (cleanPath.startsWith('/api/hostel/rooms')) Model = HostelRoom;
  else if (cleanPath.startsWith('/api/hostel/allocations')) Model = HostelAllocation;
  else if (cleanPath.startsWith('/api/hostel/registrations')) Model = HostelRegistration;
  else if (cleanPath.startsWith('/api/hostel/expenses')) Model = HostelExpense;
  else if (cleanPath.startsWith('/api/hostel/inventory')) Model = HostelInventory;
  else if (cleanPath.startsWith('/api/hostel/challans') || cleanPath.startsWith('/api/hostel/external-challans')) Model = HostelChallan;
  else if (cleanPath.startsWith('/api/front-office/inquir')) Model = FrontOfficeInquiry;
  else if (cleanPath.startsWith('/api/front-office/visitor')) Model = FrontOfficeVisitor;
  else if (cleanPath.startsWith('/api/front-office/complaint')) Model = FrontOfficeComplaint;
  else if (cleanPath.startsWith('/api/front-office/contact')) Model = FrontOfficeContact;
  else if (cleanPath.startsWith('/api/inventory/expenses')) Model = InventoryExpense;
  else if (cleanPath.startsWith('/api/inventory')) Model = InventoryItem;
  else if (cleanPath.startsWith('/api/wallets')) Model = Wallet;
  else if (cleanPath.startsWith('/api/academics/session')) Model = AcademicSession;
  else if (cleanPath.startsWith('/api/academics/program')) Model = Program;
  else if (cleanPath.startsWith('/api/academics/class')) Model = Class;
  else if (cleanPath.startsWith('/api/academics/section')) Model = Section;
  else if (cleanPath.startsWith('/api/academics/subject')) Model = Subject;
  else if (cleanPath.startsWith('/api/academics/scm')) Model = SubjectClassMapping;
  else if (cleanPath.startsWith('/api/academics/tcm') || cleanPath.startsWith('/api/academics/tsm')) Model = TeacherMapping;
  else if (cleanPath.startsWith('/api/academics/timetable')) Model = Timetable;
  else if (cleanPath.startsWith('/api/exams')) Model = Exam;
  else if (cleanPath.startsWith('/api/configuration/institute-settings')) Model = InstituteSettings;
  else if (cleanPath.includes('template')) Model = Template;

  if (!Model) return;

  try {
    if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
      const doc = await Model.findById(targetId).lean();
      if (doc) req._beforeDoc = doc;
    } else if (cleanPath.includes('settings')) {
      const doc = await Model.findOne().lean();
      if (doc) req._beforeDoc = doc;
    }
  } catch (err) {
    // Silent fail on pre-fetch
  }
};

/**
 * Fast Entity Name Resolvers
 */
const resolveStudent = async (idOrDoc) => {
  if (!idOrDoc) return null;
  if (typeof idOrDoc === 'object' && (idOrDoc.fName || idOrDoc.studentName || idOrDoc.name)) {
    const name = idOrDoc.studentName || idOrDoc.name || `${idOrDoc.fName || ''} ${idOrDoc.lName || ''}`.trim();
    const fatherName = idOrDoc.fatherOrguardian || idOrDoc.fatherName || '';
    const roll = idOrDoc.rollNumber || idOrDoc.rollNo || '';
    return { name, fatherName, roll: roll ? ` (Roll: ${roll})` : '' };
  }
  const id = typeof idOrDoc === 'object' ? (idOrDoc._id || idOrDoc.id) : idOrDoc;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  try {
    const s = await Student.findById(id).select('fName lName fatherOrguardian rollNumber').lean();
    if (s) {
      const name = `${s.fName || ''} ${s.lName || ''}`.trim() || 'Student';
      const fatherName = s.fatherOrguardian || '';
      const roll = s.rollNumber ? ` (Roll: ${s.rollNumber})` : '';
      return { name, fatherName, roll };
    }
  } catch (e) {}
  return null;
};

const resolveStaff = async (idOrDoc) => {
  if (!idOrDoc) return null;
  if (typeof idOrDoc === 'object' && (idOrDoc.name || idOrDoc.staffName)) {
    const name = idOrDoc.name || idOrDoc.staffName;
    const fatherName = idOrDoc.fatherName || '';
    const designation = idOrDoc.designation || '';
    const staffId = idOrDoc.staffId ? ` (Staff ID: ${idOrDoc.staffId})` : '';
    return { name, fatherName, designation, staffId };
  }
  const id = typeof idOrDoc === 'object' ? (idOrDoc._id || idOrDoc.id) : idOrDoc;
  if (!id) return null;
  try {
    let s = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      s = await Staff.findById(id).select('name fatherName designation staffId').lean();
    }
    if (!s) {
      s = await Staff.findOne({ staffId: String(id).trim() }).select('name fatherName designation staffId').lean();
    }
    if (s) {
      return {
        name: s.name,
        fatherName: s.fatherName || '',
        designation: s.designation || '',
        staffId: s.staffId ? ` (Staff ID: ${s.staffId})` : '',
      };
    }
  } catch (e) {}
  return null;
};

const resolveClassSectionProgram = async (programId, classId, sectionId) => {
  let progName = '';
  let clsName = '';
  let secName = '';
  if (programId && mongoose.Types.ObjectId.isValid(programId)) {
    try {
      const p = await Program.findById(programId).select('name').lean();
      if (p) progName = p.name;
    } catch (e) {}
  }
  if (classId && mongoose.Types.ObjectId.isValid(classId)) {
    try {
      const c = await Class.findById(classId).select('name programId').lean();
      if (c) {
        clsName = c.name;
        if (!progName && c.programId) {
          const p = await Program.findById(c.programId).select('name').lean();
          if (p) progName = p.name;
        }
      }
    } catch (e) {}
  }
  if (sectionId && mongoose.Types.ObjectId.isValid(sectionId)) {
    try {
      const s = await Section.findById(sectionId).select('name').lean();
      if (s) secName = s.name;
    } catch (e) {}
  }
  return { progName, clsName, secName };
};

const resolveRoom = async (roomIdOrDoc) => {
  if (!roomIdOrDoc) return null;
  if (typeof roomIdOrDoc === 'object' && roomIdOrDoc.roomNumber) {
    return `Room ${roomIdOrDoc.roomNumber}`;
  }
  const id = typeof roomIdOrDoc === 'object' ? (roomIdOrDoc._id || roomIdOrDoc.id) : roomIdOrDoc;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  try {
    const r = await HostelRoom.findById(id).select('roomNumber floor').lean();
    if (r) return `Room ${r.roomNumber}${r.floor ? ` (${r.floor})` : ''}`;
  } catch (e) {}
  return null;
};

const resolveSubject = async (subjectIdOrDoc) => {
  if (!subjectIdOrDoc) return '';
  if (typeof subjectIdOrDoc === 'object' && subjectIdOrDoc.name) {
    return subjectIdOrDoc.name;
  }
  const id = typeof subjectIdOrDoc === 'object' ? (subjectIdOrDoc._id || subjectIdOrDoc.id) : subjectIdOrDoc;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return '';
  try {
    const s = await Subject.findById(id).select('name').lean();
    if (s) return s.name;
  } catch (e) {}
  return '';
};

/**
 * MODULE-SPECIFIC FORMATTERS WITH PRECISE ENTITY RESOLUTION
 */

// 1. Finance - Expenses (Expense titles and categories strictly here)
const formatExpenseLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  const isAdd = method === 'POST';
  const isUpdate = ['PUT', 'PATCH'].includes(method);
  const isDelete = method === 'DELETE';

  const doc = beforeDoc || respDoc || body;
  const title = doc.title || doc.description || doc.category || 'Expense';
  const cat = body.category || doc.category || 'General';
  const subCat = body.subCategory || doc.subCategory || '';
  const subCatStr = subCat ? ` (${subCat})` : '';
  const amt = fmtAmt(body.amount ?? doc.amount);
  const voucher = doc.voucherNo ? ` (Voucher: ${doc.voucherNo})` : '';

  if (cleanPath.includes('/approve')) {
    return {
      module: 'Expenses',
      subModule: 'Expense',
      action: 'Expense Approved',
      actionType: 'STATUS',
      details: `User: ${userName}, Action: Approve Expense for '${title}'${voucher}, Category: '${cat}'${subCatStr}, Amount: PKR ${amt}`,
    };
  }

  if (cleanPath.includes('/reject')) {
    return {
      module: 'Expenses',
      subModule: 'Expense',
      action: 'Expense Rejected',
      actionType: 'STATUS',
      details: `User: ${userName}, Action: Reject Expense for '${title}'${voucher}, Category: '${cat}'${subCatStr}, Amount: PKR ${amt}`,
    };
  }

  if (isAdd) {
    const wallet = doc.walletName ? `, Paid From: '${doc.walletName}'` : '';
    return {
      module: 'Expenses',
      subModule: 'Expense',
      action: 'Expense Added',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Add Expense for '${title}', Category: '${cat}'${subCatStr}, Amount: PKR ${amt}${voucher}${wallet}`,
    };
  }

  if (isUpdate) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Expenses',
      subModule: 'Expense',
      action: 'Update Expense',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Expense for '${title}'${voucher}, Category: '${cat}'${subCatStr}, Amount: PKR ${amt}${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  if (isDelete) {
    return {
      module: 'Expenses',
      subModule: 'Expense',
      action: 'Expense Deleted',
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Delete Expense for '${title}', Category: '${cat}'${subCatStr}, Amount: PKR ${amt}${voucher}`,
    };
  }

  return null;
};

// 2. Finance - Income (category, sub category, amount)
const formatIncomeLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  const isAdd = method === 'POST';
  const isUpdate = ['PUT', 'PATCH'].includes(method);
  const isDelete = method === 'DELETE';

  const doc = respDoc || beforeDoc || body;
  const source = doc.source || doc.title || 'Income';
  const cat = body.category || doc.category || 'General';
  const subCat = body.subCategory || doc.subCategory || '';
  const subCatStr = subCat ? ` (${subCat})` : '';
  const amt = fmtAmt(body.amount ?? doc.amount);

  if (isAdd) {
    const receipt = doc.receiptNo ? `, Receipt: ${doc.receiptNo}` : '';
    const wallet = doc.walletName ? `, Deposited To: '${doc.walletName}'` : '';
    return {
      module: 'Income',
      subModule: 'Income',
      action: 'Income Added',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Add Income for '${source}', Category: '${cat}'${subCatStr}, Amount: PKR ${amt}${receipt}${wallet}`,
    };
  }

  if (isUpdate) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Income',
      subModule: 'Income',
      action: 'Update Income',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Income for '${source}', Category: '${cat}'${subCatStr}, Amount: PKR ${amt}${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  if (isDelete) {
    return {
      module: 'Income',
      subModule: 'Income',
      action: 'Income Deleted',
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Delete Income for '${source}', Category: '${cat}'${subCatStr}, Amount: PKR ${amt}`,
    };
  }

  return null;
};

// 3. Finance - Cash Closing (as per current)
const formatClosingLog = async (method, body, respDoc, beforeDoc, userName) => {
  const dateStr = body.closingDate || body.date || new Date().toISOString().split('T')[0];
  const sysCash = fmtAmt(body.systemCash);
  const actCash = fmtAmt(body.actualCash);
  const diff = fmtAmt(body.difference || 0);

  return {
    module: 'Closing',
    subModule: 'Daily Closing',
    action: 'Drawer Closed',
    actionType: 'PAYMENT',
    details: `User: ${userName}, Action: Cash Drawer Closing for Date: ${dateStr}, System Cash: PKR ${sysCash}, Actual Cash: PKR ${actCash}, Discrepancy: PKR ${diff}`,
  };
};

// 4. Finance - Settings (Categories & Subcategories)
const formatFinanceSettingsLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  const isAdd = method === 'POST';
  const isUpdate = ['PUT', 'PATCH'].includes(method);
  const isDelete = method === 'DELETE';
  const catName = body.name || beforeDoc?.name || respDoc?.name || 'Category';

  if (isAdd) {
    return {
      module: 'Finance',
      subModule: 'Finance Settings',
      action: 'Finance Category Created',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Create Finance Category for '${catName}', Type: '${body.type || 'Expense'}'`,
    };
  }
  if (isUpdate) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Finance',
      subModule: 'Finance Settings',
      action: 'Update Finance Category',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Finance Category for '${catName}'${changes ? `, Updated: ${changes}` : ''}`,
    };
  }
  if (isDelete) {
    return {
      module: 'Finance',
      subModule: 'Finance Settings',
      action: 'Finance Category Deleted',
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Delete Finance Category for '${catName}'`,
    };
  }
  return null;
};

// 5. Students - Admissions & Directory (student name/fathername)
const formatStudentLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  const isAdd = method === 'POST';
  const isUpdate = ['PUT', 'PATCH'].includes(method);
  const isDelete = method === 'DELETE';

  const doc = respDoc || beforeDoc || body;
  const stName = `${doc.fName || ''} ${doc.lName || ''}`.trim() || doc.name || 'Student';
  const father = doc.fatherOrguardian || doc.fatherName || beforeDoc?.fatherOrguardian || body.fatherOrguardian || 'N/A';
  const roll = doc.rollNumber ? ` (Roll: ${doc.rollNumber})` : (beforeDoc?.rollNumber ? ` (Roll: ${beforeDoc.rollNumber})` : '');

  if (cleanPath.includes('/status')) {
    const oldStatus = beforeDoc?.status || 'ACTIVE';
    const newStatus = body.status || respDoc?.status || 'UPDATED';
    const reason = body.reason ? `, Reason: '${body.reason}'` : '';
    return {
      module: 'Students',
      subModule: 'Student Profile',
      action: 'Status Changed',
      actionType: 'STATUS',
      details: `User: ${userName}, Action: Change Status for '${stName}', Father: '${father}'${roll}, Status: ${oldStatus} → ${newStatus}${reason}`,
    };
  }

  if (cleanPath.includes('/promote')) {
    const { progName, clsName } = await resolveClassSectionProgram(body.programId, body.classId, body.sectionId);
    return {
      module: 'Students',
      subModule: 'Admissions & Directory',
      action: 'Student Promoted',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Promote Student for '${stName}', Father: '${father}'${roll}, Promoted To: Class '${clsName}'${progName ? ` (${progName})` : ''}`,
    };
  }

  if (isAdd) {
    const fee = doc.fee != null ? `, Tuition Fee: PKR ${fmtAmt(doc.fee)}` : '';
    return {
      module: 'Students',
      subModule: 'Admissions & Directory',
      action: 'Student Enrolled',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Enroll Student for '${stName}', Father: '${father}'${roll}${fee}`,
    };
  }

  if (isUpdate) {
    const changes = getFieldChangesSummary(beforeDoc, body, ['installments', 'documents']);
    return {
      module: 'Students',
      subModule: 'Student Profile',
      action: 'Update Student',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Student for '${stName}', Father: '${father}'${roll}${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  if (isDelete) {
    return {
      module: 'Students',
      subModule: 'Admissions & Directory',
      action: 'Student Deleted',
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Delete Student for '${stName}', Father: '${father}'${roll}`,
    };
  }

  return null;
};

// 6. Fee Management - Challans & Extra Challans & Heads & Structures & Settings
const formatFeeLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  // Fee Heads: track all cruds
  if (cleanPath.includes('/head')) {
    const headName = body.name || beforeDoc?.name || respDoc?.name || 'Fee Head';
    if (method === 'POST') {
      return {
        module: 'Fee Management',
        subModule: 'Fee Heads',
        action: 'Fee Head Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Fee Head for '${headName}', Amount: PKR ${fmtAmt(body.amount)}, Type: '${body.type || 'monthly'}'`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Fee Management',
        subModule: 'Fee Heads',
        action: 'Update Fee Head',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Fee Head for '${headName}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Fee Management',
        subModule: 'Fee Heads',
        action: 'Fee Head Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Fee Head for '${headName}'`,
      };
    }
  }

  // Fee Structures: track all cruds
  if (cleanPath.includes('/structure')) {
    const { progName, clsName } = await resolveClassSectionProgram(body.programId || beforeDoc?.programId, body.classId || beforeDoc?.classId);
    if (method === 'POST') {
      return {
        module: 'Fee Management',
        subModule: 'Fee Structures',
        action: 'Fee Structure Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Fee Structure for Program: '${progName || 'Program'}', Class: '${clsName || 'Class'}', Total: PKR ${fmtAmt(body.totalAmount)}`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body, ['feeHeads']);
      return {
        module: 'Fee Management',
        subModule: 'Fee Structures',
        action: 'Update Fee Structure',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Fee Structure for Program: '${progName || 'Program'}', Class: '${clsName || 'Class'}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Fee Management',
        subModule: 'Fee Structures',
        action: 'Fee Structure Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Fee Structure for Program: '${progName || 'Program'}', Class: '${clsName || 'Class'}'`,
      };
    }
  }

  // Fee Settings: track all cruds
  if (cleanPath.includes('/fee-settings') || cleanPath.includes('/settings')) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Fee Management',
      subModule: 'Settings',
      action: 'Fee Settings Updated',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Fee Settings${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  // Bulk generate challans: store/state combined in details, remove total amount, resolve student & father names
  if (cleanPath.includes('/bulk-generate')) {
    const rawMonth = body.feeMonth || body.month || 'Current';
    const monthStr = formatMonthStr(rawMonth);
    const { progName, clsName } = await resolveClassSectionProgram(body.programId, body.classId);
    const progStr = progName ? `Program: '${progName}', ` : '';
    const clsStr = clsName ? `Class: '${clsName}', ` : '';

    // Collect student IDs
    let sIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    if (sIds.length === 0 && Array.isArray(respDoc?.results)) {
      sIds = respDoc.results.map(r => r.studentId || r._id).filter(Boolean);
    }

    let studentsInfo = [];
    if (sIds.length > 0) {
      try {
        const sDocs = await Student.find({ _id: { $in: sIds } })
          .select('fName lName fatherOrguardian rollNumber')
          .lean();
        studentsInfo = sDocs.map(s => ({
          name: `${s.fName || ''} ${s.lName || ''}`.trim() || 'Student',
          father: s.fatherOrguardian || 'N/A',
          roll: s.rollNumber ? ` (Roll: ${s.rollNumber})` : ''
        }));
      } catch (e) {}
    }

    if (studentsInfo.length === 0 && Array.isArray(respDoc?.results) && respDoc.results.length > 0) {
      studentsInfo = respDoc.results.map(r => ({
        name: r.studentName || 'Student',
        father: r.fatherName || 'N/A',
        roll: r.rollNumber ? ` (Roll: ${r.rollNumber})` : ''
      }));
    }

    if (studentsInfo.length === 1) {
      const s = studentsInfo[0];
      return {
        module: 'Fee Management',
        subModule: 'Challans',
        action: 'Challans Generated',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Generate Fee Challan for '${s.name}', Father: '${s.father}'${s.roll}, Month: ${monthStr}`,
      };
    }

    if (studentsInfo.length > 1) {
      let studentsListStr = '';
      if (studentsInfo.length <= 5) {
        studentsListStr = studentsInfo.map(s => `'${s.name}' (Father: '${s.father}')`).join(', ');
      } else {
        const first5 = studentsInfo.slice(0, 5).map(s => `'${s.name}' (Father: '${s.father}')`).join(', ');
        studentsListStr = `${first5}, and ${studentsInfo.length - 5} more`;
      }

      return {
        module: 'Fee Management',
        subModule: 'Challans',
        action: 'Challans Generated',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Bulk Generate Challans for ${progStr}${clsStr}Month: ${monthStr}, Students: ${studentsListStr}`,
      };
    }

    const count = respDoc?.count || respDoc?.challans?.length || body.count || 'Multiple';
    return {
      module: 'Fee Management',
      subModule: 'Challans',
      action: 'Challans Generated',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Bulk Generate Challans for ${progStr}${clsStr}Month: ${monthStr}, Generated: ${count} Challans`,
    };
  }

  // Single Challan / Extra Challan: mention studentname/fathername, challan month
  const isExtra = cleanPath.includes('extra');
  const doc = beforeDoc || respDoc || body;
  const st = await resolveStudent(doc.studentId || doc.student || body.studentId);
  const stName = st?.name || 'Student';
  const father = st?.fatherName || 'N/A';
  const roll = st?.roll || '';
  const rawMonth = doc.month || doc.feeMonth || body.month || body.feeMonth || 'Current';
  const month = formatMonthStr(rawMonth);
  const chNo = doc.challanNo || doc.challanNumber || body.challanNo ? ` (Challan: #${doc.challanNo || doc.challanNumber || body.challanNo})` : '';

  if (cleanPath.includes('/pay') || cleanPath.includes('/payments')) {
    const amt = fmtAmt(body.paidAmount || body.amount || doc.paidAmount);
    const mode = body.paymentMode || body.paymentMethod || 'Cash';
    return {
      module: 'Fee Management',
      subModule: isExtra ? 'Extra Challans' : 'Challans',
      action: 'Challan Paid',
      actionType: 'PAYMENT',
      details: `User: ${userName}, Action: Fee Challan Paid for '${stName}', Father: '${father}'${roll}, Month: ${month}${chNo}, Paid Amount: PKR ${amt}, Mode: ${mode}`,
    };
  }

  if (isExtra && method === 'POST') {
    const amt = fmtAmt(body.amount);
    const title = body.title || 'Extra Charges';
    return {
      module: 'Fee Management',
      subModule: 'Extra Challans',
      action: 'Extra Challan Issued',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Issue Extra Challan for '${stName}', Father: '${father}'${roll}, Month: ${month}, Title: '${title}', Amount: PKR ${amt}`,
    };
  }

  if (method === 'POST') {
    return {
      module: 'Fee Management',
      subModule: 'Challans',
      action: 'Challan Created',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Generate Fee Challan for '${stName}', Father: '${father}'${roll}, Month: ${month}${chNo}`,
    };
  }

  if (['PUT', 'PATCH'].includes(method)) {
    const changes = isExtra ? getFieldChangesSummary(beforeDoc, body) : getChallanUpdateSummary(beforeDoc, body);
    return {
      module: 'Fee Management',
      subModule: isExtra ? 'Extra Challans' : 'Challans',
      action: `Update ${isExtra ? 'Extra ' : ''}Challan`,
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update ${isExtra ? 'Extra ' : ''}Challan for '${stName}', Father: '${father}'${roll}, Month: ${month}${chNo}${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  if (method === 'DELETE') {
    return {
      module: 'Fee Management',
      subModule: isExtra ? 'Extra Challans' : 'Challans',
      action: `Delete ${isExtra ? 'Extra ' : ''}Challan`,
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Delete ${isExtra ? 'Extra ' : ''}Challan for '${stName}', Father: '${father}'${roll}, Month: ${month}${chNo}`,
    };
  }

  return null;
};

// 7. Staff - Directory & Settings (staff name/fathername/designation & prefix actions)
const formatStaffLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  // Salary revision (increment / decrement)
  if (cleanPath.includes('/salary-revision')) {
    const sf = await resolveStaff(beforeDoc || body);
    const name = sf?.name || beforeDoc?.name || 'Staff Member';
    const father = sf?.fatherName || beforeDoc?.fatherName || 'N/A';
    const desig = sf?.designation || beforeDoc?.designation || 'Staff';
    const type = (body.type || 'INCREMENT').toUpperCase();
    const pct = body.percentage || 0;
    const prevSal = fmtAmt(respDoc?.previousSalary || beforeDoc?.basicPay || beforeDoc?.baseSalary);
    const newSal = fmtAmt(respDoc?.newSalary || body.newSalary);
    return {
      module: 'Staff',
      subModule: 'Staff Directory',
      action: `Salary ${type === 'INCREMENT' ? 'Increment' : 'Decrement'}`,
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Salary ${type} for '${name}', Father: '${father}', Designation: '${desig}', Percentage: ${pct}%, Previous: PKR ${prevSal}, New: PKR ${newSal}`,
    };
  }

  // Staff ID settings prefix
  if (cleanPath.includes('/staff-id-settings')) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Staff',
      subModule: 'Settings',
      action: 'Staff ID Prefixes Updated',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Staff ID Prefixes, Teaching: '${body.teachingPrefix || ''}', Non-Teaching: '${body.nonTeachingPrefix || ''}', Dual: '${body.dualPrefix || ''}', Supporting: '${body.supportingPrefix || ''}'${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  const doc = respDoc || beforeDoc || body;
  const name = doc.name || 'Staff Member';
  const father = doc.fatherName || beforeDoc?.fatherName || body.fatherName || 'N/A';
  const desig = doc.designation || beforeDoc?.designation || body.designation || 'Staff';
  const staffId = doc.staffId ? ` (Staff ID: ${doc.staffId})` : (beforeDoc?.staffId ? ` (Staff ID: ${beforeDoc.staffId})` : '');

  if (method === 'POST') {
    const sal = fmtAmt(doc.basicPay || doc.baseSalary || doc.basicSalary);
    const dept = doc.empDepartment || doc.department || 'General';
    return {
      module: 'Staff',
      subModule: 'Staff Directory',
      action: 'Staff Added',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Add Staff for '${name}', Father: '${father}', Designation: '${desig}'${staffId}, Department: '${dept}', Basic Salary: PKR ${sal}`,
    };
  }

  if (['PUT', 'PATCH'].includes(method)) {
    const changes = getFieldChangesSummary(beforeDoc, body, ['permissions', 'documents', 'salaryHistory']);
    return {
      module: 'Staff',
      subModule: 'Staff Directory',
      action: 'Update Staff',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Staff for '${name}', Father: '${father}', Designation: '${desig}'${staffId}${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  if (method === 'DELETE') {
    return {
      module: 'Staff',
      subModule: 'Staff Directory',
      action: 'Staff Deleted',
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Delete Staff for '${name}', Father: '${father}', Designation: '${desig}'${staffId}`,
    };
  }

  return null;
};

// 8. Attendance (Bulk Class & Student Leave)
const formatAttendanceLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  // Student leave: cruds + approve/reject with studentname/fathername and date(s)
  if (cleanPath.includes('/leave')) {
    const leaveDoc = beforeDoc || respDoc || body;
    const st = await resolveStudent(leaveDoc.studentId || leaveDoc.student || body.studentId);
    const stName = st?.name || 'Student';
    const father = st?.fatherName || 'N/A';
    const dates = `${leaveDoc.fromDate || body.fromDate || body.startDate || ''} to ${leaveDoc.toDate || body.toDate || body.endDate || ''}`;

    if (cleanPath.includes('/status') || cleanPath.includes('/approve') || cleanPath.includes('/reject')) {
      const status = (body.status || (cleanPath.includes('/approve') ? 'APPROVED' : 'REJECTED')).toUpperCase();
      return {
        module: 'Attendance',
        subModule: 'Leave',
        action: status === 'APPROVED' ? 'Student Leave Approved' : 'Student Leave Rejected',
        actionType: 'STATUS',
        details: `User: ${userName}, Action: ${status === 'APPROVED' ? 'Approve' : 'Reject'} Student Leave for '${stName}', Father: '${father}', Dates: ${dates}`,
      };
    }
    if (method === 'POST') {
      const reason = body.reason ? `, Reason: '${body.reason}'` : '';
      return {
        module: 'Attendance',
        subModule: 'Leave',
        action: 'Student Leave Recorded',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Record Student Leave for '${stName}', Father: '${father}', Dates: ${dates}${reason}`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Attendance',
        subModule: 'Leave',
        action: 'Update Student Leave',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Student Leave for '${stName}', Father: '${father}', Dates: ${dates}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Attendance',
        subModule: 'Leave',
        action: 'Student Leave Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Student Leave for '${stName}', Father: '${father}', Dates: ${dates}`,
      };
    }
  }

  // Student Attendance (Single & Bulk): mention program/class/section(if applicable)
  const { progName, clsName, secName } = await resolveClassSectionProgram(body.programId, body.classId, body.sectionId);
  const progStr = progName ? `Program: '${progName}', ` : '';
  const classSecStr = clsName ? `Class: '${clsName}'${secName ? `, Section: '${secName}'` : ''}` : '';
  const contextStr = `${progStr}${classSecStr}`.trim().replace(/,\s*$/, '');

  if (method === 'DELETE') {
    return {
      module: 'Attendance',
      subModule: 'Record Attendance',
      action: 'Attendance Removed',
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Remove Attendance for ${contextStr || 'Class'}, Date: ${body.date || 'Today'}`,
    };
  }

  const studentsList = body.students || body.rows || [];
  if (studentsList.length === 1) {
    const single = studentsList[0];
    const st = await resolveStudent(single.studentId || single.id);
    const stName = st?.name || 'Student';
    const father = st?.fatherName || 'N/A';
    const status = single.status || 'PRESENT';
    return {
      module: 'Attendance',
      subModule: 'Record Attendance',
      action: 'Student Attendance Marked',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Mark Student Attendance for '${stName}', Father: '${father}', ${contextStr ? `${contextStr}, ` : ''}Date: ${body.date || 'Today'}, Status: ${status}`,
    };
  }

  // Bulk attendance
  let presentCount = 0;
  let absentCount = 0;
  const absentStudents = [];
  for (const s of studentsList) {
    if (String(s.status || '').toUpperCase() === 'ABSENT') {
      absentCount++;
      if (absentStudents.length < 4) {
        const resolved = await resolveStudent(s.studentId || s.id);
        if (resolved) absentStudents.push(resolved.name);
      }
    } else {
      presentCount++;
    }
  }
  const absentNote = absentStudents.length > 0 ? ` (Absent: ${absentStudents.join(', ')})` : '';

  return {
    module: 'Attendance',
    subModule: 'Record Attendance',
    action: 'Class Attendance Marked',
    actionType: 'CREATE',
    details: `User: ${userName}, Action: Mark Class Attendance for ${contextStr || 'Class'}, Date: ${body.date || 'Today'}, Total: ${studentsList.length}, Present: ${presentCount}, Absent: ${absentCount}${absentNote}`,
  };
};

// 9. Front Office (Inquiry, Visitor, Complaint, Contacts)
const formatFrontOfficeLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  // Inquiry: student name/fathername
  if (cleanPath.includes('/inquir')) {
    if (method === 'POST') {
      const doc = respDoc || body;
      const name = doc.studentName || doc.name || 'Candidate';
      const father = doc.fatherName || doc.fatherOrguardian || body.fatherName || 'N/A';
      const contact = doc.contactNumber || doc.phone || body.contactNumber || 'N/A';
      const type = doc.inquiryType || body.inquiryType || 'General';
      const prog = doc.programInterestName || body.programInterestName || 'N/A';
      const prospectus = (doc.prospectusSold || body.prospectusSold) ? 'Sold' : 'Not Sold';
      return {
        module: 'Front Office',
        subModule: 'Inquiry',
        action: 'Inquiry Added',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Add Inquiry for '${name}', Father: '${father}', Contact: ${contact}, Program: '${prog}', Type: '${type}', Prospectus: ${prospectus}`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const name = beforeDoc?.studentName || body.studentName || 'Candidate';
      const father = beforeDoc?.fatherName || body.fatherName || 'N/A';
      const changes = getFieldChangesSummary(beforeDoc, body, ['followUps', 'remarks']);
      const changesStr = changes ? `, Updated: ${changes}` : (body.status ? `, Status: ${body.status}` : '');
      return {
        module: 'Front Office',
        subModule: 'Inquiry',
        action: 'Update Inquiry',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Inquiry for '${name}', Father: '${father}'${changesStr}`,
      };
    }
    if (method === 'DELETE') {
      const name = beforeDoc?.studentName || body.studentName || 'Candidate';
      const father = beforeDoc?.fatherName || body.fatherName || 'N/A';
      return {
        module: 'Front Office',
        subModule: 'Inquiry',
        action: 'Inquiry Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Inquiry for '${name}', Father: '${father}'`,
      };
    }
  }

  // Visitor: visitor name
  if (cleanPath.includes('/visitor')) {
    const doc = respDoc || body;
    const name = doc.visitorName || doc.name || beforeDoc?.visitorName || 'Visitor';
    if (method === 'POST') {
      const purpose = doc.purpose || 'Meeting';
      const host = doc.personToMeet || doc.host || 'Staff';
      const pass = doc.IDCard || doc.ID ? ` (ID: ${doc.IDCard || doc.ID})` : '';
      return {
        module: 'Front Office',
        subModule: 'Visitor Book',
        action: 'Visitor Pass Issued',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Issue Visitor Pass for '${name}'${pass}, Purpose: '${purpose}', Host: '${host}'`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Front Office',
        subModule: 'Visitor Book',
        action: 'Update Visitor',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Visitor for '${name}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Front Office',
        subModule: 'Visitor Book',
        action: 'Visitor Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Visitor for '${name}'`,
      };
    }
  }

  // Complaint: type and name + field changes & state changes
  if (cleanPath.includes('/complaint')) {
    const doc = respDoc || body;
    const type = doc.type || beforeDoc?.type || 'Student';
    const name = doc.complainantName || doc.name || beforeDoc?.complainantName || 'Complainant';
    const cat = doc.category || beforeDoc?.category || 'General';
    const subj = doc.subject || doc.title || beforeDoc?.subject || 'Complaint';

    if (method === 'POST') {
      if (cleanPath.includes('/remark')) {
        const remarkText = body.text || body.remark || '';
        return {
          module: 'Complaints',
          subModule: 'Complaints',
          action: 'Complaint Remark Added',
          actionType: 'UPDATE',
          details: `User: ${userName}, Action: Add Remark on Complaint for '${name}', Type: '${type}', Subject: '${subj}'${remarkText ? `, Remark: '${remarkText}'` : ''}`,
        };
      }
      return {
        module: 'Complaints',
        subModule: 'Complaints',
        action: 'Complaint Registered',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Register Complaint for '${name}', Type: '${type}', Category: '${cat}', Subject: '${subj}'`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const oldStatus = beforeDoc?.status || 'Pending';
      const newStatus = body.status || oldStatus;
      const statusChange = (newStatus && newStatus !== oldStatus) ? `, Status: ${oldStatus} → ${newStatus}` : '';
      const changes = getFieldChangesSummary(beforeDoc, body, ['remarks', 'assignedToIds']);
      return {
        module: 'Complaints',
        subModule: 'Complaints',
        action: 'Update Complaint',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Complaint for '${name}', Type: '${type}', Subject: '${subj}'${statusChange}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Complaints',
        subModule: 'Complaints',
        action: 'Complaint Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Complaint for '${name}', Type: '${type}', Subject: '${subj}'`,
      };
    }
  }

  // Contacts: name and category
  if (cleanPath.includes('/contact')) {
    const doc = respDoc || body;
    const name = doc.name || beforeDoc?.name || 'Contact';
    const cat = doc.category || beforeDoc?.category || 'General';
    if (method === 'POST') {
      const phone = doc.phone || body.phone || 'N/A';
      return {
        module: 'Front Office',
        subModule: 'Contacts',
        action: 'Contact Added',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Add Contact for '${name}', Category: '${cat}', Phone: ${phone}`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Front Office',
        subModule: 'Contacts',
        action: 'Update Contact',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Contact for '${name}', Category: '${cat}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Front Office',
        subModule: 'Contacts',
        action: 'Contact Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Contact for '${name}', Category: '${cat}'`,
      };
    }
  }

  return null;
};

// 10. Academics (Sessions, Programs, Classes, Sections, Subjects, SCM, TCM, Timetable)
const formatAcademicsLog = async (method, cleanPath, body = {}, respDoc, beforeDoc, userName) => {
  body = body || {};
  // 1. Sessions: all cruds
  if (cleanPath.includes('/session')) {
    const name = body?.name || beforeDoc?.name || respDoc?.name || (body?.startYear && body?.endYear ? `${body.startYear}-${body.endYear}` : '') || 'Academic Session';
    if (method === 'POST') {
      return {
        module: 'Academics',
        subModule: 'Sessions',
        action: 'Academic Session Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Academic Session for '${name}'`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Academics',
        subModule: 'Sessions',
        action: 'Update Academic Session',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Academic Session for '${name}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Academics',
        subModule: 'Sessions',
        action: 'Academic Session Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Academic Session for '${name}'`,
      };
    }
  }

  // 2. Programs: all cruds and changes
  if (cleanPath.includes('/program')) {
    const name = body.name || beforeDoc?.name || respDoc?.name || 'Program';
    if (method === 'POST') {
      return {
        module: 'Academics',
        subModule: 'Programs',
        action: 'Program Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Program for '${name}', Code: '${body.code || ''}'`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Academics',
        subModule: 'Programs',
        action: 'Update Program',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Program for '${name}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Academics',
        subModule: 'Programs',
        action: 'Program Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Program for '${name}'`,
      };
    }
  }

  // 3. Classes: all changes -> programname
  if (cleanPath.includes('/class') && !cleanPath.includes('/teacher-classes')) {
    const clsName = body.name || beforeDoc?.name || respDoc?.name || 'Class';
    const { progName } = await resolveClassSectionProgram(body.programId || beforeDoc?.programId);
    const progStr = progName ? `, Program: '${progName}'` : '';
    if (method === 'POST') {
      return {
        module: 'Academics',
        subModule: 'Classes',
        action: 'Class Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Class for '${clsName}'${progStr}`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Academics',
        subModule: 'Classes',
        action: 'Update Class',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Class for '${clsName}'${progStr}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Academics',
        subModule: 'Classes',
        action: 'Class Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Class for '${clsName}'${progStr}`,
      };
    }
  }

  // 4. Sections: all changes -> program/class
  if (cleanPath.includes('/section')) {
    const secName = body.name || beforeDoc?.name || respDoc?.name || 'Section';
    const { progName, clsName } = await resolveClassSectionProgram(body.programId || beforeDoc?.programId, body.classId || beforeDoc?.classId);
    const context = `Program: '${progName || 'Program'}', Class: '${clsName || 'Class'}'`;
    if (method === 'POST') {
      return {
        module: 'Academics',
        subModule: 'Sections',
        action: 'Section Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Section for '${secName}', ${context}`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Academics',
        subModule: 'Sections',
        action: 'Update Section',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Section for '${secName}', ${context}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Academics',
        subModule: 'Sections',
        action: 'Section Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Section for '${secName}', ${context}`,
      };
    }
  }

  // 5. Subjects: all changes
  if (cleanPath.includes('/subject') && !cleanPath.includes('/scm')) {
    const subjName = body.name || beforeDoc?.name || respDoc?.name || 'Subject';
    if (method === 'POST') {
      return {
        module: 'Academics',
        subModule: 'Subjects',
        action: 'Subject Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Subject for '${subjName}', Code: '${body.code || ''}', Type: '${body.type || 'Theory'}'`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Academics',
        subModule: 'Subjects',
        action: 'Update Subject',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Subject for '${subjName}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Academics',
        subModule: 'Subjects',
        action: 'Subject Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Subject for '${subjName}'`,
      };
    }
  }

  // 6. Subject Class Mapping (SCM): program/class/section(if applicable), subjectname
  if (cleanPath.includes('/scm')) {
    const subjName = body.subjectName || await resolveSubject(body.subjectId || beforeDoc?.subjectId) || 'Subject';
    const { progName, clsName, secName } = await resolveClassSectionProgram(body.programId || beforeDoc?.programId, body.classId || beforeDoc?.classId, body.sectionId || beforeDoc?.sectionId);
    const context = `Program: '${progName || 'Program'}', Class: '${clsName || 'Class'}'${secName ? `, Section: '${secName}'` : ''}`;
    if (method === 'POST') {
      return {
        module: 'Academics',
        subModule: 'Subject Mapping',
        action: 'Subject Assigned to Class',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Assign Subject to Class for Subject: '${subjName}', ${context}`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Academics',
        subModule: 'Subject Mapping',
        action: 'Update Subject Class Mapping',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Subject Class Mapping for Subject: '${subjName}', ${context}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Academics',
        subModule: 'Subject Mapping',
        action: 'Remove Subject Mapping',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Remove Subject Class Mapping for Subject: '${subjName}', ${context}`,
      };
    }
  }

  // 7. Teacher Class Mapping (TCM): program/class/section, teachername
  if (cleanPath.includes('/tcm') || cleanPath.includes('/tsm') || cleanPath.includes('/teacher-classes')) {
    const sf = await resolveStaff(body.teacherId || body.staffId || beforeDoc?.teacherId || beforeDoc?.staffId);
    const teacherName = sf?.name || 'Teacher';
    const subjName = body.subjectName || await resolveSubject(body.subjectId || beforeDoc?.subjectId) || '';
    const { progName, clsName, secName } = await resolveClassSectionProgram(body.programId || beforeDoc?.programId, body.classId || beforeDoc?.classId, body.sectionId || beforeDoc?.sectionId);
    const context = `Program: '${progName || 'Program'}', Class: '${clsName || 'Class'}'${secName ? `, Section: '${secName}'` : ''}`;
    const subjStr = subjName ? `, Subject: '${subjName}'` : '';
    if (method === 'POST') {
      return {
        module: 'Academics',
        subModule: 'Teacher Mapping',
        action: 'Teacher Assigned to Class',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Assign Teacher to Class for Teacher: '${teacherName}', ${context}${subjStr}`,
      };
    }
    if (['PUT', 'PATCH'].includes(method)) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Academics',
        subModule: 'Teacher Mapping',
        action: 'Update Teacher Mapping',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Teacher Class Mapping for Teacher: '${teacherName}', ${context}${subjStr}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Academics',
        subModule: 'Teacher Mapping',
        action: 'Remove Teacher Mapping',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Remove Teacher Class Mapping for Teacher: '${teacherName}', ${context}`,
      };
    }
  }

  // 8. Timetable: program/class/section, bulk generate in details
  if (cleanPath.includes('/timetable')) {
    const { progName, clsName, secName } = await resolveClassSectionProgram(body.programId || beforeDoc?.programId, body.classId || beforeDoc?.classId, body.sectionId || beforeDoc?.sectionId);
    const context = `Program: '${progName || 'Program'}', Class: '${clsName || 'Class'}'${secName ? `, Section: '${secName}'` : ''}`;

    if (cleanPath.includes('/upsert') || method === 'POST') {
      const isBulk = Array.isArray(body.slots) || Array.isArray(body.timetable) || body.isBulk;
      if (isBulk) {
        const count = body.slots?.length || body.timetable?.length || 'Multiple';
        return {
          module: 'Academics',
          subModule: 'Timetable',
          action: 'Timetable Saved',
          actionType: 'CREATE',
          details: `User: ${userName}, Action: Bulk Save Timetable for ${context}, Total Periods: ${count}`,
        };
      }
      const day = body.day || '';
      const period = body.period || body.periodNumber || '';
      const subj = body.subjectName || await resolveSubject(body.subjectId) || 'Subject';
      return {
        module: 'Academics',
        subModule: 'Timetable',
        action: 'Timetable Slot Updated',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Timetable Slot for ${context}, Day: ${day}, Period: ${period}, Subject: '${subj}'`,
      };
    }
    if (method === 'DELETE') {
      return {
        module: 'Academics',
        subModule: 'Timetable',
        action: 'Timetable Slot Removed',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Remove Timetable for ${context}`,
      };
    }
  }

  return null;
};

// 11. Examination (Exams, Marks Entry, Results)
const formatExamLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  // Marks entry: bulk marks entry combined in details -> program-> class-> section
  if (cleanPath.includes('/marks')) {
    const { progName, clsName, secName } = await resolveClassSectionProgram(body.programId, body.classId, body.sectionId);
    const progStr = progName ? `Program: '${progName}', ` : '';
    const clsSec = `Class: '${clsName || 'Class'}'${secName ? `, Section: '${secName}'` : ''}`;
    const exam = body.examTitle || body.examName || 'Exam';
    const subj = body.subjectName || 'Subject';
    const count = body.marks?.length || 'Multiple';
    return {
      module: 'Examination',
      subModule: 'Marks Entry',
      action: 'Marks Submitted',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Bulk Marks Entry for ${progStr}${clsSec}, Exam: '${exam}', Subject: '${subj}', Total Graded: ${count}`,
    };
  }

  // Results: program/class/section
  if (cleanPath.includes('/result') || cleanPath.includes('/positions')) {
    const { progName, clsName, secName } = await resolveClassSectionProgram(body.programId, body.classId, body.sectionId);
    const progStr = progName ? `Program: '${progName}', ` : '';
    const clsSec = `Class: '${clsName || 'Class'}'${secName ? `, Section: '${secName}'` : ''}`;
    return {
      module: 'Examination',
      subModule: 'Results',
      action: 'Results Generated',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Generate Examination Results for ${progStr}${clsSec}`,
    };
  }

  // Exams CRUD: examname, program/class/section
  const examDoc = beforeDoc || respDoc || body;
  const examName = examDoc.title || examDoc.name || examDoc.examName || 'Exam';
  const { progName, clsName, secName } = await resolveClassSectionProgram(examDoc.programId || body.programId, examDoc.classId || body.classId, examDoc.sectionId || body.sectionId);
  const progStr = progName ? `Program: '${progName}', ` : '';
  const clsSec = `Class: '${clsName || 'Class'}'${secName ? `, Section: '${secName}'` : ''}`;

  if (method === 'POST') {
    return {
      module: 'Examination',
      subModule: 'Exams',
      action: 'Exam Created',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Create Exam for '${examName}', ${progStr}${clsSec}`,
    };
  }
  if (['PUT', 'PATCH'].includes(method)) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Examination',
      subModule: 'Exams',
      action: 'Update Exam',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Exam for '${examName}', ${progStr}${clsSec}${changes ? `, Updated: ${changes}` : ''}`,
    };
  }
  if (method === 'DELETE') {
    return {
      module: 'Examination',
      subModule: 'Exams',
      action: 'Exam Deleted',
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Delete Exam for '${examName}', ${progStr}${clsSec}`,
    };
  }

  return null;
};

// 12. HR & Payroll (Leaves, Payroll, Attendance, Advance Salary, Departments, Holidays)
const formatHRPayrollLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  const isAdd = method === 'POST';
  const isUpdate = ['PUT', 'PATCH'].includes(method);
  const isDelete = method === 'DELETE';

  // Sub-module A: Departments: all cruds
  if (cleanPath.startsWith('/api/department')) {
    const name = body.name || beforeDoc?.name || respDoc?.name || 'Department';
    const head = body.head || body.departmentHead || beforeDoc?.head || 'N/A';
    if (isAdd || cleanPath.includes('/create')) {
      return {
        module: 'HR & Payroll',
        subModule: 'Departments',
        action: 'Department Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Department for '${name}', Head: '${head}'`,
      };
    }
    if (isUpdate || cleanPath.includes('/update')) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'HR & Payroll',
        subModule: 'Departments',
        action: 'Update Department',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Department for '${name}', Head: '${head}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete || cleanPath.includes('/remove')) {
      return {
        module: 'HR & Payroll',
        subModule: 'Departments',
        action: 'Department Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Department for '${name}'`,
      };
    }
  }

  // Sub-module B: Holidays: all cruds
  if (cleanPath.includes('/holiday')) {
    const title = body.title || beforeDoc?.title || respDoc?.title || 'Holiday';
    const start = body.startDate || body.date || beforeDoc?.startDate || '';
    const end = body.endDate || body.date || beforeDoc?.endDate || start;
    const dateStr = start ? `Date: ${start}${end !== start ? ` to ${end}` : ''}` : '';

    if (isAdd) {
      return {
        module: 'HR & Payroll',
        subModule: 'Holidays',
        action: 'Holiday Added',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Add Holiday for '${title}', ${dateStr}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'HR & Payroll',
        subModule: 'Holidays',
        action: 'Update Holiday',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Holiday for '${title}', ${dateStr}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'HR & Payroll',
        subModule: 'Holidays',
        action: 'Holiday Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Holiday for '${title}', ${dateStr}`,
      };
    }
  }

  // Sub-module C: Advance Salary: staff name, deduction month, amount
  if (cleanPath.includes('/advance-salary')) {
    const sf = await resolveStaff(body.staffId || beforeDoc?.staffId);
    const staffName = sf?.name || 'Staff Member';
    const staffId = sf?.staffId || '';
    const amt = fmtAmt(body.amount ?? beforeDoc?.amount);
    const month = body.deductionMonth || body.month || beforeDoc?.deductionMonth || 'Current';

    if (isAdd) {
      return {
        module: 'HR & Payroll',
        subModule: 'Advance Salary',
        action: 'Advance Salary Issued',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Issue Advance Salary for '${staffName}'${staffId}, Deduction Month: ${month}, Amount: PKR ${amt}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'HR & Payroll',
        subModule: 'Advance Salary',
        action: 'Update Advance Salary',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Advance Salary for '${staffName}'${staffId}, Deduction Month: ${month}, Amount: PKR ${amt}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'HR & Payroll',
        subModule: 'Advance Salary',
        action: 'Advance Salary Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Advance Salary for '${staffName}'${staffId}, Deduction Month: ${month}, Amount: PKR ${amt}`,
      };
    }
  }

  // Sub-module D: Staff Leaves: full cruds, staff name, dates
  if (cleanPath.includes('/leave') || cleanPath.includes('/staff-leaves')) {
    const sf = await resolveStaff(body.staffId || beforeDoc?.staffId);
    const staffName = sf?.name || 'Staff Member';
    const staffId = sf?.staffId || '';
    const dates = `${body.startDate || body.fromDate || beforeDoc?.startDate || ''} to ${body.endDate || body.toDate || beforeDoc?.endDate || ''}`;

    if (cleanPath.includes('/status')) {
      const status = (body.status || 'UPDATED').toUpperCase();
      return {
        module: 'HR & Payroll',
        subModule: 'Leaves',
        action: status === 'APPROVED' ? 'Staff Leave Approved' : 'Staff Leave Rejected',
        actionType: 'STATUS',
        details: `User: ${userName}, Action: ${status === 'APPROVED' ? 'Approve' : 'Reject'} Staff Leave for '${staffName}'${staffId}, Dates: ${dates}`,
      };
    }
    if (cleanPath.includes('/lock')) {
      const isLocked = body.isLocked !== false;
      return {
        module: 'HR & Payroll',
        subModule: 'Leaves',
        action: isLocked ? 'Staff Leave Locked' : 'Staff Leave Unlocked',
        actionType: 'STATUS',
        details: `User: ${userName}, Action: ${isLocked ? 'Lock' : 'Unlock'} Staff Leave for '${staffName}'${staffId}, Dates: ${dates}`,
      };
    }
    if (isAdd) {
      const type = body.leaveType || 'General';
      const days = body.days || 1;
      return {
        module: 'HR & Payroll',
        subModule: 'Leaves',
        action: 'Staff Leave Recorded',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Record Staff Leave for '${staffName}'${staffId}, Type: '${type}', Dates: ${dates}, Days: ${days}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'HR & Payroll',
        subModule: 'Leaves',
        action: 'Update Staff Leave',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Staff Leave for '${staffName}'${staffId}, Dates: ${dates}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'HR & Payroll',
        subModule: 'Leaves',
        action: 'Staff Leave Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Staff Leave for '${staffName}'${staffId}, Dates: ${dates}`,
      };
    }
  }

  // Sub-module E: Payroll: track for all cruds-> staffname/fathername, month. Bulk generate combined in details
  if (cleanPath.includes('/payroll-generate')) {
    const month = body.month || '';
    const year = body.year || '';
    const count = respDoc?.count || respDoc?.totalStaff || 'Multiple';
    const net = fmtAmt(respDoc?.totalNetPayable);
    return {
      module: 'HR & Payroll',
      subModule: 'Payroll',
      action: 'Payroll Generated',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Bulk Generate Payroll for Month: ${month} ${year}, Total Staff: ${count}, Net Payable: PKR ${net}`,
    };
  }

  if (cleanPath.includes('/payroll')) {
    const sf = await resolveStaff(body.staffId || beforeDoc?.staffId || respDoc?.staffId);
    const staffName = sf?.name || 'Staff Member';
    const father = sf?.fatherName || 'N/A';
    const staffId = sf?.staffId || '';
    const month = body.month || beforeDoc?.month || respDoc?.month || '';
    const year = body.year || beforeDoc?.year || respDoc?.year || '';
    const monthStr = `${month} ${year}`.trim();

    if (cleanPath.includes('/payment')) {
      const amt = fmtAmt(body.amount || respDoc?.netSalary);
      const mode = body.paymentMethod || 'Cash';
      return {
        module: 'HR & Payroll',
        subModule: 'Payroll',
        action: 'Salary Disbursed',
        actionType: 'PAYMENT',
        details: `User: ${userName}, Action: Disburse Salary for '${staffName}', Father: '${father}'${staffId}, Month: ${monthStr}, Net Amount: PKR ${amt}, Mode: ${mode}`,
      };
    }
    if (isAdd) {
      const net = fmtAmt(body.netSalary || respDoc?.netSalary);
      return {
        module: 'HR & Payroll',
        subModule: 'Payroll',
        action: 'Payroll Record Saved',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Process Payroll for '${staffName}', Father: '${father}'${staffId}, Month: ${monthStr}, Net Salary: PKR ${net}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'HR & Payroll',
        subModule: 'Payroll',
        action: 'Update Payroll Record',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Payroll for '${staffName}', Father: '${father}'${staffId}, Month: ${monthStr}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'HR & Payroll',
        subModule: 'Payroll',
        action: 'Payroll Record Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Payroll Record for '${staffName}', Father: '${father}'${staffId}, Month: ${monthStr}`,
      };
    }
  }

  // Sub-module F: Staff Attendance: staffname/date for attendance
  if (cleanPath.includes('/staff-attendance')) {
    const date = body.date || new Date().toISOString().split('T')[0];
    if (isDelete) {
      const sf = await resolveStaff(body.staffId);
      const staffName = sf?.name || 'All Staff';
      return {
        module: 'HR & Payroll',
        subModule: 'Attendance',
        action: 'Staff Attendance Removed',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Remove Staff Attendance for '${staffName}', Date: ${date}`,
      };
    }
    const sf = await resolveStaff(body.staffId);
    if (sf) {
      return {
        module: 'HR & Payroll',
        subModule: 'Attendance',
        action: 'Staff Attendance Marked',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Mark Staff Attendance for '${sf.name}'${sf.staffId}, Date: ${date}, Status: ${body.status || 'PRESENT'}`,
      };
    }
    const count = body.attendance?.length || 'Multiple';
    return {
      module: 'HR & Payroll',
      subModule: 'Attendance',
      action: 'Staff Attendance Marked',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Mark Staff Attendance for Date: ${date}, Total Staff: ${count}`,
    };
  }

  return null;
};

// 13. Boarding / Hostel (Registration, Rooms, Fees, Expenses, Inventory, Settings)
const formatHostelLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  const isAdd = method === 'POST';
  const isUpdate = ['PUT', 'PATCH'].includes(method);
  const isDelete = method === 'DELETE';

  // 1. Rooms: all cruds
  if (cleanPath.includes('/rooms')) {
    const roomNo = body.roomNumber || beforeDoc?.roomNumber || respDoc?.roomNumber || 'Room';
    const cap = body.capacity || beforeDoc?.capacity || 1;
    const rent = fmtAmt(body.rent || body.feePerBed || beforeDoc?.feePerBed);
    if (isAdd) {
      return {
        module: 'Boarding',
        subModule: 'Rooms',
        action: 'Hostel Room Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Hostel Room for Room: '${roomNo}', Capacity: ${cap} Beds, Rent: PKR ${rent}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Boarding',
        subModule: 'Rooms',
        action: 'Update Hostel Room',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Hostel Room for Room: '${roomNo}', Capacity: ${cap} Beds, Rent: PKR ${rent}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'Boarding',
        subModule: 'Rooms',
        action: 'Hostel Room Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Hostel Room for Room: '${roomNo}'`,
      };
    }
  }

  // 2. Registrations: studentname/fathername in both cases, assigned room, internal or external?
  if (cleanPath.includes('/registrations') && !cleanPath.includes('/payments')) {
    const regDoc = beforeDoc || respDoc || body;
    const isInternal = (regDoc.registrationType || body.registrationType || 'internal').toLowerCase() === 'internal';
    let stName = '';
    let fatherName = '';
    if (isInternal) {
      const st = await resolveStudent(regDoc.studentId || body.studentId);
      stName = st?.name || 'Student';
      fatherName = st?.fatherName || 'N/A';
    } else {
      stName = regDoc.externalName || body.externalName || 'External Student';
      fatherName = regDoc.externalGuardianName || body.externalGuardianName || 'N/A';
    }
    const rm = await resolveRoom(regDoc.roomId || body.roomId);
    const rmStr = rm ? `, Room: '${rm}'` : '';
    const typeStr = isInternal ? 'INTERNAL' : 'EXTERNAL';
    const fee = fmtAmt(regDoc.decidedFeePerMonth || body.decidedFeePerMonth || regDoc.monthlyFee || body.monthlyFee);

    if (cleanPath.includes('/terminate')) {
      return {
        module: 'Boarding',
        subModule: 'Registration',
        action: 'Hostel Resident Terminated',
        actionType: 'STATUS',
        details: `User: ${userName}, Action: Terminate Hostel Registration for '${stName}', Father: '${fatherName}', Type: ${typeStr}${rmStr}${body.reason ? `, Reason: '${body.reason}'` : ''}`,
      };
    }
    if (cleanPath.includes('/withdraw')) {
      return {
        module: 'Boarding',
        subModule: 'Registration',
        action: 'Hostel Resident Withdrawn',
        actionType: 'STATUS',
        details: `User: ${userName}, Action: Withdraw Hostel Registration for '${stName}', Father: '${fatherName}', Type: ${typeStr}${rmStr}`,
      };
    }
    if (cleanPath.includes('/readmit')) {
      return {
        module: 'Boarding',
        subModule: 'Registration',
        action: 'Hostel Resident Readmitted',
        actionType: 'STATUS',
        details: `User: ${userName}, Action: Readmit Hostel Resident for '${stName}', Father: '${fatherName}', Type: ${typeStr}${rmStr}`,
      };
    }
    if (isAdd) {
      return {
        module: 'Boarding',
        subModule: 'Registration',
        action: 'Hostel Registration Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Register Hostel Resident for '${stName}', Father: '${fatherName}', Type: ${typeStr}${rmStr}, Monthly Fee: PKR ${fee}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body, ['history']);
      return {
        module: 'Boarding',
        subModule: 'Registration',
        action: 'Update Hostel Registration',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Hostel Registration for '${stName}', Father: '${fatherName}', Type: ${typeStr}${rmStr}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'Boarding',
        subModule: 'Registration',
        action: 'Hostel Registration Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Hostel Registration for '${stName}', Father: '${fatherName}', Type: ${typeStr}`,
      };
    }
  }

  // 3. Fees: for all cruds -> studentname, month, amount
  if (cleanPath.includes('/challans') || cleanPath.includes('/external-challans')) {
    const chDoc = beforeDoc || respDoc || body;
    const st = await resolveStudent(chDoc.studentId || body.studentId);
    const stName = st?.name || chDoc.externalName || body.externalName || 'Resident';
    const month = chDoc.month || body.month || 'Current';
    const chNo = chDoc.challanNo ? ` (Challan: #${chDoc.challanNo})` : '';
    const amt = fmtAmt(body.amount || chDoc.amount || chDoc.dueAmount || respDoc?.totalAmount);

    if (cleanPath.includes('/payment')) {
      const mode = body.paymentMode || 'Cash';
      return {
        module: 'Boarding',
        subModule: 'Fees',
        action: 'Hostel Challan Paid',
        actionType: 'PAYMENT',
        details: `User: ${userName}, Action: Hostel Challan Paid for '${stName}', Month: ${month}${chNo}, Paid Amount: PKR ${amt}, Mode: ${mode}`,
      };
    }
    if (isAdd) {
      return {
        module: 'Boarding',
        subModule: 'Fees',
        action: 'Hostel Challan Issued',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Generate Hostel Challan for '${stName}', Month: ${month}${chNo}, Amount: PKR ${amt}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Boarding',
        subModule: 'Fees',
        action: 'Update Hostel Challan',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Hostel Challan for '${stName}', Month: ${month}${chNo}, Amount: PKR ${amt}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'Boarding',
        subModule: 'Fees',
        action: 'Hostel Challan Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Hostel Challan for '${stName}', Month: ${month}${chNo}`,
      };
    }
  }

  // 4. Expenses: all cruds- > category, amount
  if (cleanPath.includes('/expenses')) {
    const title = body.title || beforeDoc?.title || 'Hostel Expense';
    const cat = body.category || beforeDoc?.category || 'General';
    const amt = fmtAmt(body.amount ?? beforeDoc?.amount);

    if (isAdd) {
      return {
        module: 'Boarding',
        subModule: 'Expenses',
        action: 'Hostel Expense Added',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Add Hostel Expense for '${title}', Category: '${cat}', Amount: PKR ${amt}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Boarding',
        subModule: 'Expenses',
        action: 'Update Hostel Expense',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Hostel Expense for '${title}', Category: '${cat}', Amount: PKR ${amt}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'Boarding',
        subModule: 'Expenses',
        action: 'Hostel Expense Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Hostel Expense for '${title}', Category: '${cat}', Amount: PKR ${amt}`,
      };
    }
  }

  // 5. Inventory: all cruds -> item name, quantity
  if (cleanPath.includes('/inventory')) {
    const itemName = body.itemName || body.name || beforeDoc?.itemName || beforeDoc?.name || 'Item';
    const qty = body.quantity ?? beforeDoc?.quantity ?? 0;

    if (isAdd) {
      return {
        module: 'Boarding',
        subModule: 'Inventory',
        action: 'Hostel Inventory Added',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Add Hostel Inventory for '${itemName}', Quantity: ${qty}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Boarding',
        subModule: 'Inventory',
        action: 'Update Hostel Inventory',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Hostel Inventory for '${itemName}', Quantity: ${qty}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'Boarding',
        subModule: 'Inventory',
        action: 'Hostel Inventory Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Hostel Inventory for '${itemName}'`,
      };
    }
  }

  // 6. Settings: all cruds
  if (cleanPath.includes('/settings')) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Boarding',
      subModule: 'Settings',
      action: 'Hostel Settings Updated',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Hostel Settings${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  return null;
};

// 14. Inventory (Items & Inventory Expenses)
const formatInventoryLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  const isAdd = method === 'POST';
  const isUpdate = ['PUT', 'PATCH'].includes(method);
  const isDelete = method === 'DELETE';

  // Inventory Expenses: all cruds -> itemname, expense type, amount
  if (cleanPath.includes('/expenses')) {
    const item = body.itemName || beforeDoc?.itemName || 'Item';
    const type = body.expenseType || body.type || beforeDoc?.expenseType || 'General';
    const amt = fmtAmt(body.amount ?? beforeDoc?.amount);

    if (isAdd) {
      return {
        module: 'Inventory',
        subModule: 'Expenses',
        action: 'Inventory Expense Added',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Add Inventory Expense for '${item}', Expense Type: '${type}', Amount: PKR ${amt}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Inventory',
        subModule: 'Expenses',
        action: 'Update Inventory Expense',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Inventory Expense for '${item}', Expense Type: '${type}', Amount: PKR ${amt}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'Inventory',
        subModule: 'Expenses',
        action: 'Inventory Expense Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Inventory Expense for '${item}', Expense Type: '${type}', Amount: PKR ${amt}`,
      };
    }
  }

  // Inventory Items: all cruds -> name, category, quantity
  const doc = respDoc || beforeDoc || body;
  const name = doc.itemName || doc.name || 'Item';
  const cat = body.category || doc.category || 'General';
  const qty = body.quantity ?? doc.quantity ?? 0;

  if (cleanPath.includes('/purchase')) {
    const cost = fmtAmt(body.totalCost || body.amount);
    return {
      module: 'Inventory',
      subModule: 'Inventory Directory',
      action: 'Inventory Purchased',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Purchase Stock for '${name}', Quantity: ${qty}, Total Cost: PKR ${cost}`,
    };
  }

  if (isAdd) {
    return {
      module: 'Inventory',
      subModule: 'Inventory Directory',
      action: 'Inventory Item Added',
      actionType: 'CREATE',
      details: `User: ${userName}, Action: Add Inventory Item for '${name}', Category: '${cat}', Quantity: ${qty}`,
    };
  }
  if (isUpdate) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Inventory',
      subModule: 'Inventory Directory',
      action: 'Update Inventory Item',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Inventory Item for '${name}', Category: '${cat}', Quantity: ${qty}${changes ? `, Updated: ${changes}` : ''}`,
    };
  }
  if (isDelete) {
    return {
      module: 'Inventory',
      subModule: 'Inventory Directory',
      action: 'Inventory Item Deleted',
      actionType: 'DELETE',
      details: `User: ${userName}, Action: Delete Inventory Item for '${name}', Category: '${cat}', Quantity: ${qty}`,
    };
  }

  return null;
};

// 15. Configuration & Wallets (Institute, Templates, Wallets)
const formatConfigurationLog = async (method, cleanPath, body, respDoc, beforeDoc, userName) => {
  const isAdd = method === 'POST';
  const isUpdate = ['PUT', 'PATCH'].includes(method);
  const isDelete = method === 'DELETE';

  // Wallets: all cruds -> money flow (account a -> account b for 1000rs)
  if (cleanPath.includes('/transfer')) {
    const from = body.fromAccountName || body.fromAccount || body.sourceWalletName || 'Account A';
    const to = body.toAccountName || body.toAccount || body.targetWalletName || 'Account B';
    const amt = fmtAmt(body.amount);
    return {
      module: 'Wallets / Accounts',
      subModule: 'Contra Transfers',
      action: 'Contra Transfer',
      actionType: 'PAYMENT',
      details: `User: ${userName}, Action: Transfer Money from '${from}' to '${to}' for PKR ${amt}`,
    };
  }
  if (cleanPath.includes('/deposit')) {
    const acc = body.walletName || body.accountName || 'Account';
    const amt = fmtAmt(body.amount);
    return {
      module: 'Wallets / Accounts',
      subModule: 'Direct Deposits',
      action: 'Direct Deposit',
      actionType: 'PAYMENT',
      details: `User: ${userName}, Action: Deposit Money to '${acc}' for PKR ${amt}`,
    };
  }
  if (cleanPath.startsWith('/api/wallets')) {
    const acc = body.name || beforeDoc?.name || respDoc?.name || 'Account';
    if (isAdd) {
      return {
        module: 'Wallets / Accounts',
        subModule: 'Wallets',
        action: 'Account Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Account for '${acc}', Type: '${body.type || 'Bank'}', Initial Balance: PKR ${fmtAmt(body.balance || body.initialBalance)}`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body);
      return {
        module: 'Wallets / Accounts',
        subModule: 'Wallets',
        action: 'Update Account',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Account for '${acc}'${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'Wallets / Accounts',
        subModule: 'Wallets',
        action: 'Account Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Account for '${acc}'`,
      };
    }
  }

  // Institute Settings: all cruds
  if (cleanPath.includes('/institute-settings')) {
    const changes = getFieldChangesSummary(beforeDoc, body);
    return {
      module: 'Configuration',
      subModule: 'Institute',
      action: 'Institute Settings Updated',
      actionType: 'UPDATE',
      details: `User: ${userName}, Action: Update Institute Settings${changes ? `, Updated: ${changes}` : ''}`,
    };
  }

  // Templates: all cruds -> which one got updated?
  if (cleanPath.includes('template')) {
    const tmplName = body.name || beforeDoc?.name || respDoc?.name || 'Template';
    let tmplType = 'Template';
    if (cleanPath.includes('report-card')) tmplType = 'Report Card';
    else if (cleanPath.includes('staff-id')) tmplType = 'Staff ID Card';
    else if (cleanPath.includes('student-id')) tmplType = 'Student ID Card';
    else if (cleanPath.includes('fee-challan')) tmplType = 'Fee Challan';

    if (isAdd) {
      return {
        module: 'Configuration',
        subModule: 'Templates',
        action: 'Template Created',
        actionType: 'CREATE',
        details: `User: ${userName}, Action: Create Template for '${tmplName}', Type: '${tmplType}'`,
      };
    }
    if (isUpdate) {
      const changes = getFieldChangesSummary(beforeDoc, body, ['htmlContent', 'cssContent']);
      const isHtmlUpdated = body.htmlContent !== undefined && body.htmlContent !== beforeDoc?.htmlContent;
      const htmlNote = isHtmlUpdated ? ', Layout Updated' : '';
      return {
        module: 'Configuration',
        subModule: 'Templates',
        action: 'Update Template',
        actionType: 'UPDATE',
        details: `User: ${userName}, Action: Update Template for '${tmplName}' (${tmplType})${htmlNote}${changes ? `, Updated: ${changes}` : ''}`,
      };
    }
    if (isDelete) {
      return {
        module: 'Configuration',
        subModule: 'Templates',
        action: 'Template Deleted',
        actionType: 'DELETE',
        details: `User: ${userName}, Action: Delete Template for '${tmplName}', Type: '${tmplType}'`,
      };
    }
  }

  return null;
};

// 16. Authentication
const formatAuthLog = async (method, cleanPath, body, respDoc, userName, isFailed, failureReason, ipAddress) => {
  if (cleanPath.includes('/login')) {
    const email = body.email || respDoc?.user?.email || 'user';
    const role = respDoc?.user?.role || 'STAFF';
    const ipStr = ipAddress ? `, IP: ${ipAddress}` : '';

    if (isFailed) {
      return {
        module: 'Authentication',
        subModule: 'Login',
        action: 'Login Failed',
        actionType: 'AUTH',
        details: `User: ${userName}, Action: Failed Login Attempt for '${email}', Reason: ${failureReason}${ipStr}`,
      };
    }

    return {
      module: 'Authentication',
      subModule: 'Login',
      action: 'User Login',
      actionType: 'AUTH',
      details: `User: ${userName}, Action: User Login for '${userName}' (${email}), Role: ${role}${ipStr}`,
    };
  }

  if (cleanPath.includes('/logout')) {
    return {
      module: 'Authentication',
      subModule: 'Logout',
      action: 'User Logout',
      actionType: 'AUTH',
      details: `User: ${userName}, Action: User Logout for '${userName}'`,
    };
  }

  return null;
};

/**
 * Main Activity Logger Middleware
 */
const activityLogger = (req, res, next) => {
  const url = req.originalUrl || req.url;
  const cleanPath = url.split('?')[0].toLowerCase();
  const method = req.method.toUpperCase();

  // 1. Strictly ignore GET requests and system internal paths
  if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
    return next();
  }

  for (const excluded of EXCLUDED_PATHS) {
    if (cleanPath.startsWith(excluded)) {
      return next();
    }
  }

  // 2. Wrap res.json and res.send to capture response status & payload
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseData = null;

  res.json = function (data) {
    responseData = data;
    return originalJson(data);
  };

  res.send = function (data) {
    if (!responseData) {
      try {
        responseData = JSON.parse(data);
      } catch (e) {
        responseData = data;
      }
    }
    return originalSend(data);
  };

  // 3. Response interceptor pipe on finish
  res.on('finish', () => {
    setImmediate(async () => {
      try {
        const isFailed = res.statusCode >= 400;

        // Skip unauthenticated background errors unless explicit login attempt
        const isLoginAttempt = cleanPath.includes('/api/auth/login');
        if (!req.user && !isLoginAttempt && isFailed) {
          return;
        }

        // Extract user identity
        let user = req.user;
        let userName = user?.name || '';
        let userEmail = user?.email || '';
        let userRole = user?.role || 'STAFF';
        let staffId = user?.staffId || '';

        // If no user on req, inspect JWT token from authorization header or cookie
        if (!user) {
          const authHeader = req.headers.authorization;
          const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : req.cookies?.concordia_token;

          if (token && process.env.JWT_SECRET) {
            try {
              const decoded = jwt.verify(token, process.env.JWT_SECRET);
              user = decoded;
              userName = user.name || userName;
              userEmail = user.email || userEmail;
              userRole = user.role || userRole;
              staffId = user.staffId || '';
            } catch (err) {
              // Ignore token verification error
            }
          }
        }

        // Special handling for login attempt
        if (isLoginAttempt) {
          if (!isFailed && responseData?.user) {
            user = responseData.user;
            userName = user.name || user.email;
            userEmail = user.email || userEmail;
            userRole = user.role || userRole;
            staffId = user.staffId || '';
          } else {
            userEmail = req.body?.email || '';
            userName = userEmail || 'Anonymous';
          }
        }

        // If logged in, fetch full name if only ID was stored
        if (user && (user.id || user._id) && (!userName || userName === 'Anonymous')) {
          try {
            const dbUser = await User.findById(user.id || user._id).select('name email role isStaff refId');
            if (dbUser) {
              userName = dbUser.name || userName;
              userEmail = dbUser.email || userEmail;
              userRole = dbUser.role || userRole;
              if (dbUser.refId) {
                const staffDoc = await Staff.findById(dbUser.refId).select('staffId');
                if (staffDoc) staffId = staffDoc.staffId;
              }
            }
          } catch (e) {
            // Ignore DB lookup error
          }
        }

        if (!userName) userName = 'System User';

        // Extract failure reason if request failed
        let failureReason = '';
        if (isFailed) {
          if (res.locals?.errorMessage) {
            failureReason = res.locals.errorMessage;
          } else if (typeof responseData === 'object' && responseData !== null) {
            failureReason = responseData.message || responseData.error || (Array.isArray(responseData.errors) ? responseData.errors.join(', ') : null) || 'Request failed';
          } else if (typeof responseData === 'string') {
            failureReason = responseData.slice(0, 200);
          } else {
            failureReason = `HTTP Error ${res.statusCode}`;
          }
        }

        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';

        const respDoc = (responseData && typeof responseData === 'object')
          ? (responseData.data || responseData.expense || responseData.student || responseData.staff || responseData.challan || responseData)
          : null;

        const requestBody = req.body || {};

        // Route to dedicated module formatter
        let formatted = null;

        if (cleanPath.startsWith('/api/finance/expense')) {
          formatted = await formatExpenseLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/finance/income')) {
          formatted = await formatIncomeLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/finance/closing')) {
          formatted = await formatClosingLog(method, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/finance/categories')) {
          formatted = await formatFinanceSettingsLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/student')) {
          formatted = await formatStudentLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/fee')) {
          formatted = await formatFeeLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/hr/staff') || cleanPath.startsWith('/api/staff')) {
          formatted = await formatStaffLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/hr') || cleanPath.startsWith('/api/department')) {
          formatted = await formatHRPayrollLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/attendance')) {
          formatted = await formatAttendanceLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/front-office')) {
          formatted = await formatFrontOfficeLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/academics')) {
          formatted = await formatAcademicsLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/exams')) {
          formatted = await formatExamLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/hostel')) {
          formatted = await formatHostelLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/inventory')) {
          formatted = await formatInventoryLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/wallets') || cleanPath.startsWith('/api/configuration') || cleanPath.startsWith('/api/admin')) {
          formatted = await formatConfigurationLog(method, cleanPath, requestBody, respDoc, req._beforeDoc, userName);
        } else if (cleanPath.startsWith('/api/auth')) {
          formatted = await formatAuthLog(method, cleanPath, requestBody, respDoc, userName, isFailed, failureReason, ipAddress);
        }

        // Fallback formatter if no specific module matched
        if (!formatted) {
          const mod = cleanPath.split('/')[2] || 'System';
          const modCapitalized = mod.charAt(0).toUpperCase() + mod.slice(1);
          formatted = {
            module: modCapitalized,
            subModule: '',
            action: `${method === 'POST' ? 'Created' : (method === 'DELETE' ? 'Deleted' : 'Updated')} ${modCapitalized}`,
            actionType: method === 'DELETE' ? 'DELETE' : (method === 'POST' ? 'CREATE' : 'UPDATE'),
            details: `User: ${userName}, Action: ${method} for '${modCapitalized}'`,
          };
        }

        // Append failure notation if request resulted in error
        let finalDetails = formatted.details;
        if (isFailed && !cleanPath.includes('/login')) {
          finalDetails = `${formatted.details} [FAILED], Reason: ${failureReason}`;
        }

        // Save activity log
        await ActivityLog.create({
          userId: user?.id || user?._id || null,
          staffId: staffId || '',
          userName,
          userEmail,
          userRole,
          module: formatted.module,
          subModule: formatted.subModule || '',
          action: formatted.action,
          actionType: formatted.actionType || 'ACTION',
          details: finalDetails,
          description: finalDetails,
          method,
          endpoint: url,
          status: isFailed ? 'FAILED' : 'SUCCESS',
          statusCode: res.statusCode,
          failureReason: failureReason || '',
          ipAddress,
          userAgent,
          timestamp: new Date(),
        });
      } catch (logErr) {
        console.error('[ActivityLogger] Error logging activity:', logErr.message);
      }
    });
  });

  // Pre-fetch before-document on update/delete, then proceed
  if (['PUT', 'PATCH', 'DELETE'].includes(method)) {
    preFetchBeforeDoc(req)
      .catch(() => {})
      .finally(() => {
        next();
      });
  } else {
    next();
  }
};

module.exports = activityLogger;
