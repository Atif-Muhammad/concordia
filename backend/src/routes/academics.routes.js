const express = require('express');
const router = express.Router();
const academicsController = require('../controllers/academics.controller');
const { authMiddleware } = require('../middlewares/auth');

// Sessions
router.get('/session/get/all', academicsController.getSessions);
router.post('/session/create', authMiddleware, academicsController.createSession);
router.patch('/session/update', authMiddleware, academicsController.updateSession);
router.delete('/session/remove', authMiddleware, academicsController.deleteSession);

// Programs
router.get('/program/get/all', academicsController.getPrograms);
router.get('/program/get/all/names', academicsController.getProgramNames);
router.post('/program/create', authMiddleware, academicsController.createProgram);
router.patch('/program/update', authMiddleware, academicsController.updateProgram);
router.delete('/program/remove', authMiddleware, academicsController.deleteProgram);

// Classes
router.get('/class/get/all', academicsController.getClasses);
router.get('/class/get/all/names', academicsController.getClassNames);
router.post('/class/create', authMiddleware, academicsController.createClass);
router.patch('/class/update', authMiddleware, academicsController.updateClass);
router.delete('/class/remove', authMiddleware, academicsController.deleteClass);

// Sections
router.get('/section/get/all', academicsController.getSections);
router.get('/section/get/all/names', academicsController.getSectionNames);
router.post('/section/create', authMiddleware, academicsController.createSection);
router.patch('/section/update', authMiddleware, academicsController.updateSection);
router.delete('/section/remove', authMiddleware, academicsController.deleteSection);

// Subjects
router.get('/subject/get/all', academicsController.getSubjects);
router.post('/subject/create', authMiddleware, academicsController.createSubject);
router.patch('/subject/update', authMiddleware, academicsController.updateSubject);
router.delete('/subject/remove', authMiddleware, academicsController.deleteSubject);

// SCM
router.get('/scm/get/all', academicsController.getSCM);
router.get('/scm/subjects-for-class', academicsController.getSubjectsForClass);
router.post('/scm/create', authMiddleware, academicsController.createSCM);
router.patch('/scm/update', authMiddleware, academicsController.updateSCM);
router.delete('/scm/remove', authMiddleware, academicsController.deleteSCM);

// TCM / TSM
router.get('/tcm/get/all', academicsController.getTCM);
router.post('/tcm/create', authMiddleware, academicsController.createTCM);
router.patch('/tcm/update', authMiddleware, academicsController.updateTCM);
router.delete('/tcm/remove', authMiddleware, academicsController.deleteTCM);
router.post('/tcm/assign-with-subjects', authMiddleware, academicsController.bulkAssignTeacherToClassSubjects);
router.get('/tsm/get/all', academicsController.getTSM);
router.post('/tsm/create', authMiddleware, academicsController.createTSM);
router.patch('/tsm/update', authMiddleware, academicsController.updateTSM);
router.delete('/tsm/remove', authMiddleware, academicsController.deleteTSM);

// Timetable
router.get('/timetable/get/all', academicsController.getTimetables);
router.post('/timetable/upsert', authMiddleware, academicsController.upsertTimetable);
router.delete('/timetable/remove', authMiddleware, academicsController.deleteTimetable);

// Staff search
router.get('/staff/search', academicsController.searchStaff);

module.exports = router;
