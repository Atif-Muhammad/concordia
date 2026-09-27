import { describe, it, expect } from "vitest";

// Pure helper matching MarkAttendanceTab.jsx logic
const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return String(val._id || val.id || "");
  return String(val);
};

const normalizeAttendanceStatus = (status) => String(status || "").toLowerCase();

const getAvailableClasses = (classesData, selectedProgramId) => {
  if (!selectedProgramId) return [];
  return classesData.filter(c => extractId(c.programId || c.program) === selectedProgramId);
};

const getSectionApplicability = (selectedClass) => {
  return selectedClass ? selectedClass.allowSections !== false : true;
};

const getAvailableSections = (selectedClass, sectionsData, isSectionApplicable) => {
  if (!selectedClass || !isSectionApplicable) return [];
  const classId = extractId(selectedClass);
  if (selectedClass.sections?.length) return selectedClass.sections;
  return sectionsData.filter(s => extractId(s.classId || s.class) === classId);
};

const deriveEffectiveAttendance = (student, attendanceChanges, approvedLeavesForDate = []) => {
  const sId = extractId(student.id || student._id);
  const att = student.attendance?.[0];
  const dbStatus = normalizeAttendanceStatus(att?.status);
  const draftStatus = normalizeAttendanceStatus(attendanceChanges[sId]);

  // Check if student has an approved leave
  const hasApprovedLeave = approvedLeavesForDate.some(
    l => extractId(l.studentId) === sId && String(l.status).toUpperCase() === "APPROVED"
  );

  if (draftStatus) {
    return {
      status: draftStatus,
      isApprovedLeave: hasApprovedLeave && draftStatus === "leave",
      buttonActive: draftStatus === "leave" ? "L" : draftStatus === "present" ? "P" : draftStatus === "absent" ? "A" : "SL"
    };
  }

  if (hasApprovedLeave) {
    return {
      status: "leave",
      isApprovedLeave: true,
      buttonActive: "L",
      badgeText: "Leave (Approved)"
    };
  }

  if (dbStatus) {
    return {
      status: dbStatus,
      isApprovedLeave: false,
      buttonActive: dbStatus === "leave" ? "L" : dbStatus === "present" ? "P" : dbStatus === "absent" ? "A" : "SL",
      badgeText: dbStatus === "present" ? "Present" : dbStatus === "absent" ? "Absent" : "Leave"
    };
  }

  return {
    status: "not_marked",
    isApprovedLeave: false,
    buttonActive: null,
    badgeText: "Not Marked"
  };
};

const buildSavePayload = ({
  selectedClassId,
  selectedClass,
  selectedSectionId,
  selectedSubjectId,
  sessionId,
  markDate,
  attendanceChanges
}) => {
  const isSectionApplicable = selectedClass ? selectedClass.allowSections !== false : true;
  const sectionParam = isSectionApplicable && selectedSectionId && selectedSectionId !== "*" ? selectedSectionId : null;

  return {
    classId: selectedClassId,
    sectionId: sectionParam,
    subjectId: selectedSubjectId,
    sessionId,
    date: markDate,
    students: Object.entries(attendanceChanges).map(([studentId, status]) => ({
      studentId,
      status: String(status).toUpperCase()
    }))
  };
};

