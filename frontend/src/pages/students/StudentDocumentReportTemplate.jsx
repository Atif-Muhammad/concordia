import React, { useState, useMemo, useEffect, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Printer, Download, Loader2, Search, FileText, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getStudents } from "../../../config/apis";
import { extractId } from "./StudentProfilePrintTemplate";

const STUDENT_DOCUMENT_FIELDS = [
  '_id', 'fName', 'lName', 'fatherOrguardian', 'fatherName', 'rollNumber',
  'programId', 'classId', 'sectionId', 'sessionId',
  'documents', 'status', 'passedOut'
].join(' ');

/**
 * Canonical documents exactly matching StudentForm.jsx (create/edit forms):
 * 1. Form B / Domicile
 * 2. 4 Passport Size Pictures
 * 3. DMC Matric
 * 4. DMC Intermediate
 * 5. Father CNIC
 * 6. Migration (if from other board)
 * 7. Affidavit
 * 8. Admission Form
 */
export const STUDENT_FORM_DOCUMENTS = [
  {
    key: "formB",
    label: "Form B / Domicile",
    aliases: ["formB", "bForm", "b_form", "B Form", "Form B", "Form B / Domicile", "form_b"],
  },
  {
    key: "pictures",
    label: "4 Passport Size Pictures",
    aliases: ["pictures", "photos", "photo", "4 Photos", "4 Passport Size Pictures", "4 Passport Size Photographs"],
  },
  {
    key: "dmcMatric",
    label: "DMC Matric",
    aliases: ["dmcMatric", "matricDmc", "matric", "DMC Matric", "Matric DMC"],
  },
  {
    key: "dmcIntermediate",
    label: "DMC Intermediate",
    aliases: ["dmcIntermediate", "interDmc", "intermediate", "DMC Intermediate", "Inter DMC"],
  },
  {
    key: "fatherCnic",
    label: "Father CNIC",
    aliases: ["fatherCnic", "father_cnic", "guardianCnic", "Father CNIC", "Father / Guardian CNIC Copy"],
  },
  {
    key: "migration",
    label: "Migration (if from other board)",
    aliases: ["migration", "migrationCertificate", "Migration", "Migration (if from other board)", "Migration / NOC Certificate"],
  },
  {
    key: "affidavit",
    label: "Affidavit",
    aliases: ["affidavit", "Affidavit", "characterCertificate", "Character Certificate / Affidavit"],
  },
  {
    key: "admissionForm",
    label: "Admission Form",
    aliases: ["admissionForm", "admission_form", "Admission Form", "College Admission Form"],
  },
];

/**
 * Normalizes document submission data for a single student matching the create/edit forms.
 */
export const resolveStudentDocumentData = (
  student = {},
  { programData = [], classesData = [], sectionsData = [], academicSessions = [] } = {}
) => {
  const studentId = extractId(student.id || student._id);
  const fullName = `${student.fName || ""} ${student.lName || ""}`.trim() || "Student Name";
  const fatherName = student.fatherOrguardian || student.fatherName || "—";
  const rollNumber = student.rollNumber || "—";

  // Academic hierarchy resolution
  const studentProgId = extractId(student.programId || student.program);
  const studentClassId = extractId(student.classId || student.class);
  const studentSecId = extractId(student.sectionId || student.section);
  const studentSessId = extractId(student.sessionId || student.session);

  let programName = typeof student.program === "object" ? student.program?.name : "";
  if (!programName && studentProgId) {
    const p = programData.find((item) => extractId(item) === studentProgId);
    programName = p?.name || "";
  }
  if (!programName && typeof student.program === "string" && student.program.length > 3) {
    programName = student.program;
  }
  if (!programName && student.programName) {
    programName = student.programName;
  }
  if (!programName) programName = "—";

  let className = typeof student.class === "object" ? student.class?.name : "";
  if (!className && studentClassId) {
    const c = classesData.find((item) => extractId(item) === studentClassId);
    className = c?.name || "";
  }
  if (!className && typeof student.class === "string" && student.class.length > 2) {
    className = student.class;
  }
  if (!className && student.className) {
    className = student.className;
  }
  if (!className) className = "—";

  let sectionName = typeof student.section === "object" ? student.section?.name : "";
  if (!sectionName && studentSecId) {
    const s = sectionsData.find((item) => extractId(item) === studentSecId);
    sectionName = s?.name || "";
  }
  if (!sectionName && typeof student.section === "string" && student.section.length > 0) {
    sectionName = student.section;
  }
  if (!sectionName && student.sectionName) {
    sectionName = student.sectionName;
  }

  let sessionName = typeof student.session === "object" ? student.session?.name : "";
  if (!sessionName && studentSessId) {
    const sess = academicSessions.find((item) => extractId(item) === studentSessId);
    sessionName = sess?.name || "";
  }
  if (!sessionName && typeof student.session === "string") {
    sessionName = student.session;
  }
  if (!sessionName && student.sessionName) {
    sessionName = student.sessionName;
  }
  if (!sessionName) sessionName = "—";

  // Documents resolution strictly matching student create/edit forms
  let rawDocs = student.documents || {};
  if (typeof rawDocs === "string") {
    try {
      rawDocs = JSON.parse(rawDocs);
    } catch {
      rawDocs = {};
    }
  }

  const docsList = STUDENT_FORM_DOCUMENTS.map((doc) => {
    let isSubmitted = false;
    for (const alias of doc.aliases) {
      if (rawDocs[alias] === true || rawDocs[alias] === "true" || rawDocs[alias] === 1) {
        isSubmitted = true;
        break;
      }
    }
    return {
      key: doc.key,
      label: doc.label,
      isSubmitted,
    };
  });

  const submittedCount = docsList.filter((d) => d.isSubmitted).length;
  const totalCount = docsList.length; // strictly 8
  const missingCount = totalCount - submittedCount;

  return {
    id: studentId,
    studentName: fullName,
    fatherName,
    rollNumber,
    programName,
    className,
    sectionName: sectionName || "—",
    sessionName,
    status: (student.status || "ACTIVE").toUpperCase(),
    docsList,
    submittedCount,
    totalCount,
    missingCount,
    isComplete: missingCount === 0,
  };
};

