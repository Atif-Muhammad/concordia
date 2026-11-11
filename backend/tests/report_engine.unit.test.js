const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const models = require('../src/models');
const reportEngineService = require('../src/services/reportEngine.service');
const { REPORT_CATALOG, hasReportAccess } = reportEngineService;

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

describe('Concordia ERP Central Report Engine (Pages 2–48)', () => {
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
      restorations.pop()();
    }
  });

  const superUser = { id: OID('f001').toString(), role: 'SUPER_ADMIN', name: 'Principal Admin' };

  function stubEngineCommon() {
    stubMethod(models.InstituteSettings, 'findOne', () =>
      makeChain({ instituteName: 'Concordia College Peshawar', address: 'Peshawar' })
    );
    stubMethod(models.AcademicSession, 'findOne', () =>
      makeChain({ _id: OID('aa01'), name: '2026 - 2027', isActive: true, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })
    );
    stubMethod(models.AcademicSession, 'findById', () =>
      makeChain({ _id: OID('aa01'), name: '2026 - 2027', isActive: true, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })
    );
    stubMethod(models.AcademicSession, 'find', () =>
      makeChain([{ _id: OID('aa01'), name: '2026 - 2027', isActive: true }])
    );
    stubMethod(models.Program, 'find', () => makeChain([]));
    stubMethod(models.Class, 'find', () => makeChain([]));
    stubMethod(models.Section, 'find', () => makeChain([]));
    stubMethod(models.Subject, 'find', () => makeChain([]));
    stubMethod(models.FeeHead, 'find', () => makeChain([]));
    stubMethod(models.User, 'find', () => makeChain([]));
    stubMethod(models.Staff, 'find', () => makeChain([]));
    stubMethod(models.ActivityLog, 'create', () => Promise.resolve({}));
  }

  it('registers all 47 unique report templates (Pages 2–48) with zero campus references', () => {
    assert.strictEqual(REPORT_CATALOG.length, 47);

    const pages = REPORT_CATALOG.map((r) => r.pageNumber).sort((a, b) => a - b);
    const expectedPages = Array.from({ length: 47 }, (_, i) => i + 2);
    assert.deepStrictEqual(pages, expectedPages);

    const keys = new Set(REPORT_CATALOG.map((r) => r.key));
    assert.strictEqual(keys.size, 47);

    const serialized = JSON.stringify(REPORT_CATALOG).toLowerCase();
    assert(!serialized.includes('campusname'));
    assert(!serialized.includes('campusid'));
    assert(!serialized.includes('"campus'));
  });

  it('hasReportAccess enforces Super Admin, Report Centre module toggle & granular submodules', () => {
    const sampleDef = reportEngineService.getDefinition('fees-receivables-ageing');
    assert.ok(sampleDef);

    assert.strictEqual(hasReportAccess({ isSuper: true, permissions: { all: true } }, sampleDef), true);

    // Admin with Report Centre checkbox + unrelated granular actions
    assert.strictEqual(
      hasReportAccess(
        {
          isSuper: false,
          permissions: {
            modules: ['Report Centre', 'Students'],
            subModules: { Students: ['records'] },
            actions: { Students: { records: { read: true } } },
          },
        },
        sampleDef
      ),
      true
    );

    // Admin with restricted Fee Management submodule excluding reports -> denied
    assert.strictEqual(
      hasReportAccess(
        {
          isSuper: false,
          permissions: {
            modules: ['Fee Management'],
            subModules: { 'Fee Management': ['challans'] },
          },
        },
        sampleDef
      ),
      false
    );

    // Admin with Fee Management reports submodule -> allowed
    assert.strictEqual(
      hasReportAccess(
        {
          isSuper: false,
          permissions: {
            modules: ['Fee Management'],
            subModules: { 'Fee Management': ['reports'] },
          },
        },
        sampleDef
      ),
      true
    );
  });

  it('P4/P6/P8: deduplicates enrolled students and emits 1 row per missing document', async () => {
    stubEngineCommon();
    const stu1 = {
      _id: OID('1001'),
      fName: 'Sana',
      lName: 'Khan',
      rollNumber: 'FSC-01',
      status: 'ACTIVE',
      programId: { _id: OID('p001'), name: 'FSc Pre-Medical' },
      classId: { _id: OID('c001'), name: '1st Year' },
      sectionId: { _id: OID('s001'), name: 'Section A' },
      documents: { photograph: true, cnicCopy: false, matricDmc: false },
      admissionDate: new Date('2026-08-01'),
    };

    stubMethod(models.Student, 'find', () => makeChain([stu1]));
    stubMethod(models.FrontOfficeInquiry, 'find', () => makeChain([]));
    stubMethod(models.Section, 'find', () => makeChain([{ _id: OID('s001'), name: 'Section A', capacity: 40 }]));

    const missingRes = await reportEngineService.runReport('admissions-missing-documents', {}, superUser);
    assert.strictEqual(missingRes.rows.length, 2); // 1 row per missing doc (cnicCopy, matricDmc)
    assert.strictEqual(missingRes.kpis[0].value, '1'); // 1 student incomplete

    const enrollmentRes = await reportEngineService.runReport('admissions-enrollment-summary', {}, superUser);
    assert.strictEqual(enrollmentRes.rows.length, 1);

    const strengthRes = await reportEngineService.runReport('students-class-strength', {}, superUser);
    assert.strictEqual(strengthRes.rows.length, 1);
    assert.strictEqual(strengthRes.rows[0].total, 1);
  });

  it('P11: separates VOID receipts into secondaryTables and excludes from posted totals', async () => {
    stubEngineCommon();
    const postedReceipt = {
      _id: OID('r001'),
      receiptNo: 'RCP-101',
      amountPaid: 15000,
      paymentMode: 'Cash',
      status: 'POSTED',
      receiptType: 'CHALLAN_PAYMENT',
      paidDate: new Date('2026-10-05'),
      studentId: { _id: OID('1001'), fName: 'Ali', lName: 'Raza', rollNumber: 'R-01', programId: { _id: OID('p1'), name: 'ICS' } },
      challanId: { _id: OID('ch01'), challanNo: 'CH-101', challanHeads: [] },
      recordedBy: { _id: OID('u1'), name: 'Cashier A' },
    };
    const voidReceipt = {
      _id: OID('r002'),
      receiptNo: 'RCP-VOID-1',
      amountPaid: 50000,
      paymentMode: 'Bank Transfer',
      status: 'VOID',
      voidReason: 'Duplicate entry',
      voidedAt: new Date('2026-10-06'),
      studentId: { _id: OID('1001'), fName: 'Ali', lName: 'Raza', rollNumber: 'R-01', programId: { _id: OID('p1'), name: 'ICS' } },
      challanId: { _id: OID('ch01'), challanNo: 'CH-101' },
    };

    stubMethod(models.FeePaymentReceipt, 'find', (q) => {
      if (q && q.status === 'VOID') return makeChain([voidReceipt]);
      return makeChain([postedReceipt]);
    });
    stubMethod(models.FeeChallan, 'find', () => makeChain([]));

    const res = await reportEngineService.runReport('fees-collection-register', {}, superUser);
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.kpis[0].rawValue, 15000);
    assert.strictEqual(res.secondaryTables.length, 1);
    assert.strictEqual(res.secondaryTables[0].rows.length, 1);
    assert.match(res.secondaryTables[0].title, /Void/i);
  });

  it('P12 & P17: enforces running balance (opening + charges - credits === closing) and excludes PENDING concessions', async () => {
    stubEngineCommon();
    const stu = {
      _id: OID('1002'),
      fName: 'Zain',
      lName: 'Shah',
      rollNumber: 'ICS-09',
      tuitionFee: 30000,
      programId: { _id: OID('p1'), name: 'ICS' },
      classId: { _id: OID('c1'), name: 'Part I' },
      sessionId: { _id: OID('aa01'), name: '2026 - 2027' },
    };

    stubMethod(models.Student, 'findById', () => makeChain(stu));
    stubMethod(models.Student, 'findOne', () => makeChain(stu));
    stubMethod(models.Student, 'find', () => makeChain([stu]));
    stubMethod(models.FeeChallan, 'find', () =>
      makeChain([
        {
          _id: OID('ch02'),
          studentId: stu._id,
          challanNo: 'CH-200',
          status: 'PARTIAL',
          basePayable: 30000,
          headsAmount: 0,
          discountAmount: 0,
          paidAmount: 10000,
          installmentNumber: 1,
          createdAt: new Date('2026-09-01'),
        },
      ])
    );
    stubMethod(models.ExtraChallan, 'find', () => makeChain([]));
    stubMethod(models.StudentCreditLedger, 'find', () => makeChain([]));
    stubMethod(models.FeePaymentReceipt, 'find', () =>
      makeChain([
        {
          _id: OID('rp02'),
          receiptNo: 'RCP-200',
          studentId: stu._id,
          challanId: OID('ch02'),
          amountPaid: 10000,
          paymentMode: 'Cash',
          status: 'POSTED',
          receiptType: 'CHALLAN_PAYMENT',
          paidDate: new Date('2026-09-10'),
        },
      ])
    );
    stubMethod(models.FeeConcessionRequest, 'find', () =>
      makeChain([
        {
          _id: OID('cr1'),
          studentId: stu,
          concessionType: 'DISCOUNT',
          amount: 5000,
          grossAmount: 30000,
          status: 'APPROVED',
          approvedAt: new Date('2026-09-05'),
        },
        {
          _id: OID('cr2'),
          studentId: stu,
          concessionType: 'DISCOUNT',
          amount: 8000,
          grossAmount: 30000,
          status: 'PENDING', // Must NEVER reduce running balance or approved KPI
          createdAt: new Date('2026-09-12'),
        },
      ])
    );

    const ledgerRes = await reportEngineService.runReport(
      'fees-student-ledger',
      { studentId: String(stu._id) },
      superUser
    );
    const extra = ledgerRes.rawExtra;
    assert.strictEqual(extra.openingBalance + extra.totalCharges - extra.totalCredits, extra.closingBalance);
    // 30,000 charge - 5,000 approved concession - 10,000 paid = 15,000 (8,000 pending ignored)
    assert.strictEqual(extra.closingBalance, 15000);

    const discRes = await reportEngineService.runReport('fees-discounts-concessions', {}, superUser);
    assert.strictEqual(discRes.rows.length, 2);
    // KPI Approved concessions = 5000 only; Pending concession row retains gross 30000 net 30000
    assert.strictEqual(discRes.kpis[0].rawValue, 5000);
    const pendingRow = discRes.rows.find((r) => String(r.approvedBy).includes('PENDING'));
    assert.strictEqual(pendingRow._raw.netFee, 30000);
  });

  it('P16: ageing buckets sum exactly to total outstanding', async () => {
    stubEngineCommon();
    const stu = {
      _id: OID('1003'),
      fName: 'Hamza',
      lName: 'Ali',
      rollNumber: 'B-01',
      status: 'ACTIVE',
      programId: { _id: OID('p1'), name: 'BSCS' },
      classId: { _id: OID('c1'), name: 'Sem 1' },
      installments: [],
    };
    stubMethod(models.Student, 'find', () => makeChain([stu]));
    stubMethod(models.FeeChallan, 'find', () =>
      makeChain([
        { _id: OID('ch10'), studentId: stu._id, amount: 10000, paidAmount: 0, status: 'PENDING', dueDate: '2026-11-20' }, // not yet due
        { _id: OID('ch11'), studentId: stu._id, amount: 20000, paidAmount: 5000, status: 'PARTIAL', dueDate: '2026-10-25' }, // 1-30 overdue (15k)
        { _id: OID('ch12'), studentId: stu._id, amount: 12000, paidAmount: 0, status: 'OVERDUE', dueDate: '2026-09-25' }, // 31-60 overdue
        { _id: OID('ch13'), studentId: stu._id, amount: 8000, paidAmount: 0, status: 'OVERDUE', dueDate: '2026-08-01' }, // 61+ overdue
      ])
    );
    stubMethod(models.ExtraChallan, 'find', () => makeChain([]));

    const res = await reportEngineService.runReport('fees-receivables-ageing', { asOfDate: '2026-11-10' }, superUser);
    const bucketSum = res.rows.reduce((sum, r) => sum + Number(r._raw.amount || 0), 0);
    assert.strictEqual(bucketSum, 45000); // 10k + 15k + 12k + 8k
    assert.strictEqual(res.kpis[0].rawValue, bucketSum);
  });

  it('P19 & P23: computes weighted institution pass rate from student totals and excludes absent/withheld from merit rank', async () => {
    stubEngineCommon();
    const progA = { _id: OID('p010'), name: 'Prog Alpha' };
    const progB = { _id: OID('p011'), name: 'Prog Beta' };
    const cls1 = { _id: OID('c010'), name: 'Class 1' };
    const exA = { _id: OID('e010'), examName: 'Mid Term A', programId: progA, classId: cls1, passPercentage: 50, schedule: [] };
    const exB = { _id: OID('e011'), examName: 'Mid Term B', programId: progB, classId: cls1, passPercentage: 50, schedule: [] };

    const students = [
      { _id: OID('s1'), fName: 'Topper', lName: 'A', rollNumber: '01', status: 'ACTIVE', programId: progA, classId: cls1 },
      { _id: OID('s2'), fName: 'Fail', lName: 'B1', rollNumber: '02', status: 'ACTIVE', programId: progB, classId: cls1 },
      { _id: OID('s3'), fName: 'Fail', lName: 'B2', rollNumber: '03', status: 'ACTIVE', programId: progB, classId: cls1 },
      { _id: OID('s4'), fName: 'Fail', lName: 'B3', rollNumber: '04', status: 'ACTIVE', programId: progB, classId: cls1 },
      { _id: OID('s5'), fName: 'Fail', lName: 'B4', rollNumber: '05', status: 'ACTIVE', programId: progB, classId: cls1 },
      { _id: OID('s6'), fName: 'Withheld', lName: 'A2', rollNumber: '06', status: 'ACTIVE', programId: progA, classId: cls1 },
      { _id: OID('s7'), fName: 'Absent', lName: 'A3', rollNumber: '07', status: 'ACTIVE', programId: progA, classId: cls1 },
    ];
    const marks = [
      { _id: OID('m1'), examId: exA._id, studentId: students[0]._id, subjectId: { _id: OID('sub1'), name: 'Math' }, obtainedMarks: 90, totalMarks: 100, isAbsent: false },
      { _id: OID('m2'), examId: exB._id, studentId: students[1]._id, subjectId: { _id: OID('sub1'), name: 'Math' }, obtainedMarks: 30, totalMarks: 100, isAbsent: false },
      { _id: OID('m3'), examId: exB._id, studentId: students[2]._id, subjectId: { _id: OID('sub1'), name: 'Math' }, obtainedMarks: 30, totalMarks: 100, isAbsent: false },
      { _id: OID('m4'), examId: exB._id, studentId: students[3]._id, subjectId: { _id: OID('sub1'), name: 'Math' }, obtainedMarks: 30, totalMarks: 100, isAbsent: false },
      { _id: OID('m5'), examId: exB._id, studentId: students[4]._id, subjectId: { _id: OID('sub1'), name: 'Math' }, obtainedMarks: 30, totalMarks: 100, isAbsent: false },
      { _id: OID('m6'), examId: exA._id, studentId: students[5]._id, subjectId: { _id: OID('sub1'), name: 'Math' }, obtainedMarks: 95, totalMarks: 100, isWithheld: true },
      { _id: OID('m7'), examId: exA._id, studentId: students[6]._id, subjectId: { _id: OID('sub1'), name: 'Math' }, obtainedMarks: 0, totalMarks: 100, isAbsent: true },
    ];

    stubMethod(models.Exam, 'find', () => makeChain([exA, exB]));
    stubMethod(models.GradeScheme, 'findById', () => makeChain(null));
    stubMethod(models.GradeScheme, 'findOne', () => makeChain(null));
    stubMethod(models.Student, 'find', () => makeChain(students));
    stubMethod(models.ExamMarks, 'find', () => makeChain(marks));

    const instRes = await reportEngineService.runReport('exam-institutional-analysis', {}, superUser);
    // Prog A has 1 pass, 1 withheld, 1 absent (appeared = 2); Prog B has 4 failed (appeared = 4) -> total appeared = 6, passed = 1 -> 16.7% (NOT average of program pass %)
    assert.strictEqual(instRes.totalsRow.appeared, 6);
    assert.strictEqual(instRes.totalsRow.passed, 1);
    assert.strictEqual(instRes.totalsRow.passPct, '16.7%');

    stubMethod(models.Exam, 'find', () => makeChain([exA]));
    stubMethod(models.Student, 'find', () => makeChain([students[0], students[5], students[6]]));
    stubMethod(models.ExamMarks, 'find', () => makeChain([marks[0], marks[5], marks[6]]));

    const meritRes = await reportEngineService.runReport('exam-position-holders', { examId: String(exA._id) }, superUser);
    const ranked = meritRes.rows.filter((r) => r.position !== '—');
    assert.strictEqual(ranked.length, 1);
    assert.strictEqual(ranked[0].studentName, 'Topper A');
    const excluded = meritRes.rows.filter((r) => r.position === '—');
    assert.strictEqual(excluded.length, 2); // Withheld + Absent excluded from rank
  });

  it('P41: computes onHand = opening + receipts + adjustments - issues', async () => {
    stubEngineCommon();
    const item1 = {
      _id: OID('i001'),
      sku: 'PAP-01',
      itemName: 'A4 Paper Rim',
      category: 'Stationery',
      openingStock: 20,
      reorderLevel: 15,
      unit: 'Ream',
      unitPrice: 1200,
    };
    const movements = [
      { itemId: item1._id, type: 'OPENING', quantity: 20, date: '2026-10-01' },
      { itemId: item1._id, type: 'RECEIPT', quantity: 10, date: '2026-10-05' },
      { itemId: item1._id, type: 'ADJUSTMENT', quantity: 2, date: '2026-10-10' },
      { itemId: item1._id, type: 'ISSUE', quantity: 20, date: '2026-10-15' },
    ];
    stubMethod(models.InventoryItem, 'find', () => makeChain([item1]));
    stubMethod(models.StockMovement, 'find', () => makeChain(movements));

    const res = await reportEngineService.runReport('inventory-stock-on-hand', { asOfDate: '2026-10-31' }, superUser);
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].onHand, 12); // 20 + 10 + 2 - 20 = 12
    assert.strictEqual(res.rows[0].status, 'LOW'); // 12 <= 15 reorderLevel
  });

  it('P44 & P48: aggregates risk per unique student without duplication and logs exports without PII', async () => {
    stubEngineCommon();
    const riskStu = {
      _id: OID('9001'),
      fName: 'Risk',
      lName: 'Student',
      rollNumber: 'RK-1',
      programId: { _id: OID('p1'), name: 'ICS' },
    };

    stubMethod(models.Student, 'find', () => makeChain([riskStu]));
    stubMethod(models.Attendance, 'find', () =>
      makeChain([
        { studentId: riskStu._id, status: 'ABSENT' },
        { studentId: riskStu._id, status: 'ABSENT' },
        { studentId: riskStu._id, status: 'PRESENT' },
      ])
    );
    stubMethod(models.FeeChallan, 'find', () =>
      makeChain([
        { studentId: riskStu._id, netPayable: 15000, paidAmount: 0, status: 'OVERDUE' },
        { studentId: riskStu._id, netPayable: 5000, paidAmount: 0, status: 'PENDING' },
      ])
    );
    stubMethod(models.ExamResult, 'find', () =>
      makeChain([
        { studentId: riskStu._id, percentage: 40, examId: { startDate: '2026-10-01' } },
        { studentId: riskStu._id, percentage: 35, examId: { startDate: '2026-11-01' } },
      ])
    );

    const riskRes = await reportEngineService.runReport('combined-student-risk-watchlist', {}, superUser);
    assert.strictEqual(riskRes.rows.length, 1); // Only 1 deduplicated student row
    assert.match(riskRes.rows[0].riskFlags, /Low Attendance/);
    assert.match(riskRes.rows[0].riskFlags, /Fee Balance/);
    assert.match(riskRes.rows[0].riskFlags, /Low Exam/);

    let savedExportPayload = null;
    stubMethod(models.ReportExportLog, 'create', async (doc) => {
      savedExportPayload = doc;
      return { ...doc, _id: OID('ex01') };
    });

    await reportEngineService.logExport(
      'combined-student-risk-watchlist',
      {
        format: 'EXCEL',
        filtersSummary: 'Session: 2026 - 2027',
        recordCount: 1,
        status: 'SUCCESS',
        rows: [{ studentName: 'Risk Student', phone: '03001234567' }], // Should NOT be persisted
      },
      superUser
    );

    assert.ok(savedExportPayload);
    assert.strictEqual(savedExportPayload.format, 'EXCEL');
    assert.strictEqual(savedExportPayload.rows, undefined);
    assert(!JSON.stringify(savedExportPayload).includes('03001234567'));
  });

  it('validates all catalog inlineActions metadata, unknown-action errors, and getGradeSchemes()', async () => {
    const actionsSeen = [];
    for (const rep of REPORT_CATALOG) {
      assert.ok(rep.key && rep.title && rep.module, `Report ${rep.pageNumber} missing metadata`);
      for (const act of rep.inlineActions || []) {
        actionsSeen.push(`${rep.key}:${act.name}`);
        assert.ok(act.name, `Action on ${rep.key} missing name`);
        assert.ok(act.label && act.label.length <= 24, `Action ${act.name} label too long or missing`);
        assert.ok(['row', 'report'].includes(act.scope), `Action ${act.name} invalid scope`);
        assert.ok(Array.isArray(act.fields) && act.fields.length > 0, `Action ${act.name} missing modal fields`);
      }
    }
    assert.strictEqual(actionsSeen.length, 19); // 19 action definitions across 47 reports

    await assert.rejects(
      () => reportEngineService.runAction('exam-grade-distribution', undefined, {}, superUser),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => reportEngineService.runAction('non-existent-report', 'save-grade-scheme', {}, superUser),
      (err) => err.statusCode === 404
    );

    stubMethod(models.GradeScheme, 'find', () =>
      makeChain([
        { _id: OID('gs1'), name: 'Standard 2026', passPercentage: 40, isDefault: true, bands: [] },
      ])
    );
    const schemes = await reportEngineService.getGradeSchemes();
    assert.strictEqual(schemes.length, 1);
    assert.strictEqual(schemes[0].name, 'Standard 2026');
  });

  it('lookup APIs apply single and comma-separated multi-ID server filters', async () => {
    const academicsService = require('../src/services/academics.service');
    const examinationService = require('../src/services/examination.service');
    const teacherService = require('../src/services/teacher.service');
    const staffService = require('../src/services/staff.service');

    const d1 = OID('dep1');
    const d2 = OID('dep2');
    const p1 = OID('prg1');
    const p2 = OID('prg2');
    const c1 = OID('cls1');
    const sub1 = OID('sub1');
    const tch1 = OID('tch1');

    let capturedProgramQuery = null;
    stubMethod(models.Program, 'find', (q) => {
      capturedProgramQuery = q;
      return makeChain([{ _id: p1, name: 'FSc', departmentId: d1 }]);
    });
    await academicsService.getPrograms({ departmentId: `${d1},${d2}` });
    assert.ok(Array.isArray(capturedProgramQuery.departmentId.$in));
    assert.strictEqual(capturedProgramQuery.departmentId.$in.length, 2);

    let capturedClassQuery = null;
    stubMethod(models.Class, 'find', (q) => {
      capturedClassQuery = q;
      return makeChain([{ _id: c1, name: '1st Year', programId: p1 }]);
    });
    await academicsService.getClasses({ departmentId: String(d1) });
    assert.ok(capturedClassQuery.programId.$in);

    let capturedSectionQuery = null;
    stubMethod(models.Section, 'find', (q) => {
      capturedSectionQuery = q;
      return makeChain([]);
    });
    await academicsService.getSections({ programId: String(p1) });
    assert.ok(capturedSectionQuery.classId.$in);

    let capturedSubjectQuery = null;
    stubMethod(models.SubjectClassMapping, 'find', () => makeChain([{ subjectIds: [sub1], subjects: [] }]));
    stubMethod(models.Exam, 'find', () => makeChain([]));
    stubMethod(models.Subject, 'find', (q) => {
      capturedSubjectQuery = q;
      return makeChain([{ _id: sub1, name: 'Physics' }]);
    });
    await academicsService.getSubjects({ programId: String(p1) });
    assert.ok(capturedSubjectQuery._id.$in);

    let capturedExamQuery = null;
    stubMethod(models.Exam, 'find', (q) => {
      capturedExamQuery = q;
      return makeChain([]);
    });
    await examinationService.getExams({ programId: `${p1},${p2}` });
    assert.strictEqual(capturedExamQuery.programId.$in.length, 2);

    let capturedTeacherQuery = null;
    stubMethod(models.TeacherMapping, 'find', () => makeChain([{ teacherId: tch1 }]));
    stubMethod(models.Staff, 'find', (q) => {
      capturedTeacherQuery = q;
      return makeChain([]);
    });
    await teacherService.getTeachers({ classId: String(c1) });
    assert.strictEqual(capturedTeacherQuery.isTeaching, true);
    assert.ok(capturedTeacherQuery._id.$in);

    let capturedStaffQuery = null;
    stubMethod(models.Staff, 'find', (q) => {
      capturedStaffQuery = q;
      return makeChain([]);
    });
    await staffService.getStaff({ departmentId: `${d1},${d2}` });
    assert.strictEqual(capturedStaffQuery.departmentId.$in.length, 2);
  });

  it('normalizes DB/runtime errors into meaningful user messages and runs all 47 reports safely with filters', async () => {
    const errorHandler = require('../src/middlewares/error');
    const { resolveSession } = require('../src/services/reports/reportHelpers');
    const { REPORT_CATALOG } = reportEngineService;
    const ses1 = OID('ses1');
    const ses2 = OID('ses2');
    const prg1 = OID('prg1');
    const cls1 = OID('cls1');
    const sec1 = OID('sec1');
    const sub1 = OID('sub1');

    // 1. Error sanitization tests (DB / runtime / CastError / ValidationError / E11000 / 503 vs clean 4xx)
    const refErrCase = errorHandler.normalizeUserError(new ReferenceError('mongoose is not defined'), {
      originalUrl: '/api/reports/students-class-strength',
    });
    assert.strictEqual(refErrCase.status, 500);
    assert.ok(!/mongoose|not defined/i.test(refErrCase.message));

    const castErr = Object.assign(new Error('Cast to ObjectId failed for value "bad" at path "studentId"'), {
      name: 'CastError',
      kind: 'ObjectId',
      path: 'studentId',
    });
    const castCase = errorHandler.normalizeUserError(castErr, { originalUrl: '/api/reports/students-profile-360' });
    assert.strictEqual(castCase.status, 400);
    assert.ok(!/Cast to ObjectId/i.test(castCase.message));

    const dupErr = Object.assign(new Error('E11000 duplicate key error collection: students index: rollNumber_1'), {
      code: 11000,
      keyPattern: { rollNumber: 1 },
    });
    const dupCase = errorHandler.normalizeUserError(dupErr, { originalUrl: '/api/reports/test/action' });
    assert.strictEqual(dupCase.status, 409);
    assert.match(dupCase.message, /already exists/i);
    assert.ok(!/E11000/i.test(dupCase.message));

    const netErr = Object.assign(new Error('Server selection timed out after 30000 ms'), {
      name: 'MongoServerSelectionError',
    });
    const netCase = errorHandler.normalizeUserError(netErr, { originalUrl: '/api/reports/fees-daily-collection' });
    assert.strictEqual(netCase.status, 503);
    assert.match(netCase.message, /database/i);

    const clientErr = Object.assign(new Error('Please select at least one subject.'), { statusCode: 400 });
    const clientCase = errorHandler.normalizeUserError(clientErr, { originalUrl: '/api/reports/test/action' });
    assert.strictEqual(clientCase.status, 400);
    assert.strictEqual(clientCase.message, 'Please select at least one subject.');

    // 2. Stub all exported models safely so resolveSession & every one of 47 reports runs with filters without crashing
    for (const model of Object.values(models)) {
      if (!model || typeof model !== 'function') continue;
      if (typeof model.find === 'function') stubMethod(model, 'find', () => makeChain([]));
      if (typeof model.findOne === 'function') stubMethod(model, 'findOne', () => makeChain(null));
      if (typeof model.findById === 'function') stubMethod(model, 'findById', () => makeChain(null));
      if (typeof model.countDocuments === 'function') stubMethod(model, 'countDocuments', () => makeChain(0));
      if (typeof model.distinct === 'function') stubMethod(model, 'distinct', () => makeChain([]));
      if (typeof model.aggregate === 'function') stubMethod(model, 'aggregate', () => makeChain([]));
    }
    stubMethod(models.AcademicSession, 'findById', () =>
      makeChain({ _id: ses1, name: '2026 - 2027', isActive: true, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })
    );
    stubMethod(models.AcademicSession, 'find', () =>
      makeChain([
        { _id: ses1, name: '2026 - 2027' },
        { _id: ses2, name: '2027 - 2028' },
      ])
    );

    const singleSes = await resolveSession(String(ses1));
    assert.strictEqual(singleSes.sessionLabel, '2026 - 2027');
    const multiSes = await resolveSession(`${ses1},${ses2}`);
    assert.match(multiSes.sessionLabel, /2026 - 2027/);

    for (const def of REPORT_CATALOG) {
      const envelope = await reportEngineService.runReport(
        def.key,
        {
          sessionId: String(ses1),
          programId: `${prg1}`,
          classId: `${cls1}`,
          sectionId: `${sec1}`,
          subjectId: `${sub1}`,
          status: 'ACTIVE',
          gender: 'Male',
          dateFrom: '2026-01-01',
          dateTo: '2026-10-31',
        },
        superUser
      );
      assert.strictEqual(envelope.report.key, def.key, `Report ${def.key} envelope key mismatch`);
      assert.ok(Array.isArray(envelope.columns), `Report ${def.key} missing columns`);
      assert.ok(Array.isArray(envelope.rows), `Report ${def.key} missing rows`);
      if (envelope.charts !== undefined) {
        assert.ok(Array.isArray(envelope.charts), `Report ${def.key} charts must be an array`);
        for (const ch of envelope.charts) {
          assert.ok(['bar', 'line', 'pie'].includes(ch.type), `Report ${def.key} unsupported chart type: ${ch.type}`);
          assert.ok(Array.isArray(ch.data), `Report ${def.key} chart data must be an array`);
          if (ch.type === 'pie') {
            assert.ok(ch.nameKey && ch.dataKey, `Report ${def.key} pie chart missing nameKey/dataKey`);
          }
          if (Array.isArray(ch.series)) {
            for (const s of ch.series) {
              assert.ok(
                typeof s.dataKey === 'string' && s.dataKey.length > 0,
                `Report ${def.key} chart series missing dataKey`
              );
            }
          }
        }
      }
    }
  });

  it('Exam report filterSchema combines Exam and Program into a single searchable examId filter across all 9 exam reports', () => {
    const examCatalog = REPORT_CATALOG.filter((r) => r.categoryKey === 'examination');

    assert.strictEqual(examCatalog.length, 9);
    for (const def of examCatalog) {
      const schema = def.filterSchema || [];
      assert.strictEqual(
        schema.some((f) => f.key === 'programId'),
        false,
        `Exam report ${def.key} should not expose separate programId filter`
      );
      const examFilter = schema.find((f) => f.key === 'examId');
      assert.ok(examFilter, `Exam report ${def.key} must expose examId filter`);
      assert.strictEqual(examFilter.optionsSource, 'exams');
      assert.strictEqual(examFilter.multi, false);
      assert.strictEqual(examFilter.searchable, true);
    }
  });
});
