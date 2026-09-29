import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { resolveFileUrl } from "@/lib/utils";
import { getStudentFeeHistory } from "../../../config/apis";

export const STANDARD_DOCUMENTS = [
  {
    key: "formB",
    label: "Form B / Domicile",
    requirement: "Mandatory",
    aliases: ["formB", "bForm", "b_form", "B Form", "Form B", "Form B / Domicile"],
  },
  {
    key: "pictures",
    label: "4 Passport Size Pictures",
    requirement: "Mandatory",
    aliases: ["pictures", "photos", "photo", "4 Photos", "4 Passport Size Pictures", "4 Passport Size Photographs"],
  },
  {
    key: "dmcMatric",
    label: "DMC Matric",
    requirement: "Mandatory",
    aliases: ["dmcMatric", "matricDmc", "matric", "DMC Matric", "Matric DMC"],
  },
  {
    key: "dmcIntermediate",
    label: "DMC Intermediate",
    requirement: "Optional",
    aliases: ["dmcIntermediate", "interDmc", "intermediate", "DMC Intermediate", "Inter DMC"],
  },
  {
    key: "fatherCnic",
    label: "Father CNIC",
    requirement: "Mandatory",
    aliases: ["fatherCnic", "father_cnic", "guardianCnic", "Father CNIC", "Father / Guardian CNIC Copy"],
  },
  {
    key: "migration",
    label: "Migration (if from other board)",
    requirement: "Optional",
    aliases: ["migration", "migrationCertificate", "Migration", "Migration (if from other board)", "Migration / NOC Certificate"],
  },
  {
    key: "affidavit",
    label: "Affidavit",
    requirement: "Optional",
    aliases: ["affidavit", "Affidavit", "characterCertificate", "Character Certificate / Affidavit"],
  },
  {
    key: "admissionForm",
    label: "Admission Form",
    requirement: "Mandatory",
    aliases: ["admissionForm", "admission_form", "Admission Form", "College Admission Form"],
  },
];

export const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return String(val);
};

export const formatDateSafe = (val, fallback = "—") => {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    return format(d, "dd MMM yyyy");
  } catch {
    return fallback;
  }
};

export const formatAmountSafe = (val) => {
  const num = Number(val);
  if (isNaN(num)) return "0";
  return num.toLocaleString();
};

/**
 * Normalizes all student profile data, resolving IDs with program/class/session lists,
 * parsing documents, and calculating installment statuses with challan history.
 */
