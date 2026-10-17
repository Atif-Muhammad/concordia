import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar as CalendarIcon,
  Search,
  Download,
  Printer,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowLeft,
  RotateCcw,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  User,
  Star,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  getAcademicSessions,
  getClasses,
  getSections,
  getTeacherClasses,
  getAttendanceReport,
  getProgramNames,
  getSubjectsForClassWithAssignments,
} from "../../../config/apis";
import { hasPermission } from "@/lib/navigation.jsx";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import IndividualReportsTab from "./IndividualReportsTab.jsx";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return String(val._id || val.id || "");
  return String(val);
};

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

const formatDateRangeDisplay = (startStr, endStr) => {
  if (!startStr || !endStr) return "Select date range";
  try {
    const s = new Date(`${startStr}T00:00:00`);
    const e = new Date(`${endStr}T00:00:00`);
    const sMonth = s.toLocaleDateString("en-US", { month: "short" });
    const sDay = s.getDate().toString().padStart(2, "0");
    const eMonth = e.toLocaleDateString("en-US", { month: "short" });
    const eDay = e.getDate().toString().padStart(2, "0");
    const eYear = e.getFullYear();

    if (s.getFullYear() === e.getFullYear() && sMonth === eMonth) {
      return `${sMonth} ${sDay} – ${eDay}, ${eYear}`;
    }
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${eYear}`;
  } catch (err) {
    return `${startStr} – ${endStr}`;
  }
};

const CircularProgressRing = ({ percentage = 0, size = 64, strokeWidth = 6 }) => {
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

const renderAttendanceStatusBadge = (pct) => {
  if (pct >= 95) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80">
        <span className="text-[11px] leading-none">★</span> Excellent
      </span>
    );
  }
  if (pct >= 80) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80">
        <span className="text-[11px] leading-none">✓</span> Good
      </span>
    );
  }
  if (pct >= 75) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80">
        <span className="text-[11px] leading-none">⚠</span> Needs Attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80">
      <span className="text-[11px] leading-none">✕</span> At Risk
    </span>
  );
};

export default function AttendanceReportsTab({ onBack }) {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData(["currentUser"]);
  const isTeacher =
    currentUser?.role === "Teacher" || currentUser?.role === "TEACHER";
  const canViewAllReports = Boolean(
    currentUser?.permissions?.all === true ||
      hasPermission(currentUser, "Attendance", "reports", "read")
  );
  const isTeacherScoped = isTeacher && !canViewAllReports;

  // Selected Student Drilldown View
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);

  // Filters State
  const now = new Date();
  const defaultStart = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEnd = toLocalDateKey(now);

  const [reportStartDate, setReportStartDate] = useState(defaultStart);
  const [reportEndDate, setReportEndDate] = useState(defaultEnd);
  const [reportProgramId, setReportProgramId] = useState("");
  const [reportClassId, setReportClassId] = useState("");
  const [reportSectionId, setReportSectionId] = useState("");
  const [reportSessionId, setReportSessionId] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Date Range Popover Local State
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(defaultStart);
  const [tempEndDate, setTempEndDate] = useState(defaultEnd);

  // Scroll Sentinel State (Fetch on scroll)
  const scrollSentinelRef = useRef(null);
  const BATCH_SIZE = 15;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Academic Sessions
  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  const activeSession = useMemo(() => {
    return (
      academicSessions.find(
        (s) => s.isActive === true || s.isActive === "true" || s.isCurrent || s.status === "ACTIVE"
      ) ||
      academicSessions[0] ||
      null
    );
  }, [academicSessions]);
  const activeSessionId = activeSession ? extractId(activeSession) : "";

  // Pre-select active session
  useEffect(() => {
    if ((!reportSessionId || reportSessionId === "all") && activeSessionId) {
      setReportSessionId(activeSessionId);
    }
  }, [activeSessionId, reportSessionId]);

  // Programs, Classes, Sections
  const { data: allPrograms = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: getProgramNames,
  });

  const { data: allClasses = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: allSections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  const teacherStaffId = currentUser?.refId || currentUser?.staffDbId || currentUser?.id;
  const { data: rawTeacherClassMappings = [] } = useQuery({
    queryKey: ["teacherClasses", teacherStaffId],
    queryFn: () => getTeacherClasses(teacherStaffId),
    enabled: isTeacherScoped && !!teacherStaffId,
  });

  const teacherClassMappings = useMemo(() => {
    return Array.isArray(rawTeacherClassMappings)
      ? rawTeacherClassMappings
      : rawTeacherClassMappings?.data || [];
  }, [rawTeacherClassMappings]);

  const availablePrograms = useMemo(() => {
    if (!isTeacherScoped) return allPrograms;
    const teacherProgMap = new Map();
    teacherClassMappings.forEach((m) => {
      const cls = m.classId || m.class;
      const prog = cls?.programId || cls?.program || m.programId || m.program;
      const pId = extractId(prog);
      if (pId) {
        teacherProgMap.set(
          pId,
          prog?.name
            ? prog
            : allPrograms.find((p) => extractId(p) === pId) || { _id: pId, id: pId, name: pId }
        );
      }
    });
    return Array.from(teacherProgMap.values());
  }, [allPrograms, isTeacherScoped, teacherClassMappings]);

  const teacherClasses = useMemo(() => {
    if (!isTeacherScoped) return [];
    const mapped = teacherClassMappings
      .map((mapping) => {
        const cls = mapping.classId || mapping.class;
        if (!cls) return null;
        const prog = cls.programId || cls.program || mapping.programId || mapping.program;
        return {
          ...cls,
          id: extractId(cls),
          _id: extractId(cls),
          programId: prog,
          program: prog,
          programName: prog?.name || "N/A",
        };
      })
      .filter(Boolean);
    return mapped.filter(
      (c, idx, arr) => arr.findIndex((x) => extractId(x) === extractId(c)) === idx
    );
  }, [isTeacherScoped, teacherClassMappings]);

  // Program selection filters linked classes
  const reportFilteredClasses = useMemo(() => {
    const baseList = isTeacherScoped ? teacherClasses : allClasses;
    if (!reportProgramId || reportProgramId === "*") return baseList;
    return baseList.filter((c) => {
      const pId = extractId(c.programId || c.program);
      return pId === reportProgramId;
    });
  }, [isTeacherScoped, teacherClasses, allClasses, reportProgramId]);

  const selectedClass = useMemo(() => {
    return reportFilteredClasses.find((c) => extractId(c) === reportClassId) || null;
  }, [reportFilteredClasses, reportClassId]);

  const isSectionApplicable = selectedClass ? selectedClass.allowSections !== false : true;

  const availableSections = useMemo(() => {
    if (!reportClassId || reportClassId === "*" || !isSectionApplicable) return [];
    if (isTeacherScoped) {
      const matching = teacherClassMappings.filter(
        (m) => extractId(m.classId || m.class) === reportClassId
      );
      const secs = matching.map((m) => m.sectionId || m.section).filter(Boolean);
      return secs.filter(
        (s, idx, arr) => arr.findIndex((x) => extractId(x) === extractId(s)) === idx
      );
    }
    return allSections.filter((s) => extractId(s.classId || s.class) === reportClassId);
  }, [reportClassId, isSectionApplicable, isTeacherScoped, teacherClassMappings, allSections]);

  const selectedSection = useMemo(() => {
    return availableSections.find((s) => extractId(s) === reportSectionId) || null;
  }, [availableSections, reportSectionId]);

  const classSectionLabel = useMemo(() => {
    if (!selectedClass) return "All Classes";
    const cName = selectedClass.name || selectedClass.className || "Class";
    if (selectedSection) {
      return `In ${cName} - ${selectedSection.name || selectedSection.sectionName}`;
    }
    return `In ${cName}`;
  }, [selectedClass, selectedSection]);

  // Fetch accurate subjects for the selected class from backend
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["classSubjects", reportClassId, reportSessionId, reportSectionId, activeSessionId],
    queryFn: () => {
      const sectionParam =
        isSectionApplicable && reportSectionId && reportSectionId !== "*"
          ? reportSectionId
          : undefined;
      const sessionParam =
        reportSessionId && reportSessionId !== "all" ? reportSessionId : (activeSessionId || undefined);
      return getSubjectsForClassWithAssignments(reportClassId, sessionParam, sectionParam);
    },
    enabled: Boolean(reportClassId && reportClassId !== "*"),
  });

  // Main Report Query (runs only when filters are actively selected)
  const isFilterReady = Boolean(
    reportStartDate &&
      reportEndDate &&
      reportClassId &&
      reportClassId !== "*" &&
      reportClassId !== ""
  );

  const {
    data: reportData = [],
    refetch: refetchReport,
    isFetching: isFetchingReport,
  } = useQuery({
    queryKey: [
      "attendanceReport",
      reportStartDate,
      reportEndDate,
      reportProgramId,
      reportClassId,
      reportSectionId,
      reportSessionId,
      activeSessionId,
    ],
    queryFn: () => {
      const classParam = reportClassId === "*" ? "" : reportClassId;
      const sectionParam = reportSectionId === "*" ? "" : reportSectionId;
      const sessionParam =
        reportSessionId && reportSessionId !== "all"
          ? reportSessionId
          : (activeSessionId || undefined);
      const programParam = reportProgramId === "*" ? "" : reportProgramId;
      return getAttendanceReport(
        reportStartDate,
        reportEndDate,
        classParam,
        sectionParam,
        sessionParam,
        programParam
      );
    },
    enabled: isFilterReady,
  });

  // Extract Distinct Subjects: accurately from classSubjects + reportData (STRICTLY NO "General"!)
  const distinctSubjects = useMemo(() => {
    const map = new Map();

    (classSubjects || []).forEach((sub) => {
      const id = String(sub.id || sub._id || sub.subjectId || "");
      const name = sub.name || sub.code || "";
      if (id && name && name.toLowerCase() !== "general") {
        map.set(id, { id, name });
      }
    });

    (reportData || []).forEach((student) => {
      student.subjects?.forEach((subj) => {
        const id = String(subj.subjectId || subj.id || "");
        const name = subj.subjectName || subj.name || "";
        if (id && name && name.toLowerCase() !== "general" && !map.has(id)) {
          map.set(id, { id, name });
        }
      });
    });

    return Array.from(map.values());
  }, [classSubjects, reportData]);

  // Filtered Students (Search Query Filter)
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return reportData;
    const q = studentSearchQuery.toLowerCase().trim();
    return reportData.filter((student) => {
      const roll = String(student.rollNumber || "").toLowerCase();
      const name = String(student.name || "").toLowerCase();
      const father = String(student.fatherName || "").toLowerCase();
      return roll.includes(q) || name.includes(q) || father.includes(q);
    });
  }, [reportData, studentSearchQuery]);

  // Distinct marked class dates in the selected period (Excluding 'no marked' and holiday dates)
  const dateList = useMemo(() => {
    if (!reportStartDate || !reportEndDate || !filteredStudents.length) return [];
    const markedDates = new Set();

    filteredStudents.forEach((student) => {
      (student.subjects || []).forEach((sub) => {
        if (selectedSubjectFilter && selectedSubjectFilter !== "all") {
          if (String(sub.subjectId || sub.id) !== String(selectedSubjectFilter)) return;
        }
        (sub.attendance || []).forEach((att) => {
          const st = String(att.status || "").toLowerCase();
          // Exclude holidays and unmarked entries
          if (
            st === "present" ||
            st === "absent" ||
            st === "leave" ||
            st === "short_leave" ||
            st === "half_day" ||
            st === "hd"
          ) {
            const k = typeof att.date === "string" ? att.date.slice(0, 10) : toLocalDateKey(new Date(att.date));
            if (k >= reportStartDate && k <= reportEndDate) {
              markedDates.add(k);
            }
          }
        });
      });
    });

    return Array.from(markedDates).sort();
  }, [reportStartDate, reportEndDate, filteredStudents, selectedSubjectFilter]);

  // Accordion Expanded Students State (Matching Image representation)
  const [expandedStudentIds, setExpandedStudentIds] = useState(() => new Set());

  const toggleExpandStudent = (sId) => {
    setExpandedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(sId)) {
        next.delete(sId);
      } else {
        next.add(sId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = new Set(filteredStudents.map((s) => s.id || s._id));
    setExpandedStudentIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedStudentIds(new Set());
  };

  // Reset visibleCount and collapse all rows on filter or search changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    setExpandedStudentIds(new Set());
  }, [
    studentSearchQuery,
    reportClassId,
    reportSectionId,
    reportProgramId,
    selectedSubjectFilter,
    reportStartDate,
    reportEndDate,
  ]);

  // Observer for fetch on scroll
  useEffect(() => {
    const el = scrollSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredStudents.length) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredStudents.length));
        }
      },
      { threshold: 0.1, rootMargin: "150px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filteredStudents.length]);

  // Metric Calculation for Each Student (matches Image 2 exact logic)
  const studentMetricsMap = useMemo(() => {
    const map = new Map();

    filteredStudents.forEach((student) => {
      let present = 0;
      let absent = 0;
      let leave = 0;
      let holiday = 0;

      const subjectsToConsider =
        selectedSubjectFilter === "all" || !selectedSubjectFilter
          ? (student.subjects || []).filter(
              (s) => s.subjectName && s.subjectName.toLowerCase() !== "general"
            )
          : (student.subjects || []).filter(
              (s) => String(s.subjectId || s.id) === String(selectedSubjectFilter)
            );

      subjectsToConsider.forEach((sub) => {
        (sub.attendance || []).forEach((att) => {
          const st = String(att.status || "").toLowerCase();
          if (st === "present" || st === "short_leave" || st === "half_day" || st === "hd") {
            present++;
          } else if (st === "absent") {
            absent++;
          } else if (st === "leave") {
            leave++;
          } else if (st === "holiday") {
            holiday++;
          }
        });
      });

      const totalClasses = present + absent + leave + holiday;
      const effectiveTotal = totalClasses - holiday > 0 ? totalClasses - holiday : totalClasses;
      const pct =
        effectiveTotal > 0
          ? Math.round((present / effectiveTotal) * 1000) / 10
          : 0;

      const sId = student.id || student._id;
      map.set(sId, {
        totalClasses,
        present,
        absent,
        leave,
        holiday,
        pct,
      });
    });

    return map;
  }, [filteredStudents, selectedSubjectFilter]);

  // Top Summary Cards (6 Cards matching Image 2)
  const summaryStats = useMemo(() => {
    const totalStudents = filteredStudents.length;
    if (totalStudents === 0) {
      return {
        totalStudents: 0,
        presentCount: 0,
        presentPct: "0.0%",
        absentCount: 0,
        absentPct: "0.0%",
        leaveCount: 0,
        leavePct: "0.0%",
        holidayCount: 0,
        holidayPct: "0.0%",
        overallPct: 0,
      };
    }

    let sumPresent = 0;
    let sumAbsent = 0;
    let sumLeave = 0;
    let sumHoliday = 0;

    filteredStudents.forEach((s) => {
      const sId = s.id || s._id;
      const m = studentMetricsMap.get(sId);
      if (m) {
        sumPresent += m.present;
        sumAbsent += m.absent;
        sumLeave += m.leave;
        sumHoliday += m.holiday;
      }
    });

    const totalAllMarks = sumPresent + sumAbsent + sumLeave + sumHoliday;
    const presentRatio = totalAllMarks > 0 ? sumPresent / totalAllMarks : 0;
    const absentRatio = totalAllMarks > 0 ? sumAbsent / totalAllMarks : 0;
    const leaveRatio = totalAllMarks > 0 ? sumLeave / totalAllMarks : 0;
    const holidayRatio = totalAllMarks > 0 ? sumHoliday / totalAllMarks : 0;

    const presentPct = (presentRatio * 100).toFixed(1) + "%";
    const absentPct = (absentRatio * 100).toFixed(1) + "%";
    const leavePct = (leaveRatio * 100).toFixed(1) + "%";
    const holidayPct = (holidayRatio * 100).toFixed(1) + "%";

    // Normalized counts relative to totalStudents (e.g. 28 + 3 + 1 = 32)
    const presentCount = Math.round(presentRatio * totalStudents);
    const absentCount = Math.round(absentRatio * totalStudents);
    const leaveCount = Math.round(leaveRatio * totalStudents);
    const holidayCount = Math.max(
      0,
      totalStudents - (presentCount + absentCount + leaveCount)
    );

    const effectiveTotalMarks =
      totalAllMarks - sumHoliday > 0 ? totalAllMarks - sumHoliday : totalAllMarks;
    const overallPct =
      effectiveTotalMarks > 0
        ? Math.round((sumPresent / effectiveTotalMarks) * 1000) / 10
        : 0;

    return {
      totalStudents,
      presentCount,
      presentPct,
      absentCount,
      absentPct,
      leaveCount,
      leavePct,
      holidayCount,
      holidayPct,
      overallPct,
    };
  }, [filteredStudents, studentMetricsMap]);

  // Paged Students (Slice for fetch on scroll)
  const pagedStudents = useMemo(() => {
    return filteredStudents.slice(0, visibleCount);
  }, [filteredStudents, visibleCount]);

  // Date Range Popover Handlers
  const handlePresetRange = (preset) => {
    const curNow = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === "this_month") {
      start = new Date(curNow.getFullYear(), curNow.getMonth(), 1);
      end = new Date(curNow.getFullYear(), curNow.getMonth() + 1, 0);
    } else if (preset === "last_month") {
      start = new Date(curNow.getFullYear(), curNow.getMonth() - 1, 1);
      end = new Date(curNow.getFullYear(), curNow.getMonth(), 0);
    } else if (preset === "last_30_days") {
      start = new Date(curNow);
      start.setDate(curNow.getDate() - 30);
    } else if (preset === "last_7_days") {
      start = new Date(curNow);
      start.setDate(curNow.getDate() - 7);
    }

    const sStr = toLocalDateKey(start);
    const eStr = toLocalDateKey(end);
    setTempStartDate(sStr);
    setTempEndDate(eStr);
    setReportStartDate(sStr);
    setReportEndDate(eStr);
    setIsDateRangeOpen(false);
  };

  const handleApplyDateRange = () => {
    if (tempStartDate && tempEndDate) {
      setReportStartDate(tempStartDate);
      setReportEndDate(tempEndDate);
      setIsDateRangeOpen(false);
    }
  };

  // Print Functionality using openManagedPrintWindow (Matching Image representation)
  const printAttendanceReport = async () => {
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

    const sessionObj = academicSessions.find(
      (s) => String(s.id || s._id) === String(reportSessionId)
    );
    const sessionLabel =
      sessionObj?.name ||
      (!reportSessionId || reportSessionId === "all" ? "All Sessions" : reportSessionId);

    const progObj = availablePrograms.find((p) => extractId(p) === reportProgramId);
    const programLabel =
      progObj?.name || (!reportProgramId || reportProgramId === "*" ? "All Programs" : reportProgramId);

    const classObj = reportFilteredClasses.find((c) => extractId(c) === reportClassId);
    const classLabel =
      classObj?.name || (!reportClassId || reportClassId === "*" ? "All Classes" : reportClassId);

    const secObj = availableSections.find((s) => extractId(s) === reportSectionId);
    const sectionLabel = isSectionApplicable
      ? secObj?.name || (!reportSectionId || reportSectionId === "*" ? "All Sections" : reportSectionId)
      : "N/A (No Section)";

    const formattedStartDate = reportStartDate
      ? new Date(`${reportStartDate}T00:00:00`).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";
    const formattedEndDate = reportEndDate
      ? new Date(`${reportEndDate}T00:00:00`).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";
    const printDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const numDates = dateList.length || 1;
    // Dynamic styles based on column count so columns contract cleanly without overflow
    const dynamicThFont = numDates > 24 ? "7px" : numDates > 16 ? "8px" : numDates > 10 ? "8.5px" : "9.5px";
    const dynamicSubThFont = numDates > 24 ? "6px" : numDates > 16 ? "7px" : "8px";
    const pillSize = numDates > 24 ? "14px" : numDates > 16 ? "17px" : "20px";
    const pillFontSize = numDates > 24 ? "6.5px" : numDates > 16 ? "8px" : "9px";
    const subjectColWidth = numDates > 24 ? "95px" : numDates > 16 ? "115px" : "135px";

    const dayHeadersHtml = dateList
      .map((d) => {
        const dt = new Date(`${d}T00:00:00`);
        const dayNum = dt.getDate();
        const monthShort = dt.toLocaleDateString("en-US", { month: "short" });
        const weekDay = dt.toLocaleDateString("en-US", { weekday: "short" });
        const topText = numDates > 18 ? `${dayNum}` : `${dayNum} ${monthShort}`;
        const subText = numDates > 22 ? weekDay.slice(0, 2) : weekDay;
        return `
          <th style="padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; background: #f8fafc; font-size: ${dynamicThFont}; font-weight: 700;">
            <div style="line-height: 1.1; color: #0f172a;">${topText}</div>
            <div style="font-size: ${dynamicSubThFont}; color: #64748b; text-transform: uppercase;">${subText}</div>
          </th>
        `;
      })
      .join("");

    const studentCardsHtml = filteredStudents
      .map((student) => {
        const sId = student.id || student._id;
        const m = studentMetricsMap.get(sId) || {
          totalClasses: 0,
          present: 0,
          absent: 0,
          leave: 0,
          holiday: 0,
          pct: 0,
        };

        const studentSubjects = (student.subjects || []).filter((s) => {
          if (!s.subjectName || s.subjectName.toLowerCase() === "general") return false;
          if (selectedSubjectFilter && selectedSubjectFilter !== "all") {
            return String(s.subjectId || s.id) === String(selectedSubjectFilter);
          }
          return true;
        });

        const subjectRowsHtml =
          studentSubjects.length === 0
            ? `<tr><td colspan="${numDates + 2}" style="padding: 6px; text-align: center; color: #94a3b8; font-size: 9px;">No subjects recorded</td></tr>`
            : studentSubjects
                .map((sub) => {
                  const cleanName = cleanSubjectName(sub.subjectName);
                  const attMap = {};
                  (sub.attendance || []).forEach((a) => {
                    const k = typeof a.date === "string" ? a.date.slice(0, 10) : toLocalDateKey(new Date(a.date));
                    attMap[k] = String(a.status || "").toLowerCase();
                  });

                  const pCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "present").length;
                  const aCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "absent").length;
                  const lCount = (sub.attendance || []).filter((a) => {
                    const s = String(a.status || "").toLowerCase();
                    return s === "leave" || s === "short_leave";
                  }).length;
                  const eff = pCount + aCount + lCount;
                  const subjPct = eff > 0 ? Math.round((pCount / eff) * 100) : 0;

                  const cellsHtml = dateList
                    .map((d) => {
                      const st = attMap[d];
                      if (st === "present") return `<td style="padding: 1px 0; text-align: center; border: 1px solid #cbd5e1;"><span class="pill pill-p">P</span></td>`;
                      if (st === "absent") return `<td style="padding: 1px 0; text-align: center; border: 1px solid #cbd5e1;"><span class="pill pill-a">A</span></td>`;
                      if (st === "leave" || st === "short_leave") return `<td style="padding: 1px 0; text-align: center; border: 1px solid #cbd5e1;"><span class="pill pill-l">L</span></td>`;
                      if (st === "holiday") return `<td style="padding: 1px 0; text-align: center; border: 1px solid #cbd5e1;"><span class="pill pill-h">H</span></td>`;
                      return `<td style="padding: 1px 0; text-align: center; border: 1px solid #cbd5e1; color: #cbd5e1; font-size: 8px;">-</td>`;
                    })
                    .join("");

                  return `
                    <tr>
                      <td style="padding: 2px 5px; border: 1px solid #cbd5e1; font-weight: 700; font-size: ${numDates > 20 ? '8px' : '9px'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #0f172a;">
                        ${cleanName}
                      </td>
                      ${cellsHtml}
                      <td style="padding: 2px 2px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; font-family: monospace; font-size: ${numDates > 20 ? '8px' : '9px'}; color: #0f172a;">
                        ${subjPct}%
                      </td>
                    </tr>
                  `;
                })
                .join("");

        return `
          <div class="student-card">
            <div class="student-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: monospace; font-weight: 700; font-size: 11px; color: #0f172a;">${student.rollNumber || "—"}</span>
                <span style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #0f172a;">${student.name || `${student.fName || ""} ${student.lName || ""}`.trim() || "—"}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="badge badge-p">P: ${m.present}</span>
                <span class="badge badge-a">A: ${m.absent}</span>
                <span class="badge badge-l">L: ${m.leave}</span>
                <span style="font-weight: 800; font-size: 11px; color: #0f172a; margin-left: 4px; font-family: monospace;">${m.pct.toFixed(1)}%</span>
              </div>
            </div>
            <table class="report-table">
              <thead>
                <tr>
                  <th style="width: ${subjectColWidth}; text-align: left; padding: 3px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 9px; font-weight: 700; color: #475569;">Subject</th>
                  ${dayHeadersHtml}
                  <th style="width: 38px; text-align: center; padding: 3px 2px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 9px; font-weight: 700; color: #475569;">%</th>
                </tr>
              </thead>
              <tbody>
                ${subjectRowsHtml}
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Students Attendance Report - ${classLabel}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 6mm 8mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 6px 10px; color: #0f172a; background: #fff; width: 100%; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #ea580c; padding-bottom: 8px; margin-bottom: 8px; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; font-size: 10.5px; }
          .stats-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 10px; text-align: center; }
          .stat-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; background: #f8fafc; }
          .stat-val { font-size: 13px; font-weight: bold; color: #0f172a; }
          .stat-lbl { font-size: 9px; color: #64748b; margin-top: 1px; }
          .student-card { page-break-inside: avoid; margin-bottom: 8px; border: 1.5px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #fff; width: 100%; }
          .student-header { background: #f1f5f9; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; }
          .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 9.5px; }
          .badge-p { background: #dcfce7 !important; color: #166534 !important; border: 1px solid #86efac; }
          .badge-a { background: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fca5a5; }
          .badge-l { background: #fef3c7 !important; color: #92400e !important; border: 1px solid #fde68a; }
          table.report-table { width: 100% !important; border-collapse: collapse; table-layout: fixed !important; }
          .pill { display: inline-block; text-align: center; width: 100%; max-width: ${pillSize}; height: ${pillSize}; line-height: ${pillSize}; border-radius: 3px; font-weight: 700; font-size: ${pillFontSize}; }
          .pill-p { background: #16a34a !important; color: #ffffff !important; }
          .pill-a { background: #dc2626 !important; color: #ffffff !important; }
          .pill-l { background: #f59e0b !important; color: #ffffff !important; }
          .pill-h { background: #64748b !important; color: #ffffff !important; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${logoDataUrl}" alt="Logo" style="height: 48px; width: auto; object-fit: contain;" />
            <div>
              <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">
                Concordia College Peshawar
              </div>
              <div style="font-family: 'Great Vibes', 'Dancing Script', cursive; font-size: 28px; color: #ea580c; line-height: 1.1; margin-top: 1px;">
                Students Attendance Report
              </div>
            </div>
          </div>
          <div style="text-align: right; font-size: 9.5px; color: #64748b;">
            <div>Printed: ${printDate}</div>
            <div>Total Students: ${filteredStudents.length}</div>
          </div>
        </div>

        <div class="meta">
          <div><strong>Class:</strong> ${classLabel}</div>
          <div><strong>Section:</strong> ${sectionLabel}</div>
          <div><strong>Session:</strong> ${sessionLabel}</div>
          <div><strong>Period:</strong> ${formattedStartDate} to ${formattedEndDate}</div>
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-val">${summaryStats.totalStudents}</div>
            <div class="stat-lbl">Total Students</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color: #15803d;">${summaryStats.presentCount} (${summaryStats.presentPct})</div>
            <div class="stat-lbl">Present</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color: #dc2626;">${summaryStats.absentCount} (${summaryStats.absentPct})</div>
            <div class="stat-lbl">Absent</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color: #b45309;">${summaryStats.leaveCount} (${summaryStats.leavePct})</div>
            <div class="stat-lbl">Leave</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color: #64748b;">${summaryStats.holidayCount} (${summaryStats.holidayPct})</div>
            <div class="stat-lbl">Holiday</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color: #15803d;">${summaryStats.overallPct}%</div>
            <div class="stat-lbl">Overall Attendance</div>
          </div>
        </div>

        ${studentCardsHtml}
      </body>
      </html>
    `;

    await openManagedPrintWindow({
      html: fullHtml,
      title: `Students_Attendance_${classLabel}_${sectionLabel}`,
    });
  };

  // If a student is clicked for drilldown, render IndividualReportsTab directly with their data
  if (selectedStudentForDetail) {
    return (
      <IndividualReportsTab
        initialStudent={selectedStudentForDetail}
        initialStartDate={reportStartDate}
        initialEndDate={reportEndDate}
        initialSessionId={reportSessionId || activeSessionId}
        onBack={() => setSelectedStudentForDetail(null)}
      />
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* Back Button if opened from navigation / parent hub */}
      {onBack && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-xs font-semibold shadow-xs hover:bg-muted"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Reports
          </Button>
        </div>
      )}

      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Class Attendance Report
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview of class attendance, metrics, and individual student breakdown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchReport()}
            disabled={!isFilterReady || isFetchingReport}
            className="h-8 w-8 p-0"
            title="Refresh Data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isFetchingReport ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filter Bar (Session, Program, Class, Section, Date Range, Subject, Search, Export) */}
      <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {/* Academic Session */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Academic Session
            </Label>
            <Select
              value={reportSessionId}
              onValueChange={(val) => setReportSessionId(val)}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="All Sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {academicSessions.map((s) => {
                  const sId = extractId(s);
                  const isAct = s.isActive === true || s.isActive === "true";
                  return (
                    <SelectItem key={sId} value={sId}>
                      {s.name || s.sessionName}{isAct ? " (Active)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Program: selecting program filters the linked classes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Program
            </Label>
            <Select
              value={reportProgramId}
              onValueChange={(val) => {
                setReportProgramId(val);
                setReportClassId("");
                setReportSectionId("");
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Select Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="*">All Programs</SelectItem>
                {availablePrograms.map((p) => (
                  <SelectItem key={extractId(p)} value={extractId(p)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class: lists classes belonging to the selected program */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Class
            </Label>
            <Select
              value={reportClassId}
              onValueChange={(val) => {
                setReportClassId(val);
                setReportSectionId("");
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {reportFilteredClasses.map((c) => (
                  <SelectItem key={extractId(c)} value={extractId(c)}>
                    {c.name || c.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section: lists sections for the selected class */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Section
            </Label>
            <Select
              value={reportSectionId}
              onValueChange={setReportSectionId}
              disabled={!reportClassId || !isSectionApplicable}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue
                  placeholder={!isSectionApplicable ? "Not Applicable" : "Select Section"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="*">All Sections</SelectItem>
                {isSectionApplicable &&
                  availableSections.map((s) => (
                    <SelectItem key={extractId(s)} value={extractId(s)}>
                      {s.name || s.sectionName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Popover */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Date Range
            </Label>
            <Popover open={isDateRangeOpen} onOpenChange={setIsDateRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-start text-xs font-normal gap-2 border-input bg-background"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate">
                    {formatDateRangeDisplay(reportStartDate, reportEndDate)}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Quick Presets
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-[11px] h-7"
                        onClick={() => handlePresetRange("this_month")}
                      >
                        This Month
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-[11px] h-7"
                        onClick={() => handlePresetRange("last_month")}
                      >
                        Last Month
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-[11px] h-7"
                        onClick={() => handlePresetRange("last_30_days")}
                      >
                        Last 30 Days
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-[11px] h-7"
                        onClick={() => handlePresetRange("last_7_days")}
                      >
                        Last 7 Days
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-2 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Start Date</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={tempStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">End Date</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={tempEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setIsDateRangeOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleApplyDateRange}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Subject Filter: Accurate subjects from backend, NO "General" */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Subject
            </Label>
            <Select
              value={selectedSubjectFilter}
              onValueChange={setSelectedSubjectFilter}
              disabled={!reportClassId}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {distinctSubjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Search */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Search Student
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name or roll no."
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs bg-background"
              />
            </div>
          </div>

          {/* Print Button (XLSX Export Removed) */}
          <div className="space-y-1.5 flex items-end">
            <Button
              onClick={printAttendanceReport}
              disabled={!filteredStudents.length}
              className="h-9 w-full gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </Button>
          </div>
        </div>
      </div>

      {!isFilterReady ? (
        <Card className="border border-border/80 shadow-xs rounded-xl p-12 text-center bg-card">
          <FileSpreadsheet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">
            Select Filters to Generate Report
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Please select a Class and Date Range from the filters above to load the student attendance list.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Top 6 Summary Cards (Exact Layout & Visual Style from Image 2) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Card 1: Total Students */}
            <Card className="p-4 rounded-xl border border-border/80 shadow-xs bg-card flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium truncate">
                  Total Students
                </p>
                <p className="text-2xl font-bold text-foreground leading-tight mt-0.5">
                  {summaryStats.totalStudents}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={classSectionLabel}>
                  {classSectionLabel}
                </p>
              </div>
            </Card>

            {/* Card 2: Present */}
            <Card className="p-4 rounded-xl border border-border/80 shadow-xs bg-card flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium truncate">
                  Present
                </p>
                <p className="text-2xl font-bold text-foreground leading-tight mt-0.5">
                  {summaryStats.presentCount}
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate mt-0.5">
                  {summaryStats.presentPct}
                </p>
              </div>
            </Card>

            {/* Card 3: Absent */}
            <Card className="p-4 rounded-xl border border-border/80 shadow-xs bg-card flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium truncate">
                  Absent
                </p>
                <p className="text-2xl font-bold text-foreground leading-tight mt-0.5">
                  {summaryStats.absentCount}
                </p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium truncate mt-0.5">
                  {summaryStats.absentPct}
                </p>
              </div>
            </Card>

            {/* Card 4: Leave */}
            <Card className="p-4 rounded-xl border border-border/80 shadow-xs bg-card flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium truncate">
                  Leave
                </p>
                <p className="text-2xl font-bold text-foreground leading-tight mt-0.5">
                  {summaryStats.leaveCount}
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate mt-0.5">
                  {summaryStats.leavePct}
                </p>
              </div>
            </Card>

            {/* Card 5: Holiday */}
            <Card className="p-4 rounded-xl border border-border/80 shadow-xs bg-card flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                <MinusCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium truncate">
                  Holiday
                </p>
                <p className="text-2xl font-bold text-foreground leading-tight mt-0.5">
                  {summaryStats.holidayCount}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {summaryStats.holidayPct}
                </p>
              </div>
            </Card>

            {/* Card 6: Overall Attendance Ring */}
            <Card className="p-3 rounded-xl border border-border/80 shadow-xs bg-card flex flex-col items-center justify-center text-center">
              <CircularProgressRing percentage={summaryStats.overallPct} size={64} strokeWidth={6} />
              <span className="text-[11px] text-muted-foreground font-medium mt-1.5">
                Overall Attendance
              </span>
            </Card>
          </div>

          {/* Students Attendance List (Accordion Representation Matching Image) */}
          <Card className="rounded-xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <div className="p-4 sm:p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Students Attendance List
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any student row to expand their subject attendance records
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExpandAll}
                  className="h-7 text-[11px] px-2.5 font-medium"
                >
                  Expand All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCollapseAll}
                  className="h-7 text-[11px] px-2.5 font-medium"
                >
                  Collapse All
                </Button>
              </div>
            </div>

            {/* List of Students (Accordion Representation matching Image) */}
            <div className="p-3 sm:p-4 space-y-3 max-h-[680px] overflow-y-auto">
              {isFetchingReport ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={`skel-${i}`} className="p-4 rounded-xl border border-border/70 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-72" />
                  </div>
                ))
              ) : pagedStudents.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {reportData.length === 0
                    ? "No attendance records found for this class and date range."
                    : "No students matching your search query."}
                </div>
              ) : (
                pagedStudents.map((student) => {
                  const sId = student.id || student._id;
                  const isExpanded = expandedStudentIds.has(sId);
                  const m = studentMetricsMap.get(sId) || {
                    totalClasses: 0,
                    present: 0,
                    absent: 0,
                    leave: 0,
                    holiday: 0,
                    pct: 0,
                  };

                  const studentSubjects = (student.subjects || []).filter((s) => {
                    if (!s.subjectName || s.subjectName.toLowerCase() === "general") return false;
                    if (selectedSubjectFilter && selectedSubjectFilter !== "all") {
                      return String(s.subjectId || s.id) === String(selectedSubjectFilter);
                    }
                    return true;
                  });

                  return (
                    <div
                      key={sId}
                      className="border border-border/80 rounded-xl overflow-hidden bg-card transition-all shadow-2xs hover:border-border"
                    >
                      {/* Student Row Header */}
                      <div
                        onClick={() => toggleExpandStudent(sId)}
                        className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                      >
                        {/* Left: Expand Chevron, Roll No, Student Name */}
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 transition-transform"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>

                          <span className="font-mono text-xs sm:text-sm font-bold text-foreground shrink-0">
                            {student.rollNumber || "—"}
                          </span>

                          <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                            {student.name || `${student.fName || ""} ${student.lName || ""}`.trim() || "—"}
                          </span>
                        </div>

                        {/* Right: Badges P, A, L & Overall % */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80">
                            P: {m.present}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200/80">
                            A: {m.absent}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200/80">
                            L: {m.leave}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-foreground min-w-[48px] text-right font-mono">
                            {m.pct.toFixed(1)}%
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentForDetail(student);
                            }}
                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary gap-1"
                            title="Open Detailed Report"
                          >
                            <span className="hidden lg:inline">Detail</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Sub-Table */}
                      {isExpanded && (
                        <div className="border-t border-border/70 bg-muted/15 p-2 sm:p-3">
                          <div className="overflow-x-auto w-full">
                            <table className="w-full text-[11px] border-collapse border border-border">
                              <thead>
                                <tr className="bg-muted/50 text-muted-foreground text-[10px]">
                                  <th className="py-1 px-2.5 text-left font-bold text-foreground border border-border sticky left-0 bg-muted/95 backdrop-blur-xs z-10 w-32 sm:w-40 whitespace-nowrap text-[11px]">
                                    Subject
                                  </th>
                                  {dateList.map((d) => {
                                    const dt = new Date(`${d}T00:00:00`);
                                    const dayNum = dt.getDate();
                                    const monthShort = dt.toLocaleDateString("en-US", { month: "short" });
                                    const weekDay = dt.toLocaleDateString("en-US", { weekday: "short" });
                                    return (
                                      <th
                                        key={d}
                                        className="py-1 px-0.5 text-center font-semibold border border-border min-w-[24px] sm:min-w-[28px]"
                                      >
                                        <div className="text-[10px] text-foreground font-bold leading-tight">
                                          {dateList.length > 20 ? dayNum : `${dayNum} ${monthShort}`}
                                        </div>
                                        <div className="text-[8.5px] text-muted-foreground uppercase font-medium leading-none">
                                          {dateList.length > 22 ? weekDay.slice(0, 2) : weekDay}
                                        </div>
                                      </th>
                                    );
                                  })}
                                  <th className="py-1 px-2 text-center font-bold text-foreground border border-border w-14 text-[11px]">
                                    %
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {studentSubjects.length === 0 ? (
                                  <tr>
                                    <td colSpan={dateList.length + 2} className="py-3 text-center text-xs text-muted-foreground border border-border">
                                      No subjects recorded for this student.
                                    </td>
                                  </tr>
                                ) : (
                                  studentSubjects.map((sub, sIdx) => {
                                    const cleanName = cleanSubjectName(sub.subjectName);
                                    const attMap = {};
                                    (sub.attendance || []).forEach((a) => {
                                      const k = typeof a.date === "string" ? a.date.slice(0, 10) : toLocalDateKey(new Date(a.date));
                                      attMap[k] = String(a.status || "").toLowerCase();
                                    });

                                    const pCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "present").length;
                                    const aCount = (sub.attendance || []).filter((a) => String(a.status || "").toLowerCase() === "absent").length;
                                    const lCount = (sub.attendance || []).filter((a) => {
                                      const s = String(a.status || "").toLowerCase();
                                      return s === "leave" || s === "short_leave";
                                    }).length;
                                    const eff = pCount + aCount + lCount;
                                    const subjPct = eff > 0 ? Math.round((pCount / eff) * 100) : 0;

                                    return (
                                      <tr key={sub.subjectId || sIdx} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-1 px-2.5 font-medium text-foreground text-[11px] border border-border sticky left-0 bg-card z-10 whitespace-nowrap">
                                          {cleanName}
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
                                              {!st && (
                                                <span className="text-muted-foreground/30 font-bold text-[10px]">-</span>
                                              )}
                                            </td>
                                          );
                                        })}

                                        <td className="py-1 px-2 text-center font-bold text-foreground font-mono text-[11px] border border-border">
                                          {subjPct}%
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {/* Scroll Sentinel for Fetch on Scroll */}
              <div ref={scrollSentinelRef} className="h-6 w-full" />
            </div>

            {/* Scroll Pagination Footer */}
            {filteredStudents.length > 0 && (
              <div className="px-4 py-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                <span>
                  Showing {pagedStudents.length} of {filteredStudents.length} students
                </span>
                {visibleCount < filteredStudents.length ? (
                  <span className="text-[11px] text-muted-foreground animate-pulse font-medium">
                    Scroll down to load more students...
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    All {filteredStudents.length} students loaded
                  </span>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