/**
 * Returns scoped CSS rules used both in printable HTML and on-screen preview.
 */
export const getStudentDocumentReportStyles = () => `
  .student-doc-report-preview {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 10.5px;
    line-height: 1.35;
  }

  .student-doc-report-preview * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .student-doc-report-preview .report-container {
    width: 100%;
    margin: 0 auto;
    background: #ffffff;
    border: 1.5px solid #0f172a;
    border-top: 4px solid #ea580c;
    padding: 12px 14px;
  }

  /* HEADER */
  .student-doc-report-preview .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 8px;
    gap: 12px;
  }

  .student-doc-report-preview .header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .student-doc-report-preview .header-brand img {
    height: 52px;
    max-width: 120px;
    object-fit: contain;
  }

  .student-doc-report-preview .header-brand h1 {
    font-size: 17px;
    font-weight: 600;
    margin: 0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #0f172a;
  }

  .student-doc-report-preview .header-brand .tagline {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: #475569;
    letter-spacing: 0.5px;
    margin-top: 1px;
  }

  .student-doc-report-preview .report-title-box {
    text-align: right;
  }

  .student-doc-report-preview .report-title-box h2 {
    font-size: 16px;
    font-weight: 800;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #0f172a;
  }

  .student-doc-report-preview .report-title-box .report-subtitle {
    font-size: 9px;
    color: #475569;
    font-weight: 600;
    margin-top: 2px;
    letter-spacing: 0.3px;
  }

  /* SESSION & TOTAL KPI STRIP (ONLY SESSION & TOTAL STUDENT COUNT) */
  .student-doc-report-preview .meta-kpi-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    padding: 5px 10px;
    font-size: 10px;
    margin-bottom: 8px;
  }

  .student-doc-report-preview .session-chip {
    font-size: 9.5px;
    color: #475569;
  }

  .student-doc-report-preview .session-chip strong {
    color: #0f172a;
    font-size: 10.5px;
  }

  .student-doc-report-preview .kpi-total {
    background: #0f172a;
    color: #ffffff;
    border: 1px solid #0f172a;
    padding: 2px 8px;
    border-radius: 2px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  /* TABLE */
  .student-doc-report-preview .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    table-layout: fixed;
  }

  .student-doc-report-preview .doc-table th {
    background: #f1f5f9;
    color: #0f172a;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
    text-align: left;
    vertical-align: middle;
  }

  .student-doc-report-preview .doc-table th.center {
    text-align: center;
  }

  .student-doc-report-preview .doc-table td {
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
    font-size: 10px;
    color: #0f172a;
    vertical-align: top;
  }

  .student-doc-report-preview .doc-table tr:nth-child(even) {
    background: #fafbfc;
  }

  /* RESPONSIVE COLUMN WIDTHS (DEFAULT / LANDSCAPE) */
  .student-doc-report-preview .col-num {
    width: 34px;
    text-align: center;
    font-weight: 700;
  }
  .student-doc-report-preview .col-student {
    width: 27%;
  }
  .student-doc-report-preview .col-academic {
    width: 23%;
  }
  .student-doc-report-preview .col-docs {
    width: 50%;
  }

  /* SINGLE CELL FOR STUDENT NAME, FATHER NAME, ROLL NUMBER */
  .student-doc-report-preview .student-cell {
    display: block;
  }

  .student-doc-report-preview .student-name {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.25;
    margin-bottom: 1.5px;
  }

  .student-doc-report-preview .student-father {
    display: block;
    font-size: 9.5px;
    color: #475569;
    font-weight: 500;
    margin-bottom: 2px;
  }

  .student-doc-report-preview .student-meta-label {
    font-size: 8.5px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .student-doc-report-preview .student-roll-row {
    display: block;
    margin-top: 1px;
  }

  .student-doc-report-preview .roll-pill {
    display: inline-block;
    font-family: monospace;
    font-size: 9px;
    font-weight: 700;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 0 4px;
    border-radius: 2px;
    color: #0f172a;
    vertical-align: middle;
  }

  /* ACADEMIC CELL */
  .student-doc-report-preview .academic-prog {
    font-size: 10.5px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.25;
  }

  .student-doc-report-preview .academic-class {
    font-size: 9.5px;
    font-weight: 600;
    color: #334155;
    margin-top: 1px;
  }

  .student-doc-report-preview .academic-sess {
    font-size: 8.5px;
    color: #64748b;
    font-weight: 500;
    margin-top: 1px;
  }

  /* DOCUMENT SUBMISSIONS CELL - Inline block flow for 100% canvas & print compatibility */
  .student-doc-report-preview .doc-tags-container {
    display: block;
    line-height: 1.8;
    margin-bottom: 2px;
  }

  .student-doc-report-preview .doc-tag {
    display: inline-block;
    font-size: 8px;
    line-height: 1.25;
    padding: 1px 4px;
    margin: 1.5px 2px;
    border-radius: 2px;
    white-space: nowrap;
    vertical-align: middle;
  }

  .student-doc-report-preview .doc-submitted {
    background: #f8fafc;
    border: 1px solid #0f172a;
    color: #0f172a;
    font-weight: 700;
  }

  .student-doc-report-preview .doc-pending {
    background: #ffffff;
    border: 1px dashed #94a3b8;
    color: #64748b;
    font-weight: 500;
  }

  .student-doc-report-preview .doc-tally-line {
    margin-top: 3px;
    font-size: 8.5px;
    font-weight: 600;
    color: #475569;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px dotted #e2e8f0;
    padding-top: 2px;
  }

  /* SIGNATURES */
  .student-doc-report-preview .sig-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 14px;
    page-break-inside: avoid;
  }

  .student-doc-report-preview .sig-box {
    text-align: center;
    border-top: 1.5px solid #0f172a;
    padding-top: 3px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    color: #0f172a;
  }

  .student-doc-report-preview .sig-title {
    font-size: 8px;
    color: #64748b;
    font-weight: 500;
    text-transform: capitalize;
    margin-top: 1px;
  }

  /* FOOTER */
  .student-doc-report-preview .report-footer {
    margin-top: 10px;
    border-top: 1px solid #cbd5e1;
    padding-top: 3px;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #64748b;
  }

  /* PORTRAIT ORIENTATION SPECIFIC RULES */
  .student-doc-report-preview.portrait-mode {
    font-size: 9.5px;
    line-height: 1.3;
  }

  .student-doc-report-preview.portrait-mode .report-container {
    padding: 8px 10px;
    border-top-width: 3px;
  }

  .student-doc-report-preview.portrait-mode .report-header {
    padding-bottom: 6px;
    margin-bottom: 6px;
  }

  .student-doc-report-preview.portrait-mode .header-brand img {
    height: 42px;
    max-width: 95px;
  }

  .student-doc-report-preview.portrait-mode .header-brand h1 {
    font-size: 14.5px;
  }

  .student-doc-report-preview.portrait-mode .header-brand .tagline {
    font-size: 8px;
  }

  .student-doc-report-preview.portrait-mode .report-title-box h2 {
    font-size: 13.5px;
  }

  .student-doc-report-preview.portrait-mode .report-title-box .report-subtitle {
    font-size: 8px;
  }

  .student-doc-report-preview.portrait-mode .meta-kpi-strip {
    padding: 3.5px 8px;
    font-size: 9px;
    margin-bottom: 6px;
  }

  .student-doc-report-preview.portrait-mode .col-num {
    width: 26px;
  }
  .student-doc-report-preview.portrait-mode .col-student {
    width: 27%;
  }
  .student-doc-report-preview.portrait-mode .col-academic {
    width: 23%;
  }
  .student-doc-report-preview.portrait-mode .col-docs {
    width: 50%;
  }

  .student-doc-report-preview.portrait-mode .doc-table th {
    padding: 4px 5px;
    font-size: 8.5px;
  }

  .student-doc-report-preview.portrait-mode .doc-table td {
    padding: 4px 5px;
    font-size: 9px;
  }

  .student-doc-report-preview.portrait-mode .student-name {
    font-size: 10px;
  }

  .student-doc-report-preview.portrait-mode .student-father {
    font-size: 8.5px;
  }

  .student-doc-report-preview.portrait-mode .academic-prog {
    font-size: 9.5px;
  }

  .student-doc-report-preview.portrait-mode .academic-class {
    font-size: 8.5px;
  }

  .student-doc-report-preview.portrait-mode .doc-tags-container {
    display: block;
    line-height: 1.55;
    margin-bottom: 1px;
  }

  .student-doc-report-preview.portrait-mode .doc-tag {
    display: inline-block;
    font-size: 7.5px;
    padding: 0.5px 3px;
    margin: 1px 1.5px;
    line-height: 1.25;
    vertical-align: middle;
  }

  .student-doc-report-preview.portrait-mode .doc-tally-line {
    font-size: 8px;
    margin-top: 2px;
    padding-top: 1.5px;
  }

  .student-doc-report-preview.portrait-mode .sig-grid {
    gap: 8px;
    margin-top: 10px;
  }

  .student-doc-report-preview.portrait-mode .sig-box {
    font-size: 7.5px;
    padding-top: 2px;
  }

  .student-doc-report-preview.portrait-mode .sig-title {
    font-size: 7px;
  }

  .student-doc-report-preview.portrait-mode .report-footer {
    margin-top: 6px;
    padding-top: 2px;
    font-size: 7.5px;
  }

  @media print {
    body {
      margin: 0;
      background: #ffffff !important;
    }
    .student-doc-report-preview .report-container {
      border: 1.5px solid #0f172a !important;
      max-width: 100% !important;
    }
    .student-doc-report-preview .doc-table tr {
      page-break-inside: avoid;
    }
    .student-doc-report-preview .sig-grid {
      page-break-inside: avoid;
    }

    /* Print media automatic portrait adaptation */
    @media (orientation: portrait) {
      .student-doc-report-preview .report-container {
        padding: 6px 8px !important;
      }
      .student-doc-report-preview .doc-table th,
      .student-doc-report-preview .doc-table td {
        padding: 3.5px 4px !important;
        font-size: 8.5px !important;
      }
      .student-doc-report-preview .doc-tag {
        font-size: 7.5px !important;
        padding: 0.5px 2.5px !important;
      }
      .student-doc-report-preview .header-brand img {
        height: 38px !important;
      }
      .student-doc-report-preview .header-brand h1 {
        font-size: 13.5px !important;
      }
      .student-doc-report-preview .report-title-box h2 {
        font-size: 13px !important;
      }
      .student-doc-report-preview .sig-box {
        font-size: 7.5px !important;
      }
      .student-doc-report-preview .sig-grid {
        gap: 6px !important;
        margin-top: 8px !important;
      }
    }
  }
`;

