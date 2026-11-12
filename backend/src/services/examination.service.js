const mongoose = require('mongoose');
const { Exam, ExamMarks, ExamResult, Student, Subject, Class } = require('../models');
const { ACTIVE_STUDENT_FILTER, isStudentActive, getActiveStudentIds } = require('../utils/studentStatus');
const { applyMultiIdFilter } = require('../utils/filterHelpers');

class ExaminationService {
  // Exams
  async getExams(filters = {}) {
    const query = {};
    applyMultiIdFilter(query, 'programId', filters.programId);
    applyMultiIdFilter(query, 'classId', filters.classId);
    applyMultiIdFilter(query, 'sessionId', filters.sessionId);
    if (filters.search && typeof filters.search === 'string') {
      query.examName = new RegExp(filters.search, 'i');
    }

    const exams = await Exam.find(query)
      .populate('programId')
      .populate('classId')
      .populate('sessionId')
      .populate('schedule.subjectId')
      .sort({ startDate: -1 });

    return exams.map(exam => {
      const obj = exam.toObject();
      return {
        ...obj,
        id: exam._id.toString(),
        program: exam.programId,
        class: exam.classId,
        schedules: exam.schedule,
      };
    });
  }

  async getExamById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const exam = await Exam.findById(id)
      .populate('programId')
      .populate('classId')
      .populate('schedule.subjectId');
    if (!exam) return null;
    const obj = exam.toObject();
    return {
      ...obj,
      id: exam._id.toString(),
      program: exam.programId,
      class: exam.classId,
      schedules: exam.schedule,
    };
  }

  async createExam(data) {
    const cleanData = { ...data };
    if (cleanData.programId) cleanData.programId = (cleanData.programId._id || cleanData.programId.id || cleanData.programId).toString();
    if (cleanData.classId) cleanData.classId = (cleanData.classId._id || cleanData.classId.id || cleanData.classId).toString();
    if (!cleanData.sessionId || cleanData.sessionId === 'null' || cleanData.sessionId === 'undefined' || cleanData.sessionId === '') {
      delete cleanData.sessionId;
    } else {
      cleanData.sessionId = (cleanData.sessionId._id || cleanData.sessionId.id || cleanData.sessionId).toString();
    }
    if (Array.isArray(cleanData.schedule)) {
      cleanData.schedule = cleanData.schedule
        .filter((s) => s && (s.subjectId || s.subject) && s.date && s.startTime && s.endTime)
        .map((s) => ({
          subjectId: (s.subjectId?._id || s.subjectId?.id || s.subjectId || s.subject).toString(),
          date: s.date.includes('T') ? s.date.split('T')[0] : s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          totalMarks: Number(s.totalMarks) || 100,
        }));
    } else {
      cleanData.schedule = [];
    }
    return Exam.create(cleanData);
  }

  async updateExam(id, data) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const cleanData = { ...data };
    if (cleanData.programId) cleanData.programId = (cleanData.programId._id || cleanData.programId.id || cleanData.programId).toString();
    if (cleanData.classId) cleanData.classId = (cleanData.classId._id || cleanData.classId.id || cleanData.classId).toString();
    if (!cleanData.sessionId || cleanData.sessionId === 'null' || cleanData.sessionId === 'undefined' || cleanData.sessionId === '') {
      cleanData.sessionId = null;
    } else {
      cleanData.sessionId = (cleanData.sessionId._id || cleanData.sessionId.id || cleanData.sessionId).toString();
    }
    if (Array.isArray(cleanData.schedule)) {
      cleanData.schedule = cleanData.schedule
        .filter((s) => s && (s.subjectId || s.subject) && s.date && s.startTime && s.endTime)
        .map((s) => ({
          subjectId: (s.subjectId?._id || s.subjectId?.id || s.subjectId || s.subject).toString(),
          date: s.date.includes('T') ? s.date.split('T')[0] : s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          totalMarks: Number(s.totalMarks) || 100,
        }));
    }
    return Exam.findByIdAndUpdate(id, cleanData, { returnDocument: 'after' });
  }

  async deleteExam(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return Exam.findByIdAndDelete(id);
  }

  // Marks
  async getMarks(filters = {}) {
    const query = {};
    if (filters.examId && mongoose.Types.ObjectId.isValid(filters.examId)) query.examId = filters.examId;
    if (filters.classId && mongoose.Types.ObjectId.isValid(filters.classId)) query.classId = filters.classId;
    if (filters.sectionId && filters.sectionId !== '*' && mongoose.Types.ObjectId.isValid(filters.sectionId)) {
      query.$or = [
        { sectionId: filters.sectionId },
        { sectionId: null },
        { sectionId: { $exists: false } }
      ];
    }
    if (filters.subjectId && mongoose.Types.ObjectId.isValid(filters.subjectId)) query.subjectId = filters.subjectId;
    if (filters.sessionId && mongoose.Types.ObjectId.isValid(filters.sessionId) && !query.examId) {
      const examIds = await Exam.find({ sessionId: filters.sessionId }).distinct('_id');
      query.examId = { $in: examIds };
    }

    let list = await ExamMarks.find(query)
      .populate({
        path: 'studentId',
        populate: [{ path: 'classId' }, { path: 'sectionId' }, { path: 'programId' }]
      })
      .populate('examId')
      .populate('subjectId');

    if (filters.includeInactive !== true && filters.includeInactive !== 'true') {
      list = list.filter(m => !m.studentId || typeof m.studentId !== 'object' || isStudentActive(m.studentId));
    }

    if (filters.sectionId && filters.sectionId !== '*' && mongoose.Types.ObjectId.isValid(filters.sectionId)) {
      const targetSec = filters.sectionId.toString();
      list = list.filter(m => {
        const markSec = (m.sectionId?._id || m.sectionId)?.toString();
        if (markSec) {
          return markSec === targetSec;
        }
        const studentSec = (m.studentId?.sectionId?._id || m.studentId?.sectionId)?.toString();
        return !studentSec || studentSec === targetSec;
      });
    }

    const unpopulatedSubjectIds = [];
    list.forEach(m => {
      if (!m.subjectId?.name) {
        const sid = m.subjectId?._id || m.subjectId;
        if (sid && mongoose.Types.ObjectId.isValid(sid)) {
          unpopulatedSubjectIds.push(sid);
        }
      }
    });

    const subjectMap = new Map();
    if (unpopulatedSubjectIds.length > 0) {
      const foundSubs = await Subject.find({ _id: { $in: unpopulatedSubjectIds } }).select('name code');
      foundSubs.forEach(s => subjectMap.set(s._id.toString(), s.name));
    }

    return list.map(m => {
      const obj = m.toObject();
      const sId = (m.subjectId?._id || m.subjectId)?.toString();
      const resolvedSubjectName =
        m.subjectId?.name ||
        subjectMap.get(sId) ||
        (typeof m.subjectId === 'string' && !mongoose.Types.ObjectId.isValid(m.subjectId) ? m.subjectId : null) ||
        'Subject';

      return {
        ...obj,
        id: m._id.toString(),
        student: m.studentId ? {
          ...m.studentId.toObject(),
          id: m.studentId._id.toString(),
          class: m.studentId.classId,
          section: m.studentId.sectionId,
          program: m.studentId.programId,
        } : null,
        exam: m.examId,
        subject: resolvedSubjectName,
        subjectId: sId || m.subjectId,
      };
    });
  }

  async createMarks(data) {
    if (data && typeof data === 'object') {
      const extractCleanId = (val) => {
        if (!val) return null;
        if (val instanceof mongoose.Types.ObjectId) return val.toString();
        if (typeof val === 'object') {
          const raw = val._id || val.id;
          if (raw) {
            if (raw instanceof mongoose.Types.ObjectId) return raw.toString();
            const str = String(raw).trim();
            if (str && str !== '[object Object]' && mongoose.Types.ObjectId.isValid(str)) return str;
          }
        }
        const str = String(val).trim();
        if (!str || str === '[object Object]' || str === 'undefined' || str === 'null') return null;
        return mongoose.Types.ObjectId.isValid(str) ? str : null;
      };
      const cleanStudent = extractCleanId(data.studentId || data.student);
      if (cleanStudent) {
        data.studentId = cleanStudent;
        if (mongoose.connection.readyState === 1 || Object.prototype.hasOwnProperty.call(Student, 'findById')) {
          const targetStudent = await Student.findById(cleanStudent).select('status passedOut').lean();
          if (targetStudent && !isStudentActive(targetStudent)) {
            const err = new Error(`Cannot record marks for inactive student (${targetStudent.status || 'INACTIVE'})`);
            err.status = 400;
            throw err;
          }
        }
      }
      const cleanExam = extractCleanId(data.examId || data.exam);
      if (cleanExam) data.examId = cleanExam;
      const cleanSubject = extractCleanId(data.subjectId);
      if (cleanSubject) data.subjectId = cleanSubject;
      if (data.totalMarks !== undefined) data.totalMarks = Math.max(0, Number(data.totalMarks) || 100);
      if (data.obtainedMarks !== undefined) {
        let obt = data.isAbsent ? 0 : (Number(data.obtainedMarks) || 0);
        if (obt < 0) obt = 0;
        if (data.totalMarks && obt > data.totalMarks) obt = data.totalMarks;
        data.obtainedMarks = obt;
      }
    }
    return ExamMarks.create(data);
  }

  async bulkCreateMarks(records) {
    const list = Array.isArray(records)
      ? records
      : records?.records || records?.marks || [];

    if (!list || list.length === 0) {
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }

    const extractCleanId = (val) => {
      if (!val) return null;
      if (val instanceof mongoose.Types.ObjectId) return val.toString();
      if (typeof val === 'object') {
        const raw = val._id || val.id;
        if (raw) {
          if (raw instanceof mongoose.Types.ObjectId) return raw.toString();
          const str = String(raw).trim();
          if (str && str !== '[object Object]' && mongoose.Types.ObjectId.isValid(str)) return str;
        }
      }
      const str = String(val).trim();
      if (!str || str === '[object Object]' || str === 'undefined' || str === 'null') return null;
      return mongoose.Types.ObjectId.isValid(str) ? str : null;
    };

    const subjectCache = {};
    for (const r of list) {
      r.examId = extractCleanId(r.examId || r.exam);
      r.studentId = extractCleanId(r.studentId || r.student);
      r.subjectId = extractCleanId(r.subjectId);

      if (!r.subjectId && r.subject) {
        if (!subjectCache[r.subject]) {
          const sDoc = await Subject.findOne({ name: r.subject });
          if (sDoc) subjectCache[r.subject] = sDoc._id.toString();
        }
        if (subjectCache[r.subject]) {
          r.subjectId = subjectCache[r.subject];
        }
      }
      if (r.classId) r.classId = extractCleanId(r.classId || r.class);
      if (r.sectionId) r.sectionId = extractCleanId(r.sectionId || r.section);
      if (r.totalMarks !== undefined) r.totalMarks = Math.max(0, Number(r.totalMarks) || 100);
      if (r.obtainedMarks !== undefined) {
        let obt = r.isAbsent ? 0 : (Number(r.obtainedMarks) || 0);
        if (obt < 0) obt = 0;
        if (r.totalMarks && obt > r.totalMarks) obt = r.totalMarks;
        r.obtainedMarks = obt;
      }
    }

    let validRecords = list.filter(r => r.examId && r.studentId && r.subjectId);
    if (validRecords.length === 0) {
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }

    if (mongoose.connection.readyState === 1 || Object.prototype.hasOwnProperty.call(Student, 'find')) {
      const candidateStudentIds = [...new Set(validRecords.map(r => r.studentId))];
      const activeIds = await getActiveStudentIds(Student, { _id: { $in: candidateStudentIds } });
      const activeSet = new Set(activeIds.map(id => String(id)));
      validRecords = validRecords.filter(r => activeSet.has(String(r.studentId)));
      if (validRecords.length === 0) {
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      }
    }

    const ops = validRecords.map(r => ({
      updateOne: {
        filter: { examId: r.examId, studentId: r.studentId, subjectId: r.subjectId },
        update: { $set: r },
        upsert: true
      }
    }));
    return ExamMarks.bulkWrite(ops);
  }

  async updateMarks(id, data) {
    return ExamMarks.findByIdAndUpdate(id, data, { returnDocument: 'after' });
  }

  async deleteMarks(id) {
    return ExamMarks.findByIdAndDelete(id);
  }

  // Results
  async getResults(filters = {}) {
    const parseIds = (input) => {
      if (!input || input === '*' || input === 'all' || input === '__all__') return [];
      if (Array.isArray(input)) {
        return input
          .map(s => (s && s._id ? String(s._id) : (s && s.id ? String(s.id) : String(s))))
          .filter(s => mongoose.Types.ObjectId.isValid(s));
      }
      if (typeof input === 'string') {
        return input
          .split(',')
          .map(s => s.trim())
          .filter(s => mongoose.Types.ObjectId.isValid(s));
      }
      if (mongoose.Types.ObjectId.isValid(input)) return [String(input)];
      return [];
    };

    const query = {};

    const examIds = parseIds(filters.examId);
    if (examIds.length === 1) {
      query.examId = examIds[0];
    } else if (examIds.length > 1) {
      query.examId = { $in: examIds };
    }

    const studentIds = parseIds(filters.studentId);
    if (studentIds.length === 1) {
      query.studentId = studentIds[0];
    } else if (studentIds.length > 1) {
      query.studentId = { $in: studentIds };
    }

    if (
      filters.sessionId &&
      filters.sessionId !== '*' &&
      filters.sessionId !== 'all' &&
      filters.sessionId !== '__all__' &&
      mongoose.Types.ObjectId.isValid(filters.sessionId)
    ) {
      const exams = await Exam.find({ sessionId: filters.sessionId }).select('_id');
      const sessionExamIds = exams.map(e => e._id.toString());
      if (query.examId) {
        if (query.examId.$in) {
          query.examId.$in = query.examId.$in.filter(id => sessionExamIds.includes(String(id)));
        } else {
          if (!sessionExamIds.includes(String(query.examId))) {
            query.examId = { $in: [] };
          }
        }
      } else {
        query.examId = { $in: sessionExamIds };
      }
    }

    const progIds = parseIds(filters.programId);
    const clsIds = parseIds(filters.classId);
    const secIds = parseIds(filters.sectionId);

    if (progIds.length > 0 || clsIds.length > 0 || secIds.length > 0) {
      const studentFilter = filters.includeInactive ? {} : { ...ACTIVE_STUDENT_FILTER };
      if (progIds.length === 1) studentFilter.programId = progIds[0];
      else if (progIds.length > 1) studentFilter.programId = { $in: progIds };

      if (clsIds.length === 1) studentFilter.classId = clsIds[0];
      else if (clsIds.length > 1) studentFilter.classId = { $in: clsIds };

      if (secIds.length === 1) studentFilter.sectionId = secIds[0];
      else if (secIds.length > 1) studentFilter.sectionId = { $in: secIds };

      if (query.studentId) {
        if (query.studentId.$in) {
          studentFilter._id = { $in: query.studentId.$in };
        } else {
          studentFilter._id = query.studentId;
        }
      }

      const matchingStudents = await Student.find(studentFilter).select('_id');
      const matchingStudentIds = matchingStudents.map(s => s._id);
      query.studentId = { $in: matchingStudentIds };
    }

    let results = await ExamResult.find(query)
      .populate({
        path: 'studentId',
        populate: [{ path: 'classId' }, { path: 'sectionId' }, { path: 'programId' }]
      })
      .populate({
        path: 'examId',
        populate: [{ path: 'classId' }, { path: 'programId' }]
      })
      .sort({ position: 1 });

    if (filters.includeInactive !== true && filters.includeInactive !== 'true') {
      results = results.filter(r => !r.studentId || typeof r.studentId !== 'object' || isStudentActive(r.studentId));
    }

    return results.map(r => {
      const obj = r.toObject();
      return {
        ...obj,
        id: r._id.toString(),
        student: r.studentId ? {
          ...r.studentId.toObject(),
          id: r.studentId._id.toString(),
          class: r.studentId.classId,
          section: r.studentId.sectionId,
          program: r.studentId.programId,
        } : null,
        exam: r.examId ? {
          ...r.examId.toObject(),
          id: r.examId._id.toString(),
          class: r.examId.classId,
          program: r.examId.programId,
        } : null,
      };
    });
  }

  async createResult(data) {
    return ExamResult.create(data);
  }

  async generateResults(examId, classId) {
    if (!examId) throw new Error('examId is required');

    const exam = await Exam.findById(examId).populate('schedule.subjectId');
    if (!exam) throw new Error('Exam not found');

    const targetClassId = classId || exam.classId;

    const studentQuery = { ...ACTIVE_STUDENT_FILTER };
    if (targetClassId) studentQuery.classId = targetClassId;
    if (exam.programId) studentQuery.programId = exam.programId;
    const students = await Student.find(studentQuery);

    // Clean up any stale ExamResult rows for students in this class/exam who are no longer active
    const inactiveQuery = {
      $or: [
        { passedOut: true },
        { status: { $not: { $regex: /^active$/i } } },
      ],
    };
    if (targetClassId) inactiveQuery.classId = targetClassId;
    if (exam.programId) inactiveQuery.programId = exam.programId;
    const inactiveStudents = await Student.find(inactiveQuery).distinct('_id').catch(() => []);
    if (inactiveStudents.length > 0 && typeof ExamResult.deleteMany === 'function') {
      await ExamResult.deleteMany({ examId: exam._id, studentId: { $in: inactiveStudents } }).catch(() => null);
    }

    if (students.length === 0) {
      return [];
    }

    const marksQuery = { examId };
    if (targetClassId) marksQuery.classId = targetClassId;
    const allMarks = await ExamMarks.find(marksQuery).populate('subjectId');

    const marksByStudent = {};
    for (const m of allMarks) {
      const sId = m.studentId.toString();
      if (!marksByStudent[sId]) marksByStudent[sId] = [];
      marksByStudent[sId].push(m);
    }

    const calculateGrade = (pct) => {
      if (pct >= 90) return { grade: 'A+', gpa: 4.0 };
      if (pct >= 80) return { grade: 'A', gpa: 3.7 };
      if (pct >= 70) return { grade: 'B+', gpa: 3.3 };
      if (pct >= 60) return { grade: 'B', gpa: 3.0 };
      if (pct >= 50) return { grade: 'C', gpa: 2.5 };
      if (pct >= 40) return { grade: 'D', gpa: 2.0 };
      if (pct >= 33) return { grade: 'E', gpa: 1.0 };
      return { grade: 'F', gpa: 0.0 };
    };

    const calculatedResults = [];
    for (const student of students) {
      const sId = student._id.toString();
      const studentMarks = marksByStudent[sId] || [];

      let totalMarks = 0;
      let obtainedMarks = 0;

      if (studentMarks.length > 0) {
        for (const sm of studentMarks) {
          totalMarks += (sm.totalMarks || 100);
          obtainedMarks += sm.isAbsent ? 0 : (sm.obtainedMarks || 0);
        }
      } else if (exam.schedule && exam.schedule.length > 0) {
        for (const item of exam.schedule) {
          totalMarks += (item.totalMarks || 100);
        }
      } else {
        totalMarks = 100;
      }

      totalMarks = Math.round(totalMarks * 10000) / 10000;
      obtainedMarks = Math.round(obtainedMarks * 10000) / 10000;
      const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
      const { grade, gpa } = calculateGrade(percentage);

      calculatedResults.push({
        studentId: student._id,
        examId: exam._id,
        totalMarks,
        obtainedMarks,
        percentage,
        gpa,
        grade,
        remarks: grade === 'F' ? 'Needs Improvement' : 'Passed'
      });
    }

    calculatedResults.sort((a, b) => b.percentage - a.percentage);
    calculatedResults.forEach((r, idx) => {
      r.position = idx + 1;
    });

    const savedResults = [];
    for (const resData of calculatedResults) {
      const saved = await ExamResult.findOneAndUpdate(
        { examId: resData.examId, studentId: resData.studentId },
        { $set: resData },
        { upsert: true, returnDocument: 'after' }
      ).populate({
        path: 'studentId',
        populate: [{ path: 'classId' }, { path: 'sectionId' }, { path: 'programId' }]
      }).populate('examId');

      const obj = saved.toObject();
      savedResults.push({
        ...obj,
        id: saved._id.toString(),
        student: saved.studentId ? {
          ...saved.studentId.toObject(),
          id: saved.studentId._id.toString(),
          class: saved.studentId.classId,
          section: saved.studentId.sectionId,
          program: saved.studentId.programId,
        } : null,
        exam: saved.examId,
      });
    }

    return savedResults;
  }

  async getStudentResult(studentId, examId) {
    if (!studentId || !examId) throw new Error('studentId and examId are required');

    const student = await Student.findById(studentId)
      .populate('classId')
      .populate('sectionId')
      .populate('programId');
    if (!student) throw new Error('Student not found');

    const exam = await Exam.findById(examId)
      .populate('classId')
      .populate('programId')
      .populate('schedule.subjectId');
    if (!exam) throw new Error('Exam not found');

    const marks = await ExamMarks.find({ studentId, examId }).populate('subjectId');

    const unpopulatedSubjectIds = [];
    marks.forEach(m => {
      if (!m.subjectId?.name) {
        const sid = m.subjectId?._id || m.subjectId;
        if (sid && mongoose.Types.ObjectId.isValid(sid)) {
          unpopulatedSubjectIds.push(sid);
        }
      }
    });

    const subjectMap = new Map();
    if (unpopulatedSubjectIds.length > 0) {
      const foundSubs = await Subject.find({ _id: { $in: unpopulatedSubjectIds } }).select('name code');
      foundSubs.forEach(s => subjectMap.set(s._id.toString(), s.name));
    }

    if (exam.schedule && Array.isArray(exam.schedule)) {
      exam.schedule.forEach(s => {
        const sId = (s.subjectId?._id || s.subjectId)?.toString();
        const sName = s.subjectId?.name || s.name || s.subjectName;
        if (sId && sName && !sName.startsWith('Subject #')) {
          if (!subjectMap.has(sId)) subjectMap.set(sId, sName);
        }
      });
    }

    const formattedMarks = marks.map(m => {
      const sId = (m.subjectId?._id || m.subjectId)?.toString();
      const resolvedName =
        m.subjectId?.name ||
        subjectMap.get(sId) ||
        (typeof m.subjectId === 'string' && !mongoose.Types.ObjectId.isValid(m.subjectId) ? m.subjectId : null) ||
        'Subject';

      return {
        id: m._id.toString(),
        _id: m._id,
        subjectId: sId || m.subjectId,
        subject: resolvedName,
        totalMarks: m.totalMarks || 100,
        obtainedMarks: m.isAbsent ? 0 : (m.obtainedMarks || 0),
        isAbsent: !!m.isAbsent,
      };
    });

    let result = await ExamResult.findOne({ studentId, examId });
    if (!result) {
      let totalMarks = 0;
      let obtainedMarks = 0;
      for (const fm of formattedMarks) {
        totalMarks += fm.totalMarks;
        obtainedMarks += fm.obtainedMarks;
      }
      totalMarks = Math.round(totalMarks * 10000) / 10000;
      obtainedMarks = Math.round(obtainedMarks * 10000) / 10000;
      const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
      const calculateGrade = (pct) => {
        if (pct >= 90) return { grade: 'A+', gpa: 4.0 };
        if (pct >= 80) return { grade: 'A', gpa: 3.7 };
        if (pct >= 70) return { grade: 'B+', gpa: 3.3 };
        if (pct >= 60) return { grade: 'B', gpa: 3.0 };
        if (pct >= 50) return { grade: 'C', gpa: 2.5 };
        if (pct >= 40) return { grade: 'D', gpa: 2.0 };
        if (pct >= 33) return { grade: 'E', gpa: 1.0 };
        return { grade: 'F', gpa: 0.0 };
      };
      const { grade, gpa } = calculateGrade(percentage);
      result = {
        studentId: student._id,
        examId: exam._id,
        totalMarks,
        obtainedMarks,
        percentage,
        gpa,
        grade,
        position: 1,
        remarks: grade === 'F' ? 'Needs Improvement' : 'Passed'
      };
    }

    return {
      student: {
        ...student.toObject(),
        id: student._id.toString(),
        class: student.classId,
        section: student.sectionId,
        program: student.programId
      },
      exam: {
        ...exam.toObject(),
        id: exam._id.toString(),
        class: exam.classId,
        program: exam.programId
      },
      marks: formattedMarks,
      result: {
        ...((result.toObject && result.toObject()) || result),
        id: (result._id || '').toString(),
      },
      position: result.position || 1
    };
  }

  async getPositions(filters = {}) {
    const query = {};
    if (filters.examId) query.examId = filters.examId;
    if (filters.studentId) query.studentId = filters.studentId;

    let results = await ExamResult.find(query)
      .populate({
        path: 'studentId',
        populate: [{ path: 'classId' }, { path: 'sectionId' }, { path: 'programId' }]
      })
      .populate({
        path: 'examId',
        populate: [{ path: 'classId' }, { path: 'programId' }]
      })
      .sort({ position: 1 });

    if (filters.includeInactive !== true && filters.includeInactive !== 'true') {
      results = results.filter(r => !r.studentId || typeof r.studentId !== 'object' || isStudentActive(r.studentId));
    }

    if (filters.classId) {
      results = results.filter(r => {
        const studentClsId = r.studentId?.classId?._id?.toString() || r.studentId?.classId?.toString();
        const examClsId = r.examId?.classId?._id?.toString() || r.examId?.classId?.toString();
        return studentClsId === filters.classId.toString() || examClsId === filters.classId.toString();
      });
    }

    return results.map(r => {
      const student = r.studentId;
      const exam = r.examId;
      const cls = (student && student.classId) || (exam && exam.classId) || {};
      return {
        id: r._id.toString(),
        _id: r._id,
        position: r.position,
        totalMarks: r.totalMarks,
        obtainedMarks: r.obtainedMarks,
        percentage: r.percentage,
        gpa: r.gpa,
        grade: r.grade,
        remarks: r.remarks,
        student: student ? {
          ...student.toObject(),
          id: student._id.toString(),
          class: cls
        } : null,
        exam: exam ? {
          ...exam.toObject(),
          id: exam._id.toString(),
          class: cls
        } : null,
        class: cls
      };
    });
  }

  async updateResult(id, data) {
    return ExamResult.findByIdAndUpdate(id, data, { returnDocument: 'after' });
  }

  async deleteResult(id) {
    return ExamResult.findByIdAndDelete(id);
  }
}

module.exports = new ExaminationService();
