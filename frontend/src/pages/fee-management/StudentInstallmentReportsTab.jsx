import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  CalendarRange,
  Search,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  Users,
  Coins,
  Calendar,
  Layers,
  ChevronUp,
  X,
  ListFilter,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getInstallmentPlans } from "@/services/api";

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

const formatDueDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, "dd MMM yyyy");
  } catch {
    return String(dateStr);
  }
};

const getStatusBadge = (status) => {
  const s = (status || "PENDING").toUpperCase();
  if (s === "PAID") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
        PAID
      </span>
    );
  }
  if (s === "SETTLED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">
        SETTLED
      </span>
    );
  }
  if (s === "PARTIAL") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
        PARTIAL
      </span>
    );
  }
  if (s === "OVERDUE") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800">
        OVERDUE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
      PENDING
    </span>
  );
};

export const StudentInstallmentReportsTab = ({
  academicSessions = [],
  programs = [],
  classes = [],
  sections = [],
  onBack,
}) => {
  const { toast } = useToast();

  // Filter States
  const [selectedSession, setSelectedSession] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // UI View States
  const [viewMode, setViewMode] = useState("grouped"); // "grouped" | "flat"
  const [expandedStudentIds, setExpandedStudentIds] = useState(new Set());
  const [hasAutoExpandedFirst, setHasAutoExpandedFirst] = useState(false);

  // Debounce student search input
  const searchTimeoutRef = useRef(null);
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Classes cascaded from selectedProgram
  const availableClasses = useMemo(() => {
    if (!selectedProgram || selectedProgram === "all") return classes;
    return classes.filter(
      (c) => extractId(c.programId || c.program) === selectedProgram
    );
  }, [classes, selectedProgram]);

  // Sections cascaded from selectedClass
  const availableSections = useMemo(() => {
    if (!selectedClass || selectedClass === "all") {
      if (!selectedProgram || selectedProgram === "all") return sections;
      const validClassIds = availableClasses.map((c) => extractId(c));
      return sections.filter((s) =>
        validClassIds.includes(extractId(s.classId || s.class))
      );
    }
    return sections.filter(
      (s) => extractId(s.classId || s.class) === selectedClass
    );
  }, [sections, selectedClass, selectedProgram, availableClasses]);

  // Whether sections are applicable for current selection
  const isSectionApplicable = useMemo(() => {
    if (selectedClass === "all") return true;
    const selectedClassObj = classes.find(
      (c) => extractId(c) === selectedClass
    );
    if (selectedClassObj && selectedClassObj.allowSections === false) {
      return false;
    }
    return availableSections.length > 0;
  }, [selectedClass, classes, availableSections]);

  // Cascading change handlers
  const handleProgramChange = (progId) => {
    setSelectedProgram(progId);
    if (progId !== "all") {
      const validClassIds = classes
        .filter((c) => extractId(c.programId || c.program) === progId)
        .map((c) => extractId(c));
      if (!validClassIds.includes(selectedClass)) {
        setSelectedClass("all");
        setSelectedSection("all");
      }
    } else {
      setSelectedClass("all");
      setSelectedSection("all");
    }
  };

  const handleClassChange = (clsId) => {
    setSelectedClass(clsId);
    if (clsId !== "all") {
      const validSectionIds = sections
        .filter((s) => extractId(s.classId || s.class) === clsId)
        .map((s) => extractId(s));
      if (!validSectionIds.includes(selectedSection)) {
        setSelectedSection("all");
      }
    } else {
      setSelectedSection("all");
    }
  };

  const handleResetFilters = () => {
    setSelectedSession("all");
    setSelectedProgram("all");
    setSelectedClass("all");
    setSelectedSection("all");
    setSelectedMonth("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setExpandedStudentIds(new Set());
  };

  // Determine if query is enabled:
  // Requires either a program selected OR a search query typed (minimum 2 chars)
  const isFilterActive =
    (selectedProgram && selectedProgram !== "all") ||
    (debouncedSearch && debouncedSearch.length >= 2);

  const {
    data: rawStudentsData = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "installmentPlansReport",
      selectedSession,
      selectedProgram,
      selectedClass,
      selectedSection,
      debouncedSearch,
    ],
    queryFn: async () => {
      const filters = {
        sessionId: selectedSession !== "all" ? selectedSession : undefined,
        programId: selectedProgram !== "all" ? selectedProgram : undefined,
        classId: selectedClass !== "all" ? selectedClass : undefined,
        sectionId: selectedSection !== "all" ? selectedSection : undefined,
        searchQuery: debouncedSearch || undefined,
        status: "all",
      };
      const res = await getInstallmentPlans(filters);
      return Array.isArray(res) ? res : res?.data || res?.students || [];
    },
    enabled: Boolean(isFilterActive),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Normalize student and installment data
  const processedStudents = useMemo(() => {
    if (!rawStudentsData || rawStudentsData.length === 0) return [];

    return rawStudentsData.map((s) => {
      const sId = extractId(s) || s.rollNumber || "";
      const fullName = s.fName
        ? `${s.fName} ${s.lName || ""}`.trim()
        : s.name || s.studentName || "Unknown Student";
      const fatherName = s.fatherOrguardian || s.fatherName || "-";
      const rollNumber = (s.rollNumber ?? "").toString() || "-";

      const progName =
        getName(s.program) ||
        programs.find((p) => extractId(p) === extractId(s.programId))?.name ||
        "-";
      const clsName =
        getName(s.class) ||
        classes.find((c) => extractId(c) === extractId(s.classId))?.name ||
        "-";
      const secName =
        getName(s.section) ||
        sections.find((sec) => extractId(sec) === extractId(s.sectionId))?.name ||
        "";

      const pcs = [progName, clsName, secName].filter(Boolean).join(" / ");

      // Get raw installments
      let rawInsts = s.installments || s.feeInstallments || [];
      if (!Array.isArray(rawInsts)) rawInsts = [];

      // Map installments
      let mappedInsts = rawInsts.map((inst, idx) => {
        const instNo = inst.installmentNumber || idx + 1;
        const monthName = inst.month || "-";
        const dueDate = inst.dueDate;
        const amount = Number(inst.amount ?? inst.basePayable ?? inst.totalAmount ?? 0);
        const paidAmount = Number(inst.paidAmount ?? 0);
        const pendingAmount = Number(
          inst.pendingAmount ?? Math.max(0, amount - paidAmount)
        );
        const status = (inst.status || "PENDING").toUpperCase();

        return {
          id: inst._id || inst.id || `${sId}-inst-${instNo}`,
          installmentNumber: instNo,
          month: monthName,
          dueDate,
          formattedDueDate: formatDueDate(dueDate),
          amount,
          paidAmount,
          pendingAmount,
          status,
          challanGenerated: Boolean(inst.challanGenerated || (inst.challans && inst.challans.length > 0)),
          challans: inst.challans || [],
        };
      });

      // Sort by installment number
      mappedInsts.sort((a, b) => a.installmentNumber - b.installmentNumber);

      // Apply month filter if selected
      const displayInsts =
        selectedMonth === "all"
          ? mappedInsts
          : mappedInsts.filter(
              (inst) =>
                (inst.month || "").toLowerCase() === selectedMonth.toLowerCase()
            );

      const totalFee = mappedInsts.reduce((sum, inst) => sum + inst.amount, 0);
      const totalPaid = mappedInsts.reduce((sum, inst) => sum + inst.paidAmount, 0);
      const totalPending = mappedInsts.reduce(
        (sum, inst) => sum + inst.pendingAmount,
        0
      );

      return {
        id: sId,
        studentName: fullName,
        fatherName,
        rollNumber,
        programName: progName,
        className: clsName,
        sectionName: secName,
        programClassSection: pcs,
        allInstallments: mappedInsts,
        displayInstallments: displayInsts,
        totalInstallmentsCount: mappedInsts.length,
        totalFee,
        totalPaid,
        totalPending,
      };
    });
  }, [
    rawStudentsData,
    programs,
    classes,
    sections,
    selectedMonth,
  ]);

  // Filter students if month filter is active and student has no matching installments
  const filteredStudents = useMemo(() => {
    if (selectedMonth === "all") return processedStudents;
    return processedStudents.filter(
      (s) => s.displayInstallments.length > 0
    );
  }, [processedStudents, selectedMonth]);

  // Auto-expand first student when records first load
  useEffect(() => {
    if (!hasAutoExpandedFirst && filteredStudents.length > 0) {
      setExpandedStudentIds(new Set([filteredStudents[0].id]));
      setHasAutoExpandedFirst(true);
    }
  }, [filteredStudents, hasAutoExpandedFirst]);

  const toggleStudent = (id) => {
    setExpandedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandedStudentIds.size === filteredStudents.length) {
      setExpandedStudentIds(new Set());
    } else {
      setExpandedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  // Summary Metrics calculations
  const summaryMetrics = useMemo(() => {
    const totalStudents = filteredStudents.length;
    let totalInstallments = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let totalPending = 0;

    for (const s of filteredStudents) {
      const instsToCount =
        selectedMonth === "all" ? s.allInstallments : s.displayInstallments;
      totalInstallments += instsToCount.length;
      totalAmount += instsToCount.reduce((acc, i) => acc + i.amount, 0);
      totalPaid += instsToCount.reduce((acc, i) => acc + i.paidAmount, 0);
      totalPending += instsToCount.reduce((acc, i) => acc + i.pendingAmount, 0);
    }

    return {
      totalStudents,
      totalInstallments,
      totalAmount,
      totalPaid,
      totalPending,
    };
  }, [filteredStudents, selectedMonth]);

  // Print / Save as PDF Handler
  const handlePrint = async () => {
    if (filteredStudents.length === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no student installment records matching the filters.",
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
      logoDataUrl =
        (typeof window !== "undefined" ? window.location.origin : "") +
        "/logo.png";
    }

    const sessionObj = academicSessions.find(
      (s) => extractId(s) === selectedSession
    );
    const sessionName =
      sessionObj?.name ||
      sessionObj?.sessionName ||
      (selectedSession === "all" ? "All Sessions" : "Selected Session");
    const programName =
      selectedProgram === "all"
        ? "All Programs"
        : programs.find((p) => extractId(p) === selectedProgram)?.name ||
          selectedProgram;
    const className =
      selectedClass === "all"
        ? "All Classes"
        : classes.find((c) => extractId(c) === selectedClass)?.name ||
          selectedClass;
    const sectionName =
      selectedSection === "all"
        ? "All Sections"
        : sections.find((s) => extractId(s) === selectedSection)?.name ||
          selectedSection;
    const monthName = selectedMonth === "all" ? "All Months" : selectedMonth;
    const exportDate = format(new Date(), "dd MMMM yyyy, hh:mm a");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Student Installment Months &amp; Schedule Report</title>
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
              font-size: 9.5px;
              color: #64748b;
              line-height: 1.4;
              text-align: right;
            }
            .meta-box strong {
              color: #0f172a;
            }
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
              font-size: 9.5px;
            }
            .filter-item strong { color: #334155; }
            .filter-item span { color: #0f172a; font-weight: 600; }
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
              font-size: 10px;
              color: #334155;
            }
            .table-summary-bar .summary-item strong { color: #0f172a; font-weight: 700; }
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
              letter-spacing: 0.4px;
              padding: 6px 8px;
              text-align: left;
              border: 1px solid #cbd5e1;
            }
            td {
              padding: 5px 8px;
              font-size: 9.5px;
              border: 1px solid #e2e8f0;
            }
            .student-row {
              background: #ffffff;
              font-weight: 600;
            }
            .student-row:nth-child(4n+1) { background-color: #fafafa; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .subtable-wrapper {
              padding: 5px 10px 8px 24px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-top: none;
            }
            .subtable {
              width: 100%;
              border: 1px solid #cbd5e1;
              border-radius: 3px;
            }
            .subtable th {
              background: #e2e8f0;
              color: #334155;
              font-size: 8.5px;
              font-weight: 700;
              padding: 3.5px 6px;
              border: 1px solid #cbd5e1;
            }
            .subtable td {
              padding: 3.5px 6px;
              font-size: 9px;
              border: 1px solid #e2e8f0;
              background: #ffffff;
            }
            .badge-status {
              padding: 1.5px 5px;
              border-radius: 3px;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .status-paid { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
            .status-pending { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
            .status-partial { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
            .status-overdue { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
            tfoot tr.grand-total-row {
              background: #f1f5f9;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              font-weight: 700;
            }
            tfoot td {
              padding: 6px 8px;
              font-size: 10px;
              border: 1px solid #cbd5e1;
              color: #0f172a;
            }
            .footer-sign {
              display: flex;
              justify-content: space-between;
              margin-top: 22px;
              padding-top: 14px;
              border-top: 1.5px solid #0f172a;
              font-size: 9.5px;
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
                <div><strong>Total Students:</strong> ${filteredStudents.length}</div>
                <div><strong>Total Installments:</strong> ${summaryMetrics.totalInstallments}</div>
              </div>
            </div>

            <!-- CENTERED CALLIGRAPHY REPORT TITLE -->
            <div class="center-calligraphy-title">
              Student Installment Months &amp; Schedule Report
            </div>

            <div class="filters-bar">
              <div class="filter-item"><strong>Session:</strong> <span>${sessionName}</span></div>
              <div class="filter-item"><strong>Program:</strong> <span>${programName}</span></div>
              <div class="filter-item"><strong>Class:</strong> <span>${className}</span></div>
              <div class="filter-item"><strong>Section:</strong> <span>${sectionName}</span></div>
              <div class="filter-item"><strong>Month:</strong> <span>${monthName}</span></div>
            </div>

            <!-- TOP TABLE SUMMARY ROW -->
            <div class="table-summary-bar">
              <div class="summary-item">Total Students: <strong>${summaryMetrics.totalStudents}</strong></div>
              <div class="summary-item">Scheduled Installments: <strong>${summaryMetrics.totalInstallments}</strong></div>
              <div class="summary-item">Total Scheduled Amount: <strong>PKR ${summaryMetrics.totalAmount.toLocaleString()}</strong></div>
              <div class="summary-item">Total Paid: <strong>PKR ${summaryMetrics.totalPaid.toLocaleString()}</strong></div>
              <div class="summary-item">Total Pending: <strong>PKR ${summaryMetrics.totalPending.toLocaleString()}</strong></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 28px;">#</th>
                  <th>Roll No.</th>
                  <th>Student Name</th>
                  <th>Father Name</th>
                  <th>Program / Class / Section</th>
                  <th class="text-center" style="width: 80px;">Installments</th>
                  <th class="text-right" style="width: 100px;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${filteredStudents.map((s, idx) => `
                  <tr class="student-row no-break">
                    <td>${idx + 1}</td>
                    <td><strong>${s.rollNumber}</strong></td>
                    <td>${s.studentName}</td>
                    <td>${s.fatherName}</td>
                    <td>${s.programClassSection}</td>
                    <td class="text-center">${s.displayInstallments.length} / ${s.totalInstallmentsCount}</td>
                    <td class="text-right">PKR ${s.totalFee.toLocaleString()}</td>
                  </tr>
                  <tr class="no-break">
                    <td colspan="7" style="padding: 0;">
                      <div class="subtable-wrapper">
                        <table class="subtable">
                          <thead>
                            <tr>
                              <th style="width: 70px;">Inst #</th>
                              <th>Scheduled Month</th>
                              <th>Due Date</th>
                              <th class="text-right">Scheduled Amount</th>
                              <th class="text-right">Paid</th>
                              <th class="text-right">Pending</th>
                              <th class="text-center" style="width: 75px;">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${s.displayInstallments.map((inst) => `
                              <tr>
                                <td><strong>Inst ${inst.installmentNumber}</strong></td>
                                <td>${inst.month}</td>
                                <td>${inst.formattedDueDate}</td>
                                <td class="text-right">PKR ${inst.amount.toLocaleString()}</td>
                                <td class="text-right">PKR ${inst.paidAmount.toLocaleString()}</td>
                                <td class="text-right" style="${inst.pendingAmount > 0 ? 'color: #991b1b; font-weight: 600;' : ''}">
                                  PKR ${inst.pendingAmount.toLocaleString()}
                                </td>
                                <td class="text-center">
                                  <span class="badge-status status-${inst.status.toLowerCase()}">
                                    ${inst.status}
                                  </span>
                                </td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="grand-total-row no-break">
                  <td colspan="5" style="text-align: right; font-weight: 700;">TOTAL (${summaryMetrics.totalStudents} Students):</td>
                  <td class="text-center" style="font-weight: 700;">${summaryMetrics.totalInstallments} Insts</td>
                  <td class="text-right" style="font-weight: 700;">PKR ${summaryMetrics.totalAmount.toLocaleString()}</td>
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
      title: "Student Installment Months & Schedule Report",
      toast,
    });
  };

  // Export to Excel (.xlsx) Handler
  const handleExportExcel = () => {
    if (filteredStudents.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no student installment records matching the filters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // 1. Student Summary Sheet
      const summaryRows = filteredStudents.map((s, idx) => ({
        "S.No": idx + 1,
        "Roll Number": s.rollNumber,
        "Student Name": s.studentName,
        "Father Name": s.fatherName,
        "Program": s.programName,
        "Class": s.className,
        "Section": s.sectionName || "N/A",
        "Total Installments": s.totalInstallmentsCount,
        "Scheduled Months": s.allInstallments.map((i) => i.month).join(", "),
        "Total Fee (PKR)": s.totalFee,
        "Paid Amount (PKR)": s.totalPaid,
        "Pending Amount (PKR)": s.totalPending,
      }));

      // Append Total Row to Summary
      summaryRows.push({
        "S.No": "TOTAL",
        "Roll Number": `${summaryMetrics.totalStudents} Students`,
        "Student Name": "",
        "Father Name": "",
        "Program": "",
        "Class": "",
        "Section": "",
        "Total Installments": summaryMetrics.totalInstallments,
        "Scheduled Months": "",
        "Total Fee (PKR)": summaryMetrics.totalAmount,
        "Paid Amount (PKR)": summaryMetrics.totalPaid,
        "Pending Amount (PKR)": summaryMetrics.totalPending,
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary["!cols"] = [
        { wch: 8 },
        { wch: 15 },
        { wch: 24 },
        { wch: 22 },
        { wch: 18 },
        { wch: 16 },
        { wch: 12 },
        { wch: 18 },
        { wch: 32 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Students Summary");

      // 2. Itemized Installments Schedule Sheet
      const itemizedRows = [];
      let itemIdx = 1;

      for (const s of filteredStudents) {
        const instsToExport =
          selectedMonth === "all" ? s.allInstallments : s.displayInstallments;
        for (const inst of instsToExport) {
          itemizedRows.push({
            "S.No": itemIdx++,
            "Roll Number": s.rollNumber,
            "Student Name": s.studentName,
            "Father Name": s.fatherName,
            "Program": s.programName,
            "Class": s.className,
            "Section": s.sectionName || "N/A",
            "Installment No": inst.installmentNumber,
            "Scheduled Month": inst.month,
            "Due Date": inst.formattedDueDate,
            "Scheduled Amount (PKR)": inst.amount,
            "Paid Amount (PKR)": inst.paidAmount,
            "Pending Amount (PKR)": inst.pendingAmount,
            "Status": inst.status,
            "Challan Issued": inst.challanGenerated ? "YES" : "NO",
          });
        }
      }

      if (itemizedRows.length > 0) {
        itemizedRows.push({
          "S.No": "TOTAL",
          "Roll Number": `${summaryMetrics.totalStudents} Students`,
          "Student Name": "",
          "Father Name": "",
          "Program": "",
          "Class": "",
          "Section": "",
          "Installment No": `${summaryMetrics.totalInstallments} Installments`,
          "Scheduled Month": "",
          "Due Date": "",
          "Scheduled Amount (PKR)": summaryMetrics.totalAmount,
          "Paid Amount (PKR)": summaryMetrics.totalPaid,
          "Pending Amount (PKR)": summaryMetrics.totalPending,
          "Status": "",
          "Challan Issued": "",
        });

        const wsItemized = XLSX.utils.json_to_sheet(itemizedRows);
        wsItemized["!cols"] = [
          { wch: 8 },
          { wch: 15 },
          { wch: 24 },
          { wch: 22 },
          { wch: 18 },
          { wch: 16 },
          { wch: 12 },
          { wch: 14 },
          { wch: 16 },
          { wch: 14 },
          { wch: 22 },
          { wch: 18 },
          { wch: 18 },
          { wch: 14 },
          { wch: 16 },
        ];
        XLSX.utils.book_append_sheet(wb, wsItemized, "Installments Schedule");
      }

      const dateStr = format(new Date(), "yyyy-MM-dd");
      XLSX.writeFile(wb, `Student_Installment_Schedule_${dateStr}.xlsx`);
      toast({
        title: "Export Successful",
        description: `Exported ${filteredStudents.length} student installment records to Excel.`,
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

  return (
    <div className="space-y-4">
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground -ml-1 h-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Reports
        </Button>
      )}

      <Card className="border border-border/70 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-start justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-primary" />
              Student Installment Month Reports
            </CardTitle>
            <CardDescription>
              Fetch and audit student installment plans — installment numbers, scheduled months, fee amounts, and due dates with cascaded filters or direct student search.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {filteredStudents.length > 0 && (
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExpandAll}
                  className="gap-1.5 h-9 text-xs text-muted-foreground"
                >
                  {expandedStudentIds.size === filteredStudents.length ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      Expand All
                    </>
                  )}
                </Button>
              </>
            )}

            {(selectedProgram !== "all" ||
              selectedClass !== "all" ||
              selectedSection !== "all" ||
              selectedSession !== "all" ||
              selectedMonth !== "all" ||
              searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2.5 text-xs text-muted-foreground gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Cascading Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end bg-muted/20 p-3.5 rounded-lg border border-border/50">
            {/* Academic Session */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Academic Session
              </Label>
              <Select
                value={selectedSession}
                onValueChange={setSelectedSession}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {academicSessions.map((s) => {
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
              <Select
                value={selectedProgram}
                onValueChange={handleProgramChange}
              >
                <SelectTrigger
                  className={`h-9 text-xs ${
                    selectedProgram === "all" && !debouncedSearch
                      ? "border-amber-400/80 bg-amber-50/30 dark:bg-amber-950/20"
                      : ""
                  }`}
                >
                  <SelectValue placeholder="Select Program..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((p) => {
                    const val = extractId(p);
                    return (
                      <SelectItem key={val || Math.random()} value={val}>
                        {p.name || p.programName || p.title || "Program"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Class */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Class
              </Label>
              <Select
                value={selectedClass}
                onValueChange={handleClassChange}
                disabled={selectedProgram === "all" && availableClasses.length === 0}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {availableClasses.map((c) => {
                    const val = extractId(c);
                    return (
                      <SelectItem key={val || Math.random()} value={val}>
                        {c.name || c.className || "Class"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Section (if applicable) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Section {!isSectionApplicable ? "(N/A)" : ""}
              </Label>
              <Select
                value={selectedSection}
                onValueChange={setSelectedSection}
                disabled={!isSectionApplicable || availableSections.length === 0}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue
                    placeholder={
                      !isSectionApplicable
                        ? "Not Applicable"
                        : "All Sections"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {availableSections.map((s) => {
                    const val = extractId(s);
                    return (
                      <SelectItem key={val || Math.random()} value={val}>
                        {s.name || s.sectionName || "Section"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Scheduled Month Filter */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Installment Month
              </Label>
              <Select
                value={selectedMonth}
                onValueChange={setSelectedMonth}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTH_NAMES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student Search via Name or Roll Number */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Search Student
              </Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name or roll no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 pr-7 text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Integrated Summary Metrics Bar */}
          {filteredStudents.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3 bg-muted/30 rounded-lg border border-border/60 text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Students</p>
                  <p className="text-sm font-bold text-foreground">
                    {summaryMetrics.totalStudents}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Scheduled Insts</p>
                  <p className="text-sm font-bold text-foreground">
                    {summaryMetrics.totalInstallments}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Total Scheduled</p>
                  <p className="text-sm font-bold text-foreground">
                    PKR {summaryMetrics.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Total Paid</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    PKR {summaryMetrics.totalPaid.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Total Pending</p>
                  <p className="text-sm font-bold text-rose-700 dark:text-rose-400">
                    PKR {summaryMetrics.totalPending.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Table / Content Body */}
          {!isFilterActive ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CalendarRange className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">
                  Select Program or Search Student
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Select a <strong>Program</strong> (and optional Class/Section) from the filters above, or type a student's <strong>name or roll number</strong> in the search bar to view their full installment schedule.
                </p>
              </div>
            </div>
          ) : isLoading || isFetching ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading student installment schedules...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <h3 className="font-semibold text-sm">No Student Installment Plans Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                No students matching the selected filters have configured installment schedules.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <Table className="w-full text-xs">
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground w-12">#</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Roll No.</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Student Name</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Father Name</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Program / Class / Section</TableHead>
                      <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground text-center">Installments</TableHead>
                      <TableHead className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">Scheduled Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student, idx) => {
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

                            <TableCell className="py-3 px-3 font-mono font-bold text-foreground">
                              {student.rollNumber}
                            </TableCell>

                            <TableCell className="py-3 px-3 font-semibold text-foreground">
                              {student.studentName}
                            </TableCell>

                            <TableCell className="py-3 px-3 text-muted-foreground">
                              {student.fatherName}
                            </TableCell>

                            <TableCell className="py-3 px-3 text-muted-foreground">
                              {student.programClassSection}
                            </TableCell>

                            <TableCell className="py-3 px-3 text-center">
                              <Badge
                                variant="secondary"
                                className="font-mono text-[11px] font-semibold"
                              >
                                {student.displayInstallments.length} / {student.totalInstallmentsCount} Insts
                              </Badge>
                            </TableCell>

                            <TableCell className="py-3 px-4 text-right font-medium text-foreground">
                              PKR {student.totalFee.toLocaleString()}
                            </TableCell>
                          </TableRow>

                          {/* Expanded Itemized Installment Schedule */}
                          {isExpanded && (
                            <TableRow className="bg-muted/15 hover:bg-muted/15 border-b border-border/60">
                              <TableCell colSpan={7} className="p-0">
                                <div className="py-3 px-4 pl-10 border-t border-dashed border-border/60 space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-3.5 h-3.5 text-primary" />
                                      <span className="font-semibold text-foreground">
                                        Scheduled Installments for {student.studentName} ({student.rollNumber}):
                                      </span>
                                    </div>
                                    <div className="text-[11px]">
                                      Paid: <strong className="text-emerald-700 dark:text-emerald-400">PKR {student.totalPaid.toLocaleString()}</strong> • 
                                      Pending: <strong className="text-rose-700 dark:text-rose-400">PKR {student.totalPending.toLocaleString()}</strong>
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto rounded border border-border/60 bg-background">
                                    <Table className="w-full text-xs">
                                      <TableHeader>
                                        <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                                          <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">
                                            Inst #
                                          </TableHead>
                                          <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">
                                            Scheduled Month
                                          </TableHead>
                                          <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">
                                            Due Date
                                          </TableHead>
                                          <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground text-right">
                                            Scheduled Amount
                                          </TableHead>
                                          <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground text-right">
                                            Paid
                                          </TableHead>
                                          <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground text-right">
                                            Pending
                                          </TableHead>
                                          <TableHead className="h-8 py-1.5 px-3 text-[11px] font-semibold text-muted-foreground text-center">
                                            Status
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {student.displayInstallments.map((inst) => (
                                          <TableRow
                                            key={inst.id}
                                            className="hover:bg-muted/25 border-b border-border/30"
                                          >
                                            <TableCell className="py-2 px-3 font-semibold text-foreground">
                                              Inst {inst.installmentNumber}
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-muted-foreground font-medium">
                                              {inst.month}
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-muted-foreground font-mono text-[11px]">
                                              {inst.formattedDueDate}
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-right font-medium text-foreground">
                                              PKR {inst.amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-right text-muted-foreground">
                                              PKR {inst.paidAmount.toLocaleString()}
                                            </TableCell>
                                            <TableCell
                                              className={`py-2 px-3 text-right font-semibold ${
                                                inst.pendingAmount > 0
                                                  ? "text-rose-600 dark:text-rose-400"
                                                  : "text-muted-foreground"
                                              }`}
                                            >
                                              PKR {inst.pendingAmount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-center">
                                              {getStatusBadge(inst.status)}
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
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentInstallmentReportsTab;