export const resolveStudentProfileData = ({
  student = {},
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  feeChallans = [],
}) => {
  const studentId = extractId(student.id || student._id);
  const fullName = `${student.fName || ""} ${student.lName || ""}`.trim() || "Student Name";
  const rollNumber = student.rollNumber || "—";
  const admissionFormNumber = student.admissionFormNumber || "—";

  // Academic resolution
  const studentProgId = extractId(student.programId || student.program);
  const studentClassId = extractId(student.classId || student.class);
  const studentSecId = extractId(student.sectionId || student.section);
  const studentSessId = extractId(student.sessionId || student.session);

  let programName = typeof student.program === "object" ? student.program?.name : "";
  if (!programName && studentProgId) {
    const p = programData.find((item) => extractId(item) === studentProgId);
    programName = p?.name || "";
  }
  if (!programName && typeof student.program === "string" && student.program.length > 5) {
    programName = student.program;
  }

  let className = typeof student.class === "object" ? student.class?.name : "";
  if (!className && studentClassId) {
    const c = classesData.find((item) => extractId(item) === studentClassId);
    className = c?.name || "";
  }
  if (!className && typeof student.class === "string" && student.class.length > 3) {
    className = student.class;
  }

  let sectionName = typeof student.section === "object" ? student.section?.name : "";
  if (!sectionName && studentSecId) {
    const s = sectionsData.find((item) => extractId(item) === studentSecId);
    sectionName = s?.name || "";
  }
  if (!sectionName && typeof student.section === "string" && student.section.length > 0) {
    sectionName = student.section;
  }

  let sessionName = typeof student.session === "object" ? student.session?.name : "";
  if (!sessionName && studentSessId) {
    const sess = academicSessions.find((item) => extractId(item) === studentSessId);
    sessionName = sess?.name || "";
  }
  if (!sessionName && typeof student.session === "string") {
    sessionName = student.session;
  }

  // Documents resolution
  let rawDocs = student.documents || {};
  if (typeof rawDocs === "string") {
    try {
      rawDocs = JSON.parse(rawDocs);
    } catch {
      rawDocs = {};
    }
  }

  const allAliases = new Set();
  STANDARD_DOCUMENTS.forEach((d) => (d.aliases || [d.key]).forEach((a) => allAliases.add(a)));

  const docsList = STANDARD_DOCUMENTS.map((doc) => {
    let isSubmitted = false;
    const aliases = doc.aliases || [doc.key];
    for (const alias of aliases) {
      if (rawDocs[alias] === true || rawDocs[alias] === "true" || rawDocs[alias] === 1) {
        isSubmitted = true;
        break;
      }
    }
    return {
      key: doc.key,
      label: doc.label,
      requirement: doc.requirement,
      isSubmitted,
      remarks: isSubmitted ? "Verified & Attached" : "Pending Submission",
    };
  });

  // Include only genuine extra custom documents (excluding personal fields and known aliases)
  const ignoredKeys = new Set(["address", "phone", "email", "id", "_id", "name", "status"]);
  Object.keys(rawDocs).forEach((k) => {
    if (!allAliases.has(k) && !ignoredKeys.has(k.toLowerCase()) && typeof rawDocs[k] !== "object") {
      const isSubmitted = Boolean(rawDocs[k]);
      docsList.push({
        key: k,
        label: k.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
        requirement: "Optional",
        isSubmitted,
        remarks: isSubmitted ? "Verified & Attached" : "Pending Submission",
      });
    }
  });

  // Installments resolution
  let rawInstallments =
    student.installments ||
    student.feeInstallments ||
    [];

  if (typeof rawInstallments === "string") {
    try {
      rawInstallments = JSON.parse(rawInstallments);
    } catch {
      rawInstallments = [];
    }
  }

  // If no installments array, but student has feeChallans passed, use them
  if ((!rawInstallments || rawInstallments.length === 0) && Array.isArray(feeChallans) && feeChallans.length > 0) {
    rawInstallments = feeChallans.map((c, idx) => ({
      installmentNumber: c.installmentNumber || idx + 1,
      amount: Number(c.amount) || Number(c.basePayable) || 0,
      basePayable: Number(c.basePayable) || Number(c.amount) || 0,
      totalAmount: Number(c.totalAmount) || Number(c.amount) || 0,
      dueDate: c.dueDate,
      month: c.month,
      session: typeof c.session === "object" ? c.session?.name : c.session,
      status: c.status,
      paidAmount: Number(c.paidAmount || 0),
    }));
  }

  // Fallback if student only has a single tuitionFee
  if ((!rawInstallments || rawInstallments.length === 0) && (student.tuitionFee || student.tuition_fee)) {
    const feeVal = Number(student.tuitionFee || student.tuition_fee) || 0;
    if (feeVal > 0) {
      rawInstallments = [
        {
          installmentNumber: 1,
          month: "Admission Term",
          dueDate: student.admissionDate || new Date().toISOString(),
          amount: feeVal,
          basePayable: feeVal,
          totalAmount: feeVal,
          status: "PENDING",
          paidAmount: 0,
        },
      ];
    }
  }

  const installments = (rawInstallments || [])
    .map((inst, idx) => {
      const instNumber = inst.installmentNumber || idx + 1;
      const targetInstId = extractId(inst.id || inst._id);

      // Match with challans if available
      const matchingChallan = (feeChallans || []).find((ch) => {
        const chInstId = extractId(ch.installment?.id || ch.installment?._id || ch.installmentId);
        if (targetInstId && chInstId && targetInstId === chInstId) return true;
        if (ch.installmentNumber && Number(ch.installmentNumber) === Number(instNumber)) {
          return true;
        }
        return false;
      });

      const planAmount = Number(
        inst.basePayable ?? inst.amount ?? matchingChallan?.totalAmount ?? matchingChallan?.amount ?? 0
      );
      const paidAmount = Number(inst.paidAmount ?? matchingChallan?.paidAmount ?? 0);
      const balance = Math.max(0, planAmount - paidAmount);

      const rawStatus = (
        inst.status ||
        matchingChallan?.status ||
        "PENDING"
      ).toUpperCase();

      let finalStatus = "PENDING";
      if (rawStatus === "PAID" || (planAmount > 0 && paidAmount >= planAmount)) {
        finalStatus = "PAID";
      } else if (rawStatus === "SETTLED") {
        finalStatus = "SETTLED";
      } else if (rawStatus === "PARTIAL" || (paidAmount > 0 && paidAmount < planAmount)) {
        finalStatus = "PARTIAL";
      } else {
        finalStatus = "PENDING";
      }

      let monthLabel = inst.month;
      if (!monthLabel && inst.dueDate) {
        try {
          const d = new Date(inst.dueDate);
          if (!isNaN(d.getTime())) {
            monthLabel = format(d, "MMMM yyyy");
          }
        } catch {}
      }

      return {
        installmentNumber: instNumber,
        month: monthLabel || `Installment #${instNumber}`,
        dueDate: formatDateSafe(inst.dueDate),
        planAmount,
        paidAmount,
        balance,
        status: finalStatus,
      };
    })
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  const totalPlanAmount = installments.reduce((sum, i) => sum + i.planAmount, 0);
  const totalPaidAmount = installments.reduce((sum, i) => sum + i.paidAmount, 0);
  const totalBalance = Math.max(0, totalPlanAmount - totalPaidAmount);

  return {
    studentId,
    fullName,
    rollNumber,
    admissionFormNumber,
    sessionName: sessionName || "Current Session",
    programName: programName || "Academic Program",
    className: className || "Class Level",
    sectionName: sectionName || "—",
    admissionDate: formatDateSafe(student.admissionDate),
    status: (student.status || "ACTIVE").toUpperCase(),
    dob: formatDateSafe(student.dob),
    gender: student.gender || "—",
    religion: student.religion || "—",
    studentCnic: student.studentCnic || "—",
    fatherOrguardian: student.fatherOrguardian || "—",
    parentCNIC: student.parentCNIC || "—",
    phone: student.parentOrGuardianPhone || student.phone || "—",
    email: student.parentOrGuardianEmail || student.email || "—",
    address: student.address || "—",
    photoUrl: student.photo_url ? resolveFileUrl(student.photo_url) : "",
    previousBoardName: student.previousBoardName || "—",
    previousBoardRollNumber: student.previousBoardRollNumber || "—",
    obtainedMarks: student.obtainedMarks,
    totalMarks: student.totalMarks,
    docsList,
    installments,
    totalPlanAmount,
    totalPaidAmount,
    totalBalance,
  };
};

