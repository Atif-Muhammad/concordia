const mongoose = require('mongoose');
const {
  Student,
  Staff,
  FeeChallan,
  ExtraChallan,
  HostelChallan,
  Attendance,
  Leave,
  FrontOfficeInquiry,
  FrontOfficeComplaint,
  FrontOfficeVisitor,
  FrontOfficeContact,
  Program,
  Class,
  Section,
  Subject,
  Exam,
  HostelRoom,
  HostelRegistration,
  HostelExpense,
  InventoryItem,
  AdvanceSalary,
  FinanceIncome,
  FinanceExpense,
  Wallet,
} = require('../models');

class DashboardService {
  _buildSessionFilters(sessionId) {
    const sessionMatch = {};
    const studentSessionMatch = {};
    if (sessionId && sessionId !== 'all') {
      try {
        const sId = new mongoose.Types.ObjectId(sessionId);
        sessionMatch.sessionId = sId;
        studentSessionMatch.$or = [
          { sessionId: sId },
          { 'academicRecords.sessionId': sId },
          { 'installments.sessionId': sId }
        ];
      } catch (e) {
        // Ignore invalid ObjectId
      }
    }
    return { sessionMatch, studentSessionMatch };
  }

  /**
   * 1. Student Statistics
   */
  async getStudentsStats(sessionId) {
    const { studentSessionMatch } = this._buildSessionFilters(sessionId);

    const [totalStudents, activeStudents, expelledStudents, passedOutStudents, studentsWithProg] = await Promise.all([
      Student.countDocuments(studentSessionMatch).catch(() => 0),
      Student.countDocuments({ ...studentSessionMatch, status: { $regex: /^active$/i } }).catch(() => 0),
      Student.countDocuments({ ...studentSessionMatch, status: { $regex: /^expelled$/i } }).catch(() => 0),
      Student.countDocuments({ ...studentSessionMatch, status: { $regex: /^passed|^graduated/i } }).catch(() => 0),
      Student.find(studentSessionMatch).select('programId status').populate('programId', 'name level').lean().catch(() => []),
    ]);

    const byProgram = { intermediate: 0, diploma: 0, bs: 0, shortCourse: 0, coaching: 0 };
    const programCountMap = {};

    for (const s of studentsWithProg) {
      const p = s.programId;
      const pName = p?.name || 'General';
      programCountMap[pName] = (programCountMap[pName] || 0) + 1;

      const level = (p?.level || '').toUpperCase();
      const name = (p?.name || '').toLowerCase();

      if (level === 'INTERMEDIATE' || name.includes('fsc') || name.includes('fa') || name.includes('ics') || name.includes('inter')) {
        byProgram.intermediate++;
      } else if (level === 'DIPLOMA' || name.includes('diploma') || name.includes('dit')) {
        byProgram.diploma++;
      } else if (level === 'UNDERGRADUATE' || name.includes('bs') || name.includes('bachelor')) {
        byProgram.bs++;
      } else if (level === 'SHORT_COURSE' || name.includes('short')) {
        byProgram.shortCourse++;
      } else if (level === 'COACHING' || name.includes('coach')) {
        byProgram.coaching++;
      } else {
        byProgram.intermediate++;
      }
    }

    const programDistribution = Object.entries(programCountMap).map(([name, value]) => ({
      name,
      value
    }));

    return {
      totalStudents,
      activeStudents,
      expelledStudents,
      passedOutStudents,
      total: totalStudents,
      active: activeStudents,
      byStatus: {
        active: activeStudents,
        expelled: expelledStudents,
        passedOut: passedOutStudents
      },
      byProgram,
      programDistribution
    };
  }