/**
 * Generates inner HTML body for Student Document Report.
 * Displays only students who have at least one pending document.
 */
export const generateStudentDocumentReportBodyHtml = ({
  resolvedStudents = [],
  filterSummary = {},
  formattedPrintDate,
  logoUrl,
  orientation = "portrait",
}) => {
  const totalStudents = resolvedStudents.length;
  const sessionDisplay =
    filterSummary.session && filterSummary.session !== "—"
      ? filterSummary.session
      : resolvedStudents.find((s) => s.sessionName && s.sessionName !== "—")?.sessionName || "All Sessions";

  // Partition students by program
  const groups = {};
  for (const s of resolvedStudents) {
    const key = s.programName || "General";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  const groupedList = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, students]) => ({ groupLabel: label, students }));

  let globalIdx = 0;
  const rowsHtml =
    resolvedStudents.length > 0
      ? groupedList
          .map((group) => {
            const groupHeader = `
              <tr class="program-group-header" style="background: #f1f5f9; break-inside: avoid;">
                <td colspan="4" style="padding: 7px 10px; font-weight: 700; font-size: 11px; color: #0f172a; border-bottom: 2px solid #cbd5e1; text-align: left;">
                  ${group.groupLabel}
                  <span style="font-weight: 400; font-size: 9px; color: #64748b; margin-left: 8px;">(${group.students.length} ${group.students.length === 1 ? "student" : "students"} with pending documents)</span>
                </td>
              </tr>
            `;

            const studentRows = group.students
              .map((student) => {
                globalIdx++;
                // Render document submission tags
                const tagsHtml = student.docsList
                  .map((doc) => {
                    if (doc.isSubmitted) {
                      return `<span class="doc-tag doc-submitted">[✓] ${doc.label}</span>`;
                    }
                    return `<span class="doc-tag doc-pending">[ ] ${doc.label}</span>`;
                  })
                  .join("");

                return `
                <tr>
                  <td class="center col-num">${globalIdx}</td>
                  <td class="col-student">
                    <div class="student-cell">
                      <div class="student-name">${student.studentName}</div>
                      <div class="student-father"><span class="student-meta-label">Father:</span> ${student.fatherName}</div>
                      <div class="student-roll-row">
                        <span class="student-meta-label">Roll:</span>
                        <span class="roll-pill">${student.rollNumber}</span>
                      </div>
                    </div>
                  </td>
                  <td class="col-academic">
                    <div class="academic-prog">${student.programName}</div>
                    <div class="academic-class">${student.className} ${student.sectionName !== "—" ? `(${student.sectionName})` : ""}</div>
                    <div class="academic-sess">Session: ${student.sessionName}</div>
                  </td>
                  <td class="col-docs">
                    <div class="doc-tags-container">
                      ${tagsHtml}
                    </div>
                    <div class="doc-tally-line">
                      <span>Submissions: <strong>${student.submittedCount} / ${student.totalCount}</strong></span>
                      <span style="color: #64748b; font-weight: 600;">${student.missingCount} Pending</span>
                    </div>
                  </td>
                </tr>
              `;
              })
              .join("");

            return groupHeader + studentRows;
          })
          .join("")
      : `
        <tr>
          <td colspan="4" style="text-align: center; padding: 24px; color: #64748b;">
            No students found with pending documents matching the specified criteria.
          </td>
        </tr>
      `;

  return `
    <div class="report-container ${orientation}-mode">
      <!-- HEADER -->
      <div class="report-header">
        <div class="header-brand">
          <img src="${logoUrl}" alt="Concordia College Peshawar Logo" />
          <div>
            <h1>Concordia College Peshawar</h1>
            <div class="tagline">A Project of Beaconhouse Group</div>
          </div>
        </div>
        <div class="report-title-box">
          <h2>Student Document Report</h2>
          <div class="report-subtitle">Official Verification &amp; Submission Audit</div>
        </div>
      </div>

      <!-- SESSION & TOTAL STUDENT COUNT STRIP (ONLY SESSION & TOTAL STUDENTS) -->
      <div class="meta-kpi-strip">
        <div class="session-chip">
          Session: <strong>${sessionDisplay}</strong>
        </div>
        <div class="kpi-counts">
          <span class="kpi-total">Total Students: ${totalStudents}</span>
        </div>
      </div>

      <!-- MAIN DATA TABLE (4 COLUMNS - NO STATUS COLUMN) -->
      <table class="doc-table">
        <thead>
          <tr>
            <th class="center col-num">#</th>
            <th class="col-student">Student &amp; Parent / Roll No</th>
            <th class="col-academic">Program / Class / Section</th>
            <th class="col-docs">Document Submissions (Who Submitted What)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- SIGNATURES -->
      <div class="sig-grid">
        <div class="sig-box">
          Admission Officer
          <div class="sig-title">Record Prepared By</div>
        </div>
        <div class="sig-box">
          Document Verification Officer
          <div class="sig-title">Physical Audit &amp; Checks</div>
        </div>
        <div class="sig-box">
          Accounts In-Charge
          <div class="sig-title">Clearance Verification</div>
        </div>
        <div class="sig-box">
          Principal / Director
          <div class="sig-title">Official Stamp &amp; Approval</div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="report-footer">
        <span>Concordia College Peshawar • Student Document Report • Confidential Institutional Document</span>
        <span>Generated: ${formattedPrintDate}</span>
      </div>
    </div>
  `;
};

