const { describe, it } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const examinationService = require('../src/services/examination.service');
const { ExamMarks } = require('../src/models');

describe('Examination bulkCreateMarks Sanitization & Defense Tests', () => {
  it('should filter out records with [object Object] as studentId and not throw CastError', async () => {
    let capturedOps = null;
    const originalBulkWrite = ExamMarks.bulkWrite;
    ExamMarks.bulkWrite = async (ops) => {
      capturedOps = ops;
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    };

    try {
      const examId = new mongoose.Types.ObjectId().toString();
      const subjectId = new mongoose.Types.ObjectId().toString();

      // Passing "[object Object]" as studentId
      const result = await examinationService.bulkCreateMarks([
        {
          examId,
          studentId: '[object Object]',
          subjectId,
          totalMarks: 100,
          obtainedMarks: 85
        }
      ]);

      // Should be filtered out as invalid studentId, so bulkWrite is never called or called with empty
      assert.strictEqual(capturedOps, null);
      assert.deepStrictEqual(result, { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 });
    } finally {
      ExamMarks.bulkWrite = originalBulkWrite;
    }
  });

  it('should cleanly extract ObjectId when studentId or examId is a populated object', async () => {
    let capturedOps = null;
    const originalBulkWrite = ExamMarks.bulkWrite;
    ExamMarks.bulkWrite = async (ops) => {
      capturedOps = ops;
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    };

    try {
      const studentObjId = new mongoose.Types.ObjectId();
      const examObjId = new mongoose.Types.ObjectId();
      const subjectObjId = new mongoose.Types.ObjectId();

      const result = await examinationService.bulkCreateMarks([
        {
          examId: { _id: examObjId, title: 'Midterm' },
          studentId: { _id: studentObjId, name: 'John' },
          subjectId: subjectObjId.toString(),
          totalMarks: 100,
          obtainedMarks: 90
        }
      ]);

      assert.ok(capturedOps);
      assert.strictEqual(capturedOps.length, 1);
      assert.strictEqual(capturedOps[0].updateOne.filter.studentId, studentObjId.toString());
      assert.strictEqual(capturedOps[0].updateOne.filter.examId, examObjId.toString());
      assert.strictEqual(capturedOps[0].updateOne.filter.subjectId, subjectObjId.toString());
    } finally {
      ExamMarks.bulkWrite = originalBulkWrite;
    }
  });

  it('should enforce rule: obtainedMarks >= 0 and obtainedMarks <= totalMarks', async () => {
    let capturedOps = null;
    const originalBulkWrite = ExamMarks.bulkWrite;
    ExamMarks.bulkWrite = async (ops) => {
      capturedOps = ops;
      return { matchedCount: 2, modifiedCount: 2, upsertedCount: 0 };
    };

    try {
      const student1 = new mongoose.Types.ObjectId().toString();
      const student2 = new mongoose.Types.ObjectId().toString();
      const examId = new mongoose.Types.ObjectId().toString();
      const subjectId = new mongoose.Types.ObjectId().toString();

      await examinationService.bulkCreateMarks([
        {
          examId,
          studentId: student1,
          subjectId,
          totalMarks: 30,
          obtainedMarks: -10 // should clamp to 0
        },
        {
          examId,
          studentId: student2,
          subjectId,
          totalMarks: 30,
          obtainedMarks: 50 // should clamp to 30
        }
      ]);

      assert.ok(capturedOps);
      assert.strictEqual(capturedOps.length, 2);
      assert.strictEqual(capturedOps[0].updateOne.update.$set.obtainedMarks, 0);
      assert.strictEqual(capturedOps[1].updateOne.update.$set.obtainedMarks, 30);
    } finally {
      ExamMarks.bulkWrite = originalBulkWrite;
    }
  });

  it('should preserve valid float obtainedMarks within [0, totalMarks]', async () => {
    let capturedOps = null;
    const originalBulkWrite = ExamMarks.bulkWrite;
    ExamMarks.bulkWrite = async (ops) => {
      capturedOps = ops;
      return { matchedCount: 2, modifiedCount: 2, upsertedCount: 0 };
    };

    try {
      const student1 = new mongoose.Types.ObjectId().toString();
      const student2 = new mongoose.Types.ObjectId().toString();
      const examId = new mongoose.Types.ObjectId().toString();
      const subjectId = new mongoose.Types.ObjectId().toString();

      await examinationService.bulkCreateMarks([
        {
          examId,
          studentId: student1,
          subjectId,
          totalMarks: 30,
          obtainedMarks: 18.5
        },
        {
          examId,
          studentId: student2,
          subjectId,
          totalMarks: 30,
          obtainedMarks: 30.25 // should clamp to 30
        }
      ]);

      assert.ok(capturedOps);
      assert.strictEqual(capturedOps.length, 2);
      assert.strictEqual(capturedOps[0].updateOne.update.$set.obtainedMarks, 18.5);
      assert.strictEqual(capturedOps[1].updateOne.update.$set.obtainedMarks, 30);
    } finally {
      ExamMarks.bulkWrite = originalBulkWrite;
    }
  });
});