  /**
   * 2. Fee Statistics
   */
  async getFeesStats(sessionId) {
    const { sessionMatch, studentSessionMatch } = this._buildSessionFilters(sessionId);

    let sessionStudentIds = [];
    if (sessionId && sessionId !== 'all') {
      sessionStudentIds = await Student.find(studentSessionMatch).distinct('_id').catch(() => []);
    }

    const extraFilter = (sessionId && sessionId !== 'all') ? {
      $or: [
        { sessionId: sessionMatch.sessionId },
        { studentId: { $in: sessionStudentIds } }
      ]
    } : {};

    const [challans, extraChallans, hostelChallans] = await Promise.all([
      FeeChallan.find(sessionMatch).lean().catch(() => []),
      ExtraChallan.find(extraFilter).lean().catch(() => []),
      HostelChallan.find(sessionMatch).lean().catch(() => []),
    ]);

    let regularCollected = 0;
    let regularPending = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    for (const c of challans) {
      const isPaid = ['PAID', 'SETTLED'].includes(c.status);
      const isOverdue = c.status === 'OVERDUE';
      if (isPaid) paidCount++;
      else if (isOverdue) overdueCount++;
      else pendingCount++;

      const paid = Number(c.paidAmount || 0);
      const total = Number(c.totalAmount || c.netPayable || c.amount || 0);
      regularCollected += paid;
      if (!isPaid && c.status !== 'VOID' && c.status !== 'SUPERSEDED') {
        regularPending += Math.max(0, total - paid);
      }
    }

    let extraCollected = 0;
    let extraPending = 0;
    for (const ec of extraChallans) {
      const isPaid = ec.status === 'PAID';
      const isOverdue = ec.status === 'OVERDUE';
      if (isPaid) paidCount++;
      else if (isOverdue) overdueCount++;
      else pendingCount++;

      const paid = Number(ec.paidAmount || 0);
      const total = Number(ec.totalAmount || ec.amount || 0);
      extraCollected += paid;
      if (!isPaid && ec.status !== 'VOID') {
        extraPending += Math.max(0, total - paid);
      }
    }

    let hostelCollected = 0;
    let hostelPending = 0;
    for (const hc of hostelChallans) {
      const isPaid = ['PAID', 'SETTLED'].includes(hc.status);
      const isOverdue = hc.status === 'OVERDUE';
      if (isPaid) paidCount++;
      else if (isOverdue) overdueCount++;
      else pendingCount++;

      const paid = Number(hc.paidAmount || 0);
      const total = Number(hc.totalAmount || hc.amount || hc.hostelFee || 0);
      hostelCollected += paid;
      if (!isPaid && hc.status !== 'VOID' && hc.status !== 'SUPERSEDED') {
        hostelPending += Math.max(0, total - paid);
      }
    }

    const totalFeeCollected = regularCollected + extraCollected + hostelCollected;
    const pendingAmount = regularPending + extraPending + hostelPending;

    return {
      totalFeeCollected,
      pendingAmount,
      totalChallans: challans.length,
      paidChallans: paidCount,
      pendingChallans: pendingCount,
      overdueChallans: overdueCount,
      extraChallans: extraChallans.length,
      regularRevenue: regularCollected,
      hostelRevenue: hostelCollected,
      extraRevenue: extraCollected,
      installmentPendingAmount: regularPending,
      hostelPendingAmount: hostelPending,
      extraPendingAmount: extraPending,
      breakdown: {
        installment: {
          collected: regularCollected,
          outstanding: regularPending
        },
        hostel: {
          collected: hostelCollected,
          outstanding: hostelPending
        },
        extraChallans: {
          collected: extraCollected,
          outstanding: extraPending
        }
      },
      byStatus: {
        paid: paidCount,
        pending: pendingCount,
        overdue: overdueCount
      }
    };
  }

