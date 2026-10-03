import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  getAcademicSessions,
  getRevenueOverTime,
  getClassCollectionStats,
  getNewRevenueOverTime,
  getNewClassStats,
  getNewFeeReportsAnalytics,
  getNewFeeSettings,
  getFeeChallans,
  getPrograms,
  getClasses,
  getSections,
} from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { ModernTooltip } from "@/components/ui/modern-charts";
import {
  SlidersHorizontal,
  X,
  Printer,
  ChevronDown,
  ChevronRight,
  Search,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import {
  normalizeChallan,
  getChallanGrossTotal,
  calculateLateFee,
} from "./feeFinancialUtils";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

const getName = (val) => {
  if (!val) return "";
  if (typeof val === "object") {
    return val.name || val.programName || val.className || val.sectionName || val.title || "";
  }
  return String(val);
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const FeeReportsTab = ({
  academicSessions: propAcademicSessions = [],
  programs: propPrograms = [],
  classes: propClasses = [],
  sections: propSections = [],
  lateFeeRatePerDay: propLateFeeRatePerDay,
}) => {
  const { toast } = useToast();

  // Pending Fee Report Filters (Multi-Select arrays for programs, classes, sections)
  const [selectedSession, setSelectedSession] = useState("all");
  const [selectedPrograms, setSelectedPrograms] = useState([]); // array of program IDs; empty = not selected yet
  const [selectedClasses, setSelectedClasses] = useState([]); // array of class IDs; empty = all for selected programs
  const [selectedSections, setSelectedSections] = useState([]); // array of section IDs; empty = all for selected classes
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStudentIds, setExpandedStudentIds] = useState(new Set());
  const [hasAutoExpandedFirst, setHasAutoExpandedFirst] = useState(false);

  // Fee settings query for rate calculation fallback
  const { data: newFeeSettings } = useQuery({
    queryKey: ['newFeeSettings'],
    queryFn: getNewFeeSettings,
    enabled: propLateFeeRatePerDay === undefined,
  });
  const effectiveLateFeeRate = propLateFeeRatePerDay != null
    ? Number(propLateFeeRatePerDay)
    : Number(newFeeSettings?.lateFeeRatePerDay || 0);

  // Fallback Queries if props not passed
  const { data: qAcademicSessions = [] } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: getAcademicSessions,
    enabled: propAcademicSessions.length === 0,
  });

  const { data: qPrograms = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: getPrograms,
    enabled: propPrograms.length === 0,
  });

  const { data: qClasses = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: getClasses,
    enabled: propClasses.length === 0,
  });

  const { data: qSections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: getSections,
    enabled: propSections.length === 0,
  });

  const sessionList = propAcademicSessions.length > 0
    ? propAcademicSessions
    : (Array.isArray(qAcademicSessions) ? qAcademicSessions : qAcademicSessions?.data || []);
  const programsList = propPrograms.length > 0 ? propPrograms : (Array.isArray(qPrograms) ? qPrograms : []);
  const classesList = propClasses.length > 0 ? propClasses : (Array.isArray(qClasses) ? qClasses : []);
  const sectionsList = propSections.length > 0 ? propSections : (Array.isArray(qSections) ? qSections : []);

  // Filtered classes based on selectedPrograms
  const availableClasses = useMemo(() => {
    if (selectedPrograms.length === 0) return classesList;
    return classesList.filter(c => selectedPrograms.includes(extractId(c.programId || c.program)));
  }, [classesList, selectedPrograms]);

  // Section applicability
  const availableSections = useMemo(() => {
    if (selectedClasses.length === 0) {
      if (selectedPrograms.length === 0) return sectionsList;
      const validClassIds = availableClasses.map(c => extractId(c));
      return sectionsList.filter(s => validClassIds.includes(extractId(s.classId || s.class)));
    }
    return sectionsList.filter(s => selectedClasses.includes(extractId(s.classId || s.class)));
  }, [sectionsList, selectedClasses, selectedPrograms, availableClasses]);

  const isSectionApplicable = selectedClasses.length === 0 ? true : availableSections.length > 0;

  // Auto-prune classes when selected programs change
  const handleProgramsChange = (vals) => {
    setSelectedPrograms(vals);
    if (vals.length > 0) {
      const validClassIds = classesList
        .filter(c => vals.includes(extractId(c.programId || c.program)))
        .map(c => extractId(c));
      setSelectedClasses(prev => prev.filter(id => validClassIds.includes(id)));
    }
  };

  // Auto-prune sections when selected classes change
  const handleClassesChange = (vals) => {
    setSelectedClasses(vals);
    if (vals.length > 0) {
      const validSectionIds = sectionsList
        .filter(s => vals.includes(extractId(s.classId || s.class)))
        .map(s => extractId(s));
      setSelectedSections(prev => prev.filter(id => validSectionIds.includes(id)));
    }
  };

  // Main Challans Query: ONLY enabled when program selection is made!
  const programParam = selectedPrograms.length > 0 ? selectedPrograms.join(',') : undefined;
  const classParam = selectedClasses.length > 0 ? selectedClasses.join(',') : undefined;
  const sectionParam = selectedSections.length > 0 ? selectedSections.join(',') : undefined;

  const {
    data: challansResponse,
    isLoading: isChallansLoading,
  } = useQuery({
    queryKey: [
      'feeReportsChallans',
      selectedSession,
      [...selectedPrograms].sort().join(','),
      [...selectedClasses].sort().join(','),
      [...selectedSections].sort().join(','),
      selectedMonth,
    ],
    queryFn: () => getFeeChallans({
      sessionId: selectedSession !== 'all' ? selectedSession : undefined,
      programId: programParam,
      classId: classParam,
      sectionId: sectionParam,
      month: selectedMonth !== 'all' ? selectedMonth : undefined,
      status: 'PENDING,PARTIAL,OVERDUE',
      limit: 10000,
      report: 'true',
    }),
    enabled: selectedPrograms.length > 0,
  });

  // Derived student fee summaries
  const studentReports = useMemo(() => {
    if (!challansResponse) return [];
    const challanItems = Array.isArray(challansResponse)
      ? challansResponse
      : (Array.isArray(challansResponse?.data) ? challansResponse.data : []);

    const studentsMap = new Map();

    for (const raw of challanItems) {
      const c = normalizeChallan(raw);
      if (!c) continue;
      if (['VOID', 'SUPERSEDED', 'SETTLED'].includes(c.status)) continue;

      // Exact late fee fine, arrears, advance and gross totals matching ChallansTab
      const isSettledOrVoid = ['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(c.status);
      const existingFine = Number(c.snapshotLateFee ?? c.lateFeeAmount ?? c.lateFeeFine ?? c.fineAmount ?? 0);
      const effectiveRate = Number(
        c.installment?.lateFeeRatePerDay ??
        c.lateFeeRatePerDay ??
        effectiveLateFeeRate ??
        0
      );
      const autoFine = (!isSettledOrVoid && c.dueDate && effectiveRate > 0)
        ? calculateLateFee(c.dueDate, effectiveRate)
        : 0;
      const effectiveFine = existingFine > 0 ? existingFine : autoFine;

      // Gross total includes baseAmount + headsAmount + arrearsAmount + extraFine + absentiesFine + lateFeeFine - discount
      const grossTotal = getChallanGrossTotal(c);
      const fineIncluded = existingFine > 0 && Number(c.lateFeeAmount || c.snapshotLateFee || 0) > 0;
      const totalAmount = fineIncluded ? grossTotal : (grossTotal + effectiveFine);

      const advanceApplied = Number(c.advanceApplied || c.advanceAmount || 0);
      const directPaid = Number(c.directPaidAmount ?? c.paidAmount ?? 0);
      const settledArrears = Number(c.settledViaArrearsAmount ?? c.settledAmount ?? 0);
      const isSettled = c.status === 'SETTLED';

      const totalPaid = directPaid + advanceApplied + (isSettled ? settledArrears : 0);
      const pendingAmount = isSettled ? 0 : Math.max(0, totalAmount - advanceApplied - directPaid);

      // Challan data: pending challans only
      if (pendingAmount <= 0) continue;

      // Multi-select client-side filtering if multiple programs / classes / sections selected
      if (selectedPrograms.length > 1) {
        const pId = extractId(c.studentProgram || c.student?.programId);
        if (pId && !selectedPrograms.includes(pId)) continue;
      }
      if (selectedClasses.length > 1) {
        const clId = extractId(c.studentClass || c.student?.classId);
        if (clId && !selectedClasses.includes(clId)) continue;
      }
      if (selectedSections.length > 1) {
        const scId = extractId(c.studentSection || c.student?.sectionId);
        if (scId && !selectedSections.includes(scId)) continue;
      }

      const sId = extractId(c.studentId || c.student) || c.rollNumber || c.studentName;
      if (!sId) continue;

      if (!studentsMap.has(sId)) {
        const progName = getName(c.studentProgram || c.student?.programId);
        const clsName = getName(c.studentClass || c.student?.classId);
        const secName = getName(c.studentSection || c.student?.sectionId);
        const pcs = [progName, clsName, secName].filter(Boolean).join(' / ') || '-';

        studentsMap.set(sId, {
          id: sId,
          studentName: c.studentName || 'Unknown Student',
          fatherName: c.fatherName || '-',
          rollNumber: c.rollNumber || '-',
          programName: progName || 'General',
          programClassSection: pcs,
          pendingChallans: [],
          totalPaid: 0,
          totalPending: 0,
          totalAmount: 0,
        });
      }

      const entry = studentsMap.get(sId);
      entry.pendingChallans.push({
        id: c.id || c._id || c.challanNo,
        challanNo: c.challanNo || c.challanNumber || '-',
        month: c.month || '-',
        installmentNumber: c.installmentNumber || '-',
        totalAmount,
        paidAmount: totalPaid,
        pendingAmount,
        status: c.status || 'PENDING',
      });
      entry.totalPaid += totalPaid;
      entry.totalPending += pendingAmount;
      entry.totalAmount += totalAmount;
    }

    let list = Array.from(studentsMap.values());

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s =>
        s.studentName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.fatherName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [challansResponse, searchQuery, effectiveLateFeeRate, selectedPrograms, selectedClasses, selectedSections]);

  // Partition studentReports by Program for grouped display
  const groupedReports = useMemo(() => {
    if (selectedPrograms.length <= 1 && selectedClasses.length === 0) {
      return [{ groupLabel: null, students: studentReports }];
    }
    const groups = {};
    for (const s of studentReports) {
      const key = s.programName || "General";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, students]) => ({ groupLabel: label, students }));
  }, [studentReports, selectedPrograms, selectedClasses]);

  // Auto-expand first student when records first load
  React.useEffect(() => {
    if (!hasAutoExpandedFirst && studentReports.length > 0) {
      setExpandedStudentIds(new Set([studentReports[0].id]));
      setHasAutoExpandedFirst(true);
    }
  }, [studentReports, hasAutoExpandedFirst]);

  const toggleStudent = (id) => {
    setExpandedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Print / Save as PDF handler
  const handlePrint = async () => {
    if (!studentReports || studentReports.length === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no pending fee records to print for the selected filters.",
        variant: "destructive",
      });
      return;
    }

    // 1. Fetch brand logo as Data URL for standalone printing
    let logoDataUrl = "/logo.png";
    try {
      const res = await fetch("/logo.png");
      if (res.ok) {
        const blob = await res.blob();
        logoDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(`${window.location.origin}/logo.png`);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      logoDataUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/logo.png";
    }

    const sessionObj = sessionList.find(s => extractId(s) === selectedSession);
    const sessionName = sessionObj?.name || sessionObj?.sessionName || (selectedSession === 'all' ? 'All Sessions' : 'Selected Session');
    const programName = selectedPrograms.length === 0
      ? 'All Programs'
      : selectedPrograms.map(id => programsList.find(p => extractId(p) === id)?.name || id).join(', ');
    const className = selectedClasses.length === 0
      ? 'All Classes'
      : selectedClasses.map(id => classesList.find(c => extractId(c) === id)?.name || id).join(', ');
    const sectionName = selectedSections.length === 0
      ? 'All Sections'
      : selectedSections.map(id => sectionsList.find(s => extractId(s) === id)?.name || id).join(', ');
    const monthName = selectedMonth === 'all' ? 'All Months' : selectedMonth;
    const exportDate = format(new Date(), "dd MMMM yyyy, hh:mm a");

    const overallTotalPending = studentReports.reduce((s, r) => s + r.totalPending, 0);
    const overallTotalPaid = studentReports.reduce((s, r) => s + r.totalPaid, 0);
    const overallTotalAmount = studentReports.reduce((s, r) => s + r.totalAmount, 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Student Fee Dues & Pending Challans Report</title>
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
              color: #1e293b;
              background: #ffffff;
              margin: 0;
              padding: 10px;
              font-size: 10.5px;
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
              height: 52px;
              width: auto;
              max-width: 120px;
              object-fit: contain;
              display: block;
            }
            .header-title-block h1 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #0f172a;
            }
            .header-title-block .tagline {
              font-size: 9.5px;
              font-weight: 600;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.5px;
              margin-top: 2px;
            }
            .meta-box {
              font-size: 10px;
              color: #64748b;
              line-height: 1.4;
              text-align: right;
            }
            .meta-box strong {
              color: #0f172a;
            }
            /* CENTERED CALLIGRAPHY TITLE FOR REPORT NAME */
            .center-calligraphy-title {
              text-align: center;
              font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Brush Script MT', 'Lucida Calligraphy', 'Segoe Script', cursive, serif;
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
              padding: 5px 12px;
              margin-bottom: 10px;
              display: flex;
              flex-wrap: wrap;
              gap: 14px;
              font-size: 10px;
            }
            .filter-item strong {
              color: #334155;
            }
            .filter-item span {
              color: #0f172a;
              font-weight: 600;
            }
            .table-summary-bar {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-bottom: none;
              border-radius: 4px 4px 0 0;
              padding: 6px 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 12px;
              font-size: 10.5px;
              color: #334155;
            }
            .table-summary-bar .summary-item strong {
              color: #0f172a;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            thead th {
              background: #f1f5f9;
              color: #0f172a;
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              padding: 7px 8px;
              text-align: left;
              border: 1px solid #cbd5e1;
            }
            td {
              padding: 6px 8px;
              font-size: 10.5px;
              border: 1px solid #e2e8f0;
            }
            .student-row {
              background: #ffffff;
              font-weight: 600;
            }
            .student-row:nth-child(4n+1) {
              background-color: #fafafa;
            }
            .text-right { text-align: right; }
            .badge-pending {
              color: #991b1b;
              font-weight: 700;
              background: #fef2f2;
              border: 1px solid #fecaca;
              padding: 2px 7px;
              border-radius: 4px;
              display: inline-block;
              font-size: 10px;
            }
            .badge-status {
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .status-pending { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
            .status-partial { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
            .subtable-wrapper {
              padding: 6px 10px 10px 24px;
              background: #fafafa;
              border: 1px solid #e2e8f0;
              border-top: none;
            }
            .subtable {
              width: 100%;
              border: 1px solid #cbd5e1;
              border-radius: 3px;
            }
            .subtable th {
              background: #f1f5f9;
              color: #334155;
              font-size: 9px;
              font-weight: 700;
              padding: 4px 6px;
              border: 1px solid #cbd5e1;
            }
            .subtable td {
              padding: 4px 6px;
              font-size: 9.5px;
              border: 1px solid #e2e8f0;
              background: #ffffff;
            }
            tfoot tr.grand-total-row {
              background: #f1f5f9;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              font-weight: 700;
            }
            tfoot td {
              padding: 7px 8px;
              font-size: 10.5px;
              border: 1px solid #cbd5e1;
              color: #0f172a;
            }
            .footer-sign {
              display: flex;
              justify-content: space-between;
              margin-top: 25px;
              padding-top: 15px;
              border-top: 1.5px solid #0f172a;
              font-size: 10px;
              color: #475569;
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <!-- BRAND HEADER -->
            <div class="form-header">
              <div class="header-logo-area">
                <img src="${logoDataUrl}" class="brand-logo" alt="Concordia College Peshawar Logo" />
                <div class="header-title-block">
                  <h1>Concordia College Peshawar</h1>
                  <div class="tagline">A Project of Beaconhouse</div>
                </div>
              </div>
              <div class="meta-box">
                <div><strong>Generated:</strong> ${exportDate}</div>
                <div><strong>Total Students with Dues:</strong> ${studentReports.length}</div>
              </div>
            </div>

            <!-- CENTERED CALLIGRAPHY REPORT TITLE -->
            <div class="center-calligraphy-title">
              Student Fee Dues &amp; Pending Challans Report
            </div>

            <div class="filters-bar">
              <div class="filter-item"><strong>Session:</strong> <span>${sessionName}</span></div>
              <div class="filter-item"><strong>Program:</strong> <span>${programName}</span></div>
              <div class="filter-item"><strong>Class:</strong> <span>${className}</span></div>
              <div class="filter-item"><strong>Section:</strong> <span>${sectionName}</span></div>
              <div class="filter-item"><strong>Month:</strong> <span>${monthName}</span></div>
            </div>

            <!-- TOP TABLE SUMMARY ROW (INTEGRATED METRICS BAR) -->
            <div class="table-summary-bar">
              <div class="summary-item">Students with Dues: <strong>${studentReports.length}</strong></div>
              <div class="summary-item">Total Billed: <strong>PKR ${overallTotalAmount.toLocaleString()}</strong></div>
              <div class="summary-item">Total Paid: <strong>PKR ${overallTotalPaid.toLocaleString()}</strong></div>
              <div class="summary-item">Total Pending: <strong>PKR ${overallTotalPending.toLocaleString()}</strong></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 30px;">#</th>
                  <th>Student</th>
                  <th>Father Name</th>
                  <th>Roll No.</th>
                  <th>Program / Class / Section</th>
                  <th class="text-right">Total Paid</th>
                  <th class="text-right">Total Pending</th>
                </tr>
              </thead>
              <tbody>
                ${groupedReports.map((group) => {
                  const groupHeaderHtml = group.groupLabel ? `
                    <tr style="background: #f1f5f9; break-inside: avoid;">
                      <td colspan="7" style="padding: 8px 10px; font-weight: 700; font-size: 11px; color: #0f172a; border-bottom: 2px solid #cbd5e1; text-align: left;">
                        ${group.groupLabel}
                        <span style="font-weight: 400; font-size: 9px; color: #64748b; margin-left: 8px;">(${group.students.length} ${group.students.length === 1 ? 'student with dues' : 'students with dues'})</span>
                      </td>
                    </tr>
                  ` : '';

                  const rowsHtml = group.students.map((s, idx) => `
                    <tr class="student-row no-break">
                      <td>${idx + 1}</td>
                      <td>${s.studentName}</td>
                      <td>${s.fatherName}</td>
                      <td>${s.rollNumber}</td>
                      <td>${s.programClassSection}</td>
                      <td class="text-right">PKR ${s.totalPaid.toLocaleString()}</td>
                      <td class="text-right"><span class="badge-pending">PKR ${s.totalPending.toLocaleString()}</span></td>
                    </tr>
                    <tr class="no-break">
                      <td colspan="7" style="padding: 0;">
                        <div class="subtable-wrapper">
                          <table class="subtable">
                            <thead>
                              <tr>
                                <th>Challan No.</th>
                                <th>Month</th>
                                <th>Installment #</th>
                                <th class="text-right">Total Amount</th>
                                <th class="text-right">Paid</th>
                                <th class="text-right">Pending</th>
                                <th style="text-align: center;">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${s.pendingChallans.map(c => `
                                <tr>
                                  <td>#${c.challanNo}</td>
                                  <td>${c.month}</td>
                                  <td>${c.installmentNumber}</td>
                                  <td class="text-right">PKR ${c.totalAmount.toLocaleString()}</td>
                                  <td class="text-right">PKR ${c.paidAmount.toLocaleString()}</td>
                                  <td class="text-right" style="color: #991b1b; font-weight: 600;">PKR ${c.pendingAmount.toLocaleString()}</td>
                                  <td style="text-align: center;">
                                    <span class="badge-status ${c.status === 'PARTIAL' ? 'status-partial' : 'status-pending'}">
                                      ${c.status}
                                    </span>
                                  </td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  `).join('');

                  return groupHeaderHtml + rowsHtml;
                }).join('')}
              </tbody>
              <tfoot>
                <tr class="grand-total-row no-break">
                  <td colspan="5" style="text-align: right; font-weight: 700;">TOTAL (${studentReports.length} Students):</td>
                  <td class="text-right" style="font-weight: 700;">PKR ${overallTotalPaid.toLocaleString()}</td>
                  <td class="text-right" style="font-weight: 700; color: #991b1b;">PKR ${overallTotalPending.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            <div class="footer-sign no-break">
              <div><strong>Prepared By:</strong> _____________________</div>
              <div><strong>Checked By:</strong> _____________________</div>
              <div><strong>Accounts Officer:</strong> _____________________</div>
              <div><strong>Principal / Director:</strong> _____________________</div>
            </div>
          </div>
        </body>
      </html>
    `;

    await openManagedPrintWindow({
      html,
      title: "Fee Report - Pending Challans",
      toast,
    });
  };

  const handleExportExcel = () => {
    if (!studentReports || studentReports.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no pending fee records to export for the selected filters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // 1. Summary Sheet: One row per student
      const summaryRows = studentReports.map((s, idx) => ({
        "S.No": idx + 1,
        "Student Name": s.studentName,
        "Father Name": s.fatherName,
        "Roll Number": s.rollNumber,
        "Program / Class / Section": s.programClassSection,
        "Pending Challans": s.pendingChallans.length,
        "Total Billed (PKR)": s.totalAmount,
        "Total Paid (PKR)": s.totalPaid,
        "Total Pending (PKR)": s.totalPending,
      }));

      const overallTotalAmount = studentReports.reduce((sum, r) => sum + r.totalAmount, 0);
      const overallTotalPaid = studentReports.reduce((sum, r) => sum + r.totalPaid, 0);
      const overallTotalPending = studentReports.reduce((sum, r) => sum + r.totalPending, 0);
      const totalChallansCount = studentReports.reduce((sum, r) => sum + r.pendingChallans.length, 0);

      summaryRows.push({
        "S.No": "TOTAL",
        "Student Name": `${studentReports.length} Students`,
        "Father Name": "",
        "Roll Number": "",
        "Program / Class / Section": "",
        "Pending Challans": totalChallansCount,
        "Total Billed (PKR)": overallTotalAmount,
        "Total Paid (PKR)": overallTotalPaid,
        "Total Pending (PKR)": overallTotalPending,
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary["!cols"] = [
        { wch: 8 },
        { wch: 24 },
        { wch: 22 },
        { wch: 16 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Student Summary");

      // 2. Itemized Sheet: One row per pending challan
      const itemizedRows = [];
      let itemIdx = 1;
      for (const s of studentReports) {
        for (const c of s.pendingChallans) {
          itemizedRows.push({
            "S.No": itemIdx++,
            "Student Name": s.studentName,
            "Father Name": s.fatherName,
            "Roll Number": s.rollNumber,
            "Program / Class / Section": s.programClassSection,
            "Challan No": c.challanNo,
            "Month": c.month,
            "Installment #": c.installmentNumber,
            "Total Amount (PKR)": c.totalAmount,
            "Paid Amount (PKR)": c.paidAmount,
            "Pending Amount (PKR)": c.pendingAmount,
            "Status": c.status,
          });
        }
      }

      if (itemizedRows.length > 0) {
        itemizedRows.push({
          "S.No": "TOTAL",
          "Student Name": `${studentReports.length} Students`,
          "Father Name": "",
          "Roll Number": "",
          "Program / Class / Section": "",
          "Challan No": `${totalChallansCount} Challans`,
          "Month": "",
          "Installment #": "",
          "Total Amount (PKR)": overallTotalAmount,
          "Paid Amount (PKR)": overallTotalPaid,
          "Pending Amount (PKR)": overallTotalPending,
          "Status": "",
        });

        const wsItemized = XLSX.utils.json_to_sheet(itemizedRows);
        wsItemized["!cols"] = [
          { wch: 8 },
          { wch: 24 },
          { wch: 22 },
          { wch: 16 },
          { wch: 30 },
          { wch: 16 },
          { wch: 14 },
          { wch: 14 },
          { wch: 18 },
          { wch: 18 },
          { wch: 18 },
          { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, wsItemized, "Pending Challans");
      }

      const dateStr = format(new Date(), "yyyy-MM-dd");
      XLSX.writeFile(wb, `Fee_Pending_Report_${dateStr}.xlsx`);
      toast({
        title: "Export Successful",
        description: `Exported ${studentReports.length} student records to Excel.`,
      });
    } catch (err) {
      console.error("Excel export error:", err);
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel file.",
        variant: "destructive",
      });
    }
  };

  // Existing Chart Queries & State
  const [reportFilter, setReportFilter] = useState('month');
  const [reportSessionFilter, setReportSessionFilter] = useState('all');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');

  const { data: revenueData = [] } = useQuery({
    queryKey: ['revenueOverTime', reportFilter],
    queryFn: () => getRevenueOverTime({ period: reportFilter }),
  });

  const { data: classCollectionData = [] } = useQuery({
    queryKey: ['classCollectionStats', reportFilter],
    queryFn: () => getClassCollectionStats({ period: reportFilter }),
  });

  const { data: newRevenueOverTime = [] } = useQuery({
    queryKey: ['newRevenueOverTime', reportSessionFilter],
    queryFn: () => getNewRevenueOverTime(reportSessionFilter),
  });

  const { data: newClassStats = [] } = useQuery({
    queryKey: ['newClassStats', reportSessionFilter],
    queryFn: () => getNewClassStats(reportSessionFilter),
  });

  const { data: newFeeAnalytics } = useQuery({
    queryKey: ['newFeeAnalytics', reportSessionFilter, reportTypeFilter, reportDateFrom, reportDateTo, reportFilter],
    queryFn: () =>
      getNewFeeReportsAnalytics({
        sessionId: reportSessionFilter,
        type: reportTypeFilter,
        dateFrom: reportDateFrom || undefined,
        dateTo: reportDateTo || undefined,
        groupBy: reportFilter === 'daily' ? 'day' : reportFilter === 'weekly' ? 'week' : reportFilter === 'year' ? 'year' : 'month',
      }),
    retry: 0,
  });

  const getClassChartLabel = (row = {}) => {
    const parts = [row.programName, row.className || row.name].filter(Boolean);
    return parts.length ? parts.join(" / ") : row.name || row.className || "-";
  };

  const rawTimeline = Array.isArray(newFeeAnalytics?.timeline) && newFeeAnalytics.timeline.length > 0
    ? newFeeAnalytics.timeline
    : Array.isArray(newRevenueOverTime) && newRevenueOverTime.length > 0
    ? newRevenueOverTime
    : Array.isArray(revenueData) && revenueData.length > 0
    ? revenueData
    : [];
  const timelineData = rawTimeline;

  const rawChartData = Array.isArray(newFeeAnalytics?.classComparison) && newFeeAnalytics.classComparison.length > 0
    ? newFeeAnalytics.classComparison
    : Array.isArray(newClassStats) && newClassStats.length > 0
    ? newClassStats
    : Array.isArray(classCollectionData) && classCollectionData.length > 0
    ? classCollectionData
    : [];
  const chartData = rawChartData.map((row) => ({
    ...row,
    name: getClassChartLabel(row),
  }));

  return (
    <div className="space-y-6">
      {/* ── Pending Challan Dues & Student Fee Report ── */}
      <Card className="border border-border/70 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-start justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Student Pending Fee Reports
            </CardTitle>
            <CardDescription>
              View student fee summaries and click any row to reveal itemized pending challans
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {studentReports.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="gap-1.5 h-9 text-xs font-medium text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Export to Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-1.5 h-9 text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save as PDF
                </Button>
              </>
            )}
            {(selectedPrograms.length > 0 || selectedSession !== "all" || selectedClasses.length > 0 || selectedSections.length > 0 || selectedMonth !== "all" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPrograms([]);
                  setSelectedClasses([]);
                  setSelectedSections([]);
                  setSelectedSession("all");
                  setSelectedMonth("all");
                  setSearchQuery("");
                  setExpandedStudentIds(new Set());
                }}
                className="h-9 px-2.5 text-xs text-muted-foreground gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters Bar Matching Requested Structure */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end bg-muted/20 p-3 rounded-lg border border-border/50">
            {/* Academic Session */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Academic Session
              </Label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {sessionList.map(s => {
                    const val = extractId(s);
                    return (
                      <SelectItem key={val || Math.random()} value={val}>
                        {s.name || s.sessionName || "Session"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Program */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Program <span className="text-primary font-bold">*</span>
              </Label>
              <MultiSelectFilter
                options={programsList.map(p => ({ value: extractId(p), label: p.name || p.programName || p.title }))}
                selected={selectedPrograms}
                onChange={handleProgramsChange}
                placeholder="Select Programs..."
                allLabel="All Programs"
                defaultSelectedAll={false}
                triggerClassName={`h-9 text-xs ${selectedPrograms.length === 0 ? "border-amber-400/80 bg-amber-50/30 dark:bg-amber-950/20" : ""}`}
              />
            </div>

            {/* Class */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Class
              </Label>
              <MultiSelectFilter
                options={availableClasses.map(c => ({ value: extractId(c), label: c.name || c.className }))}
                selected={selectedClasses}
                onChange={handleClassesChange}
                placeholder="Classes"
                allLabel="All Classes"
                disabled={selectedPrograms.length === 0}
                triggerClassName="h-9 text-xs"
              />
            </div>

            {/* Section (if applicable) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Section {!isSectionApplicable ? "(N/A)" : ""}
              </Label>
              <MultiSelectFilter
                options={availableSections.map(s => ({ value: extractId(s), label: s.name || s.sectionName }))}
                selected={selectedSections}
                onChange={setSelectedSections}
                placeholder="Sections"
                allLabel="All Sections"
                disabled={!isSectionApplicable || availableSections.length === 0 || selectedPrograms.length === 0}
                triggerClassName="h-9 text-xs"
              />
            </div>

            {/* Month */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Month
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={selectedPrograms.length === 0}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTH_NAMES.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Search
              </Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name or roll no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs"
                  disabled={selectedPrograms.length === 0}
                />
              </div>
            </div>
          </div>

          {/* Content Body */}
          {selectedPrograms.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Select a Program to View Reports</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Choose one or more programs from the filter dropdown above (or click <strong>"All"</strong>) to load student fee dues and pending challans.
                </p>
              </div>
            </div>
          ) : isChallansLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading pending fee records...</p>
            </div>
          ) : studentReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <h3 className="font-semibold text-sm">No Pending Challans Found</h3>
              <p className="text-xs text-muted-foreground">
                No students with pending fee dues match the selected filters.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <Table className="w-full text-xs">
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground w-12">#</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Student</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Father Name</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Roll No.</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Program / Class / Section</TableHead>
                      <TableHead className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">Total Paid</TableHead>
                      <TableHead className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">Total Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedReports.map((group, gIdx) => (
                      <React.Fragment key={group.groupLabel || gIdx}>
                        {group.groupLabel && (
                          <TableRow className="bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-100/90 border-y border-border">
                            <TableCell colSpan={7} className="py-2 px-3 text-left">
                              <span className="text-xs font-bold text-foreground tracking-wide">
                                {group.groupLabel}
                              </span>
                              <span className="text-[11px] text-muted-foreground ml-2 font-normal">
                                ({group.students.length} {group.students.length === 1 ? "student with dues" : "students with dues"})
                              </span>
                            </TableCell>
                          </TableRow>
                        )}
                        {group.students.map((student, idx) => {
                          const isExpanded = expandedStudentIds.has(student.id);
                          return (
                            <React.Fragment key={student.id}>
                              <TableRow
                                onClick={() => toggleStudent(student.id)}
                                className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                                  isExpanded ? "bg-muted/20" : ""
                                }`}
                              >
                                <TableCell className="py-3 px-3">
                                  <div className="flex items-center gap-1.5 font-medium">
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-primary" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                    )}
                                    <span>{idx + 1}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 px-3 font-semibold text-foreground">
                                  {student.studentName}
                                </TableCell>
                                <TableCell className="py-3 px-3 text-muted-foreground">
                                  {student.fatherName}
                                </TableCell>
                                <TableCell className="py-3 px-3 font-mono text-xs text-foreground">
                                  {student.rollNumber}
                                </TableCell>
                                <TableCell className="py-3 px-3 text-muted-foreground">
                                  {student.programClassSection}
                                </TableCell>
                                <TableCell className="py-3 px-4 text-right font-medium text-foreground">
                                  PKR {student.totalPaid.toLocaleString()}
                                </TableCell>
                                <TableCell className="py-3 px-4 text-right">
                                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                                    PKR {student.totalPending.toLocaleString()}
                                  </span>
                                </TableCell>
                              </TableRow>

                              {/* Expanded Challans Row (Flat, matching app theme, no floating box or shadow) */}
                              {isExpanded && (
                                <TableRow className="bg-muted/15 hover:bg-muted/15 border-b border-border/60">
                                  <TableCell colSpan={7} className="p-0">
                                    <div className="py-2.5 px-4 pl-10 border-t border-dashed border-border/60">
                                      <div className="overflow-x-auto">
                                        <Table className="w-full text-xs">
                                          <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                                              <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">Challan No.</TableHead>
                                              <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">Month</TableHead>
                                              <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">Installment #</TableHead>
                                              <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground text-right">Total Amount</TableHead>
                                              <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground text-right">Paid</TableHead>
                                              <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground text-right">Pending</TableHead>
                                              <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground text-center">Status</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {student.pendingChallans.map((c) => (
                                              <TableRow key={c.id || c.challanNo} className="hover:bg-muted/25 border-b border-border/30">
                                                <TableCell className="py-2 px-3 font-mono font-medium text-foreground">
                                                  #{c.challanNo}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-muted-foreground">
                                                  {c.month}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-muted-foreground">
                                                  {c.installmentNumber}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-right font-medium text-foreground">
                                                  PKR {c.totalAmount.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-right text-muted-foreground">
                                                  PKR {c.paidAmount.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-right text-rose-600 font-semibold">
                                                  PKR {c.pendingAmount.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-center">
                                                  <span
                                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                                      c.status === "PARTIAL"
                                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                                    }`}
                                                  >
                                                    {c.status}
                                                  </span>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Fee Analytics & Charts ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold text-foreground">Revenue & Collection Analytics</h2>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 gap-1.5 text-xs ${
                  reportSessionFilter !== "all" || reportFilter !== "month" || reportTypeFilter !== "all" || reportDateFrom || reportDateTo
                    ? "border-primary text-primary"
                    : ""
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Chart Filters
                {(reportSessionFilter !== "all" || reportFilter !== "month" || reportTypeFilter !== "all" || reportDateFrom || reportDateTo) && (
                  <span className="ml-0.5 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                    {[reportSessionFilter !== "all" ? 1 : 0, reportFilter !== "month" ? 1 : 0, reportTypeFilter !== "all" ? 1 : 0, (reportDateFrom || reportDateTo) ? 1 : 0].reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-4 max-h-[80vh] overflow-y-auto" align="end" side="bottom" sideOffset={4}>
              <div className="space-y-4">
                <p className="text-sm font-semibold">Chart Filters</p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">From</Label>
                      <Input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">To</Label>
                      <Input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Session</Label>
                  <Select value={reportSessionFilter} onValueChange={setReportSessionFilter}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All Sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      {sessionList.map(s => {
                        const val = extractId(s);
                        return (
                          <SelectItem key={val || Math.random()} value={val}>{s.name || s.sessionName}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Period</Label>
                  <Select value={reportFilter} onValueChange={setReportFilter}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily (Last 30 Days)</SelectItem>
                      <SelectItem value="weekly">Weekly (Last 12 Weeks)</SelectItem>
                      <SelectItem value="month">Monthly (Last 12 Months)</SelectItem>
                      <SelectItem value="year">Yearly (Last 5 Years)</SelectItem>
                      <SelectItem value="overall">Overall</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fee Type</Label>
                  <div className="space-y-1">
                    {[
                      { value: "all", label: "All (Installment + Extra)" },
                      { value: "installment", label: "Installment Fee Only" },
                      { value: "extra", label: "Extra Challans Only" },
                    ].map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="reportType"
                          className="h-3.5 w-3.5 accent-primary"
                          checked={reportTypeFilter === value}
                          onChange={() => setReportTypeFilter(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-muted-foreground text-xs"
                  onClick={() => { setReportSessionFilter("all"); setReportFilter("month"); setReportTypeFilter("all"); setReportDateFrom(""); setReportDateTo(""); }}
                >
                  <X className="w-3 h-3 mr-1" /> Reset filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Revenue Over Time */}
          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue Over Time</CardTitle>
              <p className="text-xs text-muted-foreground">Last 24 months — installment fee vs extra challans</p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timelineData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                  >
                    <defs>
                      <linearGradient id="colorInst" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExtra" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      tickFormatter={(v) => {
                        if (!v || typeof v !== 'string' || !v.includes('-')) return v || '';
                        const [yr, mo] = v.split('-');
                        const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo, 10) - 1];
                        return monthShort ? `${monthShort} ${yr.slice(2)}` : v;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                      width={45}
                    />
                    <RechartsTooltip content={<ModernTooltip valueFormatter={(v) => `PKR ${Number(v || 0).toLocaleString()}`} />} />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      formatter={(v) => v === 'installment' ? 'Installment Fee' : v === 'extra' ? 'Extra Challans' : 'Total'}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    {(timelineData[0]?.installment !== undefined) ? (
                      <>
                        <Area type="monotone" dataKey="installment" name="installment" stroke="#6366f1" strokeWidth={2} fill="url(#colorInst)" dot={false} activeDot={{ r: 4 }} />
                        <Area type="monotone" dataKey="extra" name="extra" stroke="#f59e0b" strokeWidth={2} fill="url(#colorExtra)" dot={false} activeDot={{ r: 4 }} />
                      </>
                    ) : (
                      <Area type="monotone" dataKey="value" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#colorInst)" dot={false} activeDot={{ r: 4 }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Collection vs Outstanding Per Class */}
          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Collection vs Outstanding (Per Class)</CardTitle>
              <p className="text-xs text-muted-foreground">Collected amount vs pending outstanding per class</p>
            </CardHeader>
            <CardContent>
              {(() => {
                if (!chartData || chartData.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                      No class data available
                    </div>
                  );
                }
                const barH = Math.max(28, Math.min(40, 320 / chartData.length));
                const chartH = Math.max(320, chartData.length * (barH + 12) + 60);
                return (
                  <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
                    <div style={{ height: chartH }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={chartData}
                          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                          barCategoryGap="20%"
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={120}
                            tick={{ fontSize: 11 }}
                            interval={0}
                          />
                          <RechartsTooltip
                            formatter={(value, name) => [`PKR ${Number(value).toLocaleString()}`, name === 'collected' ? 'Collected' : 'Outstanding']}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                          />
                          <Legend
                            verticalAlign="top"
                            height={28}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                          <Bar dataKey="collected" name="Collected" fill="#4ade80" radius={[0, 4, 4, 0]} barSize={barH * 0.45} />
                          <Bar dataKey="outstanding" name="Outstanding" fill="#fb923c" radius={[0, 4, 4, 0]} barSize={barH * 0.45} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
