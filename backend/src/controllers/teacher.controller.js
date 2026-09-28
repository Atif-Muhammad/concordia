const mongoose = require('mongoose');
const teacherService = require('../services/teacher.service');
const staffService = require('../services/staff.service');
const { Staff, User } = require('../models');

async function resolveTeacherIds(teacherIdParam, user) {
  const staffIds = new Set();
  const fallbackIds = new Set();

  const addStaff = (val) => {
    if (val && mongoose.Types.ObjectId.isValid(val)) {
      staffIds.add(val.toString());
    }
  };
  const addFallback = (val) => {
    if (val && mongoose.Types.ObjectId.isValid(val)) {
      fallbackIds.add(val.toString());
    }
  };

  if (teacherIdParam && mongoose.Types.ObjectId.isValid(teacherIdParam)) {
    try {
      const staff = await Staff.findById(teacherIdParam).lean();
      if (staff) {
        addStaff(staff._id);
      } else {
        addFallback(teacherIdParam);
        const userDoc = await User.findById(teacherIdParam).lean();
        if (userDoc) {
          if (userDoc.refId) addStaff(userDoc.refId);
          if (userDoc.email) {
            const staffByEmail = await Staff.findOne({ email: userDoc.email }).lean();
            if (staffByEmail) addStaff(staffByEmail._id);
          }
        }
      }
    } catch (e) {
      addFallback(teacherIdParam);
    }
  }

  if (user) {
    if (user.refId) addStaff(user.refId);
    try {
      if (user.id && mongoose.Types.ObjectId.isValid(user.id)) {
        const userDoc = await User.findById(user.id).lean();
        if (userDoc?.refId) addStaff(userDoc.refId);
      }
      if (user.email) {
        const staffByEmail = await Staff.findOne({ email: user.email }).lean();
        if (staffByEmail) addStaff(staffByEmail._id);
      }
    } catch (e) {
      // ignore
    }
    addFallback(user.id);
    addFallback(user._id);
  }

  const combined = [...Array.from(staffIds), ...Array.from(fallbackIds)];
  return combined.map((id) => new mongoose.Types.ObjectId(id));
}

class TeacherController {
  async getTeachers(req, res, next) {
    try {
      const teachers = await teacherService.getTeachers();
      res.json(teachers);
    } catch (err) {
      next(err);
    }
  }

  async getTeacherNames(req, res, next) {
    try {
      const names = await teacherService.getTeacherNames();
      res.json(names);
    } catch (err) {
      next(err);
    }
  }

  async createTeacher(req, res, next) {
    try {
      const teacher = await staffService.createStaff({ ...req.body, isTeaching: true });
      res.status(201).json(teacher);
    } catch (err) {
      next(err);
    }
  }

  async updateTeacher(req, res, next) {
    try {
      const id = req.query.teacherID || req.params.id;
      const teacher = await staffService.updateStaff(id, req.body);
      res.json(teacher);
    } catch (err) {
      next(err);
    }
  }

  async deleteTeacher(req, res, next) {
    try {
      const id = req.query.teacherID || req.params.id;
      await staffService.deleteStaff(id);
      res.json({ message: 'Teacher deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getSubjects(req, res, next) {
    try {
      const teacherIds = await resolveTeacherIds(req.query.teacherId, req.user);
      const subjects = await teacherService.getTeacherSubjects(teacherIds, req.query.classId);
      res.json(subjects);
    } catch (err) {
      next(err);
    }
  }

  async getClasses(req, res, next) {
    try {
      const teacherIds = await resolveTeacherIds(req.query.teacherId, req.user);
      const classes = await teacherService.getTeacherClasses(teacherIds);
      res.json(classes);
    } catch (err) {
      next(err);
    }
  }

  async getClassStudentsAttendance(req, res, next) {
    try {
      let { classId, sectionId, subjectId, date, id, fetchFor } = req.query;
      if (!classId && id) {
        if (fetchFor === 'section') {
          sectionId = id;
          const { Section } = require('../models');
          const sec = await Section.findById(id).lean();
          if (sec) classId = sec.classId;
        } else {
          classId = id;
        }
      }
      const cleanSubjectId = (subjectId && subjectId !== 'undefined' && subjectId !== 'null' && subjectId !== 'all') ? subjectId : undefined;
      const cleanSectionId = (sectionId && sectionId !== 'undefined' && sectionId !== 'null' && sectionId !== 'all') ? sectionId : undefined;
      const records = await teacherService.getClassStudentsAttendance({
        classId,
        sectionId: cleanSectionId,
        subjectId: cleanSubjectId,
        date
      });
      res.json(records);
    } catch (err) {
      next(err);
    }
  }

  async updateClassStudentsAttendance(req, res, next) {
    try {
      const result = await teacherService.updateClassStudentsAttendance(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // --- Leaves ---
  async getMyLeaves(req, res, next) {
    try {
      const teacherIds = await resolveTeacherIds(req.query.teacherId, req.user);
      const leaves = await teacherService.getMyLeaves(teacherIds);
      res.json(leaves);
    } catch (err) {
      next(err);
    }
  }

  async applyLeave(req, res, next) {
    try {
      const teacherIds = await resolveTeacherIds(req.body.staffId || req.query.teacherId, req.user);
      const primaryStaffId = teacherIds.length > 0 ? teacherIds[0] : null;
      const leave = await teacherService.applyLeave(req.body, req.user, primaryStaffId);
      res.status(201).json(leave);
    } catch (err) {
      next(err);
    }
  }

  async cancelLeave(req, res, next) {
    try {
      const leaveId = req.params.id;
      const teacherIds = await resolveTeacherIds(req.query.teacherId, req.user);
      await teacherService.cancelLeave(leaveId, teacherIds);
      res.json({ message: 'Leave application cancelled successfully' });
    } catch (err) {
      next(err);
    }
  }

  // --- Complaints ---
  async getMyComplaints(req, res, next) {
    try {
      const teacherIds = await resolveTeacherIds(req.query.teacherId, req.user);
      const complaints = await teacherService.getMyComplaints(teacherIds, req.user);
      res.json(complaints);
    } catch (err) {
      next(err);
    }
  }

  async submitComplaint(req, res, next) {
    try {
      const teacherIds = await resolveTeacherIds(req.body.staffId || req.query.teacherId, req.user);
      const primaryStaffId = teacherIds.length > 0 ? teacherIds[0] : null;
      const complaint = await teacherService.submitComplaint(req.body, req.user, primaryStaffId);
      res.status(201).json(complaint);
    } catch (err) {
      next(err);
    }
  }

  async addComplaintRemark(req, res, next) {
    try {
      const frontOfficeService = require('../services/frontOffice.service');
      const id = req.params.id;
      const { remark } = req.body;
      const author = req.user?.name || 'Teacher';
      const updated = await frontOfficeService.addComplaintRemark(id, remark, author);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  async getAssignedComplaints(req, res, next) {
    try {
      const teacherIds = await resolveTeacherIds(req.query.teacherId, req.user);
      const complaints = await teacherService.getAssignedComplaints(teacherIds);
      res.json(complaints);
    } catch (err) {
      next(err);
    }
  }

  async updateAssignedComplaintStatus(req, res, next) {
    try {
      const id = req.params.id;
      const { status, remark } = req.body;
      const updated = await teacherService.updateAssignedComplaintStatus(id, status, req.user, remark);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TeacherController();
