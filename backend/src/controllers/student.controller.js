const mongoose = require('mongoose');
const studentService = require('../services/student.service');
const { saveProfileImage, deleteProfileImage } = require('../utils/profileStorage');

function sanitizeInstallments(installments, body = {}) {
  if (!Array.isArray(installments)) return [];
  return installments.map((inst, index) => {
    const cleaned = { ...inst };
    if (cleaned._id && !mongoose.Types.ObjectId.isValid(cleaned._id)) {
      delete cleaned._id;
    }
    if (cleaned.sessionId && !mongoose.Types.ObjectId.isValid(cleaned.sessionId)) {
      cleaned.sessionId = null;
    }
    if (!cleaned.sessionId && body.sessionId && mongoose.Types.ObjectId.isValid(body.sessionId)) {
      cleaned.sessionId = body.sessionId;
    }
    if (cleaned.classId && !mongoose.Types.ObjectId.isValid(cleaned.classId)) {
      cleaned.classId = null;
    }
    if (!cleaned.classId && body.classId && mongoose.Types.ObjectId.isValid(body.classId)) {
      cleaned.classId = body.classId;
    }
    if (cleaned.programId && !mongoose.Types.ObjectId.isValid(cleaned.programId)) {
      cleaned.programId = null;
    }
    if (!cleaned.programId && body.programId && mongoose.Types.ObjectId.isValid(body.programId)) {
      cleaned.programId = body.programId;
    }
    if (!cleaned.installmentNumber) {
      cleaned.installmentNumber = index + 1;
    }
    cleaned.amount = Number(cleaned.amount) || 0;
    cleaned.basePayable = cleaned.basePayable != null ? Number(cleaned.basePayable) : cleaned.amount;
    cleaned.totalAmount = cleaned.totalAmount != null ? Number(cleaned.totalAmount) : cleaned.amount;
    return cleaned;
  });
}

class StudentController {
  async getStudents(req, res, next) {
    try {
      const students = await studentService.getStudents(req.query);
      res.json(students);
    } catch (err) {
      next(err);
    }
  }

  async getStudentById(req, res, next) {
    try {
      const student = await studentService.getStudentById(req.params.studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      res.json(student);
    } catch (err) {
      next(err);
    }
  }

  async search(req, res, next) {
    try {
      const students = await studentService.getStudents(req.query);
      res.json(students);
    } catch (err) {
      next(err);
    }
  }

  async createStudent(req, res, next) {
    try {
      let body = { ...req.body };
      const studentId = new mongoose.Types.ObjectId();
      body._id = studentId;

      if (req.file) {
        body.photo_url = await saveProfileImage('students', studentId.toString(), req.file);
      }
      if (typeof body.installments === 'string') {
        try { body.installments = JSON.parse(body.installments); } catch (e) {}
      }
      if (body.installments) {
        body.installments = sanitizeInstallments(body.installments, body);
      }
      if (typeof body.documents === 'string') {
        try { body.documents = JSON.parse(body.documents); } catch (e) {}
      }
      if (!body.sectionId || body.sectionId === '' || body.sectionId === 'none') {
        delete body.sectionId;
      }

      const student = await studentService.createStudent(body);
      res.status(201).json(student);
    } catch (err) {
      next(err);
    }
  }

  async updateStudent(req, res, next) {
    try {
      const id = req.query.studentID || req.query.id || req.body.studentID || req.body.id || req.params.id;
      let body = { ...req.body };

      if (req.file) {
        body.photo_url = await saveProfileImage('students', String(id), req.file);
      } else if (body.removePhoto === 'true' || body.photo_url === '') {
        await deleteProfileImage('students', String(id));
        body.photo_url = '';
      }

      if (typeof body.installments === 'string') {
        try { body.installments = JSON.parse(body.installments); } catch (e) {}
      }
      if (body.installments) {
        body.installments = sanitizeInstallments(body.installments, body);
      }
      if (typeof body.documents === 'string') {
        try { body.documents = JSON.parse(body.documents); } catch (e) {}
      }
      if (!body.sectionId || body.sectionId === '' || body.sectionId === 'none') {
        body.sectionId = null;
      }

      const student = await studentService.updateStudent(id, body);
      res.json(student);
    } catch (err) {
      next(err);
    }
  }

  async deleteStudent(req, res, next) {
    try {
      const id = req.query.studentID || req.query.id || req.body.studentID || req.body.id;
      if (id) {
        await deleteProfileImage('students', String(id));
      }
      await studentService.deleteStudent(id);
      res.json({ message: 'Student removed successfully' });
    } catch (err) {
      next(err);
    }
  }

  async promoteStudents(req, res, next) {
    try {
      const studentID = req.query.studentID || req.query.id || req.body.studentID || req.body.id;
      const forcePromote = req.query.forcePromote || req.body.forcePromote;
      const forceBool = forcePromote === true || forcePromote === 'true';
      const targetClassId = req.query.targetClassId || req.body.targetClassId;
      const targetSectionId = req.query.targetSectionId || req.body.targetSectionId;
      const targetProgramId = req.query.targetProgramId || req.body.targetProgramId;
      const targetSession = req.query.targetSession || req.body.targetSession;
      const targetSessionId = req.query.targetSessionId || req.body.targetSessionId;

      const result = await studentService.promote(
        studentID,
        forceBool,
        targetClassId,
        targetSectionId,
        targetProgramId,
        targetSession,
        targetSessionId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async demoteStudents(req, res, next) {
    try {
      const studentID = req.query.studentID || req.query.id || req.body.studentID || req.body.id;
      const result = await studentService.demote(studentID);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async passoutStudents(req, res, next) {
    try {
      const studentID = req.query.studentID || req.query.id || req.body.studentID || req.body.id;
      const result = await studentService.passout(studentID);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async expelStudents(req, res, next) {
    try {
      const studentID = req.query.studentID || req.query.id || req.body.studentID || req.body.id;
      const reason = req.body.reason || req.query.reason;
      const result = await studentService.expel(studentID, reason);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async struckOffStudents(req, res, next) {
    try {
      const studentID = req.query.studentID || req.query.id || req.body.studentID || req.body.id;
      const reason = req.body.reason || req.query.reason;
      const result = await studentService.struckOff(studentID, reason);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async rejoinStudent(req, res, next) {
    try {
      const studentID = req.query.studentID || req.query.id || req.body.studentID || req.body.id;
      const body = req.body || {};
      const reason = body.reason || req.query.reason;
      const result = await studentService.rejoin(studentID, reason, body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async changeStatus(status) {
    return async (req, res, next) => {
      try {
        const id = req.query.studentID || req.query.id || req.body.studentID || req.body.id;
        const updated = await studentService.updateStatus(id, status);
        res.json(updated);
      } catch (err) {
        next(err);
      }
    };
  }

  async getLatestRollNumber(req, res, next) {
    try {
      const prefix = req.query.prefix || req.params.prefix;
      const latest = await studentService.getLatestRollNumber(prefix);
      res.json(latest);
    } catch (err) {
      next(err);
    }
  }

  async getLatestRollNumbersBatch(req, res, next) {
    try {
      const sessionId = req.query.sessionId;
      const batch = await studentService.getLatestRollNumbersBatch(sessionId);
      res.json(batch);
    } catch (err) {
      next(err);
    }
  }

  async getAttendance(req, res, next) {
    try {
      const { studentId } = req.params;
      const records = await studentService.getAttendance(studentId);
      res.json(records);
    } catch (err) {
      next(err);
    }
  }

  async getResults(req, res, next) {
    try {
      const { studentId } = req.params;
      const results = await studentService.getResults(studentId);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StudentController();
