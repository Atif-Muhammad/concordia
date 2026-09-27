const academicsService = require('../services/academics.service');

class AcademicsController {
  // Sessions
  async getSessions(req, res, next) {
    try {
      const sessions = await academicsService.getSessions();
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  }

  async createSession(req, res, next) {
    try {
      const session = await academicsService.createSession(req.body);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  }

  async updateSession(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const session = await academicsService.updateSession(id, req.body);
      res.json(session);
    } catch (err) {
      next(err);
    }
  }

  async deleteSession(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await academicsService.deleteSession(id);
      res.json({ message: 'Session deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Programs
  async getPrograms(req, res, next) {
    try {
      const programs = await academicsService.getPrograms();
      res.json(programs);
    } catch (err) {
      next(err);
    }
  }

  async getProgramNames(req, res, next) {
    try {
      const names = await academicsService.getProgramNames();
      res.json(names);
    } catch (err) {
      next(err);
    }
  }

  async createProgram(req, res, next) {
    try {
      const program = await academicsService.createProgram(req.body);
      res.status(201).json(program);
    } catch (err) {
      next(err);
    }
  }

  async updateProgram(req, res, next) {
    try {
      const id = req.query.programID || req.params.id;
      const program = await academicsService.updateProgram(id, req.body);
      res.json(program);
    } catch (err) {
      next(err);
    }
  }

  async deleteProgram(req, res, next) {
    try {
      const id = req.query.programID || req.params.id;
      await academicsService.deleteProgram(id);
      res.json({ message: 'Program deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Classes
  async getClasses(req, res, next) {
    try {
      const classes = await academicsService.getClasses();
      res.json(classes);
    } catch (err) {
      next(err);
    }
  }

  async getClassNames(req, res, next) {
    try {
      const names = await academicsService.getClassNames();
      res.json(names);
    } catch (err) {
      next(err);
    }
  }

  async createClass(req, res, next) {
    try {
      const cls = await academicsService.createClass(req.body);
      res.status(201).json(cls);
    } catch (err) {
      next(err);
    }
  }

  async updateClass(req, res, next) {
    try {
      const id = req.query.classID || req.params.id;
      const cls = await academicsService.updateClass(id, req.body);
      res.json(cls);
    } catch (err) {
      next(err);
    }
  }

  async deleteClass(req, res, next) {
    try {
      const id = req.query.classID || req.params.id;
      await academicsService.deleteClass(id);
      res.json({ message: 'Class deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Sections
  async getSections(req, res, next) {
    try {
      const sections = await academicsService.getSections();
      res.json(sections);
    } catch (err) {
      next(err);
    }
  }

  async getSectionNames(req, res, next) {
    try {
      const names = await academicsService.getSectionNames();
      res.json(names);
    } catch (err) {
      next(err);
    }
  }

  async createSection(req, res, next) {
    try {
      const section = await academicsService.createSection(req.body);
      res.status(201).json(section);
    } catch (err) {
      next(err);
    }
  }

  async updateSection(req, res, next) {
    try {
      const id = req.query.sectionID || req.params.id;
      const section = await academicsService.updateSection(id, req.body);
      res.json(section);
    } catch (err) {
      next(err);
    }
  }

  async deleteSection(req, res, next) {
    try {
      const id = req.query.sectionID || req.params.id;
      await academicsService.deleteSection(id);
      res.json({ message: 'Section deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Subjects
  async getSubjects(req, res, next) {
    try {
      const subjects = await academicsService.getSubjects();
      res.json(subjects);
    } catch (err) {
      next(err);
    }
  }

  async createSubject(req, res, next) {
    try {
      const subject = await academicsService.createSubject(req.body);
      res.status(201).json(subject);
    } catch (err) {
      next(err);
    }
  }

  async updateSubject(req, res, next) {
    try {
      const id = req.query.subjectID || req.query.subID || req.query.id || req.params.id || req.body.id;
      const subject = await academicsService.updateSubject(id, req.body);
      res.json(subject);
    } catch (err) {
      next(err);
    }
  }

  async deleteSubject(req, res, next) {
    try {
      const id = req.query.subjectID || req.query.subID || req.query.id || req.params.id || req.body.id;
      await academicsService.deleteSubject(id);
      res.json({ message: 'Subject deleted' });
    } catch (err) {
      next(err);
    }
  }

  // SCM
  async getSCM(req, res, next) {
    try {
      const scms = await academicsService.getSCMs(req.query.sessionId);
      res.json(scms);
    } catch (err) {
      next(err);
    }
  }

  async getSubjectsForClass(req, res, next) {
    try {
      const { classId, sessionId, sectionId } = req.query;
      const subjects = await academicsService.getSubjectsForClassWithAssignments(classId, sessionId, sectionId);
      res.json(subjects);
    } catch (err) {
      next(err);
    }
  }

  async createSCM(req, res, next) {
    try {
      const scm = await academicsService.createSCM(req.body);
      res.status(201).json(scm);
    } catch (err) {
      next(err);
    }
  }

  async updateSCM(req, res, next) {
    try {
      const id = req.query.id || req.query.scmID || req.params.id || req.body.id;
      const scm = await academicsService.updateSCM(id, req.body);
      res.json(scm);
    } catch (err) {
      next(err);
    }
  }

  async deleteSCM(req, res, next) {
    try {
      const id = req.query.id || req.query.scmID || req.params.id;
      await academicsService.deleteSCM(id);
      res.json({ message: 'Mapping deleted' });
    } catch (err) {
      next(err);
    }
  }

  // TCM
  async getTCM(req, res, next) {
    try {
      const mappings = await academicsService.getTeacherClassMappings(req.query.sessionId);
      res.json(mappings);
    } catch (err) {
      next(err);
    }
  }

  async createTCM(req, res, next) {
    try {
      const mapping = await academicsService.bulkAssignTeacherToClassSubjects(req.body);
      res.status(201).json(mapping);
    } catch (err) {
      next(err);
    }
  }

  async updateTCM(req, res, next) {
    try {
      const id = req.query.tcmID || req.query.id || req.params.id || req.body.id;
      const mapping = await academicsService.updateTeacherClassMapping(id, req.body);
      res.json(mapping);
    } catch (err) {
      next(err);
    }
  }

  async deleteTCM(req, res, next) {
    try {
      const id = req.query.tcmID || req.query.id || req.params.id;
      await academicsService.deleteTeacherClassMapping(id);
      res.json({ message: 'Teacher-class mapping deleted' });
    } catch (err) {
      next(err);
    }
  }

  async bulkAssignTeacherToClassSubjects(req, res, next) {
    try {
      const result = await academicsService.bulkAssignTeacherToClassSubjects(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // TSM (Legacy/Subject Mapping)
  async getTSM(req, res, next) {
    try {
      const mappings = await academicsService.getTeacherMappings(req.query.sessionId);
      res.json(mappings);
    } catch (err) {
      next(err);
    }
  }

  async createTSM(req, res, next) {
    try {
      const mapping = await academicsService.createTeacherMapping(req.body);
      res.status(201).json(mapping);
    } catch (err) {
      next(err);
    }
  }

  async updateTSM(req, res, next) {
    try {
      const id = req.query.tsmID || req.query.tcmID || req.query.id || req.params.id;
      const mapping = await academicsService.updateTeacherMapping(id, req.body);
      res.json(mapping);
    } catch (err) {
      next(err);
    }
  }

  async deleteTSM(req, res, next) {
    try {
      const id = req.query.tsmID || req.query.tcmID || req.query.id || req.params.id;
      await academicsService.deleteTeacherMapping(id);
      res.json({ message: 'Teacher mapping deleted' });
    } catch (err) {
      next(err);
    }
  }

  // Timetable
  async getTimetables(req, res, next) {
    try {
      const { sessionId, classId } = req.query;
      const timetables = await academicsService.getTimetables(sessionId, classId);
      res.json(timetables);
    } catch (err) {
      next(err);
    }
  }

  async upsertTimetable(req, res, next) {
    try {
      const result = await academicsService.upsertTimetable(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteTimetable(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await academicsService.deleteTimetable(id);
      res.json({ message: 'Timetable deleted' });
    } catch (err) {
      next(err);
    }
  }

  async searchStaff(req, res, next) {
    try {
      const query = req.query.q || req.query.search || req.query.query;
      const results = await academicsService.searchStaff(query);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AcademicsController();