describe("Attendance Cascading Filters & Leave-Attendance Sync", () => {
  const mockPrograms = [
    { _id: "prog_fsc", name: "FSc Pre-Medical" },
    { _id: "prog_ics", name: "ICS" },
  ];

  const mockClasses = [
    { _id: "cls_1", name: "1st Year Med", programId: "prog_fsc", allowSections: true },
    { _id: "cls_2", name: "2nd Year Med", programId: "prog_fsc", allowSections: false },
    { _id: "cls_3", name: "1st Year CS", programId: "prog_ics", allowSections: true },
  ];

  const mockSections = [
    { _id: "sec_a", name: "Section A", classId: "cls_1" },
    { _id: "sec_b", name: "Section B", classId: "cls_1" },
    { _id: "sec_c", name: "Section C", classId: "cls_3" },
  ];

  describe("Program -> Class Cascade", () => {
    it("returns empty classes when no program is selected", () => {
      const classes = getAvailableClasses(mockClasses, "");
      expect(classes).toEqual([]);
    });

    it("filters classes strictly matching selected program ID", () => {
      const fscClasses = getAvailableClasses(mockClasses, "prog_fsc");
      expect(fscClasses.length).toBe(2);
      expect(fscClasses.map(c => c._id)).toEqual(["cls_1", "cls_2"]);

      const icsClasses = getAvailableClasses(mockClasses, "prog_ics");
      expect(icsClasses.length).toBe(1);
      expect(icsClasses[0]._id).toBe("cls_3");
    });
  });

  describe("Section Applicability & Direct Class Linking", () => {
    it("when allowSections is false, isSectionApplicable is false and availableSections is empty", () => {
      const clsNoSections = mockClasses.find(c => c._id === "cls_2");
      const isApplicable = getSectionApplicability(clsNoSections);
      expect(isApplicable).toBe(false);

      const sections = getAvailableSections(clsNoSections, mockSections, isApplicable);
      expect(sections).toEqual([]);
    });

    it("when allowSections is false, buildSavePayload links directly to class with sectionId: null", () => {
      const clsNoSections = mockClasses.find(c => c._id === "cls_2");
      const payload = buildSavePayload({
        selectedClassId: "cls_2",
        selectedClass: clsNoSections,
        selectedSectionId: "sec_a", // even if stray state exists
        selectedSubjectId: "sub_1",
        sessionId: "sess_1",
        markDate: "2026-09-21",
        attendanceChanges: { stud_101: "present" }
      });

      expect(payload.classId).toBe("cls_2");
      expect(payload.sectionId).toBeNull();
      expect(payload.students[0]).toEqual({ studentId: "stud_101", status: "PRESENT" });
    });

    it("when allowSections is true, sections are available and selected section is preserved in payload", () => {
      const clsWithSections = mockClasses.find(c => c._id === "cls_1");
      const isApplicable = getSectionApplicability(clsWithSections);
      expect(isApplicable).toBe(true);

      const sections = getAvailableSections(clsWithSections, mockSections, isApplicable);
      expect(sections.length).toBe(2);
      expect(sections.map(s => s._id)).toEqual(["sec_a", "sec_b"]);

      const payload = buildSavePayload({
        selectedClassId: "cls_1",
        selectedClass: clsWithSections,
        selectedSectionId: "sec_b",
        selectedSubjectId: "sub_1",
        sessionId: "sess_1",
        markDate: "2026-09-21",
        attendanceChanges: { stud_102: "absent" }
      });

      expect(payload.classId).toBe("cls_1");
      expect(payload.sectionId).toBe("sec_b");
      expect(payload.students[0]).toEqual({ studentId: "stud_102", status: "ABSENT" });
    });

    it("when allowSections is true and 'All Sections' ('*') is selected, sectionId in payload is null", () => {
      const clsWithSections = mockClasses.find(c => c._id === "cls_1");
      const payload = buildSavePayload({
        selectedClassId: "cls_1",
        selectedClass: clsWithSections,
        selectedSectionId: "*",
        selectedSubjectId: "sub_1",
        sessionId: "sess_1",
        markDate: "2026-09-21",
        attendanceChanges: { stud_103: "leave" }
      });

      expect(payload.sectionId).toBeNull();
      expect(payload.students[0]).toEqual({ studentId: "stud_103", status: "LEAVE" });
    });
  });

  describe("LeaveTab Approved Leave Synchronization to MarkAttendanceTab", () => {
    it("when student has an approved leave spanning markDate, status defaults to 'leave' with 'L' button active", () => {
      const student = {
        _id: "stud_approved",
        rollNumber: "26-001",
        fName: "Ali",
        attendance: [] // No prior manual attendance
      };

      const approvedLeaves = [
        {
          studentId: "stud_approved",
          status: "APPROVED",
          fromDate: "2026-09-20",
          toDate: "2026-09-22"
        }
      ];

      const result = deriveEffectiveAttendance(student, {}, approvedLeaves);
      expect(result.status).toBe("leave");
      expect(result.isApprovedLeave).toBe(true);
      expect(result.buttonActive).toBe("L");
      expect(result.badgeText).toBe("Leave (Approved)");
    });

    it("when student has no approved leave, defaults to 'not_marked' if no attendance record", () => {
      const student = {
        _id: "stud_regular",
        rollNumber: "26-002",
        fName: "Sara",
        attendance: []
      };

      const result = deriveEffectiveAttendance(student, {}, []);
      expect(result.status).toBe("not_marked");
      expect(result.isApprovedLeave).toBe(false);
      expect(result.buttonActive).toBeNull();
      expect(result.badgeText).toBe("Not Marked");
    });

    it("manual draft change overrides default status while tracking status change", () => {
      const student = {
        _id: "stud_override",
        rollNumber: "26-003",
        fName: "Hamza",
        attendance: [{ status: "ABSENT" }]
      };

      // User manually clicked 'present'
      const changes = { stud_override: "present" };
      const result = deriveEffectiveAttendance(student, changes, []);
      expect(result.status).toBe("present");
      expect(result.buttonActive).toBe("P");
    });
  });
});
