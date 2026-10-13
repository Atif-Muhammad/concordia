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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarRange,
  Search,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  ChevronDown,
  AlertCircle,
  Users,
  X,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { cn } from "@/lib/utils";
import { getStudentInstallmentReport } from "@/services/api";

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

/**
 * Reusable Multi-Select Checkbox Dropdown Filter
 */
const MultiSelectFilter = ({
  title,
  placeholder = "All",
  options = [],
  selected = [],
  onChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => (o.name || "").toLowerCase().includes(q));
  }, [options, search]);

  const handleToggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.id));
  };

  const handleClear = () => {
    onChange([]);
  };

  const labelText = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === options.length && options.length > 0) {
      return `All ${title} (${options.length})`;
    }
    if (selected.length === 1) {
      const match = options.find((o) => o.id === selected[0]);
      return match ? match.name : `1 ${title} selected`;
    }
    return `${selected.length} ${title} selected`;
  }, [selected, options, placeholder, title]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between text-xs font-normal px-2.5 bg-background",
            selected.length > 0 && "border-primary text-foreground font-semibold bg-primary/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="truncate">{labelText}</span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selected.length > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                {selected.length}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 shadow-lg" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-border text-xs">
            <span className="font-semibold text-foreground">Select {title}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-primary hover:underline font-semibold"
              >
                All
              </button>
              <span className="text-muted-foreground">•</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-muted-foreground hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {options.length > 5 && (
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search ${title.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs pl-7 pr-2"
              />
            </div>
          )}

          <div className="max-h-52 overflow-y-auto space-y-0.5 py-0.5">
            {filteredOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No {title.toLowerCase()} found
              </p>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/70 cursor-pointer text-xs transition-colors"
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(opt.id)}
                    />
                    <span className="truncate font-medium">{opt.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
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

  // Multi-Select Checkbox Filter States
  const [selectedSession, setSelectedSession] = useState("all");
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAllRecords, setShowAllRecords] = useState(false);

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

  // Normalized Programs for MultiSelect
  const programOptions = useMemo(() => {
    return programs.map((p) => ({
      id: extractId(p),
      name: p.name || p.programName || p.title || "Program",
    }));
  }, [programs]);

  // Classes cascaded from selectedPrograms
  const availableClasses = useMemo(() => {
    if (selectedPrograms.length === 0) return classes;
    return classes.filter((c) =>
      selectedPrograms.includes(extractId(c.programId || c.program))
    );
  }, [classes, selectedPrograms]);

  const classOptions = useMemo(() => {
    return availableClasses.map((c) => ({
      id: extractId(c),
      name: c.name || c.className || "Class",
    }));
  }, [availableClasses]);

  // Sections cascaded from selectedClasses / selectedPrograms
  const availableSections = useMemo(() => {
    if (selectedClasses.length === 0) {
      if (selectedPrograms.length === 0) return sections;
      const validClassIds = availableClasses.map((c) => extractId(c));
      return sections.filter((s) =>
        validClassIds.includes(extractId(s.classId || s.class))
      );
    }
    return sections.filter((s) =>
      selectedClasses.includes(extractId(s.classId || s.class))
    );
  }, [sections, selectedClasses, selectedPrograms, availableClasses]);

  const sectionOptions = useMemo(() => {
    return availableSections.map((s) => ({
      id: extractId(s),
      name: s.name || s.sectionName || "Section",
    }));
  }, [availableSections]);

  // Automatic clean up of dependent child selections when parent filter changes
  useEffect(() => {
    if (selectedPrograms.length > 0) {
      const validClassIds = new Set(availableClasses.map((c) => extractId(c)));
      setSelectedClasses((prev) => prev.filter((id) => validClassIds.has(id)));
    }
  }, [selectedPrograms, availableClasses]);

  useEffect(() => {
    if (selectedClasses.length > 0 || selectedPrograms.length > 0) {
      const validSectionIds = new Set(availableSections.map((s) => extractId(s)));
      setSelectedSections((prev) => prev.filter((id) => validSectionIds.has(id)));
    }
  }, [selectedClasses, availableSections, selectedPrograms]);

  // Whether sections are applicable
  const isSectionApplicable = useMemo(() => {
    if (selectedClasses.length === 0) return availableSections.length > 0;
    const selectedClassObjs = classes.filter((c) =>
      selectedClasses.includes(extractId(c))
    );
    const allDisallow = selectedClassObjs.every(
      (c) => c.allowSections === false
    );
    return !allDisallow && availableSections.length > 0;
  }, [selectedClasses, classes, availableSections]);

  const handleResetFilters = () => {
    setSelectedSession("all");
    setSelectedPrograms([]);
    setSelectedClasses([]);
    setSelectedSections([]);
    setSelectedMonth("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setShowAllRecords(false);
  };

  // Determine if query is enabled:
  // Requires at least one program/class/section selected OR search query typed OR showAllRecords
  const isFilterActive =
    selectedPrograms.length > 0 ||
    selectedClasses.length > 0 ||
    selectedSections.length > 0 ||
    selectedSession !== "all" ||
    (debouncedSearch && debouncedSearch.length >= 2) ||
    showAllRecords;

  const {
    data: rawStudentsData = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "studentInstallmentReport",
      selectedSession,
      selectedPrograms.slice().sort().join(","),
      selectedClasses.slice().sort().join(","),
      selectedSections.slice().sort().join(","),
      debouncedSearch,
      showAllRecords,
    ],
    queryFn: async () => {
      const filters = {
        sessionId: selectedSession !== "all" ? selectedSession : undefined,
        programId: selectedPrograms.length > 0 ? selectedPrograms.join(",") : undefined,
        classId: selectedClasses.length > 0 ? selectedClasses.join(",") : undefined,
        sectionId: selectedSections.length > 0 ? selectedSections.join(",") : undefined,
        searchQuery: debouncedSearch || undefined,
        status: "all",
      };
      const res = await getStudentInstallmentReport(filters);
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
        s.programName ||
        programs.find((p) => extractId(p) === extractId(s.programId))?.name ||
        "-";
      const clsName =
        getName(s.class) ||
        s.className ||
        classes.find((c) => extractId(c) === extractId(s.classId))?.name ||
        "-";
      const secName =
        getName(s.section) ||
        s.sectionName ||
        sections.find((sec) => extractId(sec) === extractId(s.sectionId))?.name ||
        "";
      const sessName =
        getName(s.session) ||
        s.sessionName ||
        academicSessions.find((sess) => extractId(sess) === extractId(s.sessionId))?.name ||
        "-";

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

      // Total decided tuition fee: priority to s.tuitionFee, fallback to sum of installments
      const decidedTuitionFee = Number(s.tuitionFee ?? totalFee ?? 0);

      return {
        id: sId,
        studentName: fullName,
        fatherName,
        rollNumber,
        programName: progName,
        className: clsName,
        sectionName: secName,
        sessionName: sessName,
        programClassSection: pcs,
        allInstallments: mappedInsts,
        displayInstallments: displayInsts,
        totalInstallmentsCount: mappedInsts.length,
        tuitionFee: decidedTuitionFee,
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
    academicSessions,
    selectedMonth,
  ]);

  // Filter students if month filter is active and student has no matching installments
  const filteredStudents = useMemo(() => {
    if (selectedMonth === "all") return processedStudents;
    return processedStudents.filter(
      (s) => s.displayInstallments.length > 0
    );
  }, [processedStudents, selectedMonth]);

  // Grand Total calculation for exports and print footer
  const grandTotalTuitionFee = useMemo(() => {
    return filteredStudents.reduce((sum, s) => sum + s.tuitionFee, 0);
  }, [filteredStudents]);

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

    // Fetch brand logo as Data URL
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

    const programLabel =
      selectedPrograms.length === 0
        ? "All Programs"
        : selectedPrograms
            .map((id) => programs.find((p) => extractId(p) === id)?.name || id)
            .join(", ");

    const classLabel =
      selectedClasses.length === 0
        ? "All Classes"
        : selectedClasses
            .map((id) => classes.find((c) => extractId(c) === id)?.name || id)
            .join(", ");

    const sectionLabel =
      selectedSections.length === 0
        ? "All Sections"
        : selectedSections
            .map((id) => sections.find((s) => extractId(s) === id)?.name || id)
            .join(", ");

    const monthName = selectedMonth === "all" ? "All Months" : selectedMonth;
    const exportDate = format(new Date(), "dd MMMM yyyy, hh:mm a");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Student Installment Months Report</title>
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
              border-top: 3.5px solid #0f172a;
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
              height: 48px;
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
              font-size: 9px;
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
              padding: 6px 8px;
              font-size: 9.5px;
              border: 1px solid #cbd5e1;
              vertical-align: top;
            }
            .student-row { background: #ffffff; }
            .student-row:nth-child(even) { background-color: #fafafa; }
            .student-cell .student-name {
              font-size: 11px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 2px;
            }
            .student-cell .student-father {
              font-size: 9.5px;
              color: #475569;
              margin-bottom: 3px;
            }
            .student-cell .roll-pill {
              display: inline-block;
              font-family: monospace;
              font-size: 9px;
              font-weight: 700;
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 1px 4px;
              border-radius: 2px;
              color: #0f172a;
            }
            .academic-cell .academic-prog {
              font-size: 10.5px;
              font-weight: 700;
              color: #0f172a;
            }
            .academic-cell .academic-class {
              font-size: 9.5px;
              font-weight: 600;
              color: #334155;
              margin-top: 1px;
            }
            .academic-cell .academic-sess {
              font-size: 8.5px;
              color: #64748b;
              margin-top: 1px;
            }
            .inst-tags-container {
              display: block;
              line-height: 1.8;
              margin-bottom: 4px;
            }
            .inst-tag {
              display: inline-block;
              font-size: 9px;
              line-height: 1.25;
              padding: 2px 6px;
              margin: 1.5px 2.5px;
              border-radius: 3px;
              white-space: nowrap;
              vertical-align: middle;
              background: #ffffff;
              border: 1px dashed #94a3b8;
              color: #334155;
              font-weight: 500;
            }
            .inst-tally-line {
              margin-top: 4px;
              padding-top: 3px;
              border-top: 1px dashed #cbd5e1;
              text-align: right;
              font-size: 9px;
              font-weight: 600;
              color: #334155;
            }
            .inst-tally-line strong {
              color: #0f172a;
              font-size: 9.5px;
            }
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
              margin-top: 24px;
              padding-top: 12px;
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
                <img src="${logoDataUrl}" class="brand-logo" alt="Concordia College Logo" />
                <div class="header-title-block">
                  <h1>Concordia College Peshawar</h1>
                  <div class="tagline">A Project of Beaconhouse</div>
                </div>
              </div>
              <div class="meta-box">
                <div><strong>Generated:</strong> ${exportDate}</div>
                <div><strong>Total Students:</strong> ${filteredStudents.length}</div>
              </div>
            </div>

            <!-- CENTERED CALLIGRAPHY REPORT TITLE -->
            <div class="center-calligraphy-title">
              Student Installment Months Report
            </div>

            <div class="filters-bar">
              <div class="filter-item"><strong>Session:</strong> <span>${sessionName}</span></div>
              <div class="filter-item"><strong>Program:</strong> <span>${programLabel}</span></div>
              <div class="filter-item"><strong>Class:</strong> <span>${classLabel}</span></div>
              <div class="filter-item"><strong>Section:</strong> <span>${sectionLabel}</span></div>
              <div class="filter-item"><strong>Month:</strong> <span>${monthName}</span></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 32px; text-align: center;">#</th>
                  <th style="width: 28%;">Student Details</th>
                  <th style="width: 24%;">Program / Class / Section</th>
                  <th style="width: 44%;">Installment Months</th>
                </tr>
              </thead>
              <tbody>
                ${filteredStudents
                  .map(
                    (s, idx) => `
                  <tr class="student-row no-break">
                    <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
                    <td>
                      <div class="student-cell">
                        <div class="student-name">${s.studentName}</div>
                        <div class="student-father"><span style="color: #64748b; font-weight: 600;">Father:</span> ${s.fatherName}</div>
                        <div>
                          <span style="font-size: 8.5px; color: #64748b; font-weight: 600; text-transform: uppercase;">Roll:</span>
                          <span class="roll-pill">${s.rollNumber}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="academic-cell">
                        <div class="academic-prog">${s.programName}</div>
                        <div class="academic-class">${s.className} ${s.sectionName ? `(${s.sectionName})` : ""}</div>
                        ${s.sessionName && s.sessionName !== "-" ? `<div class="academic-sess">Session: ${s.sessionName}</div>` : ""}
                      </div>
                    </td>
                    <td>
                      <div class="inst-tags-container">
                        ${s.displayInstallments
                          .map((inst) => `<span class="inst-tag">${inst.installmentNumber} | ${inst.month}</span>`)
                          .join("")}
                      </div>
                      <div class="inst-tally-line">
                        Total Decided Tuition Fee: <strong>PKR ${Number(s.tuitionFee || s.totalFee || 0).toLocaleString()}</strong>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr class="grand-total-row no-break">
                  <td colspan="3" style="text-align: right; font-weight: 700;">
                    GRAND TOTAL (${filteredStudents.length} Students):
                  </td>
                  <td style="text-align: right; font-weight: 700;">
                    Total Decided Tuition Fee: PKR ${grandTotalTuitionFee.toLocaleString()}
                  </td>
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
      title: "Student Installment Months Report",
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

      // Student Summary Sheet with unified columns
      const summaryRows = filteredStudents.map((s, idx) => ({
        "S.No": idx + 1,
        "Roll Number": s.rollNumber,
        "Student Name": s.studentName,
        "Father Name": s.fatherName,
        "Program": s.programName,
        "Class": s.className,
        "Section": s.sectionName || "N/A",
        "Installment Months": s.displayInstallments
          .map((i) => `${i.installmentNumber} | ${i.month}`)
          .join(", "),
        "Total Decided Tuition Fee (PKR)": s.tuitionFee,
      }));

      // Append Grand Total Row
      summaryRows.push({
        "S.No": "TOTAL",
        "Roll Number": `${filteredStudents.length} Students`,
        "Student Name": "",
        "Father Name": "",
        "Program": "",
        "Class": "",
        "Section": "",
        "Installment Months": "",
        "Total Decided Tuition Fee (PKR)": grandTotalTuitionFee,
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary["!cols"] = [
        { wch: 8 },
        { wch: 16 },
        { wch: 24 },
        { wch: 22 },
        { wch: 20 },
        { wch: 16 },
        { wch: 12 },
        { wch: 45 },
        { wch: 26 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Installment Reports");

      const dateStr = format(new Date(), "yyyy-MM-dd");
      XLSX.writeFile(wb, `Student_Installment_Report_${dateStr}.xlsx`);
      toast({
        title: "Export Successful",
        description: `Exported ${filteredStudents.length} student records to Excel.`,
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
              Audit student installment months, installment numbers, and decided tuition fees with multi-select checkboxes for program, class, and section.
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
              </>
            )}

            {(selectedPrograms.length > 0 ||
              selectedClasses.length > 0 ||
              selectedSections.length > 0 ||
              selectedSession !== "all" ||
              selectedMonth !== "all" ||
              searchQuery ||
              showAllRecords) && (
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
          {/* Multi-Select Cascading Filter Bar */}
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
                <SelectTrigger className="h-9 text-xs bg-background">
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

            {/* Program Multi-Select */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Program (Multi)
              </Label>
              <MultiSelectFilter
                title="Programs"
                placeholder="All Programs"
                options={programOptions}
                selected={selectedPrograms}
                onChange={setSelectedPrograms}
              />
            </div>

            {/* Class Multi-Select */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Class (Multi)
              </Label>
              <MultiSelectFilter
                title="Classes"
                placeholder="All Classes"
                options={classOptions}
                selected={selectedClasses}
                onChange={setSelectedClasses}
                disabled={classOptions.length === 0}
              />
            </div>

            {/* Section Multi-Select */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Section (Multi) {!isSectionApplicable ? "(N/A)" : ""}
              </Label>
              <MultiSelectFilter
                title="Sections"
                placeholder={!isSectionApplicable ? "Not Applicable" : "All Sections"}
                options={sectionOptions}
                selected={selectedSections}
                onChange={setSelectedSections}
                disabled={!isSectionApplicable || sectionOptions.length === 0}
              />
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
                <SelectTrigger className="h-9 text-xs bg-background">
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
                  className="h-9 pl-8 pr-7 text-xs bg-background"
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

          {/* Table / Content Body */}
          {!isFilterActive ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CalendarRange className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">
                  Select Filters or Search Student
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Select one or more <strong>Programs</strong>, <strong>Classes</strong>, or <strong>Sections</strong> using the checkboxes above, or type a student's name or roll number to load their installment records.
                </p>
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllRecords(true)}
                    className="text-xs gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Load All Students
                  </Button>
                </div>
              </div>
            </div>
          ) : isLoading || isFetching ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading student installment records...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <h3 className="font-semibold text-sm">No Student Installment Records Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                No students matching the selected multi-filter criteria were found.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <Table className="w-full text-xs">
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-xs border-b">
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="py-2.5 px-3 w-12 text-center text-xs font-semibold text-muted-foreground">
                        #
                      </TableHead>
                      <TableHead className="py-2.5 px-3 min-w-[200px] text-xs font-semibold text-muted-foreground">
                        Student Details
                      </TableHead>
                      <TableHead className="py-2.5 px-3 min-w-[180px] text-xs font-semibold text-muted-foreground">
                        Program / Class / Section
                      </TableHead>
                      <TableHead className="py-2.5 px-3 min-w-[340px] text-xs font-semibold text-muted-foreground">
                        Installment Months
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student, idx) => (
                      <TableRow
                        key={student.id}
                        className="transition-colors hover:bg-muted/20 border-b"
                      >
                        {/* Column 0: Index (Clean number only, no chevron/detail) */}
                        <TableCell className="py-3 px-3 text-center align-top font-medium text-muted-foreground">
                          {idx + 1}
                        </TableCell>

                        {/* Column 1: Student Name / Father Name / Roll Number (in one cell) */}
                        <TableCell className="py-3 px-3 align-top">
                          <div className="space-y-1">
                            <div className="font-bold text-foreground text-sm leading-snug">
                              {student.studentName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-muted-foreground/80">Father:</span> {student.fatherName}
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                                Roll:
                              </span>
                              <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-muted/80 border border-border/70 text-foreground">
                                {student.rollNumber}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Column 2: Program / Class / Section (in 2nd cell) */}
                        <TableCell className="py-3 px-3 align-top">
                          <div className="space-y-1">
                            <div className="font-bold text-foreground text-xs leading-snug">
                              {student.programName}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">
                              {student.className} {student.sectionName ? `(${student.sectionName})` : ""}
                            </div>
                            {student.sessionName && student.sessionName !== "-" && (
                              <div className="text-[11px] text-muted-foreground">
                                Session: {student.sessionName}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Column 3: Installment Months (pills with number only: "<number> | <month>") */}
                        <TableCell className="py-3 px-3 align-top">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {student.displayInstallments.length > 0 ? (
                                student.displayInstallments.map((inst) => (
                                  <span
                                    key={inst.id}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-dashed border-slate-300 dark:border-slate-700 bg-background text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-colors"
                                    title={`Installment ${inst.installmentNumber} • ${inst.month} • Due: ${inst.formattedDueDate || '-'} • Amount: PKR ${inst.amount.toLocaleString()}`}
                                  >
                                    {inst.installmentNumber} | {inst.month}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground italic">No installments configured</span>
                              )}
                            </div>

                            {/* Bottom line: Decided tuition fee only (no submissions, no pending text) */}
                            <div className="flex justify-end items-center pt-1.5 border-t border-dashed border-border/60 text-xs">
                              <div className="text-muted-foreground font-medium">
                                Total Decided Tuition Fee:{" "}
                                <span className="font-bold text-foreground">
                                  PKR {Number(student.tuitionFee || student.totalFee || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
