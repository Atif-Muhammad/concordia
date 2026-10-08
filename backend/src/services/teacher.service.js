const mongoose = require('mongoose');
const { Staff, TeacherMapping, Subject, Class, Section, Student, Attendance, Holiday, AttendanceSkip } = require('../models');

const isValidObjectId = (val) => {
  return val && val !== 'undefined' && val !== 'null' && val !== 'all' && mongoose.Types.ObjectId.isValid(val);
};

class TeacherService {
  async getTeachers() {
    return Staff.find({ isTeaching: true }).populate('departmentId').sort({ name: 1 });
  }

  async getTeacherNames() {
    return Staff.find({ isTeaching: true }).select('name staffId').sort({ name: 1 });
  }

  async getTeacherSubjects(teacherIds, classId) {
    let filter = { mappingType: 'SUBJECT' };
    if (teacherIds && teacherIds.length > 0) {
      if (Array.isArray(teacherIds)) {
        filter.teacherId = { $in: teacherIds };
      } else {
        filter.teacherId = teacherIds;
      }
    }
    if (classId) {
      filter.classId = classId;
    }

    const mappings = await TeacherMapping.find(filter)
      .populate('subjectId')
      .populate({
        path: 'classId',
        populate: { path: 'programId' },
      })
      .populate('sectionId')
      .populate('sessionId')
      .populate('teacherId')
      .sort({ createdAt: -1 })
      .lean();

    return mappings.map((m) => {
      const prog = m.classId?.programId || null;
      return {
        ...m,
        id: m._id ? m._id.toString() : undefined,
        class: m.classId,
        section: m.sectionId,
        subject: m.subjectId,
        program: prog,
        programId: prog,
      };
    });
  }

