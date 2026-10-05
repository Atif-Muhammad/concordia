const mongoose = require('mongoose');
const {
  Student,
  Attendance,
  Exam,
  ExamMarks,
  ExamResult,
  Subject,
  FeeChallan,
  FeeStructure,
  Class,
  Program,
  Section,
  AcademicSession,
  InstituteSettings
} = require('../models');

function getPrefix(pPrefix, cPrefix) {
  const p = (pPrefix || '').trim();
  const c = (cPrefix || '').trim();
  if (p && c && c.startsWith(p)) return c;
  return `${p}${c}`;
}

class StudentService {
  async getStudents(filters = {}) {
    const andConditions = [];

    if (filters.status && filters.status !== 'all') {
      const s = String(filters.status).trim().toUpperCase();
      if (s === 'ACTIVE') {
        andConditions.push({
          status: { $regex: /^active$/i },
          passedOut: { $ne: true }
        });
      } else if (s === 'GRADUATED') {
        andConditions.push({
          $or: [
            { status: { $regex: /^(graduated|passed[ _-]out)$/i } },
            { passedOut: true, status: { $nin: ['EXPELLED', 'STRUCK_OFF', 'Expelled', 'Struck Off'] } }
          ]
        });
      } else if (s === 'EXPELLED') {
        andConditions.push({
          status: { $regex: /^expelled$/i }
        });
      } else if (s === 'STRUCK_OFF') {
        andConditions.push({
          status: { $regex: /^struck[ _-]off$/i }
        });
      } else {
        const pattern = filters.status.replace(/[_\s-]+/g, '[ _-]');
        andConditions.push({
          status: { $regex: new RegExp(`^${pattern}$`, 'i') }
        });
      }
    }

    if (filters.classId && filters.classId !== 'all') {
      const cIds = Array.isArray(filters.classId)
        ? filters.classId
        : String(filters.classId).split(',').map(s => s.trim()).filter(Boolean);
      if (cIds.length === 1) {
        andConditions.push({ classId: cIds[0] });
      } else if (cIds.length > 1) {
        andConditions.push({ classId: { $in: cIds } });
      }
    }
    if (filters.sectionId && filters.sectionId !== 'all') {
      const sIds = Array.isArray(filters.sectionId)
        ? filters.sectionId
        : String(filters.sectionId).split(',').map(s => s.trim()).filter(Boolean);
      if (sIds.length === 1) {
        andConditions.push({ sectionId: sIds[0] });
      } else if (sIds.length > 1) {
        andConditions.push({ sectionId: { $in: sIds } });
      }
    }
    if (filters.sessionId && filters.sessionId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.sessionId)) {
        const sId = new mongoose.Types.ObjectId(filters.sessionId);
        andConditions.push({
          $or: [
            { sessionId: sId },
            { 'academicRecords.sessionId': sId }
          ]
        });
      } else {
        andConditions.push({
          $or: [
            { sessionId: filters.sessionId },
            { session: filters.sessionId },
            { 'academicRecords.sessionId': filters.sessionId }
          ]
        });
      }
    } else if (filters.session && filters.session !== 'all') {
      andConditions.push({
        $or: [
          { session: filters.session },
          { 'academicRecords.session': filters.session }
        ]
      });
    }

    if (filters.programId && filters.programId !== 'all') {
      const pIds = Array.isArray(filters.programId)
        ? filters.programId
        : String(filters.programId).split(',').map(s => s.trim()).filter(Boolean);
      if (pIds.length === 1) {
        andConditions.push({ programId: pIds[0] });
      } else if (pIds.length > 1) {
        andConditions.push({ programId: { $in: pIds } });
      }
    }

    if (filters.gender && filters.gender !== 'all') {
      andConditions.push({ gender: { $regex: new RegExp(`^${filters.gender}$`, 'i') } });
    }

    const search = (filters.search || filters.searchQuery || '').trim();
    if (search) {
      const re = new RegExp(search, 'i');
      andConditions.push({
        $or: [
          { fName: re },
          { lName: re },
          { rollNumber: re },
          { fatherOrguardian: re },
          { parentOrGuardianPhone: re }
        ]
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const totalCount = await Student.countDocuments(query);

    let studentQuery = Student.find(query);

    if (filters.summary === 'true' || filters.summary === true) {
      studentQuery = studentQuery.select(
        '_id fName lName rollNumber admissionFormNumber fatherOrguardian photo_url admissionDate createdAt programId classId sectionId sessionId status passedOut'
      );
    } else if (filters.fields) {
      studentQuery = studentQuery.select(filters.fields);
    }

    studentQuery = studentQuery
      .populate('programId', '_id name code duration')
      .populate('classId', '_id name')
      .populate('sectionId', '_id name')
      .populate('sessionId', '_id name')
      .sort({ rollNumber: 1 })
      .lean();

    const page = parseInt(filters.page, 10);
    const limit = parseInt(filters.limit, 10);
    if (limit > 0 && page > 0) {
      studentQuery = studentQuery.skip((page - 1) * limit).limit(limit);
    }

    const rawStudents = await studentQuery;
    const students = (Array.isArray(rawStudents) ? rawStudents : []).map(s => {
      const obj = { ...s };
      if (s._id) obj.id = s._id.toString();
      if (!obj.program && s.programId) obj.program = s.programId;
      if (!obj.class && s.classId) obj.class = s.classId;
      if (!obj.section && s.sectionId) obj.section = s.sectionId;
      if (!obj.feeInstallments && s.installments) obj.feeInstallments = s.installments;
      return obj;
    });

    return {
      students,
      count: totalCount,
      total: totalCount
    };
  }

  async getStudentById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return Student.findById(id)
      .populate('programId')
      .populate('classId')
      .populate('sectionId')
      .populate('sessionId')
      .populate('academicRecords.classId')
      .populate('academicRecords.sectionId')
      .populate('academicRecords.programId')
      .populate('academicRecords.sessionId');
  }

  async verifyStudent(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const student = await Student.findById(id)
      .populate('programId', 'name code')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('sessionId', 'name')
      .lean();

    if (!student) return null;

    return {
      id: student._id.toString(),
      name: `${student.fName || ''} ${student.lName || ''}`.trim(),
      fatherName: student.fatherOrguardian || '',
      rollNumber: student.rollNumber || '',
      photo_url: student.photo_url || '',
      program: student.programId?.name || '',
      class: student.classId?.name || '',
      section: student.sectionId?.name || '',
      session: student.sessionId?.name || student.session || '',
      status: student.status || 'Active',
      admissionDate: student.admissionDate || null,
    };
  }

  async createStudent(data) {
    // Generate initial fee challans from installments if defined
    const student = await Student.create(data);
    return student;
  }

  async updateStudent(id, data) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return Student.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteStudent(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return Student.findByIdAndDelete(id);
  }

  async updateStatus(id, status) {
    return Student.findByIdAndUpdate(id, { status }, { new: true });
  }

  async promote(
    id,
    forcePromote = false,
    targetClassId,
    targetSectionId,
    targetProgramId,
    targetSession,
    targetSessionId,
  ) {
    const student = await Student.findById(id)
      .populate('programId')
      .populate('classId')
      .populate('sectionId');

    if (!student) {
      const err = new Error('Student not found');
      err.status = 404;
      throw err;
    }
    if (student.passedOut || student.status === 'GRADUATED') {
      const err = new Error('Student already passed out');
      err.status = 400;
      throw err;
    }

    // Check for arrears before promotion
    let outstandingAmount = 0;
    const studentClassIdStr = (student.classId?._id || student.classId || '').toString();

    const pendingInstallments = (student.installments || []).filter((inst) => {
      const instClassIdStr = (inst.classId?._id || inst.classId || '').toString();
      if (instClassIdStr && instClassIdStr !== studentClassIdStr) return false;
      const st = String(inst.status || '').toUpperCase();
      if (['SUPERSEDED', 'SETTLED', 'VOID', 'PAID'].includes(st)) return false;
      const due = Number(inst.totalAmount || inst.amount || inst.basePayable || 0);
      const paid = Number(inst.paidAmount || 0);
      return (due - paid) > 0;
    });

    const pendingChallans = await FeeChallan.find({
      studentId: student._id,
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
    }).lean();

    outstandingAmount = pendingInstallments.reduce((sum, inst) => {
      const due = inst.challanGenerated && inst.totalAmount !== undefined
        ? Math.max(0, Number(inst.totalAmount) - Number(inst.paidAmount || 0))
        : Math.max(0, Number(inst.basePayable || inst.amount || 0) - Number(inst.paidAmount || 0));
      return sum + due;
    }, 0);

    if (outstandingAmount === 0 && pendingChallans.length > 0) {
      outstandingAmount = pendingChallans.reduce((sum, ch) => {
        return sum + Math.max(0, Number(ch.amount || 0) - Number(ch.paidAmount || 0));
      }, 0);
    }

    if (outstandingAmount > 0 && !forcePromote) {
      return {
        requiresConfirmation: true,
        studentInfo: {
          id: student._id.toString(),
          rollNumber: student.rollNumber,
          name: `${student.fName} ${student.lName || ''}`.trim(),
        },
        arrears: {
          outstandingAmount,
          className: student.classId?.name || 'Unknown Class',
          programName: student.programId?.name || 'Unknown Program',
          unpaidInstallments: pendingInstallments.length > 0
            ? pendingInstallments.map((inst) => ({
                installmentNumber: inst.installmentNumber,
                month: inst.month,
                balance: inst.challanGenerated && inst.totalAmount !== undefined
                  ? Math.max(0, Number(inst.totalAmount) - Number(inst.paidAmount || 0))
                  : Math.max(0, Number(inst.basePayable || inst.amount || 0) - Number(inst.paidAmount || 0)),
                status: inst.status,
              }))
            : pendingChallans.map((ch) => ({
                installmentNumber: ch.installmentNumber || 1,
                month: ch.month,
                balance: Math.max(0, Number(ch.amount || 0) - Number(ch.paidAmount || 0)),
                status: ch.status,
              })),
        },
        targetClassId,
        targetSectionId,
        targetProgramId,
        targetSession,
        targetSessionId,
      };
    }

    // Proceed with promotion
    let program = student.programId;
    let nextClass;
    let matchingSection;

    if (targetProgramId) {
      const newProgram = await Program.findById(targetProgramId);
      if (!newProgram) {
        const err = new Error('Target program not found');
        err.status = 400;
        throw err;
      }
      program = newProgram;
    }

    const programClasses = await Class.find({ programId: program._id }).lean();

    if (targetClassId) {
      const targetClass = programClasses.find((c) => c._id.toString() === targetClassId.toString());
      if (!targetClass) {
        const err = new Error('Target class does not belong to the selected program');
        err.status = 400;
        throw err;
      }
      nextClass = targetClass;

      if (targetSectionId) {
        const targetSec = await Section.findById(targetSectionId).lean();
        if (targetSec) matchingSection = targetSec;
      }
    } else {
      const sortedClasses = programClasses.sort((a, b) => {
        if (a.isSemester && b.isSemester) return (a.semester ?? 0) - (b.semester ?? 0);
        if (!a.isSemester && !b.isSemester) return (a.year ?? 0) - (b.year ?? 0);
        if (a.isSemester && !b.isSemester) return 1;
        if (!a.isSemester && b.isSemester) return -1;
        return 0;
      });

      const curIdx = sortedClasses.findIndex((c) => c._id.toString() === studentClassIdStr);
      if (curIdx === -1 || curIdx >= sortedClasses.length - 1) {
        nextClass = sortedClasses[0];
      } else {
        nextClass = sortedClasses[curIdx + 1];
        if (student.sectionId?.name) {
          const sec = await Section.findOne({ classId: nextClass._id, name: student.sectionId.name }).lean();
          if (sec) matchingSection = sec;
        }
      }
    }

    if (!nextClass) {
      const err = new Error('Could not determine next class for promotion');
      err.status = 400;
      throw err;
    }

    // Roll number prefix calculation
    const oldPrefix = getPrefix(student.programId?.rollPrefix, student.classId?.rollPrefix);
    const newPrefix = getPrefix(program?.rollPrefix, nextClass?.rollPrefix);

    let updatedRollNumber = student.rollNumber;
    if (oldPrefix && updatedRollNumber && updatedRollNumber.startsWith(oldPrefix)) {
      updatedRollNumber = newPrefix + updatedRollNumber.slice(oldPrefix.length);
    }

    const effectiveProgramId = targetProgramId || student.programId?._id || student.programId;
    const effectiveSessionId = targetSessionId || student.sessionId?._id || student.sessionId;
    let effectiveSession = targetSession || student.session;

    if (effectiveSessionId && (!targetSession || targetSession === student.session)) {
      const sessionRecord = await AcademicSession.findById(effectiveSessionId).select('name').lean();
      if (sessionRecord) effectiveSession = sessionRecord.name;
    }

    // New Fees from FeeStructure
    const newFeeStructure = await FeeStructure.findOne({
      programId: effectiveProgramId,
      classId: nextClass._id
    }).lean();

    const instituteSettings = await InstituteSettings.findOne().lean();
    const globalLateFeeRate = Number(instituteSettings?.lateFeeRatePerDay ?? 0);

    const totalAmount = newFeeStructure ? newFeeStructure.totalAmount : (student.tuitionFee || 0);
    const installmentCount = newFeeStructure?.installments || student.numberOfInstallments || 1;

    let newInstallments = [];
    if (totalAmount > 0) {
      const defaultInstallmentAmount = Math.floor(totalAmount / installmentCount);
      newInstallments = Array.from({ length: installmentCount }).map((_, idx) => {
        const d = new Date();
        d.setMonth(d.getMonth() + idx + 1);
        d.setDate(10);
        const basePayable = idx === installmentCount - 1
          ? totalAmount - (defaultInstallmentAmount * (installmentCount - 1))
          : defaultInstallmentAmount;
        return {
          installmentNumber: idx + 1,
          amount: basePayable,
          basePayable,
          pendingAmount: basePayable,
          totalAmount: basePayable,
          dueDate: d,
          month: d.toLocaleString('default', { month: 'long' }),
          sessionId: effectiveSessionId,
          classId: nextClass._id,
          programId: effectiveProgramId,
          lateFeeRatePerDay: globalLateFeeRate,
          status: 'PENDING',
          paidAmount: 0
        };
      });
    }

    // Academic Record Management
    if (!student.academicRecords) student.academicRecords = [];
    student.academicRecords.forEach((ar) => { ar.isCurrent = false; });
    student.academicRecords.push({
      sessionId: effectiveSessionId,
      classId: nextClass._id,
      sectionId: matchingSection ? matchingSection._id : null,
      programId: effectiveProgramId,
      rollNumber: updatedRollNumber,
      session: effectiveSession,
      isCurrent: true,
      startDate: new Date(),
      status: 'PROMOTED'
    });

    // Status History
    if (!student.statusHistory) student.statusHistory = [];
    student.statusHistory.push({
      previousStatus: student.status,
      newStatus: 'ACTIVE',
      action: 'PROMOTE',
      reason: 'Promoted to ' + nextClass.name,
      date: new Date(),
      details: {
        fromClassId: student.classId?._id || student.classId,
        toClassId: nextClass._id,
        targetProgramId: effectiveProgramId,
        targetSessionId: effectiveSessionId
      }
    });

    // Update Student Document
    student.classId = nextClass._id;
    student.sectionId = matchingSection ? matchingSection._id : null;
    student.programId = effectiveProgramId;
    student.rollNumber = updatedRollNumber;
    student.session = effectiveSession;
    student.sessionId = effectiveSessionId;
    student.tuitionFee = totalAmount;
    student.numberOfInstallments = installmentCount;
    student.status = 'ACTIVE';
    student.passedOut = false;
    student.statusDate = new Date();

    if (newInstallments.length > 0) {
      student.installments.push(...newInstallments);
    }

    await student.save();

    return {
      requiresConfirmation: false,
      promoted: true,
      student
    };
  }

  async demote(id) {
    const student = await Student.findById(id)
      .populate('programId')
      .populate('classId')
      .populate('sectionId');

    if (!student) {
      const err = new Error('Student not found');
      err.status = 404;
      throw err;
    }
    if (student.passedOut || student.status === 'GRADUATED') {
      const err = new Error('Student already passed out');
      err.status = 400;
      throw err;
    }

    const program = student.programId;
    const programClasses = await Class.find({ programId: program._id }).lean();
    const sortedClasses = programClasses.sort((a, b) => {
      if (a.isSemester && b.isSemester) return (a.semester ?? 0) - (b.semester ?? 0);
      if (!a.isSemester && !b.isSemester) return (a.year ?? 0) - (b.year ?? 0);
      if (a.isSemester && !b.isSemester) return 1;
      if (!a.isSemester && b.isSemester) return -1;
      return 0;
    });

    const studentClassIdStr = (student.classId?._id || student.classId || '').toString();
    const curIdx = sortedClasses.findIndex((c) => c._id.toString() === studentClassIdStr);
    if (curIdx <= 0) {
      const err = new Error('Cannot demote below entry level');
      err.status = 400;
      throw err;
    }

    const prevClass = sortedClasses[curIdx - 1];
    let matchingSection = null;
    if (student.sectionId?.name) {
      const sec = await Section.findOne({ classId: prevClass._id, name: student.sectionId.name }).lean();
      if (sec) matchingSection = sec;
    }

    // Restore previous fee structure
    const previousInstallments = (student.installments || []).filter((inst) => {
      const cIdStr = (inst.classId?._id || inst.classId || '').toString();
      return cIdStr === prevClass._id.toString();
    });

    let restoredTuitionFee = 0;
    let restoredInstallmentsCount = 0;

    if (previousInstallments.length > 0) {
      restoredTuitionFee = previousInstallments.reduce((sum, inst) => sum + Number(inst.amount || inst.basePayable || 0), 0);
      restoredInstallmentsCount = previousInstallments.length;
    } else {
      const targetFeeStructure = await FeeStructure.findOne({
        programId: program._id,
        classId: prevClass._id
      }).lean();
      restoredTuitionFee = targetFeeStructure ? targetFeeStructure.totalAmount : 0;
      restoredInstallmentsCount = targetFeeStructure ? targetFeeStructure.installments : 1;
    }

    // Roll number update
    const oldPrefix = getPrefix(student.programId?.rollPrefix, student.classId?.rollPrefix);
    const newPrefix = getPrefix(program?.rollPrefix, prevClass?.rollPrefix);

    let updatedRollNumber = student.rollNumber;
    if (oldPrefix && updatedRollNumber && updatedRollNumber.startsWith(oldPrefix)) {
      updatedRollNumber = newPrefix + updatedRollNumber.slice(oldPrefix.length);
    }

    // Academic Record Rollback
    if (student.academicRecords && student.academicRecords.length > 0) {
      student.academicRecords.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
      student.academicRecords[0].isCurrent = false;
      student.academicRecords[0].endDate = new Date();
      student.academicRecords[0].status = 'DEMOTED';
      if (student.academicRecords.length > 1) {
        student.academicRecords[1].isCurrent = true;
        if (student.academicRecords[1].session) {
          student.session = student.academicRecords[1].session;
        }
        if (student.academicRecords[1].sessionId) {
          student.sessionId = student.academicRecords[1].sessionId;
        }
      }
    }

    // Delete fee challans for the class we are LEAVING
    await FeeChallan.deleteMany({
      studentId: student._id,
      $or: [
        { classId: student.classId?._id || student.classId },
        { status: { $in: ['PENDING', 'OVERDUE'] } }
      ]
    });

    // Remove installments for the current class from student document
    student.installments = (student.installments || []).filter((inst) => {
      const cIdStr = (inst.classId?._id || inst.classId || '').toString();
      if (cIdStr === studentClassIdStr && inst.status !== 'PAID') return false;
      return true;
    });

    // Status history
    if (!student.statusHistory) student.statusHistory = [];
    student.statusHistory.push({
      previousStatus: student.status,
      newStatus: 'ACTIVE',
      action: 'DEMOTE',
      reason: 'Demoted to ' + prevClass.name,
      date: new Date(),
      details: {
        fromClassId: studentClassIdStr,
        toClassId: prevClass._id
      }
    });

    // Update student fields
    student.classId = prevClass._id;
    student.sectionId = matchingSection ? matchingSection._id : null;
    student.rollNumber = updatedRollNumber;
    student.tuitionFee = restoredTuitionFee;
    student.numberOfInstallments = restoredInstallmentsCount;
    student.passedOut = false;
    student.status = 'ACTIVE';
    student.statusDate = new Date();

    await student.save();
    return student;
  }

  async passout(id) {
    const student = await Student.findById(id);
    if (!student) {
      const err = new Error('Student not found');
      err.status = 404;
      throw err;
    }
    if (student.passedOut || student.status === 'GRADUATED') {
      const err = new Error('Student already passed out');
      err.status = 400;
      throw err;
    }

    // Check for remaining arrears before allowing passout
    const unpaidInstallments = (student.installments || []).filter((inst) => {
      const st = String(inst.status || '').toUpperCase();
      if (['SUPERSEDED', 'SETTLED', 'VOID', 'PAID'].includes(st)) return false;
      const due = Number(inst.totalAmount || inst.amount || inst.basePayable || 0);
      const paid = Number(inst.paidAmount || 0);
      return (due - paid) > 0;
    });

    const pendingChallans = await FeeChallan.find({
      studentId: student._id,
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
    }).lean();

    let totalOutstanding = unpaidInstallments.reduce((sum, inst) => {
      const due = Number(inst.totalAmount || inst.amount || inst.basePayable || 0);
      const paid = Number(inst.paidAmount || 0);
      return sum + Math.max(0, due - paid);
    }, 0);

    if (totalOutstanding === 0 && pendingChallans.length > 0) {
      totalOutstanding = pendingChallans.reduce((sum, ch) => {
        return sum + Math.max(0, Number(ch.amount || 0) - Number(ch.paidAmount || 0));
      }, 0);
    }

    if (totalOutstanding > 0) {
      const err = new Error(`Cannot pass out student. Total outstanding: PKR ${totalOutstanding}. Please clear all dues first.`);
      err.status = 400;
      throw err;
    }

    if (!student.statusHistory) student.statusHistory = [];
    student.statusHistory.push({
      previousStatus: student.status,
      newStatus: 'GRADUATED',
      action: 'PASSOUT',
      reason: 'Passed out / Graduated',
      date: new Date(),
    });

    student.passedOut = true;
    student.status = 'GRADUATED';
    student.statusDate = new Date();
    student.graduationDate = new Date();

    await student.save();
    return student;
  }

  async expel(id, reason) {
    const student = await Student.findById(id);
    if (!student) {
      const err = new Error('Student not found');
      err.status = 404;
      throw err;
    }

    // Check for remaining arrears before allowing expel
    const unpaidInstallments = (student.installments || []).filter((inst) => {
      const st = String(inst.status || '').toUpperCase();
      if (['SUPERSEDED', 'SETTLED', 'VOID', 'PAID'].includes(st)) return false;
      const due = Number(inst.totalAmount || inst.amount || inst.basePayable || 0);
      const paid = Number(inst.paidAmount || 0);
      return (due - paid) > 0;
    });

    const pendingChallans = await FeeChallan.find({
      studentId: student._id,
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
    }).lean();

    let totalOutstanding = unpaidInstallments.reduce((sum, inst) => {
      const due = Number(inst.totalAmount || inst.amount || inst.basePayable || 0);
      const paid = Number(inst.paidAmount || 0);
      return sum + Math.max(0, due - paid);
    }, 0);

    if (totalOutstanding === 0 && pendingChallans.length > 0) {
      totalOutstanding = pendingChallans.reduce((sum, ch) => {
        return sum + Math.max(0, Number(ch.amount || 0) - Number(ch.paidAmount || 0));
      }, 0);
    }

    if (totalOutstanding > 0) {
      const err = new Error(`Cannot expel student. Total outstanding arrears: PKR ${totalOutstanding}. Please clear all dues before finalizing status.`);
      err.status = 400;
      throw err;
    }

    if (!student.statusHistory) student.statusHistory = [];
    student.statusHistory.push({
      previousStatus: student.status,
      newStatus: 'EXPELLED',
      action: 'EXPEL',
      reason: reason || 'Expelled from institute',
      date: new Date(),
    });

    student.passedOut = true;
    student.status = 'EXPELLED';
    student.statusReason = reason || '';
    student.statusDate = new Date();

    await student.save();
    return student;
  }

  async struckOff(id, reason) {
    const student = await Student.findById(id);
    if (!student) {
      const err = new Error('Student not found');
      err.status = 404;
      throw err;
    }

    if (!student.statusHistory) student.statusHistory = [];
    student.statusHistory.push({
      previousStatus: student.status,
      newStatus: 'STRUCK_OFF',
      action: 'STRUCK_OFF',
      reason: reason || 'Struck off',
      date: new Date(),
    });

    student.passedOut = true;
    student.status = 'STRUCK_OFF';
    student.statusReason = reason || '';
    student.statusDate = new Date();

    await student.save();
    return student;
  }

  async rejoin(id, reason, details = {}) {
    const student = await Student.findById(id)
      .populate('programId')
      .populate('classId')
      .populate('sectionId');

    if (!student) {
      const err = new Error('Student not found');
      err.status = 404;
      throw err;
    }

    const currentStatusUpper = String(student.status || '').toUpperCase();
    if (currentStatusUpper !== 'STRUCK_OFF' && currentStatusUpper !== 'EXPELLED') {
      const err = new Error('Only struck off or expelled students can re-join');
      err.status = 400;
      throw err;
    }

    const isSameClass = details.sameClass === true || details.sameClass === 'true';

    if (!student.statusHistory) student.statusHistory = [];
    student.statusHistory.push({
      previousStatus: student.status,
      newStatus: 'ACTIVE',
      action: 'REJOIN',
      reason: reason || 'Re-joined institute',
      date: new Date(),
      details: {
        sameClass: isSameClass,
        newClassId: details.classId,
        newProgramId: details.programId,
        newSessionId: details.sessionId
      }
    });

    let effectiveSession = details.session || student.session;
    const effectiveSessionId = details.sessionId ? details.sessionId : null;

    if (effectiveSessionId && (!details.session || details.session === student.session)) {
      const sessionRecord = await AcademicSession.findById(effectiveSessionId).select('name').lean();
      if (sessionRecord) effectiveSession = sessionRecord.name;
    }

    student.passedOut = false;
    student.status = 'ACTIVE';
    student.statusDate = new Date();
    student.statusReason = '';
    student.session = effectiveSession;

    // Auto-generate new fees for new class if not same class
    if (!isSameClass && details.programId && details.classId) {
      const newProgId = details.programId;
      const newClassId = details.classId;

      const newFeeStructure = await FeeStructure.findOne({
        programId: newProgId,
        classId: newClassId
      }).lean();

      const instituteSettings = await InstituteSettings.findOne().lean();
      const globalLateFeeRate = Number(instituteSettings?.lateFeeRatePerDay ?? 0);

      const totalAmount = newFeeStructure ? newFeeStructure.totalAmount : (student.tuitionFee || 0);
      const installmentCount = newFeeStructure?.installments || student.numberOfInstallments || 1;

      if (totalAmount > 0) {
        student.tuitionFee = totalAmount;
        student.numberOfInstallments = installmentCount;

        const defaultInstallmentAmount = Math.floor(totalAmount / installmentCount);
        const newInstallments = Array.from({ length: installmentCount }).map((_, idx) => {
          const d = new Date();
          d.setMonth(d.getMonth() + idx + 1);
          d.setDate(10);
          const basePayable = idx === installmentCount - 1
            ? totalAmount - (defaultInstallmentAmount * (installmentCount - 1))
            : defaultInstallmentAmount;
          return {
            installmentNumber: idx + 1,
            amount: basePayable,
            basePayable,
            pendingAmount: basePayable,
            totalAmount: basePayable,
            dueDate: d,
            month: d.toLocaleString('default', { month: 'long' }),
            sessionId: effectiveSessionId,
            classId: newClassId,
            programId: newProgId,
            lateFeeRatePerDay: globalLateFeeRate,
            status: 'PENDING',
            paidAmount: 0
          };
        });

        // Delete existing unbilled installments for target class to avoid duplicates
        student.installments = (student.installments || []).filter((inst) => {
          const cIdStr = (inst.classId?._id || inst.classId || '').toString();
          return cIdStr !== newClassId.toString();
        });
        student.installments.push(...newInstallments);
      }

      student.programId = newProgId;
      student.classId = newClassId;
      student.sectionId = (details.sectionId && details.sectionId !== 'none') ? details.sectionId : null;
      if (effectiveSessionId) student.sessionId = effectiveSessionId;

      // Update academic records
      if (!student.academicRecords) student.academicRecords = [];
      student.academicRecords.forEach((ar) => { ar.isCurrent = false; });
      student.academicRecords.push({
        sessionId: effectiveSessionId,
        classId: newClassId,
        sectionId: student.sectionId,
        programId: newProgId,
        session: effectiveSession,
        isCurrent: true,
        startDate: new Date(),
        status: 'REJOINED'
      });
    }

    await student.save();
    return student;
  }


  async getLatestRollNumber(prefix) {
    if (!prefix) return null;
    const cleanPrefix = prefix.trim();
    const regex = new RegExp(`^${cleanPrefix}`);
    const students = await Student.find({ rollNumber: regex }, { rollNumber: 1 }).lean();
    if (!students || students.length === 0) return null;

    let maxSeq = 0;
    let latestRollNumber = null;

    for (const s of students) {
      if (!s.rollNumber) continue;
      const match = s.rollNumber.match(/(\d{2})-(\d+)$/);
      if (match) {
        const seq = parseInt(match[2], 10);
        if (seq > maxSeq) {
          maxSeq = seq;
          latestRollNumber = s.rollNumber;
        }
      } else {
        const numMatch = s.rollNumber.match(/(\d+)$/);
        if (numMatch) {
          const seq = parseInt(numMatch[1], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
            latestRollNumber = s.rollNumber;
          }
        }
      }
    }

    return latestRollNumber || students[0].rollNumber;
  }

  async getLatestRollNumbersBatch(sessionId) {
    const query = {};
    if (sessionId && sessionId !== 'all') {
      query.sessionId = sessionId;
    }
    let students = await Student.find(query, { rollNumber: 1, sessionId: 1 }).lean();
    if ((!students || students.length === 0) && query.sessionId) {
      students = await Student.find({}, { rollNumber: 1, sessionId: 1 }).lean();
    }

    const batchMap = {};

    for (const s of students) {
      if (!s.rollNumber) continue;
      const m = s.rollNumber.match(/^(.*?)(\d{2})-(\d+)$/);
      if (m) {
        const rawPrefix = m[1];
        const cleanPrefix = rawPrefix.replace(/-+$/, '');
        const yearSub = m[2];
        const seq = parseInt(m[3], 10);

        const keysToSet = [
          rawPrefix,
          cleanPrefix,
          cleanPrefix ? `${cleanPrefix}-` : '',
          `${cleanPrefix}${yearSub}-`,
          `${rawPrefix}${yearSub}-`
        ].filter(Boolean);

        for (const key of keysToSet) {
          if (!batchMap[key] || seq > (batchMap[key].maxSeq || 0)) {
            const nextSeq = seq + 1;
            const nextSuffix = `${yearSub}-${String(nextSeq).padStart(3, '0')}`;
            batchMap[key] = {
              latestRollNumber: s.rollNumber,
              yearSub,
              maxSeq: seq,
              nextSuffix,
              nextRollNumber: `${key}${nextSuffix}`,
            };
          }
        }
      }
    }

    return batchMap;
  }

  async getAttendance(studentId) {
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return [];
    const records = await Attendance.find({ studentId })
      .populate('classId')
      .populate('sectionId')
      .populate('subjectId')
      .populate('sessionId')
      .sort({ date: -1 });

    return records.map(r => {
      const obj = r.toObject ? r.toObject() : { ...r };
      return {
        ...obj,
        id: (r._id || r.id)?.toString(),
        class: r.classId,
        section: r.sectionId,
        subject: r.subjectId,
        session: r.sessionId,
      };
    });
  }

  async getResults(studentId) {
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return [];

    // 1. Fetch generated ExamResults with populated exam and hierarchy
    const examResults = await ExamResult.find({ studentId })
      .populate({
        path: 'examId',
        populate: [
          { path: 'classId' },
          { path: 'programId' },
          { path: 'sessionId' },
          { path: 'schedule.subjectId' }
        ]
      })
      .sort({ createdAt: -1 });

    // 2. Fetch all ExamMarks for this student
    const allMarks = await ExamMarks.find({ studentId })
      .populate('subjectId')
      .populate({
        path: 'examId',
        populate: [
          { path: 'classId' },
          { path: 'programId' },
          { path: 'sessionId' },
          { path: 'schedule.subjectId' }
        ]
      });

    // Group marks by examId
    const marksByExamId = new Map();
    for (const m of allMarks) {
      const eId = (m.examId?._id || m.examId)?.toString();
      if (!eId) continue;
      if (!marksByExamId.has(eId)) {
        marksByExamId.set(eId, []);
      }
      const sId = (m.subjectId?._id || m.subjectId)?.toString();
      const sName = m.subjectId?.name || (typeof m.subjectId === 'string' ? m.subjectId : 'Subject');
      marksByExamId.get(eId).push({
        id: (m._id || m.id)?.toString(),
        subjectId: sId,
        subjectName: sName,
        subject: sName,
        totalMarks: Number(m.totalMarks) || 100,
        obtainedMarks: m.isAbsent ? 0 : Number(m.obtainedMarks || 0),
        isAbsent: !!m.isAbsent,
        percentage: (Number(m.totalMarks) || 100) > 0
          ? Math.round(((m.isAbsent ? 0 : Number(m.obtainedMarks || 0)) / (Number(m.totalMarks) || 100)) * 100)
          : 0,
      });
    }

    const processedExamIds = new Set();
    const formattedResults = [];

    // Process existing ExamResults
    for (const res of examResults) {
      const eId = (res.examId?._id || res.examId)?.toString();
      if (eId) processedExamIds.add(eId);

      const examObj = res.examId && typeof res.examId === 'object' ? res.examId : null;
      const attachedMarks = eId ? (marksByExamId.get(eId) || []) : [];

      formattedResults.push({
        id: (res._id || res.id)?.toString(),
        _id: res._id,
        studentId: (res.studentId?._id || res.studentId)?.toString(),
        examId: eId,
        exam: examObj ? {
          id: (examObj._id || examObj.id)?.toString(),
          _id: examObj._id,
          examName: examObj.examName,
          session: examObj.session || examObj.sessionId?.name || '',
          sessionId: examObj.sessionId,
          class: examObj.classId,
          classId: examObj.classId,
          program: examObj.programId,
          programId: examObj.programId,
          type: examObj.type,
          startDate: examObj.startDate,
          endDate: examObj.endDate,
        } : null,
        totalMarks: Number(res.totalMarks || 0),
        obtainedMarks: Number(res.obtainedMarks || 0),
        percentage: Number(res.percentage || 0),
        gpa: res.gpa,
        grade: res.grade,
        position: res.position,
        remarks: res.remarks || '',
        marks: attachedMarks,
        createdAt: res.createdAt,
      });
    }

    // Process exams that have marks but no generated ExamResult yet
    for (const [eId, marksList] of marksByExamId.entries()) {
      if (processedExamIds.has(eId)) continue;

      const firstMark = allMarks.find(m => (m.examId?._id || m.examId)?.toString() === eId);
      const examObj = firstMark?.examId && typeof firstMark.examId === 'object' ? firstMark.examId : null;

      const totalMarks = marksList.reduce((sum, m) => sum + (Number(m.totalMarks) || 0), 0);
      const obtainedMarks = marksList.reduce((sum, m) => sum + (Number(m.obtainedMarks) || 0), 0);
      const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

      let grade = 'F';
      if (percentage >= 80) grade = 'A+';
      else if (percentage >= 70) grade = 'A';
      else if (percentage >= 60) grade = 'B';
      else if (percentage >= 50) grade = 'C';
      else if (percentage >= 40) grade = 'D';

      formattedResults.push({
        id: `synthetic-${eId}`,
        studentId: studentId.toString(),
        examId: eId,
        exam: examObj ? {
          id: (examObj._id || examObj.id)?.toString(),
          _id: examObj._id,
          examName: examObj.examName,
          session: examObj.session || examObj.sessionId?.name || '',
          sessionId: examObj.sessionId,
          class: examObj.classId,
          classId: examObj.classId,
          program: examObj.programId,
          programId: examObj.programId,
          type: examObj.type,
          startDate: examObj.startDate,
          endDate: examObj.endDate,
        } : null,
        totalMarks,
        obtainedMarks,
        percentage,
        grade,
        remarks: 'Preliminary marks',
        marks: marksList,
        createdAt: firstMark?.createdAt || new Date(),
      });
    }

    return formattedResults.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }
}

module.exports = new StudentService();
