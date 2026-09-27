const examinationService = require('../services/examination.service');

class ExaminationController {
  // Exams
  async getExams(req, res, next) {
    try {
      const exams = await examinationService.getExams(req.query);
      res.json(exams);
    } catch (err) {
      next(err);
    }
  }

  async getExamById(req, res, next) {
    try {
      const exam = await examinationService.getExamById(req.params.id);
      res.json(exam);
    } catch (err) {
      next(err);
    }
  }

  async createExam(req, res, next) {
    try {
      const exam = await examinationService.createExam(req.body);
      res.status(201).json(exam);
    } catch (err) {
      next(err);
    }
  }

  async updateExam(req, res, next) {
    try {
      const exam = await examinationService.updateExam(req.params.id, req.body);
      res.json(exam);
    } catch (err) {
      next(err);
    }
  }

  async deleteExam(req, res, next) {
    try {
      await examinationService.deleteExam(req.params.id);
      res.json({ message: 'Exam deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Marks
  async getMarks(req, res, next) {
    try {
      const marks = await examinationService.getMarks(req.query);
      res.json(marks);
    } catch (err) {
      next(err);
    }
  }

  async createMarks(req, res, next) {
    try {
      const marks = await examinationService.createMarks(req.body);
      res.status(201).json(marks);
    } catch (err) {
      next(err);
    }
  }

  async bulkMarks(req, res, next) {
    try {
      const payload = req.body?.records || req.body?.marks || req.body;
      const result = await examinationService.bulkCreateMarks(payload);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateMarks(req, res, next) {
    try {
      const marks = await examinationService.updateMarks(req.params.id, req.body);
      res.json(marks);
    } catch (err) {
      next(err);
    }
  }

  async deleteMarks(req, res, next) {
    try {
      const id = req.params.id || req.query.id;
      await examinationService.deleteMarks(id);
      res.json({ message: 'Marks deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Results
  async getResults(req, res, next) {
    try {
      const results = await examinationService.getResults(req.query);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }

  async getStudentResult(req, res, next) {
    try {
      const studentId = req.query.studentId || req.params.studentId;
      const examId = req.query.examId || req.params.examId;
      const data = await examinationService.getStudentResult(studentId, examId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async generateResults(req, res, next) {
    try {
      const examId = req.query.examId || req.body.examId;
      const classId = req.query.classId || req.body.classId;
      const results = await examinationService.generateResults(examId, classId);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }

  async getPositions(req, res, next) {
    try {
      const positions = await examinationService.getPositions(req.query);
      res.json(positions);
    } catch (err) {
      next(err);
    }
  }

  async createResult(req, res, next) {
    try {
      const result = await examinationService.createResult(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateResult(req, res, next) {
    try {
      const id = req.params.id || req.query.id || req.body.id;
      const result = await examinationService.updateResult(id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteResult(req, res, next) {
    try {
      const id = req.params.id || req.query.id;
      await examinationService.deleteResult(id);
      res.json({ message: 'Result deleted' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ExaminationController();
