import React, { useState, useMemo, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
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
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileSpreadsheet,
  Printer,
  SlidersHorizontal,
  Search,
  RotateCcw,
  Loader2,
  Users,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  UserPlus,
  Coins,
  Calendar,
  Clock,
  X,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getAdmissionConversionReport } from "../../../config/apis";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

const formatDateSafe = (d) => {
  if (!d) return "—";
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return String(d);
    return format(parsed, "dd MMM yyyy");
  } catch {
    return String(d);
  }
};

const fetchLogoDataUrl = async () => {
  try {
    const res = await fetch("/logo.png");
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(`${window.location.origin}/logo.png`);
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // fallback
  }
  return typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png";
};

const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

const PROSPECTUS_OPTIONS = [
  { value: "sold", label: "Prospectus Sold" },
  { value: "unsold", label: "Prospectus Not Sold" },
];

const CONVERSION_STATUS_OPTIONS = [
  { value: "CONVERTED", label: "Converted (Admitted Student)" },
  { value: "PENDING", label: "Pending (Inquiry Only)" },
  { value: "REJECTED", label: "Rejected" },
];

export const AdmissionConversionReportDialog = ({
  open,
  onOpenChange,
  academicSessions = [],
  programData = [],
  classesData = [],
  sectionsData = [],
}) => {
  const { toast } = useToast();

  // Find active session
  const activeSession = useMemo(() => {
    return academicSessions.find((s) => s.isActive === true || s.isActive === "true") || academicSessions[0] || null;
  }, [academicSessions]);

  const activeSessionId = activeSession ? extractId(activeSession) : "";

  // Filter States
  const [filterSessions, setFilterSessions] = useState(() => {
    const active = academicSessions.find((s) => s.isActive === true || s.isActive === "true") || academicSessions[0];
    return active ? [extractId(active)] : [];
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterInquiryTypes, setFilterInquiryTypes] = useState([]);
  const [filterGenders, setFilterGenders] = useState([]);
  const [filterProspectus, setFilterProspectus] = useState([]);
  const [filterPrograms, setFilterPrograms] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Selective row printing / export
  const [selectedInquiryIds, setSelectedInquiryIds] = useState(new Set());
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPrint, setIsExportingPrint] = useState(false);

  // Initialize session filter to active session on open
  useEffect(() => {
    if (open) {
      if (activeSessionId) {
        setFilterSessions([activeSessionId]);
      } else {
        setFilterSessions([]);
      }
      setSelectedInquiryIds(new Set());
    }
  }, [open, activeSessionId]);

  useEffect(() => {
    if (open && filterSessions.length === 0 && activeSessionId) {
      setFilterSessions([activeSessionId]);
    }
  }, [open, activeSessionId, filterSessions.length]);

  // Query Backend for Admission Conversion Report
  const {
    data: reportData = { records: [], summary: {} },
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "admissionConversionReport",
      [...filterSessions].sort().join(","),
      fromDate,
      toDate,
      [...filterInquiryTypes].sort().join(","),
      [...filterGenders].sort().join(","),
      [...filterProspectus].sort().join(","),
      [...filterPrograms].sort().join(","),
      [...filterStatus].sort().join(","),
      searchQuery,
    ],
    queryFn: () =>
      getAdmissionConversionReport({
        sessionId: filterSessions.length > 0 ? filterSessions.join(",") : "all",
        from: fromDate,
        to: toDate,
        inquiryType: filterInquiryTypes.length > 0 ? filterInquiryTypes.join(",") : "",
        gender: filterGenders.length > 0 ? filterGenders.join(",") : "",
        prospectusSold:
          filterProspectus.length === 1
            ? filterProspectus[0] === "sold"
              ? "true"
              : "false"
            : "",
        programId: filterPrograms.length > 0 ? filterPrograms.join(",") : "",
        conversionStatus: filterStatus.length > 0 ? filterStatus.join(",") : "",
        search: searchQuery.trim(),
      }),
    enabled: open,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const records = reportData?.records || [];
  const summary = reportData?.summary || {};

  // Stable master inquiry types list (never shifts or flickers on filter changes)
  const [masterInquiryTypes, setMasterInquiryTypes] = useState([
    "Physical",
    "Walk-in",
    "Phone Call",
    "Social Media",
    "Online",
    "Website",
    "Referral",
  ]);

  // Update master inquiry types if backend reveals new types
  useEffect(() => {
    if (summary?.availableInquiryTypes && summary.availableInquiryTypes.length > 0) {
      setMasterInquiryTypes((prev) => {
        const map = new Map();
        for (const t of [...prev, ...summary.availableInquiryTypes]) {
          if (!t || typeof t !== "string") continue;
          const clean = t.trim();
          if (!clean) continue;
          const lower = clean.toLowerCase();
          if (!map.has(lower)) {
            const formatted = clean.length > 1
              ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
              : clean;
            map.set(lower, formatted);
          }
        }
        return Array.from(map.values()).sort();
      });
    }
  }, [summary?.availableInquiryTypes]);

  const inquiryTypeOptions = useMemo(() => {
    return masterInquiryTypes.map((t) => ({ value: t, label: t }));
  }, [masterInquiryTypes]);

  // Session options
  const sessionOptions = useMemo(() => {
    return academicSessions.map((s) => {
      const isAct = s.isActive === true || s.isActive === "true";
      return {
        value: extractId(s),
        label: `${s.name || s.sessionName}${isAct ? " (Active)" : ""}`,
      };
    });
  }, [academicSessions]);

  // Program options
  const programOptions = useMemo(() => {
    return programData.map((p) => ({
      value: extractId(p),
      label: p.name || p.programName || "Program",
    }));
  }, [programData]);

  // Reset Filters
  const handleResetFilters = () => {
    if (activeSessionId) {
      setFilterSessions([activeSessionId]);
    } else {
      setFilterSessions([]);
    }
    setFromDate("");
    setToDate("");
    setFilterInquiryTypes([]);
    setFilterGenders([]);
    setFilterProspectus([]);
    setFilterPrograms([]);
    setFilterStatus([]);
    setSearchQuery("");
    setSelectedInquiryIds(new Set());
  };

  // Row Selection logic
  const allRowIds = useMemo(() => records.map((r) => r.inquiryId), [records]);
  const isAllSelected = records.length > 0 && allRowIds.every((id) => selectedInquiryIds.has(id));

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedInquiryIds(new Set());
    } else {
      setSelectedInquiryIds(new Set(allRowIds));
    }
  }, [isAllSelected, allRowIds]);

  const toggleRowSelection = useCallback((id) => {
    setSelectedInquiryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Effective records for export / print (selected subset or all)
  const effectiveRecords = useMemo(() => {
    if (selectedInquiryIds.size === 0) return records;
    return records.filter((r) => selectedInquiryIds.has(r.inquiryId));
  }, [records, selectedInquiryIds]);

  // ==========================================
  // EXCEL EXPORT (.xlsx)
  // ==========================================
  const handleExportToExcel = async () => {
    if (!effectiveRecords || effectiveRecords.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no records matching your selected filters.",
        variant: "destructive",
      });
      return;
    }

    setIsExportingExcel(true);
    try {
      const wb = XLSX.utils.book_new();

      const rows = effectiveRecords.map((r, idx) => ({
        "S.No": idx + 1,
        "Inquiry Date": formatDateSafe(r.inquiryDate),
        "Student Name": r.studentName,
        "Father Name": r.fatherName,
        "Contact Number": r.contactNumber,
        "Student CNIC": r.studentCnic,
        "Father CNIC": r.fatherCnic,
        "Gender": r.gender,
        "Inquiry Type": r.inquiryType,
        "Program Interest": r.programInterest,
        "Session": r.sessionName,
        "Prospectus Sold": r.prospectusSold ? "YES" : "NO",
        "Prospectus Fee (PKR)": r.prospectusFee || 0,
        "Prospectus Receipt": r.prospectusReceipt,
        "Conversion Status": r.conversionStatus,
        "Admitted Roll Number": r.studentDetails?.rollNumber || "—",
        "Admitted Program": r.studentDetails?.programName || "—",
        "Admitted Class": r.studentDetails?.className || "—",
        "Admitted Section": r.studentDetails?.sectionName || "—",
        "Admission Date": r.studentDetails?.admissionDate ? formatDateSafe(r.studentDetails.admissionDate) : "—",
        "Days to Convert": r.daysToConversion != null ? `${r.daysToConversion} days` : "—",
        "Decided Tuition Fee (PKR)": r.studentDetails?.tuitionFee || 0,
      }));

      // Compute total prospectus and tuition
      const totalProspectus = effectiveRecords.reduce((sum, r) => sum + (r.prospectusFee || 0), 0);
      const totalTuition = effectiveRecords.reduce((sum, r) => sum + (r.studentDetails?.tuitionFee || 0), 0);
      const convertedCount = effectiveRecords.filter((r) => r.isConverted).length;

      rows.push({
        "S.No": "TOTAL",
        "Inquiry Date": `${effectiveRecords.length} Total Inquiries`,
        "Student Name": `${convertedCount} Converted to Students`,
        "Father Name": "",
        "Contact Number": "",
        "Student CNIC": "",
        "Father CNIC": "",
        "Gender": "",
        "Inquiry Type": "",
        "Program Interest": "",
        "Session": "",
        "Prospectus Sold": "",
        "Prospectus Fee (PKR)": totalProspectus,
        "Prospectus Receipt": "",
        "Conversion Status": `${effectiveRecords.length > 0 ? ((convertedCount / effectiveRecords.length) * 100).toFixed(1) : 0}% Conversion Rate`,
        "Admitted Roll Number": "",
        "Admitted Program": "",
        "Admitted Class": "",
        "Admitted Section": "",
        "Admission Date": "",
        "Days to Convert": "",
        "Decided Tuition Fee (PKR)": totalTuition,
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 6 },  // S.No
        { wch: 14 }, // Inquiry Date
        { wch: 22 }, // Student Name
        { wch: 20 }, // Father Name
        { wch: 16 }, // Contact
        { wch: 18 }, // Student CNIC
        { wch: 16 }, // Father CNIC
        { wch: 10 }, // Gender
        { wch: 15 }, // Inquiry Type
        { wch: 22 }, // Program Interest
        { wch: 15 }, // Session
        { wch: 15 }, // Prospectus Sold
        { wch: 18 }, // Prospectus Fee
        { wch: 18 }, // Prospectus Receipt
        { wch: 20 }, // Conversion Status
        { wch: 20 }, // Admitted Roll Number
        { wch: 20 }, // Admitted Program
        { wch: 16 }, // Admitted Class
        { wch: 16 }, // Admitted Section
        { wch: 15 }, // Admission Date
        { wch: 15 }, // Days to Convert
        { wch: 22 }, // Tuition Fee
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Admission Conversion");
      const fileName = `Admission_Conversion_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export Completed 🎉",
        description: `Exported ${effectiveRecords.length} conversion records to Excel.`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel report.",
        variant: "destructive",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // ==========================================
  // PRINT & PDF PREVIEW
  // ==========================================
  const handleExportAsPrint = async () => {
    if (!effectiveRecords || effectiveRecords.length === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no records matching your selected filters.",
        variant: "destructive",
      });
      return;
    }

    setIsExportingPrint(true);
    try {
      const logoDataUrl = await fetchLogoDataUrl();
      const exportDate = format(new Date(), "dd MMMM yyyy, hh:mm a");

      const sessionLabel =
        filterSessions.length === 0
          ? "All Academic Sessions"
          : filterSessions
              .map((id) => academicSessions.find((s) => extractId(s) === id)?.name || id)
              .join(", ");

      const typeLabel = filterInquiryTypes.length === 0 ? "All Types" : filterInquiryTypes.join(", ");
      const genderLabel = filterGenders.length === 0 ? "All Genders" : filterGenders.join(", ");
      const prospectusLabel =
        filterProspectus.length === 0
          ? "All (Sold & Unsold)"
          : filterProspectus.map((p) => (p === "sold" ? "Sold Only" : "Not Sold")).join(", ");

      const dateRangeLabel =
        fromDate && toDate
          ? `${formatDateSafe(fromDate)} — ${formatDateSafe(toDate)}`
          : fromDate
          ? `From ${formatDateSafe(fromDate)}`
          : toDate
          ? `Up to ${formatDateSafe(toDate)}`
          : "All Time";

      const totalCount = effectiveRecords.length;
      const convertedCount = effectiveRecords.filter((r) => r.isConverted).length;
      const pendingCount = effectiveRecords.filter((r) => r.conversionStatus === "PENDING").length;
      const rejectedCount = effectiveRecords.filter((r) => r.conversionStatus === "REJECTED").length;
      const soldCount = effectiveRecords.filter((r) => r.prospectusSold).length;
      const totalRevenue = effectiveRecords.reduce((sum, r) => sum + (r.prospectusFee || 0), 0);
      const conversionRate = totalCount > 0 ? ((convertedCount / totalCount) * 100).toFixed(1) : "0.0";

      const isSubset = selectedInquiryIds.size > 0 && selectedInquiryIds.size < records.length;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Admission Conversion &amp; Inquiry Report - Concordia College</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet">
            <style>
              @media print {
                @page { size: A4 landscape; margin: 8mm 10mm; }
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .no-break { page-break-inside: avoid; }
              }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: #0f172a;
                background: #ffffff;
                margin: 0;
                padding: 10px;
                font-size: 10px;
                line-height: 1.35;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .report-container {
                width: 100%;
                margin: 0 auto;
                background: #ffffff;
                border: 1.5px solid #0f172a;
                border-top: 3px solid #0f172a;
                padding: 12px 14px;
              }
              .form-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 8px;
                margin-bottom: 6px;
                gap: 12px;
              }
              .header-logo-area {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
              }
              .brand-logo {
                height: 50px;
                width: auto;
                max-width: 120px;
                object-fit: contain;
                display: block;
              }
              .header-title-block h1 {
                font-size: 17px;
                font-weight: 700;
                margin: 0;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                color: #0f172a;
              }
              .header-title-block .tagline {
                font-size: 9px;
                font-weight: 600;
                text-transform: uppercase;
                color: #475569;
                letter-spacing: 0.5px;
                margin-top: 2px;
              }
              .meta-box {
                font-size: 9.5px;
                color: #64748b;
                line-height: 1.4;
                text-align: right;
              }
              .meta-box strong { color: #0f172a; }
              .center-calligraphy-title {
                text-align: center;
                font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Brush Script MT', 'Lucida Calligraphy', cursive, serif;
                font-size: 26px;
                font-weight: 500;
                color: #0f172a;
                margin: 4px 0 8px 0;
                padding: 2px 0 6px 0;
                border-bottom: 1px dashed #cbd5e1;
                letter-spacing: 0.5px;
              }
              .filters-bar {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 6px 12px;
                margin-bottom: 10px;
                display: flex;
                flex-wrap: wrap;
                gap: 14px;
                font-size: 9.5px;
              }
              .filter-item strong { color: #334155; }
              .filter-item span { color: #0f172a; font-weight: 600; }
              .kpi-summary-strip {
                background: #f8fafc;
                border: 1.5px solid #0f172a;
                border-radius: 6px;
                padding: 7px 14px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                font-size: 10px;
              }
              .kpi-item { display: flex; align-items: center; gap: 6px; }
              .kpi-label { color: #475569; font-weight: 500; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.3px; }
              .kpi-val { font-size: 13px; font-weight: 800; color: #0f172a; }
              .kpi-val.emerald { color: #15803d; }
              .kpi-val.amber { color: #b45309; }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
              }
              thead th {
                background: #f1f5f9;
                color: #0f172a;
                font-size: 9px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                padding: 6px 7px;
                text-align: left;
                border: 1px solid #cbd5e1;
              }
              td {
                padding: 5.5px 7px;
                font-size: 9.5px;
                border: 1px solid #e2e8f0;
              }
              tr:nth-child(even) td { background-color: #fafbfc; }
              .badge-converted {
                background: #f0fdf4;
                color: #15803d;
                border: 1px solid #bbf7d0;
                padding: 1.5px 5px;
                border-radius: 3px;
                font-weight: 700;
                font-size: 8.5px;
                display: inline-block;
              }
              .badge-pending {
                background: #fffbeb;
                color: #b45309;
                border: 1px solid #fde68a;
                padding: 1.5px 5px;
                border-radius: 3px;
                font-weight: 700;
                font-size: 8.5px;
                display: inline-block;
              }
              .badge-rejected {
                background: #fef2f2;
                color: #b91c1c;
                border: 1px solid #fecaca;
                padding: 1.5px 5px;
                border-radius: 3px;
                font-weight: 700;
                font-size: 8.5px;
                display: inline-block;
              }
              tfoot tr {
                background: #f1f5f9;
                border-top: 2px solid #0f172a;
                border-bottom: 2px solid #0f172a;
                font-weight: 700;
              }
              tfoot td {
                padding: 6px 7px;
                font-size: 10px;
                color: #0f172a;
                border: 1px solid #cbd5e1;
              }
              .footer-sign {
                display: flex;
                justify-content: space-between;
                margin-top: 24px;
                padding-top: 14px;
                border-top: 1.5px solid #0f172a;
                font-size: 9.5px;
                color: #475569;
              }
            </style>
          </head>
          <body>
            <div class="report-container">
              <div class="form-header">
                <div class="header-logo-area">
                  <img src="${logoDataUrl}" class="brand-logo" alt="Logo" />
                  <div class="header-title-block">
                    <h1>Concordia College Peshawar</h1>
                    <div class="tagline">Admissions &amp; Front Office</div>
                  </div>
                </div>
                <div class="meta-box">
                  <div><strong>Generated:</strong> ${exportDate}</div>
                  <div><strong>Records:</strong> ${isSubset ? `Selected (${effectiveRecords.length})` : `All (${effectiveRecords.length})`}</div>
                </div>
              </div>

              <div class="center-calligraphy-title">
                Admission Conversion &amp; Inquiry Report
              </div>

              <div class="filters-bar">
                <div class="filter-item"><strong>Session:</strong> <span>${sessionLabel}</span></div>
                <div class="filter-item"><strong>Date Range:</strong> <span>${dateRangeLabel}</span></div>
                <div class="filter-item"><strong>Inquiry Types:</strong> <span>${typeLabel}</span></div>
                <div class="filter-item"><strong>Gender:</strong> <span>${genderLabel}</span></div>
                <div class="filter-item"><strong>Prospectus:</strong> <span>${prospectusLabel}</span></div>
              </div>

              <div class="kpi-summary-strip">
                <div class="kpi-item">
                  <div>
                    <div class="kpi-label">Total Inquiries</div>
                    <div class="kpi-val">${totalCount}</div>
                  </div>
                </div>
                <div class="kpi-item">
                  <div>
                    <div class="kpi-label">Admissions Converted</div>
                    <div class="kpi-val emerald">${convertedCount}</div>
                  </div>
                </div>
                <div class="kpi-item">
                  <div>
                    <div class="kpi-label">Conversion Rate</div>
                    <div class="kpi-val emerald">${conversionRate}%</div>
                  </div>
                </div>
                <div class="kpi-item">
                  <div>
                    <div class="kpi-label">Pending Inquiries</div>
                    <div class="kpi-val amber">${pendingCount}</div>
                  </div>
                </div>
                <div class="kpi-item">
                  <div>
                    <div class="kpi-label">Prospectus Sold</div>
                    <div class="kpi-val">${soldCount} <span style="font-size: 9px; font-weight: normal; color: #64748b;">(PKR ${totalRevenue.toLocaleString()})</span></div>
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 24px; text-align: center;">#</th>
                    <th style="width: 75px;">Inquiry Date</th>
                    <th>Candidate Details</th>
                    <th>Inquiry Type</th>
                    <th>Program Interest</th>
                    <th style="text-align: center;">Prospectus</th>
                    <th style="text-align: center;">Conversion Status</th>
                    <th>Admitted Student Record</th>
                    <th style="text-align: center;">Turnaround</th>
                  </tr>
                </thead>
                <tbody>
                  ${effectiveRecords
                    .map(
                      (r, idx) => `
                    <tr>
                      <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                      <td>${formatDateSafe(r.inquiryDate)}</td>
                      <td>
                        <strong>${r.studentName}</strong><br/>
                        <span style="color: #64748b; font-size: 8.5px;">S/O: ${r.fatherName} • ${r.gender}</span><br/>
                        <span style="color: #475569; font-size: 8.5px;"> ${r.contactNumber}</span>
                      </td>
                      <td><span style="font-weight: 600;">${r.inquiryType}</span></td>
                      <td>${r.programInterest}</td>
                      <td style="text-align: center;">
                        ${
                          r.prospectusSold
                            ? `<span style="color: #15803d; font-weight: 700;">SOLD</span><br/><span style="font-size: 8px; color: #64748b;">PKR ${r.prospectusFee}</span>`
                            : `<span style="color: #94a3b8;">NO</span>`
                        }
                      </td>
                      <td style="text-align: center;">
                        <span class="${
                          r.conversionStatus === "CONVERTED"
                            ? "badge-converted"
                            : r.conversionStatus === "REJECTED"
                            ? "badge-rejected"
                            : "badge-pending"
                        }">
                          ${r.conversionStatus}
                        </span>
                      </td>
                      <td>
                        ${
                          r.studentDetails
                            ? `
                              <strong>${r.studentDetails.rollNumber}</strong><br/>
                              <span style="font-size: 8.5px; color: #475569;">${r.studentDetails.programName} — ${r.studentDetails.className} (${r.studentDetails.sectionName})</span><br/>
                              <span style="font-size: 8px; color: #64748b;">Adm Date: ${formatDateSafe(r.studentDetails.admissionDate)}</span>
                            `
                            : `<span style="color: #94a3b8; font-style: italic;">Not admitted yet</span>`
                        }
                      </td>
                      <td style="text-align: center;">
                        ${r.daysToConversion != null ? `<strong>${r.daysToConversion}</strong> days` : "—"}
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="4" style="text-align: right; font-weight: 700;">
                      SUMMARY TOTALS (${effectiveRecords.length} INQUIRIES):
                    </td>
                    <td colspan="2" style="text-align: center;">
                      ${soldCount} Prospectus Sold (PKR ${totalRevenue.toLocaleString()})
                    </td>
                    <td style="text-align: center; color: #15803d;">
                      ${convertedCount} Admitted (${conversionRate}%)
                    </td>
                    <td colspan="2"></td>
                  </tr>
                </tfoot>
              </table>

              <div class="footer-sign no-break">
                <div><strong>Prepared By:</strong> _____________________</div>
                <div><strong>Checked By:</strong> _____________________</div>
                <div><strong>Admissions Officer:</strong> _____________________</div>
                <div><strong>Principal / Director:</strong> _____________________</div>
              </div>
            </div>
          </body>
        </html>
      `;

      await openManagedPrintWindow({
        html,
        title: `Admission Conversion Report - ${format(new Date(), "yyyy-MM-dd")}`,
        toast,
      });
    } catch (err) {
      toast({
        title: "Print Failed",
        description: err.message || "Failed to open print preview.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPrint(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 flex flex-col overflow-hidden w-full sm:w-[96vw] lg:w-[95vw]"
        bodyClassName="p-2.5 sm:p-3 flex-1 flex flex-col gap-2 min-h-0 overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="px-3.5 py-2 border-b border-border/80 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <TrendingUp className="w-4.5 h-4.5 text-primary" />
                Admission Conversion Report
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                Audit candidate inquiries and track conversion into enrolled students with prospectus sales and admission timelines.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportToExcel}
                disabled={isExportingExcel || isLoading || records.length === 0}
                className="gap-1.5 h-7.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 flex-1 sm:flex-initial"
              >
                {isExportingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                )}
                {selectedInquiryIds.size > 0 ? `Export Selected (${selectedInquiryIds.size})` : "Export to Excel (.xlsx)"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAsPrint}
                disabled={isExportingPrint || isLoading || records.length === 0}
                className="gap-1.5 h-7.5 text-xs font-semibold flex-1 sm:flex-initial"
              >
                {isExportingPrint ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5 text-primary" />
                )}
                {selectedInquiryIds.size > 0 ? `Print Selected (${selectedInquiryIds.size})` : "Export as PDF / Print"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filters Section */}
        <div className="p-2 bg-muted/30 rounded-lg border border-border/60 flex-shrink-0 space-y-1.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {/* Session Filter */}
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">Session</Label>
              <MultiSelectFilter
                options={sessionOptions}
                selected={filterSessions}
                onChange={setFilterSessions}
                placeholder="Sessions"
                allLabel="All Sessions"
                defaultSelectedAll={false}
                triggerClassName="h-7.5 text-xs bg-background"
              />
            </div>

            {/* From Date */}
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-7.5 text-xs bg-background px-2"
              />
            </div>

            {/* To Date */}
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-7.5 text-xs bg-background px-2"
              />
            </div>

            {/* Inquiry Type Filter */}
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">Inquiry Type</Label>
              <MultiSelectFilter
                options={inquiryTypeOptions}
                selected={filterInquiryTypes}
                onChange={setFilterInquiryTypes}
                placeholder="Types"
                allLabel="All Inquiry Types"
                defaultSelectedAll={true}
                triggerClassName="h-7.5 text-xs bg-background"
              />
            </div>

            {/* Gender Filter */}
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">Gender</Label>
              <MultiSelectFilter
                options={GENDER_OPTIONS}
                selected={filterGenders}
                onChange={setFilterGenders}
                placeholder="Genders"
                allLabel="All Genders"
                defaultSelectedAll={true}
                triggerClassName="h-7.5 text-xs bg-background"
              />
            </div>

            {/* Prospectus Sold Filter */}
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold text-foreground">Prospectus</Label>
              <MultiSelectFilter
                options={PROSPECTUS_OPTIONS}
                selected={filterProspectus}
                onChange={setFilterProspectus}
                placeholder="Prospectus"
                allLabel="All (Sold & Unsold)"
                defaultSelectedAll={true}
                triggerClassName="h-7.5 text-xs bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-2 items-end">
            {/* Program Interest Filter */}
            <div className="space-y-0.5 sm:col-span-1 md:col-span-2">
              <Label className="text-[11px] font-semibold text-foreground">Program Interest</Label>
              <MultiSelectFilter
                options={programOptions}
                selected={filterPrograms}
                onChange={setFilterPrograms}
                placeholder="Programs"
                allLabel="All Programs"
                defaultSelectedAll={true}
                triggerClassName="h-7.5 text-xs bg-background"
              />
            </div>

            {/* Conversion Status Filter */}
            <div className="space-y-0.5 sm:col-span-1 md:col-span-2">
              <Label className="text-[11px] font-semibold text-foreground">Conversion Status</Label>
              <MultiSelectFilter
                options={CONVERSION_STATUS_OPTIONS}
                selected={filterStatus}
                onChange={setFilterStatus}
                placeholder="Status"
                allLabel="All Conversion Statuses"
                defaultSelectedAll={true}
                triggerClassName="h-7.5 text-xs bg-background"
              />
            </div>

            {/* Search Input Bar */}
            <div className="space-y-0.5 sm:col-span-1 md:col-span-2 flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, phone, CNIC, roll #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7.5 text-xs pl-8 bg-background"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-7.5 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* SUMMARY KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
          <Card className="bg-primary/5 border-primary/20 p-2 text-center shadow-none">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Total Inquiries
            </div>
            <div className="text-base sm:text-lg font-extrabold text-foreground mt-0.5">
              {summary.totalInquiries || records.length}
            </div>
            <div className="text-[9.5px] text-muted-foreground mt-0.5">Matching criteria</div>
          </Card>

          <Card className="border border-emerald-200 dark:border-emerald-900 shadow-none bg-emerald-50/50 dark:bg-emerald-950/20 p-2 text-center">
            <div className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">
              Converted (Admitted)
            </div>
            <div className="text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center justify-center gap-1.5">
              {summary.convertedCount || 0}
              <span className="text-[9.5px] font-bold font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded text-emerald-800 dark:text-emerald-200">
                {summary.conversionRate || 0}%
              </span>
            </div>
            <div className="text-[9.5px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
              Enrolled into regular classes
            </div>
          </Card>

          <Card className="border border-amber-200 dark:border-amber-900 shadow-none bg-amber-50/50 dark:bg-amber-950/20 p-2 text-center">
            <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 tracking-wider">
              Pending Inquiries
            </div>
            <div className="text-base sm:text-lg font-extrabold text-amber-800 dark:text-amber-300 mt-0.5">
              {summary.pendingCount || 0}
            </div>
            <div className="text-[9.5px] text-amber-700/80 dark:text-amber-400 mt-0.5">
              Awaiting student enrollment
            </div>
          </Card>

          <Card className="border border-blue-200 dark:border-blue-900 shadow-none bg-blue-50/50 dark:bg-blue-950/20 p-2 text-center">
            <div className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300 tracking-wider">
              Prospectus Sold
            </div>
            <div className="text-base sm:text-lg font-extrabold text-blue-800 dark:text-blue-300 mt-0.5">
              {summary.prospectusSoldCount || 0}{" "}
              <span className="text-[11px] font-semibold text-muted-foreground">
                (PKR {(summary.totalProspectusRevenue || 0).toLocaleString()})
              </span>
            </div>
            <div className="text-[9.5px] text-blue-700/80 dark:text-blue-400 mt-0.5">
              Total prospectus revenue
            </div>
          </Card>
        </div>

        {/* Selection Banner if custom rows are checked */}
        {selectedInquiryIds.size > 0 && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 px-3 py-1 rounded text-xs flex-shrink-0">
            <span className="text-foreground font-medium">
              <strong>{selectedInquiryIds.size}</strong> of {records.length} records selected for selective print / export.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedInquiryIds(new Set())}
              className="h-6 text-xs text-primary hover:text-primary/80"
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* Data Table Preview */}
        <div className="flex-1 overflow-auto rounded-md border border-border/70 min-h-0">
          <Table className="w-full text-[11px]">
            <TableHeader className="bg-slate-50 dark:bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-8 px-1 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all rows"
                    className="translate-y-[2px]"
                  />
                </TableHead>
                <TableHead className="w-8 px-1 text-center font-bold text-[11px]">#</TableHead>
                <TableHead className="w-24 px-1.5 font-bold text-[11px] whitespace-nowrap">Inquiry Date</TableHead>
                <TableHead className="px-2 font-bold text-[11px]">Candidate & Contact</TableHead>
                <TableHead className="w-20 px-1.5 font-bold text-[11px] text-center">Inquiry Type</TableHead>
                <TableHead className="px-2 font-bold text-[11px]">Program Interest</TableHead>
                <TableHead className="w-20 px-1 font-bold text-[11px] text-center">Prospectus</TableHead>
                <TableHead className="w-24 px-1 font-bold text-[11px] text-center">Status</TableHead>
                <TableHead className="px-2 font-bold text-[11px]">Admitted Student Details</TableHead>
                <TableHead className="w-16 px-1 font-bold text-[11px] text-center">Turnaround</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-36 text-center">
                    <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <p className="text-xs font-medium">Loading admission conversion audit records...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-36 text-center">
                    <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <AlertCircle className="w-6 h-6 opacity-40 text-muted-foreground" />
                      <p className="text-xs font-semibold text-foreground">No Conversion Records Found</p>
                      <p className="text-[11px] max-w-sm text-muted-foreground">
                        No inquiries or student admissions matched the selected filters.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r, idx) => {
                  const isSelected = selectedInquiryIds.has(r.inquiryId);
                  return (
                    <TableRow
                      key={r.inquiryId || idx}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <TableCell className="w-8 px-1 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRowSelection(r.inquiryId)}
                          aria-label={`Select ${r.studentName}`}
                          className="translate-y-[2px]"
                        />
                      </TableCell>

                      <TableCell className="w-8 px-1 text-center font-mono text-[11px] text-muted-foreground">
                        {idx + 1}
                      </TableCell>

                      <TableCell className="w-24 px-1.5 text-[11px] font-medium text-foreground whitespace-nowrap">
                        {formatDateSafe(r.inquiryDate)}
                      </TableCell>

                      <TableCell className="px-2 py-1">
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold text-xs text-foreground">
                            {r.studentName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            S/O: {r.fatherName} • {r.gender}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                             {r.contactNumber}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="w-20 px-1.5 text-center py-1">
                        <Badge variant="secondary" className="text-[9.5px] font-medium px-1.5 py-0 bg-slate-100 dark:bg-muted text-slate-800 dark:text-slate-200">
                          {r.inquiryType}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-2 py-1 text-[11px]">
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium text-foreground">{r.programInterest}</span>
                          <span className="text-[10px] text-muted-foreground">{r.sessionName}</span>
                        </div>
                      </TableCell>

                      <TableCell className="w-20 px-1 text-center py-1">
                        {r.prospectusSold ? (
                          <div className="flex flex-col items-center leading-tight">
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 text-[9.5px] px-1 py-0 font-bold">
                              SOLD
                            </Badge>
                            <span className="text-[9.5px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                              PKR {(r.prospectusFee || 0).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[9.5px] text-muted-foreground px-1 py-0">
                            Not Sold
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="w-24 px-1 text-center py-1">
                        <Badge
                          variant="outline"
                          className={`text-[9.5px] font-bold px-1.5 py-0 ${
                            r.conversionStatus === "CONVERTED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : r.conversionStatus === "REJECTED"
                              ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                              : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                          }`}
                        >
                          {r.conversionStatus === "CONVERTED" ? "CONVERTED" : r.conversionStatus}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-2 py-1">
                        {r.studentDetails ? (
                          <div className="flex flex-col leading-tight">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="font-mono text-[9.5px] font-bold px-1 py-0 bg-primary/10 text-primary border-primary/20">
                                {r.studentDetails.rollNumber}
                              </Badge>
                            </div>
                            <span className="text-[10.5px] text-foreground font-medium mt-0.5">
                              {r.studentDetails.programName} — {r.studentDetails.className} ({r.studentDetails.sectionName})
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">
                              Admitted: {formatDateSafe(r.studentDetails.admissionDate)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10.5px] text-muted-foreground italic">
                            Inquiry only
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="w-16 px-1 text-center py-1">
                        {r.daysToConversion != null ? (
                          <Badge variant="secondary" className="text-[9.5px] font-mono font-bold px-1 py-0">
                            {r.daysToConversion}d
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="py-1 px-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground flex-shrink-0">
          <span>
            Showing <strong>{effectiveRecords.length}</strong> of {records.length} records
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs px-2.5">
            Close Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
