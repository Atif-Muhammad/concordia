const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const feeService = require('../src/services/fee.service');
const attendanceService = require('../src/services/attendance.service');
const { FeeChallan, Attendance, FeeSettings, Student } = require('../src/models');

describe('Absentee Fine Backend Synchronization & Integrity Tests', () => {
  let dbConnection;
  let testStudentId;
  let originalRate;

  before(async () => {
    dbConnection = await connectDB();
    const settings = await feeService.getSettings();
    originalRate = Number(settings?.absenteeFinePerDay || 300);

    // Pick an existing student with an open November challan
    const sample = await FeeChallan.findOne({
      month: { $regex: /^november$/i },
      status: 'PENDING'
    }).lean();

    if (sample) {
      testStudentId = sample.studentId;
    }
  });

  after(async () => {
    // Restore original rate
    if (originalRate) {
      await feeService.updateSettings({ absenteeFinePerDay: originalRate });
    }
    await mongoose.connection.close();
    process.exit(0);
  });

  describe('1. Month Determination & Boundary Rules', () => {
    it('November challan should only count distinct absent dates from October', async () => {
      if (!testStudentId) return;

      const novChallan = await FeeChallan.findOne({
        studentId: testStudentId,
        month: { $regex: /^november$/i },
        status: { $in: ['PENDING', 'PARTIAL'] }
      }).lean();

      if (!novChallan) return;

      const octDistinct = await Attendance.distinct('date', {
        studentId: testStudentId,
        status: { $regex: /^absent$/i },
        date: { $regex: '^2026-10' }
      });

      assert.strictEqual(
        Number(novChallan.absenteeCount || 0),
        octDistinct.length,
        'November challan absenteeCount must exactly equal October distinct absent days'
      );

      // Verify that November absent dates do NOT bleed into the November challan
      const novDates = await Attendance.distinct('date', {
        studentId: testStudentId,
        status: { $regex: /^absent$/i },
        date: { $regex: '^2026-11' }
      });

      if (novDates.length > 0) {
        assert.notStrictEqual(
          Number(novChallan.absenteeCount || 0),
          octDistinct.length + novDates.length,
          'November attendance dates must not be included in November challan'
        );
      }
    });

    it('Absentee fine line item specifies responsible month name', async () => {
      if (!testStudentId) return;

      const novChallan = await FeeChallan.findOne({
        studentId: testStudentId,
        month: { $regex: /^november$/i },
        absenteeCount: { $gt: 0 }
      }).lean();

      if (!novChallan) return;

      const head = (novChallan.challanHeads || []).find(h => /^absentee fine/i.test(h.name));
      assert(head, 'Must have an Absentee Fine head');
      assert(
        head.name.toLowerCase().includes('october'),
        `Line item title must explicitly state October, got "${head.name}"`
      );
    });
  });

  describe('2. Fee Settings Rate Propagation', () => {
    it('updateSettings triggers propagation across collectable challans', async () => {
      // Test updating rate to 220
      const updatedSettings = await feeService.updateSettings({ absenteeFinePerDay: 220 });
      assert.strictEqual(Number(updatedSettings.absenteeFinePerDay), 220);

      // Verify open collectable challans updated to 220
      const openChallans = await FeeChallan.find({
        status: 'PENDING',
        absenteeCount: { $gt: 0 }
      }).limit(5).lean();

      for (const ch of openChallans) {
        assert.strictEqual(ch.absenteeRate, 220, `Challan #${ch.challanNo} rate should be 220`);
        assert.strictEqual(
          ch.absenteeFineAmount,
          ch.absenteeCount * 220,
          `Challan #${ch.challanNo} fine amount should be ${ch.absenteeCount * 220}`
        );

        const head = (ch.challanHeads || []).find(h => /^absentee fine/i.test(h.name));
        if (head) {
          assert.strictEqual(head.amount, ch.absenteeCount * 220);
        }
      }

      // Restore rate to 300
      await feeService.updateSettings({ absenteeFinePerDay: 300 });

      const restoredChallans = await FeeChallan.find({
        status: 'PENDING',
        absenteeCount: { $gt: 0 }
      }).limit(5).lean();

      for (const ch of restoredChallans) {
        assert.strictEqual(ch.absenteeRate, 300, `Challan #${ch.challanNo} rate should be 300`);
        assert.strictEqual(
          ch.absenteeFineAmount,
          ch.absenteeCount * 300,
          `Challan #${ch.challanNo} fine amount should be restored to ${ch.absenteeCount * 300}`
        );
      }
    });

    it('Excludes settled and fully paid challans from rate updates', async () => {
      const paidChallan = await FeeChallan.findOne({
        status: 'PAID',
        absenteeCount: { $gt: 0 }
      }).lean();

      if (paidChallan) {
        const storedRate = paidChallan.absenteeRate;
        const storedAmount = paidChallan.absenteeFineAmount;

        // Rate update to 150
        await feeService.syncAbsenteeFineRateAcrossCollectableChallans(150);

        const reloaded = await FeeChallan.findById(paidChallan._id).lean();
        assert.strictEqual(reloaded.absenteeRate, storedRate, 'PAID challan rate must not change');
        assert.strictEqual(reloaded.absenteeFineAmount, storedAmount, 'PAID challan fine must not change');

        // Restore rate
        await feeService.syncAbsenteeFineRateAcrossCollectableChallans(300);
      }
    });

    it('Student installment totals stay synchronized with challan netPayable', async () => {
      if (!testStudentId) return;

      const challan = await FeeChallan.findOne({
        studentId: testStudentId,
        month: { $regex: /^november$/i },
        status: 'PENDING',
        installmentNumber: { $exists: true, $ne: null }
      }).lean();

      if (!challan) return;

      const student = await Student.findById(testStudentId).lean();
      const inst = (student.installments || []).find(i => i.installmentNumber === challan.installmentNumber);

      if (inst) {
        assert.strictEqual(
          inst.totalAmount,
          challan.netPayable,
          'Student installment totalAmount must match challan netPayable'
        );
        assert.strictEqual(
          inst.pendingAmount,
          challan.netPayable,
          'Student installment pendingAmount must match challan netPayable'
        );
      }
    });
  });

  describe('3. Live Attendance Marking Synchronization', () => {
    it('updateStudentAttendance and deleteStudentRecord auto-sync open challan', async () => {
      if (!testStudentId) return;

      const challanBefore = await FeeChallan.findOne({
        studentId: testStudentId,
        month: { $regex: /^november$/i },
        status: 'PENDING'
      }).lean();

      if (!challanBefore) return;

      const initialCount = Number(challanBefore.absenteeCount || 0);
      const testDate = '2026-10-03';
      const adminId = new mongoose.Types.ObjectId();

      // Check if student was already marked absent on testDate
      const existingAtt = await Attendance.findOne({
        studentId: testStudentId,
        date: testDate
      }).lean();

      // 1. Mark absent
      await attendanceService.updateStudentAttendance({
        students: [{ studentId: testStudentId, status: 'ABSENT' }],
        date: testDate
      }, { id: adminId });

      await new Promise(r => setTimeout(r, 600));

      const distinctAfterAbsent = await Attendance.distinct('date', {
        studentId: testStudentId,
        status: { $regex: /^absent$/i },
        date: { $regex: '^2026-10' }
      });

      const challanAfterAbsent = await FeeChallan.findById(challanBefore._id).lean();
      assert.strictEqual(
        challanAfterAbsent.absenteeCount,
        distinctAfterAbsent.length,
        'Absentee count must auto-sync upon marking student absent'
      );
      assert.strictEqual(
        challanAfterAbsent.absenteeFineAmount,
        distinctAfterAbsent.length * (challanAfterAbsent.absenteeRate || 300),
        'Fine amount must auto-sync upon marking student absent'
      );

      // 2. Mark present (or restore)
      if (existingAtt) {
        await attendanceService.updateStudentAttendance({
          students: [{ studentId: testStudentId, status: existingAtt.status }],
          date: testDate
        }, { id: adminId });
      } else {
        await attendanceService.deleteStudentRecord({
          studentId: testStudentId,
          date: testDate
        });
      }

      await new Promise(r => setTimeout(r, 600));

      const challanFinal = await FeeChallan.findById(challanBefore._id).lean();
      assert.strictEqual(
        challanFinal.absenteeCount,
        initialCount,
        'Absentee count must revert when attendance is reverted'
      );
    });
  });

  describe('4. Head Integrity & Catalog Separation', () => {
    it('Preserves manual Saturday Absentee fine separate from automated daily absentee fine', async () => {
      const rafayCh = await FeeChallan.findOne({ challanNo: '28964387' }).lean();
      if (!rafayCh) return;

      const satHead = (rafayCh.challanHeads || []).find(h =>
        h.name.toLowerCase().includes('saturday')
      );
      assert(satHead, 'Must preserve Saturday Absentee fine head');
      assert.strictEqual(satHead.amount, 500, 'Saturday Absentee fine must remain 500');
      assert.strictEqual(satHead.isCustom, false, 'Saturday Absentee fine is a catalog head');

      const dailyHead = (rafayCh.challanHeads || []).find(h =>
        /^absentee fine/i.test(h.name) && !h.name.toLowerCase().includes('saturday')
      );
      assert(dailyHead, 'Must have distinct daily Absentee fine head');
      assert(dailyHead.amount > 0, 'Daily absentee fine amount must be calculated');
      assert.strictEqual(dailyHead.isCustom, true, 'Daily absentee fine is custom line item');
    });
  });
});
