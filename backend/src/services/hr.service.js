const {
  PayrollTemplate,
  Payroll,
  AdvanceSalary,
  PayrollSettings,
  Staff,
  Leave,
  Attendance,
  Wallet,
  WalletTransaction,
  User
} = require('../models');
const mongoose = require('mongoose');
const getDateRangeStrings = (startStr, endStr) => {
  const dates = [];
  if (!startStr) return dates;
  const sPart = String(startStr).split('T')[0];
  const ePart = String(endStr || startStr).split('T')[0];
  const [sY, sM, sD] = sPart.split('-').map(Number);
  const [eY, eM, eD] = ePart.split('-').map(Number);
  if (!sY || !sM || !sD) return dates;
  const cur = new Date(sY, sM - 1, sD, 12, 0, 0);
  const last = new Date(eY || sY, (eM || sM) - 1, eD || sD, 12, 0, 0);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

class HrService {
  // Settings
  async getPayrollSettings() {
    let settings = await PayrollSettings.findOne();
    if (!settings) settings = await PayrollSettings.create({});
    return settings;
  }

  async updatePayrollSettings(data) {
    let settings = await PayrollSettings.findOne();
    if (!settings) {
      settings = await PayrollSettings.create(data);
    } else {
      settings = await PayrollSettings.findByIdAndUpdate(settings._id, data, { new: true });
    }
    return settings;
  }

  // Templates
  async getTemplates() {
    return PayrollTemplate.find().populate('departmentId');
  }

  async createTemplate(data) {
    if (data.type) {
      const existing = await PayrollTemplate.findOne({ type: data.type });
      if (existing) {
        throw new Error(`A payroll template for type '${data.type}' already exists. Only one template per type is allowed.`);
      }
    }
    return PayrollTemplate.create({ ...data, title: data.name || data.title || data.type, isDefault: true });
  }

  async updateTemplate(id, data) {
    if (data.type) {
      const existing = await PayrollTemplate.findOne({ type: data.type, _id: { $ne: id } });
      if (existing) {
        throw new Error(`A payroll template for type '${data.type}' already exists. Only one template per type is allowed.`);
      }
    }
    return PayrollTemplate.findByIdAndUpdate(id, { ...data, title: data.name || data.title || data.type, isDefault: true }, { new: true });
  }

  async deleteTemplate(id) {
    return PayrollTemplate.findByIdAndDelete(id);
  }

  // Payroll Attendance Helper
  async calculateStaffMonthlyAttendanceDeductions(staff, month, defaultAbsentRate = 0) {
    if (!staff || !month) {
      return {
        absentCount: 0,
        absentRate: 0,
        absentDeduction: 0,
        leaveDeduction: 0,
        leaveBreakdown: { casual: 0, sick: 0, annual: 0, excessCasual: 0, excessSick: 0, excessAnnual: 0 }
      };
    }

    const staffId = staff._id || staff.id;
    const leaveRecords = await Attendance.find({
      staffId,
      date: { $regex: `^${month}` },
      status: { $regex: /^leave$/i }
    });

    let casualCount = 0;
    let sickCount = 0;
    let annualCount = 0;
    for (const rec of leaveRecords) {
      const lType = String(rec.leaveType || 'CASUAL').toUpperCase();
      if (lType === 'CASUAL' || lType === 'CL') casualCount++;
      else if (lType === 'SICK' || lType === 'SK') sickCount++;
      else if (lType === 'ANNUAL' || lType === 'AL') annualCount++;
      else casualCount++;
    }

    const settings = staff.leaveSettings || {};
    const casualAllowed = Number(settings.casualAllowed) || 0;
    const sickAllowed = Number(settings.sickAllowed) || 0;
    const annualAllowed = Number(settings.annualAllowed) || 0;

    const excessCasual = Math.max(0, casualCount - casualAllowed);
    const excessSick = Math.max(0, sickCount - sickAllowed);
    const excessAnnual = Math.max(0, annualCount - annualAllowed);

    const casualDeductionRate = Number(settings.casualDeduction) || 0;
    const sickDeductionRate = Number(settings.sickDeduction) || 0;
    const annualDeductionRate = Number(settings.annualDeduction) || 0;

    const leaveDeduction =
      (excessCasual * casualDeductionRate) +
      (excessSick * sickDeductionRate) +
      (excessAnnual * annualDeductionRate);

    // Absent rate: staff.absentDeduction > staff.leaveSettings.absentDeduction > Math.round(currentSalary / 30) > defaultAbsentRate
    const currentSalary = Number(staff.basicPay) || Number(staff.baseSalary) || 0;
    const staffAbsentRate = (staff.absentDeduction != null && Number(staff.absentDeduction) > 0)
      ? Number(staff.absentDeduction)
      : (settings.absentDeduction != null && Number(settings.absentDeduction) > 0)
        ? Number(settings.absentDeduction)
        : (currentSalary ? Math.round(Number(currentSalary) / 30) : defaultAbsentRate);

    const absentCount = await Attendance.countDocuments({
      staffId,
      date: { $regex: `^${month}` },
      status: { $regex: /^absent$/i }
    });
    const absentDeduction = absentCount * staffAbsentRate;

    return {
      absentCount,
      absentRate: staffAbsentRate,
      absentDeduction,
      leaveDeduction,
      leaveBreakdown: {
        casual: casualCount,
        sick: sickCount,
        annual: annualCount,
        excessCasual,
        excessSick,
        excessAnnual
      }
    };
  }

  // Payroll
  async getPayrollSheet(month, role = 'all') {
    const filter = {};
    if (month) filter.month = month;
    const records = await Payroll.find(filter)
      .populate({
        path: 'staffId',
        populate: { path: 'departmentId' }
      })
      .sort({ createdAt: -1 });

    const payrollSettings = await this.getPayrollSettings();
    const defaultAbsentRate = Number(payrollSettings?.absentDeductionAmount || payrollSettings?.defaultAbsentDeduction || 0);

    const filtered = records.filter(r => {
      if (role === 'teacher') return r.staffId?.isTeaching;
      if (role === 'employee') return r.staffId?.isNonTeaching || !r.staffId?.isTeaching;
      return true;
    });

    const result = await Promise.all(filtered.map(async r => {
      const s = r.staffId || {};
      const staffDoc = typeof s === 'object' ? s : {};
      const payrollId = r._id.toString();
      const staffId = staffDoc._id ? staffDoc._id.toString() : (r.staffId ? r.staffId.toString() : '');
      const deptName = staffDoc.departmentId?.name || staffDoc.empDepartment || staffDoc.department?.name || '';
      const roleLabel = staffDoc.isTeaching && staffDoc.isNonTeaching
        ? 'Dual'
        : staffDoc.isTeaching
        ? 'Teaching'
        : 'Non-Teaching';

      const payments = Array.isArray(r.payments) ? r.payments : [];
      const sumPayments = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const paidAmount = r.status === 'PAID'
        ? Math.max(Number(r.netSalary || 0), sumPayments || Number(r.paidAmount || 0))
        : (sumPayments || Number(r.paidAmount || 0));

      // Determine baseSalary and currentSalary from staffDoc or stored record
      const baseSalary = Number(staffDoc.baseSalary || r.baseSalary || staffDoc.basicPay || r.basicSalary || 0);
      const currentSalary = Number(staffDoc.basicPay || r.currentSalary || staffDoc.baseSalary || r.basicSalary || 0);

      let absentCount = Number(r.absentCount || 0);
      let absentRate = Number(r.absentRate || 0);
      let absentDeduction = Number(r.absentDeduction || 0);
      let leaveDeduction = Number(r.leaveDeduction || 0);
      let leaveBreakdown = r.leaveBreakdown || null;
      let totalDeductions = Number(r.totalDeductions || 0);
      let totalAllowances = Number(r.totalAllowances || 0);
      let netSalary = Number(r.netSalary || 0);

      // Auto-pick attendance deductions without requiring re-generate (if not locked as PAID)
      if (r.status !== 'PAID' && staffDoc._id && (month || r.month)) {
        const attMonth = month || r.month;
        const liveAtt = await this.calculateStaffMonthlyAttendanceDeductions(staffDoc, attMonth, defaultAbsentRate);

        absentCount = liveAtt.absentCount;
        absentRate = liveAtt.absentRate;
        absentDeduction = liveAtt.absentDeduction;
        leaveDeduction = liveAtt.leaveDeduction;
        leaveBreakdown = liveAtt.leaveBreakdown;

        // Recalculate deductions preserving other customized deductions
        const securityDeduction = Number(r.securityDeduction || 0);
        const advanceDeduction = Number(r.advanceDeduction || 0);
        const otherDeduction = Number(r.otherDeduction || 0);
        const incomeTax = Number(r.incomeTax || 0);
        const eobi = Number(r.eobi || 0);
        const lateArrivalDeduction = Number(r.lateArrivalDeduction || 0);

        totalDeductions =
          securityDeduction +
          advanceDeduction +
          absentDeduction +
          leaveDeduction +
          otherDeduction +
          incomeTax +
          eobi +
          lateArrivalDeduction;

        // Recalculate allowances preserving customized allowances
        totalAllowances =
          (Number(r.travelAllowance) || 0) +
          (Number(r.houseRentAllowance) || 0) +
          (Number(r.medicalAllowance) || 0) +
          (Number(r.extraAllowance) || 0) +
          (Number(r.insuranceAllowance) || 0) +
          (Number(r.otherAllowance) || 0);

        // Center of attraction: Current Salary!
        netSalary = Math.max(0, currentSalary + totalAllowances - totalDeductions);

        // Auto sync into DB document if changed
        if (
          r.absentDeduction !== absentDeduction ||
          r.leaveDeduction !== leaveDeduction ||
          r.currentSalary !== currentSalary ||
          r.baseSalary !== baseSalary ||
          r.netSalary !== netSalary
        ) {
          Payroll.findByIdAndUpdate(r._id, {
            $set: {
              baseSalary,
              currentSalary,
              basicSalary: baseSalary,
              absentCount,
              absentRate,
              absentDeduction,
              leaveDeduction,
              leaveBreakdown,
              totalDeductions,
              totalAllowances,
              netSalary,
              balanceAmount: Math.max(0, netSalary - paidAmount)
            }
          }).catch(err => console.error('Error auto-syncing payroll record:', err));
        }
      } else {
        // For already PAID records or fallback, ensure currentSalary and baseSalary are computed
        netSalary = Math.max(0, currentSalary + totalAllowances - totalDeductions);
      }

      const balanceAmount = r.status === 'PAID'
        ? 0
        : Math.max(0, netSalary - paidAmount);

      return {
        ...r.toObject(),
        id: staffId,
        payrollId,
        staffId: staffDoc,
        staffIdRaw: staffId,
        name: staffDoc.name || 'Unknown Staff',
        designation: staffDoc.designation || '',
        department: deptName,
        roleLabel,
        roleDepartmentLabel: deptName,
        baseSalary,
        currentSalary,
        basicSalary: baseSalary,
        absentCount,
        absentRate,
        absentDeduction,
        leaveDeduction,
        leaveBreakdown,
        totalDeductions,
        totalAllowances,
        netSalary,
        paidAmount,
        balanceAmount,
        status: r.status || 'PENDING',
        payments
      };
    }));

    return result;
  }

  async getMissingPayrollStaff(month, role = 'all') {
    const staffQuery = { status: 'ACTIVE' };
    if (role === 'teacher') staffQuery.isTeaching = true;
    if (role === 'employee') staffQuery.isNonTeaching = true;

    const allStaff = await Staff.find(staffQuery).populate('departmentId');
    const existing = await Payroll.find({ month }).select('staffId');
    const existingIds = new Set(existing.map(p => p.staffId?.toString()));

    return allStaff.filter(s => !existingIds.has(s._id.toString()));
  }

  async getPayrollHistory(staffId) {
    const filter = {};
    if (staffId && mongoose.Types.ObjectId.isValid(staffId)) filter.staffId = staffId;
    return Payroll.find(filter).populate('staffId').sort({ month: -1 });
  }

  async generatePayroll({ month, type, staffIds }) {
    const staffQuery = {};
    if (staffIds && Array.isArray(staffIds) && staffIds.length > 0) {
      staffQuery._id = { $in: staffIds.filter(id => mongoose.Types.ObjectId.isValid(id)) };
    } else {
      staffQuery.status = 'ACTIVE';
      if (type === 'teacher') {
        staffQuery.isTeaching = true;
      } else if (type === 'employee') {
        staffQuery.isNonTeaching = true;
      }
    }

    const staffMembers = await Staff.find(staffQuery);
    const payrollSettings = await this.getPayrollSettings();
    const absentRate = Number(payrollSettings?.absentDeductionAmount || payrollSettings?.defaultAbsentDeduction || 0);

    const generated = [];
    let generatedCount = 0;
    let regeneratedCount = 0;
    let skippedLockedCount = 0;

    for (const staff of staffMembers) {
      const existing = await Payroll.findOne({ staffId: staff._id, month });
      if (existing) {
        if (existing.status === 'PAID') {
          skippedLockedCount++;
          generated.push(existing);
          continue;
        }
        regeneratedCount++;
      } else {
        generatedCount++;
      }

      // Calculate advance salary deductions
      const advances = await AdvanceSalary.find({
        staffId: staff._id,
        deductionMonth: month,
        status: { $in: ['APPROVED', 'PENDING'] },
        adjusted: { $ne: true }
      });
      const advanceDeduction = advances.reduce((sum, a) => sum + (a.amount || 0), 0);

      const baseSalary = Number(staff.baseSalary || staff.basicPay || 0);
      const currentSalary = Number(staff.basicPay || staff.baseSalary || 0);

      // Calculate attendance deductions using reusable helper
      const liveAtt = await this.calculateStaffMonthlyAttendanceDeductions(staff, month, absentRate);
      const absentCount = liveAtt.absentCount;
      const staffAbsentRate = liveAtt.absentRate;
      const absentDeduction = liveAtt.absentDeduction;
      const leaveDeduction = liveAtt.leaveDeduction;

      const totalAllowances = existing ? (Number(existing.totalAllowances) || 0) : 0;
      const totalDeductions = advanceDeduction + leaveDeduction + absentDeduction +
        (existing ? (Number(existing.securityDeduction) || 0) +
                    (Number(existing.otherDeduction) || 0) +
                    (Number(existing.incomeTax) || 0) +
                    (Number(existing.eobi) || 0) +
                    (Number(existing.lateArrivalDeduction) || 0) : 0);

      // Center of attraction: Current Salary!
      const netSalary = Math.max(0, currentSalary + totalAllowances - totalDeductions);

      const existingPaid = Number(existing?.paidAmount || 0);
      const balanceAmount = existing?.status === 'PAID' ? 0 : Math.max(0, netSalary - existingPaid);

      const recordData = {
        staffId: staff._id,
        month,
        baseSalary,
        currentSalary,
        basicSalary: baseSalary,
        totalAllowances,
        totalDeductions,
        advanceDeduction,
        leaveDeduction,
        leaveBreakdown: liveAtt.leaveBreakdown,
        absentDeduction,
        absentCount,
        absentRate: staffAbsentRate,
        netSalary,
        paidAmount: existingPaid,
        balanceAmount,
        status: existing ? existing.status : 'PENDING'
      };

      const record = existing
        ? await Payroll.findByIdAndUpdate(existing._id, { $set: recordData }, { new: true })
        : await Payroll.create(recordData);

      generated.push(record);
    }

    return {
      generated,
      generatedCount,
      regeneratedCount,
      skippedLockedCount,
      count: generated.length
    };
  }

  async upsertPayroll(data) {
    const { id, staffId, month, ...rest } = data;
    let baseSalary = Number(rest.baseSalary || rest.basicSalary) || 0;
    let currentSalary = Number(rest.currentSalary || rest.basicSalary) || baseSalary;
    let basicSalary = baseSalary;
    
    // Sum allowances
    const totalAllowances =
      (Number(rest.travelAllowance) || 0) +
      (Number(rest.houseRentAllowance) || 0) +
      (Number(rest.medicalAllowance) || 0) +
      (Number(rest.extraAllowance) || 0) +
      (Number(rest.insuranceAllowance) || 0) +
      (Number(rest.otherAllowance) || 0);

    // Sum deductions
    const totalDeductions =
      (Number(rest.advanceDeduction) || 0) +
      (Number(rest.leaveDeduction) || 0) +
      (Number(rest.absentDeduction) || 0) +
      (Number(rest.securityDeduction) || 0) +
      (Number(rest.incomeTax) || 0) +
      (Number(rest.eobi) || 0) +
      (Number(rest.lateArrivalDeduction) || 0) +
      (Number(rest.otherDeduction) || 0);

    // Center of attraction: Current Salary!
    const netSalary = Math.max(0, currentSalary + totalAllowances - totalDeductions);

    const payload = {
      ...rest,
      baseSalary,
      currentSalary,
      basicSalary,
      totalAllowances,
      totalDeductions,
      netSalary
    };

    let existingRecord = null;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      existingRecord = await Payroll.findById(id);
    } else if (staffId && month) {
      existingRecord = await Payroll.findOne({ staffId, month });
    }

    if (existingRecord) {
      const existingPaid = Number(existingRecord.paidAmount || (Array.isArray(existingRecord.payments) ? existingRecord.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) : 0));
      payload.paidAmount = existingPaid;
      payload.balanceAmount = existingRecord.status === 'PAID' ? 0 : Math.max(0, netSalary - existingPaid);
      return Payroll.findByIdAndUpdate(existingRecord._id, { $set: payload }, { new: true });
    }

    payload.balanceAmount = netSalary;
    payload.paidAmount = 0;
    return Payroll.create(payload);
  }

  async recordPayment(payrollId, { paidBy, paymentMethod, paymentDate, amount, remarks, transactionId, chequeNumber, walletId }, user) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll) throw new Error('Payroll record not found');

    const paymentAmount = Number(amount) || 0;
    if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');

    let wallet = null;
    if (walletId && mongoose.Types.ObjectId.isValid(walletId)) {
      wallet = await Wallet.findById(walletId);
      if (wallet) {
        // Deduct from wallet (can be negative)
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) - paymentAmount;
        await wallet.save();

        const staff = await Staff.findById(payroll.staffId).select('name designation');
        const staffName = staff?.name || 'Staff Member';
        const staffDesig = staff?.designation || '';

        await WalletTransaction.create({
          transactionType: 'PAYROLL',
          category: 'PAYROLL',
          sourceWallet: wallet._id,
          amount: paymentAmount,
          date: paymentDate || new Date().toISOString().split('T')[0],
          payrollMonth: payroll.month,
          staffCount: 1,
          staffDetails: [{
            payrollId: payroll._id.toString(),
            staffId: payroll.staffId.toString(),
            name: staffName,
            designation: staffDesig,
            amount: paymentAmount,
          }],
          payrollIds: [payroll._id],
          referenceNo: transactionId || chequeNumber || '',
          description: remarks || `Payroll disbursement for ${payroll.month} (${staffName}) from ${wallet.name}`,
          performedBy: user?._id || user?.id || null,
          performedByName: user ? `${user.name} (${user.role})` : 'Admin',
          balanceAfterSource: wallet.currentBalance,
        });
      }
    }

    const existingPayments = Array.isArray(payroll.payments) ? payroll.payments : [];
    const currentPaid = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const newPaidTotal = currentPaid + paymentAmount;
    const netSalary = Number(payroll.netSalary) || 0;
    const newBalance = Math.max(0, netSalary - newPaidTotal);
    const newStatus = newBalance <= 0 ? 'PAID' : 'partially_paid';

    const newPaymentEntry = {
      id: new mongoose.Types.ObjectId(),
      amount: paymentAmount,
      paidBy: wallet ? wallet.name : (paidBy || paymentMethod || 'Cash'),
      paymentMethod: wallet ? (wallet.type || 'WALLET') : (paymentMethod || paidBy || 'Cash'),
      walletId: wallet ? wallet._id : null,
      walletName: wallet ? wallet.name : '',
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      paidAt: new Date(),
      paidByName: user?.name || 'Admin',
      remarks: remarks || '',
      transactionId: transactionId || '',
      chequeNumber: chequeNumber || ''
    };

    payroll.payments = [...existingPayments, newPaymentEntry];
    payroll.paidAmount = newPaidTotal;
    payroll.balanceAmount = newBalance;
    payroll.status = newStatus;
    payroll.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
    payroll.paidBy = wallet ? wallet.name : (paymentMethod || paidBy || 'Cash');
    if (wallet) {
      payroll.paidFromWallet = {
        walletId: wallet._id,
        walletName: wallet.name,
        walletType: wallet.type,
      };
    }
    if (remarks) payroll.remarks = remarks;

    await payroll.save();

    if (newStatus === 'PAID' && payroll.staffId && payroll.month) {
      await AdvanceSalary.updateMany(
        {
          staffId: payroll.staffId,
          deductionMonth: payroll.month,
          status: { $ne: 'DEDUCTED' }
        },
        {
          $set: {
            status: 'DEDUCTED',
            adjusted: true,
            adjustedSource: 'PAYROLL'
          },
          $push: {
            actionAudit: {
              action: 'ADJUSTED_IN_PAYROLL',
              byName: user?.name || 'Payroll System',
              month: payroll.month,
              at: new Date()
            }
          }
        }
      );
    }

    return payroll;
  }

  // Advance Salary
  async getAdvances(filters = {}) {
    const query = {};
    if (filters.staffId && mongoose.Types.ObjectId.isValid(filters.staffId)) {
      query.staffId = filters.staffId;
    }
    if (filters.month) query.deductionMonth = filters.month;
    
    let advances = await AdvanceSalary.find(query)
      .populate({
        path: 'staffId',
        populate: { path: 'departmentId' }
      })
      .sort({ createdAt: -1 });

    const role = filters.role || filters.type;
    if (role === 'teacher' || role === 'Teaching') {
      advances = advances.filter(a => a.staffId?.isTeaching);
    } else if (role === 'employee' || role === 'Non-Teaching') {
      advances = advances.filter(a => a.staffId?.isNonTeaching || !a.staffId?.isTeaching);
    }

    return advances.map(a => {
      const base = a.toObject ? a.toObject() : a;
      const s = a.staffId;
      return {
        ...base,
        id: a._id.toString(),
        staffId: s ? (s._id ? s._id.toString() : s) : a.staffId,
        staff: s && typeof s === 'object' ? {
          id: s._id ? s._id.toString() : s.id,
          name: s.name || '',
          employeeId: s.employeeId || '',
          isTeaching: !!s.isTeaching,
          isNonTeaching: !!s.isNonTeaching,
          specialization: s.specialization || '',
          designation: s.designation || 'Staff',
          department: s.departmentId?.name || s.empDepartment || ''
        } : null,
        staffName: s?.name || 'Unknown',
        name: s?.name || 'Unknown',
        month: a.deductionMonth,
        releaseDate: a.releaseDate || a.requestDate || '',
        department: s?.departmentId?.name || s?.empDepartment || '',
        adjusted: a.status === 'DEDUCTED' || a.status === 'ADJUSTED' || a.adjusted === true
      };
    });
  }

  async syncPayrollAdvanceDeduction(staffId, month) {
    if (!staffId || !month) return;
    const existing = await Payroll.findOne({ staffId, month, status: { $ne: 'PAID' } });
    if (!existing) return;

    const advances = await AdvanceSalary.find({
      staffId,
      deductionMonth: month,
      status: { $in: ['APPROVED', 'PENDING'] },
      adjusted: { $ne: true }
    });
    const advanceDeduction = advances.reduce((sum, a) => sum + (a.amount || 0), 0);

    const basicSalary = Number(existing.basicSalary) || 0;
    const totalAllowances = Number(existing.totalAllowances) || 0;
    const totalDeductions = advanceDeduction +
      (Number(existing.leaveDeduction) || 0) +
      (Number(existing.absentDeduction) || 0) +
      (Number(existing.securityDeduction) || 0) +
      (Number(existing.otherDeduction) || 0) +
      (Number(existing.incomeTax) || 0) +
      (Number(existing.eobi) || 0) +
      (Number(existing.lateArrivalDeduction) || 0);

    const netSalary = Math.max(0, basicSalary + totalAllowances - totalDeductions);
    const existingPaid = Number(existing.paidAmount || 0);
    const balanceAmount = Math.max(0, netSalary - existingPaid);

    await Payroll.findByIdAndUpdate(existing._id, {
      $set: {
        advanceDeduction,
        totalDeductions,
        netSalary,
        balanceAmount
      }
    });
  }

  async createAdvance(data) {
    const isAdjusted = data.adjusted === true || data.status === 'DEDUCTED';
    const releaseDate = data.releaseDate || data.requestDate || new Date().toISOString().split('T')[0];
    const deductionMonth = data.month || data.deductionMonth;

    // Validation: if payroll for this staff and month is already PAID, disallow advance salary
    if (data.staffId && deductionMonth) {
      const existingPayroll = await Payroll.findOne({
        staffId: data.staffId,
        month: deductionMonth
      });
      if (existingPayroll && existingPayroll.status === 'PAID') {
        const err = new Error(`Cannot issue advance salary for ${deductionMonth}: payroll for this month has already been marked as PAID.`);
        err.statusCode = 400;
        throw err;
      }
    }

    const payload = {
      staffId: data.staffId,
      amount: Number(data.amount) || 0,
      deductionMonth,
      requestDate: data.requestDate || releaseDate,
      releaseDate,
      reason: data.remarks || data.reason || '',
      status: isAdjusted ? 'DEDUCTED' : (data.status || 'PENDING'),
      adjusted: isAdjusted,
      adjustedSource: isAdjusted ? 'MANUAL' : '',
      actionAudit: [{
        action: isAdjusted ? 'CREATED_AS_ADJUSTED' : 'CREATED',
        byName: 'Admin',
        month: deductionMonth,
        at: new Date()
      }]
    };
    const created = await AdvanceSalary.create(payload);
    await this.syncPayrollAdvanceDeduction(data.staffId, deductionMonth);
    return created;
  }

  async updateAdvance(id, data) {
    const targetMonth = data.month || data.deductionMonth;
    const currentAdvance = await AdvanceSalary.findById(id);
    const targetStaffId = data.staffId || currentAdvance?.staffId;
    const checkMonth = targetMonth || currentAdvance?.deductionMonth;

    // Validation: if payroll for this staff and month is already PAID, disallow updating advance salary
    if (targetStaffId && checkMonth) {
      const existingPayroll = await Payroll.findOne({
        staffId: targetStaffId,
        month: checkMonth
      });
      if (existingPayroll && existingPayroll.status === 'PAID') {
        const err = new Error(`Cannot update advance salary for ${checkMonth}: payroll for this month has already been marked as PAID.`);
        err.statusCode = 400;
        throw err;
      }
    }

    const update = {};
    if (data.amount !== undefined) update.amount = Number(data.amount) || 0;
    if (data.month || data.deductionMonth) update.deductionMonth = data.month || data.deductionMonth;
    if (data.remarks || data.reason) update.reason = data.remarks || data.reason;
    if (data.releaseDate !== undefined) update.releaseDate = data.releaseDate;
    if (data.status) update.status = data.status;
    if (data.adjusted !== undefined) {
      update.adjusted = !!data.adjusted;
      if (data.adjusted) {
        update.status = 'DEDUCTED';
        update.adjustedSource = 'MANUAL';
      } else {
        update.status = 'PENDING';
        update.adjustedSource = '';
      }
    }

    const updated = await AdvanceSalary.findByIdAndUpdate(
      id,
      {
        $set: update,
        $push: {
          actionAudit: {
            action: update.adjusted ? 'MANUALLY_ADJUSTED' : 'UPDATED',
            byName: 'Admin',
            month: update.deductionMonth,
            at: new Date()
          }
        }
      },
      { new: true }
    );

    if (updated) {
      await this.syncPayrollAdvanceDeduction(updated.staffId, updated.deductionMonth);
    }
    return updated;
  }

  async deleteAdvance(id) {
    const existing = await AdvanceSalary.findById(id);
    const result = await AdvanceSalary.findByIdAndDelete(id);
    if (existing) {
      await this.syncPayrollAdvanceDeduction(existing.staffId, existing.deductionMonth);
    }
    return result;
  }

  // --- Staff Leaves Management ---
  async getLeaveSheet(month, role = 'all') {
    const query = { applicantType: 'STAFF' };
    if (month && month !== 'all' && month !== 'ALL') {
      const parts = month.split('-');
      if (parts.length >= 2) {
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const startOfMonth = `${month}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;
        query.$or = [
          { month },
          { fromDate: { $lte: endOfMonth }, toDate: { $gte: startOfMonth } },
          { fromDate: { $regex: `^${month}` } },
          { toDate: { $regex: `^${month}` } }
        ];
      } else {
        query.$or = [
          { month },
          { fromDate: { $regex: `^${month}` } },
          { toDate: { $regex: `^${month}` } }
        ];
      }
    }

    const leaves = await Leave.find(query)
      .populate({
        path: 'staffId',
        populate: { path: 'departmentId' }
      })
      .sort({ createdAt: -1 });

    const formatted = await Promise.all(leaves.map(async (l) => {
      let s = l.staffId;
      let rawStaffId = s?._id ? s._id.toString() : (l._doc?.staffId ? l._doc.staffId.toString() : (l.staffId ? l.staffId.toString() : ''));

      // If staff not populated (e.g. staffId was saved as User id or string)
      if (!s || !s.name) {
        if (rawStaffId && mongoose.Types.ObjectId.isValid(rawStaffId)) {
          let staffDoc = await Staff.findById(rawStaffId).populate('departmentId').lean();
          if (!staffDoc) {
            const userDoc = await User.findById(rawStaffId).lean();
            if (userDoc) {
              if (userDoc.refId) {
                staffDoc = await Staff.findById(userDoc.refId).populate('departmentId').lean();
              }
              if (!staffDoc && userDoc.email) {
                staffDoc = await Staff.findOne({ email: userDoc.email }).populate('departmentId').lean();
              }
              if (!staffDoc) {
                const isTeacher = userDoc.role === 'TEACHER' || userDoc.role === 'Teacher';
                s = {
                  _id: userDoc._id,
                  name: userDoc.name || 'Staff Member',
                  isTeaching: isTeacher,
                  isNonTeaching: !isTeacher,
                  departmentId: null
                };
              }
            }
          }
          if (staffDoc) {
            s = staffDoc;
            // Auto-heal in background
            Leave.updateOne({ _id: l._id }, { $set: { staffId: staffDoc._id } }).catch(() => {});
          }
        }
      }

      const isTeaching = !!s?.isTeaching;
      const isNonTeaching = !!s?.isNonTeaching;

      return {
        id: l._id.toString(),
        leaveId: l._id.toString(),
        staffId: s?._id?.toString() || rawStaffId,
        name: s?.name || 'Staff Member',
        isTeaching,
        isNonTeaching,
        department: s?.departmentId ? { name: s.departmentId.name } : (s?.empDepartment || null),
        leaveType: l.leaveType || 'CASUAL',
        startDate: l.fromDate,
        endDate: l.toDate,
        days: l.days || 1,
        reason: l.reason || '',
        status: l.status || 'PENDING',
        locked: !!l.locked,
        actionAudit: l.actionAudit || []
      };
    }));

    if (role === 'teacher') {
      return formatted.filter(r => r.isTeaching);
    }
    if (role === 'employee') {
      return formatted.filter(r => r.isNonTeaching || !r.isTeaching);
    }
    return formatted;
  }

  async upsertLeave(data, user) {
    let { leaveId, staffId, startDate, endDate, days, month, reason, status, leaveType } = data;
    const normStatus = status || 'PENDING';

    // Resolve staffId if it points to a User or if missing
    if (staffId && mongoose.Types.ObjectId.isValid(staffId)) {
      const staffDoc = await Staff.findById(staffId);
      if (!staffDoc) {
        const userDoc = await User.findById(staffId);
        if (userDoc) {
          if (userDoc.refId) {
            staffId = userDoc.refId;
          } else if (userDoc.email) {
            const matchStaff = await Staff.findOne({ email: userDoc.email });
            if (matchStaff) staffId = matchStaff._id;
          }
        }
      }
    } else if (!staffId && user) {
      if (user.refId) {
        staffId = user.refId;
      } else if (user.email) {
        const matchStaff = await Staff.findOne({ email: user.email });
        if (matchStaff) staffId = matchStaff._id;
        else staffId = user._id || user.id;
      }
    }

    const payload = {
      applicantType: 'STAFF',
      staffId,
      fromDate: startDate,
      toDate: endDate,
      days: Number(days) || 1,
      month: month || (startDate ? startDate.slice(0, 7) : undefined),
      reason: reason || '',
      status: normStatus,
      leaveType: leaveType || 'CASUAL'
    };

    let leaveRecord;
    let oldDates = [];
    let oldStaffId = null;

    if (leaveId && mongoose.Types.ObjectId.isValid(leaveId)) {
      const existing = await Leave.findById(leaveId);
      if (existing) {
        oldStaffId = existing.staffId;
        oldDates = getDateRangeStrings(existing.fromDate, existing.toDate);
      }
      leaveRecord = await Leave.findByIdAndUpdate(
        leaveId,
        {
          ...payload,
          $push: {
            actionAudit: {
              action: 'UPDATED',
              byName: user?.name || 'HR Admin',
              at: new Date()
            }
          }
        },
        { new: true }
      );
    } else {
      payload.actionAudit = [{
        action: 'CREATED',
        byName: user?.name || 'HR Admin',
        at: new Date()
      }];
      leaveRecord = await Leave.create(payload);
    }

    // Clean up old attendance records if previously approved or changing dates/status
    if (oldDates.length > 0 && oldStaffId) {
      await Attendance.deleteMany({
        staffId: oldStaffId,
        date: { $in: oldDates },
        status: 'LEAVE'
      });
    }

    // Sync approved leave to staff attendance
    if (String(normStatus).toUpperCase() === 'APPROVED' && staffId) {
      try {
        const newDates = getDateRangeStrings(startDate, endDate);
        for (const dStr of newDates) {
          await Attendance.findOneAndUpdate(
            { staffId, date: dStr, role: 'STAFF' },
            {
              staffId,
              date: dStr,
              role: 'STAFF',
              status: 'LEAVE',
              leaveType: leaveType || 'CASUAL',
              notes: reason || 'Approved Staff Leave',
              markedAt: new Date()
            },
            { upsert: true, new: true }
          );
        }
      } catch (err) {
        console.error('Failed to sync staff leave to attendance:', err);
      }
    }

    return leaveRecord;
  }

  async deleteStaffLeave(id) {
    const leave = await Leave.findById(id);
    if (leave && leave.staffId) {
      const dates = getDateRangeStrings(leave.fromDate, leave.toDate);
      if (dates.length > 0) {
        await Attendance.deleteMany({
          staffId: leave.staffId,
          date: { $in: dates },
          status: 'LEAVE'
        });
      }
    }
    return Leave.findByIdAndDelete(id);
  }

  async updateStaffLeaveStatus(id, status, user) {
    const leave = await Leave.findById(id);
    if (!leave) throw new Error('Leave record not found');

    if (user && user.role !== 'SUPER_ADMIN' && user.role !== 'Super Admin') {
      const dbUser = await User.findById(user.id || user._id);
      let staffMember = null;
      if (dbUser?.refId) staffMember = await Staff.findById(dbUser.refId);
      if (!staffMember && dbUser?.email) {
        staffMember = await Staff.findOne({ $or: [{ email: dbUser.email }, { staffId: dbUser.email }] });
      }
      const permissions = staffMember?.permissions || dbUser?.permissions;
      const actions = permissions?.actions || permissions?.crud;
      const hrLeaves = actions?.['HR & Payroll']?.leaves || actions?.['hr-payroll']?.leaves || actions?.hrPayroll?.leaves;
      const canApprove = permissions?.all === true || Boolean(hrLeaves?.approvals || hrLeaves?.approve);
      if (!canApprove) {
        const err = new Error('You do not have permission to approve or reject leaves');
        err.status = 403;
        throw err;
      }
    }

    leave.status = status;
    leave.actionAudit.push({
      action: `STATUS_${status}`,
      byName: user?.name || 'HR Admin',
      at: new Date()
    });
    await leave.save();

    const dates = getDateRangeStrings(leave.fromDate, leave.toDate);

    if (String(status).toUpperCase() === 'APPROVED' && leave.staffId) {
      try {
        for (const dStr of dates) {
          await Attendance.findOneAndUpdate(
            { staffId: leave.staffId, date: dStr, role: 'STAFF' },
            {
              staffId: leave.staffId,
              date: dStr,
              role: 'STAFF',
              status: 'LEAVE',
              leaveType: leave.leaveType || 'CASUAL',
              notes: leave.reason || 'Approved Staff Leave',
              markedAt: new Date()
            },
            { upsert: true, new: true }
          );
        }
      } catch (err) {
        console.error('Failed to sync staff leave status to attendance:', err);
      }
    } else if (String(status).toUpperCase() !== 'APPROVED' && leave.staffId) {
      try {
        await Attendance.deleteMany({
          staffId: leave.staffId,
          date: { $in: dates },
          status: 'LEAVE'
        });
      } catch (err) {
        console.error('Failed to remove unapproved staff leave from attendance:', err);
      }
    }

    return leave;
  }

  async toggleLockStaffLeave(id, locked, user) {
    return Leave.findByIdAndUpdate(
      id,
      {
        locked: !!locked,
        $push: {
          actionAudit: {
            action: locked ? 'LOCKED' : 'UNLOCKED',
            byName: user?.name || 'HR Admin',
            at: new Date()
          }
        }
      },
      { new: true }
    );
  }

  // Analytics
  async getAnalytics(month) {
    const records = await Payroll.find(month ? { month } : {});
    const totalBasic = records.reduce((s, r) => s + (r.basicSalary || 0), 0);
    const totalPaid = records.filter(r => r.status === 'PAID').reduce((s, r) => s + (r.netSalary || 0), 0);
    const totalUnpaid = records.filter(r => r.status !== 'PAID').reduce((s, r) => s + (r.netSalary || 0), 0);

    return { totalBasic, totalPaid, totalUnpaid, count: records.length };
  }
}

module.exports = new HrService();