/**
 * Returns scoped CSS rules used both in printable HTML and on-screen preview.
 */
export const getStudentProfileFormStyles = () => `
  .student-profile-preview {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.4;
  }

  .student-profile-preview * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .student-profile-preview .form-container {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    background: #ffffff;
    border: 1.5px solid #0f172a;
    border-top: 4px solid #ea580c;
    padding: 14px 16px;
  }

  /* HEADER */
  .student-profile-preview .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 10px;
    margin-bottom: 8px;
    gap: 12px;
  }

  .student-profile-preview .header-logo-area {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .student-profile-preview .header-logo-area img {
    height: 60px;
    max-width: 130px;
    object-fit: contain;
  }

  .student-profile-preview .header-title-block h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #0f172a;
  }

  .student-profile-preview .header-title-block .tagline {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: #475569;
    letter-spacing: 0.5px;
    margin-top: 1px;
  }

  .student-profile-preview .center-calligraphy-title {
    text-align: center;
    font-family: 'Brush Script MT', 'Lucida Calligraphy', 'Segoe Script', 'Great Vibes', 'Playfair Display', Georgia, cursive, serif;
    font-size: 21px;
    font-style: italic;
    font-weight: 500;
    color: #0f172a;
    margin: 4px 0 8px 0;
    padding: 2px 0 6px 0;
    border-bottom: 1px dashed #cbd5e1;
    letter-spacing: 0.5px;
  }

  .student-profile-preview .photo-box {
    width: 95px;
    height: 115px;
    border: 1.5px solid #0f172a;
    background: #f8fafc;
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  /* DOCUMENT METADATA STRIP */
  .student-profile-preview .meta-strip {
    display: flex;
    justify-content: space-between;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    padding: 4px 8px;
    font-size: 10px;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .student-profile-preview .meta-strip span strong {
    color: #0f172a;
  }

  /* SECTION TITLE */
  .student-profile-preview .section-bar {
    background: #f1f5f9;
    color: #0f172a;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 8px;
    border: 1px solid #0f172a;
    border-left: 4px solid #ea580c;
    margin-top: 10px;
    margin-bottom: 0;
  }

  /* DATA GRID TABLE */
  .student-profile-preview .form-grid {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }

  .student-profile-preview .form-grid td {
    border: 1px solid #cbd5e1;
    padding: 4px 7px;
    vertical-align: middle;
  }

  .student-profile-preview .form-grid td.lbl {
    width: 18%;
    background: #f8fafc;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    color: #475569;
    letter-spacing: 0.3px;
  }

  .student-profile-preview .form-grid td.val {
    width: 32%;
    font-size: 11px;
    font-weight: 600;
    color: #0f172a;
  }

  /* DATA LIST TABLES */
  .student-profile-preview .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }

  .student-profile-preview .data-table th {
    background: #f1f5f9;
    color: #0f172a;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
  }

  .student-profile-preview .data-table td {
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
    font-size: 10px;
    color: #0f172a;
  }

  .student-profile-preview .data-table tfoot td {
    background: #f8fafc;
    font-weight: 700;
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
  }

  /* STATUS BADGES - STRICTLY MONOCHROME & SLATE */
  .student-profile-preview .status-badge {
    display: inline-block;
    font-size: 9px;
    letter-spacing: 0.4px;
    padding: 1px 6px;
    border-radius: 2px;
    text-align: center;
    text-transform: uppercase;
  }

  .student-profile-preview .status-paid {
    border: 1.5px solid #0f172a;
    background: #0f172a;
    color: #ffffff;
    font-weight: 700;
  }

  .student-profile-preview .status-settled {
    border: 1.5px solid #334155;
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
  }

  .student-profile-preview .status-partial {
    border: 1.5px dashed #475569;
    background: #ffffff;
    color: #0f172a;
    font-weight: 700;
  }

  .student-profile-preview .status-pending {
    border: 1px solid #94a3b8;
    background: #ffffff;
    color: #475569;
    font-weight: 600;
  }

  .student-profile-preview .badge-submitted {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    border: 1px solid #0f172a;
    background: #f8fafc;
    color: #0f172a;
    padding: 1px 5px;
    border-radius: 2px;
  }

  .student-profile-preview .badge-pending {
    display: inline-block;
    font-size: 9px;
    font-weight: 500;
    border: 1px dashed #94a3b8;
    background: #ffffff;
    color: #64748b;
    padding: 1px 5px;
    border-radius: 2px;
  }

  /* UNDERTAKING & SIGNATURES */
  .student-profile-preview .declaration-box {
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    padding: 6px 8px;
    font-size: 9.5px;
    color: #334155;
    margin-top: 10px;
    margin-bottom: 22px;
    line-height: 1.35;
  }

  .student-profile-preview .signature-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 16px;
    page-break-inside: avoid;
  }

  .student-profile-preview .sig-cell {
    text-align: center;
    border-top: 1.5px solid #0f172a;
    padding-top: 4px;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    color: #0f172a;
  }

  .student-profile-preview .sig-sub {
    font-size: 8px;
    color: #64748b;
    font-weight: 500;
    text-transform: capitalize;
    margin-top: 1px;
  }

  /* FOOTER */
  .student-profile-preview .form-footer {
    margin-top: 12px;
    border-top: 1px solid #cbd5e1;
    padding-top: 4px;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #64748b;
  }

  @media print {
    body {
      margin: 0;
      background: #ffffff !important;
    }
    .student-profile-preview .fee-section-bar {
      page-break-before: always !important;
      break-before: page !important;
      margin-top: 0 !important;
    }
    .student-profile-preview .form-container {
      border: 1.5px solid #0f172a !important;
      padding: 8px 10px !important;
      max-width: 100% !important;
    }
    .student-profile-preview .signature-grid,
    .student-profile-preview .data-table,
    .student-profile-preview .form-grid {
      page-break-inside: avoid;
    }
  }
`;

