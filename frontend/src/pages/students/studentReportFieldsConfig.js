import * as XLSX from "xlsx";
import { formatAmountSafe } from "./StudentProfilePrintTemplate";

/**
 * Metadata configuration for all sections and fields available
 * in the Individual Student Report & Profile Export.
 */
export const REPORT_SECTIONS = [
  {
    key: "personalInfo",
    title: "Personal & Contact Information",
    shortTitle: "Personal Information",
    description: "Student identity, demographics, phone numbers, and home address.",
    fields: [
      {
        key: "fullName",
        label: "Student Full Name",
        getValue: (d) => d.fullName || "—",
      },
      {
        key: "studentCnic",
        label: "CNIC / Form B",
        getValue: (d) => d.studentCnic || "—",
      },
      {
        key: "dob",
        label: "Date of Birth",
        getValue: (d) => d.dob || "—",
      },
      {
        key: "gender",
        label: "Gender",
        getValue: (d) => d.gender || "—",
      },
      {
        key: "religion",
        label: "Religion",
        getValue: (d) => d.religion || "—",
      },
      {
        key: "phone",
        label: "Contact Phone",
        getValue: (d) => d.phone || "—",
      },
      {
        key: "email",
        label: "Email Address",
        getValue: (d) => d.email || "—",
      },
      {
        key: "address",
        label: "Residential Address",
        getValue: (d) => d.address || "—",
        isWide: true,
      },
      {
        key: "photo",
        label: "Student Photograph",
        getValue: (d) => (d.photoUrl ? "Photo Attached" : "Default Avatar"),
      },
    ],
  },
  {
    key: "academicInfo",
    title: "Academic & Enrollment Details",
    shortTitle: "Academic Details",
    description: "Roll number, admission form reference, program, class, and session.",
    fields: [
      {
        key: "rollNumber",
        label: "Roll Number",
        getValue: (d) => d.rollNumber || "—",
      },
      {
        key: "admissionFormNumber",
        label: "Admission Form Ref",
        getValue: (d) => d.admissionFormNumber || "—",
      },
      {
        key: "sessionName",
        label: "Academic Session",
        getValue: (d) => d.sessionName || "—",
      },
      {
        key: "programName",
        label: "Academic Program",
        getValue: (d) => d.programName || "—",
      },
      {
        key: "className",
        label: "Class Level",
        getValue: (d) => d.className || "—",
      },
      {
        key: "sectionName",
        label: "Section",
        getValue: (d) => (d.sectionName && d.sectionName !== "—" ? d.sectionName : "—"),
      },
      {
        key: "admissionDate",
        label: "Admission Date",
        getValue: (d) => d.admissionDate || "—",
      },
      {
        key: "status",
        label: "Enrollment Status",
        getValue: (d) => d.status || "ACTIVE",
      },
    ],
  },
  {
    key: "guardianInfo",
    title: "Parent / Guardian Details",
    shortTitle: "Parent / Guardian Details",
    description: "Father/Guardian contact details, CNIC, and emergency phone numbers.",
    fields: [
      {
        key: "fatherOrguardian",
        label: "Guardian / Father Name",
        getValue: (d) => d.fatherOrguardian || "—",
      },
      {
        key: "parentCNIC",
        label: "Guardian CNIC",
        getValue: (d) => d.parentCNIC || "—",
      },
      {
        key: "emergencyPhone",
        label: "Emergency Phone",
        getValue: (d) => d.phone || "—",
      },
      {
        key: "guardianEmail",
        label: "Guardian Email",
        getValue: (d) => d.email || "—",
      },
    ],
  },
  {
    key: "previousEducation",
    title: "Previous Education & Academic Record",
    shortTitle: "Previous Education",
    description: "Previous school/college, previous board roll number, and exam marks.",
    fields: [
      {
        key: "previousBoardName",
        label: "Previous Board / Institution",
        getValue: (d) => d.previousBoardName || "—",
      },
      {
        key: "previousBoardRollNumber",
        label: "Previous Board Roll",
        getValue: (d) => d.previousBoardRollNumber || "—",
      },
      {
        key: "marks",
        label: "Obtained / Total Marks",
        getValue: (d) =>
          d.obtainedMarks != null
            ? `${d.obtainedMarks}${d.totalMarks ? ` / ${d.totalMarks}` : ""}`
            : "—",
      },
    ],
  },
  {
    key: "documentsChecklist",
    title: "Required Documents Verification Checklist",
    shortTitle: "Documents Checklist",
    description: "Checklist of mandatory and optional submitted certificates and forms.",
    isDocumentsSection: true,
  },
  {
    key: "feeSchedule",
    title: "Fee Installment Plan & Financial Schedule",
    shortTitle: "Fee Schedule",
    description: "Structured installment schedule, due dates, billing months, and balances.",
    fields: [
      {
        key: "feeSummary",
        label: "Financial Summary Totals",
        getValue: (d) =>
          `Plan: PKR ${formatAmountSafe(d.totalPlanAmount)} | Paid: PKR ${formatAmountSafe(
            d.totalPaidAmount
          )} | Dues: PKR ${formatAmountSafe(d.totalBalance)}`,
      },
      {
        key: "installmentTable",
        label: "Installment Breakdown Schedule",
        getValue: (d) => `${d.installments?.length || 0} installment(s) configured`,
      },
    ],
  },
  {
    key: "undertakingSignatures",
    title: "Undertaking & Official Signatures",
    shortTitle: "Undertaking & Signatures",
    description: "Student/Guardian undertaking declaration and college authority stamps.",
    fields: [
      {
        key: "undertakingText",
        label: "Undertaking Declaration Text",
        getValue: () => "Solemn declaration clause",
      },
      {
        key: "signatureBoxes",
        label: "Signature Blocks (Candidate, Guardian, Accounts, Principal)",
        getValue: () => "4 Official verification signatures",
      },
    ],
  },
];

