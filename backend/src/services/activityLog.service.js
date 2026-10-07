const mongoose = require('mongoose');
const { ActivityLog, Staff, User } = require('../models');

class ActivityLogService {
  /**
   * Get paginated and filtered activity logs
   */
  async getActivityLogs(query = {}) {
    const {
      page = 1,
      limit = 25,
      startDate,
      endDate,
      startTime,
      endTime,
      staffId,
      userId,
      module,
      subModule,
      status,
      search
    } = query;

    const filter = {};

    // 1. Date Range Filter
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        // Start of day
        const s = new Date(startDate);
        s.setUTCHours(0, 0, 0, 0);
        filter.timestamp.$gte = s;
      }
      if (endDate) {
        // End of day
        const e = new Date(endDate);
        e.setUTCHours(23, 59, 59, 999);
        filter.timestamp.$lte = e;
      }
    }

    // 2. Time-of-day filter (e.g., 09:00 to 17:00)
    if (startTime || endTime) {
      const sH = startTime ? parseInt(startTime.split(':')[0], 10) : 0;
      const sM = startTime ? parseInt(startTime.split(':')[1] || '0', 10) : 0;
      const eH = endTime ? parseInt(endTime.split(':')[0], 10) : 23;
      const eM = endTime ? parseInt(endTime.split(':')[1] || '59', 10) : 59;

      const startMinutes = sH * 60 + sM;
      const endMinutes = eH * 60 + eM;

      filter.$expr = {
        $and: [
          ...(filter.$expr ? [filter.$expr] : []),
          {
            $gte: [
              { $add: [{ $multiply: [{ $hour: '$timestamp' }, 60] }, { $minute: '$timestamp' }] },
              startMinutes
            ]
          },
          {
            $lte: [
              { $add: [{ $multiply: [{ $hour: '$timestamp' }, 60] }, { $minute: '$timestamp' }] },
              endMinutes
            ]
          }
        ]
      };
    }

    // 3. Staff / User Filter
    if (staffId && staffId !== 'all') {
      filter.$or = [
        { staffId: String(staffId).trim() },
        { userEmail: new RegExp(`^${staffId}$`, 'i') }
      ];
    }
    if (userId && userId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        filter.userId = new mongoose.Types.ObjectId(userId);
      }
    }

    // 4. Module & Sub-module Filter
    if (module && module !== 'all') {
      filter.module = new RegExp(`^${module.trim()}$`, 'i');
    }
    if (subModule && subModule !== 'all') {
      filter.subModule = new RegExp(`^${subModule.trim()}$`, 'i');
    }

    // 5. Status Filter (SUCCESS / FAILED)
    if (status && status !== 'all') {
      filter.status = status.toUpperCase();
    }

    // 6. Search Filter
    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      const searchConditions = [
        { description: regex },
        { userName: regex },
        { userEmail: regex },
        { staffId: regex },
        { failureReason: regex },
        { endpoint: regex },
        { action: regex },
        { 'targetEntity.name': regex },
        { 'targetEntity.identifier': regex },
        { 'targetEntity.subTitle': regex }
      ];
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: searchConditions }
        ];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Run parallel queries: logs list, total count, stats (success vs failed)
    const [logs, total, statsResult] = await Promise.all([
      ActivityLog.find(filter)
        .select('-body -params')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ActivityLog.countDocuments(filter),
      ActivityLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const stats = {
      total,
      successCount: 0,
      failedCount: 0
    };
    statsResult.forEach(item => {
      if (item._id === 'SUCCESS') stats.successCount = item.count;
      if (item._id === 'FAILED') stats.failedCount = item.count;
    });

    return {
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      },
      stats
    };
  }

  /**
   * Get single activity log by ID
   */
  async getActivityLogById(id) {
    return ActivityLog.findById(id).lean();
  }

  /**
   * Get distinct filter options (modules, sub-modules, staff list)
   */
  async getFilterOptions() {
    const [modulesFromLogs, staffMembers, usersWithLogs] = await Promise.all([
      ActivityLog.aggregate([
        {
          $group: {
            _id: { module: '$module', subModule: '$subModule' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      Staff.find({ status: 'ACTIVE' })
        .select('staffId name email designation empDepartment isTeaching isNonTeaching')
        .sort({ name: 1 })
        .lean(),
      ActivityLog.aggregate([
        {
          $group: {
            _id: { staffId: '$staffId', userName: '$userName', userEmail: '$userEmail', userRole: '$userRole' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 100 }
      ])
    ]);

    // Format modules map
    const moduleMap = {};
    modulesFromLogs.forEach(item => {
      const mod = item._id?.module;
      const sub = item._id?.subModule;
      if (mod) {
        if (!moduleMap[mod]) moduleMap[mod] = new Set();
        if (sub) moduleMap[mod].add(sub);
      }
    });

    const standardModules = [
      { name: 'Executive Dashboard', subModules: [] },
      { name: 'Dashboard', subModules: [] },
      { name: 'Front Office', subModules: ['Inquiry', 'Visitor Book', 'Complaints', 'Contacts'] },
      { name: 'Students', subModules: ['Admissions & Directory'] },
      { name: 'Staff', subModules: ['Staff Directory', 'Settings'] },
      { name: 'Attendance', subModules: ['Record Attendance', 'Leave', 'Reports', 'Individual Reports', 'Teacher Attendance'] },
      { name: 'Fee Management', subModules: ['Challans', 'Extra Challans', 'Fee Heads', 'Fee Structures', 'Reports', 'Settings', 'Student History'] },
      { name: 'Examination', subModules: ['Exams', 'Marks Entry', 'Results'] },
      { name: 'Complaints', subModules: ['Complaints'] },
      { name: 'Academics', subModules: ['Sessions', 'Programs', 'Classes', 'Sections', 'Subjects', 'Subject Classes', 'Teacher Classes', 'Timetable'] },
      { name: 'HR & Payroll', subModules: ['Leaves', 'Payroll', 'Attendance', 'Advance Salary', 'Departments', 'Holidays', 'Reports'] },
      { name: 'Boarding', subModules: ['Registration', 'Rooms', 'Fees', 'Expenses', 'Inventory', 'Reports', 'Settings'] },
      { name: 'Finance', subModules: ['Dashboard', 'Income', 'Expense', 'Reports', 'Closing'] },
      { name: 'Inventory', subModules: ['Inventory', 'Expenses'] },
      { name: 'Wallets / Accounts', subModules: ['Wallets'] },
      { name: 'Configuration', subModules: ['Institute', 'Admins', 'Templates', 'Wallets / Accounts', 'Activity Logs'] },
      { name: 'Authentication', subModules: ['Login', 'Logout', 'Session'] }
    ];

    standardModules.forEach(item => {
      if (!moduleMap[item.name]) moduleMap[item.name] = new Set();
      (item.subModules || []).forEach(sub => moduleMap[item.name].add(sub));
    });

    const formattedModules = Object.keys(moduleMap).sort().map(mod => ({
      name: mod,
      subModules: Array.from(moduleMap[mod]).sort()
    }));

    // Format staff options (combine Staff model records + users seen in logs)
    const staffSet = new Map();
    staffMembers.forEach(s => {
      if (s.staffId) {
        staffSet.set(s.staffId, {
          staffId: s.staffId,
          name: s.name,
          email: s.email,
          designation: s.designation || '',
          role: s.isTeaching ? 'TEACHER' : 'STAFF'
        });
      }
    });

    usersWithLogs.forEach(u => {
      const id = u._id?.staffId || u._id?.userEmail;
      if (id && !staffSet.has(id)) {
        staffSet.set(id, {
          staffId: u._id?.staffId || '',
          name: u._id?.userName || id,
          email: u._id?.userEmail || '',
          designation: '',
          role: u._id?.userRole || 'USER'
        });
      }
    });

    return {
      modules: formattedModules,
      staffList: Array.from(staffSet.values())
    };
  }

  /**
   * Clear logs older than X days
   */
  async clearOldLogs(days = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days, 10));
    const result = await ActivityLog.deleteMany({ timestamp: { $lt: cutoffDate } });
    return {
      message: `Deleted ${result.deletedCount} logs older than ${days} days`,
      deletedCount: result.deletedCount
    };
  }
}

module.exports = new ActivityLogService();
