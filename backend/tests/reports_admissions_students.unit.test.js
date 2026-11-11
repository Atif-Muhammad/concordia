const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const models = require('../src/models');
const admissionsReports = require('../src/services/reports/admissions.reports');
const studentsReports = require('../src/services/reports/students.reports');

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

describe('Admissions & Students Report Builders (Pages 2–10)', () => {
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

  const superUser = { id: new mongoose.Types.ObjectId().toString(), role: 'SUPER_ADMIN', name: 'Admin' };
  const restrictedUser = { id: new mongoose.Types.ObjectId().toString(), role: 'STAFF', name: 'Staff' };

  function stubCommonRefs({ sessions = [], programs = [], classes = [], sections = [], userDoc = null } = {}) {
    stubMethod(models.AcademicSession, 'findOne', () => makeChain(sessions[0] || null));
    stubMethod(models.AcademicSession, 'findById', () => makeChain(sessions[0] || null));
    stubMethod(models.AcademicSession, 'find', () => makeChain(sessions));
    stubMethod(models.Program, 'find', () => makeChain(programs));
    stubMethod(models.Class, 'find', () => makeChain(classes));
    stubMethod(models.Section, 'find', () => makeChain(sections));
    stubMethod(models.User, 'findById', () => makeChain(userDoc || { _id: restrictedUser.id, role: 'STAFF', permissions: {} }));
    stubMethod(models.ActivityLog, 'create', () => Promise.resolve({}));
  }

  it('registers all 9 report keys (pages 2–10) without any campus field', () => {
    const expectedAdmissions = [
      'admissions-inquiry-register',
      'admissions-application-register',
      'admissions-enrollment-summary',
      'admissions-source-conversion',
      'admissions-missing-documents',
    ];
    const expectedStudents = [
      'students-master-register',
      'students-class-strength',
      'students-profile-360',
      'students-status-movement',
    ];

    assert.deepStrictEqual(admissionsReports.CATALOG.map((d) => d.key), expectedAdmissions);
    assert.deepStrictEqual(studentsReports.CATALOG.map((d) => d.key), expectedStudents);

    expectedAdmissions.forEach((k, idx) => {
      assert.strictEqual(typeof admissionsReports.HANDLERS[k], 'function');
      assert.strictEqual(admissionsReports.CATALOG[idx].pageNumber, idx + 2);
      assert(!JSON.stringify(admissionsReports.CATALOG[idx]).toLowerCase().includes('campus'));
    });
    expectedStudents.forEach((k, idx) => {
      assert.strictEqual(typeof studentsReports.HANDLERS[k], 'function');
      assert.strictEqual(studentsReports.CATALOG[idx].pageNumber, idx + 7);
      assert(!JSON.stringify(studentsReports.CATALOG[idx]).toLowerCase().includes('campus'));
    });

    assert.strictEqual(typeof admissionsReports.ACTIONS['admissions-update-inquiry-stage'], 'function');
    assert.strictEqual(typeof admissionsReports.ACTIONS['admissions-verify-missing-doc'], 'function');
  });

  it('Admissions inline actions reject invalid 400/404 payloads cleanly', async () => {
    stubCommonRefs();
    await assert.rejects(
      () => admissionsReports.ACTIONS['admissions-update-inquiry-stage']({ inquiryId: 'bad-id' }, { reqUser: superUser }),
      (err) => err.statusCode === 400
    );
    stubMethod(models.FrontOfficeInquiry, 'findById', () => Promise.resolve(null));
    stubMethod(models.Student, 'findById', () => makeChain(null));
    stubMethod(models.Student, 'findOne', () => makeChain(null));
    await assert.rejects(
      () => admissionsReports.ACTIONS['admissions-update-inquiry-stage']({ inquiryId: new mongoose.Types.ObjectId().toString() }, { reqUser: superUser }),
      (err) => err.statusCode === 404
    );
    await assert.rejects(
      () => admissionsReports.ACTIONS['admissions-verify-missing-doc']({ inquiryId: new mongoose.Types.ObjectId().toString(), docKey: 'cnic' }, { reqUser: superUser }),
      (err) => err.statusCode === 404
    );
  });

  it('Page 2: admissions-inquiry-register computes KPIs, overdue followUps, and filters', async () => {
    const progId = new mongoose.Types.ObjectId();
    const inq1 = new mongoose.Types.ObjectId();
    const inq2 = new mongoose.Types.ObjectId();
    const inq3 = new mongoose.Types.ObjectId();
    const stu1 = new mongoose.Types.ObjectId();

    stubCommonRefs({ programs: [{ _id: progId, name: 'FSc Pre-Medical' }] });
    stubMethod(models.FrontOfficeInquiry, 'find', () =>
      makeChain([
        {
          _id: inq1,
          studentName: 'Ali Khan',
          programInterest: { _id: progId, name: 'FSc Pre-Medical' },
          inquiryType: 'Website',
          assignedOfficerName: 'Sara',
          status: 'APPROVED',
          applicationStatus: 'APPROVED',
          followUps: [{ date: new Date(), status: 'COMPLETED' }],
          createdAt: new Date(),
        },
        {
          _id: inq2,
          studentName: 'Zainab Bibi',
          programInterest: { _id: progId, name: 'FSc Pre-Medical' },
          inquiryType: 'walk-in',
          status: 'NEW',
          applicationStatus: 'SUBMITTED',
          followUps: [],
          followUpDate: new Date(Date.now() - 3 * 86400000),
          createdAt: new Date(),
        },
        {
          _id: inq3,
          studentName: 'Hamza Tariq',
          programInterest: { _id: progId, name: 'FSc Pre-Medical' },
          inquiryType: '',
          status: 'NEW',
          followUps: [],
          createdAt: new Date(),
        },
      ])
    );
    stubMethod(models.Student, 'find', () =>
      makeChain([{ _id: stu1, inquiryId: inq1, status: 'ACTIVE', rollNumber: 'FSC-01' }])
    );

    const res = await admissionsReports.HANDLERS['admissions-inquiry-register']({}, superUser);
    assert.strictEqual(res.kpis.length, 4);
    assert.strictEqual(res.kpis[0].value, '3'); // Total
    assert.strictEqual(res.kpis[1].value, '1'); // Contacted
    assert.strictEqual(res.kpis[2].value, '2'); // Applications
    assert.strictEqual(res.kpis[3].value, '1'); // Enrolled
    assert.strictEqual(res.rows.length, 3);
    assert.strictEqual(res.rows[0].statusLabel, 'Enrolled');
    assert.strictEqual(res.rows[1].followUpOverdueDays >= 3, true);
    assert(res.insight.message.includes('Follow up 2 inquiries'));

    const webOnly = await admissionsReports.HANDLERS['admissions-inquiry-register']({ source: 'Website' }, superUser);
    assert.strictEqual(webOnly.rows.length, 1);
    assert.strictEqual(webOnly.rows[0].studentName, 'Ali Khan');
  });

  it('Page 3: admissions-application-register combines inquiries and admissionFormNumber students cleanly', async () => {
    const progId = new mongoose.Types.ObjectId();
    const inq1 = new mongoose.Types.ObjectId();
    const stu1 = new mongoose.Types.ObjectId();
    const stu2 = new mongoose.Types.ObjectId();

    stubCommonRefs({ programs: [{ _id: progId, name: 'ICS' }] });
    stubMethod(models.FrontOfficeInquiry, 'find', () =>
      makeChain([
        {
          _id: inq1,
          studentName: 'Bilal Ahmad',
          programInterest: { _id: progId, name: 'ICS' },
          applicationId: 'APP-100',
          applicationStatus: 'UNDER_REVIEW',
          appliedAt: new Date(),
          missingDocuments: [{ docKey: 'matricDmc', status: 'AWAITING_APPLICANT' }],
          status: 'NEW',
        },
      ])
    );
    stubMethod(models.Student, 'find', (q) => {
      if (q && q.inquiryId) return makeChain([]);
      return makeChain([
        {
          _id: stu2,
          fName: 'Sana',
          lName: 'Ullah',
          admissionFormNumber: 'ADM-200',
          programId: { _id: progId, name: 'ICS' },
          documents: { photograph: true, cnicCopy: true },
          status: 'ACTIVE',
          admissionDate: new Date(),
        },
      ]);
    });

    const res = await admissionsReports.HANDLERS['admissions-application-register']({}, superUser);
    assert.strictEqual(res.rows.length, 2);
    assert.strictEqual(res.kpis[0].value, '2'); // Applications
    assert.strictEqual(res.kpis[1].value, '1'); // Complete (Sana)
    assert.strictEqual(res.kpis[2].value, '1'); // Incomplete (Bilal)
    assert.strictEqual(res.kpis[3].value, '1'); // Under review
  });

  it('Page 4: admissions-enrollment-summary deduplicates _id and excludes CANCELLED/non-active from KPI', async () => {
    const p1 = new mongoose.Types.ObjectId();
    const p2 = new mongoose.Types.ObjectId();
    const p3 = new mongoose.Types.ObjectId();
    const s1 = new mongoose.Types.ObjectId();
    const s2 = new mongoose.Types.ObjectId();
    const s3 = new mongoose.Types.ObjectId();

    stubCommonRefs({
      programs: [
        { _id: p1, name: 'FSc Pre-Engineering' },
        { _id: p2, name: 'ICS' },
        { _id: p3, name: 'FA Humanities' },
      ],
    });
    stubMethod(models.Student, 'find', () =>
      makeChain([
        { _id: s1, fName: 'A', lName: '1', rollNumber: 'R1', status: 'ACTIVE', passedOut: false, programId: { _id: p1, name: 'FSc Pre-Engineering' }, classId: { name: '1st Year' }, gender: 'Male' },
        { _id: s1, fName: 'A', lName: '1', rollNumber: 'R1', status: 'ACTIVE', passedOut: false, programId: { _id: p1, name: 'FSc Pre-Engineering' }, classId: { name: '1st Year' }, gender: 'Male' }, // duplicate
        { _id: s2, fName: 'B', lName: '2', rollNumber: 'R2', status: 'CANCELLED', passedOut: false, programId: { _id: p2, name: 'ICS' }, classId: { name: '1st Year' }, gender: 'Female' },
        { _id: s3, fName: 'C', lName: '3', rollNumber: 'R3', status: 'GRADUATED', passedOut: true, programId: { _id: p2, name: 'ICS' }, classId: { name: '2nd Year' }, gender: 'Male' },
      ])
    );

    const res = await admissionsReports.HANDLERS['admissions-enrollment-summary']({}, superUser);
    assert.strictEqual(res.rows.length, 3); // deduplicated from 4 to 3
    assert.strictEqual(res.kpis[0].label, 'Enrolled');
    assert.strictEqual(res.kpis[0].value, '1'); // strictly 1 active; CANCELLED & GRADUATED excluded
    assert.strictEqual(res.kpis[1].label, 'FSc Pre-Engineering');
    assert.strictEqual(res.kpis[1].value, '1');
  });

  it('Page 5: admissions-source-conversion groups channels and emits chart + secondaryTables', async () => {
    const inq1 = new mongoose.Types.ObjectId();
    const inq2 = new mongoose.Types.ObjectId();
    const stu1 = new mongoose.Types.ObjectId();

    stubCommonRefs({});
    stubMethod(models.FrontOfficeInquiry, 'find', () =>
      makeChain([
        { _id: inq1, studentName: 'A', inquiryType: 'Facebook', applicationStatus: 'APPROVED', status: 'APPROVED', programInterest: { name: 'ICS' } },
        { _id: inq2, studentName: 'B', inquiryType: '', applicationStatus: '', status: 'NEW', programInterest: { name: 'ICS' } },
      ])
    );
    stubMethod(models.Student, 'find', () =>
      makeChain([{ _id: stu1, inquiryId: inq1, rollNumber: 'ICS-1', status: 'ACTIVE' }])
    );

    const res = await admissionsReports.HANDLERS['admissions-source-conversion']({}, superUser);
    assert.strictEqual(res.kpis[0].value, '2'); // Inquiries
    assert.strictEqual(res.kpis[2].value, '1'); // Enrolled
    assert.strictEqual(res.kpis[3].value, '50.0%');
    assert.strictEqual(res.charts.length, 1);
    assert.strictEqual(res.charts[0].type, 'bar');
    assert.strictEqual(res.secondaryTables.length, 1);
    assert.strictEqual(res.secondaryTables[0].rows.length, 2);
  });

  it('Page 6: admissions-missing-documents emits 1 row per missing item and supports actions', async () => {
    const inq1 = new mongoose.Types.ObjectId();
    const stu1 = new mongoose.Types.ObjectId();
    const stu2 = new mongoose.Types.ObjectId();

    stubCommonRefs({});
    stubMethod(models.FrontOfficeInquiry, 'find', () =>
      makeChain([
        {
          _id: inq1,
          studentName: 'Inquiry Applicant',
          programInterest: { name: 'FSc' },
          assignedOfficerName: 'Usman',
          missingDocuments: [
            { _id: new mongoose.Types.ObjectId(), docKey: 'cnicCopy', label: 'CNIC Copy', status: 'AWAITING_VERIFICATION', flaggedAt: new Date() },
            { _id: new mongoose.Types.ObjectId(), docKey: 'photograph', label: 'Photograph', status: 'COMPLETE', flaggedAt: new Date() },
          ],
        },
      ])
    );
    stubMethod(models.Student, 'find', (q) => {
      if (q && q.inquiryId) return makeChain([]);
      return makeChain([
        {
          _id: stu1,
          fName: 'Empty',
          lName: 'Docs',
          programId: { name: 'ICS' },
          documents: {}, // empty -> 5 standard keys
          status: 'ACTIVE',
          admissionDate: new Date(),
        },
        {
          _id: stu2,
          fName: 'Partial',
          lName: 'Docs',
          programId: { name: 'ICS' },
          documents: { photograph: true, matricDmc: false }, // 1 false key
          status: 'ACTIVE',
          admissionDate: new Date(),
        },
      ]);
    });

    const res = await admissionsReports.HANDLERS['admissions-missing-documents']({}, superUser);
    assert.strictEqual(res.kpis[0].value, '3'); // Incomplete files
    assert.strictEqual(res.kpis[1].value, '7'); // 1 (inq1) + 5 (stu1 empty) + 1 (stu2 false)
    assert.strictEqual(res.kpis[2].value, '6'); // Awaiting applicant
    assert.strictEqual(res.kpis[3].value, '1'); // Awaiting verification

    // Verify action seeds empty Student.documents map so other 4 remain false
    const fakeStuDoc = {
      _id: stu1,
      documents: new Map(),
      saved: false,
      async save() { this.saved = true; },
    };
    stubMethod(models.Student, 'findById', () => Promise.resolve(fakeStuDoc));
    const actionRes = await admissionsReports.ACTIONS['admissions-verify-missing-doc'](
      { studentId: String(stu1), docKey: 'photograph', status: 'COMPLETE' },
      { reqUser: superUser }
    );
    assert.strictEqual(actionRes.ok, true);
    assert.strictEqual(fakeStuDoc.saved, true);
    assert.strictEqual(fakeStuDoc.documents.get('photograph'), true);
    assert.strictEqual(fakeStuDoc.documents.get('cnicCopy'), false);
    assert.strictEqual(fakeStuDoc.documents.size, 5);

    // Verify inquiry stage update action
    const fakeInqDoc = {
      _id: inq1,
      studentName: 'Inquiry Applicant',
      status: 'NEW',
      applicationStatus: 'INQUIRY',
      followUps: [],
      async save() { this.saved = true; },
    };
    stubMethod(models.FrontOfficeInquiry, 'findById', () => Promise.resolve(fakeInqDoc));
    const stageRes = await admissionsReports.ACTIONS['admissions-update-inquiry-stage'](
      { inquiryId: String(inq1), applicationStatus: 'APPROVED', followUpRemarks: 'Docs checked' },
      { reqUser: superUser }
    );
    assert.strictEqual(stageRes.ok, true);
    assert.strictEqual(fakeInqDoc.status, 'APPROVED');
    assert.strictEqual(fakeInqDoc.followUps.length, 1);
  });

  it('Page 7: students-master-register filters active by default and masks phone when unauthorized', async () => {
    const p1 = new mongoose.Types.ObjectId();
    let capturedQuery = null;

    stubCommonRefs({ programs: [{ _id: p1, name: 'ICS' }] });
    stubMethod(models.Student, 'find', (q) => {
      capturedQuery = q;
      return makeChain([
        {
          _id: new mongoose.Types.ObjectId(),
          rollNumber: 'ICS-01',
          fName: 'Ayesha',
          lName: 'Noor',
          gender: 'Female',
          parentOrGuardianPhone: '03001234567',
          programId: { _id: p1, name: 'ICS' },
          classId: { name: '1st Year' },
          sectionId: { name: 'A' },
          status: 'ACTIVE',
        },
      ]);
    });

    const restricted = await studentsReports.HANDLERS['students-master-register']({ programId: String(p1) }, restrictedUser);
    assert(JSON.stringify(capturedQuery).includes('passedOut'));
    assert.strictEqual(restricted.rows[0].guardianPhone, '••••4567');

    const adminRes = await studentsReports.HANDLERS['students-master-register']({ programId: String(p1) }, superUser);
    assert.strictEqual(adminRes.rows[0].guardianPhone, '03001234567');
    assert.strictEqual(adminRes.kpis[1].value, '1'); // Female
  });

  it('Page 8: students-class-strength groups unique students with Section capacity & occupancyPct', async () => {
    const p1 = new mongoose.Types.ObjectId();
    const c1 = new mongoose.Types.ObjectId();
    const sec1 = new mongoose.Types.ObjectId();
    const s1 = new mongoose.Types.ObjectId();
    const s2 = new mongoose.Types.ObjectId();

    stubCommonRefs({
      programs: [{ _id: p1, name: 'FSc' }],
      classes: [{ _id: c1, name: 'Part 1', programId: p1 }],
      sections: [{ _id: sec1, name: 'Blue', classId: c1, capacity: 40 }],
    });
    stubMethod(models.Student, 'find', () =>
      makeChain([
        { _id: s1, programId: p1, classId: c1, sectionId: sec1, gender: 'Male' },
        { _id: s1, programId: p1, classId: c1, sectionId: sec1, gender: 'Male' }, // dup
        { _id: s2, programId: p1, classId: c1, sectionId: sec1, gender: 'Female' },
      ])
    );

    const res = await studentsReports.HANDLERS['students-class-strength']({}, superUser);
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].total, 2);
    assert.strictEqual(res.rows[0].capacity, 40);
    assert.strictEqual(res.rows[0].occupancyPct, '5.0%');
    assert.strictEqual(res.kpis[0].value, '2');
  });

  it('Page 9: students-profile-360 compiles 7 Page-9 rows & masks private fields for restricted users', async () => {
    const stuId = new mongoose.Types.ObjectId();
    const studentDoc = {
      _id: stuId,
      rollNumber: 'FSC-09',
      fName: 'Umar',
      lName: 'Farooq',
      fatherOrguardian: 'Farooq Shah',
      parentOrGuardianPhone: '03119998877',
      studentCnic: '17301-1234567-1',
      address: 'Peshawar',
      gender: 'Male',
      dob: new Date('2007-05-01'),
      admissionDate: new Date('2026-09-01'),
      programId: { name: 'FSc Pre-Medical' },
      classId: { name: '1st Year' },
      sectionId: { name: 'A' },
      sessionId: { name: '2026-27' },
      documents: { photograph: true, cnicCopy: false },
      status: 'ACTIVE',
    };

    stubCommonRefs({});
    stubMethod(models.Student, 'findById', () => makeChain(studentDoc));
    stubMethod(models.Attendance, 'find', () =>
      makeChain([
        { status: 'PRESENT', date: '2026-10-01' },
        { status: 'PRESENT', date: '2026-10-02' },
        { status: 'ABSENT', date: '2026-10-03' },
        { status: 'HD', date: '2026-10-04' }, // excluded from denominator
      ])
    );
    stubMethod(models.FeeChallan, 'find', () =>
      makeChain([
        { challanNo: 'CH-1', totalAmount: 10000, paidAmount: 6000, status: 'PARTIAL', dueDate: new Date() },
      ])
    );
    stubMethod(models.ExtraChallan, 'find', () => makeChain([]));
    stubMethod(models.ExamResult, 'find', () =>
      makeChain([
        { examId: { examName: 'Mid Term' }, obtainedMarks: 450, totalMarks: 500, percentage: 90, grade: 'A+', remarks: 'Sensitive note' },
      ])
    );

    const adminRes = await studentsReports.HANDLERS['students-profile-360']({ studentId: String(stuId) }, superUser);
    assert.deepStrictEqual(
      adminRes.rows.map((r) => r.area),
      ['Personal', 'Guardian', 'Admission', 'Documents', 'Fee', 'Attendance', 'Exams']
    );
    assert.strictEqual(adminRes.kpis[0].value, '66.7%');
    assert.strictEqual(adminRes.kpis[1].value, 'Rs 6,000');
    assert.strictEqual(adminRes.kpis[2].value, 'Rs 4,000');
    assert.strictEqual(adminRes.kpis[3].value, '90.0%');
    assert(adminRes.rows[1].details.includes('03119998877'));

    const staffRes = await studentsReports.HANDLERS['students-profile-360']({ studentId: String(stuId) }, restrictedUser);
    assert(!staffRes.rows[1].details.includes('03119998877'));
    assert(staffRes.rows[1].details.includes('••••8877'));
    assert(!staffRes.rows[6].statusUpdate.includes('Sensitive note'));
  });

  it('Page 10: students-status-movement reads statusHistory, academicRecords, and fallback', async () => {
    const s1 = new mongoose.Types.ObjectId();
    const s2 = new mongoose.Types.ObjectId();
    const s3 = new mongoose.Types.ObjectId();

    stubCommonRefs({});
    stubMethod(models.Student, 'find', () =>
      makeChain([
        {
          _id: s1,
          rollNumber: 'R-1',
          fName: 'Active',
          lName: 'Promoted',
          status: 'ACTIVE',
          passedOut: false,
          programId: { name: 'FSc' },
          statusHistory: [
            { previousStatus: 'ACTIVE', newStatus: 'ACTIVE', action: 'PROMOTE', reason: 'Promoted to 2nd Year', date: new Date('2026-09-10') },
          ],
          academicRecords: [
            { status: 'PROMOTED', startDate: new Date('2026-09-10') }, // within 60s -> deduplicated
          ],
        },
        {
          _id: s2,
          rollNumber: 'R-2',
          fName: 'Fallback',
          lName: 'StruckOff',
          status: 'STRUCK_OFF',
          passedOut: true,
          statusDate: new Date('2026-10-05'),
          statusReason: 'Long absence',
          programId: { name: 'ICS' },
          statusHistory: [],
          academicRecords: [],
        },
        {
          _id: s3,
          rollNumber: 'R-3',
          fName: 'Pending',
          lName: 'Student',
          status: 'PENDING',
          passedOut: false,
          programId: { name: 'ICS' },
          statusHistory: [],
          academicRecords: [],
        },
      ])
    );

    const res = await studentsReports.HANDLERS['students-status-movement']({}, superUser);
    assert.strictEqual(res.kpis[0].value, '1'); // Current active
    assert.strictEqual(res.kpis[1].value, '1'); // Withdrawn/Struck Off/Expelled
    assert.strictEqual(res.kpis[2].value, '0'); // Transferred/Graduated
    assert.strictEqual(res.kpis[3].value, '1'); // Pending decisions
    assert.strictEqual(res.rows.length, 3);
    assert.strictEqual(res.rows.some((r) => r.newStatus === 'STRUCK_OFF' && r.reason === 'Long absence'), true);

    const struckOnly = await studentsReports.HANDLERS['students-status-movement']({ movementType: 'STRUCK_OFF' }, superUser);
    assert.strictEqual(struckOnly.rows.length, 1);
    assert.strictEqual(struckOnly.rows[0].rollNumber, 'R-2');
  });
});