  async getTeacherClasses(teacherIds) {
    let filter = {};
    if (teacherIds && teacherIds.length > 0) {
      if (Array.isArray(teacherIds)) {
        filter.teacherId = { $in: teacherIds };
      } else {
        filter.teacherId = teacherIds;
      }
    }

    const mappings = await TeacherMapping.find(filter)
      .populate({
        path: 'classId',
        populate: { path: 'programId' },
      })
      .populate('sectionId')
      .populate('subjectId')
      .populate('sessionId')
      .populate('teacherId')
      .sort({ createdAt: -1 })
      .lean();

    const groupedMap = new Map();

    for (const m of mappings) {
      if (!m.classId) continue;
      const cId = m.classId._id ? m.classId._id.toString() : m.classId.toString();
      const sId = m.sectionId
        ? (m.sectionId._id ? m.sectionId._id.toString() : m.sectionId.toString())
        : 'none';
      const key = `${cId}__${sId}`;

      const programObj = m.classId.programId || null;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          _id: m._id,
          id: m._id.toString(),
          classId: m.classId,
          class: m.classId,
          sectionId: m.sectionId || null,
          section: m.sectionId || null,
          programId: programObj,
          program: programObj,
          sessionId: m.sessionId || null,
          session: m.sessionId || null,
          teacherId: m.teacherId,
          subjects: [],
          subjectIds: [],
          subject: null,
          mappingType: m.mappingType || 'CLASS',
        });
      }

      const entry = groupedMap.get(key);
      if (m.subjectId) {
        const subIdStr = (m.subjectId._id || m.subjectId).toString();
        if (!entry.subjectIds.includes(subIdStr)) {
          entry.subjectIds.push(subIdStr);
          entry.subjects.push(m.subjectId);
          if (!entry.subject) entry.subject = m.subjectId;
        }
      }
    }

    return Array.from(groupedMap.values());
  }

  async getClassStudentsAttendance({ classId, sectionId, subjectId, date }) {
    const studentQuery = {};
    if (isValidObjectId(classId)) studentQuery.classId = classId;
    if (isValidObjectId(sectionId)) studentQuery.sectionId = sectionId;

    const students = await Student.find(studentQuery).sort({ rollNumber: 1 });

    // Check if the date is an official holiday or attendance skip
    const isHoliday = await Holiday.findOne({
      $or: [
        { date },
        { $and: [{ date: { $lte: date } }, { endDate: { $gte: date } }] }
      ]
    });

    let isSkip = null;
    if (isValidObjectId(classId)) {
      const skipQuery = {
        date,
        classId,
        ...(isValidObjectId(sectionId)
          ? { $or: [{ sectionId }, { sectionId: null }, { sectionId: { $exists: false } }] }
          : {})
      };
      isSkip = await AttendanceSkip.findOne(skipQuery);
    }

    const holidayInfo = isHoliday
      ? { isHoliday: true, title: isHoliday.title || 'Official Holiday', type: isHoliday.type || 'National' }
      : isSkip
      ? { isHoliday: true, title: isSkip.reason || 'Class Holiday', type: 'Class Attendance Skip' }
      : null;

    const attendanceQuery = { date };
    if (isValidObjectId(classId)) attendanceQuery.classId = classId;
    if (isValidObjectId(sectionId)) attendanceQuery.sectionId = sectionId;
    if (isValidObjectId(subjectId)) attendanceQuery.subjectId = subjectId;

    const attendanceRecords = await Attendance.find(attendanceQuery);

    const recordMap = new Map();
    attendanceRecords.forEach(r => recordMap.set(String(r.studentId), r));

    return students.map(s => {
      const rec = recordMap.get(String(s.id || s._id));
      const defaultStatus = holidayInfo ? 'HOLIDAY' : 'PRESENT';
      return {
        student: s,
        status: rec ? rec.status : defaultStatus,
        attendanceId: rec ? (rec.id || rec._id) : undefined,
        notes: rec ? rec.notes : (holidayInfo ? holidayInfo.title : ''),
        isHoliday: !!holidayInfo,
        holidayTitle: holidayInfo ? holidayInfo.title : undefined,
        holidayType: holidayInfo ? holidayInfo.type : undefined,
      };
    });
  }

  async updateClassStudentsAttendance(data) {
    const { classId, sectionId, subjectId, date } = data;

    // Reject marking attendance on holidays or attendance skips
    const isHoliday = await Holiday.findOne({
      $or: [
        { date },
        { $and: [{ date: { $lte: date } }, { endDate: { $gte: date } }] }
      ]
    });
    if (isHoliday) {
      const err = new Error(`Cannot mark attendance: ${date} is an official holiday (${isHoliday.title || 'Holiday'}).`);
      err.statusCode = 400;
      throw err;
    }

    if (isValidObjectId(classId)) {
      const skipQuery = {
        date,
        classId,
        ...(isValidObjectId(sectionId)
          ? { $or: [{ sectionId }, { sectionId: null }, { sectionId: { $exists: false } }] }
          : {})
      };
      const isSkip = await AttendanceSkip.findOne(skipQuery);
      if (isSkip) {
        const err = new Error(`Cannot mark attendance: ${date} is marked as an attendance skip (${isSkip.reason || 'Class Holiday'}).`);
        err.statusCode = 400;
        throw err;
      }
    }

    const rows = data.rows || data.attendanceRecords || [];
    const operations = (rows || []).map(row => {
      const query = {
        studentId: row.studentId,
        date,
        role: 'STUDENT',
        ...(isValidObjectId(classId) ? { classId } : {}),
        ...(isValidObjectId(sectionId) ? { sectionId } : {}),
        ...(isValidObjectId(subjectId) ? { subjectId } : {})
      };
      return Attendance.findOneAndUpdate(
        query,
        { ...query, status: (row.status || 'PRESENT').toUpperCase(), notes: row.notes, markedAt: new Date() },
        { upsert: true, returnDocument: 'after' }
      );
    });
    return Promise.all(operations);
  }

  // --- Leaves ---
  async getMyLeaves(teacherIds) {
    const { Leave } = require('../models');
    const filter = { applicantType: 'STAFF' };
    if (teacherIds && teacherIds.length > 0) {
      filter.staffId = { $in: teacherIds };
    }
    const leaves = await Leave.find(filter)
      .populate({
        path: 'staffId',
        populate: { path: 'departmentId' }
      })
      .sort({ createdAt: -1 })
      .lean();

    return leaves.map((l) => ({
      ...l,
      id: l._id ? l._id.toString() : l.id,
      leaveId: l._id ? l._id.toString() : l.id,
      startDate: l.fromDate,
      endDate: l.toDate,
      type: l.leaveType || 'CASUAL',
      status: l.status || 'PENDING',
      actionAudit: l.actionAudit || []
    }));
  }

  async applyLeave(data, user, primaryStaffId) {
    const hrService = require('./hr.service');
    const staffId = primaryStaffId || data.staffId || user?.refId;
    if (!staffId) {
      const err = new Error('Staff record not identified for logged in user');
      err.statusCode = 400;
      throw err;
    }

    const startDate = data.startDate || data.fromDate;
    const endDate = data.endDate || data.toDate || startDate;
    let days = Number(data.days);
    if (!days || isNaN(days)) {
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        days = Math.max(1, Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1);
      } else {
        days = 1;
      }
    }

    const payload = {
      staffId,
      startDate,
      endDate,
      days,
      month: data.month || (startDate ? startDate.slice(0, 7) : undefined),
      reason: data.reason || '',
      status: 'PENDING',
      leaveType: String(data.type || data.leaveType || 'CASUAL').toUpperCase()
    };

    return hrService.upsertLeave(payload, user);
  }

  async cancelLeave(leaveId, teacherIds) {
    const { Leave } = require('../models');
    const hrService = require('./hr.service');
    const leave = await Leave.findOne({
      _id: leaveId,
      applicantType: 'STAFF',
      staffId: { $in: teacherIds }
    });
    if (!leave) {
      const err = new Error('Leave application not found');
      err.statusCode = 404;
      throw err;
    }
    if (String(leave.status).toUpperCase() !== 'PENDING') {
      const err = new Error(`Cannot cancel a leave application that has already been ${leave.status.toLowerCase()}`);
      err.statusCode = 400;
      throw err;
    }
    return hrService.deleteStaffLeave(leaveId);
  }

  // --- Complaints ---
  async getMyComplaints(teacherIds, user) {
    const { FrontOfficeComplaint } = require('../models');
    const orConditions = [];
    if (teacherIds && teacherIds.length > 0) {
      orConditions.push({ staffId: { $in: teacherIds } });
    }
    if (user?.id || user?._id) {
      orConditions.push({ createdBy: user._id || user.id });
    }
    if (user?.name) {
      orConditions.push({ complainantName: user.name });
    }
    const filter = orConditions.length > 0 ? { $or: orConditions } : {};

    const complaints = await FrontOfficeComplaint.find(filter)
      .populate('assignedToIds', 'name email empDepartment staffId')
      .sort({ createdAt: -1 })
      .lean();

    return complaints.map((c) => ({
      ...c,
      id: c._id ? c._id.toString() : c.id,
      title: c.subject || c.title || 'Untitled Complaint',
      description: c.details || c.description || '',
      category: c.category || 'General',
      assignedTo: c.assignedToIds || [],
      remarks: c.remarks || []
    }));
  }

  async submitComplaint(data, user, primaryStaffId) {
    const { FrontOfficeComplaint, Staff } = require('../models');
    let staffDoc = null;
    if (primaryStaffId) {
      staffDoc = await Staff.findById(primaryStaffId).lean();
    }
    const complainantName = staffDoc?.name || user?.name || 'Teacher';
    const contact = staffDoc?.phone || user?.phone || '';

    const complaint = await FrontOfficeComplaint.create({
      type: 'Staff',
      complainantName,
      contact,
      subject: data.title || data.subject || 'Complaint',
      details: data.description || data.details || '',
      category: data.category || 'General',
      staffId: primaryStaffId || user?.refId,
      createdBy: user?._id || user?.id,
      status: 'Pending',
      remarks: []
    });

    return complaint;
  }

  async getAssignedComplaints(teacherIds) {
    const { FrontOfficeComplaint } = require('../models');
    if (!teacherIds || teacherIds.length === 0) return [];

    const complaints = await FrontOfficeComplaint.find({
      assignedToIds: { $in: teacherIds }
    })
      .populate('assignedToIds', 'name email empDepartment staffId')
      .sort({ createdAt: -1 })
      .lean();

    return complaints.map((c) => ({
      ...c,
      id: c._id ? c._id.toString() : c.id,
      title: c.subject || c.title || 'Untitled Complaint',
      description: c.details || c.description || '',
      category: c.category || 'General',
      assignedTo: c.assignedToIds || [],
      remarks: c.remarks || []
    }));
  }

  async updateAssignedComplaintStatus(complaintId, status, user, remark) {
    const { FrontOfficeComplaint } = require('../models');
    const normStatus = status === 'In_Progress' ? 'In Progress' : status;
    const updateData = { status: normStatus };

    const author = user?.name || 'Teacher';
    const pushObj = {};
    if (remark && remark.trim()) {
      pushObj.remarks = {
        text: remark.trim(),
        remark: remark.trim(),
        authorName: author,
        date: new Date(),
        createdAt: new Date()
      };
    }

    const updateQuery = pushObj.remarks
      ? { $set: updateData, $push: pushObj }
      : { $set: updateData };

    const updated = await FrontOfficeComplaint.findByIdAndUpdate(
      complaintId,
      updateQuery,
      { returnDocument: 'after' }
    ).populate('assignedToIds', 'name email empDepartment staffId');

    return updated;
  }
}

module.exports = new TeacherService();
