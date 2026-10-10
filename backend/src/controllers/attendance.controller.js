const attendanceService = require('../services/attendance.service');

class AttendanceController {
  // Student
  async fetchStudentAttendance(req, res, next) {
    try {
      const { classId, sectionId, subjectId, date, sessionId } = req.query;
      const records = await attendanceService.fetchStudentAttendance({ classId, sectionId, subjectId, date, sessionId });
      res.json(records);
    } catch (err) {
      next(err);
    }
  }

  async getAttendanceReport(req, res, next) {
    try {
      const { start, end, classId, sectionId, sessionId, programId, studentId } = req.query;
      const report = await attendanceService.getAttendanceReport({ start, end, classId, sectionId, sessionId, programId, studentId });
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  async updateStudentAttendance(req, res, next) {
    try {
      const result = await attendanceService.updateStudentAttendance(req.body, req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteStudentRecord(req, res, next) {
    try {
      const { studentId, classId, sectionId, subjectId, date, attendanceId } = req.query;
      await attendanceService.deleteStudentRecord({ studentId, classId, sectionId, subjectId, date, attendanceId });
      res.json({ message: 'Attendance record deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Leaves
  async getLeaves(req, res, next) {
    try {
      const type = req.query.type || req.query.applicantType || 'ALL';
      const month = req.query.month || null;
      const leaves = await attendanceService.getLeaves(type, month);
      res.json(leaves);
    } catch (err) {
      next(err);
    }
  }

  async createLeave(req, res, next) {
    try {
      const leave = await attendanceService.createLeave(req.body);
      res.status(201).json(leave);
    } catch (err) {
      next(err);
    }
  }

  async updateLeave(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const leave = await attendanceService.updateLeave(id, req.body);
      res.json(leave);
    } catch (err) {
      next(err);
    }
  }

  // Skips
  async getSkips(req, res, next) {
    try {
      const { classId, sectionId } = req.query;
      const skips = await attendanceService.getSkips(classId, sectionId);
      res.json(skips);
    } catch (err) {
      next(err);
    }
  }

  async createSkip(req, res, next) {
    try {
      const skip = await attendanceService.createSkip(req.body);
      res.status(201).json(skip);
    } catch (err) {
      next(err);
    }
  }

  async deleteSkip(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await attendanceService.deleteSkip(id);
      res.json({ message: 'Skip deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Staff Attendance
  async getStaffAttendance(req, res, next) {
    try {
      const { date, role } = req.query;
      const records = await attendanceService.getStaffAttendance(date, role);
      res.json(records);
    } catch (err) {
      next(err);
    }
  }

  async bulkMarkStaffAttendance(req, res, next) {
    try {
      const result = await attendanceService.bulkMarkStaffAttendance(req.body, req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteStaffAttendanceRecord(req, res, next) {
    try {
      const { staffId, date, attendanceId } = req.query;
      await attendanceService.deleteStaffAttendanceRecord({ staffId, date, attendanceId });
      res.json({ message: 'Attendance record deleted' });
    } catch (err) {
      next(err);
    }
  }

  async deleteStaffAttendanceByDate(req, res, next) {
    try {
      const { date } = req.query;
      await attendanceService.deleteStaffAttendanceByDate(date);
      res.json({ message: 'Attendance deleted for date' });
    } catch (err) {
      next(err);
    }
  }

  async getStaffLeaveBalance(req, res, next) {
    try {
      const { staffId } = req.params;
      const { month } = req.query;
      const balance = await attendanceService.getStaffLeaveBalance(staffId, month);
      res.json(balance);
    } catch (err) {
      next(err);
    }
  }

  async getStaffAttendanceHistory(req, res, next) {
    try {
      const staffId = req.params.staffId || req.params.id;
      const { month } = req.query;
      const result = await attendanceService.getStaffAttendanceHistory(staffId, month);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // Holidays
  async getHolidays(req, res, next) {
    try {
      const holidays = await attendanceService.getHolidays();
      res.json(holidays);
    } catch (err) {
      next(err);
    }
  }

  async createHoliday(req, res, next) {
    try {
      const holiday = await attendanceService.createHoliday(req.body);
      res.status(201).json(holiday);
    } catch (err) {
      next(err);
    }
  }

  async deleteHoliday(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await attendanceService.deleteHoliday(id);
      res.json({ message: 'Holiday deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Missing Attendance Summary Audits
  async getMissingAttendanceClassesSummary(req, res, next) {
    try {
      const { programId, date, sessionId } = req.query;
      const result = await attendanceService.getMissingAttendanceClassesSummary({ programId, date, sessionId });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getMissingAttendanceSubjectsSummary(req, res, next) {
    try {
      const { classId, sectionId, date, sessionId } = req.query;
      const result = await attendanceService.getMissingAttendanceSubjectsSummary({ classId, sectionId, date, sessionId });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getMissingAttendanceStudentsSummary(req, res, next) {
    try {
      const { classId, sectionId, subjectId, date, sessionId } = req.query;
      const result = await attendanceService.getMissingAttendanceStudentsSummary({ classId, sectionId, subjectId, date, sessionId });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AttendanceController();
