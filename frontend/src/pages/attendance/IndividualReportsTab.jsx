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

const getInitials = (name) => {
  if (!name) return "ST";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};


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

  const studentReport = reportData[0] || (selectedStudent?.attendance?.length || selectedStudent?.subjects?.length ? selectedStudent : null);

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

  // Attendance records for the student
  const attendanceList = useMemo(() => {
    return studentReport?.attendance || studentReport?.subjects?.[0]?.attendance || [];
  }, [studentReport]);

  // Distinct marked class dates in range (Excluding 'no marked' and holiday dates)
  const dateList = useMemo(() => {
    if (!startDate || !endDate || !attendanceList.length) return [];
    const markedDates = new Set();

    attendanceList.forEach((item) => {
      const st = String(item.status || "").toLowerCase();
      if (
        st === "present" ||
        st === "absent" ||
        st === "leave" ||
        st === "short_leave" ||
        st === "half_day" ||
        st === "hd" ||
        st === "late"
      ) {
        const k = typeof item.date === "string" ? item.date.slice(0, 10) : toLocalDateKey(new Date(item.date));
        if (k >= startDate && k <= endDate) {
          markedDates.add(k);
        }
      }
    });

    return Array.from(markedDates).sort();
  }, [attendanceList, startDate, endDate]);

  // Overall Statistics Calculation
  const stats = useMemo(() => {
    if (!startDate || !endDate) {
      return { totalDays: 0, presentCount: 0, absentCount: 0, leaveCount: 0, holidayCount: 0, totalClasses: 0, effectiveClasses: 0, percentage: 0 };
    }

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let holidayCount = 0;

    attendanceList.forEach((item) => {
      const st = String(item.status || "").toLowerCase();
      if (st === "present" || st === "short_leave" || st === "half_day" || st === "hd" || st === "late") presentCount++;
      else if (st === "absent") absentCount++;
      else if (st === "leave") leaveCount++;
      else if (st === "holiday") holidayCount++;
    });

    const totalDays = dateList.length;
    const totalClasses = presentCount + absentCount + leaveCount + holidayCount;
    const effectiveClasses = presentCount + absentCount + leaveCount;
    const percentage = effectiveClasses > 0 ? Number(((presentCount / effectiveClasses) * 100).toFixed(1)) : 0;

    return { totalDays, presentCount, absentCount, leaveCount, holidayCount, totalClasses, effectiveClasses, percentage };
  }, [attendanceList, startDate, endDate, dateList]);

  // Sorted daily attendance records for the detailed log table (ascending chronological order)
  const sortedDailyAttendance = useMemo(() => {
    return [...attendanceList]
      .filter((item) => {
        const k = typeof item.date === "string" ? item.date.slice(0, 10) : toLocalDateKey(new Date(item.date));
        return k >= startDate && k <= endDate;
      })
      .sort((a, b) => {
        const da = typeof a.date === "string" ? a.date.slice(0, 10) : toLocalDateKey(new Date(a.date));
        const db = typeof b.date === "string" ? b.date.slice(0, 10) : toLocalDateKey(new Date(b.date));
        return da.localeCompare(db);
      });
  }, [attendanceList, startDate, endDate]);

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

        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 4px 8px; text-align: left; border: 1px solid #cbd5e1; width: 40px;">#</th>
              <th style="padding: 4px 8px; text-align: left; border: 1px solid #cbd5e1; width: 130px;">Date</th>
              <th style="padding: 4px 8px; text-align: left; border: 1px solid #cbd5e1; width: 100px;">Day</th>
              <th style="padding: 4px 8px; text-align: center; border: 1px solid #cbd5e1; width: 90px;">Status</th>
              <th style="padding: 4px 8px; text-align: left; border: 1px solid #cbd5e1;">Remarks / Notes</th>
            </tr>
          </thead>
          <tbody>
            ${sortedDailyAttendance.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8; border: 1px solid #cbd5e1;">
                  No attendance records found for this period.
                </td>
              </tr>
            ` : sortedDailyAttendance.map((item, idx) => {
              const dt = new Date(`${typeof item.date === "string" ? item.date.slice(0, 10) : toLocalDateKey(new Date(item.date))}T00:00:00`);
              const dateStr = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const dayStr = dt.toLocaleDateString("en-US", { weekday: "long" });
              const st = String(item.status || "").toLowerCase();
              const badgeClass = st === "present" || st === "short_leave" || st === "half_day" || st === "hd" || st === "late"
                ? "badge-p"
                : st === "absent"
                ? "badge-a"
                : st === "leave"
                ? "badge-l"
                : "badge-h";
              const label = (st || "—").toUpperCase();
              return `
                <tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                  <td style="padding: 3px 8px; border: 1px solid #cbd5e1; font-family: monospace;">${idx + 1}</td>
                  <td style="padding: 3px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${dateStr}</td>
                  <td style="padding: 3px 8px; border: 1px solid #cbd5e1; color: #475569;">${dayStr}</td>
                  <td style="padding: 3px 8px; border: 1px solid #cbd5e1; text-align: center;"><span class="${badgeClass}">${label}</span></td>
                  <td style="padding: 3px 8px; border: 1px solid #cbd5e1; color: #64748b;">${item.remarks || item.note || item.notes || "—"}</td>
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
                    <div className="text-[10px] text-muted-foreground">Attendance Rate</div>
                    <div className="text-[11px] font-semibold text-emerald-600 font-mono mt-0.5">
                      {stats.presentCount} / {stats.effectiveClasses}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              3. DAILY ATTENDANCE HISTORY LOG
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="w-full">
            <Card className="border border-border/80 shadow-xs rounded-xl overflow-hidden bg-card">
              <CardHeader className="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Daily Attendance Log
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Individual student attendance history for the selected date range
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px] font-normal gap-1 bg-background">
                  <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                  <span>{dateRangeDisplay}</span>
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur-xs">
                      <tr className="border-b border-border text-muted-foreground text-[11px]">
                        <th className="py-2.5 px-4 text-left font-semibold w-16">#</th>
                        <th className="py-2.5 px-4 text-left font-semibold w-36">Date</th>
                        <th className="py-2.5 px-4 text-left font-semibold w-32">Day</th>
                        <th className="py-2.5 px-4 text-center font-semibold w-28">Status</th>
                        <th className="py-2.5 px-4 text-left font-semibold">Remarks / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {sortedDailyAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-xs text-muted-foreground">
                            No attendance records found for this student in the selected period.
                          </td>
                        </tr>
                      ) : (
                        sortedDailyAttendance.map((item, idx) => {
                          const dt = new Date(`${typeof item.date === "string" ? item.date.slice(0, 10) : toLocalDateKey(new Date(item.date))}T00:00:00`);
                          const dateStr = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                          const dayStr = dt.toLocaleDateString("en-US", { weekday: "long" });
                          const st = String(item.status || "").toLowerCase();

                          let badgeElement = null;
                          if (st === "present" || st === "short_leave" || st === "half_day" || st === "hd" || st === "late") {
                            badgeElement = (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 hover:bg-emerald-100">
                                Present
                              </Badge>
                            );
                          } else if (st === "absent") {
                            badgeElement = (
                              <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 hover:bg-rose-100">
                                Absent
                              </Badge>
                            );
                          } else if (st === "leave") {
                            badgeElement = (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 hover:bg-amber-100">
                                Leave
                              </Badge>
                            );
                          } else if (st === "holiday") {
                            badgeElement = (
                              <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 hover:bg-slate-100">
                                Holiday
                              </Badge>
                            );
                          } else {
                            badgeElement = (
                              <span className="text-muted-foreground font-mono text-xs">-</span>
                            );
                          }

                          return (
                            <tr key={item._id || item.id || idx} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-muted-foreground text-[11px]">{idx + 1}</td>
                              <td className="py-2.5 px-4 font-semibold text-foreground">{dateStr}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">{dayStr}</td>
                              <td className="py-2.5 px-4 text-center">{badgeElement}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">
                                {item.remarks || item.note || item.notes || "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer stats summary */}
                <div className="p-3 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Present: <strong className="text-foreground">{stats.presentCount}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Absent: <strong className="text-foreground">{stats.absentCount}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Leave: <strong className="text-foreground">{stats.leaveCount}</strong>
                    </span>
                  </div>
                  <div>
                    Total Records: <strong className="text-foreground">{sortedDailyAttendance.length}</strong>
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
