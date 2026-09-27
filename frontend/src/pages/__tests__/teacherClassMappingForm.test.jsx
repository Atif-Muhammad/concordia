import { describe, it, expect } from "vitest";

// Pure helper functions replicating logic in TeacherClassMappingTab.jsx
const resolveId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return (item.id || item._id || "").toString();
  }
  return item.toString();
};

const checkClassAllowsSections = (selectedClass) => {
  if (!selectedClass) return false;
  return selectedClass.allowSections !== false;
};

const validateTeacherClassMappingSubmission = ({
  selectedStaff,
  selectedClassId,
  selectedSectionId,
  selectedSubjectIds,
  classAllowsSections,
}) => {
  if (!selectedStaff) {
    return { valid: false, error: "Please select a teacher" };
  }
  if (!selectedClassId) {
    return { valid: false, error: "Please select a class" };
  }
  if (classAllowsSections && !selectedSectionId) {
    return { valid: false, error: "Please select a section for this class" };
  }
  if (!selectedSubjectIds || selectedSubjectIds.size === 0) {
    return { valid: false, error: "Please select at least one subject" };
  }
  return { valid: true };
};

const buildTcmPayload = ({
  id,
  selectedStaff,
  selectedClassId,
  selectedSectionId,
  selectedSessionId,
  selectedSubjectIds,
  classAllowsSections,
}) => {
  return {
    id: id ? resolveId(id) : undefined,
    teacherId: resolveId(selectedStaff),
    classId: resolveId(selectedClassId),
    sectionId: classAllowsSections && selectedSectionId ? resolveId(selectedSectionId) : null,
    sessionId: selectedSessionId && selectedSessionId !== "none" ? resolveId(selectedSessionId) : null,
    subjectIds: Array.from(selectedSubjectIds).map((s) => resolveId(s)),
  };
};

const extractTeacherAssignedSubjectIds = (classSubjects, targetTeacherId) => {
  const teacherIdStr = resolveId(targetTeacherId);
  const assigned = new Set();
  (classSubjects || []).forEach((scm) => {
    const subId = resolveId(scm.subject?.id || scm.id);
    const teachersList = scm.subject?.teachers || [];
    if (teachersList.some((tm) => resolveId(tm.teacherId) === teacherIdStr)) {
      assigned.add(subId);
    }
  });
  return assigned;
};

