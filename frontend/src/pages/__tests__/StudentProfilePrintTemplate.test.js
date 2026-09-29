import { describe, it, expect } from "vitest";
import {
  resolveStudentProfileData,
  generateStudentProfilePrintHtml,
  STANDARD_DOCUMENTS,
} from "../students/StudentProfilePrintTemplate";

describe("StudentProfilePrintTemplate", () => {
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

  describe("resolveStudentProfileData", () => {
    it("correctly resolves names, academic hierarchy, documents, and installments", () => {
      const student = {
        _id: "stu-123",
        fName: "Ali",
        lName: "Khan",
        rollNumber: "2026-FSC-001",
        admissionFormNumber: "AF-2026-99",
        programId: "prog-1",
        classId: "class-1",
        sectionId: "sec-1",
        sessionId: "sess-1",
        admissionDate: "2026-08-15T00:00:00.000Z",
        dob: "2008-05-12T00:00:00.000Z",
        gender: "Male",
        religion: "Islam",
        studentCnic: "35201-1234567-1",
        fatherOrguardian: "Tariq Khan",
        parentCNIC: "35201-7654321-9",
        parentOrGuardianPhone: "0300-1234567",
        parentOrGuardianEmail: "tariq@example.com",
        address: "House 1, Street 2, Lahore",
        documents: JSON.stringify({
          formB: true,
          pictures: true,
          dmcMatric: true,
          dmcIntermediate: false,
          fatherCnic: true,
        }),
        installments: [
          {
            installmentNumber: 1,
            month: "September 2026",
            dueDate: "2026-09-10",
            amount: 30000,
            basePayable: 30000,
          },
          {
            installmentNumber: 2,
            month: "November 2026",
            dueDate: "2026-11-10",
            amount: 25000,
            basePayable: 25000,
          },
          {
            installmentNumber: 3,
            month: "January 2027",
            dueDate: "2027-01-10",
            amount: 25000,
            basePayable: 25000,
          },
        ],
      };

      const mockChallans = [
        {
          installmentNumber: 1,
          status: "PAID",
          paidAmount: 30000,
          totalAmount: 30000,
        },
        {
          installmentNumber: 2,
          status: "PARTIAL",
          paidAmount: 10000,
          totalAmount: 25000,
        },
        {
          installmentNumber: 3,
          status: "PENDING",
          paidAmount: 0,
          totalAmount: 25000,
        },
      ];

      const resolved = resolveStudentProfileData({
        student,
        programData: mockPrograms,
        classesData: mockClasses,
        sectionsData: mockSections,
        academicSessions: mockSessions,
        feeChallans: mockChallans,
      });

      expect(resolved.fullName).toBe("Ali Khan");
      expect(resolved.rollNumber).toBe("2026-FSC-001");
      expect(resolved.programName).toBe("F.Sc Pre-Medical");
      expect(resolved.className).toBe("1st Year (11th)");
      expect(resolved.sectionName).toBe("Section A");
      expect(resolved.sessionName).toBe("2025-2027");

      // Verify documents
      const formBDoc = resolved.docsList.find((d) => d.key === "formB");
      expect(formBDoc?.isSubmitted).toBe(true);
      const interDoc = resolved.docsList.find((d) => d.key === "dmcIntermediate");
      expect(interDoc?.isSubmitted).toBe(false);

      // Verify installments statuses
      expect(resolved.installments).toHaveLength(3);
      expect(resolved.installments[0].status).toBe("PAID");
      expect(resolved.installments[0].paidAmount).toBe(30000);
      expect(resolved.installments[0].balance).toBe(0);

      expect(resolved.installments[1].status).toBe("PARTIAL");
      expect(resolved.installments[1].paidAmount).toBe(10000);
      expect(resolved.installments[1].balance).toBe(15000);

      expect(resolved.installments[2].status).toBe("PENDING");
      expect(resolved.installments[2].paidAmount).toBe(0);
      expect(resolved.installments[2].balance).toBe(25000);

      // Verify financial totals
      expect(resolved.totalPlanAmount).toBe(80000);
      expect(resolved.totalPaidAmount).toBe(40000);
      expect(resolved.totalBalance).toBe(40000);
    });

    it("correctly identifies SETTLED installment status", () => {
      const student = {
        _id: "stu-settled",
        fName: "Sara",
        installments: [
          {
            installmentNumber: 1,
            month: "September 2026",
            amount: 20000,
            status: "SETTLED",
          },
        ],
      };

      const resolved = resolveStudentProfileData({
        student,
      });

      expect(resolved.installments[0].status).toBe("SETTLED");
    });
  });

  describe("generateStudentProfilePrintHtml", () => {
    it("renders default user SVG icon when student has no photo_url", () => {
      const student = {
        fName: "Usman",
        rollNumber: "2026-002",
      };

      const html = generateStudentProfilePrintHtml({ student });

      // Must contain SVG default user avatar
      expect(html).toContain("<svg");
      expect(html).toContain('d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"');
      expect(html).toContain('circle cx="12" cy="7" r="4"');
      // Logo
      expect(html).toContain("/logo.png");
    });

    it("renders student image with SVG fallback when photo_url is provided", () => {
      const student = {
        fName: "Usman",
        photo_url: "uploads/students/usman.jpg",
      };

      const html = generateStudentProfilePrintHtml({ student });

      expect(html).toContain("<img");
      expect(html).toContain("/uploads/students/usman.jpg");
      // Fallback SVG is also present for onerror
      expect(html).toContain("<svg");
    });

    it("includes documents checklist and fee installments table with PAID, SETTLED, PARTIAL, PENDING", () => {
      const student = {
        fName: "Hamza",
        rollNumber: "2026-005",
        documents: {
          admissionForm: true,
          formB: false,
        },
        installments: [
          { installmentNumber: 1, month: "Oct 2026", amount: 10000, paidAmount: 10000, status: "PAID" },
          { installmentNumber: 2, month: "Nov 2026", amount: 10000, status: "SETTLED" },
          { installmentNumber: 3, month: "Dec 2026", amount: 10000, paidAmount: 5000, status: "PARTIAL" },
          { installmentNumber: 4, month: "Jan 2027", amount: 10000, paidAmount: 0, status: "PENDING" },
        ],
      };

      const html = generateStudentProfilePrintHtml({ student });

      // Document status tags
      expect(html).toContain("[✓] SUBMITTED");
      expect(html).toContain("[ ] PENDING");

      // Fee status tags
      expect(html).toContain(">PAID<");
      expect(html).toContain(">SETTLED<");
      expect(html).toContain(">PARTIAL<");
      expect(html).toContain(">PENDING<");

      // Undertaking and signatures
      expect(html).toContain("Undertaking &amp; Declaration");
      expect(html).toContain("Student's Signature");
      expect(html).toContain("Guardian's Signature");
      expect(html).toContain("Accounts In-Charge");
      expect(html).toContain("Principal / Director");

      // Verify no bright green or purple colors are used for statuses
      expect(html).not.toMatch(/color:\s*(#22c55e|#16a34a|green|#a855f7|purple)/i);
      expect(html).not.toMatch(/background:\s*(#22c55e|#16a34a|green|#a855f7|purple)/i);
    });
  });
});