/**
 * Generates standalone printable HTML document for Student Document Report.
 */
export const generateStudentDocumentReportPrintHtml = ({
  resolvedStudents = null,
  students = [],
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  filterSummary = {},
  printDate = new Date(),
  orientation = "portrait",
}) => {
  const finalResolvedStudents =
    resolvedStudents && resolvedStudents.length > 0
      ? resolvedStudents
      : students
          .map((s) =>
            resolveStudentDocumentData(s, {
              programData,
              classesData,
              sectionsData,
              academicSessions,
            })
          )
          .filter((s) => s.missingCount > 0);

  const formattedPrintDate = format(printDate, "dd/MM/yyyy HH:mm");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${origin}/logo.png`;

  const bodyHtml = generateStudentDocumentReportBodyHtml({
    resolvedStudents: finalResolvedStudents,
    filterSummary,
    formattedPrintDate,
    logoUrl,
    orientation,
  });

  const styles = getStudentDocumentReportStyles();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Student Document Report - Concordia College Peshawar</title>
      <style>
        @page {
          size: A4 ${orientation};
          margin: ${orientation === "portrait" ? "6mm 8mm" : "8mm 10mm"};
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
    <body class="student-doc-report-preview ${orientation}-mode">
      ${bodyHtml}
    </body>
    </html>
  `;
};

