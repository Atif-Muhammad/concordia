const express = require('express');
const router = express.Router();
const examinationController = require('../controllers/examination.controller');
const { authMiddleware } = require('../middlewares/auth');

// Marks (MUST be defined before /:id so /marks is not matched as an exam :id)
router.get('/marks', examinationController.getMarks);
router.get('/marks/all', examinationController.getMarks);
router.post('/marks', authMiddleware, examinationController.createMarks);
router.post('/marks/bulk', authMiddleware, examinationController.bulkMarks);
router.patch('/marks/:id', authMiddleware, examinationController.updateMarks);
router.delete('/marks/delete', authMiddleware, examinationController.deleteMarks);
router.delete('/marks/:id', authMiddleware, examinationController.deleteMarks);

// Results & Positions (MUST be defined before /:id)
router.get('/result/all', examinationController.getResults);
router.get('/result/student', examinationController.getStudentResult);
router.post('/result/create', authMiddleware, examinationController.createResult);
router.post('/result/generate', authMiddleware, examinationController.generateResults);
router.patch('/result/update', authMiddleware, examinationController.updateResult);
router.delete('/result/delete', authMiddleware, examinationController.deleteResult);

router.get('/positions/all', examinationController.getPositions);
router.post('/positions/generate', authMiddleware, examinationController.generateResults);
router.put('/positions/update', authMiddleware, examinationController.updateResult);
router.delete('/positions/delete', authMiddleware, examinationController.deleteResult);

// Exams (General routes first, parameterized /:id routes last)
router.get('/', examinationController.getExams);
router.get('/all', examinationController.getExams);
router.post('/', authMiddleware, examinationController.createExam);
router.get('/:id', examinationController.getExamById);
router.patch('/:id', authMiddleware, examinationController.updateExam);
router.put('/:id', authMiddleware, examinationController.updateExam);
router.delete('/:id', authMiddleware, examinationController.deleteExam);

module.exports = router;