  /**
   * 3. Attendance Statistics
   */
  async getAttendanceStats(sessionId) {
    const { studentSessionMatch } = this._buildSessionFilters(sessionId);

    let attnFilter = {};
    if (sessionId && sessionId !== 'all') {
      const studentIds = await Student.find(studentSessionMatch).distinct('_id').catch(() => []);
      attnFilter = {
        $or: [
          { studentId: { $in: studentIds } },
          { studentId: { $exists: false } },
          { studentId: null }
        ]
      };
    }

    const allAttn = await Attendance.find(attnFilter).lean().catch(() => []);
    const today = new Date().toISOString().split('T')[0];

    const todayRecords = allAttn.filter(a => a.date === today);
    const todayPresent = todayRecords.filter(a => ['PRESENT', 'present', 'Present'].includes(a.status)).length;
    const todayAbsent = todayRecords.filter(a => ['ABSENT', 'absent', 'Absent'].includes(a.status)).length;
    const todayLeave = todayRecords.filter(a => ['LEAVE', 'leave', 'Leave', 'HALF_DAY'].includes(a.status)).length;
    const todayTotal = todayPresent + todayAbsent + todayLeave;
    const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

    const sessionPresent = allAttn.filter(a => ['PRESENT', 'present', 'Present'].includes(a.status)).length;
    const sessionAbsent = allAttn.filter(a => ['ABSENT', 'absent', 'Absent'].includes(a.status)).length;
    const sessionLeave = allAttn.filter(a => ['LEAVE', 'leave', 'Leave', 'HALF_DAY'].includes(a.status)).length;
    const sessionTotal = sessionPresent + sessionAbsent + sessionLeave;
    const overallRate = sessionTotal > 0 ? Math.round((sessionPresent / sessionTotal) * 100) : 0;

    return {
      today: {
        present: todayPresent,
        absent: todayAbsent,
        leave: todayLeave,
        total: todayTotal,
        rate: todayRate
      },
      todayAttendance: todayPresent,
      totalRecords: sessionTotal,
      overallRate,
      byStatus: {
        present: todayTotal > 0 ? todayPresent : sessionPresent,
        absent: todayTotal > 0 ? todayAbsent : sessionAbsent,
        leave: todayTotal > 0 ? todayLeave : sessionLeave
      }
    };
  }

  /**
   * 4. Staff Statistics
   */
  async getStaffStats(sessionId) {
    const [totalStaff, teachingStaff, nonTeachingStaff, supportingStaff] = await Promise.all([
      Staff.countDocuments({ status: { $in: ['ACTIVE', 'Active'] } }).catch(() => 0),
      Staff.countDocuments({ status: { $in: ['ACTIVE', 'Active'] }, isTeaching: true }).catch(() => 0),
      Staff.countDocuments({ status: { $in: ['ACTIVE', 'Active'] }, isNonTeaching: true }).catch(() => 0),
      Staff.countDocuments({ status: { $in: ['ACTIVE', 'Active'] }, isSupportingStaff: true }).catch(() => 0),
    ]);

    return {
      totalStaff,
      teachingStaff,
      nonTeachingStaff,
      supportingStaff,
      total: totalStaff,
      teaching: teachingStaff,
      nonTeaching: nonTeachingStaff,
      supporting: supportingStaff
    };
  }

  /**
   * 5. Finance Statistics
   */
  async getFinanceStats(sessionId) {
    const feeStats = await this.getFeesStats(sessionId);

    const [incomes, expenses, hostelExpenses, wallets] = await Promise.all([
      FinanceIncome.find().lean().catch(() => []),
      FinanceExpense.find({ status: { $ne: 'Rejected' } }).lean().catch(() => []),
      HostelExpense.find().lean().catch(() => []),
      Wallet.find({ status: 'ACTIVE' }).lean().catch(() => []),
    ]);

    const directIncome = incomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const directExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalHostelExpense = hostelExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalWalletBalance = wallets.reduce((sum, w) => sum + Number(w.currentBalance || 0), 0);

    const totalInflow = directIncome + feeStats.totalFeeCollected;
    const totalOutflow = directExpense + totalHostelExpense;
    const totalPending = feeStats.pendingAmount;
    const netBalance = totalInflow - totalOutflow;

    return {
      totalInflow,
      totalOutflow,
      totalPending,
      netBalance,
      monthlyIncome: totalInflow,
      monthlyExpense: totalOutflow,
      totalReceivable: totalPending,
      totalWalletBalance,
      breakdown: {
        directIncome,
        feesCollected: feeStats.totalFeeCollected,
        directExpense,
        hostelExpense: totalHostelExpense
      }
    };
  }

