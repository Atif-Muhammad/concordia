const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const {
  escapeRegex,
  tokenizeSearchQuery,
  buildFlexibleWhitespaceRegex,
  buildStudentSearchCondition,
} = require('../src/utils/studentSearch');
const studentService = require('../src/services/student.service');
const feeService = require('../src/services/fee.service');
const models = require('../src/models');

function matchesCondition(doc, cond) {
  if (!cond || typeof cond !== 'object') return true;
  if (cond.$and) {
    return cond.$and.every((sub) => matchesCondition(doc, sub));
  }
  if (cond.$or) {
    return cond.$or.some((sub) => matchesCondition(doc, sub));
  }
  for (const [key, expected] of Object.entries(cond)) {
    if (key === '$and' || key === '$or') continue;
    const actual = doc[key];
    if (expected instanceof RegExp) {
      if (!expected.test(String(actual ?? ''))) return false;
    } else if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (expected.$regex instanceof RegExp) {
        if (!expected.$regex.test(String(actual ?? ''))) return false;
      } else if (Array.isArray(expected.$in)) {
        const actualStr = actual && actual.toString ? actual.toString() : String(actual ?? '');
        const inSet = expected.$in.map((v) => (v && v.toString ? v.toString() : String(v)));
        if (!inSet.includes(actualStr)) return false;
      } else if ('$ne' in expected) {
        if (actual === expected.$ne) return false;
      } else if ('$exists' in expected) {
        const exists = actual !== undefined;
        if (exists !== expected.$exists) return false;
      }
    } else {
      const actualStr = actual && actual.toString ? actual.toString() : String(actual ?? '');
      const expectedStr = expected && expected.toString ? expected.toString() : String(expected ?? '');
      if (actualStr !== expectedStr) return false;
    }
  }
  return true;
}

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

const SAMPLE_STUDENTS = [
  {
    _id: new mongoose.Types.ObjectId('64a100000000000000000001'),
    fName: 'MUHAMMAD ',
    lName: 'JUNAID ',
    fatherOrguardian: 'KHALIQ NOOR ',
    rollNumber: 'PSH-HSSC-26-007',
    parentOrGuardianPhone: '03001112233',
    studentCnic: '17301-1111111-1',
    programId: new mongoose.Types.ObjectId('64a200000000000000000001'),
    classId: new mongoose.Types.ObjectId('64a300000000000000000001'),
    inquiryId: new mongoose.Types.ObjectId('64a400000000000000000001'),
    status: 'ACTIVE',
    passedOut: false,
  },
  {
    _id: new mongoose.Types.ObjectId('64a100000000000000000002'),
    fName: 'Dua ',
    lName: 'Parveez',
    fatherOrguardian: 'Parveez Masih',
    rollNumber: 'PSH-HSSC-26-003',
    parentOrGuardianPhone: '03002223344',
    programId: new mongoose.Types.ObjectId('64a200000000000000000001'),
    classId: new mongoose.Types.ObjectId('64a300000000000000000001'),
    status: 'ACTIVE',
    passedOut: false,
  },
  {
    _id: new mongoose.Types.ObjectId('64a100000000000000000003'),
    fName: 'Angel ',
    lName: '',
    fatherOrguardian: 'Riaz ',
    rollNumber: 'PSH-HSSC-26-005',
    parentOrGuardianPhone: '03003334455',
    programId: new mongoose.Types.ObjectId('64a200000000000000000001'),
    classId: new mongoose.Types.ObjectId('64a300000000000000000001'),
    status: 'ACTIVE',
    passedOut: false,
  },
  {
    _id: new mongoose.Types.ObjectId('64a100000000000000000004'),
    fName: 'SUNEHA ',
    lName: 'AMANAT MASIH',
    fatherOrguardian: 'AMANAT MASIH',
    rollNumber: 'PSH-HSSC-26-013',
    parentOrGuardianPhone: '03004445566',
    programId: new mongoose.Types.ObjectId('64a200000000000000000001'),
    classId: new mongoose.Types.ObjectId('64a300000000000000000001'),
    status: 'ACTIVE',
    passedOut: false,
  },
  {
    _id: new mongoose.Types.ObjectId('64a100000000000000000005'),
    fName: 'Muhammad',
    lName: 'Usman',
    fatherOrguardian: 'Tariq Mahmood',
    rollNumber: 'PSH-HSSC-26-020',
    parentOrGuardianPhone: '03005556677',
    programId: new mongoose.Types.ObjectId('64a200000000000000000001'),
    classId: new mongoose.Types.ObjectId('64a300000000000000000001'),
    status: 'ACTIVE',
    passedOut: false,
  },
];

