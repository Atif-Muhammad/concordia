const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  ActivityLog,
  Staff,
  User,
  Student,
  FeeChallan,
  ExtraChallan,
  FinanceExpense,
  FinanceIncome,
  InventoryItem,
  Wallet,
} = require('../models');

// Field human-friendly labels mapping
const FIELD_LABELS = {
  fName: "First Name",
  lName: "Last Name",
  firstName: "First Name",
  lastName: "Last Name",
  fatherName: "Father's Name",
  fatherOrguardian: "Father's Name",
  guardianName: "Guardian Name",
  rollNumber: "Roll Number",
  rollNo: "Roll Number",
  gender: "Gender",
  email: "Email Address",
  phone: "Phone Number",
  contactNumber: "Contact Number",
  emergencyContact: "Emergency Contact",
  guardianPhone: "Guardian Phone",
  parentOrGuardianPhone: "Parent / Guardian Phone",
  address: "Address",
  dob: "Date of Birth",
  dateOfBirth: "Date of Birth",
  admissionDate: "Admission Date",
  registrationNumber: "Registration Number",
  status: "Status",
  programId: "Program",
  classId: "Class",
  sectionId: "Section",
  sessionId: "Academic Session",
  session: "Academic Session",
  bloodGroup: "Blood Group",
  religion: "Religion",
  cnic: "CNIC / B-Form",
  studentCnic: "Student CNIC",
  parentCNIC: "Parent CNIC",
  fatherCnic: "Father CNIC",
  tuitionFee: "Tuition Fee",
  totalTuition: "Total Tuition",
  dueDate: "Due Date",
  fine: "Late Fine",
  lateFeeFine: "Late Fee Fine",
  amount: "Amount",
  totalAmount: "Total Amount",
  paidAmount: "Paid Amount",
  balance: "Balance",
  discountAmount: "Discount Amount",
  heads: "Fee Heads",
  customHeads: "Custom Heads",
  staffId: "Staff ID",
  designation: "Designation",
  department: "Department",
  basicSalary: "Basic Salary",
  joiningDate: "Joining Date",
  qualification: "Qualification",
  maritalStatus: "Marital Status",
  employmentType: "Employment Type",
  bankName: "Bank Name",
  accountNumber: "Account Number",
  accountTitle: "Account Title",
  walletId: "Wallet / Account",
  paymentMethod: "Payment Method",
  note: "Note / Remarks",
  remarks: "Remarks",
  title: "Title",
  description: "Description",
  category: "Category",
  quantity: "Quantity",
  unitPrice: "Unit Price",
  unit: "Unit",
  supplier: "Supplier / Vendor",
  roomNumber: "Room Number",
  bedNumber: "Bed Number",
  accountName: "Account Name",
  currentBalance: "Current Balance",
};