  /**
   * 6. Charts Data (Monthly Fee Collections and Weekly Attendance Trends)
   */
  async getChartsData(sessionId) {
    const { sessionMatch, studentSessionMatch } = this._buildSessionFilters(sessionId);

    let sessionStudentIds = [];
    if (sessionId && sessionId !== 'all') {
      sessionStudentIds = await Student.find(studentSessionMatch).distinct('_id').catch(() => []);
    }

    const extraFilter = (sessionId && sessionId !== 'all') ? {
      $or: [
        { sessionId: sessionMatch.sessionId },
        { studentId: { $in: sessionStudentIds } }
      ]
    } : {};

    const [challans, extraChallans, hostelChallans, allAttn] = await Promise.all([
      FeeChallan.find(sessionMatch).lean().catch(() => []),
      ExtraChallan.find(extraFilter).lean().catch(() => []),
      HostelChallan.find(sessionMatch).lean().catch(() => []),
      Attendance.find().lean().catch(() => []),
    ]);

    const academicMonths = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const monthlyMap = {};
    for (const m of academicMonths) {
      monthlyMap[m] = { month: m, collected: 0, pending: 0 };
    }

    for (const c of [...challans, ...extraChallans, ...hostelChallans]) {
      let mName = null;
      if (c.month) {
        const match = c.month.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i);
        if (match) {
          const found = match[0].substring(0, 3).toLowerCase();
          mName = academicMonths.find(x => x.toLowerCase() === found);
        }
      }
      if (!mName && (c.paidDate || c.dueDate || c.createdAt)) {
        const d = new Date(c.paidDate || c.dueDate || c.createdAt);
        const monShort = d.toLocaleString('en-US', { month: 'short' });
        mName = academicMonths.find(x => x.toLowerCase() === monShort.toLowerCase());
      }
      if (mName && monthlyMap[mName]) {
        const paid = Number(c.paidAmount || 0);
        const isPaid = ['PAID', 'SETTLED'].includes(c.status);
        const total = Number(c.totalAmount || c.netPayable || c.amount || c.hostelFee || 0);
        monthlyMap[mName].collected += paid;
        if (!isPaid && c.status !== 'VOID' && c.status !== 'SUPERSEDED') {
          monthlyMap[mName].pending += Math.max(0, total - paid);
        }
      }
    }

    let monthlyFeeCollection = academicMonths.map(m => monthlyMap[m]).filter(m => m.collected > 0 || m.pending > 0);
    if (monthlyFeeCollection.length === 0) {
      monthlyFeeCollection = academicMonths.slice(0, 6).map(m => monthlyMap[m]);
    }

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayMap = {};
    for (const day of weekdays) {
      weekdayMap[day] = { present: 0, total: 0 };
    }

    for (const a of allAttn) {
      if (!a.date) continue;
      const d = new Date(a.date);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      if (weekdayMap[dayName]) {
        const st = (a.status || '').toUpperCase();
        if (st === 'PRESENT') {
          weekdayMap[dayName].present++;
          weekdayMap[dayName].total++;
        } else if (['ABSENT', 'LEAVE', 'HALF_DAY'].includes(st)) {
          weekdayMap[dayName].total++;
        }
      }
    }

    const weeklyAttendance = weekdays.map(day => {
      const stats = weekdayMap[day];
      const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      return { day, rate };
    });