/**
 * Generates the inner body HTML representing the official student profile form.
 */
export const generateStudentProfileFormBodyHtml = ({ data, formattedPrintDate, logoUrl }) => {
  // Default User Icon as clean vector SVG
  const defaultUserSvg = `
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
    <div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.5px;">Student Photo</div>
  `;

  const photoHtml = data.photoUrl
    ? `
      <img
        src="${data.photoUrl}"
        alt="Student Photo"
        style="width: 100%; height: 100%; object-fit: cover; display: block;"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <div style="display: none; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc;">
        ${defaultUserSvg}
      </div>
    `
    : `
      <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc;">
        ${defaultUserSvg}
      </div>
    `;

  // Documents Rows
  const documentsRowsHtml = data.docsList
    .map(
      (doc, idx) => `
      <tr>
        <td style="text-align: center; font-weight: 600; width: 35px;">${idx + 1}</td>
        <td style="font-weight: 600; color: #0f172a;">${doc.label}</td>
        <td style="text-align: center; width: 90px; color: #475569; font-size: 10px;">${doc.requirement}</td>
        <td style="text-align: center; width: 110px;">
          ${
            doc.isSubmitted
              ? `<span class="badge-submitted">[✓] SUBMITTED</span>`
              : `<span class="badge-pending">[ ] PENDING</span>`
          }
        </td>
        <td style="color: #475569; font-size: 10px;">${doc.remarks}</td>
      </tr>
    `
    )
    .join("");

  // Installments Rows
  const installmentsRowsHtml =
    data.installments.length > 0
      ? data.installments
          .map((inst) => {
            let statusBadge = "";
            if (inst.status === "PAID") {
              statusBadge = `<span class="status-badge status-paid">PAID</span>`;
            } else if (inst.status === "SETTLED") {
              statusBadge = `<span class="status-badge status-settled">SETTLED</span>`;
            } else if (inst.status === "PARTIAL") {
              statusBadge = `<span class="status-badge status-partial">PARTIAL</span>`;
            } else {
              statusBadge = `<span class="status-badge status-pending">PENDING</span>`;
            }

            return `
            <tr>
              <td style="text-align: center; font-weight: 700; width: 45px;">#${inst.installmentNumber}</td>
              <td style="font-weight: 600;">${inst.month}</td>
              <td style="text-align: center; width: 95px; color: #334155;">${inst.dueDate}</td>
              <td style="text-align: right; font-family: monospace; font-weight: 700;">PKR ${formatAmountSafe(inst.planAmount)}</td>
              <td style="text-align: right; font-family: monospace; font-weight: 600;">PKR ${formatAmountSafe(inst.paidAmount)}</td>
              <td style="text-align: right; font-family: monospace; font-weight: 600;">PKR ${formatAmountSafe(inst.balance)}</td>
              <td style="text-align: center; width: 90px;">${statusBadge}</td>
            </tr>
          `;
          })
          .join("")
      : `
        <tr>
          <td colspan="7" style="text-align: center; padding: 14px; color: #64748b;">
            No structured fee installment plan configured for this student.
          </td>
        </tr>
      `;

  const previousEducationRow =
    data.previousBoardName !== "—" || data.previousBoardRollNumber !== "—" || data.obtainedMarks
      ? `
      <tr>
        <td class="lbl">Previous Board / Inst.</td>
        <td class="val">${data.previousBoardName}</td>
        <td class="lbl">Previous Roll / Marks</td>
        <td class="val">
          ${data.previousBoardRollNumber !== "—" ? `Roll: ${data.previousBoardRollNumber} ` : ""}
          ${
            data.obtainedMarks
              ? `Marks: ${data.obtainedMarks}${data.totalMarks ? ` / ${data.totalMarks}` : ""}`
              : ""
          }
        </td>
      </tr>
    `
      : "";

  return `
    <div class="form-container">
      <!-- HEADER -->
      <div class="form-header">
        <div class="header-logo-area">
          <img src="${logoUrl}" alt="Concordia College Peshawar Logo" />
          <div class="header-title-block">
            <h1>Concordia College Peshawar</h1>
            <div class="tagline">A Project of Beaconhouse Group</div>
          </div>
        </div>
        <div class="photo-box">
          ${photoHtml}
        </div>
      </div>

      <!-- CENTERED CALLIGRAPHY TITLE (NO BLACK BG) -->
      <div class="center-calligraphy-title">
        Student Profile &amp; Admission Record
      </div>

      <!-- METADATA STRIP -->
      <div class="meta-strip">
        <span>Roll No: <strong>${data.rollNumber}</strong></span>
        <span>Form Ref: <strong>${data.admissionFormNumber}</strong></span>
        <span>Status: <strong>${data.status}</strong></span>
        <span>Issue Date: <strong>${formattedPrintDate}</strong></span>
      </div>

      <!-- 1. ACADEMIC & ENROLLMENT INFORMATION -->
      <div class="section-bar">1. Academic & Enrollment Details</div>
      <table class="form-grid">
        <tr>
          <td class="lbl">Student Roll No</td>
          <td class="val">${data.rollNumber}</td>
          <td class="lbl">Academic Session</td>
          <td class="val">${data.sessionName}</td>
        </tr>
        <tr>
          <td class="lbl">Program</td>
          <td class="val">${data.programName}</td>
          <td class="lbl">Class & Section</td>
          <td class="val">${data.className} ${data.sectionName && data.sectionName !== "—" ? `(${data.sectionName})` : ""}</td>
        </tr>
        <tr>
          <td class="lbl">Admission Date</td>
          <td class="val">${data.admissionDate}</td>
          <td class="lbl">Enrollment Status</td>
          <td class="val">${data.status}</td>
        </tr>
        ${previousEducationRow}
      </table>

      <!-- 2. STUDENT PERSONAL DETAILS -->
      <div class="section-bar">2. Personal & Contact Information</div>
      <table class="form-grid">
        <tr>
          <td class="lbl">Student Full Name</td>
          <td class="val">${data.fullName}</td>
          <td class="lbl">Father / Guardian</td>
          <td class="val">${data.fatherOrguardian}</td>
        </tr>
        <tr>
          <td class="lbl">CNIC / Form B</td>
          <td class="val">${data.studentCnic}</td>
          <td class="lbl">Date of Birth</td>
          <td class="val">${data.dob}</td>
        </tr>
        <tr>
          <td class="lbl">Gender</td>
          <td class="val">${data.gender}</td>
          <td class="lbl">Religion</td>
          <td class="val">${data.religion}</td>
        </tr>
        <tr>
          <td class="lbl">Contact Phone</td>
          <td class="val">${data.phone}</td>
          <td class="lbl">Email Address</td>
          <td class="val">${data.email}</td>
        </tr>
        <tr>
          <td class="lbl">Residential Address</td>
          <td class="val" colspan="3">${data.address}</td>
        </tr>
      </table>

      <!-- 3. PARENT / GUARDIAN INFORMATION -->
      <div class="section-bar">3. Parent / Guardian Information</div>
      <table class="form-grid">
        <tr>
          <td class="lbl">Guardian Name</td>
          <td class="val">${data.fatherOrguardian}</td>
          <td class="lbl">Guardian CNIC</td>
          <td class="val">${data.parentCNIC}</td>
        </tr>
        <tr>
          <td class="lbl">Emergency Phone</td>
          <td class="val">${data.phone}</td>
          <td class="lbl">Guardian Email</td>
          <td class="val">${data.email}</td>
        </tr>
      </table>

      <!-- 4. DOCUMENTS VERIFICATION CHECKLIST -->
      <div class="section-bar">4. Required Documents Verification Checklist</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>Document Description</th>
            <th style="width: 90px; text-align: center;">Requirement</th>
            <th style="width: 110px; text-align: center;">Verification</th>
            <th>Status / Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${documentsRowsHtml}
        </tbody>
      </table>

      <!-- 5. FEE INSTALLMENT SCHEDULE (STARTS ON 2ND PAGE IN PRINT) -->
      <div class="section-bar fee-section-bar">5. Fee Installment Plan &amp; Financial Schedule</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 45px; text-align: center;">Inst. #</th>
            <th>Billing Period / Month</th>
            <th style="width: 95px; text-align: center;">Due Date</th>
            <th style="text-align: right; width: 100px;">Plan Amount</th>
            <th style="text-align: right; width: 100px;">Paid Amount</th>
            <th style="text-align: right; width: 100px;">Balance</th>
            <th style="width: 90px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${installmentsRowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align: right; font-weight: 800; text-transform: uppercase;">
              Total Financial Summary:
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 800;">
              PKR ${formatAmountSafe(data.totalPlanAmount)}
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 800;">
              PKR ${formatAmountSafe(data.totalPaidAmount)}
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 800;">
              PKR ${formatAmountSafe(data.totalBalance)}
            </td>
            <td style="text-align: center; font-size: 8.5px; font-weight: 700;">
              ${data.totalBalance === 0 && data.totalPlanAmount > 0 ? "ALL CLEARED" : "OUTSTANDING"}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- 6. UNDERTAKING & OFFICIAL SIGNATURES -->
      <div class="declaration-box">
        <strong>Undertaking &amp; Declaration:</strong> I hereby solemnly declare that all particulars stated in this admission and student profile record are authentic, complete, and correct to the best of my knowledge. I promise to abide by all the rules, regulations, discipline policies, and fee deadlines of Concordia College Peshawar.
      </div>

      <div class="signature-grid">
        <div class="sig-cell">
          Student's Signature
          <div class="sig-sub">Candidate Signature</div>
        </div>
        <div class="sig-cell">
          Guardian's Signature
          <div class="sig-sub">Father / Mother / Guardian</div>
        </div>
        <div class="sig-cell">
          Accounts In-Charge
          <div class="sig-sub">Fee Clearance Verification</div>
        </div>
        <div class="sig-cell">
          Principal / Director
          <div class="sig-sub">Official Stamp &amp; Seal</div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="form-footer">
        <span>Concordia College Peshawar Student Information System • Confidential Record</span>
        <span>Printed: ${formattedPrintDate}</span>
      </div>
    </div>
  `;
};

