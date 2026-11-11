const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const models = require('../src/models');
const feesReports = require('../src/services/reports/fees.reports');
const examReports = require('../src/services/reports/examination.reports');
const attAcadReports = require('../src/services/reports/attendanceAcademics.reports');

const OID = (seed) => new mongoose.Types.ObjectId(Buffer.from(String(seed)).toString('hex').slice(0, 24).padEnd(24, '0'));

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
    catch: (reject) => Promise.resolve(resolvedValue).catch(reject),
  };
  return chain;
}

describe('Academic, Examination, Attendance & Fee Reports + All Actions (Pages 11–31)', () => {
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
    while (restorations.length > 0) restorations.pop()();
  });

  const adminUser = {
    id: OID('adm1').toString(),
    role: 'SUPER_ADMIN',
    name: 'Academic Dean',
    email: 'dean@concordia.edu.pk',
    isSuper: true,
    permissions: { all: true },
  };

  function stubSharedModels() {
    stubMethod(models.AcademicSession, 'findOne', () =>
      makeChain({ _id: OID('ses1'), name: '2026 - 2027', isActive: true, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })
    );
    stubMethod(models.AcademicSession, 'findById', () =>
      makeChain({ _id: OID('ses1'), name: '2026 - 2027', isActive: true })
    );
    stubMethod(models.Program, 'find', () => makeChain([{ _id: OID('prg1'), name: 'FSc Pre-Medical' }]));
    stubMethod(models.Class, 'find', () => makeChain([{ _id: OID('cls1'), name: '1st Year', programId: { _id: OID('prg1'), name: 'FSc Pre-Medical' } }]));
    stubMethod(models.Section, 'find', () => makeChain([{ _id: OID('sec1'), name: 'Section A' }]));
    stubMethod(models.Subject, 'find', () => makeChain([{ _id: OID('sub1'), name: 'Physics', code: 'PHY' }]));
    stubMethod(models.FeeHead, 'find', () => makeChain([]));
    stubMethod(models.User, 'find', () => makeChain([]));
    stubMethod(models.Staff, 'find', () => makeChain([]));
    stubMethod(models.ActivityLog, 'create', () => Promise.resolve({}));
  }

  // -------------------------------------------------------------------------
  // Fees Reports (Pages 13, 14, 15, 18) & All 5 Fee Actions
  // -------------------------------------------------------------------------

  it('P13, P14, P15 & log-fee-reminder action: covers installment schedule, overdue defaulters, upcoming reminders & logging', async () => {
    stubSharedModels();
    const stuId = OID('stu1');
    const chlId1 = OID('chl1');
    const chlId2 = OID('chl2');
    const now = new Date();
    const pastDue = new Date(now.getTime() - 10 * 86400000);
    const soonDue = new Date(now.getTime() + 5 * 86400000);

    stubMethod(models.Student, 'find', () =>
      makeChain([
        {
          _id: stuId,
          fName: 'Bilal',
          lName: 'Shah',
          rollNumber: 'FSC-101',
          parentOrGuardianPhone: '03001112233',
          programId: { _id: OID('prg1'), name: 'FSc Pre-Medical' },
          classId: { _id: OID('cls1'), name: '1st Year' },
          sectionId: { _id: OID('sec1'), name: 'A' },
          status: 'ACTIVE',
          passedOut: false,
          installments: [
            { installmentNumber: 1, amount: 15000, paidAmount: 15000, status: 'PAID', dueDate: pastDue },
            { installmentNumber: 2, amount: 15000, paidAmount: 5000, status: 'PARTIAL', dueDate: pastDue },
            { installmentNumber: 3, amount: 10000, paidAmount: 0, status: 'PENDING', dueDate: soonDue },
          ],
        },
      ])
    );
    stubMethod(models.FeeChallan, 'find', () =>
      makeChain([
        { _id: chlId1, studentId: stuId, installmentNumber: 2, netPayable: 15000, paidAmount: 5000, dueDate: pastDue, status: 'PARTIAL', challanHeads: [] },
        { _id: chlId2, studentId: stuId, installmentNumber: 3, netPayable: 10000, paidAmount: 0, dueDate: soonDue, status: 'PENDING', challanHeads: [] },
      ])
    );
    stubMethod(models.ExtraChallan, 'find', () => makeChain([]));
    stubMethod(models.FeeReminderLog, 'find', () => makeChain([]));

    // P13 Installment Schedule with comma-separated multi-select status
    const p13All = await feesReports.HANDLERS['fees-installment-schedule']({}, adminUser);
    assert.strictEqual(p13All.rows.length, 3);
    const p13Multi = await feesReports.HANDLERS['fees-installment-schedule']({ status: 'PAID,PENDING' }, adminUser);
    assert.strictEqual(p13Multi.rows.length, 2);

    // P14 Overdue Defaulters + actionContext
    const p14 = await feesReports.HANDLERS['fees-defaulters-overdue']({}, adminUser);
    assert.strictEqual(p14.rows.length, 1);
    assert.strictEqual(p14.rows[0].actionContext.studentId, String(stuId));

    // P15 Upcoming Reminders (strictly future within window, never overdue!)
    const p15 = await feesReports.HANDLERS['fees-upcoming-reminders']({ dueWindowDays: 10 }, adminUser);
    assert.strictEqual(p15.rows.length, 1);
    assert.strictEqual(p15.rows[0].amount, 'Rs 10,000');

    // log-fee-reminder action validation & success
    await assert.rejects(
      () => feesReports.ACTIONS['log-fee-reminder']({ studentId: 'invalid' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    let createdLog = null;
    stubMethod(models.FeeReminderLog, 'create', async (doc) => {
      createdLog = { ...doc, _id: OID('rem1') };
      return createdLog;
    });
    const remRes = await feesReports.ACTIONS['log-fee-reminder'](
      { studentId: String(stuId), challanId: String(chlId1), installmentNumber: 2, channel: 'WHATSAPP', status: 'SENT', contactOutcome: 'Promised Friday' },
      { reqUser: adminUser }
    );
    assert.strictEqual(remRes.ok, true);
    assert.strictEqual(createdLog.channel, 'WHATSAPP');
    assert.strictEqual(createdLog.status, 'SENT');
  });

  it('P17 Concession actions (create, approve, reject) & P18 save-cashier-reconciliation action', async () => {
    stubSharedModels();
    const stuId = OID('stu2');
    const reqId = OID('creq1');
    const cshId = OID('csh1');

    // P17 row disabledActions check on already-approved/synthetic concessions
    stubMethod(models.FeeConcessionRequest, 'find', () =>
      makeChain([
        { _id: reqId, studentId: { _id: stuId, fName: 'Sara', lName: 'Ali', rollNumber: 'R-2', programId: { name: 'FSc' }, tuitionFee: 50000 }, concessionType: 'MERIT', amount: 5000, status: 'PENDING', reason: 'Top 5%' },
      ])
    );
    stubMethod(models.FeeChallan, 'find', () => makeChain([]));
    stubMethod(models.ExtraChallan, 'find', () => makeChain([]));
    stubMethod(models.Student, 'find', () =>
      makeChain([{ _id: OID('stu3'), fName: 'Zain', lName: 'Khan', rollNumber: 'R-3', programId: { name: 'FSc' }, tuitionFee: 50000, isScholarship100: true, status: 'ACTIVE' }])
    );
    const p17 = await feesReports.HANDLERS['fees-discounts-concessions']({}, adminUser);
    assert.strictEqual(p17.rows.length, 2);
    const pendingRow = p17.rows.find((r) => r.id === String(reqId));
    const scholarRow = p17.rows.find((r) => r.id.startsWith('scholarship-'));
    assert.strictEqual(pendingRow.disabledActions, undefined);
    assert.deepStrictEqual(scholarRow.disabledActions, ['approve-concession', 'reject-concession']);

    // create-concession validation + success
    await assert.rejects(
      () => feesReports.ACTIONS['create-concession']({ studentId: '' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    stubMethod(models.Student, 'findById', () => makeChain({ _id: stuId, fName: 'Sara', lName: 'Ali', tuitionFee: 50000, sessionId: OID('ses1') }));
    stubMethod(models.FeeConcessionRequest, 'create', async (doc) => ({ _id: reqId, ...doc }));
    const createRes = await feesReports.ACTIONS['create-concession'](
      { studentId: String(stuId), concessionType: 'MERIT', grossAmount: 50000, amount: 5000, reason: 'Board position' },
      { reqUser: adminUser }
    );
    assert.strictEqual(createRes.ok, true);
    assert.strictEqual(createRes.record.status, 'PENDING');

    // approve-concession & reject-concession (validation + success)
    await assert.rejects(
      () => feesReports.ACTIONS['approve-concession']({ requestId: 'invalid' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => feesReports.ACTIONS['reject-concession']({ requestId: 'invalid' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    const reqDoc = {
      _id: reqId,
      concessionType: 'MERIT',
      amount: 5000,
      status: 'PENDING',
      reason: 'Board position',
      async save() { this.saved = true; },
    };
    stubMethod(models.FeeConcessionRequest, 'findById', () => Promise.resolve(reqDoc));
    const appRes = await feesReports.ACTIONS['approve-concession']({ requestId: String(reqId), remarks: 'Verified' }, { reqUser: adminUser });
    assert.strictEqual(appRes.ok, true);
    assert.strictEqual(reqDoc.status, 'APPROVED');

    const rejRes = await feesReports.ACTIONS['reject-concession']({ requestId: String(reqId), remarks: 'Duplicate' }, { reqUser: adminUser });
    assert.strictEqual(rejRes.ok, true);
    assert.strictEqual(reqDoc.status, 'REJECTED');

    // P18 Cashier Reconciliation + save-cashier-reconciliation action
    stubMethod(models.FeePaymentReceipt, 'find', () =>
      makeChain([
        { _id: OID('rcp1'), amountPaid: 8000, paymentMode: 'Cash', recordedBy: { _id: cshId, name: 'Cashier One' } },
        { _id: OID('rcp2'), amountPaid: 4000, paymentMode: 'Online', recordedBy: { _id: cshId, name: 'Cashier One' } },
      ])
    );
    stubMethod(models.FinanceClosing, 'find', () => makeChain([]));
    const p18 = await feesReports.HANDLERS['fees-cashier-reconciliation']({}, adminUser);
    assert.strictEqual(p18.rows.length, 1);
    assert.strictEqual(p18.rows[0].actionContext.cashCollected, 8000);

    stubMethod(models.FinanceClosing, 'findOne', () => makeChain(null));
    stubMethod(models.FinanceClosing, 'create', async (doc) => ({ _id: OID('clsng1'), ...doc }));
    const reconRes = await feesReports.ACTIONS['save-cashier-reconciliation'](
      { date: '2026-10-20', cashierId: String(cshId), cashierName: 'Cashier One', openingCash: 1000, cashCollected: 8000, cashCounted: 9000, bankReference: 'DEP-99' },
      { reqUser: adminUser }
    );
    assert.strictEqual(reconRes.ok, true);
    assert.strictEqual(reconRes.record.variance, 0);
  });

  // -------------------------------------------------------------------------
  // Examination Reports (Pages 20, 21, 22, 24, 25, 26, 27) & All 3 Exam Actions
  // -------------------------------------------------------------------------

  it('P20, P21, P22, P24, P25, P26, P27 & multi-select filters render complete datasets', async () => {
    stubSharedModels();
    const prgId = OID('prg1');
    const clsId = OID('cls1');
    const secId = OID('sec1');
    const sub1 = OID('sub1');
    const sub2 = OID('sub2');
    const exId = OID('exm1');
    const tchId = OID('tch1');
    const s1 = OID('st1');
    const s2 = OID('st2');

    const examDoc = {
      _id: exId,
      examName: 'Mid Term 2026',
      programId: { _id: prgId, name: 'FSc Pre-Medical' },
      classId: { _id: clsId, name: '1st Year' },
      sessionId: OID('ses1'),
      passPercentage: 40,
      resultLocked: false,
      schedule: [
        { subjectId: { _id: sub1, name: 'Physics', code: 'PHY' }, totalMarks: 100, passMarks: 40 },
        { subjectId: { _id: sub2, name: 'Chemistry', code: 'CHM' }, totalMarks: 100, passMarks: 40 },
      ],
    };
    const studentsList = [
      { _id: s1, fName: 'Ayesha', lName: 'Khan', rollNumber: '101', programId: { _id: prgId, name: 'FSc Pre-Medical' }, classId: { _id: clsId, name: '1st Year' }, sectionId: { _id: secId, name: 'A' }, status: 'ACTIVE', gender: 'Female' },
      { _id: s2, fName: 'Usman', lName: 'Ali', rollNumber: '102', programId: { _id: prgId, name: 'FSc Pre-Medical' }, classId: { _id: clsId, name: '1st Year' }, sectionId: { _id: secId, name: 'A' }, status: 'ACTIVE', gender: 'Male' },
    ];
    const marksList = [
      { _id: OID('m1'), examId: exId, studentId: s1, subjectId: sub1, totalMarks: 100, obtainedMarks: 92, verified: true, isAbsent: false },
      { _id: OID('m2'), examId: exId, studentId: s1, subjectId: sub2, totalMarks: 100, obtainedMarks: 88, verified: true, isAbsent: false },
      { _id: OID('m3'), examId: exId, studentId: s2, subjectId: sub1, totalMarks: 100, obtainedMarks: 25, verified: false, isAbsent: false },
      { _id: OID('m4'), examId: exId, studentId: s2, subjectId: sub2, totalMarks: 100, obtainedMarks: 55, verified: false, isAbsent: false },
    ];

    stubMethod(models.Exam, 'find', () => makeChain([examDoc]));
    stubMethod(models.Exam, 'findOne', () => makeChain(examDoc));
    stubMethod(models.Exam, 'findById', () => makeChain(examDoc));
    stubMethod(models.Student, 'find', () => makeChain(studentsList));
    stubMethod(models.Student, 'findById', () => makeChain(studentsList[0]));
    stubMethod(models.ExamMarks, 'find', (q = {}) => {
      let list = marksList;
      if (q.studentId) {
        const ids = Array.isArray(q.studentId.$in) ? q.studentId.$in.map(String) : [String(q.studentId)];
        list = list.filter((m) => ids.includes(String(m.studentId)));
      }
      return makeChain(list);
    });
    stubMethod(models.ExamMarks, 'findOne', () => makeChain(marksList[0]));
    stubMethod(models.GradeScheme, 'findById', () => makeChain(null));
    stubMethod(models.GradeScheme, 'findOne', () => makeChain(null));
    stubMethod(models.TeacherMapping, 'find', () =>
      makeChain([{ classId: clsId, subjectId: sub1, teacherId: { _id: tchId, name: 'Prof. Tariq' }, mappingType: 'SUBJECT' }])
    );
    stubMethod(models.Attendance, 'find', () => makeChain([]));
    stubMethod(models.Leave, 'find', () => makeChain([]));

    // P19 Institutional Analysis
    const p19 = await examReports.HANDLERS['exam-institutional-analysis']({ examId: String(exId) }, adminUser);
    assert.ok(Array.isArray(p19.rows) && p19.rows.length >= 1);
    assert.strictEqual(p19.charts.length, 1);
    assert.strictEqual(p19.charts[0].xKey, 'programName');
    assert.strictEqual(p19.charts[0].dataKey, 'passRate');
    assert.ok(p19.charts[0].series.every((s) => typeof s.dataKey === 'string' && s.dataKey.length > 0));
    assert.strictEqual(typeof p19.charts[0].data[0].passRate, 'number');

    // P20 Class/Section Gazette
    const p20 = await examReports.HANDLERS['exam-class-gazette']({ examId: String(exId) }, adminUser);
    assert.strictEqual(p20.rows.length, 2);
    assert.strictEqual(p20.rows[0].rollNumber, '101');

    // P21 Student Result Card
    const p21 = await examReports.HANDLERS['exam-student-result-card']({ studentId: String(s1), examId: String(exId) }, adminUser);
    assert.strictEqual(p21.rows.length, 2);
    assert.strictEqual(p21.kpis[0].label, 'Total marks');
    assert.strictEqual(p21.kpis[0].value, '180 / 200');

    // P22 Subject Performance (+ comma-separated teacherId)
    const p22 = await examReports.HANDLERS['exam-subject-performance']({ examId: String(exId), teacherId: String(tchId) }, adminUser);
    assert.strictEqual(p22.rows.length, 1);
    assert.strictEqual(p22.rows[0].subjectName, 'Physics');

    // P23 Position Holders
    const p23 = await examReports.HANDLERS['exam-position-holders']({ examId: String(exId) }, adminUser);
    assert.strictEqual(p23.rows.length, 2);
    assert.strictEqual(p23.rows[0].position, 1);
    assert.strictEqual(p23.rows[0].rollNumber, '101');

    // P24 Failures & Supplementary (+ multi-select eligibility)
    const p24 = await examReports.HANDLERS['exam-failures-supplementary']({ examId: String(exId), eligibility: 'SUPPLEMENTARY,REPEAT' }, adminUser);
    assert.strictEqual(p24.rows.length, 1);
    assert.match(p24.rows[0].failedSubjects, /Physics/);

    // P25 Grade Distribution
    const p25 = await examReports.HANDLERS['exam-grade-distribution']({ examId: String(exId) }, adminUser);
    assert.ok(p25.rows.length >= 2);
    assert.strictEqual(p25.charts.length, 1);
    assert.strictEqual(p25.charts[0].xKey, 'grade');
    assert.strictEqual(p25.charts[0].dataKey, 'students');
    assert.strictEqual(p25.charts[0].series[0].dataKey, 'students');
    assert.strictEqual(typeof p25.charts[0].data[0].students, 'number');

    // P26 Marks Verification (+ actionContext)
    const p26 = await examReports.HANDLERS['exam-marks-verification']({ examId: String(exId) }, adminUser);
    assert.strictEqual(p26.rows.length, 2);
    assert.strictEqual(p26.rows[0].actionContext.examId, String(exId));

    // P27 Exam Attendance & Absenteeism
    const p27 = await examReports.HANDLERS['exam-attendance-absenteeism']({ examId: String(exId) }, adminUser);
    assert.strictEqual(p27.rows.length, 2);
    assert.strictEqual(p27.rows[0].registered, 2);
    assert.strictEqual(p27.rows[0].appeared, 2);
  });

  it('Exam Actions: save-grade-scheme (presets, custom text, "false"), verify-subject-marks & toggle-exam-lock', async () => {
    stubSharedModels();
    const exId = OID('ex2');
    const subId = OID('sb2');

    await assert.rejects(
      () => examReports.ACTIONS['save-grade-scheme']({ name: '' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => examReports.ACTIONS['save-grade-scheme']({ name: 'Bad', bands: [] }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => examReports.ACTIONS['verify-subject-marks']({ examId: 'bad', subjectId: 'bad' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => examReports.ACTIONS['toggle-exam-lock']({ examId: 'bad' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );

    let createdScheme = null;
    stubMethod(models.GradeScheme, 'updateMany', () => Promise.resolve({ modifiedCount: 1 }));
    stubMethod(models.GradeScheme, 'create', async (doc) => {
      createdScheme = { ...doc, _id: OID('gs1'), toObject() { return this; } };
      return createdScheme;
    });
    const gsRes = await examReports.ACTIONS['save-grade-scheme'](
      { name: 'Custom Matric', passPercentage: 40, preset: 'STRICT', bandsText: 'A+:90-100:4.0\nF:0-39:0.0', isDefault: 'false' },
      { reqUser: adminUser }
    );
    assert.strictEqual(gsRes.saved, true);
    assert.strictEqual(createdScheme.isDefault, false);
    assert.strictEqual(createdScheme.bands.length, 2);

    // verify-subject-marks with string "false" must unverify!
    let updatedMarksSet = null;
    stubMethod(models.ExamMarks, 'updateMany', (_q, u) => {
      updatedMarksSet = u.$set;
      return Promise.resolve({ modifiedCount: 12 });
    });
    const verRes = await examReports.ACTIONS['verify-subject-marks'](
      { examId: String(exId), subjectId: String(subId), verified: 'false' },
      { reqUser: adminUser }
    );
    assert.strictEqual(verRes.verified, false);
    assert.strictEqual(updatedMarksSet.verified, false);
    assert.strictEqual(verRes.modifiedCount, 12);

    // toggle-exam-lock with string "false" must unlock!
    const fakeExam = { _id: exId, examName: 'Mid Term', resultLocked: true, async save() { this.saved = true; } };
    stubMethod(models.Exam, 'findById', () => Promise.resolve(fakeExam));
    const lockRes = await examReports.ACTIONS['toggle-exam-lock'](
      { examId: String(exId), resultLocked: 'false' },
      { reqUser: adminUser }
    );
    assert.strictEqual(lockRes.resultLocked, false);
    assert.strictEqual(fakeExam.resultLocked, false);
    assert.strictEqual(fakeExam.saved, true);
  });

  // -------------------------------------------------------------------------
  // Attendance & Academics Reports (Pages 28–31) & All 3 Actions
  // -------------------------------------------------------------------------

  it('P28, P29, P30, P31 + attendance & syllabus actions handle data, disabledActions & string booleans', async () => {
    stubSharedModels();
    const prgId = OID('prg1');
    const clsId = OID('cls1');
    const secId = OID('sec1');
    const sub1 = OID('sub1');
    const stu1 = OID('stA');
    const stu2 = OID('stB');
    const planId = OID('pln1');
    const top1Id = OID('top1');

    stubMethod(models.Holiday, 'find', () => makeChain([]));
    stubMethod(models.AttendanceSkip, 'find', () => makeChain([]));
    stubMethod(models.Student, 'find', () =>
      makeChain([
        { _id: stu1, fName: 'Hina', lName: 'Malik', rollNumber: 'A-1', programId: { _id: prgId, name: 'FSc' }, classId: { _id: clsId, name: '1st Year' }, sectionId: { _id: secId, name: 'A' }, status: 'ACTIVE' },
        { _id: stu2, fName: 'Saad', lName: 'Raza', rollNumber: 'A-2', programId: { _id: prgId, name: 'FSc' }, classId: { _id: clsId, name: '1st Year' }, sectionId: { _id: secId, name: 'A' }, status: 'ACTIVE' },
      ])
    );
    stubMethod(models.Attendance, 'find', () =>
      makeChain([
        { _id: OID('at1'), studentId: stu1, role: 'STUDENT', date: '2026-10-15', status: 'PRESENT', markedAt: new Date('2026-10-15T08:15:00Z') },
        { _id: OID('at2'), studentId: stu2, role: 'STUDENT', date: '2026-10-15', status: 'ABSENT', markedAt: new Date('2026-10-15T08:15:00Z') },
      ])
    );
    stubMethod(models.Leave, 'find', () => makeChain([]));

    // P28 Daily Student Attendance + multi-select status
    const p28 = await attAcadReports.HANDLERS['attendance-daily-student']({ date: '2026-10-15', status: 'PRESENT,ABSENT' }, adminUser);
    assert.strictEqual(p28.rows.length, 2);
    assert.strictEqual(p28.rows[0].actionContext.studentId, String(stu1));

    // P29 Monthly Student Register
    const p29 = await attAcadReports.HANDLERS['attendance-monthly-register']({ month: '2026-10' }, adminUser);
    assert.strictEqual(p29.rows.length, 2);

    // P30 Low Attendance Shortage (< 75%)
    const p30 = await attAcadReports.HANDLERS['attendance-low-shortage']({ asOfDate: '2026-10-31', threshold: 75 }, adminUser);
    assert.strictEqual(p30.rows.length, 1);
    assert.strictEqual(p30.rows[0].studentName, 'Saad Raza');

    // P31 Syllabus Coverage + disabledActions when 0 topics
    stubMethod(models.SyllabusPlan, 'find', () =>
      makeChain([
        {
          _id: planId,
          programId: { _id: prgId, name: 'FSc' },
          classId: { _id: clsId, name: '1st Year' },
          subjectId: { _id: sub1, name: 'Physics' },
          teacherId: { _id: OID('tch1'), name: 'Prof. Tariq' },
          term: 'Full Year',
          topics: [],
        },
      ])
    );
    stubMethod(models.SubjectClassMapping, 'find', () => makeChain([]));
    stubMethod(models.TeacherMapping, 'find', () => makeChain([]));
    const p31 = await attAcadReports.HANDLERS['academics-syllabus-coverage']({}, adminUser);
    assert.strictEqual(p31.rows.length, 1);
    assert.deepStrictEqual(p31.rows[0].disabledActions, ['toggle-topic-status']);

    // correct-attendance action (validation + update)
    await assert.rejects(
      () => attAcadReports.ACTIONS['correct-attendance']({ studentId: 'bad', newStatus: 'PRESENT' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    const attDoc = { _id: OID('at2'), studentId: stu2, date: '2026-10-15', status: 'ABSENT', correctionPending: true, correctionAudit: [], async save() { this.saved = true; }, toObject() { return { _id: this._id, studentId: this.studentId, date: this.date, status: this.status, correctionPending: this.correctionPending }; } };
    stubMethod(models.Student, 'findById', () => makeChain({ _id: stu2, fName: 'Saad', lName: 'Raza', status: 'ACTIVE' }));
    stubMethod(models.Attendance, 'findById', () => Promise.resolve(attDoc));
    const corrRes = await attAcadReports.ACTIONS['correct-attendance'](
      { attendanceId: String(attDoc._id), studentId: String(stu2), date: '2026-10-15', newStatus: 'LATE', correctionPending: 'false', reason: 'Medical slip' },
      { reqUser: adminUser }
    );
    assert.ok(corrRes);
    assert.strictEqual(attDoc.saved, true);
    assert.strictEqual(attDoc.status, 'LATE');
    assert.strictEqual(attDoc.correctionPending, false);
    assert.strictEqual(attDoc.correctionAudit.length, 1);

    // upsert-syllabus-topic + toggle-topic-status actions (including 'false' boolean & nextTopicId)
    await assert.rejects(
      () => attAcadReports.ACTIONS['upsert-syllabus-topic']({ title: '' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => attAcadReports.ACTIONS['toggle-topic-status']({ planId: 'invalid', topicId: 'invalid' }, { reqUser: adminUser }),
      (err) => err.statusCode === 400
    );
    const topicObj = { _id: top1Id, title: 'Kinematics', completed: true, delayReason: '', toObject() { return { _id: this._id, title: this.title, completed: this.completed, delayReason: this.delayReason }; } };
    const topicsArr = [topicObj];
    topicsArr.id = (id) => topicsArr.find((t) => String(t._id) === String(id)) || null;
    const planDoc = {
      _id: planId,
      topics: topicsArr,
      async save() { this.saved = true; },
      toObject() { return { _id: this._id, topics: [...this.topics] }; },
    };
    stubMethod(models.SyllabusPlan, 'findById', () => Promise.resolve(planDoc));

    const upRes = await attAcadReports.ACTIONS['upsert-syllabus-topic'](
      { planId: String(planId), title: 'Dynamics', completed: 'false', plannedDate: '2026-10-30' },
      { reqUser: adminUser }
    );
    assert.ok(upRes);
    assert.strictEqual(planDoc.saved, true);
    assert.strictEqual(planDoc.topics.length, 2);
    assert.strictEqual(planDoc.topics[1].completed, false); // 'false' must not become true!

    planDoc.saved = false;
    const togRes = await attAcadReports.ACTIONS['toggle-topic-status'](
      { planId: String(planId), nextTopicId: String(top1Id), completed: 'false', delayReason: 'Re-teach' },
      { reqUser: adminUser }
    );
    assert.ok(togRes);
    assert.strictEqual(planDoc.saved, true);
    assert.strictEqual(topicObj.completed, false);
    assert.strictEqual(topicObj.delayReason, 'Re-teach');
  });
});