const formatFieldLabel = (key) => {
  if (!key) return '';
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const resolveTargetFromDoc = (doc, entityType) => {
  if (!doc) return null;
  const idStr = String(doc._id || doc.id || '');

  switch (entityType) {
    case 'Student': {
      const fName = doc.fName || doc.firstName || '';
      const lName = doc.lName || doc.lastName || '';
      const name = `${fName} ${lName}`.trim() || doc.name || doc.studentName || 'Student';
      const father = doc.fatherOrguardian || doc.fatherName || doc.guardianName || '';
      const roll = doc.rollNumber || doc.rollNo || '';
      return {
        entityType: 'Student',
        entityId: idStr,
        name,
        subTitle: father ? `Father: ${father}` : '',
        identifier: roll ? `Roll: ${roll}` : '',
      };
    }
    case 'Staff': {
      const fName = doc.fName || doc.firstName || '';
      const lName = doc.lName || doc.lastName || '';
      const name = doc.name || `${fName} ${lName}`.trim() || 'Staff Member';
      const desig = doc.designation || (doc.department ? `Dept: ${doc.department}` : (doc.phone || ''));
      const sId = doc.staffId || '';
      return {
        entityType: 'Staff',
        entityId: idStr,
        name,
        subTitle: doc.fatherName ? `Father: ${doc.fatherName}` : (desig ? `Designation: ${desig}` : ''),
        identifier: sId ? `Staff ID: ${sId}` : '',
      };
    }
    case 'FeeChallan': {
      const challanNo = doc.challanNo || doc.challanNumber || 'N/A';
      const stName = doc.studentName || 'Fee Challan';
      const month = doc.feeMonth || (doc.dueDate ? `Due: ${new Date(doc.dueDate).toLocaleDateString()}` : '');
      return {
        entityType: 'FeeChallan',
        entityId: idStr,
        name: stName,
        subTitle: month ? `Month: ${month}` : '',
        identifier: `Challan: #${challanNo}`,
      };
    }
    case 'ExtraChallan': {
      const challanNo = doc.challanNo || 'N/A';
      const stName = doc.studentName || 'Extra Challan';
      const title = doc.title || (doc.dueDate ? `Due: ${new Date(doc.dueDate).toLocaleDateString()}` : '');
      return {
        entityType: 'ExtraChallan',
        entityId: idStr,
        name: stName,
        subTitle: title ? `Title: ${title}` : '',
        identifier: `Extra Challan: #${challanNo}`,
      };
    }
    case 'FinanceExpense': {
      const title = doc.title || doc.category || 'Expense Voucher';
      const amt = doc.amount != null ? `PKR ${Number(doc.amount).toLocaleString()}` : '';
      const voucher = doc.voucherNo || idStr.slice(-6);
      return {
        entityType: 'Expense',
        entityId: idStr,
        name: title,
        subTitle: amt,
        identifier: `Voucher: ${voucher}`,
      };
    }
    case 'FinanceIncome': {
      const title = doc.title || doc.source || 'Income Voucher';
      const amt = doc.amount != null ? `PKR ${Number(doc.amount).toLocaleString()}` : '';
      const receipt = doc.receiptNo || idStr.slice(-6);
      return {
        entityType: 'Income',
        entityId: idStr,
        name: title,
        subTitle: amt,
        identifier: `Receipt: ${receipt}`,
      };
    }
    case 'InventoryItem': {
      const name = doc.itemName || doc.name || 'Inventory Item';
      const cat = doc.category || (doc.quantity != null ? `Qty: ${doc.quantity}` : '');
      const code = doc.itemCode || idStr.slice(-6);
      return {
        entityType: 'Inventory',
        entityId: idStr,
        name,
        subTitle: cat,
        identifier: `Item: ${code}`,
      };
    }
    case 'Wallet': {
      const name = doc.accountName || doc.name || 'Financial Account';
      const type = doc.accountType || (doc.currentBalance != null ? `Balance: PKR ${Number(doc.currentBalance).toLocaleString()}` : '');
      const acc = doc.accountNumber || idStr.slice(-6);
      return {
        entityType: 'Wallet',
        entityId: idStr,
        name,
        subTitle: type,
        identifier: `Account: ${acc}`,
      };
    }
    default: {
      return {
        entityType: entityType || 'General',
        entityId: idStr,
        name: doc.name || doc.title || 'Record',
        subTitle: doc.description || doc.type || '',
        identifier: idStr ? `ID: ${idStr.slice(-6)}` : '',
      };
    }
  }
};

const preFetchBeforeDoc = async (req) => {
  const url = req.originalUrl || req.url;
  const cleanPath = url.split('?')[0].toLowerCase();

  const idFromQuery = req.query?.studentID || req.query?.studentId || req.query?.challanID || req.query?.challanId || req.query?.staffId || req.query?.id || req.query?._id;
  const idFromBody = req.body?.studentID || req.body?.studentId || req.body?.challanId || req.body?.staffId || req.body?.id || req.body?._id;
  const idFromPath = url.match(/\/([a-f0-9]{24})(?:[/?#]|$)/i)?.[1];
  const targetId = idFromQuery || idFromPath || idFromBody;

  if (!targetId) return;

  let Model = null;
  let entityType = '';

  if (cleanPath.startsWith('/api/student')) {
    Model = Student;
    entityType = 'Student';
  } else if (cleanPath.startsWith('/api/hr/staff')) {
    Model = Staff;
    entityType = 'Staff';
  } else if (cleanPath.startsWith('/api/fee-management/extra-challan') || cleanPath.startsWith('/api/fee/challans/extra')) {
    Model = ExtraChallan;
    entityType = 'ExtraChallan';
  } else if (cleanPath.startsWith('/api/fee-management/challan') || cleanPath.startsWith('/api/fee/challans')) {
    Model = FeeChallan;
    entityType = 'FeeChallan';
  } else if (cleanPath.startsWith('/api/finance/expense')) {
    Model = FinanceExpense;
    entityType = 'FinanceExpense';
  } else if (cleanPath.startsWith('/api/finance/income')) {
    Model = FinanceIncome;
    entityType = 'FinanceIncome';
  } else if (cleanPath.startsWith('/api/inventory')) {
    Model = InventoryItem;
    entityType = 'InventoryItem';
  } else if (cleanPath.startsWith('/api/wallets')) {
    Model = Wallet;
    entityType = 'Wallet';
  }

  if (Model && targetId) {
    req._targetEntityType = entityType;
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      req._beforeDoc = await Model.findById(targetId).lean();
    } else {
      req._beforeDoc = await Model.findOne({
        $or: [{ _id: targetId }, { staffId: targetId }, { rollNumber: targetId }, { challanNo: targetId }]
      }).lean();
    }
  }
};

const areInstallmentsEqual = (oldList, newList) => {
  let a = oldList;
  let b = newList;
  if (typeof a === 'string') {
    try { a = JSON.parse(a); } catch (e) { a = []; }
  }
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch (e) { b = []; }
  }

  if (!Array.isArray(a) && !Array.isArray(b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  const toYMD = (d) => {
    if (!d) return '';
    if (d instanceof Date) return d.toISOString().split('T')[0];
    return String(d).split('T')[0];
  };

  for (let i = 0; i < a.length; i++) {
    const itemA = a[i] || {};
    const itemB = b[i] || {};

    const numA = itemA.installmentNumber || (i + 1);
    const numB = itemB.installmentNumber || (i + 1);
    if (numA !== numB) return false;

    const amtA = Number(itemA.amount || 0);
    const amtB = Number(itemB.amount || 0);
    if (amtA !== amtB) return false;

    const dueA = toYMD(itemA.dueDate);
    const dueB = toYMD(itemB.dueDate);
    if (dueA !== dueB) return false;

    const statusA = String(itemA.status || 'UNPAID').toUpperCase();
    const statusB = String(itemB.status || 'UNPAID').toUpperCase();
    if (statusA !== statusB) return false;

    const paidA = Number(itemA.paidAmount || 0);
    const paidB = Number(itemB.paidAmount || 0);
    if (paidA !== paidB) return false;
  }

  return true;
};

const sanitizeInstallmentsForLog = (list) => {
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch (e) { return list; }
  }
  if (!Array.isArray(list)) return [];
  return list.map((inst, idx) => ({
    installmentNumber: inst.installmentNumber || idx + 1,
    month: inst.month || '',
    amount: Number(inst.amount || 0),
    dueDate: inst.dueDate ? String(inst.dueDate).split('T')[0] : '',
    status: (inst.status || 'UNPAID').toUpperCase(),
    paidAmount: Number(inst.paidAmount || 0),
  }));
};

const calculateDiff = (beforeDoc, afterDoc, body) => {
  if (!beforeDoc) return [];
  const changes = [];
  const ignoredKeys = new Set([
    '_id', 'id', 'studentID', 'studentId', 'challanId', 'staffId',
    'createdAt', 'updatedAt', '__v', 'password', 'token', 'removePhoto',
    'files', 'headers', 'authorization'
  ]);

  const candidateKeys = new Set([
    ...Object.keys(body || {}),
    'lateFeeFine', 'totalAmount', 'status', 'dueAmount', 'paidAmount'
  ]);

  for (const key of candidateKeys) {
    if (ignoredKeys.has(key)) continue;

    const oldRaw = beforeDoc[key];
    const newRaw = afterDoc && afterDoc[key] !== undefined ? afterDoc[key] : (body ? body[key] : undefined);

    if (newRaw === undefined) continue;

    // Special handling for installments array
    if (key === 'installments') {
      if (areInstallmentsEqual(oldRaw, newRaw)) {
        continue;
      }
      changes.push({
        field: 'installments',
        fieldLabel: 'Installment Plan',
        oldValue: sanitizeInstallmentsForLog(oldRaw),
        newValue: sanitizeInstallmentsForLog(newRaw),
      });
      continue;
    }

    const normalize = (v) => {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString().split('T')[0];
      if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.split('T')[0];
        return v.trim();
      }
      if (typeof v === 'number') return String(v);
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'object') {
        if (v._id) return String(v._id);
        try { return JSON.stringify(v); } catch { return String(v); }
      }
      return String(v);
    };

    const normOld = normalize(oldRaw);
    const normNew = normalize(newRaw);

    if (normOld !== normNew) {
      changes.push({
        field: key,
        fieldLabel: formatFieldLabel(key),
        oldValue: oldRaw ?? (normOld === '' ? 'None' : normOld),
        newValue: newRaw ?? (normNew === '' ? 'None' : normNew),
      });
    }
  }

  return changes;
};

// Helper to sanitize request body
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  
  const sanitized = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'accesstoken', 'refreshtoken', 'authorization', 'cvv', 'pin'];
  
  for (const [key, val] of Object.entries(data)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '***';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};

