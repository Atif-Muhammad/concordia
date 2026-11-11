const { describe, it } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const examinationService = require('../src/services/examination.service');
const { Exam, ExamResult, Student } = require('../src/models');

describe('examinationService.getResults - Multi-Select Filtering Tests', () => {
  it('should query matching students with $in for comma-delimited or array classId/programId/sectionId', async () => {
    const origStudentFind = Student.find;
    const origExamResultFind = ExamResult.find;

    let capturedStudentQuery = null;
    let capturedExamResultQuery = null;

    const dummyStudentId1 = new mongoose.Types.ObjectId();
    const dummyStudentId2 = new mongoose.Types.ObjectId();

    Student.find = (query) => {
      capturedStudentQuery = query;
      return {
        select: () => Promise.resolve([{ _id: dummyStudentId1 }, { _id: dummyStudentId2 }])
      };
    };

    ExamResult.find = (query) => {
      capturedExamResultQuery = query;
      return {
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([])
          })
        })
      };
    };

    try {
      const progId1 = new mongoose.Types.ObjectId().toString();
      const progId2 = new mongoose.Types.ObjectId().toString();
      const classId1 = new mongoose.Types.ObjectId().toString();
      const classId2 = new mongoose.Types.ObjectId().toString();
      const secId1 = new mongoose.Types.ObjectId().toString();

      // Test with comma-delimited string
      await examinationService.getResults({
        programId: `${progId1}, ${progId2}`,
        classId: [classId1, classId2],
        sectionId: secId1,
      });

      // Assert Student query was constructed correctly with $in
      assert.deepStrictEqual(capturedStudentQuery.programId, { $in: [progId1, progId2] });
      assert.deepStrictEqual(capturedStudentQuery.classId, { $in: [classId1, classId2] });
      assert.strictEqual(capturedStudentQuery.sectionId, secId1);

      // Assert ExamResult query filtered by studentId matching the student results
      assert.deepStrictEqual(capturedExamResultQuery.studentId, {
        $in: [dummyStudentId1, dummyStudentId2]
      });
    } finally {
      Student.find = origStudentFind;
      ExamResult.find = origExamResultFind;
    }
  });

  it('should query ExamResult with $in when multiple examIds are provided', async () => {
    const origExamResultFind = ExamResult.find;
    let capturedExamResultQuery = null;

    ExamResult.find = (query) => {
      capturedExamResultQuery = query;
      return {
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([])
          })
        })
      };
    };

    try {
      const examId1 = new mongoose.Types.ObjectId().toString();
      const examId2 = new mongoose.Types.ObjectId().toString();

      await examinationService.getResults({
        examId: `${examId1},${examId2}`
      });

      assert.deepStrictEqual(capturedExamResultQuery.examId, { $in: [examId1, examId2] });
    } finally {
      ExamResult.find = origExamResultFind;
    }
  });

  it('should restrict exams by sessionId when sessionId is provided', async () => {
    const origExamFind = Exam.find;
    const origExamResultFind = ExamResult.find;
    let capturedExamResultQuery = null;

    const examId1 = new mongoose.Types.ObjectId();
    const examId2 = new mongoose.Types.ObjectId();

    Exam.find = () => ({
      select: () => Promise.resolve([{ _id: examId1 }, { _id: examId2 }])
    });

    ExamResult.find = (query) => {
      capturedExamResultQuery = query;
      return {
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([])
          })
        })
      };
    };

    try {
      const sessionId = new mongoose.Types.ObjectId().toString();
      await examinationService.getResults({ sessionId });

      assert.deepStrictEqual(capturedExamResultQuery.examId, {
        $in: [examId1.toString(), examId2.toString()]
      });
    } finally {
      Exam.find = origExamFind;
      ExamResult.find = origExamResultFind;
    }
  });

  it('should return empty results without errors when no filters or empty string is passed', async () => {
    const origExamResultFind = ExamResult.find;
    let capturedExamResultQuery = null;

    ExamResult.find = (query) => {
      capturedExamResultQuery = query;
      return {
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([])
          })
        })
      };
    };

    try {
      const res = await examinationService.getResults({});
      assert.deepStrictEqual(capturedExamResultQuery, {});
      assert.deepStrictEqual(res, []);
    } finally {
      ExamResult.find = origExamResultFind;
    }
  });
});
