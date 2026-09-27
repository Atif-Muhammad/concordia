import { describe, it, expect } from "vitest";
import { getStudentAcademicPath } from "../students/studentFinancialUtils";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

const prepareEditStudent = (student, academicSessions = []) => {
  const studentId = student.id || student._id;
  const studentClassId = extractId(student.classId);
  const studentProgramId = extractId(student.programId);
  const studentSectionId = extractId(student.sectionId);
  const studentSessionId = extractId(student.sessionId);

  const installments = (student.feeInstallments || [])
    .filter((inst) => {
      const instClassId = extractId(inst.classId);
      return !instClassId || !studentClassId || instClassId === studentClassId;
    })
    .map((inst) => {
      const dueDateStr = inst.dueDate
        ? new Date(inst.dueDate).toISOString().split("T")[0]
        : "";
      const dateObj = inst.dueDate ? new Date(inst.dueDate) : null;
      const monthName = dateObj ? dateObj.toLocaleString("default", { month: "long" }) : "";
      let sessionName = "";
      if (inst.session && typeof inst.session === "object" && inst.session.name) {
        sessionName = inst.session.name;
      } else if (inst.sessionId) {
        const instSessId = extractId(inst.sessionId);
        const found = academicSessions.find((s) => extractId(s) === instSessId);
        sessionName = found?.name || "";
      }
      return {
        ...inst,
        amount: inst.amount || Number(inst.basePayable) || 0,
        dueDate: dueDateStr,
        month: inst.month || monthName,
        session: sessionName,
        sessionId: extractId(inst.sessionId),
      };
    });

  return {
    ...student,
    id: studentId,
    _id: studentId,
    programId: studentProgramId,
    classId: studentClassId,
    sectionId: studentSectionId,
    sessionId: studentSessionId,
    installments,
  };
};

const prepareRejoinConfig = (student) => {
  const sId = student.id || student._id;
  const sessId = extractId(student.sessionId);
  return {
    initialAction: "rejoin",
    initialSelectedIds: [sId],
    initialRejoinDetails: {
      sessionId: sessId,
      programId: extractId(student.programId),
      classId: extractId(student.classId),
      sectionId: extractId(student.sectionId),
      sameClass: true,
    },
    initialSessionId: sessId || "all",
  };
};

describe("Students.jsx Logic and Fixes", () => {
  it("safely extracts string IDs from populated objects without producing '[object Object]'", () => {
    const populatedStudent = {
      _id: "stud_12345",
      fName: "Ali",
      lName: "Khan",
      programId: { _id: "prog_001", name: "FSc Pre-Medical" },
      classId: { _id: "class_002", name: "11th Medical A" },
      sectionId: { _id: "sec_003", name: "Section Blue" },
      sessionId: { _id: "sess_004", name: "2024-2026" },
      feeInstallments: [
        {
          _id: "inst_1",
          classId: { _id: "class_002" },
          amount: 25000,
          dueDate: "2024-09-01T00:00:00.000Z",
          sessionId: { _id: "sess_004", name: "2024-2026" },
        },
        {
          _id: "inst_2",
          classId: "class_999", // Different class, should be filtered out
          amount: 30000,
        },
      ],
    };

    const editData = prepareEditStudent(populatedStudent);

    expect(editData.id).toBe("stud_12345");
    expect(editData.programId).toBe("prog_001");
    expect(editData.programId).not.toContain("[object Object]");
    expect(editData.classId).toBe("class_002");
    expect(editData.classId).not.toContain("[object Object]");
    expect(editData.sectionId).toBe("sec_003");
    expect(editData.sectionId).not.toContain("[object Object]");
    expect(editData.sessionId).toBe("sess_004");
    expect(editData.sessionId).not.toContain("[object Object]");

    // Only installments matching class_002 are retained
    expect(editData.installments).toHaveLength(1);
    expect(editData.installments[0].amount).toBe(25000);
    expect(editData.installments[0].sessionId).toBe("sess_004");
    expect(editData.installments[0].sessionId).not.toContain("[object Object]");
  });

  it("handles students with unpopulated string IDs and missing optional fields", () => {
    const rawStudent = {
      id: "stud_999",
      programId: "prog_001",
      classId: "class_002",
      sectionId: null,
      sessionId: "sess_004",
      feeInstallments: [],
    };

    const editData = prepareEditStudent(rawStudent);
    expect(editData.id).toBe("stud_999");
    expect(editData.programId).toBe("prog_001");
    expect(editData.classId).toBe("class_002");
    expect(editData.sectionId).toBe("");
    expect(editData.sessionId).toBe("sess_004");
  });

  it("prepares rejoin configuration with clean string IDs", () => {
    const student = {
      _id: "stud_expelled_1",
      programId: { _id: "p1" },
      classId: { _id: "c1" },
      sectionId: { _id: "s1" },
      sessionId: { _id: "sess1" },
    };

    const config = prepareRejoinConfig(student);
    expect(config.initialSelectedIds).toEqual(["stud_expelled_1"]);
    expect(config.initialRejoinDetails).toEqual({
      sessionId: "sess1",
      programId: "p1",
      classId: "c1",
      sectionId: "s1",
      sameClass: true,
    });
    expect(config.initialSessionId).toBe("sess1");
  });

  describe("getStudentAcademicPath null safety and ObjectId resolution", () => {
    it("safely handles null student without throwing TypeError: can't access property 'program'", () => {
      expect(() => getStudentAcademicPath(null)).not.toThrow();
      expect(getStudentAcademicPath(null)).toBe("-");
    });

    it("safely handles undefined student", () => {
      expect(() => getStudentAcademicPath(undefined)).not.toThrow();
      expect(getStudentAcademicPath(undefined)).toBe("-");
    });

    it("resolves academic path from populated student fields", () => {
      const student = {
        programId: { _id: "p1", name: "FSc Pre-Engineering" },
        classId: { _id: "c1", name: "11th Grade" },
        sectionId: { _id: "s1", name: "Section A" },
      };
      expect(getStudentAcademicPath(student)).toBe("FSc Pre-Engineering / 11th Grade / Section A");
    });

    it("resolves academic path from MongoDB 24-hex ObjectId strings matching lookup arrays", () => {
      const student = {
        programId: "67d983949f2b1d001234abcd",
        classId: "67d983949f2b1d001234abce",
        sectionId: "67d983949f2b1d001234abcf",
      };
      const programData = [
        { _id: "67d983949f2b1d001234abcd", name: "BS Computer Science" },
      ];
      const classesData = [
        {
          _id: "67d983949f2b1d001234abce",
          name: "Semester 1",
          programId: "67d983949f2b1d001234abcd",
        },
      ];
      const sectionsData = [
        {
          _id: "67d983949f2b1d001234abcf",
          name: "Section CS-A",
          classId: "67d983949f2b1d001234abce",
        },
      ];

      const path = getStudentAcademicPath(student, programData, classesData, sectionsData);
      expect(path).toBe("BS Computer Science / Semester 1 / Section CS-A");
    });

    it("falls back to fallback name fields if lookups are not found", () => {
      const student = {
        programName: "A-Levels",
        className: "Year 1",
        sectionName: "Alpha",
      };
      expect(getStudentAcademicPath(student)).toBe("A-Levels / Year 1 / Alpha");
    });
  });
});