// Route categorization mapper
const resolveModuleInfo = (path, method, body = {}, user = null) => {
  const cleanPath = path.split('?')[0].toLowerCase();
  let module = 'General';
  let subModule = 'General';
  let action = method;
  let description = `${method} ${path}`;

  // Method to human action
  const methodMap = {
    POST: 'Create',
    PUT: 'Update',
    PATCH: 'Update',
    DELETE: 'Delete',
    GET: 'Read'
  };
  const actionPrefix = methodMap[method] || method;

  // 1. Authentication
  if (cleanPath.startsWith('/api/auth')) {
    module = 'Authentication';
    if (cleanPath.includes('/login')) {
      subModule = 'Login';
      action = 'LOGIN';
      description = `User logged into system (${body?.email || 'credentials'})`;
    } else if (cleanPath.includes('/logout')) {
      subModule = 'Logout';
      action = 'LOGOUT';
      description = `User logged out`;
    } else if (cleanPath.includes('/refresh')) {
      subModule = 'Session';
      action = 'REFRESH_TOKEN';
      description = `Refreshed auth session`;
    } else {
      subModule = 'Profile';
      action = 'PROFILE_CHECK';
      description = `Checked user identity`;
    }
    return { module, subModule, action, description };
  }

  // 2. Front Office
  if (cleanPath.startsWith('/api/front-office')) {
    module = 'Front Office';
    if (cleanPath.includes('/inquir')) {
      subModule = 'Inquiry';
      description = `${actionPrefix} Inquiry: ${body?.name || body?.studentName || ''}`.trim();
    } else if (cleanPath.includes('/visitor')) {
      subModule = 'Visitor Book';
      description = `${actionPrefix} Visitor Pass: ${body?.visitorName || body?.name || ''}`.trim();
    } else if (cleanPath.includes('/complaint')) {
      subModule = 'Complaints';
      description = `${actionPrefix} Complaint: ${body?.title || body?.complaintBy || ''}`.trim();
    } else if (cleanPath.includes('/contact')) {
      subModule = 'Contacts';
      description = `${actionPrefix} Contact Directory Record`;
    }
    action = `${actionPrefix.toUpperCase()}_${subModule.toUpperCase().replace(/\s+/g, '_')}`;
    return { module, subModule, action, description };
  }

  // 3. Students
  if (cleanPath.startsWith('/api/student')) {
    module = 'Students';
    subModule = 'Admissions & Directory';
    if (method === 'POST') {
      action = 'STUDENT_ADMISSION';
      description = `Admitted new student: ${body?.name || ''} ${body?.rollNumber ? `(Roll: ${body.rollNumber})` : ''}`.trim();
    } else if (method === 'DELETE') {
      action = 'DELETE_STUDENT';
      description = `Deleted student profile`;
    } else if (cleanPath.includes('/status') || body?.status) {
      action = 'UPDATE_STUDENT_STATUS';
      description = `Changed student status to ${body?.status || 'updated'}`;
    } else {
      action = 'UPDATE_STUDENT';
      description = `Updated student information ${body?.name ? `(${body.name})` : ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 4. Staff & HR
  if (cleanPath.startsWith('/api/hr')) {
    if (cleanPath.includes('/staff-id')) {
      module = 'Staff';
      subModule = 'Settings';
      action = `${actionPrefix.toUpperCase()}_STAFF_ID_SETTINGS`;
      description = `${actionPrefix} Staff ID auto-generation settings`;
    } else if (cleanPath.includes('/staff')) {
      module = 'Staff';
      subModule = 'Staff Directory';
      if (method === 'POST') {
        action = 'CREATE_STAFF';
        description = `Created staff record: ${body?.name || ''} ${body?.staffId ? `(${body.staffId})` : ''}`.trim();
      } else if (method === 'DELETE') {
        action = 'DELETE_STAFF';
        description = `Deleted staff record`;
      } else if (cleanPath.includes('/salary-revision')) {
        action = 'REVISE_SALARY';
        description = `Revised staff salary ${body?.amountChanged ? `by ${body.amountChanged}` : ''}`.trim();
      } else {
        action = 'UPDATE_STAFF';
        description = `Updated staff profile ${body?.name ? `(${body.name})` : ''}`.trim();
      }
    } else if (cleanPath.includes('/leave')) {
      module = 'HR & Payroll';
      subModule = 'Leaves';
      action = `${actionPrefix.toUpperCase()}_LEAVE`;
      description = `${actionPrefix} Staff Leave Application`;
    } else if (cleanPath.includes('/payroll')) {
      module = 'HR & Payroll';
      subModule = 'Payroll';
      if (cleanPath.includes('/generate')) {
        action = 'GENERATE_PAYROLL';
        description = `Generated monthly payroll sheet for ${body?.month || 'selected month'}`;
      } else if (cleanPath.includes('/pay') || cleanPath.includes('/process')) {
        action = 'PAY_SALARY';
        description = `Disbursed staff salary`;
      } else {
        action = `${actionPrefix.toUpperCase()}_PAYROLL`;
        description = `${actionPrefix} Payroll Record`;
      }
    } else if (cleanPath.includes('/advance')) {
      module = 'HR & Payroll';
      subModule = 'Advance Salary';
      action = `${actionPrefix.toUpperCase()}_ADVANCE_SALARY`;
      description = `${actionPrefix} Advance Salary Voucher ${body?.amount ? `(PKR ${body.amount})` : ''}`.trim();
    } else if (cleanPath.includes('/holiday')) {
      module = 'HR & Payroll';
      subModule = 'Holidays';
      action = `${actionPrefix.toUpperCase()}_HOLIDAY`;
      description = `${actionPrefix} Calendar Holiday: ${body?.title || ''}`.trim();
    } else if (cleanPath.includes('/department')) {
      module = 'HR & Payroll';
      subModule = 'Departments';
      action = `${actionPrefix.toUpperCase()}_DEPARTMENT`;
      description = `${actionPrefix} Department: ${body?.name || ''}`.trim();
    } else {
      module = 'HR & Payroll';
      subModule = 'General HR';
      action = `${actionPrefix.toUpperCase()}_HR`;
      description = `${actionPrefix} HR record`;
    }
    return { module, subModule, action, description };
  }

  // 5. Department separate route
  if (cleanPath.startsWith('/api/department')) {
    module = 'HR & Payroll';
    subModule = 'Departments';
    action = `${actionPrefix.toUpperCase()}_DEPARTMENT`;
    description = `${actionPrefix} Department: ${body?.name || ''}`.trim();
    return { module, subModule, action, description };
  }

  // 6. Attendance
  if (cleanPath.startsWith('/api/attendance')) {
    module = 'Attendance';
    if (cleanPath.includes('/leave')) {
      subModule = 'Leave';
      action = `${actionPrefix.toUpperCase()}_ATTENDANCE_LEAVE`;
      description = `${actionPrefix} Student Leave`;
    } else if (cleanPath.includes('/skip')) {
      subModule = 'Settings';
      action = `${actionPrefix.toUpperCase()}_ATTENDANCE_SKIP`;
      description = `${actionPrefix} Attendance Skip rule`;
    } else {
      subModule = 'Record Attendance';
      action = 'MARK_ATTENDANCE';
      description = `Marked student attendance for ${body?.date || 'class'}`;
    }
    return { module, subModule, action, description };
  }

  // 7. Academics
  if (cleanPath.startsWith('/api/academics')) {
    module = 'Academics';
    if (cleanPath.includes('/session')) {
      subModule = 'Sessions';
      description = `${actionPrefix} Academic Session: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/program')) {
      subModule = 'Programs';
      description = `${actionPrefix} Academic Program: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/class')) {
      subModule = 'Classes';
      description = `${actionPrefix} Class: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/section')) {
      subModule = 'Sections';
      description = `${actionPrefix} Section: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/subject')) {
      subModule = 'Subjects';
      description = `${actionPrefix} Subject: ${body?.name || ''} ${body?.code ? `(${body.code})` : ''}`.trim();
    } else if (cleanPath.includes('/scm')) {
      subModule = 'Subject Classes';
      description = `${actionPrefix} Subject-Class Curriculum Assignment`;
    } else if (cleanPath.includes('/tcm') || cleanPath.includes('/tsm')) {
      subModule = 'Teacher Classes';
      description = `${actionPrefix} Teacher Class/Subject Allocation`;
    } else if (cleanPath.includes('/timetable')) {
      subModule = 'Timetable';
      description = `${actionPrefix} Class Timetable Schedule`;
    } else {
      subModule = 'General Academics';
      description = `${actionPrefix} Academic Setup`;
    }
    action = `${actionPrefix.toUpperCase()}_${subModule.toUpperCase().replace(/\s+/g, '_')}`;
    return { module, subModule, action, description };
  }

  // 8. Fee Management
  if (cleanPath.startsWith('/api/fee-management') || cleanPath.startsWith('/api/fee')) {
    module = 'Fee Management';
    if (cleanPath.includes('/extra-challan')) {
      subModule = 'Extra Challans';
      action = `${actionPrefix.toUpperCase()}_EXTRA_CHALLAN`;
      description = `${actionPrefix} Extra / Ad-hoc Challan`;
    } else if (cleanPath.includes('/challan')) {
      subModule = 'Challans';
      if (cleanPath.includes('/generate')) {
        action = 'GENERATE_CHALLANS';
        description = `Generated monthly fee challans`;
      } else if (cleanPath.includes('/pay') || cleanPath.includes('/transaction')) {
        action = 'COLLECT_FEE';
        description = `Collected fee payment ${body?.amount ? `PKR ${body.amount}` : ''} ${body?.challanNo ? `for Challan #${body.challanNo}` : ''}`.trim();
      } else {
        action = `${actionPrefix.toUpperCase()}_CHALLAN`;
        description = `${actionPrefix} Fee Challan`;
      }
    } else if (cleanPath.includes('/feehead') || cleanPath.includes('/fee-head')) {
      subModule = 'Fee Heads';
      action = `${actionPrefix.toUpperCase()}_FEE_HEAD`;
      description = `${actionPrefix} Fee Head: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/structure')) {
      subModule = 'Fee Structures';
      action = `${actionPrefix.toUpperCase()}_FEE_STRUCTURE`;
      description = `${actionPrefix} Fee Package Structure: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/settings')) {
      subModule = 'Settings';
      action = `${actionPrefix.toUpperCase()}_FEE_SETTINGS`;
      description = `${actionPrefix} Fee Policy Settings`;
    } else {
      subModule = 'Challans';
      action = `${actionPrefix.toUpperCase()}_FEE`;
      description = `${actionPrefix} Fee Record`;
    }
    return { module, subModule, action, description };
  }

  // 9. Examination
  if (cleanPath.startsWith('/api/exams')) {
    module = 'Examination';
    if (cleanPath.includes('/marks')) {
      subModule = 'Marks Entry';
      action = 'SAVE_MARKS';
      description = `Submitted exam subject marks`;
    } else if (cleanPath.includes('/result')) {
      subModule = 'Results';
      action = 'PUBLISH_RESULTS';
      description = `Computed / Published Examination Results`;
    } else {
      subModule = 'Exams';
      action = `${actionPrefix.toUpperCase()}_EXAM`;
      description = `${actionPrefix} Exam Term: ${body?.name || ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 10. Boarding / Hostel
  if (cleanPath.startsWith('/api/hostel')) {
    module = 'Boarding';
    if (cleanPath.includes('/registration')) {
      subModule = 'Registration';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_REGISTRATION`;
      description = `${actionPrefix} Hostel Student Admission`;
    } else if (cleanPath.includes('/room')) {
      subModule = 'Rooms';
      action = `${actionPrefix.toUpperCase()}_ROOM`;
      description = `${actionPrefix} Hostel Room / Bed: ${body?.roomNumber || ''}`.trim();
    } else if (cleanPath.includes('/fee') || cleanPath.includes('/challan')) {
      subModule = 'Fees';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_FEE`;
      description = `${actionPrefix} Boarding / Mess Fee Challan`;
    } else if (cleanPath.includes('/expense')) {
      subModule = 'Expenses';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_EXPENSE`;
      description = `${actionPrefix} Hostel Mess / Utility Expense: ${body?.title || ''}`.trim();
    } else if (cleanPath.includes('/inventory')) {
      subModule = 'Inventory';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_INVENTORY`;
      description = `${actionPrefix} Hostel Furniture / Appliance Stock`;
    } else {
      subModule = 'Settings';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_SETTINGS`;
      description = `${actionPrefix} Hostel Rules / Settings`;
    }
    return { module, subModule, action, description };
  }

  // 11. Finance
  if (cleanPath.startsWith('/api/finance')) {
    module = 'Finance';
    if (cleanPath.includes('/income')) {
      subModule = 'Income';
      action = `${actionPrefix.toUpperCase()}_INCOME`;
      description = `Recorded Income Voucher ${body?.amount ? `PKR ${body.amount}` : ''} (${body?.title || 'General'})`.trim();
    } else if (cleanPath.includes('/expense')) {
      subModule = 'Expense';
      action = `${actionPrefix.toUpperCase()}_EXPENSE`;
      description = `Recorded Expense Voucher ${body?.amount ? `PKR ${body.amount}` : ''} (${body?.title || 'General'})`.trim();
    } else if (cleanPath.includes('/closing')) {
      subModule = 'Closing';
      action = 'DAILY_CLOSING';
      description = `Submitted financial drawer closing ${body?.closingDate ? `for ${body.closingDate}` : ''}`.trim();
    } else {
      subModule = 'Dashboard';
      action = 'VIEW_FINANCE';
      description = `Finance Overview`;
    }
    return { module, subModule, action, description };
  }

  // 12. Inventory
  if (cleanPath.startsWith('/api/inventory')) {
    module = 'Inventory';
    if (cleanPath.includes('/expense')) {
      subModule = 'Expenses';
      action = `${actionPrefix.toUpperCase()}_INVENTORY_EXPENSE`;
      description = `${actionPrefix} Inventory Purchase Order`;
    } else {
      subModule = 'Inventory';
      action = `${actionPrefix.toUpperCase()}_INVENTORY_ITEM`;
      description = `${actionPrefix} Campus Inventory Item: ${body?.name || ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 13. Wallets
  if (cleanPath.startsWith('/api/wallets')) {
    module = 'Wallets / Accounts';
    subModule = 'Wallets';
    if (cleanPath.includes('/transfer')) {
      action = 'WALLET_TRANSFER';
      description = `Contra Transfer: PKR ${body?.amount || 0} between accounts`;
    } else if (cleanPath.includes('/deposit')) {
      action = 'DIRECT_DEPOSIT';
      description = `Direct Deposit: PKR ${body?.amount || 0} to account`;
    } else {
      action = `${actionPrefix.toUpperCase()}_WALLET`;
      description = `${actionPrefix} Financial Account / Wallet: ${body?.accountName || body?.name || ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 14. Configuration
  if (cleanPath.startsWith('/api/configuration')) {
    module = 'Configuration';
    if (cleanPath.includes('/institute')) {
      subModule = 'Institute';
      action = 'UPDATE_INSTITUTE_SETTINGS';
      description = `Updated Institute Branding and Profile Information`;
    } else if (cleanPath.includes('template')) {
      subModule = 'Templates';
      action = `${actionPrefix.toUpperCase()}_TEMPLATE`;
      description = `${actionPrefix} Document Print Template: ${body?.type || ''}`.trim();
    } else {
      subModule = 'General Config';
      action = `${actionPrefix.toUpperCase()}_CONFIGURATION`;
      description = `${actionPrefix} System Configuration`;
    }
    return { module, subModule, action, description };
  }

  // 15. Admin users
  if (cleanPath.startsWith('/api/admin')) {
    module = 'Configuration';
    if (cleanPath.includes('/teacher/attendance')) {
      module = 'Attendance';
      subModule = 'Teacher Attendance';
      action = 'MARK_TEACHER_ATTENDANCE';
      description = `Marked Teacher Attendance for ${body?.date || 'selected date'}`;
    } else {
      subModule = 'Admins';
      action = `${actionPrefix.toUpperCase()}_ADMIN_ACCOUNT`;
      description = `${actionPrefix} Administrator / Staff Access Permissions: ${body?.email || body?.name || ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 16. Teacher Portal
  if (cleanPath.startsWith('/api/teacher')) {
    module = 'Teacher Portal';
    subModule = 'Teacher Actions';
    action = `${actionPrefix.toUpperCase()}_TEACHER_PORTAL`;
    description = `Teacher Portal Activity: ${cleanPath}`;
    return { module, subModule, action, description };
  }

  // 17. Complaints
  if (cleanPath.startsWith('/api/complaints')) {
    module = 'Complaints';
    subModule = 'Complaints';
    action = `${actionPrefix.toUpperCase()}_COMPLAINT`;
    description = `${actionPrefix} Campus Complaint`;
    return { module, subModule, action, description };
  }

  // 18. Dashboard
  if (cleanPath.startsWith('/api/dashboard')) {
    module = 'Dashboard';
    subModule = 'Dashboard';
    action = 'VIEW_DASHBOARD';
    description = `Viewed Dashboard Overview`;
    return { module, subModule, action, description };
  }

  // Fallback for any unknown /api/* endpoint
  const segments = cleanPath.replace('/api/', '').split('/').filter(Boolean);
  const modName = segments[0] ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : 'System';
  const subModName = segments[1] ? segments[1].charAt(0).toUpperCase() + segments[1].slice(1) : 'General';
  return {
    module: modName,
    subModule: subModName,
    action: `${actionPrefix.toUpperCase()}_${subModName.toUpperCase()}`,
    description: `${actionPrefix} in ${modName} - ${subModName}`
  };
};

/**
 * Activity logger middleware
 */
const activityLogger = (req, res, next) => {
  const url = req.originalUrl || req.url;

  // Ignore static assets, health checks, and log querying endpoints
  if (
    !url.startsWith('/api/') ||
    url.startsWith('/api/health') ||
    url.startsWith('/api/configuration/activity-logs') ||
    url.startsWith('/profile') ||
    url.startsWith('/uploads') ||
    url.includes('/favicon.ico')
  ) {
    return next();
  }

  const method = req.method.toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const isUpdateOrDelete = ['PUT', 'PATCH', 'DELETE'].includes(method);

  // Extract auth token immediately if present
  let authUser = req.user || null;
  if (!authUser) {
    const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        authUser = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtsecretkey_concordia_2026');
      } catch (e) {
        // invalid token
      }
    }
  }

  // Intercept response to capture response body (especially error messages / success user)
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseData = null;

  res.json = (data) => {
    responseData = data;
    return originalJson(data);
  };

  res.send = (data) => {
    if (!responseData) {
      try {
        responseData = typeof data === 'string' && data.startsWith('{') ? JSON.parse(data) : data;
      } catch (e) {
        responseData = data;
      }
    }
    return originalSend(data);
  };

  // When request completes
  res.on('finish', () => {
    const isFailed = res.statusCode >= 400;
    const isAuth = url.startsWith('/api/auth/login') || url.startsWith('/api/auth/logout');

    // Skip normal GET reading of polling/lists if not failed
    if (!isMutating && !isFailed && !isAuth) {
      return;
    }

    setImmediate(async () => {
      try {
        // Resolve user: prioritize response user on login, then req.user, then decoded authUser
        let user = authUser || req.user || null;
        let staffId = '';
        let userName = user?.name || 'Anonymous';
        let userEmail = user?.email || '';
        let userRole = user?.role || 'STAFF';

        // Check if login request succeeded, responseData contains { user: {...} }
        if (url.startsWith('/api/auth/login')) {
          if (res.statusCode < 400 && responseData?.user) {
            user = responseData.user;
            userName = user.name || userName;
            userEmail = user.email || userEmail;
            userRole = user.role || userRole;
            staffId = user.staffId || '';
          } else {
            // Failed login: record attempted identifier
            userEmail = req.body?.email || '';
            userName = req.body?.email ? `Attempted: ${req.body.email}` : 'Anonymous';
          }
        }

        // If user is authenticated, retrieve staffId if not present
        if (user && user.id && !staffId) {
          try {
            const dbUser = await User.findById(user.id).select('name email role isStaff refId');
            if (dbUser) {
              userName = dbUser.name;
              userEmail = dbUser.email;
              userRole = dbUser.role;
              if (dbUser.refId) {
                const staffDoc = await Staff.findById(dbUser.refId).select('staffId');
                if (staffDoc) staffId = staffDoc.staffId;
              }
            }
          } catch (e) {
            // Ignore DB lookup error in logger
          }
        }

        // Resolve base module info
        let { module, subModule, action, description } = resolveModuleInfo(url, method, req.body, user);

        // Resolve Target Entity
        let targetEntity = null;
        if (req._beforeDoc && req._targetEntityType) {
          targetEntity = resolveTargetFromDoc(req._beforeDoc, req._targetEntityType);
        } else if (res.statusCode < 400) {
          const respDoc = (responseData && typeof responseData === 'object')
            ? (responseData.data || responseData.student || responseData.staff || responseData.challan || responseData)
            : null;
          if (respDoc && typeof respDoc === 'object' && (respDoc._id || respDoc.name || respDoc.fName || respDoc.firstName || respDoc.studentName || respDoc.rollNumber || respDoc.challanNo)) {
            const cleanPath = url.split('?')[0].toLowerCase();
            let guessedType = '';
            if (cleanPath.startsWith('/api/student')) guessedType = 'Student';
            else if (cleanPath.startsWith('/api/hr/staff')) guessedType = 'Staff';
            else if (cleanPath.startsWith('/api/fee-management/extra-challan') || cleanPath.startsWith('/api/fee/challans/extra')) guessedType = 'ExtraChallan';
            else if (cleanPath.startsWith('/api/fee-management/challan') || cleanPath.startsWith('/api/fee/challans')) guessedType = 'FeeChallan';
            else if (cleanPath.startsWith('/api/finance/expense')) guessedType = 'FinanceExpense';
            else if (cleanPath.startsWith('/api/finance/income')) guessedType = 'FinanceIncome';
            else if (cleanPath.startsWith('/api/inventory')) guessedType = 'InventoryItem';
            else if (cleanPath.startsWith('/api/wallets')) guessedType = 'Wallet';

            if (guessedType) {
              targetEntity = resolveTargetFromDoc(respDoc, guessedType);
            }
          }
        }

        // Fallback targetEntity if still empty but req.body has identifier info
        if (!targetEntity) {
          const b = req.body || {};
          const candidateName =
            (b.fName ? `${b.fName} ${b.lName || ''}`.trim() : '') ||
            (b.firstName ? `${b.firstName} ${b.lastName || ''}`.trim() : '') ||
            b.name ||
            b.studentName ||
            b.title ||
            b.accountName ||
            '';
          if (candidateName) {
            const father = b.fatherOrguardian || b.fatherName || '';
            const roll = b.rollNumber || b.rollNo || '';
            const staffIdVal = b.staffId || '';
            const challanVal = b.challanNo || b.challanNumber || '';

            targetEntity = {
              entityType: subModule || module || 'Record',
              entityId: String(b.id || b._id || b.studentID || ''),
              name: candidateName,
              subTitle: father ? `Father: ${father}` : (b.designation ? `Designation: ${b.designation}` : (b.amount ? `PKR ${Number(b.amount).toLocaleString()}` : '')),
              identifier: roll ? `Roll: ${roll}` : (staffIdVal ? `Staff ID: ${staffIdVal}` : (challanVal ? `Challan: #${challanVal}` : '')),
            };
          }
        }

        // Calculate changes
        let changes = [];
        if (['PUT', 'PATCH'].includes(method) && req._beforeDoc) {
          const afterDoc = (responseData && typeof responseData === 'object')
            ? (responseData.data || responseData.student || responseData.staff || responseData.challan || responseData)
            : null;
          changes = calculateDiff(req._beforeDoc, afterDoc, req.body);
        } else if (method === 'DELETE') {
          changes = [{ field: 'record', fieldLabel: 'Record Status', oldValue: 'Active Record', newValue: 'Deleted' }];
        } else if (method === 'POST' && res.statusCode < 400 && !isAuth) {
          changes = [{ field: 'record', fieldLabel: 'Record Status', oldValue: 'None', newValue: 'Created' }];
        }

        // Enrich description if targetEntity is known
        if (targetEntity && targetEntity.name && !isFailed) {
          if (['PUT', 'PATCH'].includes(method)) {
            if (changes.length > 0) {
              const summaryFields = changes.map(c => c.fieldLabel).slice(0, 3).join(', ');
              const more = changes.length > 3 ? ` (+${changes.length - 3} more)` : '';
              description = `Updated ${targetEntity.entityType || 'record'}: ${targetEntity.name} ${targetEntity.identifier ? `(${targetEntity.identifier})` : ''} — modified ${summaryFields}${more}`;
            } else {
              description = `Updated ${targetEntity.entityType || 'record'}: ${targetEntity.name} ${targetEntity.identifier ? `(${targetEntity.identifier})` : ''}`;
            }
          } else if (method === 'POST') {
            description = `Created ${targetEntity.entityType || 'record'}: ${targetEntity.name} ${targetEntity.identifier ? `(${targetEntity.identifier})` : ''} ${targetEntity.subTitle ? `• ${targetEntity.subTitle}` : ''}`.trim();
          } else if (method === 'DELETE') {
            description = `Deleted ${targetEntity.entityType || 'record'}: ${targetEntity.name} ${targetEntity.identifier ? `(${targetEntity.identifier})` : ''}`.trim();
          }
        }

        // Determine status & failure reason
        const status = isFailed ? 'FAILED' : 'SUCCESS';
        let failureReason = '';

        if (isFailed) {
          if (res.locals?.errorMessage) {
            failureReason = res.locals.errorMessage;
          } else if (typeof responseData === 'object' && responseData !== null) {
            failureReason = responseData.message || responseData.error || (Array.isArray(responseData.errors) ? responseData.errors.join(', ') : null) || JSON.stringify(responseData);
          } else if (typeof responseData === 'string') {
            failureReason = responseData.slice(0, 300);
          } else {
            failureReason = `HTTP Error ${res.statusCode}`;
          }
        }

        // IP Address
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';

        // Save activity log
        await ActivityLog.create({
          userId: user?.id || user?._id || null,
          staffId: staffId || '',
          userName: userName || 'System User',
          userEmail: userEmail || '',
          userRole: userRole || 'STAFF',
          module,
          subModule,
          action,
          description: isFailed ? `FAILED: ${description}` : description,
          method,
          endpoint: url,
          status,
          statusCode: res.statusCode,
          failureReason: failureReason || '',
          ipAddress,
          userAgent,
          targetEntity: targetEntity || {
            entityType: '',
            entityId: '',
            name: '',
            subTitle: '',
            identifier: '',
          },
          changes: changes || [],
          params: sanitizeData({ query: req.query, params: req.params }),
          body: sanitizeData(req.body),
          timestamp: new Date()
        });
      } catch (logErr) {
        console.error('[ActivityLogger] Error logging activity:', logErr.message);
      }
    });
  });

  const proceed = () => {
    next();
  };

  if (isUpdateOrDelete) {
    preFetchBeforeDoc(req)
      .catch((err) => {
        // silent fail
      })
      .finally(() => {
        proceed();
      });
  } else {
    proceed();
  }
};

module.exports = activityLogger;