/**
 * Builds the default selection state where all sections and all fields are enabled.
 */
export const getDefaultReportFieldSelection = (docsList = []) => {
  const sections = {};
  const fields = {};

  REPORT_SECTIONS.forEach((sec) => {
    sections[sec.key] = true;
    fields[sec.key] = {};

    if (sec.isDocumentsSection) {
      (docsList || []).forEach((doc) => {
        fields[sec.key][doc.key] = true;
      });
    } else if (sec.fields) {
      sec.fields.forEach((f) => {
        fields[sec.key][f.key] = true;
      });
    }
  });

  return { sections, fields };
};

/**
 * Exports the customized student report to Excel (.xlsx).
 */
export const exportStudentReportToExcel = ({
  data,
  fieldSelection,
  formattedPrintDate,
}) => {
  if (!data) return;

  const { sections = {}, fields = {} } = fieldSelection || {};
  const wb = XLSX.utils.book_new();
  const rows = [];

  // Header Title
  rows.push(["CONCORDIA COLLEGE PESHAWAR"]);
  rows.push(["Student Profile & Admission Record"]);
  rows.push(["Generated At:", formattedPrintDate || new Date().toLocaleString()]);
  rows.push([]);

  // Section 1: Academic Info
  if (sections.academicInfo) {
    rows.push(["--- ACADEMIC & ENROLLMENT DETAILS ---"]);
    const secFields = fields.academicInfo || {};
    const academicSec = REPORT_SECTIONS.find((s) => s.key === "academicInfo");
    academicSec?.fields?.forEach((f) => {
      if (secFields[f.key]) {
        rows.push([f.label, f.getValue(data)]);
      }
    });
    rows.push([]);
  }

  // Section 2: Personal Info
  if (sections.personalInfo) {
    rows.push(["--- PERSONAL & CONTACT INFORMATION ---"]);
    const secFields = fields.personalInfo || {};
    const personalSec = REPORT_SECTIONS.find((s) => s.key === "personalInfo");
    personalSec?.fields?.forEach((f) => {
      if (secFields[f.key]) {
        rows.push([f.label, f.getValue(data)]);
      }
    });
    rows.push([]);
  }

  // Section 3: Guardian Info
  if (sections.guardianInfo) {
    rows.push(["--- PARENT / GUARDIAN INFORMATION ---"]);
    const secFields = fields.guardianInfo || {};
    const guardianSec = REPORT_SECTIONS.find((s) => s.key === "guardianInfo");
    guardianSec?.fields?.forEach((f) => {
      if (secFields[f.key]) {
        rows.push([f.label, f.getValue(data)]);
      }
    });
    rows.push([]);
  }

  // Section 4: Previous Education
  if (sections.previousEducation) {
    rows.push(["--- PREVIOUS EDUCATION RECORD ---"]);
    const secFields = fields.previousEducation || {};
    const prevSec = REPORT_SECTIONS.find((s) => s.key === "previousEducation");
    prevSec?.fields?.forEach((f) => {
      if (secFields[f.key]) {
        rows.push([f.label, f.getValue(data)]);
      }
    });
    rows.push([]);
  }

  // Section 5: Documents Checklist
  if (sections.documentsChecklist && Array.isArray(data.docsList) && data.docsList.length > 0) {
    rows.push(["--- REQUIRED DOCUMENTS CHECKLIST ---"]);
    rows.push(["#", "Document Description", "Requirement", "Verification", "Status / Remarks"]);
    const docFields = fields.documentsChecklist || {};
    let idx = 1;
    data.docsList.forEach((doc) => {
      if (docFields[doc.key] !== false) {
        rows.push([
          idx++,
          doc.label,
          doc.requirement,
          doc.isSubmitted ? "SUBMITTED" : "PENDING",
          doc.remarks || (doc.isSubmitted ? "Verified" : "Pending Submission"),
        ]);
      }
    });
    rows.push([]);
  }

  // Section 6: Fee Installment Plan
  if (sections.feeSchedule) {
    rows.push(["--- FEE INSTALLMENT SCHEDULE & FINANCIAL SUMMARY ---"]);
    const feeFields = fields.feeSchedule || {};

    if (feeFields.installmentTable && Array.isArray(data.installments) && data.installments.length > 0) {
      rows.push([
        "Inst #",
        "Billing Period / Month",
        "Due Date",
        "Plan Amount (PKR)",
        "Paid Amount (PKR)",
        "Balance (PKR)",
        "Status",
      ]);
      data.installments.forEach((inst) => {
        rows.push([
          `#${inst.installmentNumber}`,
          inst.month,
          inst.dueDate,
          inst.planAmount,
          inst.paidAmount,
          inst.balance,
          inst.status,
        ]);
      });
      rows.push([
        "TOTAL FINANCIAL SUMMARY",
        "",
        "",
        data.totalPlanAmount,
        data.totalPaidAmount,
        data.totalBalance,
        data.totalBalance === 0 && data.totalPlanAmount > 0 ? "ALL CLEARED" : "OUTSTANDING",
      ]);
    } else if (feeFields.feeSummary) {
      rows.push(["Total Plan Amount (PKR)", data.totalPlanAmount]);
      rows.push(["Total Paid Amount (PKR)", data.totalPaidAmount]);
      rows.push(["Total Balance (PKR)", data.totalBalance]);
    }
    rows.push([]);
  }

  // Section 7: Signatures & Undertaking
  if (sections.undertakingSignatures) {
    rows.push(["--- UNDERTAKING & OFFICIAL SIGNATURES ---"]);
    const sigFields = fields.undertakingSignatures || {};
    if (sigFields.undertakingText) {
      rows.push([
        "Undertaking Clause:",
        "Solemn declaration by student and guardian confirming authenticity of information.",
      ]);
    }
    if (sigFields.signatureBoxes) {
      rows.push(["Required Signatures:", "Student, Guardian, Accounts In-Charge, Principal / Director"]);
    }
    rows.push([]);
  }

  // Create sheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 30 },
    { wch: 35 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Student Profile");

  const studentName = (data.fullName || "Student").replace(/\s+/g, "_");
  const rollNumber = (data.rollNumber || "Report").replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `Student_Report_${studentName}_${rollNumber}.xlsx`;

  XLSX.writeFile(wb, fileName);
};
