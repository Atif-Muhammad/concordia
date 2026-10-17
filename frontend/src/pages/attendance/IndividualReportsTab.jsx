import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Search,
  X,
  Printer,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  FileText,
  Users,
  Info,
  RotateCcw,
} from "lucide-react";
import {
  getAttendanceReport,
  searchStudents,
  getAcademicSessions,
} from "../../../config/apis";
import { openManagedPrintWindow } from "@/lib/managedPrint";

const toLocalDateKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const cleanSubjectName = (name) => {
  if (!name) return "";
  let clean = String(name).trim();
  if (/^[A-Z0-9_-]+\s*-\s*(.+)$/i.test(clean)) {
    clean = clean.replace(/^[A-Z0-9_-]+\s*-\s*/i, "");
  }
  clean = clean.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return clean || name;
};

const getInitials = (name) => {
  if (!name) return "ST";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const SUBJECT_COLORS = [
  "#2563eb", // blue
  "#ea580c", // orange
  "#16a34a", // green
  "#9333ea", // purple
  "#0d9488", // teal
  "#4f46e5", // indigo
  "#e11d48", // rose
  "#d97706", // amber
  "#0284c7", // light blue
];

const CircularProgressRing = ({ percentage = 0, size = 68, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validPct = Math.min(100, Math.max(0, Number(percentage) || 0));
  const strokeDashoffset = circumference - (validPct / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-emerald-500 transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <span className="text-xs font-bold text-foreground">{validPct}%</span>
      </div>
    </div>
  );
};

export default function IndividualReportsTab({
  onBack,
  initialStudent = null,
  initialStartDate = null,
  initialEndDate = null,
  initialSessionId = null,
  onNavigateClass = null,
}) {
  const { toast } = useToast();

  const now = new Date();
  const defaultStart = initialStartDate || toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEnd = initialEndDate || toLocalDateKey(now);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [sessionId, setSessionId] = useState(initialSessionId || "all");

  // Student Search
  const [searchQuery, setSearchQuery] = useState(
    initialStudent
      ? `${initialStudent.rollNumber || ""} - ${initialStudent.name || `${initialStudent.fName || ""} ${initialStudent.lName || ""}`.trim()}`
      : ""
  );
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(initialStudent);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // Date Range Popover
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(defaultStart);
  const [tempEndDate, setTempEndDate] = useState(defaultEnd);

  // Sessions Query
  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  const activeSession = useMemo(() => {
    return (
      academicSessions.find((s) => s.isActive === true || s.isActive === "true" || s.isCurrent || s.status === "ACTIVE") ||
      academicSessions[0] ||
      null
    );
  }, [academicSessions]);
  const activeSessionId = activeSession ? String(activeSession.id || activeSession._id || "") : "";

  useEffect(() => {
    if (initialStudent) {
      setSelectedStudent(initialStudent);
      setSearchQuery(
        `${initialStudent.rollNumber || ""} - ${initialStudent.name || `${initialStudent.fName || ""} ${initialStudent.lName || ""}`.trim()}`
      );
    }
    if (initialStartDate) {
      setStartDate(initialStartDate);
      setTempStartDate(initialStartDate);
    }
    if (initialEndDate) {
      setEndDate(initialEndDate);
      setTempEndDate(initialEndDate);
    }
    if (initialSessionId) {
      setSessionId(initialSessionId);
    }
  }, [initialStudent, initialStartDate, initialEndDate, initialSessionId]);

  useEffect(() => {
    if ((!sessionId || sessionId === "all") && activeSessionId && !initialSessionId) {
      setSessionId(activeSessionId);
    }
  }, [activeSessionId, sessionId, initialSessionId]);

  // Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStudentSearch = async (val) => {
    setSearchQuery(val);
    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }
    setIsSearching(true);
    setIsSearchOpen(true);
    try {
      const results = await searchStudents(val.trim());
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error("Student search error:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setSearchQuery(
      `${student.rollNumber || ""} - ${student.fName || ""} ${student.lName || ""}`.trim()
    );
    setIsSearchOpen(false);
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
  };

  const handlePresetRange = (preset) => {
    const today = new Date();
    let s = new Date();
    let e = new Date();

    if (preset === "this_month") {
      s = new Date(today.getFullYear(), today.getMonth(), 1);
      e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === "last_month") {
      s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      e = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (preset === "last_30_days") {
      s = new Date(today);
      s.setDate(today.getDate() - 30);
    } else if (preset === "last_7_days") {
      s = new Date(today);
      s.setDate(today.getDate() - 7);
    }

    const sStr = toLocalDateKey(s);
    const eStr = toLocalDateKey(e);
    setStartDate(sStr);
    setEndDate(eStr);
    setTempStartDate(sStr);
    setTempEndDate(eStr);
    setIsDateRangeOpen(false);
  };

  const handleApplyDateRange = () => {
    if (tempStartDate && tempEndDate) {
      setStartDate(tempStartDate);
      setEndDate(tempEndDate);
    }
    setIsDateRangeOpen(false);
  };

  // Main Report Query for Selected Student
  const currentStudentId = selectedStudent?._id || selectedStudent?.id;
  const {
    data: reportData = [],
    isFetching: isFetchingReport,
    refetch: refetchReport,
  } = useQuery({
    queryKey: [
      "individualAttendanceReport",
      currentStudentId,
      startDate,
      endDate,
      sessionId,
      activeSessionId,
    ],
    queryFn: () => {
      if (!currentStudentId) return [];
      const sessionParam = sessionId && sessionId !== "all" ? sessionId : (activeSessionId || undefined);
      return getAttendanceReport(
        startDate,
        endDate,
        undefined,
        undefined,
        sessionParam,
        undefined,
        String(currentStudentId)
      );
    },
    enabled: Boolean(currentStudentId && startDate && endDate),
  });

  const studentReport = reportData[0] || (selectedStudent?.subjects?.length ? selectedStudent : null);

  // Student details derived from selectedStudent or studentReport
  const studentName =
    studentReport?.name ||
    `${selectedStudent?.fName || ""} ${selectedStudent?.lName || ""}`.trim() ||
    selectedStudent?.name ||
    "Student";
  const rollNumber = studentReport?.rollNumber || selectedStudent?.rollNumber || "—";
  const className =
    studentReport?.class?.name ||
    selectedStudent?.class?.name ||
    selectedStudent?.classId?.name ||
    "Class";
  const sectionName =
    studentReport?.section?.name ||
    selectedStudent?.section?.name ||
    selectedStudent?.sectionId?.name ||
    "";
  const programName =
    studentReport?.program?.name ||
    selectedStudent?.program?.name ||
    selectedStudent?.programId?.name ||
    "";
  const studentFatherName =
    studentReport?.fatherName ||
    studentReport?.fatherOrguardian ||
    studentReport?.parentOrGuardianName ||
    selectedStudent?.fatherName ||
    selectedStudent?.fatherOrguardian ||
    selectedStudent?.parentOrGuardianName ||
    "—";

  // Subjects and attendance calculations
  const subjects = useMemo(() => {
    return (studentReport?.subjects || []).filter(
      (s) => s.subjectName && s.subjectName.toLowerCase() !== "general"
    );
  }, [studentReport]);

  // Distinct marked class dates in range (Excluding 'no marked' and holiday dates)
  const dateList = useMemo(() => {
    if (!startDate || !endDate || !subjects.length) return [];
    const markedDates = new Set();

    subjects.forEach((sub) => {
      (sub.attendance || []).forEach((item) => {
        const st = String(item.status || "").toLowerCase();
        // Exclude holidays and unmarked
        if (
          st === "present" ||
          st === "absent" ||
          st === "leave" ||
          st === "short_leave" ||
          st === "half_day" ||
          st === "hd"
        ) {
          const k = typeof item.date === "string" ? item.date.slice(0, 10) : toLocalDateKey(new Date(item.date));
          if (k >= startDate && k <= endDate) {
            markedDates.add(k);
          }
        }
      });
    });

    return Array.from(markedDates).sort();
  }, [subjects, startDate, endDate]);

  // Overall Statistics Calculation
  const stats = useMemo(() => {
    if (!startDate || !endDate) {
      return { totalDays: 0, presentCount: 0, absentCount: 0, leaveCount: 0, holidayCount: 0, totalClasses: 0, percentage: 0 };
    }

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let holidayCount = 0;

    subjects.forEach((sub) => {
      (sub.attendance || []).forEach((item) => {
        const st = String(item.status || "").toLowerCase();
        if (st === "present") presentCount++;
        else if (st === "absent") absentCount++;
        else if (st === "leave" || st === "short_leave") leaveCount++;
        else if (st === "holiday") holidayCount++;
      });
    });

    const totalDays = dateList.length;
    const totalClasses = presentCount + absentCount + leaveCount + holidayCount;
    const effectiveClasses = presentCount + absentCount + leaveCount;
    const percentage = effectiveClasses > 0 ? Number(((presentCount / effectiveClasses) * 100).toFixed(1)) : 0;

    return { totalDays, presentCount, absentCount, leaveCount, holidayCount, totalClasses, effectiveClasses, percentage };
  }, [subjects, startDate, endDate, dateList]);

  // Format date range display
  const dateRangeDisplay = useMemo(() => {
    if (!startDate || !endDate) return "Select Date Range";
    try {
      const s = new Date(`${startDate}T00:00:00`);
      const e = new Date(`${endDate}T00:00:00`);
      const sStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const eStr = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${sStr} - ${eStr}`;
    } catch {
      return `${startDate} - ${endDate}`;
    }
  }, [startDate, endDate]);

  // Print Handlers
  const handlePrint = async () => {
    if (!studentReport) return;

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

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student Attendance Report - ${studentName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #0f172a; padding: 12px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #ea580c; padding-bottom: 8px; margin-bottom: 12px; }
          .form-container { margin-bottom: 12px; padding: 10px 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; }
          .form-row { display: flex; align-items: baseline; gap: 16px; margin-bottom: 8px; }
          .form-row:last-child { margin-bottom: 0; }
          .summary-row { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #94a3b8; }
          .form-field { display: flex; align-items: baseline; min-width: 0; }
          .field-label { font-size: 10.5px; font-weight: 700; color: #334155; white-space: nowrap; margin-right: 6px; }
          .field-line { flex: 1; border-bottom: 1.5px solid #64748b; font-size: 11px; font-weight: 600; color: #0f172a; padding: 0 4px 1px 4px; min-height: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 2.5px 4px; text-align: center; }
          th { background: #f1f5f9; font-weight: 700; }
          td.left { text-align: left; }
          .badge-p { background: #dcfce7; color: #166534; font-weight: 700; border-radius: 3px; padding: 1px 4px; }
          .badge-a { background: #fee2e2; color: #991b1b; font-weight: 700; border-radius: 3px; padding: 1px 4px; }
          .badge-l { background: #fef3c7; color: #92400e; font-weight: 700; border-radius: 3px; padding: 1px 4px; }
          .badge-h { background: #f1f5f9; color: #475569; font-weight: 700; border-radius: 3px; padding: 1px 4px; }
          .footer-signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 10px; font-size: 10px; color: #64748b; }
          .sig-line { width: 180px; border-bottom: 1px solid #64748b; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="${logoDataUrl}" alt="Logo" style="height: 52px; width: auto; object-fit: contain;" />
            <div>
              <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">
                Concordia College Peshawar
              </div>
              <div style="font-family: 'Great Vibes', 'Dancing Script', cursive; font-size: 32px; color: #ea580c; line-height: 1.1; margin-top: 1px;">
                Student Attendance Report
              </div>
            </div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b;">
            <div><strong>Printed:</strong> ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
            <div><strong>Session:</strong> ${activeSession?.name || "2026 - 2027"}</div>
          </div>
        </div>

        <div class="form-container">
          <div class="form-row">
            <div class="form-field" style="flex: 2;">
              <span class="field-label">Student Name:</span>
              <span class="field-line">${studentName}</span>
            </div>
            <div class="form-field" style="flex: 1;">
              <span class="field-label">Roll No:</span>
              <span class="field-line" style="font-family: monospace;">${rollNumber}</span>
            </div>
            <div class="form-field" style="flex: 1.5;">
              <span class="field-label">Father Name:</span>
              <span class="field-line">${studentFatherName}</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field" style="flex: 1.2;">
              <span class="field-label">Class & Section:</span>
              <span class="field-line">${className} ${sectionName ? `- Section ${sectionName}` : ""}</span>
            </div>
            <div class="form-field" style="flex: 1.2;">
              <span class="field-label">Program:</span>
              <span class="field-line">${programName || "—"}</span>
            </div>
            <div class="form-field" style="flex: 1;">
              <span class="field-label">Academic Session:</span>
              <span class="field-line">${activeSession?.name || "2026-2027"}</span>
            </div>
            <div class="form-field" style="flex: 1.5;">
              <span class="field-label">Date Range:</span>
              <span class="field-line">${dateRangeDisplay}</span>
            </div>
          </div>

          <div class="form-row summary-row">
            <div class="form-field">
              <span class="field-label">Total Classes:</span>
              <span class="field-line" style="font-weight: 700;">${stats.totalClasses}</span>
            </div>
            <div class="form-field">
              <span class="field-label">Present:</span>
              <span class="field-line" style="font-weight: 700; color: #15803d;">${stats.presentCount}</span>
            </div>
            <div class="form-field">
              <span class="field-label">Absent:</span>
              <span class="field-line" style="font-weight: 700; color: #dc2626;">${stats.absentCount}</span>
            </div>
            <div class="form-field">
              <span class="field-label">Leave:</span>
              <span class="field-line" style="font-weight: 700; color: #b45309;">${stats.leaveCount}</span>
            </div>
            <div class="form-field">
              <span class="field-label">Holiday:</span>
              <span class="field-line" style="font-weight: 700; color: #64748b;">${stats.holidayCount}</span>
            </div>
            <div class="form-field">
              <span class="field-label">Attendance Rate:</span>
              <span class="field-line" style="font-weight: 800; color: #ea580c;">${stats.percentage}%</span>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="left" style="width: 140px;">Subject</th>
              ${dateList.slice(0, 31).map((d) => {
                const dt = new Date(`${d}T00:00:00`);
                return `<th>${dt.getDate()}<br/><span style="font-size: 8px; font-weight: normal;">${dt.toLocaleDateString("en-US", { weekday: "narrow" })}</span></th>`;
              }).join("")}
              <th style="width: 45px;">P</th>
              <th style="width: 45px;">A</th>
              <th style="width: 45px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map((sub) => {
              const attMap = {};
              (sub.attendance || []).forEach((a) => {
                const k = typeof a.date === "string" ? a.date.slice(0, 10) : toLocalDateKey(new Date(a.date));
                attMap[k] = String(a.status || "").toLowerCase();
              });
              const pCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "present").length;
              const aCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "absent").length;
              const tot = (sub.attendance || []).length;

              return `
                <tr>
                  <td class="left" style="padding: 2.5px 6px;"><strong>${cleanSubjectName(sub.subjectName)}</strong></td>
                  ${dateList.slice(0, 31).map((d) => {
                    const st = attMap[d];
                    if (st === "present") return `<td style="padding: 1px 0;"><span class="badge-p">P</span></td>`;
                    if (st === "absent") return `<td style="padding: 1px 0;"><span class="badge-a">A</span></td>`;
                    if (st === "leave" || st === "short_leave") return `<td style="padding: 1px 0;"><span class="badge-l">L</span></td>`;
                    if (st === "holiday") return `<td style="padding: 1px 0;"><span class="badge-h">H</span></td>`;
                    return `<td style="color: #cbd5e1; padding: 1px 0;">-</td>`;
                  }).join("")}
                  <td style="padding: 2.5px 2px;"><strong>${pCount}</strong></td>
                  <td style="color: #dc2626; padding: 2.5px 2px;"><strong>${aCount}</strong></td>
                  <td style="padding: 2.5px 2px;"><strong>${pCount}/${tot}</strong></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div class="footer-signatures">
          <div>
            <div class="sig-line"></div>
            <div>Teacher's Signature</div>
          </div>
          <div style="text-align: center; font-size: 9px; color: #94a3b8;">
            Legend: P = Present | A = Absent | L = Leave | H = Holiday
          </div>
          <div style="text-align: right;">
            <div class="sig-line" style="margin-left: auto;"></div>
            <div>Principal's Signature</div>
          </div>
        </div>
      </body>
      </html>
    `;

    await openManagedPrintWindow({
      html: printHtml,
      title: `Student_Attendance_${rollNumber}_${studentName}`,
      toast,
    });
  };

  return (
    <div className="space-y-4">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          1. TOP BREADCRUMB & STUDENT SEARCH
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Student Attendance
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            {onBack ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-6 px-1.5 text-xs font-semibold gap-1 text-primary hover:text-primary/80"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Class List</span>
              </Button>
            ) : (
              <>
                <span>Attendance</span>
                <span>&gt;</span>
                <span className="font-medium text-foreground">Student Attendance</span>
              </>
            )}
          </div>
        </div>

        {/* Search Student Input */}
        <div className="w-full sm:w-80 relative" ref={searchContainerRef}>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search student by roll no or name..."
              value={searchQuery}
              onChange={(e) => handleStudentSearch(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs bg-card"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearStudent}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto p-1 text-xs">
              {searchResults.map((st) => (
                <div
                  key={st._id || st.id}
                  onClick={() => handleSelectStudent(st)}
                  className="p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                >
                  <div className="font-semibold text-foreground">
                    {st.rollNumber} - {st.fName} {st.lName}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {st.class?.name || st.classId?.name || "Class"}
                    {st.section?.name ? ` - ${st.section.name}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedStudent ? (
        <Card className="border border-border/80 shadow-xs rounded-xl p-12 text-center bg-card">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">No Student Selected</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Use the search box above to select a student and inspect their attendance register.
          </p>
        </Card>
      ) : (
        <>
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              2. STUDENT PROFILE & 5-METRIC SUMMARY CARD (IMAGE 1 TOP)
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="border border-border/80 shadow-xs rounded-xl overflow-hidden bg-card">
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Profile Top Row: Avatar + Info + Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {/* Initials Avatar */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 text-primary font-extrabold text-base sm:text-lg flex items-center justify-center shrink-0 shadow-xs border border-primary/20">
                    {getInitials(studentName)}
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                      {studentName}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Roll No: <span className="font-semibold text-foreground font-mono">{rollNumber}</span>
                      {" • "}
                      Class: <span className="font-semibold text-foreground">{className}</span>
                      {sectionName && (
                        <span> - Section <span className="font-semibold text-foreground">{sectionName}</span></span>
                      )}
                      {programName && (
                        <span> • <span className="text-muted-foreground">{programName}</span></span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Date Range Selector & Print Button */}
                <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                  <Popover open={isDateRangeOpen} onOpenChange={setIsDateRangeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium gap-1.5 bg-background shadow-xs"
                      >
                        <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{dateRangeDisplay}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="end">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-foreground">Quick Presets</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button variant="secondary" size="sm" className="text-[11px] h-7" onClick={() => handlePresetRange("this_month")}>
                              This Month
                            </Button>
                            <Button variant="secondary" size="sm" className="text-[11px] h-7" onClick={() => handlePresetRange("last_month")}>
                              Last Month
                            </Button>
                            <Button variant="secondary" size="sm" className="text-[11px] h-7" onClick={() => handlePresetRange("last_30_days")}>
                              Last 30 Days
                            </Button>
                            <Button variant="secondary" size="sm" className="text-[11px] h-7" onClick={() => handlePresetRange("last_7_days")}>
                              Last 7 Days
                            </Button>
                          </div>
                        </div>
                        <div className="border-t pt-2 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Start Date</Label>
                            <Input type="date" className="h-7 text-xs" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">End Date</Label>
                            <Input type="date" className="h-7 text-xs" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} />
                          </div>
                        </div>
                        <div className="flex justify-end gap-1.5 pt-1 border-t">
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setIsDateRangeOpen(false)}>
                            Cancel
                          </Button>
                          <Button size="sm" className="text-xs h-7 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleApplyDateRange}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button
                    size="sm"
                    onClick={handlePrint}
                    className="h-8 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Report</span>
                  </Button>
                </div>
              </div>

              {/* Bottom Row: 5 Stat Blocks (Present, Absent, Leave, Holiday, Overall Ring) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-border/60">
                {/* 1. Present */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/70 bg-muted/20">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground">Present</div>
                    <div className="text-lg font-extrabold text-foreground leading-tight">{stats.presentCount}</div>
                    <div className="text-[10px] text-muted-foreground">Out of {stats.totalDays} Class Days</div>
                  </div>
                </div>

                {/* 2. Absent */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/70 bg-muted/20">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground">Absent</div>
                    <div className="text-lg font-extrabold text-rose-600 leading-tight">{stats.absentCount}</div>
                    <div className="text-[10px] text-muted-foreground">Out of {stats.totalDays} Class Days</div>
                  </div>
                </div>

                {/* 3. Leave */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/70 bg-muted/20">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground">Leave</div>
                    <div className="text-lg font-extrabold text-foreground leading-tight">{stats.leaveCount}</div>
                    <div className="text-[10px] text-muted-foreground">Out of {stats.totalDays} Class Days</div>
                  </div>
                </div>

                {/* 4. Holiday */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/70 bg-muted/20">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <MinusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground">Holiday</div>
                    <div className="text-lg font-extrabold text-foreground leading-tight">{stats.holidayCount}</div>
                    <div className="text-[10px] text-muted-foreground">Out of {stats.totalDays} Class Days</div>
                  </div>
                </div>

                {/* 5. Total Attendance Ring */}
                <div className="col-span-2 sm:col-span-1 flex items-center gap-3 p-2.5 rounded-lg border border-border/70 bg-muted/20">
                  <CircularProgressRing percentage={stats.percentage} size={50} strokeWidth={5} />
                  <div>
                    <div className="text-[11px] font-bold text-foreground leading-tight">Total Attendance</div>
                    <div className="text-[10px] text-muted-foreground">(All Subjects)</div>
                    <div className="text-[11px] font-semibold text-emerald-600 font-mono mt-0.5">
                      {stats.presentCount} / {stats.effectiveClasses}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              3. FULL-WIDTH ATTENDANCE DETAILS & SUBJECT-WISE SUMMARY
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="w-full space-y-5">
            {/* Card 1: Subject-wise Attendance Summary */}
              <Card className="border border-border/80 shadow-xs rounded-xl overflow-hidden bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/60">
                  <CardTitle className="text-sm font-bold text-foreground">
                    Subject-wise Attendance
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border text-muted-foreground text-[11px]">
                            <th className="py-2.5 px-3 text-left font-semibold">Subject</th>
                            <th className="py-2.5 px-3 text-center font-semibold">Total Classes</th>
                            <th className="py-2.5 px-3 text-center font-semibold">Present</th>
                            <th className="py-2.5 px-3 text-center font-semibold">Absent</th>
                            <th className="py-2.5 px-3 text-center font-semibold">Leave</th>
                            <th className="py-2.5 px-3 text-center font-semibold">Holiday</th>
                            <th className="py-2.5 px-3 text-left font-semibold min-w-[140px]">Attendance Count</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {subjects.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                                No subjects mapped for this class.
                              </td>
                            </tr>
                          ) : (
                            subjects.map((sub, idx) => {
                              const pCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "present").length;
                              const aCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "absent").length;
                              const lCount = (sub.attendance || []).filter((a) => {
                                const st = String(a.status || "").toLowerCase();
                                return st === "leave" || st === "short_leave";
                              }).length;
                              const hCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "holiday").length;
                              const totalClasses = (sub.attendance || []).length;
                              const effClasses = pCount + aCount + lCount;
                              const pct = effClasses > 0 ? (pCount / effClasses) * 100 : 0;
                              const dotColor = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];

                              return (
                                <tr key={sub.subjectId || idx} className="hover:bg-muted/20 transition-colors">
                                  <td className="py-2.5 px-3 font-medium text-foreground">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                                      <span>{sub.subjectName}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-medium">{totalClasses}</td>
                                  <td className="py-2.5 px-3 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    {pCount}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-semibold text-rose-600 dark:text-rose-400">
                                    {aCount}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-medium text-amber-600 dark:text-amber-400">
                                    {lCount}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">{hCount}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all"
                                          style={{ width: `${Math.min(100, pct)}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-[11px] font-semibold text-foreground shrink-0 w-8 text-right">
                                        {pCount}/{totalClasses}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                </CardContent>
              </Card>

              {/* Card 2: Attendance Details (Subject-wise) Matrix Table (Matching Image 1 bottom-left) */}
              <Card className="border border-border/80 shadow-xs rounded-xl overflow-hidden bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-sm font-bold text-foreground">
                    Attendance Details (Subject-wise)
                  </CardTitle>
                  <Badge variant="outline" className="text-[11px] font-normal gap-1 bg-background">
                    <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                    <span>{dateRangeDisplay}</span>
                  </Badge>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-[11px] border-collapse border border-border min-w-[650px]">
                      <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur-xs">
                        <tr className="text-muted-foreground text-[10px]">
                          <th className="py-1 px-2.5 text-left font-bold text-foreground border border-border sticky left-0 bg-muted/95 backdrop-blur-xs z-20 w-32 sm:w-40 whitespace-nowrap text-[11px]">
                            Subject
                          </th>
                          {dateList.map((d) => {
                            const dt = new Date(`${d}T00:00:00`);
                            const monthDay = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                            const weekDay = dt.toLocaleDateString("en-US", { weekday: "short" });
                            return (
                              <th key={d} className="py-1 px-0.5 text-center font-semibold border border-border min-w-[28px]">
                                <div className="text-[10px] text-foreground font-bold leading-tight">{monthDay}</div>
                                <div className="text-[8.5px] text-muted-foreground uppercase font-medium leading-none">{weekDay}</div>
                              </th>
                            );
                          })}
                          <th className="py-1 px-2 text-center font-bold text-foreground border border-border w-16 text-[11px]">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.length === 0 ? (
                          <tr>
                            <td colSpan={dateList.length + 2} className="py-4 text-center text-muted-foreground text-xs border border-border">
                              No attendance data recorded.
                            </td>
                          </tr>
                        ) : (
                          subjects.map((sub, idx) => {
                            const cleanName = cleanSubjectName(sub.subjectName);
                            const attMap = {};
                            (sub.attendance || []).forEach((a) => {
                              const k = typeof a.date === "string" ? a.date.slice(0, 10) : toLocalDateKey(new Date(a.date));
                              attMap[k] = String(a.status || "").toLowerCase();
                            });
                            const pCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "present").length;
                            const tot = (sub.attendance || []).length;
                            const dotColor = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];

                            return (
                              <tr key={sub.subjectId || idx} className="hover:bg-muted/30 transition-colors">
                                <td className="py-1 px-2.5 font-medium text-foreground text-[11px] border border-border sticky left-0 bg-card z-10 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                                    <span>{cleanName}</span>
                                  </div>
                                </td>
                                {dateList.map((d) => {
                                  const st = attMap[d];
                                  return (
                                    <td key={d} className="py-0.5 px-0.5 text-center border border-border">
                                      {st === "present" && (
                                        <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded bg-emerald-600 text-white font-bold text-[9px] shadow-2xs">
                                          P
                                        </span>
                                      )}
                                      {st === "absent" && (
                                        <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded bg-rose-600 text-white font-bold text-[9px] shadow-2xs">
                                          A
                                        </span>
                                      )}
                                      {(st === "leave" || st === "short_leave") && (
                                        <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded bg-amber-500 text-white font-bold text-[9px] shadow-2xs">
                                          L
                                        </span>
                                      )}
                                      {st === "holiday" && (
                                        <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded bg-slate-500 text-white font-bold text-[8.5px] shadow-2xs">
                                          H
                                        </span>
                                      )}
                                      {!st && <span className="text-muted-foreground/30 font-bold text-[10px]">-</span>}
                                    </td>
                                  );
                                })}
                                <td className="py-1 px-2 text-center font-mono font-bold text-foreground text-[11px] border border-border">
                                  {pCount}/{tot}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend matching Image 1 */}
                  <div className="p-3 border-t border-border/60 bg-muted/10 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">Present</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-muted-foreground">Absent</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-muted-foreground">Leave</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
          </div>
        </>
      )}
    </div>
  );
}