    return {
      monthlyFeeCollection,
      weeklyAttendance
    };
  }

  /**
   * 7. Class-wise Average Tuition Fee
   */
  async getAverageTuitionByClass(sessionId) {
    const match = { status: { $regex: /^active$/i } };
    if (sessionId && sessionId !== 'all') {
      try {
        const sId = new mongoose.Types.ObjectId(sessionId);
        match.$or = [
          { sessionId: sId },
          { 'academicRecords.sessionId': sId },
          { 'installments.sessionId': sId }
        ];
      } catch (e) {
        // If not a valid ObjectId, ignore
      }
    }

    const results = await Student.aggregate([
      { $match: match },
      { $group: {
        _id: '$classId',
        totalStudents: { $sum: 1 },
        totalDecidedFee: { $sum: '$tuitionFee' },
        averageTuitionFee: { $avg: '$tuitionFee' },
      }},
      { $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'classDoc' }},
      { $unwind: { path: '$classDoc', preserveNullAndEmptyArrays: true }},
      { $lookup: { from: 'programs', localField: 'classDoc.programId', foreignField: '_id', as: 'programDoc' }},
      { $unwind: { path: '$programDoc', preserveNullAndEmptyArrays: true }},
      { $project: {
        className: { $ifNull: ['$classDoc.name', 'Unassigned Class'] },
        programName: { $ifNull: ['$programDoc.name', 'General'] },
        totalStudents: 1,
        totalDecidedFee: 1,
        averageTuitionFee: { $round: [{ $ifNull: ['$averageTuitionFee', 0] }, 0] },
      }},
      { $sort: { programName: 1, className: 1 }},
    ]);

    return results;
  }

  /**
   * 8. Comprehensive Stats (combines all modules)
   */
  async getStats(sessionId) {
    const [studentsStats, feesStats, attendanceStats, staffStats, financeStats] = await Promise.all([
      this.getStudentsStats(sessionId),
      this.getFeesStats(sessionId),
      this.getAttendanceStats(sessionId),
      this.getStaffStats(sessionId),
      this.getFinanceStats(sessionId),
    ]);

    const [
      pendingInquiries,
      totalVisitors,
      pendingComplaints,
      totalCalls,
      totalPrograms,
      totalClasses,
      totalSections,
      totalSubjects,
      totalRooms,
      activeHostelResidents,
      totalInventoryItems,
      lowStockItems,
      pendingLeaves,
      pendingAdvanceSalary,
      totalExams
    ] = await Promise.all([
      FrontOfficeInquiry.countDocuments({ status: { $in: ['NEW', 'New', 'Pending', 'PENDING'] } }).catch(() => 0),
      FrontOfficeVisitor.countDocuments().catch(() => 0),
      FrontOfficeComplaint.countDocuments({ status: { $in: ['Pending', 'PENDING', 'New', 'NEW'] } }).catch(() => 0),
      FrontOfficeContact.countDocuments().catch(() => 0),
      Program.countDocuments().catch(() => 0),
      Class.countDocuments().catch(() => 0),
      Section.countDocuments().catch(() => 0),
      Subject.countDocuments().catch(() => 0),
      HostelRoom.countDocuments().catch(() => 0),
      HostelRegistration.countDocuments({ status: { $in: ['ACTIVE', 'Active', 'active'] } }).catch(() => 0),
      InventoryItem.countDocuments().catch(() => 0),
      InventoryItem.countDocuments({ $expr: { $lte: ['$quantity', '$alertQuantity'] } }).catch(() => 0),
      Leave.countDocuments({ status: { $in: ['Pending', 'PENDING'] } }).catch(() => 0),
      AdvanceSalary.countDocuments({ status: { $in: ['Pending', 'PENDING'] } }).catch(() => 0),
      Exam.countDocuments().catch(() => 0),
    ]);

    return {
      // Direct root properties for compatibility
      totalStudents: studentsStats.totalStudents,
      activeStudents: studentsStats.activeStudents,
      totalStaff: staffStats.totalStaff,
      teachingStaff: staffStats.teachingStaff,
      nonTeachingStaff: staffStats.nonTeachingStaff,
      supportingStaff: staffStats.supportingStaff,
      todayAttendance: attendanceStats.todayAttendance,
      pendingInquiries,
      pendingComplaints,
      totalFeeCollected: feesStats.totalFeeCollected,
      pendingAmount: feesStats.pendingAmount,
      totalInflow: financeStats.totalInflow,
      totalOutflow: financeStats.totalOutflow,
      netBalance: financeStats.netBalance,
      byProgram: studentsStats.byProgram,
      programDistribution: studentsStats.programDistribution,
      byStatus: studentsStats.byStatus,
      breakdown: feesStats.breakdown,
      regularRevenue: feesStats.regularRevenue,
      hostelRevenue: feesStats.hostelRevenue,
      extraRevenue: feesStats.extraRevenue,
      installmentPendingAmount: feesStats.installmentPendingAmount,
      hostelPendingAmount: feesStats.hostelPendingAmount,
      extraPendingAmount: feesStats.extraPendingAmount,

      // Structured module sections
      students: studentsStats,
      staff: staffStats,
      attendance: attendanceStats,
      fees: feesStats,
      finance: financeStats,
      frontOffice: {
        inquiries: pendingInquiries,
        visitors: totalVisitors,
        complaints: pendingComplaints,
        calls: totalCalls,
      },
      academics: {
        programs: totalPrograms,
        classes: totalClasses,
        sections: totalSections,
        subjects: totalSubjects,
      },
      hostel: {
        rooms: totalRooms,
        residents: activeHostelResidents,
      },
      inventory: {
        totalItems: totalInventoryItems,
        lowStock: lowStockItems,
      },
      hr: {
        pendingLeaves,
        pendingAdvanceSalary,
      },
      examination: {
        totalExams,
      },
      complaints: {
        pending: pendingComplaints,
      },
    };
  }
}

module.exports = new DashboardService();
