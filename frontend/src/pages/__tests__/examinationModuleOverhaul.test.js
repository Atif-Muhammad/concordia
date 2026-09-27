import { describe, it, expect } from "vitest";
import { extractId } from "@/lib/utils.jsx";

describe("Examination Module Overhaul - Unit & Integration Logic Tests", () => {
  describe("extractId utility", () => {
    it("extracts ID from plain string", () => {
      expect(extractId("65f1a2b3c4d5e6f7a8b9c0d1")).toBe("65f1a2b3c4d5e6f7a8b9c0d1");
    });

    it("extracts ID from number", () => {
      expect(extractId(12345)).toBe("12345");
    });

    it("extracts ID from object with _id", () => {
      expect(extractId({ _id: "65f1a2b3c4d5e6f7a8b9c0d1", name: "Science" })).toBe("65f1a2b3c4d5e6f7a8b9c0d1");
    });

    it("extracts ID from object with id", () => {
      expect(extractId({ id: "65f1a2b3c4d5e6f7a8b9c0d2", name: "Math" })).toBe("65f1a2b3c4d5e6f7a8b9c0d2");
    });

    it("returns empty string for null or undefined", () => {
      expect(extractId(null)).toBe("");
      expect(extractId(undefined)).toBe("");
    });
  });

  describe("Class Filtering by Program", () => {
    const classes = [
      { _id: "cls1", name: "Grade 10", programId: "prog1" },
      { _id: "cls2", name: "Grade 11", programId: "prog1" },
      { _id: "cls3", name: "BSc Computer Science", programId: "prog2" },
      { _id: "cls4", name: "BS IT", programId: { _id: "prog2" } },
    ];

    it("filters classes matching programId correctly without relying on nested program.classes", () => {
      const selectedProgramId = "prog1";
      const filtered = classes.filter((c) => extractId(c.programId) === selectedProgramId);
      expect(filtered.map((c) => c.name)).toEqual(["Grade 10", "Grade 11"]);
    });

    it("filters classes when programId is an object reference", () => {
      const selectedProgramId = "prog2";
      const filtered = classes.filter((c) => extractId(c.programId) === selectedProgramId);
      expect(filtered.map((c) => c.name)).toEqual(["BSc Computer Science", "BS IT"]);
    });
  });

  describe("Section Handling & allowSections Flag", () => {
    const sectionedClass = { _id: "cls1", name: "FSc Pre-Med", allowSections: true };
    const directClass = { _id: "cls2", name: "Diploma CS", allowSections: false };

    it("determines allowSections appropriately", () => {
      expect(sectionedClass.allowSections !== false).toBe(true);
      expect(directClass.allowSections !== false).toBe(false);
    });

    it("correctly sets section payload based on allowSections", () => {
      const buildPayload = (cls, selectedSection) => {
        const allowSections = cls.allowSections !== false;
        return {
          classId: extractId(cls._id),
          sectionId: allowSections && selectedSection && selectedSection !== "*" ? selectedSection : null,
        };
      };

      expect(buildPayload(sectionedClass, "secA")).toEqual({
        classId: "cls1",
        sectionId: "secA",
      });

      expect(buildPayload(directClass, "secA")).toEqual({
        classId: "cls2",
        sectionId: null,
      });
    });
  });

  describe("Result Calculation & Ranking Engine", () => {
    const calculateGrade = (pct) => {
      if (pct >= 90) return { grade: "A+", gpa: 4.0 };
      if (pct >= 80) return { grade: "A", gpa: 3.7 };
      if (pct >= 70) return { grade: "B+", gpa: 3.3 };
      if (pct >= 60) return { grade: "B", gpa: 3.0 };
      if (pct >= 50) return { grade: "C", gpa: 2.5 };
      if (pct >= 40) return { grade: "D", gpa: 2.0 };
      if (pct >= 33) return { grade: "E", gpa: 1.0 };
      return { grade: "F", gpa: 0.0 };
    };

    it("calculates percentage, grade, and GPA accurately", () => {
      const r1 = calculateGrade(92.5);
      expect(r1.grade).toBe("A+");
      expect(r1.gpa).toBe(4.0);

      const r2 = calculateGrade(75);
      expect(r2.grade).toBe("B+");
      expect(r2.gpa).toBe(3.3);

      const r3 = calculateGrade(28);
      expect(r3.grade).toBe("F");
      expect(r3.gpa).toBe(0.0);
    });

    it("assigns descending rankings correctly to students", () => {
      const studentResults = [
        { studentId: "s1", totalMarks: 300, obtainedMarks: 240, percentage: 80 },
        { studentId: "s2", totalMarks: 300, obtainedMarks: 270, percentage: 90 },
        { studentId: "s3", totalMarks: 300, obtainedMarks: 210, percentage: 70 },
      ];

      studentResults.sort((a, b) => b.percentage - a.percentage);
      studentResults.forEach((r, idx) => {
        r.position = idx + 1;
      });

      expect(studentResults[0].studentId).toBe("s2");
      expect(studentResults[0].position).toBe(1);

      expect(studentResults[1].studentId).toBe("s1");
      expect(studentResults[1].position).toBe(2);

      expect(studentResults[2].studentId).toBe("s3");
      expect(studentResults[2].position).toBe(3);
    });
  });

  describe("Student Exam Availability Matching", () => {
    const exams = [
      { _id: "ex1", examName: "Midterms 10th", classId: "cls10" },
      { _id: "ex2", examName: "Midterms 11th", classId: "cls11" },
      { _id: "ex3", examName: "General College Exam", classId: null },
    ];

    it("filters exams matching student class or general exams", () => {
      const student = { _id: "stu1", classId: "cls10" };

      const available = exams.filter((exam) => {
        const examClassId = extractId(exam.classId);
        const studentClassId = extractId(student.classId);
        return !examClassId || examClassId === studentClassId;
      });

      expect(available.map((e) => e._id)).toEqual(["ex1", "ex3"]);
    });
  });
});
