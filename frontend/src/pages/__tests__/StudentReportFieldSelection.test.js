import { describe, it, expect, vi } from "vitest";
import {
  generateStudentProfilePrintHtml,
  generateStudentProfileFormBodyHtml,
  resolveStudentProfileData,
} from "../students/StudentProfilePrintTemplate";
import {
  REPORT_SECTIONS,
  getDefaultReportFieldSelection,
  exportStudentReportToExcel,
} from "../students/studentReportFieldsConfig";

describe("Student Report Field Selection & Export", () => {
  const mockStudent = {
    _id: "stu-999",
    fName: "Adnan",
    lName: "Sami",
    rollNumber: "2026-FSC-042",
    admissionFormNumber: "AF-2026-108",
    gender: "Male",
    religion: "Islam",
    studentCnic: "17301-1234567-1",
    fatherOrguardian: "Samiullah",
    parentCNIC: "17301-7654321-9",
    parentOrGuardianPhone: "0300-9876543",
    parentOrGuardianEmail: "sami@example.com",
    address: "University Road, Peshawar",
    documents: JSON.stringify({
      formB: true,
      pictures: true,
      dmcMatric: false,
    }),
    installments: [
      {
        installmentNumber: 1,
        month: "September 2026",
        dueDate: "2026-09-10",
        amount: 25000,
        paidAmount: 25000,
        status: "PAID",
      },
    ],
  };

  const resolved = resolveStudentProfileData({ student: mockStudent });

  it("provides complete metadata for REPORT_SECTIONS with accessor functions", () => {
    expect(REPORT_SECTIONS.length).toBeGreaterThanOrEqual(6);

    const personalSec = REPORT_SECTIONS.find((s) => s.key === "personalInfo");
    expect(personalSec).toBeDefined();
    expect(personalSec.title).toContain("Personal");

    const nameField = personalSec.fields.find((f) => f.key === "fullName");
    expect(nameField).toBeDefined();
    expect(nameField.getValue(resolved)).toBe("Adnan Sami");

    const cnicField = personalSec.fields.find((f) => f.key === "studentCnic");
    expect(cnicField.getValue(resolved)).toBe("17301-1234567-1");
  });

  it("getDefaultReportFieldSelection activates all sections and all fields by default", () => {
    const selection = getDefaultReportFieldSelection(resolved.docsList);

    expect(selection.sections.personalInfo).toBe(true);
    expect(selection.sections.academicInfo).toBe(true);
    expect(selection.sections.guardianInfo).toBe(true);
    expect(selection.sections.documentsChecklist).toBe(true);
    expect(selection.sections.feeSchedule).toBe(true);
    expect(selection.sections.undertakingSignatures).toBe(true);

    expect(selection.fields.personalInfo.fullName).toBe(true);
    expect(selection.fields.personalInfo.studentCnic).toBe(true);
    expect(selection.fields.personalInfo.address).toBe(true);
    expect(selection.fields.academicInfo.rollNumber).toBe(true);
  });

  it("omits unchecked sections completely from the generated HTML", () => {
    const selection = getDefaultReportFieldSelection(resolved.docsList);
    // Disable Fee Schedule and Documents Checklist
    selection.sections.feeSchedule = false;
    selection.sections.documentsChecklist = false;

    const html = generateStudentProfileFormBodyHtml({
      data: resolved,
      formattedPrintDate: "09/10/2026 12:00",
      logoUrl: "/logo.png",
      fieldSelection: selection,
    });

    // Academic & Personal must exist
    expect(html).toContain("Academic &amp; Enrollment Details");
    expect(html).toContain("Personal &amp; Contact Information");

    // Fee Schedule & Documents must NOT exist
    expect(html).not.toContain("Fee Installment Plan &amp; Financial Schedule");
    expect(html).not.toContain("Required Documents Verification Checklist");
  });

  it("omits unchecked fields inside an active section cleanly without breaking table layout", () => {
    const selection = getDefaultReportFieldSelection(resolved.docsList);
    // In Personal Info: include ONLY fullName and phone; exclude studentCnic, religion, address, dob, gender
    selection.fields.personalInfo = {
      fullName: true,
      phone: true,
      studentCnic: false,
      religion: false,
      address: false,
      dob: false,
      gender: false,
      email: false,
      photo: false,
    };

    const html = generateStudentProfileFormBodyHtml({
      data: resolved,
      formattedPrintDate: "09/10/2026 12:00",
      logoUrl: "/logo.png",
      fieldSelection: selection,
    });

    // Should include selected fields
    expect(html).toContain("Student Full Name");
    expect(html).toContain("Adnan Sami");
    expect(html).toContain("Contact Phone");
    expect(html).toContain("0300-9876543");

    // Should omit unchecked fields
    expect(html).not.toContain("17301-1234567-1");
    expect(html).not.toContain("CNIC / Form B");
    expect(html).not.toContain("University Road, Peshawar");
    expect(html).not.toContain("Residential Address");
  });

  it("omits photo box when photo field is unchecked", () => {
    const selection = getDefaultReportFieldSelection(resolved.docsList);
    selection.fields.personalInfo.photo = false;

    const html = generateStudentProfileFormBodyHtml({
      data: resolved,
      formattedPrintDate: "09/10/2026 12:00",
      logoUrl: "/logo.png",
      fieldSelection: selection,
    });

    expect(html).not.toContain('class="photo-box"');
  });
});