const EMPTY_ACTIVE_FILTERS = {};

/**
 * Dialog component for viewing and printing the Student Document Report.
 */
export const StudentDocumentReportDialog = ({
  open,
  onOpenChange,
  students = [],
  activeFilters = EMPTY_ACTIVE_FILTERS,
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  status = "ACTIVE",
}) => {
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);
  const [dialogSearch, setDialogSearch] = useState("");
  const [orientation, setOrientation] = useState("portrait"); // "portrait" | "landscape"

  // Program -> Class -> Section filters state (multi-select arrays)
  const [selectedPrograms, setSelectedPrograms] = useState(() => {
    if (activeFilters.filterProgram && activeFilters.filterProgram !== "all") {
      return [activeFilters.filterProgram];
    }
    return [];
  });
  const [selectedClasses, setSelectedClasses] = useState(() => {
    if (activeFilters.filterClass && activeFilters.filterClass !== "all") {
      return [activeFilters.filterClass];
    }
    return [];
  });
  const [selectedSections, setSelectedSections] = useState(() => {
    if (activeFilters.filterSection && activeFilters.filterSection !== "all") {
      return [activeFilters.filterSection];
    }
    return [];
  });
  const [selectedSession, setSelectedSession] = useState(() => activeFilters.filterSessionId || "all");

  const topBarRef = useRef(null);
  const [topBarHeight, setTopBarHeight] = useState(125);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const updateHeight = () => {
      if (topBarRef.current) {
        setTopBarHeight(topBarRef.current.offsetHeight || 125);
      }
    };
    updateHeight();
    const timer = setTimeout(updateHeight, 50);
    const observer = new ResizeObserver(updateHeight);
    if (topBarRef.current) {
      observer.observe(topBarRef.current);
    }
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [open, selectedPrograms, selectedClasses, selectedSections]);

  // Only synchronize filters when dialog opens, not on every render
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSelectedPrograms(
        activeFilters.filterProgram && activeFilters.filterProgram !== "all"
          ? [activeFilters.filterProgram]
          : []
      );
      setSelectedClasses(
        activeFilters.filterClass && activeFilters.filterClass !== "all"
          ? [activeFilters.filterClass]
          : []
      );
      setSelectedSections(
        activeFilters.filterSection && activeFilters.filterSection !== "all"
          ? [activeFilters.filterSection]
          : []
      );
      setSelectedSession(activeFilters.filterSessionId || "all");
      setDialogSearch("");
    }
    prevOpenRef.current = open;
  }, [open, activeFilters]);

  // Dependent cascading options
  const classesForProgram = useMemo(() => {
    if (selectedPrograms.length === 0) return classesData;
    return classesData.filter((c) => selectedPrograms.includes(extractId(c.programId || c.program)));
  }, [selectedPrograms, classesData]);

  const sectionsForClass = useMemo(() => {
    if (selectedClasses.length === 0) {
      if (selectedPrograms.length === 0) return sectionsData;
      const validClassIds = classesForProgram.map((c) => extractId(c));
      return sectionsData.filter((s) => validClassIds.includes(extractId(s.classId || s.class)));
    }
    return sectionsData.filter((s) => selectedClasses.includes(extractId(s.classId || s.class)));
  }, [selectedClasses, selectedPrograms, classesForProgram, sectionsData]);

  const isSectionApplicable = selectedClasses.length === 0 ? true : sectionsForClass.length > 0;

  // Auto-prune classes when selected programs change
  const handleProgramsChange = (vals) => {
    setSelectedPrograms(vals);
    if (vals.length > 0) {
      const validClassIds = classesData
        .filter((c) => vals.includes(extractId(c.programId || c.program)))
        .map((c) => extractId(c));
      setSelectedClasses((prev) => prev.filter((id) => validClassIds.includes(id)));
    }
  };

  // Auto-prune sections when selected classes change
  const handleClassesChange = (vals) => {
    setSelectedClasses(vals);
    if (vals.length > 0) {
      const validSectionIds = sectionsData
        .filter((s) => vals.includes(extractId(s.classId || s.class)))
        .map((s) => extractId(s));
      setSelectedSections((prev) => prev.filter((id) => validSectionIds.includes(id)));
    }
  };

  // Fetch students matching selected programs, classes, sections, session lazily with trimmed fields
  const programParam = selectedPrograms.length > 0 ? selectedPrograms.join(",") : "";
  const classParam = selectedClasses.length > 0 ? selectedClasses.join(",") : "";
  const sectionParam = selectedSections.length > 0 ? selectedSections.join(",") : "";

  const { data: rawStudentsResponse, isLoading: isLoadingQuery } = useQuery({
    queryKey: [
      "documentReportStudents",
      [...selectedPrograms].sort().join(","),
      [...selectedClasses].sort().join(","),
      [...selectedSections].sort().join(","),
      selectedSession,
      status,
    ],
    queryFn: () =>
      getStudents(
        programParam,
        classParam,
        sectionParam,
        "",
        status || "ACTIVE",
        "",
        1,
        10000, // fetch all
        "",
        "",
        selectedSession === "all" ? "" : selectedSession,
        false,
        "",
        STUDENT_DOCUMENT_FIELDS
      ),
    enabled: open,
    staleTime: 30000,
  });

  const sourceStudents = useMemo(() => {
    let list = [];
    if (rawStudentsResponse) {
      if (Array.isArray(rawStudentsResponse)) list = rawStudentsResponse;
      else if (Array.isArray(rawStudentsResponse?.students)) list = rawStudentsResponse.students;
    }
    // Client-side multi-select filtering
    return list.filter((s) => {
      if (selectedPrograms.length > 0) {
        const progId = extractId(s.programId || s.program);
        if (progId && !selectedPrograms.includes(progId)) return false;
      }
      if (selectedClasses.length > 0) {
        const clsId = extractId(s.classId || s.class);
        if (clsId && !selectedClasses.includes(clsId)) return false;
      }
      if (selectedSections.length > 0) {
        const secId = extractId(s.sectionId || s.section);
        if (secId && !selectedSections.includes(secId)) return false;
      }
      return true;
    });
  }, [rawStudentsResponse, selectedPrograms, selectedClasses, selectedSections]);

  // Resolve document data and ONLY KEEP STUDENTS WITH AT LEAST ONE PENDING DOCUMENT
  const pendingStudents = useMemo(() => {
    return sourceStudents
      .map((s) =>
        resolveStudentDocumentData(s, {
          programData,
          classesData,
          sectionsData,
          academicSessions,
        })
      )
      .filter((s) => s.missingCount > 0); // only students with at least 1 pending document!
  }, [sourceStudents, programData, classesData, sectionsData, academicSessions]);

  // Search filter within pending students list
  const filteredResolvedStudents = useMemo(() => {
    if (!dialogSearch.trim()) return pendingStudents;
    const q = dialogSearch.toLowerCase().trim();
    return pendingStudents.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.fatherName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.programName.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
    );
  }, [pendingStudents, dialogSearch]);

  // Resolve human-readable filter names
  const filterSummary = useMemo(() => {
    const programName =
      selectedPrograms.length === 0
        ? "All Programs"
        : selectedPrograms
            .map((id) => programData.find((item) => extractId(item) === id)?.name || id)
            .join(", ");

    const className =
      selectedClasses.length === 0
        ? "All Classes"
        : selectedClasses
            .map((id) => classesData.find((item) => extractId(item) === id)?.name || id)
            .join(", ");

    const sectionName =
      selectedSections.length === 0
        ? "All Sections"
        : selectedSections
            .map((id) => sectionsData.find((item) => extractId(item) === id)?.name || id)
            .join(", ");

    let sessionName = "";
    if (selectedSession && selectedSession !== "all") {
      const sess = academicSessions.find((item) => extractId(item) === selectedSession);
      sessionName = sess?.name || "";
    }

    return {
      status: status || "ACTIVE",
      program: programName,
      class: className,
      section: sectionName,
      session: sessionName,
    };
  }, [
    selectedPrograms,
    selectedClasses,
    selectedSections,
    selectedSession,
    programData,
    classesData,
    sectionsData,
    academicSessions,
    status,
  ]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${origin}/logo.png`;
  const formattedPrintDate = useMemo(() => format(new Date(), "dd/MM/yyyy HH:mm"), []);

  const bodyHtml = useMemo(() => {
    return generateStudentDocumentReportBodyHtml({
      resolvedStudents: filteredResolvedStudents,
      filterSummary,
      formattedPrintDate,
      logoUrl,
      orientation,
    });
  }, [filteredResolvedStudents, filterSummary, formattedPrintDate, logoUrl, orientation]);

  const fullPrintHtml = useMemo(() => {
    return generateStudentDocumentReportPrintHtml({
      resolvedStudents: filteredResolvedStudents,
      filterSummary,
      orientation,
    });
  }, [filteredResolvedStudents, filterSummary, orientation]);

  const handlePrint = async () => {
    if (!fullPrintHtml) return;
    setIsPrinting(true);
    try {
      const progDocTitle =
        selectedPrograms.length === 0
          ? "All"
          : selectedPrograms.length === 1
          ? programData.find((p) => extractId(p) === selectedPrograms[0])?.name || "Program"
          : `${selectedPrograms.length}Programs`;
      const docTitle = `Student_Document_Report_${progDocTitle}_${orientation}_${format(
        new Date(),
        "yyyyMMdd"
      )}`;
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
      console.error("Failed to print document report:", err);
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
      <DialogContent
        className="!overflow-hidden flex flex-col h-dvh sm:!w-[95dvw] sm:!max-w-[95dvw] p-0 gap-0 border shadow-2xl"
        style={{ height: "100dvh", maxHeight: "100dvh" }}
      >
        <div ref={topBarRef} className="shrink-0 flex flex-col z-10 bg-white">
          {/* Sticky Dialog Header */}
          <DialogHeader className="bg-white border-b px-6 py-3.5 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                Student Document Report
              </DialogTitle>
              <Badge variant="outline" className="font-mono text-xs font-semibold bg-slate-50">
                {isLoadingQuery ? (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                  </span>
                ) : (
                  `${filteredResolvedStudents.length} Pending`
                )}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Institutional document audit showing enrolled students with at least one pending document submission.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <div className="relative w-40 sm:w-48 hidden md:block">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search pending..."
                value={dialogSearch}
                onChange={(e) => setDialogSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting || filteredResolvedStudents.length === 0}
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

        {/* Dependent Filters Bar: Program -> Class -> Section */}
        <div className="bg-slate-50 border-b px-6 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-slate-600">Program:</Label>
            <div className="w-48">
              <MultiSelectFilter
                options={programData.map((p) => ({ value: extractId(p), label: p.name || p.programName }))}
                selected={selectedPrograms}
                onChange={handleProgramsChange}
                placeholder="Programs"
                allLabel="All Programs"
                defaultSelectedAll={true}
                triggerClassName="h-8 text-xs bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-slate-600">Class:</Label>
            <div className="w-40">
              <MultiSelectFilter
                options={classesForProgram.map((c) => ({ value: extractId(c), label: c.name || c.className }))}
                selected={selectedClasses}
                onChange={handleClassesChange}
                placeholder="Classes"
                allLabel="All Classes"
                disabled={classesForProgram.length === 0}
                triggerClassName="h-8 text-xs bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-slate-600">Section:</Label>
            <div className="w-36">
              <MultiSelectFilter
                options={sectionsForClass.map((s) => ({ value: extractId(s), label: s.name || s.sectionName }))}
                selected={selectedSections}
                onChange={setSelectedSections}
                placeholder="Sections"
                allLabel="All Sections"
                disabled={!isSectionApplicable || sectionsForClass.length === 0}
                triggerClassName="h-8 text-xs bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-slate-600">Layout:</Label>
            <Select value={orientation} onValueChange={(val) => setOrientation(val)}>
              <SelectTrigger className="h-8 w-36 text-xs bg-white font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait (Vertical)</SelectItem>
                <SelectItem value="landscape">Landscape (Horizontal)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(selectedPrograms.length > 0 || selectedClasses.length > 0 || selectedSections.length > 0 || dialogSearch) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedPrograms([]);
                setSelectedClasses([]);
                setSelectedSections([]);
                setDialogSearch("");
              }}
              className="h-8 px-2 text-xs text-slate-500 hover:text-slate-800 gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              {selectedPrograms.length === 0 ? (
                <span className="text-slate-400 italic">Select a program to load pending records</span>
              ) : isLoadingQuery ? (
                <span className="flex items-center gap-1 text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Fetching records...
                </span>
              ) : (
                `Found ${filteredResolvedStudents.length} student${filteredResolvedStudents.length !== 1 ? "s" : ""} with pending submissions`
              )}
            </span>
          </div>
        </div>
      </div>

        {/* Scrollable Preview Canvas with thin & visible scrollbar - native DOM */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-slate-100 [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.5)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-400/60 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors"
          style={{
            height: `calc(100dvh - ${topBarHeight}px)`,
            maxHeight: `calc(100dvh - ${topBarHeight}px)`,
          }}
        >
          <style>{getStudentDocumentReportStyles()}</style>
          {isLoadingQuery ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <p className="text-sm">Fetching and auditing student document records...</p>
            </div>
          ) : filteredResolvedStudents.length > 0 && bodyHtml ? (
            <div
              className={`student-doc-report-preview ${orientation}-mode shadow-md border border-slate-300 mx-auto bg-white select-text transition-all duration-200`}
              style={{
                width: "100%",
                maxWidth: orientation === "portrait" ? "794px" : "1100px",
                minWidth: orientation === "portrait" ? "640px" : "850px",
              }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <div className="py-24 px-4 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-orange-600">
                <FileText className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-800">
                  No Pending Documents Found
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {selectedPrograms.length > 0 || selectedClasses.length > 0 || selectedSections.length > 0
                    ? "All enrolled students matching the selected filter have submitted their mandatory documents."
                    : "No students with pending document submissions were found."}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentDocumentReportDialog;

