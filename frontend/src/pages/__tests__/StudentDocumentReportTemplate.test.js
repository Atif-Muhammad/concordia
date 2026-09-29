import { describe, it, expect } from "vitest";
import {
  resolveStudentDocumentData,
  generateStudentDocumentReportPrintHtml,
  generateStudentDocumentReportBodyHtml,
  STUDENT_FORM_DOCUMENTS,
} from "../students/StudentDocumentReportTemplate";

describe("StudentDocumentReportTemplate", () => {
  const mockPrograms = [
    { _id: "prog-1", name: "F.Sc Pre-Medical" },
    { _id: "prog-2", name: "ICS Computer Science" },
  ];
  const mockClasses = [
    { _id: "class-1", name: "1st Year (11th)", programId: "prog-1" },
    { _id: "class-2", name: "2nd Year (12th)", programId: "prog-1" },
  ];
  const mockSections = [
    { _id: "sec-1", name: "Section A", classId: "class-1" },
  ];
  const mockSessions = [
    { _id: "sess-1", name: "2025-2027", isActive: true },
  ];

  describe("STUDENT_FORM_DOCUMENTS", () => {
    it("matches the 8 document names from student create/edit forms", () => {
      const labels = STUDENT_FORM_DOCUMENTS.map((d) => d.label);
      expect(labels).toEqual([
        "Form B / Domicile",
        "4 Passport Size Pictures",
        "DMC Matric",
        "DMC Intermediate",
        "Father CNIC",
        "Migration (if from other board)",
        "Affidavit",
        "Admission Form",
      ]);
    });
  });

  describe("resolveStudentDocumentData", () => {
    it("correctly resolves student name, father name, roll number, academic path, and document checklist with aliases", () => {
      const student = {
        _id: "stu-1",
        fName: "Bilal",
        lName: "Ahmed",
        fatherOrguardian: "Ahmed Nawaz",
        rollNumber: "2026-ICS-042",
        programId: "prog-2",
        classId: "class-1",
        sectionId: "sec-1",
        sessionId: "sess-1",
        documents: JSON.stringify({
          admissionForm: true,
          "B Form": true, // alias for formB
          pictures: true,
          dmcMatric: true,
          fatherCnic: true,
          dmcIntermediate: false,
          migration: false,
          affidavit: false,
        }),
      };

      const resolved = resolveStudentDocumentData(student, {
        programData: mockPrograms,
        classesData: mockClasses,
        sectionsData: mockSections,
        academicSessions: mockSessions,
      });

      expect(resolved.studentName).toBe("Bilal Ahmed");
      expect(resolved.fatherName).toBe("Ahmed Nawaz");
      expect(resolved.rollNumber).toBe("2026-ICS-042");
      expect(resolved.programName).toBe("ICS Computer Science");
      expect(resolved.className).toBe("1st Year (11th)");
      expect(resolved.sectionName).toBe("Section A");
      expect(resolved.sessionName).toBe("2025-2027");

      // B Form alias resolved to formB
      const formBDoc = resolved.docsList.find((d) => d.key === "formB");
      expect(formBDoc?.isSubmitted).toBe(true);

      expect(resolved.submittedCount).toBe(5);
      expect(resolved.missingCount).toBe(3);
      expect(resolved.totalCount).toBe(8);
      expect(resolved.isComplete).toBe(false);

      const migrationDoc = resolved.docsList.find((d) => d.key === "migration");
      expect(migrationDoc?.isSubmitted).toBe(false);
    });

    it("marks isComplete as true when all 8 documents are submitted", () => {
      const student = {
        _id: "stu-complete",
        fName: "Zainab",
        lName: "Bibi",
        fatherOrguardian: "Muhammad Tariq",
        rollNumber: "2026-FSC-100",
        documents: {
          admissionForm: true,
          formB: true,
          pictures: true,
          dmcMatric: true,
          dmcIntermediate: true,
          fatherCnic: true,
          migration: true,
          affidavit: true,
        },
      };

      const resolved = resolveStudentDocumentData(student);
      expect(resolved.submittedCount).toBe(8);
      expect(resolved.missingCount).toBe(0);
      expect(resolved.isComplete).toBe(true);
    });
  });

  describe("generateStudentDocumentReportPrintHtml", () => {
    it("renders document report with logo, single-cell student info, 4 columns (no status column), and only pending students", () => {
      const students = [
        {
          _id: "stu-1",
          fName: "Usman",
          lName: "Ali",
          fatherOrguardian: "Ali Raza",
          rollNumber: "2026-MED-007",
          programName: "F.Sc Pre-Medical",
          className: "1st Year (11th)",
          sectionName: "Section B",
          sessionName: "2026-2027",
          documents: {
            admissionForm: true,
            formB: true,
            pictures: true,
            dmcMatric: true,
            fatherCnic: true,
          },
        },
        {
          _id: "stu-completed-all",
          fName: "Hassan",
          lName: "Raza",
          fatherOrguardian: "Raza Ali",
          rollNumber: "2026-MED-008",
          programName: "F.Sc Pre-Medical",
          className: "1st Year (11th)",
          sessionName: "2026-2027",
          documents: {
            admissionForm: true,
            formB: true,
            pictures: true,
            dmcMatric: true,
            dmcIntermediate: true,
            fatherCnic: true,
            migration: true,
            affidavit: true,
          },
        },
      ];

      const html = generateStudentDocumentReportPrintHtml({
        students,
        programData: mockPrograms,
        classesData: mockClasses,
        sectionsData: mockSections,
        academicSessions: mockSessions,
      });

      // Brand logo
      expect(html).toContain("/logo.png");

      // Title
      expect(html).toContain("Student Document Report");

      // Brand Name
      expect(html).toContain("Concordia College Peshawar");

      // Single cell student information
      expect(html).toContain("class=\"student-cell\"");
      expect(html).toContain("Usman Ali");
      expect(html).toContain("Ali Raza");
      expect(html).toContain("2026-MED-007");

      // Academic path
      expect(html).toContain("F.Sc Pre-Medical");

      // Exact form document labels
      expect(html).toContain("[✓] Form B / Domicile");
      expect(html).toContain("[ ] DMC Intermediate");
      expect(html).toContain("Submissions:");

      // Only pending students should appear: Usman is included, Hassan (all completed) is omitted
      expect(html).toContain("Usman Ali");
      expect(html).not.toContain("Hassan Raza");

      // Meta strip contains ONLY session and total count
      expect(html).toContain("Session:");
      expect(html).toContain("Total Students:");
      expect(html).not.toContain("Verified Complete:");
      expect(html).not.toContain("Pending Documents:");
      expect(html).not.toContain("Status: ACTIVE");

      // Status column is removed
      expect(html).not.toContain(">Status<");
      expect(html).not.toContain("status-cell-badge");

      // No bright green or purple colors
      expect(html).not.toMatch(/color:\s*(#22c55e|#16a34a|green|#a855f7|purple)/i);
      expect(html).not.toMatch(/background:\s*(#22c55e|#16a34a|green|#a855f7|purple)/i);
    });

    it("generates responsive layout for both portrait and landscape cases", () => {
      const portraitHtml = generateStudentDocumentReportPrintHtml({
        students: [],
        orientation: "portrait",
      });
      expect(portraitHtml).toContain("size: A4 portrait");
      expect(portraitHtml).toContain("portrait-mode");

      const landscapeHtml = generateStudentDocumentReportPrintHtml({
        students: [],
        orientation: "landscape",
      });
      expect(landscapeHtml).toContain("size: A4 landscape");
      expect(landscapeHtml).toContain("landscape-mode");
    });
  });
});
