const {
  Attendance,
  Leave,
  Holiday,
  AttendanceSkip,
  Student,
  Staff,
  User,
  Class,
  Section,
  Subject,
  SubjectClassMapping,
  TeacherMapping,
  Program,
  AcademicSession
} = require('../models');
const academicsService = require('./academics.service');

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
    let effectiveSessionId = sessionId && sessionId !== '*' && sessionId !== 'all' ? sessionId : null;
    if (!effectiveSessionId) {
      const activeSession = await AcademicSession.findOne({
        $or: [{ isActive: true }, { isActive: 'true' }]
      }).lean();
      if (activeSession) {
        effectiveSessionId = activeSession._id;
      }
    }
    if (effectiveSessionId) filter.sessionId = effectiveSessionId;

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
      ...(effectiveSessionId ? {
        $or: [
          { sessionId: effectiveSessionId },
          { sessionId: null },
          { sessionId: { $exists: false } }
        ]
      } : {})
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

  async updateStudentAttendance(data, user) {
    const { rows, students, date, classId, sectionId, subjectId, sessionId, teacherId, userId, staffId } = data;
    const studentList = students || rows || [];

    let classDoc = null;
    if (classId) {
      classDoc = await Class.findById(classId);
    }
    const allowSections = classDoc ? classDoc.allowSections !== false : true;
    const effectiveSectionId = allowSections && sectionId && sectionId !== '*' && sectionId !== 'all' ? sectionId : null;

    const effectiveUserId = userId || user?.id || user?._id || teacherId || null;
    const effectiveStaffId = staffId || user?.refId || (user?.isStaff ? (user?.refId || user?.id) : null) || null;

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
          markedBy: effectiveUserId,
          markedByStaffId: effectiveStaffId,
          markedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
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
              { upsert: true, returnDocument: 'after' }
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
            { upsert: true, returnDocument: 'after' }
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
        { upsert: true, returnDocument: 'after' }
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

  async getAttendanceReport({ start, end, classId, sectionId, sessionId, programId, studentId }) {
    if (!start || !end) return [];

    let effectiveSessionId = sessionId && sessionId !== '*' && sessionId !== 'all' ? sessionId : null;
    if (!effectiveSessionId) {
      const activeSession = await AcademicSession.findOne({
        $or: [{ isActive: true }, { isActive: 'true' }]
      }).lean();
      if (activeSession) {
        effectiveSessionId = activeSession._id;
      }
    }

    const studentFilter = {};
    if (studentId) {
      studentFilter._id = studentId;
    } else {
      studentFilter.status = { $in: ['ACTIVE', 'Active'] };
      if (classId && classId !== '*' && classId !== 'all') {
        if (typeof classId === 'string' && classId.includes(',')) {
          studentFilter.classId = { $in: classId.split(',').map(s => s.trim()).filter(Boolean) };
        } else if (Array.isArray(classId)) {
          studentFilter.classId = { $in: classId };
        } else {
          studentFilter.classId = classId;
        }
      }
      if (sectionId && sectionId !== '*' && sectionId !== 'all') {
        if (typeof sectionId === 'string' && sectionId.includes(',')) {
          studentFilter.sectionId = { $in: sectionId.split(',').map(s => s.trim()).filter(Boolean) };
        } else if (Array.isArray(sectionId)) {
          studentFilter.sectionId = { $in: sectionId };
        } else {
          studentFilter.sectionId = sectionId;
        }
      }
      if (programId && programId !== '*' && programId !== 'all') {
        if (typeof programId === 'string' && programId.includes(',')) {
          studentFilter.programId = { $in: programId.split(',').map(s => s.trim()).filter(Boolean) };
        } else if (Array.isArray(programId)) {
          studentFilter.programId = { $in: programId };
        } else {
          studentFilter.programId = programId;
        }
      }
      if (effectiveSessionId) {
        studentFilter.sessionId = effectiveSessionId;
      }
    }

    const students = await Student.find(studentFilter)
      .populate('classId', '_id name allowSections')
      .populate('sectionId', '_id name')
      .populate('programId', '_id name code')
      .sort({ rollNumber: 1 });

    if (!students || students.length === 0) return [];

    const studentIds = students.map(s => s._id);

    const classIds = [...new Set(students.map(s => String(s.classId?._id || s.classId?.id || s.classId || '')).filter(Boolean))];

    // Build classId -> map of subjects (keyed by subjectId) using academicsService
    const classSubjectsMap = new Map();
    for (const cId of classIds) {
      const subMap = new Map();
      try {
        const sessionParam = studentId ? null : (effectiveSessionId || null);
        const secParam = sectionId && sectionId !== '*' && sectionId !== 'all' ? sectionId : undefined;
        let subList = await academicsService.getSubjectsForClassWithAssignments(cId, sessionParam, secParam);
        if (!subList || subList.length === 0) {
          subList = await academicsService.getSubjectsForClassWithAssignments(cId, null, null);
        }
        (subList || []).forEach(sub => {
          const sId = String(sub.id || sub._id || sub.subjectId || '');
          const sName = sub.name || sub.code || '';
          if (sId && sName && sName.toLowerCase() !== 'general') {
            subMap.set(sId, {
              subjectId: sId,
              subjectName: sName,
              code: sub.code || ''
            });
          }
        });
      } catch (err) {
        console.error('Error fetching subjects for class:', cId, err);
      }
      classSubjectsMap.set(cId, subMap);
    }

    const holidays = await Holiday.find({
      $or: [
        { date: { $gte: start, $lte: end } },
        { date: { $lte: end }, endDate: { $gte: start } }
      ]
    });
    const skips = await AttendanceSkip.find({
      classId: { $in: classIds },
      date: { $gte: start, $lte: end }
    });

    const holidayDateMap = new Map();
    holidays.forEach(h => {
      if (h.endDate && h.endDate > h.date) {
        const cur = new Date(h.date + 'T00:00:00');
        const last = new Date(h.endDate + 'T00:00:00');
        while (cur <= last) {
          holidayDateMap.set(cur.toISOString().slice(0, 10), h.title || 'Holiday');
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        holidayDateMap.set(h.date, h.title || 'Holiday');
      }
    });
    skips.forEach(sk => {
      holidayDateMap.set(`${sk.classId}_${sk.date}`, sk.reason || 'Holiday');
    });

    const studentObjIds = students.map(s => s._id);
    const studentStrIds = students.map(s => String(s._id || s.id));
    const allStudentIds = [...new Set([...studentObjIds, ...studentStrIds])];

    const attFilter = {
      studentId: { $in: allStudentIds },
      date: { $gte: start, $lte: end }
    };

    // When querying an individual student, do NOT restrict by session (all attendance belongs to this student).
    // For class reports, allow matching sessionId OR records where sessionId was omitted (null / undefined).
    if (!studentId && effectiveSessionId) {
      attFilter.$or = [
        { sessionId: effectiveSessionId },
        { sessionId: null },
        { sessionId: { $exists: false } }
      ];
    }

    const attendanceRecords = await Attendance.find(attFilter).populate('subjectId', '_id name code');

    const recordMap = new Map();
    attendanceRecords.forEach(r => {
      const sId = String(r.studentId);
      if (!recordMap.has(sId)) recordMap.set(sId, new Map());
      const subMap = recordMap.get(sId);
      const subId = r.subjectId?._id ? String(r.subjectId._id) : (r.subjectId ? String(r.subjectId) : null);
      const subName = r.subjectId?.name || r.subjectId?.code || null;

      const key = subId || 'unassigned';
      if (!subMap.has(key)) {
        subMap.set(key, {
          subjectId: subId || 'unassigned',
          subjectName: subName || '',
          attendance: []
        });
      }
      subMap.get(key).attendance.push({
        date: r.date,
        status: String(r.status || 'present').toLowerCase(),
        notes: r.notes || ''
      });
    });

    return students.map(s => {
      const sId = String(s._id || s.id);
      const cIdStr = String(s.classId?._id || s.classId?.id || s.classId || '');
      const classMappedSubs = classSubjectsMap.get(cIdStr) || new Map();
      const recordedSubMap = recordMap.get(sId) || new Map();

      const finalSubjectsMap = new Map();
      classMappedSubs.forEach((subInfo, subId) => {
        finalSubjectsMap.set(subId, {
          subjectId: subId,
          subjectName: subInfo.subjectName,
          code: subInfo.code,
          attendance: []
        });
      });

      recordedSubMap.forEach((recEntry, subKey) => {
        if (finalSubjectsMap.has(subKey)) {
          finalSubjectsMap.get(subKey).attendance = recEntry.attendance;
        } else if (subKey !== 'unassigned') {
          finalSubjectsMap.set(subKey, {
            subjectId: subKey,
            subjectName: recEntry.subjectName || 'Subject',
            attendance: recEntry.attendance
          });
        } else {
          if (finalSubjectsMap.size === 0) {
            const classDisplayName = s.classId?.name ? `${s.classId.name} Attendance` : 'Class Attendance';
            finalSubjectsMap.set('class_attendance', {
              subjectId: 'class_attendance',
              subjectName: classDisplayName,
              attendance: recEntry.attendance
            });
          } else {
            // Merge general / class attendance date-by-date into all subjects where subject-specific attendance was not logged
            finalSubjectsMap.forEach(sub => {
              recEntry.attendance.forEach(attItem => {
                const alreadyExists = sub.attendance.some(existing => existing.date === attItem.date);
                if (!alreadyExists) {
                  sub.attendance.push({ ...attItem });
                }
              });
            });
          }
        }
      });

      // Sort attendance entries by date for consistent display
      finalSubjectsMap.forEach(sub => {
        sub.attendance.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      });

      if (finalSubjectsMap.size === 0) {
        const classDisplayName = s.classId?.name ? `${s.classId.name} Attendance` : 'Class Attendance';
        finalSubjectsMap.set('class_attendance', {
          subjectId: 'class_attendance',
          subjectName: classDisplayName,
          attendance: []
        });
      }

      holidayDateMap.forEach((holidayTitle, dKey) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dKey) && dKey >= start && dKey <= end) {
          finalSubjectsMap.forEach(subObj => {
            const existing = subObj.attendance.find(a => a.date === dKey);
            if (!existing) {
              subObj.attendance.push({
                date: dKey,
                status: 'holiday',
                notes: holidayTitle
              });
            } else if (!existing.status || existing.status === 'not_marked') {
              existing.status = 'holiday';
              existing.notes = holidayTitle;
            }
          });
        }
      });

      const subjects = Array.from(finalSubjectsMap.values());

      return {
        id: sId,
        _id: s._id,
        rollNumber: s.rollNumber || '',
        name: `${s.fName || ''} ${s.lName || ''}`.trim(),
        fName: s.fName || '',
        lName: s.lName || '',
        fatherName: s.fatherOrguardian || s.parentOrGuardianName || s.fatherName || '',
        class: s.classId ? { id: s.classId._id?.toString(), _id: s.classId._id, name: s.classId.name } : null,
        section: s.sectionId ? { id: s.sectionId._id?.toString(), _id: s.sectionId._id, name: s.sectionId.name } : null,
        program: s.programId ? { id: s.programId._id?.toString(), _id: s.programId._id, name: s.programId.name } : null,
        subjects
      };
    });
  }

  // Missing Attendance Summary: Level 1 (Classes / Sections Grid)
  async getMissingAttendanceClassesSummary({ programId, date, sessionId }) {
    const targetDate = date ? String(date).split('T')[0] : new Date().toISOString().split('T')[0];

    const classQuery = (programId && programId !== '*' && programId !== 'all') ? { programId } : {};
    const classes = await Class.find(classQuery).populate('programId', 'name code').sort({ name: 1 });

    const classIds = classes.map(c => c._id);
    const sections = await Section.find({ classId: { $in: classIds } }).sort({ name: 1 });
    const sectionsByClass = new Map();
    sections.forEach(s => {
      const cId = String(s.classId);
      if (!sectionsByClass.has(cId)) sectionsByClass.set(cId, []);
      sectionsByClass.get(cId).push(s);
    });

    // Query active students count per class and section with optional sessionId
    const studentQuery = { classId: { $in: classIds }, status: { $in: ['ACTIVE', 'Active'] } };
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      studentQuery.$or = [{ sessionId }, { 'academicRecords.sessionId': sessionId }];
    }
    const allStudents = await Student.find(studentQuery, '_id classId sectionId');

    const studentsByClassSec = new Map();
    allStudents.forEach(s => {
      const cId = String(s.classId);
      const secId = s.sectionId ? String(s.sectionId) : 'none';
      const key = `${cId}__${secId}`;
      if (!studentsByClassSec.has(key)) studentsByClassSec.set(key, 0);
      studentsByClassSec.set(key, studentsByClassSec.get(key) + 1);

      const cKey = `${cId}__all`;
      if (!studentsByClassSec.has(cKey)) studentsByClassSec.set(cKey, 0);
      studentsByClassSec.set(cKey, studentsByClassSec.get(cKey) + 1);
    });

    // Query SubjectClassMappings for mapped subjects count
    const scmFilter = { classId: { $in: classIds } };
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      scmFilter.$or = [{ sessionId }, { sessionId: null }, { sessionId: { $exists: false } }];
    }
    const scms = await SubjectClassMapping.find(scmFilter);
    const scmByClass = new Map();
    scms.forEach(scm => {
      const cId = String(scm.classId);
      const sIds = (scm.subjects?.map(s => s.subjectId).filter(Boolean) || scm.subjectIds || []).map(String);
      if (!scmByClass.has(cId)) {
        scmByClass.set(cId, sIds);
      } else if (sessionId && scm.sessionId && String(scm.sessionId) === String(sessionId)) {
        scmByClass.set(cId, sIds);
      }
    });

    // Attendance records for date
    const dateRegex = new RegExp(`^${targetDate}`);
    const attRecords = await Attendance.find(
      { classId: { $in: classIds }, date: { $regex: dateRegex }, role: 'STUDENT' },
      '_id studentId classId sectionId subjectId'
    );

    // Approved leaves for date
    const studentIds = allStudents.map(s => s._id);
    const approvedLeaves = await Leave.find({
      studentId: { $in: studentIds },
      applicantType: 'STUDENT',
      status: { $regex: /^approved$/i },
      fromDate: { $lte: targetDate },
      toDate: { $gte: targetDate }
    }, 'studentId');
    const leaveStudentIds = new Set(approvedLeaves.map(l => String(l.studentId)));

    // Map marked student count per class/section/subject
    const markedMap = new Map();
    attRecords.forEach(r => {
      if (r.studentId && r.subjectId) {
        const cId = String(r.classId);
        const secId = r.sectionId ? String(r.sectionId) : 'none';
        const subId = String(r.subjectId);
        const k1 = `${cId}__${secId}__${subId}`;
        const k2 = `${cId}__all__${subId}`;
        if (!markedMap.has(k1)) markedMap.set(k1, new Set());
        markedMap.get(k1).add(String(r.studentId));
        if (!markedMap.has(k2)) markedMap.set(k2, new Set());
        markedMap.get(k2).add(String(r.studentId));
      }
    });

    const units = [];

    for (const c of classes) {
      const cId = String(c._id);
      const pName = c.programId?.name || '';
      const pCode = c.programId?.code || '';
      const pId = c.programId?._id || c.programId;
      const allowSections = c.allowSections !== false;
      const classSecs = sectionsByClass.get(cId) || [];
      const subjectIds = scmByClass.get(cId) || [];
      const totalSubjects = subjectIds.length;

      if (allowSections && classSecs.length > 0) {
        for (const sec of classSecs) {
          const secId = String(sec._id);
          const totalStudents = studentsByClassSec.get(`${cId}__${secId}`) || 0;

          if (totalStudents === 0) {
            units.push({
              classId: c._id,
              className: c.name,
              sectionId: sec._id,
              sectionName: sec.name,
              programId: pId,
              programName: pName,
              programCode: pCode,
              displayName: `${pName ? pName + ' - ' : ''}${c.name} - ${sec.name}`,
              totalStudents: 0,
              totalSubjects,
              markedSubjects: 0,
              missingSubjects: 0,
              status: 'NO_STUDENTS',
              isComplete: false,
              isMissing: false,
              isNoStudents: true
            });
            continue;
          }

          if (totalSubjects === 0) {
            units.push({
              classId: c._id,
              className: c.name,
              sectionId: sec._id,
              sectionName: sec.name,
              programId: pId,
              programName: pName,
              programCode: pCode,
              displayName: `${pName ? pName + ' - ' : ''}${c.name} - ${sec.name}`,
              totalStudents,
              totalSubjects: 0,
              markedSubjects: 0,
              missingSubjects: 0,
              status: 'NO_SUBJECTS',
              isComplete: false,
              isMissing: false,
              isNoStudents: false
            });
            continue;
          }

          let markedSubjectsCount = 0;
          let missingSubjectsCount = 0;

          for (const subId of subjectIds) {
            const markedSet = markedMap.get(`${cId}__${secId}__${subId}`) || new Set();
            let markedCount = markedSet.size;
            leaveStudentIds.forEach(lId => {
              if (!markedSet.has(lId)) markedCount++;
            });

            if (markedCount >= totalStudents) {
              markedSubjectsCount++;
            } else {
              missingSubjectsCount++;
            }
          }

          const isComplete = totalSubjects > 0 && missingSubjectsCount === 0;

          units.push({
            classId: c._id,
            className: c.name,
            sectionId: sec._id,
            sectionName: sec.name,
            programId: pId,
            programName: pName,
            programCode: pCode,
            displayName: `${pName ? pName + ' - ' : ''}${c.name} - ${sec.name}`,
            totalStudents,
            totalSubjects,
            markedSubjects: markedSubjectsCount,
            missingSubjects: missingSubjectsCount,
            status: isComplete ? 'COMPLETE' : 'MISSING',
            isComplete,
            isMissing: !isComplete,
            isNoStudents: false
          });
        }
      } else {
        const totalStudents = studentsByClassSec.get(`${cId}__all`) || 0;

        if (totalStudents === 0) {
          units.push({
            classId: c._id,
            className: c.name,
            sectionId: null,
            sectionName: null,
            programId: pId,
            programName: pName,
            programCode: pCode,
            displayName: `${pName ? pName + ' - ' : ''}${c.name}`,
            totalStudents: 0,
            totalSubjects,
            markedSubjects: 0,
            missingSubjects: 0,
            status: 'NO_STUDENTS',
            isComplete: false,
            isMissing: false,
            isNoStudents: true
          });
          continue;
        }

        if (totalSubjects === 0) {
          units.push({
            classId: c._id,
            className: c.name,
            sectionId: null,
            sectionName: null,
            programId: pId,
            programName: pName,
            programCode: pCode,
            displayName: `${pName ? pName + ' - ' : ''}${c.name}`,
            totalStudents,
            totalSubjects: 0,
            markedSubjects: 0,
            missingSubjects: 0,
            status: 'NO_SUBJECTS',
            isComplete: false,
            isMissing: false,
            isNoStudents: false
          });
          continue;
        }

        let markedSubjectsCount = 0;
        let missingSubjectsCount = 0;

        for (const subId of subjectIds) {
          const markedSet = markedMap.get(`${cId}__all__${subId}`) || new Set();
          let markedCount = markedSet.size;
          leaveStudentIds.forEach(lId => {
            if (!markedSet.has(lId)) markedCount++;
          });

          if (markedCount >= totalStudents) {
            markedSubjectsCount++;
          } else {
            missingSubjectsCount++;
          }
        }

        const isComplete = totalSubjects > 0 && missingSubjectsCount === 0;

        units.push({
          classId: c._id,
          className: c.name,
          sectionId: null,
          sectionName: null,
          programId: pId,
          programName: pName,
          programCode: pCode,
          displayName: `${pName ? pName + ' - ' : ''}${c.name}`,
          totalStudents,
          totalSubjects,
          markedSubjects: markedSubjectsCount,
          missingSubjects: missingSubjectsCount,
          status: isComplete ? 'COMPLETE' : 'MISSING',
          isComplete,
          isMissing: !isComplete,
          isNoStudents: false
        });
      }
    }

    const activeUnits = units.filter(u => u.status !== 'NO_STUDENTS' && u.status !== 'NO_SUBJECTS');
    const completeCount = activeUnits.filter(u => u.isComplete).length;
    const missingCount = activeUnits.filter(u => u.isMissing).length;
    const noStudentsCount = units.filter(u => u.isNoStudents).length;

    return {
      date: targetDate,
      summary: {
        totalUnits: units.length,
        completeUnits: completeCount,
        missingUnits: missingCount,
        noStudentsUnits: noStudentsCount,
      },
      units
    };
  }

  // Missing Attendance Summary: Level 2 (Subject-wise Grid)
  async getMissingAttendanceSubjectsSummary({ classId, sectionId, date, sessionId }) {
    const targetDate = date ? String(date).split('T')[0] : new Date().toISOString().split('T')[0];
    const classDoc = await Class.findById(classId).populate('programId', 'name code');
    if (!classDoc) {
      throw new Error('Class not found');
    }

    let sectionDoc = null;
    const allowSections = classDoc.allowSections !== false;
    const effectiveSectionId = allowSections && sectionId && sectionId !== '*' && sectionId !== 'all' ? sectionId : null;
    if (effectiveSectionId) {
      sectionDoc = await Section.findById(effectiveSectionId);
    }

    // Active students count for class/section
    const studentQuery = { classId, status: { $in: ['ACTIVE', 'Active'] } };
    if (effectiveSectionId) {
      studentQuery.sectionId = effectiveSectionId;
    }
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      studentQuery.$or = [{ sessionId }, { 'academicRecords.sessionId': sessionId }];
    }
    const students = await Student.find(studentQuery, '_id');
    const totalStudents = students.length;
    const studentIds = students.map(s => s._id);

    // Linked subjects via SubjectClassMapping
    const scmFilter = { classId };
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      scmFilter.$or = [{ sessionId }, { sessionId: null }, { sessionId: { $exists: false } }];
    }
    const scm = await SubjectClassMapping.findOne(scmFilter)
      .populate('subjects.subjectId')
      .populate('subjectIds');

    const subjectsList = [];
    if (scm && Array.isArray(scm.subjects) && scm.subjects.length > 0) {
      for (const entry of scm.subjects) {
        const sub = entry.subjectId;
        if (!sub) continue;
        const subId = String(sub._id || sub.id || sub);
        subjectsList.push({
          id: subId,
          name: typeof sub === 'object' && sub.name ? sub.name : '',
          code: typeof sub === 'object' && sub.code ? sub.code : '',
          creditHours: entry.creditHours ?? null
        });
      }
    } else if (scm && Array.isArray(scm.subjectIds) && scm.subjectIds.length > 0) {
      for (const sub of scm.subjectIds) {
        if (!sub) continue;
        const subId = String(sub._id || sub.id || sub);
        subjectsList.push({
          id: subId,
          name: typeof sub === 'object' && sub.name ? sub.name : '',
          code: typeof sub === 'object' && sub.code ? sub.code : '',
          creditHours: null
        });
      }
    }

    // Fill missing subject names from Subject collection
    const missingNameIds = subjectsList.filter(s => !s.name).map(s => s.id);
    if (missingNameIds.length > 0) {
      const dbSubjects = await Subject.find({ _id: { $in: missingNameIds } });
      const subMap = new Map(dbSubjects.map(s => [String(s._id), s]));
      subjectsList.forEach(s => {
        if (!s.name && subMap.has(s.id)) {
          const found = subMap.get(s.id);
          s.name = found.name || '';
          s.code = found.code || s.code || '';
        }
      });
    }

    // Pre-fetch TeacherMappings for this class and section
    const tmConditions = [{ classId }];
    if (effectiveSectionId) {
      tmConditions.push({ $or: [{ sectionId: effectiveSectionId }, { sectionId: null }, { sectionId: { $exists: false } }] });
    }
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      tmConditions.push({ $or: [{ sessionId }, { sessionId: null }, { sessionId: { $exists: false } }] });
    }
    const teacherMappings = await TeacherMapping.find({ $and: tmConditions }).populate('teacherId', 'name staffId');

    // Pre-fetch attendance for date
    const dateRegex = new RegExp(`^${targetDate}`);
    const attQuery = {
      classId,
      date: { $regex: dateRegex },
      role: 'STUDENT',
      studentId: { $in: studentIds }
    };
    if (effectiveSectionId) attQuery.sectionId = effectiveSectionId;
    const attendanceRecords = await Attendance.find(attQuery, '_id studentId subjectId');

    // Approved leaves for date
    const approvedLeaves = await Leave.find({
      studentId: { $in: studentIds },
      applicantType: 'STUDENT',
      status: { $regex: /^approved$/i },
      fromDate: { $lte: targetDate },
      toDate: { $gte: targetDate }
    }, 'studentId');
    const leaveStudentIds = new Set(approvedLeaves.map(l => String(l.studentId)));

    const subjects = subjectsList.map(sub => {
      const subId = String(sub.id);

      // PIN-POINT ACCURATE TEACHER FOR THIS EXACT SUBJECT
      const subjectTeachers = teacherMappings
        .filter(tm => tm.mappingType === 'SUBJECT' && String(tm.subjectId?._id || tm.subjectId) === subId && tm.teacherId?.name)
        .map(tm => tm.teacherId.name);

      const teacherName = subjectTeachers.length > 0 ? subjectTeachers.join(', ') : 'Not Assigned';

      if (totalStudents === 0) {
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          creditHours: sub.creditHours,
          teacherName,
          totalStudents: 0,
          markedStudents: 0,
          missingStudents: 0,
          status: 'NO_STUDENTS',
          isComplete: false,
          isNoStudents: true
        };
      }

      const subAttRecords = attendanceRecords.filter(r => String(r.subjectId) === subId);
      const markedStudentIds = new Set(subAttRecords.map(r => String(r.studentId)));
      leaveStudentIds.forEach(id => markedStudentIds.add(id));

      const markedStudents = Math.min(totalStudents, markedStudentIds.size);
      const missingStudents = Math.max(0, totalStudents - markedStudents);
      const isComplete = markedStudents >= totalStudents;

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        creditHours: sub.creditHours,
        teacherName,
        totalStudents,
        markedStudents,
        missingStudents,
        status: isComplete ? 'COMPLETE' : 'MISSING',
        isComplete,
        isNoStudents: false
      };
    });

    const isNoStudents = totalStudents === 0;
    const completeCount = subjects.filter(s => s.isComplete).length;
    const missingCount = subjects.filter(s => !s.isComplete && !s.isNoStudents).length;

    return {
      class: { id: classDoc._id, name: classDoc.name },
      section: sectionDoc ? { id: sectionDoc._id, name: sectionDoc.name } : null,
      program: classDoc.programId ? { id: classDoc.programId._id, name: classDoc.programId.name, code: classDoc.programId.code } : null,
      date: targetDate,
      totalStudents,
      isNoStudents,
      summary: {
        totalSubjects: subjects.length,
        completeSubjects: isNoStudents ? 0 : completeCount,
        missingSubjects: isNoStudents ? 0 : missingCount,
        noStudentsSubjects: isNoStudents ? subjects.length : 0,
      },
      subjects
    };
  }

  // Missing Attendance Summary: Level 3 (Student Attendance Table)
  async getMissingAttendanceStudentsSummary({ classId, sectionId, subjectId, date, sessionId }) {
    const targetDate = date ? String(date).split('T')[0] : new Date().toISOString().split('T')[0];
    const classDoc = await Class.findById(classId).populate('programId', 'name code');
    if (!classDoc) {
      throw new Error('Class not found');
    }

    let sectionDoc = null;
    const allowSections = classDoc.allowSections !== false;
    const effectiveSectionId = allowSections && sectionId && sectionId !== '*' && sectionId !== 'all' ? sectionId : null;
    if (effectiveSectionId) {
      sectionDoc = await Section.findById(effectiveSectionId);
    }

    const subjectDoc = await Subject.findById(subjectId);
    if (!subjectDoc) {
      throw new Error('Subject not found');
    }

    // Active students in this class/section
    const studentQuery = { classId, status: { $in: ['ACTIVE', 'Active'] } };
    if (effectiveSectionId) {
      studentQuery.sectionId = effectiveSectionId;
    }
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      studentQuery.$or = [{ sessionId }, { 'academicRecords.sessionId': sessionId }];
    }
    const students = await Student.find(studentQuery).sort({ rollNumber: 1 });
    const studentIds = students.map(s => s._id);

    // Attendance query with regex date
    const dateRegex = new RegExp(`^${targetDate}`);
    const attQuery = {
      classId,
      subjectId,
      date: { $regex: dateRegex },
      role: 'STUDENT',
      studentId: { $in: studentIds }
    };
    if (effectiveSectionId) {
      attQuery.sectionId = effectiveSectionId;
    }
    const attendanceRecords = await Attendance.find(attQuery)
      .populate('markedBy', 'name email refId')
      .populate('markedByStaffId', 'name staffId')
      .populate('staffId', 'name staffId');

    const attMap = new Map();
    attendanceRecords.forEach(r => attMap.set(String(r.studentId), r));

    // Leaves query
    const approvedLeaves = await Leave.find({
      studentId: { $in: studentIds },
      applicantType: 'STUDENT',
      status: { $regex: /^approved$/i },
      fromDate: { $lte: targetDate },
      toDate: { $gte: targetDate }
    });
    const leaveMap = new Map();
    approvedLeaves.forEach(l => leaveMap.set(String(l.studentId), l));

    // Lookup responsible teacher for this subject
    const tmConditions = [{ classId, mappingType: 'SUBJECT', subjectId }];
    if (effectiveSectionId) {
      tmConditions.push({ $or: [{ sectionId: effectiveSectionId }, { sectionId: null }, { sectionId: { $exists: false } }] });
    }
    const subjectTeacherMappings = await TeacherMapping.find({ $and: tmConditions }).populate('teacherId', 'name');
    const assignedTeacherName = (subjectTeacherMappings.length > 0 && subjectTeacherMappings[0].teacherId?.name)
      ? subjectTeacherMappings.map(t => t.teacherId.name).filter(Boolean).join(', ')
      : 'Not Assigned';

    const studentRows = students.map(s => {
      const sId = String(s._id);
      const rec = attMap.get(sId);
      const leave = leaveMap.get(sId);

      if (rec) {
        let markedByName = 'Not Recorded';
        if (rec.markedByStaffId?.name) {
          markedByName = rec.markedByStaffId.name;
        } else if (rec.staffId?.name) {
          markedByName = rec.staffId.name;
        } else if (rec.markedBy?.name) {
          markedByName = rec.markedBy.name;
        } else if (assignedTeacherName !== 'Not Assigned') {
          markedByName = assignedTeacherName;
        }

        return {
          studentId: s._id,
          rollNumber: s.rollNumber || '',
          studentName: `${s.fName || ''} ${s.lName || ''}`.trim(),
          fatherName: s.fatherOrguardian || s.parentOrGuardianName || '',
          gender: s.gender,
          status: rec.status,
          isMissing: false,
          markedAt: rec.markedAt || rec.createdAt,
          markedByName,
          notes: rec.notes || ''
        };
      } else if (leave) {
        return {
          studentId: s._id,
          rollNumber: s.rollNumber || '',
          studentName: `${s.fName || ''} ${s.lName || ''}`.trim(),
          fatherName: s.fatherOrguardian || s.parentOrGuardianName || '',
          gender: s.gender,
          status: 'LEAVE',
          isMissing: false,
          markedAt: null,
          markedByName: 'Approved Leave',
          notes: leave.reason || 'Approved Leave'
        };
      } else {
        return {
          studentId: s._id,
          rollNumber: s.rollNumber || '',
          studentName: `${s.fName || ''} ${s.lName || ''}`.trim(),
          fatherName: s.fatherOrguardian || s.parentOrGuardianName || '',
          gender: s.gender,
          status: 'MISSING',
          isMissing: true,
          markedAt: null,
          markedByName: '—',
          notes: 'Attendance not recorded'
        };
      }
    });

    const totalStudents = students.length;
    const markedCount = studentRows.filter(s => !s.isMissing).length;
    const missingCount = studentRows.filter(s => s.isMissing).length;
    const presentCount = studentRows.filter(s => String(s.status).toUpperCase() === 'PRESENT').length;
    const absentCount = studentRows.filter(s => String(s.status).toUpperCase() === 'ABSENT').length;
    const leaveCount = studentRows.filter(s => String(s.status).toUpperCase() === 'LEAVE').length;

    return {
      class: { id: classDoc._id, name: classDoc.name },
      section: sectionDoc ? { id: sectionDoc._id, name: sectionDoc.name } : null,
      program: classDoc.programId ? { id: classDoc.programId._id, name: classDoc.programId.name, code: classDoc.programId.code } : null,
      subject: { id: subjectDoc._id, name: subjectDoc.name, code: subjectDoc.code },
      assignedTeacher: assignedTeacherName,
      date: targetDate,
      summary: {
        totalStudents,
        markedCount,
        missingCount,
        presentCount,
        absentCount,
        leaveCount
      },
      students: studentRows
    };
  }

  // Missing Attendance Summary: Export / Print Report
  async getMissingAttendanceExportReport({ programId, classId, sectionId, date, sessionId }) {
    const targetDate = date ? String(date).split('T')[0] : new Date().toISOString().split('T')[0];

    // Determine session label
    let sessionName = 'All Sessions';
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      try {
        const sesDoc = await AcademicSession.findById(sessionId).select('name').lean();
        if (sesDoc?.name) sessionName = sesDoc.name;
      } catch (e) {}
    }

    // Determine program label
    let programFilterLabel = 'All Programs';
    if (programId && programId !== '*' && programId !== 'all') {
      try {
        const pDoc = await Program.findById(programId).select('name').lean();
        if (pDoc?.name) programFilterLabel = pDoc.name;
      } catch (e) {}
    }

    // Determine which classes to query
    const classQuery = {};
    if (classId && classId !== '*' && classId !== 'all') {
      classQuery._id = classId;
    } else if (programId && programId !== '*' && programId !== 'all') {
      classQuery.programId = programId;
    }

    const classes = await Class.find(classQuery).populate('programId', 'name code').sort({ name: 1 });
    const classIds = classes.map(c => c._id);

    // Fetch all sections for these classes
    const sectionQuery = { classId: { $in: classIds } };
    if (sectionId && sectionId !== '*' && sectionId !== 'all') {
      sectionQuery._id = sectionId;
    }
    const allSections = await Section.find(sectionQuery).sort({ name: 1 });
    const sectionsByClass = new Map();
    allSections.forEach(s => {
      const cId = String(s.classId);
      if (!sectionsByClass.has(cId)) sectionsByClass.set(cId, []);
      sectionsByClass.get(cId).push(s);
    });

    // Query active students
    const studentQuery = { classId: { $in: classIds }, status: { $in: ['ACTIVE', 'Active'] } };
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      studentQuery.$or = [{ sessionId }, { 'academicRecords.sessionId': sessionId }];
    }
    const allStudents = await Student.find(studentQuery, '_id classId sectionId');
    const allStudentIds = allStudents.map(s => s._id);

    // Group students by class and section
    const studentsByClassSec = new Map();
    allStudents.forEach(s => {
      const cId = String(s.classId);
      const sId = s.sectionId ? String(s.sectionId) : 'none';
      const key = `${cId}__${sId}`;
      if (!studentsByClassSec.has(key)) studentsByClassSec.set(key, []);
      studentsByClassSec.get(key).push(String(s._id));

      const allKey = `${cId}__all`;
      if (!studentsByClassSec.has(allKey)) studentsByClassSec.set(allKey, []);
      studentsByClassSec.get(allKey).push(String(s._id));
    });

    // Query SubjectClassMappings for mapped subjects
    const scmFilter = { classId: { $in: classIds } };
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      scmFilter.$or = [{ sessionId }, { sessionId: null }, { sessionId: { $exists: false } }];
    }
    const scms = await SubjectClassMapping.find(scmFilter).populate('subjects.subjectId').populate('subjectIds');

    // Extract subjects per class
    const subjectsByClass = new Map();
    const allSubjectIds = new Set();
    scms.forEach(scm => {
      const cId = String(scm.classId);
      const list = [];
      if (Array.isArray(scm.subjects) && scm.subjects.length > 0) {
        scm.subjects.forEach(entry => {
          const sub = entry.subjectId;
          if (sub) {
            const sId = String(sub._id || sub.id || sub);
            allSubjectIds.add(sId);
            list.push({
              id: sId,
              name: typeof sub === 'object' && sub.name ? sub.name : '',
              code: typeof sub === 'object' && sub.code ? sub.code : '',
            });
          }
        });
      } else if (Array.isArray(scm.subjectIds) && scm.subjectIds.length > 0) {
        scm.subjectIds.forEach(sub => {
          if (sub) {
            const sId = String(sub._id || sub.id || sub);
            allSubjectIds.add(sId);
            list.push({
              id: sId,
              name: typeof sub === 'object' && sub.name ? sub.name : '',
              code: typeof sub === 'object' && sub.code ? sub.code : '',
            });
          }
        });
      }
      if (!subjectsByClass.has(cId) || (sessionId && scm.sessionId && String(scm.sessionId) === String(sessionId))) {
        subjectsByClass.set(cId, list);
      }
    });

    // Resolve any missing subject names from Subject collection
    if (allSubjectIds.size > 0) {
      const dbSubjects = await Subject.find({ _id: { $in: Array.from(allSubjectIds) } }).lean();
      const subMap = new Map(dbSubjects.map(s => [String(s._id), s]));
      subjectsByClass.forEach(list => {
        list.forEach(s => {
          if (!s.name && subMap.has(s.id)) {
            const found = subMap.get(s.id);
            s.name = found.name || '';
            s.code = found.code || s.code || '';
          }
        });
      });
    }

    // Query TeacherMappings
    const tmConditions = [{ classId: { $in: classIds }, mappingType: 'SUBJECT' }];
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      tmConditions.push({ $or: [{ sessionId }, { sessionId: null }, { sessionId: { $exists: false } }] });
    }
    const teacherMappings = await TeacherMapping.find({ $and: tmConditions }).populate('teacherId', 'name staffId');

    // Query attendance records for date
    const dateRegex = new RegExp(`^${targetDate}`);
    const attRecords = await Attendance.find({
      classId: { $in: classIds },
      date: { $regex: dateRegex },
      role: 'STUDENT',
      studentId: { $in: allStudentIds }
    }, '_id studentId classId sectionId subjectId status');

    // Query approved leaves for date
    const approvedLeaves = await Leave.find({
      studentId: { $in: allStudentIds },
      applicantType: 'STUDENT',
      status: { $regex: /^approved$/i },
      fromDate: { $lte: targetDate },
      toDate: { $gte: targetDate }
    }, 'studentId');
    const leaveStudentIds = new Set(approvedLeaves.map(l => String(l.studentId)));

    // Index attendance records by `${classId}__${sectionId || 'none'}__${subjectId}`
    // and also `${classId}__all__${subjectId}`
    const attMap = new Map();
    attRecords.forEach(r => {
      const cId = String(r.classId);
      const secId = r.sectionId ? String(r.sectionId) : 'none';
      const subId = String(r.subjectId);
      const stId = String(r.studentId);
      const status = String(r.status || '').toUpperCase();

      const k1 = `${cId}__${secId}__${subId}`;
      const k2 = `${cId}__all__${subId}`;

      [k1, k2].forEach(k => {
        if (!attMap.has(k)) attMap.set(k, []);
        attMap.get(k).push({ studentId: stId, status });
      });
    });

    const rows = [];

    // Helper to resolve teacher name for class, section, subject
    const getTeacherName = (cId, secId, subId) => {
      // 1. Try exact section match
      if (secId) {
        const secMatch = teacherMappings.filter(tm =>
          String(tm.classId) === cId &&
          String(tm.sectionId?._id || tm.sectionId) === secId &&
          String(tm.subjectId?._id || tm.subjectId) === subId &&
          tm.teacherId?.name
        );
        if (secMatch.length > 0) return secMatch.map(t => t.teacherId.name).join(', ');
      }

      // 2. Class-wide match
      const classMatch = teacherMappings.filter(tm =>
        String(tm.classId) === cId &&
        (!tm.sectionId || String(tm.sectionId) === 'null') &&
        String(tm.subjectId?._id || tm.subjectId) === subId &&
        tm.teacherId?.name
      );
      if (classMatch.length > 0) return classMatch.map(t => t.teacherId.name).join(', ');

      return 'Not Assigned';
    };

    // Iterate through classes and their units (sections or whole class)
    for (const c of classes) {
      const cId = String(c._id);
      const progName = c.programId?.name || programFilterLabel || 'General Program';
      const className = c.name;
      const classSections = sectionsByClass.get(cId) || [];
      const hasSections = c.allowSections !== false && classSections.length > 0;
      const subjects = subjectsByClass.get(cId) || [];

      // Determine units for this class
      const units = [];
      if (hasSections) {
        classSections.forEach(sec => {
          units.push({
            sectionId: String(sec._id),
            sectionName: sec.name,
            key: `${cId}__${String(sec._id)}`
          });
        });
      } else {
        units.push({
          sectionId: null,
          sectionName: '',
          key: `${cId}__none`
        });
      }

      for (const unit of units) {
        const secId = unit.sectionId;
        const secName = unit.sectionName;
        const studentIdList = (hasSections ? studentsByClassSec.get(unit.key) : (studentsByClassSec.get(unit.key) || studentsByClassSec.get(`${cId}__all`))) || [];
        const studentIdSet = new Set(studentIdList);
        const totalStudents = studentIdList.length;

        for (const sub of subjects) {
          const subId = String(sub.id);
          const teacherName = getTeacherName(cId, secId, subId);

          if (totalStudents === 0) {
            rows.push({
              programName: progName,
              className,
              sectionName: secName,
              subjectName: sub.name || 'Subject',
              subjectCode: sub.code || '',
              responsibleTeacher: teacherName,
              unmarkedCount: 0,
              presentCount: 0,
              leaveCount: 0,
              absentCount: 0,
              totalStudents: 0
            });
            continue;
          }

          const k = secId ? `${cId}__${secId}__${subId}` : `${cId}__all__${subId}`;
          const records = (attMap.get(k) || []).filter(r => studentIdSet.has(r.studentId));

          const markedIds = new Set();
          let presentCount = 0;
          let absentCount = 0;
          let leaveCount = 0;

          records.forEach(r => {
            markedIds.add(r.studentId);
            if (['PRESENT', 'LATE', 'HALF_DAY', 'HD'].includes(r.status)) {
              presentCount++;
            } else if (r.status === 'ABSENT') {
              absentCount++;
            } else if (r.status === 'LEAVE') {
              leaveCount++;
            }
          });

          // Add approved leaves for students without attendance record
          studentIdList.forEach(stId => {
            if (!markedIds.has(stId) && leaveStudentIds.has(stId)) {
              markedIds.add(stId);
              leaveCount++;
            }
          });

          const unmarkedCount = Math.max(0, totalStudents - markedIds.size);

          rows.push({
            programName: progName,
            className,
            sectionName: secName,
            subjectName: sub.name || 'Subject',
            subjectCode: sub.code || '',
            responsibleTeacher: teacherName,
            unmarkedCount,
            presentCount,
            leaveCount,
            absentCount,
            totalStudents
          });
        }
      }
    }

    // Compute totals
    const totals = {
      totalSubjects: rows.length,
      totalStudents: rows.reduce((sum, r) => sum + r.totalStudents, 0),
      unmarkedCount: rows.reduce((sum, r) => sum + r.unmarkedCount, 0),
      presentCount: rows.reduce((sum, r) => sum + r.presentCount, 0),
      leaveCount: rows.reduce((sum, r) => sum + r.leaveCount, 0),
      absentCount: rows.reduce((sum, r) => sum + r.absentCount, 0),
    };

    return {
      date: targetDate,
      programName: programFilterLabel,
      sessionName,
      rows,
      totals
    };
  }
}

module.exports = new AttendanceService();