/**
 * Generates the complete HTML string representing the official student profile form.
 * Used for managed window printing and Save as PDF.
 */
export const generateStudentProfilePrintHtml = ({
  student,
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  feeChallans = [],
  printDate = new Date(),
}) => {
  const data = resolveStudentProfileData({
    student,
    programData,
    classesData,
    sectionsData,
    academicSessions,
    feeChallans,
  });

  const formattedPrintDate = format(printDate, "dd/MM/yyyy HH:mm");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${origin}/logo.png`;

  const bodyHtml = generateStudentProfileFormBodyHtml({ data, formattedPrintDate, logoUrl });
  const styles = getStudentProfileFormStyles();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Student Profile Form - ${data.fullName} (${data.rollNumber})</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }

        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        html, body {
          overflow-x: hidden;
        }

        body {
          margin: 0;
          padding: 0;
          background: #ffffff;
        }

        ${styles}
      </style>
    </head>
    <body class="student-profile-preview">
      ${bodyHtml}
    </body>
    </html>
  `;
};

/**
 * On-screen preview modal component.
 * Displays the form in clean paper-style layout with [Print / Save as PDF] and [Close] actions.
 * Directly renders into the DOM (no iframe traps) so native scrolling is 100% smooth and continuous.
 */
export const StudentProfilePrintDialog = ({
  open,
  onOpenChange,
  student,
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  feeChallans: propFeeChallans = null,
  isNewlyCreated = false,
}) => {
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);

  const studentId = extractId(student?.id || student?._id);

  // If challans not passed directly, fetch them when dialog opens
  const { data: fetchedFeeChallans = [] } = useQuery({
    queryKey: ["studentProfilePrintChallans", studentId],
    queryFn: () => getStudentFeeHistory(studentId, "INSTALLMENT"),
    enabled: open && !!studentId && !propFeeChallans,
    staleTime: 60000,
  });

  const effectiveChallans = propFeeChallans || fetchedFeeChallans || [];

  const resolvedData = useMemo(() => {
    if (!student) return null;
    return resolveStudentProfileData({
      student,
      programData,
      classesData,
      sectionsData,
      academicSessions,
      feeChallans: effectiveChallans,
    });
  }, [student, programData, classesData, sectionsData, academicSessions, effectiveChallans]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${origin}/logo.png`;
  const formattedPrintDate = useMemo(() => format(new Date(), "dd/MM/yyyy HH:mm"), []);

  const bodyHtml = useMemo(() => {
    if (!resolvedData) return "";
    return generateStudentProfileFormBodyHtml({
      data: resolvedData,
      formattedPrintDate,
      logoUrl,
    });
  }, [resolvedData, formattedPrintDate, logoUrl]);

  const fullPrintHtml = useMemo(() => {
    if (!student) return "";
    return generateStudentProfilePrintHtml({
      student,
      programData,
      classesData,
      sectionsData,
      academicSessions,
      feeChallans: effectiveChallans,
    });
  }, [student, programData, classesData, sectionsData, academicSessions, effectiveChallans]);

  const handlePrint = async () => {
    if (!fullPrintHtml) return;
    setIsPrinting(true);
    try {
      const studentName = `${student?.fName || "Student"}_${student?.lName || ""}`.trim();
      const docTitle = `Student_Profile_${studentName}_${student?.rollNumber || ""}`.trim();
      const opened = await openManagedPrintWindow({
        html: fullPrintHtml,
        title: docTitle,
        toast,
      });
      if (opened) {
        toast({
          title: "Print window opened",
          description: "To save as PDF, select 'Save as PDF' in the printer destination dropdown.",
        });
      }
    } catch (err) {
      console.error("Failed to print student profile:", err);
      toast({
        title: "Print failed",
        description: "Could not open print window. Please allow popups.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!overflow-hidden flex flex-col h-dvh max-h-dvh sm:max-w-4xl p-0 gap-0 border shadow-2xl">
        {/* Sticky Dialog Header */}
        <DialogHeader className="bg-white border-b px-6 py-4 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isNewlyCreated ? "Student Created Successfully" : "Student Profile Form"}
              </DialogTitle>
              {student?.rollNumber && (
                <Badge variant="outline" className="font-mono text-xs font-semibold bg-slate-50">
                  {student.rollNumber}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              {isNewlyCreated
                ? "Admission record saved. You can now preview, print, or save the official profile form as PDF."
                : "Official admission and profile form with documents checklist and fee installment schedule."}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting || !fullPrintHtml}
              className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Preparing View...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 text-orange-400" /> Print / Save as PDF
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-slate-700 hover:bg-slate-100"
            >
              Close
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Preview Canvas with thin & visible scrollbar - native DOM, no iframe scroll trap */}
        <div className="min-h-0 flex-1 overflow-y-auto max-h-[calc(100dvh-85px)] h-[calc(100dvh-85px)] p-4 sm:p-6 bg-slate-100 [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.5)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-400/60 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
          <style>{getStudentProfileFormStyles()}</style>
          {bodyHtml ? (
            <div
              className="student-profile-preview shadow-md border border-slate-300 mx-auto bg-white select-text"
              style={{ maxWidth: "820px" }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <p className="text-sm">Preparing student profile form preview...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentProfilePrintDialog;