describe("TeacherClassMappingTab Form Logic & allowSections", () => {
  const classWithSections = {
    id: "650a11111111111111111111",
    name: "1st year Pre-Medical",
    programId: "650b11111111111111111111",
    allowSections: true,
  };

  const classWithoutSections = {
    id: "650a22222222222222222222",
    name: "BS Computer Science Semester 1",
    programId: "650b22222222222222222222",
    allowSections: false,
  };

  describe("1. allowSections detection", () => {
    it("recognizes allowSections === true", () => {
      expect(checkClassAllowsSections(classWithSections)).toBe(true);
    });

    it("recognizes allowSections === false", () => {
      expect(checkClassAllowsSections(classWithoutSections)).toBe(false);
    });

    it("defaults to true if allowSections property is undefined", () => {
      expect(checkClassAllowsSections({ id: "123", name: "Standard Class" })).toBe(true);
    });

    it("returns false if no class is selected", () => {
      expect(checkClassAllowsSections(null)).toBe(false);
    });
  });

  describe("2. Validation with allowSections", () => {
    const teacher = { id: "650c11111111111111111111", name: "Sir Ahmed" };
    const subjectIds = new Set(["650d11111111111111111111"]);

    it("fails when class allows sections and no section is selected", () => {
      const res = validateTeacherClassMappingSubmission({
        selectedStaff: teacher,
        selectedClassId: classWithSections.id,
        selectedSectionId: "",
        selectedSubjectIds: subjectIds,
        classAllowsSections: true,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Please select a section for this class");
    });

    it("succeeds when class allows sections and section is selected", () => {
      const res = validateTeacherClassMappingSubmission({
        selectedStaff: teacher,
        selectedClassId: classWithSections.id,
        selectedSectionId: "650e11111111111111111111",
        selectedSubjectIds: subjectIds,
        classAllowsSections: true,
      });
      expect(res.valid).toBe(true);
    });

    it("succeeds when class does NOT allow sections even without sectionId", () => {
      const res = validateTeacherClassMappingSubmission({
        selectedStaff: teacher,
        selectedClassId: classWithoutSections.id,
        selectedSectionId: "",
        selectedSubjectIds: subjectIds,
        classAllowsSections: false,
      });
      expect(res.valid).toBe(true);
    });

    it("fails when no subjects are selected", () => {
      const res = validateTeacherClassMappingSubmission({
        selectedStaff: teacher,
        selectedClassId: classWithoutSections.id,
        selectedSectionId: "",
        selectedSubjectIds: new Set(),
        classAllowsSections: false,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Please select at least one subject");
    });

    it("fails when no teacher is selected", () => {
      const res = validateTeacherClassMappingSubmission({
        selectedStaff: null,
        selectedClassId: classWithoutSections.id,
        selectedSectionId: "",
        selectedSubjectIds: subjectIds,
        classAllowsSections: false,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Please select a teacher");
    });
  });

  describe("3. Payload construction", () => {
    const teacher = { id: "650c11111111111111111111", name: "Sir Ahmed" };

    it("sets sectionId to null when class does not allow sections", () => {
      const payload = buildTcmPayload({
        id: "650m11111111111111111111",
        selectedStaff: teacher,
        selectedClassId: classWithoutSections.id,
        selectedSectionId: "some-accidental-section",
        selectedSessionId: "650s11111111111111111111",
        selectedSubjectIds: new Set(["650d11111111111111111111"]),
        classAllowsSections: false,
      });

      expect(payload.classId).toBe("650a22222222222222222222");
      expect(payload.sectionId).toBeNull();
      expect(payload.sessionId).toBe("650s11111111111111111111");
      expect(payload.subjectIds).toEqual(["650d11111111111111111111"]);
      expect(payload.id).toBe("650m11111111111111111111");
    });

    it("preserves sectionId when class allows sections", () => {
      const payload = buildTcmPayload({
        selectedStaff: teacher,
        selectedClassId: classWithSections.id,
        selectedSectionId: "650e11111111111111111111",
        selectedSessionId: "none",
        selectedSubjectIds: new Set(["650d11111111111111111111"]),
        classAllowsSections: true,
      });

      expect(payload.sectionId).toBe("650e11111111111111111111");
      expect(payload.sessionId).toBeNull();
      expect(payload.id).toBeUndefined();
    });
  });

  describe("4. Pre-selecting assigned subjects during Edit", () => {
    const targetTeacherId = "teacher-123";
    const otherTeacherId = "teacher-456";

    const classSubjects = [
      {
        id: "sub-1",
        subject: {
          id: "sub-1",
          name: "Physics",
          teachers: [{ teacherId: targetTeacherId, teacher: { name: "Sir Ahmed" } }],
        },
      },
      {
        id: "sub-2",
        subject: {
          id: "sub-2",
          name: "Chemistry",
          teachers: [{ teacherId: otherTeacherId, teacher: { name: "Prof Bilal" } }],
        },
      },
      {
        id: "sub-3",
        subject: {
          id: "sub-3",
          name: "English",
          teachers: [{ teacherId: targetTeacherId, teacher: { name: "Sir Ahmed" } }],
        },
      },
      {
        id: "sub-4",
        subject: {
          id: "sub-4",
          name: "Islamiat",
          teachers: [],
        },
      },
    ];

    it("pre-selects exactly the subjects assigned to target teacher", () => {
      const preSelected = extractTeacherAssignedSubjectIds(classSubjects, targetTeacherId);
      expect(preSelected.has("sub-1")).toBe(true);
      expect(preSelected.has("sub-3")).toBe(true);
      expect(preSelected.has("sub-2")).toBe(false);
      expect(preSelected.has("sub-4")).toBe(false);
      expect(preSelected.size).toBe(2);
    });
  });

  describe("5. resolveId reliability", () => {
    it("handles MongoDB ObjectId objects", () => {
      expect(resolveId({ _id: "650a12345678901234567890" })).toBe("650a12345678901234567890");
      expect(resolveId({ id: "650a12345678901234567890" })).toBe("650a12345678901234567890");
    });

    it("handles string IDs and primitive numbers", () => {
      expect(resolveId("abc-123")).toBe("abc-123");
      expect(resolveId(42)).toBe("42");
      expect(resolveId(null)).toBe("");
      expect(resolveId(undefined)).toBe("");
    });
  });
});
