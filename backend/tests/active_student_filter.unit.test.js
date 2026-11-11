const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const {
  ACTIVE_STUDENT_FILTER,
  buildStudentStatusCondition,
  isStudentActive,
  shouldFilterActiveStudents,
  withActiveStudentFilter,
  getActiveStudentIds,
  buildActiveStudentIdConstraint,
} = require('../src/utils/studentStatus');
const studentController = require('../src/controllers/student.controller');
const studentService = require('../src/services/student.service');
const dashboardService = require('../src/services/dashboard.service');
const feeService = require('../src/services/fee.service');
const attendanceService = require('../src/services/attendance.service');
const examinationService = require('../src/services/examination.service');
const hostelService = require('../src/services/hostel.service');
const models = require('../src/models');

function makeChain(resolvedValue) {
  const chain = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    lean: () => Promise.resolve(resolvedValue),
    distinct: () => Promise.resolve(resolvedValue),
    exec: () => Promise.resolve(resolvedValue),
    then: (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject),
  };
  return chain;
}

describe('Canonical Active-Student Filtering Across Backend Modules', () => {
  const restorations = [];

  function stubMethod(target, method, replacement) {
    const hadOwn = Object.prototype.hasOwnProperty.call(target, method);
    const original = target[method];
    target[method] = replacement;
    restorations.push(() => {
      if (hadOwn) target[method] = original;
      else delete target[method];
    });
  }

  afterEach(() => {
    while (restorations.length > 0) {
      const restore = restorations.pop();
      restore();
    }
  });

  describe('1. Canonical studentStatus utility helpers', () => {
    it('isStudentActive enforces ACTIVE (case-insensitive) and passedOut !== true', () => {
      assert.strictEqual(isStudentActive({ status: 'ACTIVE', passedOut: false }), true);
      assert.strictEqual(isStudentActive({ status: 'active' }), true);
      assert.strictEqual(isStudentActive({ status: 'ACTIVE', passedOut: true }), false);
      assert.strictEqual(isStudentActive({ status: 'EXPELLED', passedOut: true }), false);
      assert.strictEqual(isStudentActive({ status: 'STRUCK_OFF' }), false);
      assert.strictEqual(isStudentActive({ status: 'GRADUATED' }), false);
      assert.strictEqual(isStudentActive(null), false);
    });

    it('buildStudentStatusCondition handles ACTIVE, GRADUATED, EXPELLED, STRUCK_OFF', () => {
      const activeCond = buildStudentStatusCondition('ACTIVE');
      assert.deepStrictEqual(activeCond.passedOut, { $ne: true });
      assert(activeCond.status.$regex instanceof RegExp);
      assert.strictEqual(activeCond.status.$regex.test('active'), true);

      const gradCond = buildStudentStatusCondition('GRADUATED');
      assert(Array.isArray(gradCond.$or));

      assert.strictEqual(buildStudentStatusCondition('EXPELLED').status.$regex.test('EXPELLED'), true);
      assert.strictEqual(buildStudentStatusCondition('STRUCK_OFF').status.$regex.test('Struck Off'), true);
    });

    it('shouldFilterActiveStudents defaults true and opts out for all/false/0/inactive', () => {
      assert.strictEqual(shouldFilterActiveStudents(undefined), true);
      assert.strictEqual(shouldFilterActiveStudents(''), true);
      assert.strictEqual(shouldFilterActiveStudents('ACTIVE'), true);
      assert.strictEqual(shouldFilterActiveStudents('all'), false);
      assert.strictEqual(shouldFilterActiveStudents('false'), false);
      assert.strictEqual(shouldFilterActiveStudents('0'), false);
      assert.strictEqual(shouldFilterActiveStudents('inactive'), false);
    });

    it('withActiveStudentFilter and buildActiveStudentIdConstraint restrict non-active IDs', async () => {
      const combined = withActiveStudentFilter({ classId: 'cls1' });
      assert.strictEqual(combined.classId, 'cls1');
      assert.deepStrictEqual(combined.passedOut, { $ne: true });

      const activeIds = ['a1', 'a2'];
      assert.deepStrictEqual(
        buildActiveStudentIdConstraint(activeIds, { $in: ['a1', 'inactive1'] }),
        { $in: ['a1'] }
      );
      assert.deepStrictEqual(buildActiveStudentIdConstraint(activeIds, 'inactive1'), { $in: [] });
      assert.deepStrictEqual(buildActiveStudentIdConstraint(activeIds, undefined, { allowNull: true }), {
        $in: ['a1', 'a2', null],
      });

      let capturedFilter = null;
      stubMethod(models.Student, 'find', (q) => {
        capturedFilter = q;
        return makeChain(['a1']);
      });
      const fetchedIds = await getActiveStudentIds(models.Student, { programId: 'p1' });
      assert.deepStrictEqual(fetchedIds, ['a1']);
      assert.strictEqual(capturedFilter.programId, 'p1');
      assert.deepStrictEqual(capturedFilter.passedOut, ACTIVE_STUDENT_FILTER.passedOut);
    });
  });

  describe('2. Student controller search & service lifecycle guards', () => {
    it('studentController.search defaults to status=ACTIVE and honors explicit status=all', async () => {
      const capturedQueries = [];
      stubMethod(studentService, 'getStudents', async (q) => {
        capturedQueries.push(q);
        return { students: [] };
      });

      const resDefault = { json: () => {} };
      await studentController.search({ query: { searchFor: 'Ali' } }, resDefault, (err) => {
        throw err;
      });
      assert.strictEqual(capturedQueries[0].status, 'ACTIVE');

      await studentController.search({ query: { searchFor: 'Ali', status: 'all' } }, resDefault, (err) => {
        throw err;
      });
      assert.strictEqual(capturedQueries[1].status, 'all');
    });

    it('studentService.promote blocks inactive students with 400', async () => {
      stubMethod(models.Student, 'findById', () =>
        makeChain({ _id: 's1', status: 'EXPELLED', passedOut: true })
      );

      await assert.rejects(
        () => studentService.promote('s1'),
        (err) => err.status === 400 && /Cannot promote inactive student/i.test(err.message)
      );
    });

    it('studentService.expel marks student EXPELLED, passedOut=true, and deactivates hostel records', async () => {
      const stuId = new mongoose.Types.ObjectId().toString();
      const roomId = new mongoose.Types.ObjectId().toString();
      let saved = false;
      let regSaved = false;
      let allocSaved = false;
      const roomUpdates = [];

      const studentDoc = {
        _id: stuId,
        status: 'ACTIVE',
        passedOut: false,
        statusHistory: [],
        save: async () => {
          saved = true;
        },
      };
      const regDoc = {
        _id: 'reg1',
        studentId: stuId,
        roomId,
        status: 'active',
        history: [],
        save: async () => {
          regSaved = true;
        },
      };
      const allocDoc = {
        _id: 'alloc1',
        studentId: stuId,
        roomId,
        status: 'active',
        save: async () => {
          allocSaved = true;
        },
      };

      stubMethod(models.Student, 'findById', () => studentDoc);
      stubMethod(models.HostelRegistration, 'find', () => makeChain([regDoc]));
      stubMethod(models.HostelAllocation, 'find', () => makeChain([allocDoc]));
      stubMethod(models.HostelAllocation, 'countDocuments', async () => 0);
      stubMethod(models.HostelRoom, 'findByIdAndUpdate', async (id, update) => {
        roomUpdates.push({ id, update });
      });

      await studentService.expel(stuId, 'Misconduct');
      assert.strictEqual(saved, true);
      assert.strictEqual(studentDoc.status, 'EXPELLED');
      assert.strictEqual(studentDoc.passedOut, true);
      assert.strictEqual(regSaved, true);
      assert.strictEqual(regDoc.status, 'terminated');
      assert.strictEqual(regDoc.roomId, null);
      assert.strictEqual(allocSaved, true);
      assert.strictEqual(allocDoc.status, 'inactive');
      assert.deepStrictEqual(roomUpdates[0], { id: roomId, update: { currentOccupancy: 0 } });
    });
  });

  describe('3. Dashboard statistics active-student scoping', () => {
    it('getStudentsStats counts only ACTIVE non-passedOut students as total and tracks struckOff', async () => {
      const countFilters = [];
      const countResults = [150, 120, 10, 5, 15];
      stubMethod(models.Student, 'countDocuments', async (q) => {
        countFilters.push(q);
        return countResults[countFilters.length - 1] ?? 0;
      });
      let findFilter = null;
      stubMethod(models.Student, 'find', (q) => {
        findFilter = q;
        return makeChain([]);
      });

      const stats = await dashboardService.getStudentsStats();
      assert.strictEqual(stats.total, 120);
      assert.strictEqual(stats.totalStudents, 120);
      assert.strictEqual(stats.active, 120);
      assert.strictEqual(stats.expelled, 10);
      assert.strictEqual(stats.struckOff, 5);
      assert.strictEqual(stats.passedOut, 15);
      assert.strictEqual(stats.expelledStudents, 10);
      assert.strictEqual(stats.struckOffStudents, 5);
      assert.strictEqual(stats.passedOutStudents, 15);
      assert.deepStrictEqual(stats.byStatus, {
        active: 120,
        expelled: 10,
        struckOff: 5,
        passedOut: 15,
      });
      assert.deepStrictEqual(findFilter.passedOut, { $ne: true });

      countFilters.length = 0;
      const sessionId = new mongoose.Types.ObjectId().toString();
      await dashboardService.getStudentsStats(sessionId);
      // Verify GRADUATED ($or) + session ($or) are combined via $and instead of overwriting $or
      const graduatedQuery = countFilters[4];
      assert(Array.isArray(graduatedQuery.$and));
      assert.strictEqual(graduatedQuery.$and.length, 2);
    });

    it('getFeesStats excludes inactive students pending dues while preserving external hostel dues & paid inflows', async () => {
      stubMethod(models.AcademicSession, 'findById', () => makeChain(null));
      stubMethod(models.Student, 'find', () => makeChain(['active1']));
      stubMethod(models.FeeChallan, 'find', () =>
        makeChain([
          { studentId: 'active1', status: 'PENDING', totalAmount: 1000, paidAmount: 0, discount: 0 },
          { studentId: 'expelled1', status: 'PENDING', totalAmount: 9000, paidAmount: 0, discount: 0 },
          { studentId: 'expelled1', status: 'PAID', totalAmount: 2000, paidAmount: 2000, discount: 0 },
        ])
      );
      stubMethod(models.ExtraChallan, 'find', () => makeChain([]));
      stubMethod(models.HostelChallan, 'find', () =>
        makeChain([
          { studentId: 'expelled1', status: 'PENDING', totalAmount: 4000, paidAmount: 0, discount: 0 },
          { studentId: null, status: 'PENDING', totalAmount: 3000, paidAmount: 0, discount: 0 },
        ])
      );

      const feeStats = await dashboardService.getFeesStats();
      assert.strictEqual(feeStats.totalFeeCollected, 2000);
      assert.strictEqual(feeStats.pendingAmount, 4000); // 1000 active fee + 3000 external hostel
    });
  });

  describe('4. Fee, Attendance, Examination & Hostel module enforcement', () => {
    it('feeService.createChallan and createExtraChallan reject inactive students', async () => {
      stubMethod(models.Student, 'findById', (id) => {
        if (id === 'expelled1') return makeChain({ _id: 'expelled1', status: 'EXPELLED', passedOut: true });
        return makeChain({ _id: 'passed1', status: 'ACTIVE', passedOut: true });
      });

      await assert.rejects(
        () => feeService.createChallan({ studentId: 'expelled1', totalAmount: 5000 }),
        (err) => err.status === 400 && /Cannot create challan for inactive student/i.test(err.message)
      );

      await assert.rejects(
        () => feeService.createExtraChallan({ studentId: 'passed1', amount: 1000 }),
        (err) => err.status === 400 && /Cannot create extra challan for inactive student/i.test(err.message)
      );
    });

    it('feeService.getStudentInstallmentReport defaults to active and zeros pendingAmount when status=all', async () => {
      let capturedQuery = null;
      stubMethod(models.Student, 'find', (q) => {
        capturedQuery = q;
        return makeChain([
          {
            _id: 's_exp',
            fName: 'Ex',
            lName: 'Student',
            rollNumber: 'R-9',
            status: 'EXPELLED',
            passedOut: true,
            tuitionFee: 10000,
            installments: [{ installmentNumber: 1, amount: 5000, paidAmount: 1000, status: 'PARTIAL' }],
          },
        ]);
      });

      const defaultReport = await feeService.getStudentInstallmentReport({});
      assert(Array.isArray(capturedQuery.$and));
      assert.deepStrictEqual(capturedQuery.$and[0], ACTIVE_STUDENT_FILTER);

      const allReport = await feeService.getStudentInstallmentReport({ status: 'all' });
      assert.strictEqual(allReport[0].totalPending, 0);
      assert.strictEqual(allReport[0].installments[0].pendingAmount, 0);
      assert.strictEqual(defaultReport.length, 1);
    });

    it('attendanceService.updateLeave rejects approving leave for inactive student and filters attendance writes', async () => {
      stubMethod(models.Leave, 'findById', () =>
        makeChain({
          _id: 'lv1',
          applicantType: 'STUDENT',
          studentId: 's_inactive',
          status: 'PENDING',
        })
      );
      stubMethod(models.Student, 'findById', () =>
        makeChain({ _id: 's_inactive', status: 'STRUCK_OFF', passedOut: true })
      );

      await assert.rejects(
        () => attendanceService.updateLeave('lv1', { status: 'APPROVED' }),
        (err) => err.status === 400 && /Cannot approve leave for inactive student/i.test(err.message)
      );

      const classId = new mongoose.Types.ObjectId().toString();
      stubMethod(models.Class, 'findById', () => makeChain({ _id: classId, allowSections: true }));
      stubMethod(models.Student, 'find', () => makeChain(['active1']));
      stubMethod(feeService, 'syncStudentAbsenteeFineForMonth', async () => {});
      const writtenIds = [];
      stubMethod(models.Attendance, 'findOneAndUpdate', async (query) => {
        writtenIds.push(query.studentId);
        return query;
      });

      await attendanceService.updateStudentAttendance({
        classId,
        date: '2026-11-11',
        students: [
          { studentId: 'active1', status: 'present' },
          { studentId: 'inactive1', status: 'present' },
        ],
      });
      assert.deepStrictEqual(writtenIds, ['active1']);
    });

    it('examinationService rejects inactive createMarks and excludes inactive students in getResults/getPositions', async () => {
      const stuId = new mongoose.Types.ObjectId().toString();
      const examId = new mongoose.Types.ObjectId().toString();
      stubMethod(models.Student, 'findById', () =>
        makeChain({ _id: stuId, status: 'EXPELLED', passedOut: true })
      );

      await assert.rejects(
        () => examinationService.createMarks({ examId, studentId: stuId, obtainedMarks: 20, totalMarks: 30 }),
        (err) => err.status === 400 && /Cannot record marks for inactive student/i.test(err.message)
      );

      const studentA = { _id: 'a1', status: 'ACTIVE', passedOut: false };
      studentA.toObject = () => ({ _id: 'a1', status: 'ACTIVE', passedOut: false });
      const studentX = { _id: 'x1', status: 'EXPELLED', passedOut: true };
      studentX.toObject = () => ({ _id: 'x1', status: 'EXPELLED', passedOut: true });
      const examDoc = { _id: 'e1', classId: { _id: 'c1' } };
      examDoc.toObject = () => ({ _id: 'e1', classId: { _id: 'c1' } });

      const docA = { _id: 'r1', position: 1, studentId: studentA, examId: examDoc, totalMarks: 100, obtainedMarks: 80 };
      const docB = { _id: 'r2', position: 2, studentId: studentX, examId: examDoc, totalMarks: 100, obtainedMarks: 95 };
      const mockResults = [
        { ...docA, toObject: () => ({ ...docA }) },
        { ...docB, toObject: () => ({ ...docB }) },
      ];
      stubMethod(models.ExamResult, 'find', () => makeChain(mockResults));

      const defaultResults = await examinationService.getResults({});
      assert.strictEqual(defaultResults.length, 1);
      assert.strictEqual(defaultResults[0].student.id, 'a1');

      const withInactive = await examinationService.getResults({ includeInactive: true });
      assert.strictEqual(withInactive.length, 2);

      const posDefault = await examinationService.getPositions({});
      assert.strictEqual(posDefault.length, 1);
      assert.strictEqual(posDefault[0].position, 1);
      assert.strictEqual(posDefault[0].student.id, 'a1');
    });

    it('hostelService enforces active internal students while keeping external boarders & historical cash', async () => {
      stubMethod(models.Student, 'findById', () =>
        makeChain({ _id: 's_out', status: 'GRADUATED', passedOut: true })
      );

      await assert.rejects(
        () => hostelService.createRegistration({ registrationType: 'internal', studentId: 's_out' }),
        (err) => err.status === 400 && /Cannot register inactive student/i.test(err.message)
      );

      stubMethod(models.HostelChallan, 'find', (q) => {
        if (q.advanceApplied) return makeChain([]);
        return makeChain([
          {
            _id: 'hc1',
            challanNumber: 'HC-1',
            status: 'PENDING',
            totalAmount: 5000,
            registrationId: {
              _id: 'reg1',
              registrationType: 'internal',
              studentId: { _id: 's_exp', status: 'EXPELLED', passedOut: true },
            },
          },
          {
            _id: 'hc2',
            challanNumber: 'HC-2',
            status: 'PENDING',
            totalAmount: 6000,
            registrationId: {
              _id: 'reg2',
              registrationType: 'external',
              studentId: null,
              externalName: 'Guest',
            },
          },
        ]);
      });
      stubMethod(models.HostelCreditLedger, 'find', () => makeChain([]));

      const activeOnlyHostelChallans = await hostelService.getChallans({ studentStatus: 'ACTIVE' });
      assert.strictEqual(activeOnlyHostelChallans.data.length, 1);
      assert.strictEqual(activeOnlyHostelChallans.data[0].challanNumber, 'HC-2');

      const allHostelChallans = await hostelService.getChallans({ studentStatus: 'all' });
      assert.strictEqual(allHostelChallans.data.length, 2);
    });
  });
});
