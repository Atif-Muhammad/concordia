const {
  Attendance,
  Leave,
  Holiday,
  AttendanceSkip,
  Student,
  Staff,
  Class
} = require('../models');

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

class AttendanceService {
  // Student Attendance
  async fetchStudentAttendance({ classId, sectionId, subjectId, date, sessionId }) {
    let classDoc = null;
    if (classId) {
      classDoc = await Class.findById(classId);
    }
    const allowSections = classDoc ? classDoc.allowSections !== false : true;

    const filter = { classId, status: { $in: ['ACTIVE', 'Active'] } };
    // If class does NOT allow sections, ignore sectionId completely (direct link to class and student)
    if (allowSections && sectionId && sectionId !== '*' && sectionId !== 'all') {
      filter.sectionId = sectionId;
    }
    if (sessionId) filter.sessionId = sessionId;

    const students = await Student.find(filter)
      .populate('classId')
      .populate('sectionId')
      .sort({ rollNumber: 1 });

    const attendanceQuery = {
      classId,
      date,
      role: 'STUDENT',
      ...(allowSections && sectionId && sectionId !== '*' && sectionId !== 'all' ? { sectionId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(sessionId ? { sessionId } : {})
    };

    const attendanceRecords = await Attendance.find(attendanceQuery);
    const attendanceMap = new Map();
    attendanceRecords.forEach(r => attendanceMap.set(String(r.studentId), r));

    // Find all approved student leaves that cover this date
    const studentIds = students.map(s => s._id);
    const approvedLeaves = await Leave.find({
      studentId: { $in: studentIds },
      applicantType: 'STUDENT',
      status: { $regex: /^approved$/i },
      fromDate: { $lte: date },
      toDate: { $gte: date }
    });

    const leaveMap = new Map();
    approvedLeaves.forEach(l => leaveMap.set(String(l.studentId), l));

    // Check if the date is marked as a holiday or class skip
    const holiday = await Holiday.findOne({
      $or: [
        { date },
        { date: { $lte: date }, endDate: { $gte: date } }
      ]
    });
    const skip = !holiday ? await AttendanceSkip.findOne({
      classId,
      date,
      ...(allowSections && sectionId && sectionId !== '*' && sectionId !== 'all' ? { sectionId } : {})
    }) : null;
    const isHolidayOrSkip = !!(holiday || skip);
    const holidayTitle = holiday ? holiday.title : (skip?.reason || 'Holiday');

    const studentRows = students.map(s => {
      const sId = String(s._id || s.id);
      const rec = attendanceMap.get(sId);
      const leave = leaveMap.get(sId);

      let effectiveStatus = rec ? rec.status : (leave ? 'LEAVE' : (isHolidayOrSkip ? 'HD' : null));
      if (leave && (!rec || rec.status !== 'LEAVE')) {
        effectiveStatus = 'LEAVE';
      } else if (isHolidayOrSkip && (!rec || rec.status === 'HD' || rec.status === 'HOLIDAY' || !rec.status)) {
        effectiveStatus = 'HD';
      }

      const attRecord = rec ? {
        id: rec.id || rec._id,
        status: effectiveStatus || rec.status,
        leaveType: rec.leaveType || (leave ? leave.leaveType : null),
        notes: rec.notes || (leave ? leave.reason : (isHolidayOrSkip ? holidayTitle : '')),
        markedAt: rec.markedAt,
        generatedAt: rec.createdAt,
        isApprovedLeave: !!leave,
        leaveReason: leave ? leave.reason : undefined,
        isHoliday: isHolidayOrSkip,
        holidayTitle: isHolidayOrSkip ? holidayTitle : undefined
      } : (leave ? {
        status: 'LEAVE',
        leaveType: leave.leaveType || 'CASUAL',
        notes: leave.reason || 'Approved Leave',
        isApprovedLeave: true,
        leaveReason: leave.reason
      } : (isHolidayOrSkip ? {
        status: 'HD',
        notes: holidayTitle,
        isHoliday: true,
        holidayTitle
      } : null));

      return {
        id: sId,
        _id: s._id,
        rollNumber: s.rollNumber,
        fName: s.fName,
        lName: s.lName,
        fatherOrguardian: s.fatherOrguardian,
        gender: s.gender,
        class: s.classId ? { id: s.classId._id || s.classId.id, name: s.classId.name } : null,
        section: s.sectionId ? { id: s.sectionId._id || s.sectionId.id, name: s.sectionId.name } : null,
        classId: s.classId?._id || s.classId?.id || s.classId,
        sectionId: s.sectionId?._id || s.sectionId?.id || s.sectionId,
        programId: s.programId,
        status: s.status,
        attendance: attRecord ? [attRecord] : []
      };
    });

    return { attendance: studentRows };
  }

  async updateStudentAttendance(data) {
    const { rows, students, date, classId, sectionId, subjectId, sessionId, teacherId } = data;
    const studentList = students || rows || [];

    let classDoc = null;
    if (classId) {
      classDoc = await Class.findById(classId);
    }
    const allowSections = classDoc ? classDoc.allowSections !== false : true;
    const effectiveSectionId = allowSections && sectionId && sectionId !== '*' && sectionId !== 'all' ? sectionId : null;

    const ops = studentList.map(item => {
      const studentId = item.studentId || item.id;
      const status = String(item.status || 'PRESENT').toUpperCase();
      const query = {
        studentId,
        date,
        classId,
        role: 'STUDENT',
        ...(effectiveSectionId ? { sectionId: effectiveSectionId } : { sectionId: null }),
        ...(subjectId ? { subjectId } : {}),
        ...(sessionId ? { sessionId } : {})
      };
      return Attendance.findOneAndUpdate(
        query,
        {
          ...query,
          status,
          leaveType: item.leaveType || (status === 'LEAVE' ? 'CASUAL' : null),
          notes: item.notes || '',
          markedBy: teacherId || data.userId || null,
          markedAt: new Date()
        },
        { upsert: true, new: true }
      );
    });
    return Promise.all(ops);
  }

  async deleteStudentRecord({ studentId, classId, sectionId, subjectId, date, attendanceId }) {
    if (attendanceId) {
      return Attendance.findByIdAndDelete(attendanceId);
    }
    return Attendance.findOneAndDelete({
      studentId,
      classId,
      date,
      ...(sectionId ? { sectionId } : {}),
      ...(subjectId ? { subjectId } : {})
    });
  }

  // Leaves
  async getLeaves(type = 'ALL', month = null) {
    const filter = type && type !== 'ALL' ? { applicantType: type } : {};
    if (month && month !== 'ALL' && month !== 'all') {
      const parts = month.split('-');
      if (parts.length >= 2) {
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const startOfMonth = `${month}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;
        filter.$or = [
          { month },
          { fromDate: { $lte: endOfMonth }, toDate: { $gte: startOfMonth } },
          { fromDate: { $regex: `^${month}` } },
          { toDate: { $regex: `^${month}` } }
        ];
      } else {
        filter.$or = [
          { month },
          { fromDate: { $regex: `^${month}` } },
          { toDate: { $regex: `^${month}` } }
        ];
      }
    }
    const leaves = await Leave.find(filter)
      .populate({
        path: 'studentId',
        populate: { path: 'classId' }
      })
      .populate({
        path: 'staffId',
        populate: { path: 'departmentId' }
      })
      .sort({ fromDate: -1 });

    const formatted = leaves.map(l => {
      const stud = l.studentId;
      const stf = l.staffId;
      const baseObj = l.toObject ? l.toObject() : l;
      return {
        ...baseObj,
        id: l._id ? l._id.toHexString() : l.id,
        applicantType: l.applicantType || (stud ? 'STUDENT' : 'STAFF'),
        student: stud && typeof stud === 'object' ? {
          id: stud._id ? stud._id.toHexString() : stud.id,
          fName: stud.fName,
          lName: stud.lName,
          rollNumber: stud.rollNumber,
          class: stud.classId ? { name: stud.classId.name } : null
        } : null,
        staff: stf && typeof stf === 'object' ? {
          id: stf._id ? stf._id.toHexString() : stf.id,
          name: stf.name,
          employeeId: stf.employeeId,
          role: stf.role,
          designation: stf.designation,
          department: stf.departmentId?.name || stf.empDepartment || '',
          isTeaching: !!stf.isTeaching,
          isNonTeaching: !!stf.isNonTeaching
        } : null
      };
    });

    return { data: formatted, total: formatted.length };
  }

  async createLeave(data) {
    const payload = { ...data };
    if (!payload.applicantType) {
      payload.applicantType = payload.studentId ? 'STUDENT' : 'STAFF';
    }
    if (!payload.days && payload.fromDate && payload.toDate) {
      const f = new Date(payload.fromDate);
      const t = new Date(payload.toDate);
      const diffMs = Math.abs(t - f);
      payload.days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    }
    if (!payload.month && payload.fromDate) {
      payload.month = payload.fromDate.slice(0, 7);
    }
    return Leave.create(payload);
  }

  async updateLeave(id, data) {
    const leave = await Leave.findByIdAndUpdate(id, data, { new: true });
    if (!leave) return null;

    const statusUpper = String(leave.status || '').toUpperCase();

    // If a student leave is approved, sync attendance for those dates
    if (statusUpper === 'APPROVED' && leave.applicantType === 'STUDENT' && leave.studentId) {
      try {
        const student = await Student.findById(leave.studentId);
        if (student) {
          const classDoc = student.classId ? await Class.findById(student.classId) : null;
          const allowSections = classDoc ? classDoc.allowSections !== false : true;
          const sectionId = allowSections ? (student.sectionId || null) : null;

          const from = new Date(leave.fromDate);
          const to = new Date(leave.toDate);
          for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dStr = `${y}-${m}-${day}`;

            await Attendance.findOneAndUpdate(
              {
                studentId: leave.studentId,
                date: dStr,
                role: 'STUDENT',
                classId: student.classId
              },
              {
                studentId: leave.studentId,
                date: dStr,
                role: 'STUDENT',
                classId: student.classId,
                sectionId,
                sessionId: student.sessionId || null,
                status: 'LEAVE',
                leaveType: leave.leaveType || 'CASUAL',
                notes: leave.reason || 'Approved Leave',
                markedAt: new Date()
              },
              { upsert: true, new: true }
            );
          }
        }
      } catch (syncErr) {
        console.error('Error syncing approved student leave to attendance:', syncErr);
      }
    }

    // If a staff leave is approved, sync attendance for those dates
    if (statusUpper === 'APPROVED' && (leave.applicantType === 'STAFF' || leave.staffId) && leave.staffId) {
      try {
        const from = new Date(leave.fromDate);
        const to = new Date(leave.toDate || leave.fromDate);
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dStr = `${y}-${m}-${day}`;

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
      } catch (syncErr) {
        console.error('Error syncing approved staff leave to attendance:', syncErr);
      }
    }

    return leave;
  }

  // Holidays
  async getHolidays() {
    return Holiday.find().sort({ date: 1 });
  }

  async createHoliday(data) {
    const sDate = data.date ? (typeof data.date === 'string' ? data.date.slice(0, 10) : new Date(data.date).toISOString().slice(0, 10)) : null;
    const eDate = data.endDate ? (typeof data.endDate === 'string' ? data.endDate.slice(0, 10) : new Date(data.endDate).toISOString().slice(0, 10)) : sDate;

    if (sDate && eDate && sDate !== eDate) {
      const dates = getDateRangeStrings(sDate, eDate);
      const created = [];
      for (const d of dates) {
        const item = await Holiday.create({ ...data, date: d, endDate: eDate });
        created.push(item);
      }
      return created[0] || null;
    }
    return Holiday.create({ ...data, date: sDate || data.date, endDate: eDate });
  }

  async deleteHoliday(id) {
    return Holiday.findByIdAndDelete(id);
  }

  // Skips
  async getSkips(classId, sectionId) {
    const filter = { classId };
    if (sectionId) filter.sectionId = sectionId;
    return AttendanceSkip.find(filter);
  }

  async createSkip(data) {
    return AttendanceSkip.create(data);
  }

  async deleteSkip(id) {
    return AttendanceSkip.findByIdAndDelete(id);
  }

  // Staff Attendance
  async getStaffAttendance(date, role = 'all') {
    const staffFilter = { status: 'ACTIVE' };
    if (role === 'teaching') {
      staffFilter.isTeaching = true;
      staffFilter.isNonTeaching = false;
    } else if (role === 'non-teaching') {
      staffFilter.isTeaching = false;
      staffFilter.isNonTeaching = true;
    }

    const allStaff = await Staff.find(staffFilter).sort({ name: 1 });
    const records = await Attendance.find({ date, role: { $in: ['STAFF', 'TEACHER'] } }).populate('markedBy', 'name');
    const map = new Map();
    records.forEach(r => map.set(String(r.staffId), r));

    // Find all approved staff leaves covering this date
    const staffIds = allStaff.map(s => s._id);
    const approvedLeaves = await Leave.find({
      staffId: { $in: staffIds },
      applicantType: 'STAFF',
      status: { $regex: /^approved$/i },
      fromDate: { $lte: date },
      toDate: { $gte: date }
    });

    const leaveMap = new Map();
    approvedLeaves.forEach(l => leaveMap.set(String(l.staffId), l));

    // Check if the date is a holiday in Holiday collection
    const holiday = await Holiday.findOne({
      $or: [
        { date },
        { date: { $lte: date }, endDate: { $gte: date } }
      ]
    });
    const holidayTitle = holiday?.title || 'Holiday';

    return allStaff.map(st => {
      const staffIdStr = String(st._id || st.id);
      const rec = map.get(staffIdStr);
      const leave = leaveMap.get(staffIdStr);

      let effectiveStatus = rec ? rec.status : (leave ? 'LEAVE' : (holiday ? 'HD' : null));
      let effectiveLeaveType = rec ? rec.leaveType : (leave ? (leave.leaveType || 'CASUAL').toUpperCase() : null);
      let effectiveNotes = rec ? rec.notes : (leave ? (leave.reason || 'Approved Leave') : (holiday ? holidayTitle : ''));

      if (leave) {
        effectiveStatus = 'LEAVE';
        effectiveLeaveType = (leave.leaveType || rec?.leaveType || 'CASUAL').toUpperCase();
        effectiveNotes = leave.reason || rec?.notes || 'Approved Leave';
      } else if (holiday && (!rec || rec.status === 'HD' || rec.status === 'HOLIDAY' || !rec.status)) {
        effectiveStatus = 'HD';
        effectiveNotes = holidayTitle || rec?.notes || 'Holiday';
      }

      return {
        staff: st,
        staffId: staffIdStr,
        status: effectiveStatus,
        leaveType: effectiveLeaveType,
        checkInTime: rec?.checkInTime || '',
        checkOutTime: rec?.checkOutTime || '',
        notes: effectiveNotes,
        id: rec ? (rec.id || rec._id) : undefined,
        markedAt: rec ? rec.markedAt : undefined,
        markedBy: rec?.markedBy?._id || rec?.markedBy?.id || (typeof rec?.markedBy === 'string' ? rec.markedBy : undefined),
        admin: rec?.markedBy ? { name: rec.markedBy.name } : undefined,
        isApprovedLeave: !!leave,
        leaveReason: leave?.reason || '',
        leaveStartDate: leave?.fromDate,
        leaveEndDate: leave?.toDate,
        isHoliday: !!holiday,
        holidayTitle: holiday ? holidayTitle : undefined
      };
    });
  }

  async bulkMarkStaffAttendance(data, user) {
    let { date, rows } = data || {};
    if (!rows && data?.staffId) {
      rows = [data];
      date = date || data.date;
    }
    const ops = (rows || []).map(row => {
      const query = {
        staffId: row.staffId,
        date,
        role: 'STAFF'
      };
      const updateData = {
        ...query,
        status: row.status,
        leaveType: row.leaveType,
        checkInTime: row.checkInTime || '',
        checkOutTime: row.checkOutTime || '',
        notes: row.notes || '',
        markedAt: new Date()
      };
      if (user?._id || user?.id) {
        updateData.markedBy = user._id || user.id;
      }
      return Attendance.findOneAndUpdate(
        query,
        updateData,
        { upsert: true, new: true }
      );
    });
    const results = await Promise.all(ops);
    return { count: results.length, message: 'Attendance saved' };
  }

  async deleteStaffAttendanceRecord({ staffId, date, attendanceId }) {
    if (attendanceId) {
      return Attendance.findByIdAndDelete(attendanceId);
    }
    return Attendance.findOneAndDelete({ staffId, date });
  }

  async deleteStaffAttendanceByDate(date) {
    return Attendance.deleteMany({ date, role: { $in: ['STAFF', 'TEACHER'] } });
  }

  async getStaffLeaveBalance(staffId, month = null) {
    const staff = await Staff.findById(staffId);
    if (!staff) return null;
    const settings = staff.leaveSettings || {};

    // Reconcile: Purge any attendance records marked 'LEAVE' on dates where staff has a non-approved leave request
    try {
      const nonApprovedLeaves = await Leave.find({
        staffId,
        applicantType: 'STAFF',
        status: { $ne: 'APPROVED' }
      });
      for (const l of nonApprovedLeaves) {
        const dates = getDateRangeStrings(l.fromDate, l.toDate);
        if (dates.length > 0) {
          await Attendance.deleteMany({
            staffId,
            date: { $in: dates },
            status: 'LEAVE'
          });
        }
      }
    } catch (err) {
      console.error('Error reconciling non-approved staff leaves in getStaffLeaveBalance:', err);
    }

    const targetMonth = month && month !== 'all' ? month : new Date().toISOString().slice(0, 7);
    const dateFilter = { date: { $regex: `^${targetMonth}` } };

    const usedCasual = await Attendance.countDocuments({
      staffId,
      status: { $regex: /^leave$/i },
      $or: [
        { leaveType: { $regex: /^(casual|cl)$/i } },
        { leaveType: null },
        { leaveType: '' },
        { leaveType: { $exists: false } }
      ],
      ...dateFilter
    });
    const usedSick = await Attendance.countDocuments({
      staffId,
      status: { $regex: /^leave$/i },
      leaveType: { $regex: /^(sick|sk)$/i },
      ...dateFilter
    });
    const usedAnnual = await Attendance.countDocuments({
      staffId,
      status: { $regex: /^leave$/i },
      leaveType: { $regex: /^(annual|al)$/i },
      ...dateFilter
    });

    const casualAllowed = Number(settings.casualAllowed) || 0;
    const sickAllowed = Number(settings.sickAllowed) || 0;
    const annualAllowed = Number(settings.annualAllowed) || 0;

    const casualObj = {
      allowed: casualAllowed,
      used: usedCasual,
      taken: usedCasual,
      balance: Math.max(0, casualAllowed - usedCasual),
      remaining: Math.max(0, casualAllowed - usedCasual)
    };
    const sickObj = {
      allowed: sickAllowed,
      used: usedSick,
      taken: usedSick,
      balance: Math.max(0, sickAllowed - usedSick),
      remaining: Math.max(0, sickAllowed - usedSick)
    };
    const annualObj = {
      allowed: annualAllowed,
      used: usedAnnual,
      taken: usedAnnual,
      balance: Math.max(0, annualAllowed - usedAnnual),
      remaining: Math.max(0, annualAllowed - usedAnnual)
    };

    return {
      month: targetMonth,
      casual: casualObj,
      sick: sickObj,
      annual: annualObj,
      CASUAL: casualObj,
      SICK: sickObj,
      ANNUAL: annualObj,
      absentDeduction: Number(staff.absentDeduction || settings.absentDeduction || (staff.basicPay ? Math.round(Number(staff.basicPay) / 30) : 0)),
      maxLateMinutes: Number(settings.maxLateMinutes ?? staff.maxLateMinutes ?? 0),
    };
  }

  async getStaffAttendanceHistory(staffId, month = null) {
    const targetMonth = month && month !== 'all' ? month : new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, m, 0).getDate();

    // Fetch all attendance records for this staff in this month
    const records = await Attendance.find({
      staffId,
      date: { $regex: `^${targetMonth}` }
    }).populate('markedBy', 'name');

    const recordMap = new Map();
    records.forEach(r => recordMap.set(r.date, r));

    // Fetch approved leaves covering any dates in this month
    const approvedLeaves = await Leave.find({
      staffId,
      applicantType: 'STAFF',
      status: { $regex: /^approved$/i },
      $or: [
        { fromDate: { $regex: `^${targetMonth}` } },
        { toDate: { $regex: `^${targetMonth}` } },
        {
          fromDate: { $lte: `${targetMonth}-${String(daysInMonth).padStart(2, '0')}` },
          toDate: { $gte: `${targetMonth}-01` }
        }
      ]
    });

    const leaveDateMap = new Map();
    approvedLeaves.forEach(l => {
      const dates = getDateRangeStrings(l.fromDate, l.toDate || l.fromDate);
      dates.forEach(d => {
        if (d.startsWith(targetMonth)) {
          leaveDateMap.set(d, l);
        }
      });
    });

    // Fetch holidays covering this month
    const holidays = await Holiday.find({
      $or: [
        { date: { $regex: `^${targetMonth}` } },
        { endDate: { $regex: `^${targetMonth}` } },
        {
          date: { $lte: `${targetMonth}-${String(daysInMonth).padStart(2, '0')}` },
          endDate: { $gte: `${targetMonth}-01` }
        }
      ]
    });

    const holidayDateMap = new Map();
    holidays.forEach(h => {
      const s = typeof h.date === 'string' ? h.date.slice(0, 10) : new Date(h.date).toISOString().slice(0, 10);
      const e = h.endDate ? (typeof h.endDate === 'string' ? h.endDate.slice(0, 10) : new Date(h.endDate).toISOString().slice(0, 10)) : s;
      const dates = getDateRangeStrings(s, e);
      dates.forEach(d => {
        if (d.startsWith(targetMonth)) {
          holidayDateMap.set(d, h.title || 'Holiday');
        }
      });
    });

    const dayRows = [];
    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let holidayCount = 0;
    let notMarkedCount = 0;
    const leaveBreakdown = { casual: 0, sick: 0, annual: 0 };

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${targetMonth}-${dayStr}`;
      const dObj = new Date(year, m - 1, day);
      const dayOfWeek = dayNames[dObj.getDay()];
      const isSunday = dObj.getDay() === 0;

      const attRec = recordMap.get(dateStr);
      const leaveRec = leaveDateMap.get(dateStr);
      const holidayTitle = holidayDateMap.get(dateStr);

      let status = 'NOT_MARKED';
      let leaveType = null;
      let checkInTime = '';
      let checkOutTime = '';
      let notes = '';
      let markedBy = '';
      let markedAt = null;

      if (attRec) {
        status = String(attRec.status || 'NOT_MARKED').toUpperCase();
        leaveType = attRec.leaveType;
        checkInTime = attRec.checkInTime || '';
        checkOutTime = attRec.checkOutTime || '';
        notes = attRec.notes || '';
        markedBy = attRec.markedBy?.name || '';
        markedAt = attRec.markedAt || null;
      } else if (leaveRec) {
        status = 'LEAVE';
        leaveType = leaveRec.leaveType || 'CASUAL';
        notes = leaveRec.reason || 'Approved Leave';
      } else if (holidayTitle) {
        status = 'HOLIDAY';
        notes = holidayTitle;
      }

      const normStatus = status.toUpperCase();
      if (normStatus === 'PRESENT') presentCount++;
      else if (normStatus === 'ABSENT') absentCount++;
      else if (normStatus === 'HALF_DAY' || normStatus === 'HALF DAY') halfDayCount++;
      else if (normStatus === 'LEAVE') {
        leaveCount++;
        const lt = String(leaveType || 'CASUAL').toUpperCase();
        if (lt === 'SICK' || lt === 'SK') leaveBreakdown.sick++;
        else if (lt === 'ANNUAL' || lt === 'AL') leaveBreakdown.annual++;
        else leaveBreakdown.casual++;
      } else if (normStatus === 'HOLIDAY' || normStatus === 'HD') holidayCount++;
      else notMarkedCount++;

      dayRows.push({
        date: dateStr,
        day: day,
        dayOfWeek,
        isSunday,
        status: normStatus,
        leaveType,
        checkInTime,
        checkOutTime,
        notes,
        markedBy,
        markedAt,
      });
    }

    const workingDaysTracked = presentCount + absentCount + halfDayCount + leaveCount;
    const attendanceRate = workingDaysTracked > 0
      ? Math.round(((presentCount + (halfDayCount * 0.5)) / workingDaysTracked) * 100)
      : 100;

    return {
      month: targetMonth,
      daysInMonth,
      stats: {
        totalDays: daysInMonth,
        present: presentCount,
        absent: absentCount,
        halfDay: halfDayCount,
        leave: leaveCount,
        holiday: holidayCount,
        notMarked: notMarkedCount,
        workingDaysTracked,
        attendanceRate,
        leaveBreakdown,
      },
      records: dayRows,
    };
  }
}

module.exports = new AttendanceService();
