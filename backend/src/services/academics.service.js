const {
  AcademicSession,
  Program,
  Class,
  Section,
  Subject,
  SubjectClassMapping,
  TeacherMapping,
  Timetable,
  Staff
} = require('../models');

class AcademicsService {
  // Sessions
  async getSessions() {
    return AcademicSession.find().sort({ startDate: -1 });
  }

  async createSession(data) {
    if (data.isActive) {
      await AcademicSession.updateMany({}, { isActive: false });
    }
    return AcademicSession.create(data);
  }

  async updateSession(id, data) {
    if (data.isActive) {
      await AcademicSession.updateMany({ _id: { $ne: id } }, { isActive: false });
    }
    return AcademicSession.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteSession(id) {
    return AcademicSession.findByIdAndDelete(id);
  }

  // Programs
  async getPrograms() {
    return Program.find()
      .populate({
        path: 'departmentId',
        populate: { path: 'hod', select: 'name designation phone email' },
      })
      .sort({ name: 1 });
  }

  async getProgramNames() {
    return Program.find().select('name code rollPrefix departmentId').sort({ name: 1 });
  }

  async createProgram(data) {
    return Program.create(data);
  }

  async updateProgram(id, data) {
    return Program.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteProgram(id) {
    return Program.findByIdAndDelete(id);
  }

  // Classes
  async getClasses() {
    return Class.find().populate('programId').populate('feeStructures').sort({ name: 1 });
  }

  async getClassNames() {
    return Class.find().select('name rollPrefix programId allowSections').sort({ name: 1 });
  }

  async createClass(data) {
    return Class.create(data);
  }

  async updateClass(id, data) {
    return Class.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteClass(id) {
    return Class.findByIdAndDelete(id);
  }

  // Sections
  async getSections() {
    return Section.find().populate('classId').sort({ name: 1 });
  }

  async getSectionNames() {
    return Section.find().select('name classId capacity').sort({ name: 1 });
  }

  async createSection(data) {
    return Section.create(data);
  }

  async updateSection(id, data) {
    return Section.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteSection(id) {
    return Section.findByIdAndDelete(id);
  }

  // Subjects
  async getSubjects() {
    return Subject.find().sort({ name: 1 });
  }

  async createSubject(data) {
    return Subject.create(data);
  }

  async updateSubject(id, data) {
    return Subject.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteSubject(id) {
    return Subject.findByIdAndDelete(id);
  }

  // SCM
  async getSCMs(sessionId) {
    const filter = {};
    if (sessionId && sessionId !== 'all' && sessionId !== 'undefined' && sessionId !== 'null') {
      filter.sessionId = sessionId;
    }
    return SubjectClassMapping.find(filter)
      .populate({ path: 'classId', populate: { path: 'programId' } })
      .populate('subjectIds')
      .populate('subjects.subjectId')
      .populate('sessionId');
  }

  async createSCM(data) {
    if (data.subjects && Array.isArray(data.subjects)) {
      data.subjects = data.subjects.map((s) => {
        const sId = typeof s === 'object' && s ? (s.subjectId || s._id || s.id) : s;
        const cr = s.creditHours != null && s.creditHours !== '' && Number(s.creditHours) > 0
          ? Number(s.creditHours)
          : null;
        return { subjectId: sId, creditHours: cr };
      });
      data.subjectIds = data.subjects.map((s) => s.subjectId);
    } else if (data.subjectIds && Array.isArray(data.subjectIds)) {
      data.subjects = data.subjectIds.map((s) => ({
        subjectId: typeof s === 'object' && s ? (s._id || s.id) : s,
        creditHours: null,
      }));
    } else if (data.subjectId) {
      data.subjectIds = [data.subjectId];
      data.subjects = [{ subjectId: data.subjectId, creditHours: null }];
    }

    if (!data.sessionId || data.sessionId === 'none' || data.sessionId === 'all' || data.sessionId === 'null') {
      delete data.sessionId;
    }
    const existingFilter = { classId: data.classId };
    if (data.sessionId) {
      existingFilter.sessionId = data.sessionId;
    } else {
      existingFilter.$or = [{ sessionId: { $exists: false } }, { sessionId: null }];
    }
    const existing = await SubjectClassMapping.findOne(existingFilter);
    let savedDoc;
    if (existing) {
      existing.subjectIds = data.subjectIds || [];
      existing.subjects = data.subjects || [];
      savedDoc = await existing.save();
    } else {
      savedDoc = await SubjectClassMapping.create(data);
    }
    return SubjectClassMapping.findById(savedDoc._id)
      .populate({ path: 'classId', populate: { path: 'programId' } })
      .populate('subjectIds')
      .populate('subjects.subjectId')
      .populate('sessionId');
  }

  async updateSCM(id, data) {
    if (data.subjects && Array.isArray(data.subjects)) {
      data.subjects = data.subjects.map((s) => {
        const sId = typeof s === 'object' && s ? (s.subjectId || s._id || s.id) : s;
        const cr = s.creditHours != null && s.creditHours !== '' && Number(s.creditHours) > 0
          ? Number(s.creditHours)
          : null;
        return { subjectId: sId, creditHours: cr };
      });
      data.subjectIds = data.subjects.map((s) => s.subjectId);
    } else if (data.subjectIds && Array.isArray(data.subjectIds)) {
      data.subjects = data.subjectIds.map((s) => ({
        subjectId: typeof s === 'object' && s ? (s._id || s.id) : s,
        creditHours: null,
      }));
    } else if (data.subjectId) {
      data.subjectIds = [data.subjectId];
      data.subjects = [{ subjectId: data.subjectId, creditHours: null }];
    }

    if (!data.sessionId || data.sessionId === 'none' || data.sessionId === 'all' || data.sessionId === 'null') {
      data.sessionId = null;
    }
    return SubjectClassMapping.findByIdAndUpdate(id, data, { new: true })
      .populate({ path: 'classId', populate: { path: 'programId' } })
      .populate('subjectIds')
      .populate('subjects.subjectId')
      .populate('sessionId');
  }

  async deleteSCM(id) {
    return SubjectClassMapping.findByIdAndDelete(id);
  }

  // Get subjects for class along with teacher assignments
  async getSubjectsForClassWithAssignments(classId, sessionId, sectionId) {
    if (!classId) return [];

    const scmFilter = { classId };
    if (sessionId && sessionId !== 'all' && sessionId !== 'none' && sessionId !== 'undefined') {
      scmFilter.$or = [{ sessionId }, { sessionId: null }, { sessionId: { $exists: false } }];
    }

    const scms = await SubjectClassMapping.find(scmFilter)
      .populate('subjects.subjectId')
      .populate('subjectIds');

    if (!scms || scms.length === 0) {
      return [];
    }

    // Prefer exact session match if available
    let scm = scms[0];
    if (sessionId && sessionId !== 'all' && sessionId !== 'none') {
      const exact = scms.find((s) => s.sessionId && s.sessionId.toString() === sessionId.toString());
      if (exact) scm = exact;
    }

    const subjectsList = [];
    if (Array.isArray(scm.subjects) && scm.subjects.length > 0) {
      for (const entry of scm.subjects) {
        const sub = entry.subjectId;
        if (!sub) continue;
        const subId = (sub._id || sub.id || sub).toString();
        subjectsList.push({
          id: subId,
          name: typeof sub === 'object' && sub.name ? sub.name : '',
          code: typeof sub === 'object' && sub.code ? sub.code : '',
          creditHours: entry.creditHours ?? null,
        });
      }
    } else if (Array.isArray(scm.subjectIds)) {
      for (const sub of scm.subjectIds) {
        if (!sub) continue;
        const subId = (sub._id || sub.id || sub).toString();
        subjectsList.push({
          id: subId,
          name: typeof sub === 'object' && sub.name ? sub.name : '',
          code: typeof sub === 'object' && sub.code ? sub.code : '',
          creditHours: null,
        });
      }
    }

    // Ensure all subjects have their name and code populated from the Subject collection
    const missingNameIds = subjectsList.filter((s) => !s.name).map((s) => s.id);
    if (missingNameIds.length > 0) {
      const dbSubjects = await Subject.find({ _id: { $in: missingNameIds } });
      const subMap = new Map(dbSubjects.map((s) => [s._id.toString(), s]));
      for (const item of subjectsList) {
        if (!item.name && subMap.has(item.id)) {
          const dbSub = subMap.get(item.id);
          item.name = dbSub.name || '';
          item.code = dbSub.code || item.code || '';
        }
      }
    }

    // Find teacher assignments for this class/section/session
    const conditions = [{ classId, mappingType: 'SUBJECT' }];
    if (sessionId && sessionId !== 'all' && sessionId !== 'none') {
      conditions.push({ $or: [{ sessionId }, { sessionId: null }, { sessionId: { $exists: false } }] });
    }
    if (sectionId && sectionId !== 'all' && sectionId !== 'none') {
      conditions.push({ $or: [{ sectionId }, { sectionId: null }, { sectionId: { $exists: false } }] });
    }

    const teacherMappings = await TeacherMapping.find({ $and: conditions }).populate('teacherId');

    return subjectsList.map((item) => {
      const subjectSpecificTeachers = teacherMappings
        .filter((tm) => {
          const tmSubId = (tm.subjectId?._id || tm.subjectId?.id || tm.subjectId)?.toString();
          return tmSubId === item.id;
        })
        .map((tm) => {
          const staff = tm.teacherId;
          const staffId = (staff?._id || staff?.id || staff)?.toString();
          return {
            teacherId: staffId,
            teacher: staff
              ? {
                  id: staffId,
                  name: staff.name || 'Unknown',
                }
              : null,
          };
        })
        .filter(t => t.teacher && t.teacher.name);

      return {
        id: item.id,
        name: item.name,
        code: item.code,
        creditHours: item.creditHours,
        matchingTeachers: subjectSpecificTeachers,
        teachers: subjectSpecificTeachers,
        isClassTeacherFallback: false,
        subject: {
          id: item.id,
          name: item.name,
          code: item.code,
          teachers: subjectSpecificTeachers,
        },
      };
    });
  }

  // TCM / TSM
  async getTeacherMappings(sessionId) {
    const filter = {};
    if (sessionId && sessionId !== 'all') filter.sessionId = sessionId;
    return TeacherMapping.find(filter)
      .populate('teacherId')
      .populate('classId')
      .populate('sectionId')
      .populate('subjectId')
      .populate('sessionId');
  }

  async getTeacherClassMappings(sessionId) {
    const filter = { mappingType: { $ne: 'SUBJECT' } };
    if (sessionId && sessionId !== 'all') filter.sessionId = sessionId;
    const classMappings = await TeacherMapping.find(filter)
      .populate('teacherId')
      .populate({ path: 'classId', populate: { path: 'programId' } })
      .populate('sectionId')
      .populate('sessionId')
      .sort({ createdAt: -1 });

    const subjectFilter = { mappingType: 'SUBJECT' };
    if (sessionId && sessionId !== 'all') subjectFilter.sessionId = sessionId;
    const subjectMappings = await TeacherMapping.find(subjectFilter).populate('subjectId');

    const subjectMap = new Map();
    for (const sm of subjectMappings) {
      if (!sm.subjectId) continue;
      const tId = String(sm.teacherId?._id || sm.teacherId || '');
      const cId = String(sm.classId?._id || sm.classId || '');
      const sId = sm.sectionId ? String(sm.sectionId?._id || sm.sectionId) : 'none';
      const sessId = sm.sessionId ? String(sm.sessionId?._id || sm.sessionId) : 'none';
      const key = `${tId}_${cId}_${sId}_${sessId}`;

      if (!subjectMap.has(key)) subjectMap.set(key, []);
      subjectMap.get(key).push({
        _id: sm.subjectId._id,
        id: sm.subjectId._id,
        name: sm.subjectId.name,
        code: sm.subjectId.code,
        creditHours: sm.subjectId.creditHours,
      });
    }

    return classMappings.map((cm) => {
      const cmObj = cm.toObject ? cm.toObject() : { ...cm };
      const tId = String(cm.teacherId?._id || cm.teacherId || '');
      const cId = String(cm.classId?._id || cm.classId || '');
      const sId = cm.sectionId ? String(cm.sectionId?._id || cm.sectionId) : 'none';
      const sessId = cm.sessionId ? String(cm.sessionId?._id || cm.sessionId) : 'none';
      const exactKey = `${tId}_${cId}_${sId}_${sessId}`;
      const fallbackKey = `${tId}_${cId}_${sId}_none`;
      cmObj.subjects = subjectMap.get(exactKey) || subjectMap.get(fallbackKey) || [];
      return cmObj;
    });
  }

  async createTeacherMapping(data) {
    return TeacherMapping.create(data);
  }

  async updateTeacherMapping(id, data) {
    return TeacherMapping.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteTeacherMapping(id) {
    return TeacherMapping.findByIdAndDelete(id);
  }

  async bulkAssignTeacherToClassSubjects(data) {
    const { id } = data;
    const teacherId = data.teacherId?.toString();
    const classId = data.classId?.toString();
    const subjectIds = Array.isArray(data.subjectIds) ? data.subjectIds : [];
    let sessionId = data.sessionId;
    let sectionId = data.sectionId;

    if (!sessionId || sessionId === 'none' || sessionId === 'all' || sessionId === 'null') {
      sessionId = null;
    }
    if (!sectionId || sectionId === 'none' || sectionId === 'all' || sectionId === 'null') {
      sectionId = null;
    }

    let classMapping = null;

    if (id) {
      const existing = await TeacherMapping.findById(id);
      if (existing) {
        const oldTeacherId = existing.teacherId?.toString();
        const oldClassId = existing.classId?.toString();
        const oldSectionId = existing.sectionId ? existing.sectionId.toString() : null;
        const oldSessionId = existing.sessionId ? existing.sessionId.toString() : null;

        const changed =
          oldTeacherId !== teacherId ||
          oldClassId !== classId ||
          oldSectionId !== (sectionId ? sectionId.toString() : null) ||
          oldSessionId !== (sessionId ? sessionId.toString() : null);

        if (changed) {
          await TeacherMapping.deleteMany({
            teacherId: oldTeacherId,
            classId: oldClassId,
            sectionId: oldSectionId,
            sessionId: oldSessionId,
            mappingType: 'SUBJECT',
          });
        }

        existing.teacherId = teacherId;
        existing.classId = classId;
        existing.sectionId = sectionId;
        existing.sessionId = sessionId;
        existing.mappingType = 'CLASS';
        await existing.save();
        classMapping = existing;
      }
    }

    if (!classMapping) {
      const classQuery = {
        teacherId,
        classId,
        sectionId: sectionId || null,
        sessionId: sessionId || null,
        mappingType: 'CLASS',
      };
      classMapping = await TeacherMapping.findOne(classQuery);
      if (!classMapping) {
        classMapping = await TeacherMapping.create(classQuery);
      }
    }

    // Sync SUBJECT mappings
    const currentSubjectMappings = await TeacherMapping.find({
      teacherId,
      classId,
      sectionId: sectionId || null,
      sessionId: sessionId || null,
      mappingType: 'SUBJECT',
    });

    const currentSubjectIds = currentSubjectMappings
      .map((m) => (m.subjectId?._id || m.subjectId || '').toString())
      .filter(Boolean);

    const targetSubjectIds = subjectIds
      .map((s) => (s?._id || s?.id || s || '').toString())
      .filter(Boolean);

    const targetSet = new Set(targetSubjectIds);

    // Remove obsolete
    for (const mapping of currentSubjectMappings) {
      const sId = (mapping.subjectId?._id || mapping.subjectId || '').toString();
      if (!targetSet.has(sId)) {
        await TeacherMapping.findByIdAndDelete(mapping._id);
      }
    }

    // Add newly selected
    for (const sId of targetSubjectIds) {
      if (!currentSubjectIds.includes(sId)) {
        await TeacherMapping.create({
          teacherId,
          classId,
          sectionId: sectionId || null,
          sessionId: sessionId || null,
          subjectId: sId,
          mappingType: 'SUBJECT',
        });
      }
    }

    return TeacherMapping.findById(classMapping._id)
      .populate('teacherId')
      .populate({ path: 'classId', populate: { path: 'programId' } })
      .populate('sectionId')
      .populate('sessionId');
  }

  async updateTeacherClassMapping(id, data) {
    if (data.subjectIds && Array.isArray(data.subjectIds)) {
      return this.bulkAssignTeacherToClassSubjects({ id, ...data });
    }
    return TeacherMapping.findByIdAndUpdate(id, data, { new: true })
      .populate('teacherId')
      .populate({ path: 'classId', populate: { path: 'programId' } })
      .populate('sectionId')
      .populate('sessionId');
  }

  async deleteTeacherClassMapping(id) {
    const mapping = await TeacherMapping.findById(id);
    if (!mapping) return null;

    // Delete corresponding subject mappings
    await TeacherMapping.deleteMany({
      teacherId: mapping.teacherId,
      classId: mapping.classId,
      sectionId: mapping.sectionId || null,
      sessionId: mapping.sessionId || null,
      mappingType: 'SUBJECT',
    });

    return TeacherMapping.findByIdAndDelete(id);
  }

  // Timetables
  async getTimetables(sessionId, classId) {
    const filter = {};
    if (sessionId && sessionId !== 'all' && sessionId !== 'none') filter.sessionId = sessionId;
    if (classId && classId !== 'all') filter.classId = classId;
    return Timetable.find(filter)
      .populate({ path: 'classId', populate: { path: 'programId' } })
      .populate('sectionId')
      .populate('sessionId')
      .populate('slots.subjectId')
      .populate('slots.teacherId')
      .sort({ createdAt: -1 });
  }

  async upsertTimetable(data) {
    let { id, classId, sectionId, sessionId, slots } = data;
    if (!sessionId || sessionId === 'none' || sessionId === 'all' || sessionId === 'null') sessionId = null;
    if (!sectionId || sectionId === 'none' || sectionId === 'all' || sectionId === 'null') sectionId = null;

    const cleanSlots = (slots || []).map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      subjectId: s.subjectId,
      teacherId: s.teacherId || null,
    }));

    if (id) {
      return Timetable.findByIdAndUpdate(
        id,
        { classId, sectionId, sessionId, slots: cleanSlots },
        { new: true }
      )
        .populate({ path: 'classId', populate: { path: 'programId' } })
        .populate('sectionId')
        .populate('sessionId')
        .populate('slots.subjectId')
        .populate('slots.teacherId');
    }

    const query = {
      classId,
      sectionId: sectionId || null,
      sessionId: sessionId || null,
    };
    return Timetable.findOneAndUpdate(
      query,
      { ...query, slots: cleanSlots },
      { upsert: true, new: true }
    )
      .populate({ path: 'classId', populate: { path: 'programId' } })
      .populate('sectionId')
      .populate('sessionId')
      .populate('slots.subjectId')
      .populate('slots.teacherId');
  }

  async deleteTimetable(id) {
    return Timetable.findByIdAndDelete(id);
  }

  // Search Staff
  async searchStaff(query) {
    const re = new RegExp(query || '', 'i');
    return Staff.find({
      $or: [{ name: re }, { staffId: re }]
    }).select('name staffId isTeaching isNonTeaching designation');
  }
}

module.exports = new AcademicsService();