describe('Student Full-Name, Father-Name, Roll & Challan Search', () => {
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

  describe('1. studentSearch utility', () => {
    it('escapes regex metacharacters and tolerates irregular whitespace', () => {
      assert.strictEqual(escapeRegex('M. Ali (A+)'), 'M\\. Ali \\(A\\+\\)');
      assert.deepStrictEqual(tokenizeSearchQuery('  Muhammad   Junaid  '), ['Muhammad', 'Junaid']);

      const re = buildFlexibleWhitespaceRegex('Muhammad   Junaid');
      assert.strictEqual(re.test('MUHAMMAD JUNAID '), true);
      assert.strictEqual(re.test('MUHAMMAD  JUNAID'), true);
      assert.strictEqual(buildFlexibleWhitespaceRegex('   '), null);
      assert.strictEqual(buildStudentSearchCondition('   '), null);
    });

    it('matches full names, partial first+last, empty last names, father names, and roll numbers without noisy false positives', () => {
      const fullQuery = buildStudentSearchCondition('Muhammad Junaid');
      assert.strictEqual(matchesCondition(SAMPLE_STUDENTS[0], fullQuery), true);
      assert.strictEqual(matchesCondition(SAMPLE_STUDENTS[4], fullQuery), false);

      const threeWordFull = buildStudentSearchCondition('Suneha Amanat Masih');
      assert.strictEqual(matchesCondition(SAMPLE_STUDENTS[3], threeWordFull), true);

      const singleNameEmptyLast = buildStudentSearchCondition('Angel');
      assert.strictEqual(matchesCondition(SAMPLE_STUDENTS[2], singleNameEmptyLast), true);

      const fatherQuery = buildStudentSearchCondition('Khaliq Noor');
      assert.strictEqual(matchesCondition(SAMPLE_STUDENTS[0], fatherQuery), true);

      const rollQuery = buildStudentSearchCondition('PSH-HSSC-26-003');
      assert.strictEqual(matchesCondition(SAMPLE_STUDENTS[1], rollQuery), true);
      assert.strictEqual(matchesCondition(SAMPLE_STUDENTS[0], rollQuery), false);
    });
  });

  describe('2. studentService.getStudents search', () => {
    it('finds students across full name, father name, roll no, first name, and last name', async () => {
      stubMethod(models.Student, 'find', (filter) => {
        const matched = SAMPLE_STUDENTS.filter((s) => matchesCondition(s, filter));
        return makeChain(matched);
      });
      stubMethod(models.Student, 'countDocuments', async (filter) =>
        SAMPLE_STUDENTS.filter((s) => matchesCondition(s, filter)).length
      );

      for (const [searchTerm, expectedRolls] of [
        ['Muhammad Junaid', ['PSH-HSSC-26-007']],
        ['dua   parveez', ['PSH-HSSC-26-003']],
        ['Khaliq Noor', ['PSH-HSSC-26-007']],
        ['Angel', ['PSH-HSSC-26-005']],
        ['PSH-HSSC-26-013', ['PSH-HSSC-26-013']],
        ['Junaid', ['PSH-HSSC-26-007']],
      ]) {
        const res = await studentService.getStudents({ searchQuery: searchTerm, status: 'ACTIVE' });
        assert.deepStrictEqual(
          res.students.map((s) => s.rollNumber),
          expectedRolls,
          `Failed for search="${searchTerm}"`
        );
      }
    });
  });

  describe('3. feeService search (getChallans, getExtraChallans, installment reports)', () => {
    const sampleChallans = [
      {
        _id: new mongoose.Types.ObjectId('64b100000000000000000001'),
        challanNo: 'CH-2026-007',
        studentId: SAMPLE_STUDENTS[0]._id,
        status: 'PENDING',
      },
      {
        _id: new mongoose.Types.ObjectId('64b100000000000000000002'),
        challanNo: 'CH-2026-003',
        studentId: SAMPLE_STUDENTS[1]._id,
        status: 'PAID',
      },
    ];

    it('getChallans searches by full name, father name, roll number, and challanNo with or without program filters', async () => {
      stubMethod(models.Student, 'find', (filter) => {
        const matched = SAMPLE_STUDENTS.filter((s) => matchesCondition(s, filter));
        return makeChain(matched);
      });
      stubMethod(models.FeeChallan, 'find', (filter) => {
        if (filter && filter['arrearAllocations.sourceChallanId']) {
          return makeChain([]);
        }
        const matched = sampleChallans.filter((c) => matchesCondition(c, filter));
        return makeChain(matched);
      });
      stubMethod(models.FeeChallan, 'countDocuments', async (filter) =>
        sampleChallans.filter((c) => matchesCondition(c, filter)).length
      );
      stubMethod(models.FeeSettings, 'findOne', () => makeChain(null));
      stubMethod(models.FeePaymentReceipt, 'find', () => makeChain([]));
      stubMethod(models.StudentCreditLedger, 'find', () => makeChain([]));

      // Without program filter (studentStatus=all branch)
      const byFullName = await feeService.getChallans({
        search: 'Muhammad Junaid',
        studentStatus: 'all',
      });
      assert.deepStrictEqual(byFullName.data.map((c) => c.challanNo), ['CH-2026-007']);

      // With active student + program filter (combinedStudentQuery branch) + father name
      const byFatherAndProgram = await feeService.getChallans({
        search: 'Parveez Masih',
        programId: SAMPLE_STUDENTS[1].programId.toString(),
        studentStatus: 'ACTIVE',
      });
      assert.deepStrictEqual(byFatherAndProgram.data.map((c) => c.challanNo), ['CH-2026-003']);

      // By challan number
      const byChallanNo = await feeService.getChallans({
        search: 'CH-2026-007',
        studentStatus: 'ACTIVE',
      });
      assert.deepStrictEqual(byChallanNo.data.map((c) => c.challanNo), ['CH-2026-007']);
    });

    it('getExtraChallans searches by full name, father name, roll number, challanNo, and remarks', async () => {
      const sampleExtra = [
        {
          _id: new mongoose.Types.ObjectId('64c100000000000000000001'),
          challanNo: 'EX-2026-003',
          remarks: 'Science Lab Fee',
          studentId: SAMPLE_STUDENTS[1]._id,
          status: 'PENDING',
        },
      ];

      stubMethod(models.Student, 'find', (filter) => {
        const matched = SAMPLE_STUDENTS.filter((s) => matchesCondition(s, filter));
        return makeChain(matched);
      });
      stubMethod(models.ExtraChallan, 'find', (filter) => {
        const matched = sampleExtra.filter((c) => matchesCondition(c, filter));
        return makeChain(matched);
      });
      stubMethod(models.ExtraChallan, 'countDocuments', async (filter) =>
        sampleExtra.filter((c) => matchesCondition(c, filter)).length
      );

      const byFullName = await feeService.getExtraChallans({ search: 'Dua Parveez' });
      assert.strictEqual(byFullName.data.length, 1);

      const byFather = await feeService.getExtraChallans({ search: 'Parveez Masih' });
      assert.strictEqual(byFather.data.length, 1);

      const byChallanNo = await feeService.getExtraChallans({ search: 'EX-2026-003' });
      assert.strictEqual(byChallanNo.data.length, 1);
    });

    it('getInstallmentPlans searches full name without clobbering status filter', async () => {
      stubMethod(models.Student, 'find', (filter) => {
        const matched = SAMPLE_STUDENTS.filter((s) => matchesCondition(s, filter));
        return makeChain(matched);
      });
      stubMethod(models.FeeChallan, 'find', () => makeChain([]));
      stubMethod(models.StudentCreditLedger, 'find', () => makeChain([]));
      stubMethod(models.FeeSettings, 'findOne', () => makeChain(null));
      stubMethod(feeService, 'getSettings', async () => ({ absenteeFinePerDay: 300 }));
      stubMethod(models.Attendance, 'aggregate', async () => []);

      const res = await feeService.getInstallmentPlans({ search: 'Muhammad Junaid' });
      assert.deepStrictEqual(res.map((s) => s.rollNumber), ['PSH-HSSC-26-007']);
    });
  });

  describe('4. studentService.getAdmissionConversionReport search', () => {
    it('searches by converted student roll number and preserves prospectusSold filter', async () => {
      const inquiryDoc = {
        _id: SAMPLE_STUDENTS[0].inquiryId,
        studentName: 'Muhammad Junaid',
        fatherName: 'Khaliq Noor',
        contactNumber: '03001112233',
        prospectusSold: false,
        status: 'APPROVED',
        createdAt: new Date('2026-01-10T00:00:00Z'),
      };

      let capturedInquiryQuery = null;
      stubMethod(models.AcademicSession, 'findOne', () => makeChain(null));
      stubMethod(models.Student, 'find', (filter) => {
        const matched = SAMPLE_STUDENTS.filter((s) => matchesCondition(s, filter));
        return makeChain(matched);
      });
      stubMethod(models.FrontOfficeInquiry, 'find', (query) => {
        capturedInquiryQuery = query;
        const matched = [inquiryDoc].filter((d) => matchesCondition(d, query));
        return makeChain(matched);
      });
      stubMethod(models.FrontOfficeInquiry, 'distinct', async () => ['Walk-in']);

      const report = await studentService.getAdmissionConversionReport({
        session: 'all',
        prospectusSold: 'unsold',
        search: 'PSH-HSSC-26-007',
      });

      assert(Array.isArray(capturedInquiryQuery.$or), 'prospectusSold $or condition should be preserved');
      assert(Array.isArray(capturedInquiryQuery.$and), 'search $or condition should be appended via $and');
      assert.strictEqual(report.records.length, 1);
      assert.strictEqual(report.records[0].studentDetails.rollNumber, 'PSH-HSSC-26-007');
      assert.strictEqual(report.records[0].studentDetails.fullName, 'MUHAMMAD JUNAID');
    });
  });
});
