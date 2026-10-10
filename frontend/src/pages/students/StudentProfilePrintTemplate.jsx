import React, { useState, useMemo, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Printer,
  Loader2,
  FileSpreadsheet,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  Search,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  User,
  GraduationCap,
  Users,
  Award,
  CheckCircle2,
  DollarSign,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { resolveFileUrl } from "@/lib/utils";
import { getStudentFeeHistory, getStudentById } from "../../../config/apis";
import { StudentProfilePrintSkeleton } from "@/skeletons/StudentProfilePrintSkeleton";
import {
  REPORT_SECTIONS,
  getDefaultReportFieldSelection,
  exportStudentReportToExcel,
} from "./studentReportFieldsConfig";

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
    flex-wrap: wrap;
    gap: 6px;
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
 * Helper to render key-value items into a balanced 2-column or 4-column grid table.
 */
const renderFieldGridTable = (items) => {
  if (!items || items.length === 0) return "";
  let rowsHtml = "";
  let i = 0;
  while (i < items.length) {
    const cur = items[i];
    if (cur.isWide) {
      rowsHtml += `<tr><td class="lbl">${cur.label}</td><td class="val" colspan="3">${cur.value}</td></tr>`;
      i++;
    } else if (i + 1 < items.length && !items[i + 1].isWide) {
      const next = items[i + 1];
      rowsHtml += `<tr><td class="lbl">${cur.label}</td><td class="val">${cur.value}</td><td class="lbl">${next.label}</td><td class="val">${next.value}</td></tr>`;
      i += 2;
    } else {
      rowsHtml += `<tr><td class="lbl">${cur.label}</td><td class="val" colspan="3">${cur.value}</td></tr>`;
      i++;
    }
  }
  return `<table class="form-grid">${rowsHtml}</table>`;
};

/**
 * Generates the inner body HTML representing the student profile form,
 * respecting the user's granular field selection configuration.
 */
export const generateStudentProfileFormBodyHtml = ({
  data,
  formattedPrintDate,
  logoUrl,
  fieldSelection = null,
}) => {
  const isDefault = !fieldSelection;
  const sections = fieldSelection?.sections || {};
  const fields = fieldSelection?.fields || {};

  // Photo
  const showPhoto = isDefault || (sections.personalInfo !== false && fields.personalInfo?.photo !== false);
  const defaultUserSvg = `
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
    <div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.5px;">Student Photo</div>
  `;

  const photoBoxHtml = showPhoto
    ? `
      <div class="photo-box">
        ${
          data.photoUrl
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
        `
        }
      </div>
    `
    : "";

  // Metadata Strip
  const showRollMeta = isDefault || (sections.academicInfo !== false && fields.academicInfo?.rollNumber !== false);
  const showFormMeta = isDefault || (sections.academicInfo !== false && fields.academicInfo?.admissionFormNumber !== false);
  const showStatusMeta = isDefault || (sections.academicInfo !== false && fields.academicInfo?.status !== false);

  const metaParts = [];
  if (showRollMeta) metaParts.push(`<span>Roll No: <strong>${data.rollNumber}</strong></span>`);
  if (showFormMeta) metaParts.push(`<span>Form Ref: <strong>${data.admissionFormNumber}</strong></span>`);
  if (showStatusMeta) metaParts.push(`<span>Status: <strong>${data.status}</strong></span>`);
  metaParts.push(`<span>Issue Date: <strong>${formattedPrintDate}</strong></span>`);

  const metaStripHtml = metaParts.length > 0 ? `<div class="meta-strip">${metaParts.join("")}</div>` : "";

  // 1. Academic & Enrollment Details Section
  let academicSectionHtml = "";
  if (isDefault || sections.academicInfo !== false) {
    const f = fields.academicInfo || {};
    const items = [];
    if (isDefault || f.rollNumber !== false) items.push({ label: "Student Roll No", value: data.rollNumber });
    if (isDefault || f.sessionName !== false) items.push({ label: "Academic Session", value: data.sessionName });
    if (isDefault || f.programName !== false) items.push({ label: "Program", value: data.programName });

    const showClass = isDefault || f.className !== false;
    const showSec = isDefault || f.sectionName !== false;
    if (showClass || showSec) {
      const val = `${showClass ? data.className : ""} ${showSec && data.sectionName && data.sectionName !== "—" ? `(${data.sectionName})` : ""}`.trim();
      items.push({
        label: showClass && showSec ? "Class & Section" : showClass ? "Class" : "Section",
        value: val || "—",
      });
    }

    if (isDefault || f.admissionDate !== false) items.push({ label: "Admission Date", value: data.admissionDate });
    if (isDefault || f.status !== false) items.push({ label: "Enrollment Status", value: data.status });

    if (items.length > 0) {
      academicSectionHtml = `
        <div class="section-bar">1. Academic &amp; Enrollment Details</div>
        ${renderFieldGridTable(items)}
      `;
    }
  }

  // 2. Personal & Contact Information Section
  let personalSectionHtml = "";
  if (isDefault || sections.personalInfo !== false) {
    const f = fields.personalInfo || {};
    const items = [];
    if (isDefault || f.fullName !== false) items.push({ label: "Student Full Name", value: data.fullName });
    if (isDefault || f.fatherOrguardian !== false) items.push({ label: "Father / Guardian", value: data.fatherOrguardian });
    if (isDefault || f.studentCnic !== false) items.push({ label: "CNIC / Form B", value: data.studentCnic });
    if (isDefault || f.dob !== false) items.push({ label: "Date of Birth", value: data.dob });
    if (isDefault || f.gender !== false) items.push({ label: "Gender", value: data.gender });
    if (isDefault || f.religion !== false) items.push({ label: "Religion", value: data.religion });
    if (isDefault || f.phone !== false) items.push({ label: "Contact Phone", value: data.phone });
    if (isDefault || f.email !== false) items.push({ label: "Email Address", value: data.email });
    if (isDefault || f.address !== false) items.push({ label: "Residential Address", value: data.address, isWide: true });

    if (items.length > 0) {
      personalSectionHtml = `
        <div class="section-bar">2. Personal &amp; Contact Information</div>
        ${renderFieldGridTable(items)}
      `;
    }
  }

  // 3. Parent / Guardian Information Section
  let guardianSectionHtml = "";
  if (isDefault || sections.guardianInfo !== false) {
    const f = fields.guardianInfo || {};
    const items = [];
    if (isDefault || f.fatherOrguardian !== false) items.push({ label: "Guardian Name", value: data.fatherOrguardian });
    if (isDefault || f.parentCNIC !== false) items.push({ label: "Guardian CNIC", value: data.parentCNIC });
    if (isDefault || f.emergencyPhone !== false) items.push({ label: "Emergency Phone", value: data.phone });
    if (isDefault || f.guardianEmail !== false) items.push({ label: "Guardian Email", value: data.email });

    if (items.length > 0) {
      guardianSectionHtml = `
        <div class="section-bar">3. Parent / Guardian Information</div>
        ${renderFieldGridTable(items)}
      `;
    }
  }

  // 4. Previous Education Record Section
  let previousEducationHtml = "";
  if (isDefault || sections.previousEducation !== false) {
    const f = fields.previousEducation || {};
    const items = [];
    if (isDefault || f.previousBoardName !== false) {
      if (data.previousBoardName && data.previousBoardName !== "—") {
        items.push({ label: "Previous Board / Inst.", value: data.previousBoardName });
      }
    }
    if (isDefault || f.previousBoardRollNumber !== false) {
      if (data.previousBoardRollNumber && data.previousBoardRollNumber !== "—") {
        items.push({ label: "Previous Board Roll", value: data.previousBoardRollNumber });
      }
    }
    if (isDefault || f.marks !== false) {
      if (data.obtainedMarks != null || data.totalMarks != null) {
        items.push({
          label: "Obtained / Total Marks",
          value: `${data.obtainedMarks ?? "—"} ${data.totalMarks ? `/ ${data.totalMarks}` : ""}`,
        });
      }
    }

    if (items.length > 0) {
      previousEducationHtml = `
        <div class="section-bar">Previous Academic Record</div>
        ${renderFieldGridTable(items)}
      `;
    }
  }

  // 5. Required Documents Checklist Section
  let documentsSectionHtml = "";
  if (isDefault || sections.documentsChecklist !== false) {
    const docFields = fields.documentsChecklist || {};
    const filteredDocs = (data.docsList || []).filter(
      (d) => isDefault || docFields[d.key] !== false
    );

    if (filteredDocs.length > 0) {
      const rowsHtml = filteredDocs
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

      documentsSectionHtml = `
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
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }
  }

  // 6. Fee Installment Plan & Financial Schedule Section
  let feeScheduleSectionHtml = "";
  if (isDefault || sections.feeSchedule !== false) {
    const f = fields.feeSchedule || {};
    const showTable = isDefault || f.installmentTable !== false;
    const showSummary = isDefault || f.feeSummary !== false;

    if (showTable || showSummary) {
      let feeRows = "";
      if (showTable) {
        feeRows =
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
      }

      let feeTfoot = "";
      if (showSummary) {
        feeTfoot = `
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
        `;
      }

      feeScheduleSectionHtml = `
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
            ${feeRows}
          </tbody>
          ${feeTfoot}
        </table>
      `;
    }
  }

  // 7. Undertaking & Official Signatures Section
  let undertakingSectionHtml = "";
  if (isDefault || sections.undertakingSignatures !== false) {
    const f = fields.undertakingSignatures || {};
    const showText = isDefault || f.undertakingText !== false;
    const showSigs = isDefault || f.signatureBoxes !== false;

    let decBox = "";
    if (showText) {
      decBox = `
        <div class="declaration-box">
          <strong>Undertaking &amp; Declaration:</strong> I hereby solemnly declare that all particulars stated in this admission and student profile record are authentic, complete, and correct to the best of my knowledge. I promise to abide by all the rules, regulations, discipline policies, and fee deadlines of Concordia College Peshawar.
        </div>
      `;
    }

    let sigGrid = "";
    if (showSigs) {
      sigGrid = `
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
      `;
    }

    if (showText || showSigs) {
      undertakingSectionHtml = `
        ${decBox}
        ${sigGrid}
      `;
    }
  }

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
        ${photoBoxHtml}
      </div>

      <!-- CENTERED CALLIGRAPHY TITLE -->
      <div class="center-calligraphy-title">
        Student Profile &amp; Admission Record
      </div>

      <!-- METADATA STRIP -->
      ${metaStripHtml}

      <!-- SECTIONS -->
      ${academicSectionHtml}
      ${personalSectionHtml}
      ${guardianSectionHtml}
      ${previousEducationHtml}
      ${documentsSectionHtml}
      ${feeScheduleSectionHtml}
      ${undertakingSectionHtml}

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
  fieldSelection = null,
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

  const bodyHtml = generateStudentProfileFormBodyHtml({
    data,
    formattedPrintDate,
    logoUrl,
    fieldSelection,
  });
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
 * Enhanced on-screen dialog component for individual student report export.
 * Features granular section & field selection with real-time preview, actual data indicators,
 * Excel (.xlsx) export, and high-fidelity managed printing / PDF generation.
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
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileTab, setMobileTab] = useState("fields"); // "fields" | "preview"

  const studentId = extractId(student?.id || student?._id);

  // Fetch full student details with documents, academic records, and personal info
  const { data: studentDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["studentProfilePrintDetails", studentId],
    queryFn: () => getStudentById(studentId),
    enabled: open && !!studentId,
    staleTime: 60000,
  });

  const activeStudent = studentDetails || student;

  // If challans not passed directly, fetch them when dialog opens
  const { data: fetchedFeeChallans = [], isLoading: challansLoading } = useQuery({
    queryKey: ["studentProfilePrintChallans", studentId],
    queryFn: () => getStudentFeeHistory(studentId, "INSTALLMENT"),
    enabled: open && !!studentId && !propFeeChallans,
    staleTime: 60000,
  });

  const effectiveChallans = propFeeChallans || fetchedFeeChallans || [];
  const isLoading =
    open &&
    ((detailsLoading && !studentDetails) ||
      (!propFeeChallans && challansLoading && fetchedFeeChallans.length === 0));

  const resolvedData = useMemo(() => {
    if (!activeStudent) return null;
    return resolveStudentProfileData({
      student: activeStudent,
      programData,
      classesData,
      sectionsData,
      academicSessions,
      feeChallans: effectiveChallans,
    });
  }, [activeStudent, programData, classesData, sectionsData, academicSessions, effectiveChallans]);

  // Field selection state & expansion state
  const [fieldSelection, setFieldSelection] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    if (open && resolvedData) {
      setFieldSelection((prev) => {
        if (prev) return prev;
        return getDefaultReportFieldSelection(resolvedData.docsList || []);
      });
      setExpandedSections((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const exp = {};
        REPORT_SECTIONS.forEach((s) => {
          exp[s.key] = true;
        });
        return exp;
      });
    }
    if (!open) {
      setFieldSelection(null);
      setExpandedSections({});
      setSearchQuery("");
      setMobileTab("fields");
    }
  }, [open, resolvedData]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${origin}/logo.png`;
  const formattedPrintDate = useMemo(() => format(new Date(), "dd/MM/yyyy HH:mm"), []);

  // Real-time live body HTML
  const bodyHtml = useMemo(() => {
    if (!resolvedData) return "";
    return generateStudentProfileFormBodyHtml({
      data: resolvedData,
      formattedPrintDate,
      logoUrl,
      fieldSelection,
    });
  }, [resolvedData, formattedPrintDate, logoUrl, fieldSelection]);


  // Toggling Section Checkbox (auto expands when checked as requested)
  const handleToggleSection = (sectionKey, checked) => {
    setFieldSelection((prev) => {
      const current = prev || getDefaultReportFieldSelection(resolvedData?.docsList || []);
      return {
        ...current,
        sections: {
          ...current.sections,
          [sectionKey]: checked,
        },
      };
    });

    // Auto expand/reveal section fields when checked; collapse when unchecked
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: checked,
    }));
  };

  // Toggling Section Expansion manually
  const toggleSectionExpand = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Toggling individual field
  const handleToggleField = (sectionKey, fieldKey, checked) => {
    setFieldSelection((prev) => {
      const current = prev || getDefaultReportFieldSelection(resolvedData?.docsList || []);
      const secFields = { ...(current.fields[sectionKey] || {}) };
      secFields[fieldKey] = checked;

      const newSections = { ...current.sections };
      if (checked && !newSections[sectionKey]) {
        newSections[sectionKey] = true;
      }

      return {
        ...current,
        sections: newSections,
        fields: {
          ...current.fields,
          [sectionKey]: secFields,
        },
      };
    });
  };

  // Select all fields in section
  const handleSelectAllFieldsInSection = (sectionKey) => {
    setFieldSelection((prev) => {
      const current = prev || getDefaultReportFieldSelection(resolvedData?.docsList || []);
      const sec = REPORT_SECTIONS.find((s) => s.key === sectionKey);
      const secFields = { ...(current.fields[sectionKey] || {}) };

      if (sec?.isDocumentsSection) {
        (resolvedData?.docsList || []).forEach((d) => {
          secFields[d.key] = true;
        });
      } else if (sec?.fields) {
        sec.fields.forEach((f) => {
          secFields[f.key] = true;
        });
      }

      return {
        ...current,
        sections: { ...current.sections, [sectionKey]: true },
        fields: { ...current.fields, [sectionKey]: secFields },
      };
    });
    setExpandedSections((prev) => ({ ...prev, [sectionKey]: true }));
  };

  // Deselect all fields in section
  const handleDeselectAllFieldsInSection = (sectionKey) => {
    setFieldSelection((prev) => {
      const current = prev || getDefaultReportFieldSelection(resolvedData?.docsList || []);
      const sec = REPORT_SECTIONS.find((s) => s.key === sectionKey);
      const secFields = { ...(current.fields[sectionKey] || {}) };

      if (sec?.isDocumentsSection) {
        (resolvedData?.docsList || []).forEach((d) => {
          secFields[d.key] = false;
        });
      } else if (sec?.fields) {
        sec.fields.forEach((f) => {
          secFields[f.key] = false;
        });
      }

      return {
        ...current,
        fields: { ...current.fields, [sectionKey]: secFields },
      };
    });
  };

  // Global selection actions
  const handleSelectAllSections = () => {
    const full = getDefaultReportFieldSelection(resolvedData?.docsList || []);
    setFieldSelection(full);
    const exp = {};
    REPORT_SECTIONS.forEach((s) => {
      exp[s.key] = true;
    });
    setExpandedSections(exp);
  };

  const handleDeselectAllSections = () => {
    const full = getDefaultReportFieldSelection(resolvedData?.docsList || []);
    const emptySections = {};
    REPORT_SECTIONS.forEach((s) => {
      emptySections[s.key] = false;
    });
    setFieldSelection({
      ...full,
      sections: emptySections,
    });
    setExpandedSections({});
  };

  // Print Handler
  const handlePrint = async () => {
    if (!activeStudent || !resolvedData) return;
    setIsPrinting(true);
    try {
      const html = generateStudentProfilePrintHtml({
        student: activeStudent,
        programData,
        classesData,
        sectionsData,
        academicSessions,
        feeChallans: effectiveChallans,
        fieldSelection,
      });
      const studentName = `${activeStudent?.fName || "Student"}_${activeStudent?.lName || ""}`.trim();
      const docTitle = `Student_Profile_${studentName}_${activeStudent?.rollNumber || ""}`.trim();
      const opened = await openManagedPrintWindow({
        html,
        title: docTitle,
        toast,
      });
      if (opened) {
        toast({
          title: "Print window opened",
          description: "To save as PDF, select 'Save as PDF' in the destination dropdown.",
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

  // Excel Export Handler
  const handleExportExcel = async () => {
    if (!resolvedData) return;
    setIsExportingExcel(true);
    try {
      exportStudentReportToExcel({
        data: resolvedData,
        fieldSelection,
        formattedPrintDate,
      });
      toast({
        title: "Excel export completed",
        description: "Student profile report downloaded as .xlsx spreadsheet.",
      });
    } catch (err) {
      console.error("Failed to export to Excel:", err);
      toast({
        title: "Export failed",
        description: "Could not export student report to Excel.",
        variant: "destructive",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return REPORT_SECTIONS;
    const q = searchQuery.toLowerCase();
    return REPORT_SECTIONS.filter((sec) => {
      if (sec.title.toLowerCase().includes(q) || sec.shortTitle.toLowerCase().includes(q)) return true;
      if (sec.fields && sec.fields.some((f) => f.label.toLowerCase().includes(q))) return true;
      if (sec.isDocumentsSection && (resolvedData?.docsList || []).some((d) => d.label.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [searchQuery, resolvedData]);

  // Summary counts
  const activeSectionCount = useMemo(() => {
    if (!fieldSelection?.sections) return REPORT_SECTIONS.length;
    return REPORT_SECTIONS.filter((s) => fieldSelection.sections[s.key] !== false).length;
  }, [fieldSelection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!overflow-hidden flex flex-col p-0 gap-0 border shadow-2xl rounded-xl"
        bodyClassName="!p-0 !gap-0 flex-1 min-h-0 !overflow-hidden flex flex-col h-full"
        style={{
          height: "92vh",
          maxHeight: "92vh",
          minHeight: "92vh",
          width: "96vw",
          maxWidth: "1400px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <style>{`
          ${getStudentProfileFormStyles()}

          .report-scroll-container {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            scrollbar-width: thin !important;
            scrollbar-color: #94a3b8 transparent !important;
            -webkit-overflow-scrolling: touch !important;
            overscroll-behavior: contain !important;
          }

          .report-scroll-container::-webkit-scrollbar {
            width: 6px !important;
            height: 6px !important;
          }

          .report-scroll-container::-webkit-scrollbar-track {
            background: transparent !important;
          }

          .report-scroll-container::-webkit-scrollbar-thumb {
            background: #cbd5e1 !important;
            border-radius: 9999px !important;
          }

          .report-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #94a3b8 !important;
          }

          .report-scroll-container:focus {
            outline: none !important;
          }
        `}</style>
        {/* Sticky Dialog Header */}
        <DialogHeader className="bg-white border-b px-4 sm:px-6 py-3.5 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-orange-600 shrink-0 hidden sm:flex">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {isNewlyCreated ? "Admission Saved • Profile Report Export" : "Individual Student Report Export"}
                </DialogTitle>
                {activeStudent?.rollNumber && (
                  <Badge variant="outline" className="font-mono text-xs font-semibold bg-slate-50 border-slate-300">
                    {activeStudent.rollNumber}
                  </Badge>
                )}
                <Badge
                  className="text-[10px] uppercase font-semibold"
                  variant={activeStudent?.status === "ACTIVE" ? "default" : "secondary"}
                >
                  {activeStudent?.status || "ACTIVE"}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5 truncate hidden sm:block">
                Select sections and granular fields with live student data preview to include in the exported report or official printout.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6 shrink-0">
            {/* Toggle sidebar button (desktop only) */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSidebar((s) => !s)}
              className="hidden lg:flex items-center gap-1.5 text-xs text-slate-700 hover:bg-slate-100"
              title={showSidebar ? "Hide Field Selection Sidebar" : "Show Field Selection Sidebar"}
            >
              {showSidebar ? (
                <>
                  <PanelLeftClose className="w-4 h-4 text-slate-500" />
                  <span>Hide Sidebar</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-slate-500" />
                  <span>Customize Fields</span>
                </>
              )}
            </Button>

            {/* Export Excel Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              disabled={isExportingExcel || isLoading || !resolvedData}
              className="gap-1.5 text-xs font-medium border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {isExportingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span className="hidden sm:inline">Export Excel</span>
            </Button>

            {/* Print / Save as PDF Button */}
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting || isLoading || !resolvedData || !bodyHtml}
              className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs text-xs"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing...
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5 text-orange-400" /> Print / PDF
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-slate-700 hover:bg-slate-100 text-xs"
            >
              Close
            </Button>
          </div>
        </DialogHeader>

        {/* Mobile View Toggle Bar */}
        <div className="lg:hidden flex items-center justify-between border-b px-4 py-2 bg-slate-50 shrink-0">
          <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setMobileTab("fields")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                mobileTab === "fields"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Field Selection ({activeSectionCount})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("preview")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                mobileTab === "preview"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Live Document Preview
            </button>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {activeSectionCount} / {REPORT_SECTIONS.length} Sections
          </span>
        </div>

        {/* Main Body (Split Panel on desktop, tabbed on mobile) */}
        {isLoading || !resolvedData || !fieldSelection ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 gap-3">
            <div className="p-3 bg-orange-100 border border-orange-200 rounded-full animate-bounce">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            </div>
            <div className="text-base font-bold text-slate-800">
              Processing Student Record &amp; Building Report...
            </div>
            <div className="text-xs text-slate-500 max-w-sm text-center">
              Resolving fee installments, academic details, and documents verification. Please wait a moment.
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row overflow-hidden bg-slate-100">
            {/* ───────────────────────────────────────────────────────────── */}
            {/* LEFT SIDEBAR: FIELD & SECTION SELECTION DRAWER */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div
              className={`w-full lg:w-[420px] shrink-0 border-r border-slate-200 bg-white flex flex-col h-full min-h-0 overflow-hidden transition-all duration-200 ${
                !showSidebar ? "lg:hidden" : ""
              } ${mobileTab === "preview" ? "hidden lg:flex" : "flex"}`}
            >
              {/* Sidebar Header & Global Controls */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 shrink-0 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Report Sections &amp; Fields
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-semibold bg-slate-200/80 text-slate-700">
                    {activeSectionCount} of {REPORT_SECTIONS.length} Active
                  </Badge>
                </div>

                {/* Quick Actions toolbar */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSelectAllSections}
                      className="h-6 text-[11px] px-2 text-slate-700 hover:bg-slate-200"
                    >
                      <CheckSquare className="w-3 h-3 mr-1 text-slate-600" /> Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDeselectAllSections}
                      className="h-6 text-[11px] px-2 text-slate-700 hover:bg-slate-200"
                    >
                      <Square className="w-3 h-3 mr-1 text-slate-600" /> Deselect All
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSelectAllSections}
                    className="h-6 text-[11px] px-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    title="Reset to default selection"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                </div>

                {/* Field filter input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Filter fields (e.g. CNIC, Roll, DOB)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs bg-white border-slate-200"
                  />
                </div>
              </div>

              {/* Scrollable list of Section Cards with thin scrollbar */}
              <div
                className="report-scroll-container flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5"
                tabIndex={0}
              >
                {filteredSections.map((sec, secIdx) => {
                  const isSectionChecked = fieldSelection?.sections?.[sec.key] !== false;
                  const isExpanded = !!expandedSections[sec.key];
                  const secFieldsState = fieldSelection?.fields?.[sec.key] || {};

                  // Count selected fields inside this section
                  let totalFieldsCount = 0;
                  let selectedFieldsCount = 0;

                  if (sec.isDocumentsSection) {
                    const docs = resolvedData?.docsList || [];
                    totalFieldsCount = docs.length;
                    selectedFieldsCount = docs.filter((d) => secFieldsState[d.key] !== false).length;
                  } else if (sec.fields) {
                    totalFieldsCount = sec.fields.length;
                    selectedFieldsCount = sec.fields.filter((f) => secFieldsState[f.key] !== false).length;
                  }

                  return (
                    <div
                      key={sec.key}
                      className={`rounded-lg border transition-all ${
                        isSectionChecked
                          ? "border-slate-300 bg-white shadow-xs"
                          : "border-slate-200/80 bg-slate-50/60 opacity-80"
                      }`}
                    >
                      {/* Section Header with Master Checkbox */}
                      <div
                        className={`flex items-center justify-between p-2.5 rounded-t-lg transition-colors ${
                          isSectionChecked ? "bg-slate-100/60" : "bg-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            id={`sec-${sec.key}`}
                            checked={isSectionChecked}
                            onCheckedChange={(val) => handleToggleSection(sec.key, Boolean(val))}
                            className="data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 shrink-0"
                          />
                          <label
                            htmlFor={`sec-${sec.key}`}
                            className="text-xs font-bold text-slate-800 cursor-pointer select-none truncate"
                          >
                            {sec.title}
                          </label>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isSectionChecked && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] font-mono font-medium px-1.5 py-0 bg-slate-200 text-slate-700"
                            >
                              {selectedFieldsCount}/{totalFieldsCount}
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleSectionExpand(sec.key)}
                            className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800"
                            title={isExpanded ? "Collapse section fields" : "Expand section fields"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Section Body: Revealed upon checking section checkbox (as requested) */}
                      {isExpanded && (
                        <div className="p-2.5 pt-1.5 border-t border-slate-100 bg-slate-50/40 space-y-2">
                          {/* Section Sub-actions */}
                          <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 pb-1 border-b border-slate-100">
                            <span className="text-[10px] font-medium text-slate-400">
                              Include in Report &amp; Preview:
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectAllFieldsInSection(sec.key)}
                                className="text-blue-600 hover:underline hover:text-blue-800 font-medium"
                              >
                                All
                              </button>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => handleDeselectAllFieldsInSection(sec.key)}
                                className="text-slate-600 hover:underline hover:text-slate-800 font-medium"
                              >
                                None
                              </button>
                            </div>
                          </div>

                          {/* List of Fields with Preview/Actual Data */}
                          <div className="space-y-1.5">
                            {sec.isDocumentsSection ? (
                              (resolvedData?.docsList || []).map((doc) => {
                                const isChecked = isSectionChecked && secFieldsState[doc.key] !== false;
                                return (
                                  <div
                                    key={doc.key}
                                    className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-slate-100/70 text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Checkbox
                                        id={`doc-${doc.key}`}
                                        checked={isChecked}
                                        onCheckedChange={(val) =>
                                          handleToggleField(sec.key, doc.key, Boolean(val))
                                        }
                                        className="data-[state=checked]:bg-slate-900 shrink-0"
                                      />
                                      <label
                                        htmlFor={`doc-${doc.key}`}
                                        className="text-xs text-slate-800 font-medium cursor-pointer select-none truncate"
                                        title={doc.label}
                                      >
                                        {doc.label}
                                      </label>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] shrink-0 font-semibold px-1.5 py-0 ${
                                        doc.isSubmitted
                                          ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                                          : "border-slate-300 text-slate-500 bg-white"
                                      }`}
                                    >
                                      {doc.isSubmitted ? "[✓] Submitted" : "[ ] Pending"}
                                    </Badge>
                                  </div>
                                );
                              })
                            ) : (
                              sec.fields?.map((f) => {
                                const isChecked = isSectionChecked && secFieldsState[f.key] !== false;
                                const previewVal = resolvedData ? f.getValue(resolvedData) : "—";
                                const hasVal = previewVal && previewVal !== "—";

                                return (
                                  <div
                                    key={f.key}
                                    className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-slate-100/70 text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Checkbox
                                        id={`fld-${sec.key}-${f.key}`}
                                        checked={isChecked}
                                        onCheckedChange={(val) =>
                                          handleToggleField(sec.key, f.key, Boolean(val))
                                        }
                                        className="data-[state=checked]:bg-slate-900 shrink-0"
                                      />
                                      <label
                                        htmlFor={`fld-${sec.key}-${f.key}`}
                                        className="text-xs text-slate-800 font-medium cursor-pointer select-none truncate"
                                        title={f.label}
                                      >
                                        {f.label}
                                      </label>
                                    </div>

                                    {/* Actual / Preview Value pill */}
                                    <div className="shrink-0 max-w-[170px] truncate text-right">
                                      {hasVal ? (
                                        <span
                                          className="inline-block text-[10.5px] font-mono font-medium text-slate-800 bg-white border border-slate-200/90 rounded px-1.5 py-0.5 truncate max-w-[170px]"
                                          title={String(previewVal)}
                                        >
                                          {String(previewVal)}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">
                                          Not provided
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* RIGHT MAIN PANEL: LIVE PAPER-STYLE DOCUMENT PREVIEW */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div
              className={`flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-200/60 ${
                mobileTab === "fields" ? "hidden lg:flex" : "flex"
              }`}
            >
              {/* Preview Toolbar */}
              <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-slate-800">
                    Live Report Preview (A4 Canvas)
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-[11px] text-slate-500">
                    Reflects selected sections &amp; fields in real-time
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono font-normal bg-slate-50">
                    A4 Portrait • {activeSectionCount} Section(s) Active
                  </Badge>
                </div>
              </div>

              {/* Scrollable Preview Canvas with thin scrollbar */}
              <div
                className="report-scroll-container flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex justify-center items-start"
                tabIndex={0}
              >
                <div
                  className="student-profile-preview shadow-xl border border-slate-300 w-full bg-white select-text mb-8 shrink-0"
                  style={{ maxWidth: "820px" }}
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudentProfilePrintDialog;
