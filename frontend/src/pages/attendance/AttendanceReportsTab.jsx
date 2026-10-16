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
  ArrowLeft,
  RotateCcw,
  FileSpreadsheet,
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

const getInitials = (name) => {
  if (!name) return "ST";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getWeeklyGroups = (startDateStr, endDateStr, attendanceList) => {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const attMap = new Map();
  (attendanceList || []).forEach((item) => {
    let dStr = "";
    if (typeof item.date === "string") {
      dStr = item.date.slice(0, 10);
    } else if (item.date instanceof Date) {
      dStr = toLocalDateKey(item.date);
    }
    if (dStr) {
      attMap.set(dStr, {
        status: String(item.status || "").toLowerCase(),
        notes: item.notes || "",
      });
    }
  });

  const weeks = [];
  let current = new Date(start);
  let weekIndex = 1;

  while (current <= end) {
    const weekStart = new Date(current);
    const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon ...
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sundayDate = new Date(current);
    sundayDate.setDate(current.getDate() + daysToSunday);
    const weekEnd = sundayDate > end ? new Date(end) : sundayDate;

    const days = [];
    let d = new Date(weekStart);
    while (d <= weekEnd) {
      const dKey = toLocalDateKey(d);
      const record = attMap.get(dKey);

      days.push({
        dateKey: dKey,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        formattedDate: d.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        status: record ? record.status : "not_marked",
        notes: record?.notes || "",
      });
      d.setDate(d.getDate() + 1);
    }

    const markedDays = days.filter(
      (x) =>
        x.status &&
        x.status !== "not_marked" &&
        x.status !== "holiday"
    );
    const attendedDays = days.filter(
      (x) => x.status === "present" || x.status === "short_leave"
    );
    const totalMarked = markedDays.length;
    const attendedCount = attendedDays.length;
    const weekPercent =
      totalMarked > 0 ? Math.round((attendedCount / totalMarked) * 100) : 0;

    if (days.length > 0) {
      weeks.push({
        weekIndex,
        weekStart: weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        weekEnd: weekEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        days,
        totalMarked,
        attendedCount,
        weekPercent,
      });
    }

    weekIndex++;
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 1);
  }

  return weeks;
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

  // 1. By default, do NOT select any filter!
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportProgramId, setReportProgramId] = useState("");
  const [reportClassId, setReportClassId] = useState("");
  const [reportSectionId, setReportSectionId] = useState("");
  const [reportSessionId, setReportSessionId] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Date Range Popover Local State
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");

  // 6. Pagination on scroll
  const scrollSentinelRef = useRef(null);
  const BATCH_SIZE = 15;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // 3. Selection for Subject Details Panel (Student + clicked Subject cell)
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedDetailSubjectId, setSelectedDetailSubjectId] = useState(null);

  // Academic Sessions
  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  const activeSession = useMemo(() => {
    return academicSessions.find((s) => s.isActive === true || s.isActive === "true") || null;
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

  // 1. Program selection filters linked classes
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

  // 2. Fetch accurate subjects for the selected class from backend
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

  // 2. Extract Distinct Subjects: accurately from classSubjects + reportData (STRICTLY NO "General"!)
  const distinctSubjects = useMemo(() => {
    const map = new Map();

    // First add from classSubjects (the definitive assigned subjects for this class)
    (classSubjects || []).forEach((sub) => {
      const id = String(sub.id || sub._id || sub.subjectId || "");
      const name = sub.name || sub.code || "";
      if (id && name && name.toLowerCase() !== "general") {
        map.set(id, { id, name });
      }
    });

    // Then add any additional subjects from reportData
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

  // Displayed Subjects in Main Table
  const displayedSubjects = useMemo(() => {
    if (selectedSubjectFilter === "all" || !selectedSubjectFilter) return distinctSubjects;
    const found = distinctSubjects.filter((s) => s.id === selectedSubjectFilter);
    return found.length > 0 ? found : distinctSubjects;
  }, [distinctSubjects, selectedSubjectFilter]);

  // Filtered Students (Search Filter)
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

  // Reset infinite scroll on search or filter change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [
    studentSearchQuery,
    reportClassId,
    reportSectionId,
    selectedSubjectFilter,
    reportStartDate,
    reportEndDate,
  ]);

  // Scroll sentinel observer for infinite scroll
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

  const pagedStudents = useMemo(() => {
    return filteredStudents.slice(0, visibleCount);
  }, [filteredStudents, visibleCount]);

  // Manage Selected Student
  useEffect(() => {
    if (filteredStudents.length > 0) {
      if (
        !selectedStudentId ||
        !filteredStudents.some((s) => (s.id || s._id) === selectedStudentId)
      ) {
        setSelectedStudentId(filteredStudents[0].id || filteredStudents[0]._id);
      }
    } else {
      setSelectedStudentId(null);
    }
  }, [filteredStudents, selectedStudentId]);

  const selectedStudent = useMemo(() => {
    return (
      filteredStudents.find((s) => (s.id || s._id) === selectedStudentId) || null
    );
  }, [filteredStudents, selectedStudentId]);

  // Available subjects for the selected student in detail panel (Excluding "General")
  const studentSubjects = useMemo(() => {
    if (!selectedStudent || !selectedStudent.subjects?.length) {
      return classSubjects
        .filter((s) => s.name && s.name.toLowerCase() !== "general")
        .map((s) => ({
          subjectId: String(s.id || s._id || s.subjectId),
          subjectName: s.name,
          attendance: [],
        }));
    }
    const filtered = selectedStudent.subjects.filter(
      (s) => s.subjectName && s.subjectName.toLowerCase() !== "general"
    );
    if (filtered.length === 0 && classSubjects.length > 0) {
      return classSubjects
        .filter((s) => s.name && s.name.toLowerCase() !== "general")
        .map((s) => ({
          subjectId: String(s.id || s._id || s.subjectId),
          subjectName: s.name,
          attendance: [],
        }));
    }
    return filtered;
  }, [selectedStudent, classSubjects]);

  // Sync Detail Subject (defaults to active subject filter or first student subject)
  useEffect(() => {
    if (!selectedStudent || studentSubjects.length === 0) return;

    if (
      selectedDetailSubjectId &&
      studentSubjects.some((s) => String(s.subjectId) === String(selectedDetailSubjectId))
    ) {
      return;
    }

    if (
      selectedSubjectFilter !== "all" &&
      studentSubjects.some((s) => String(s.subjectId) === String(selectedSubjectFilter))
    ) {
      setSelectedDetailSubjectId(selectedSubjectFilter);
    } else {
      setSelectedDetailSubjectId(studentSubjects[0]?.subjectId || "");
    }
  }, [selectedStudent, selectedSubjectFilter, studentSubjects, selectedDetailSubjectId]);

  const currentDetailSubject = useMemo(() => {
    if (!studentSubjects.length) return null;
    return (
      studentSubjects.find(
        (s) => String(s.subjectId) === String(selectedDetailSubjectId)
      ) || studentSubjects[0]
    );
  }, [studentSubjects, selectedDetailSubjectId]);

  // Selected Student Overall Attendance %
  const selectedStudentOverallPct = useMemo(() => {
    if (!selectedStudent) return 0;
    let presentCount = 0;
    let totalClasses = 0;
    (selectedStudent.subjects || []).forEach((sub) => {
      (sub.attendance || []).forEach((att) => {
        const st = String(att.status || "").toLowerCase();
        if (st === "present" || st === "short_leave") presentCount++;
        if (
          st === "present" ||
          st === "short_leave" ||
          st === "absent" ||
          st === "leave"
        ) {
          totalClasses++;
        }
      });
    });
    return totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
  }, [selectedStudent]);

  // Weekly groups for the selected student & active subject
  const weeklyGroups = useMemo(() => {
    if (!reportStartDate || !reportEndDate || !currentDetailSubject) return [];
    return getWeeklyGroups(
      reportStartDate,
      reportEndDate,
      currentDetailSubject.attendance || []
    );
  }, [reportStartDate, reportEndDate, currentDetailSubject]);

  // Class-wide summary statistics for table headers
  const classStats = useMemo(() => {
    const subjStatsMap = {};
    let classOverallAttended = 0;
    let classOverallRecorded = 0;

    distinctSubjects.forEach((sub) => {
      subjStatsMap[sub.id] = { attended: 0, recorded: 0, percentage: 0 };
    });

    filteredStudents.forEach((student) => {
      distinctSubjects.forEach((sub) => {
        const sSubj = student.subjects?.find(
          (s) => String(s.subjectId || s.id || s.name) === String(sub.id)
        );
        (sSubj?.attendance || []).forEach((att) => {
          const st = String(att.status || "").toLowerCase();
          if (st === "present" || st === "short_leave") {
            subjStatsMap[sub.id].attended++;
            classOverallAttended++;
          }
          if (
            st === "present" ||
            st === "short_leave" ||
            st === "absent" ||
            st === "leave"
          ) {
            subjStatsMap[sub.id].recorded++;
            classOverallRecorded++;
          }
        });
      });
    });

    distinctSubjects.forEach((sub) => {
      const rec = subjStatsMap[sub.id].recorded;
      const att = subjStatsMap[sub.id].attended;
      subjStatsMap[sub.id].percentage =
        rec > 0 ? Math.round((att / rec) * 100) : 0;
    });

    const overallPercentage =
      classOverallRecorded > 0
        ? Math.round((classOverallAttended / classOverallRecorded) * 100)
        : 0;

    return {
      subjects: subjStatsMap,
      overallPercentage,
    };
  }, [distinctSubjects, filteredStudents]);

  // Compute student stats for each row
  const getStudentMetrics = (student) => {
    let studentOverallAttended = 0;
    let studentOverallRecorded = 0;
    const subjMap = {};

    distinctSubjects.forEach((sub) => {
      const sSubj = student.subjects?.find(
        (s) => String(s.subjectId || s.id || s.name) === String(sub.id)
      );
      let att = 0;
      let rec = 0;
      (sSubj?.attendance || []).forEach((a) => {
        const st = String(a.status || "").toLowerCase();
        if (st === "present" || st === "short_leave") att++;
        if (
          st === "present" ||
          st === "short_leave" ||
          st === "absent" ||
          st === "leave"
        ) {
          rec++;
        }
      });
      studentOverallAttended += att;
      studentOverallRecorded += rec;
      const pct = rec > 0 ? Math.round((att / rec) * 100) : 0;
      subjMap[sub.id] = {
        attended: att,
        recorded: rec,
        percentage: pct,
        isLow: rec > 0 && pct <= 75,
      };
    });

    const overallPct =
      studentOverallRecorded > 0
        ? Math.round((studentOverallAttended / studentOverallRecorded) * 100)
        : 0;

    return {
      subjMap,
      overallPct,
    };
  };

  // Date Range Popover Handlers
  const handlePresetRange = (preset) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === "last_30_days") {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
    } else if (preset === "last_7_days") {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
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

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredStudents.length) return;

    const headers = [
      "Roll No",
      "Student Name",
      "Father Name",
      "Class",
      "Section",
    ];
    displayedSubjects.forEach((sub) => {
      headers.push(`${sub.name} Attended`, `${sub.name} Total`, `${sub.name} %`);
    });
    headers.push("Overall %");

    const rows = filteredStudents.map((student) => {
      const row = [
        `"${student.rollNumber || ""}"`,
        `"${student.name || ""}"`,
        `"${student.fatherName || ""}"`,
        `"${student.class?.name || ""}"`,
        `"${student.section?.name || ""}"`,
      ];

      const metrics = getStudentMetrics(student);

      displayedSubjects.forEach((sub) => {
        const sm = metrics.subjMap[sub.id] || { attended: 0, recorded: 0, percentage: 0 };
        row.push(sm.attended, sm.recorded, `${sm.percentage}%`);
      });

      row.push(`${metrics.overallPct}%`);
      return row.join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Subject_Attendance_Report_${reportStartDate}_to_${reportEndDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Functionality
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

    const tableRowsHtml = filteredStudents
      .map((student) => {
        const metrics = getStudentMetrics(student);
        const subjCells = displayedSubjects
          .map((sub) => {
            const sm = metrics.subjMap[sub.id] || {
              attended: 0,
              recorded: 0,
              percentage: 0,
              isLow: false,
            };
            return `
            <td style="padding: 5px 6px; text-align: center; border: 1px solid #cbd5e1; ${
              sm.isLow ? "background-color: #fee2e2; color: #991b1b; font-weight: bold;" : ""
            }">
              ${sm.recorded > 0 ? `${sm.attended} / ${sm.recorded} (${sm.percentage}%)` : "—"}
            </td>
          `;
          })
          .join("");

        return `
        <tr>
          <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-family: monospace;">${student.rollNumber || "—"}</td>
          <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 600; text-transform: uppercase;">${student.name || "—"}</td>
          ${subjCells}
          <td style="padding: 5px 6px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #ea580c;">${metrics.overallPct}%</td>
        </tr>
      `;
      })
      .join("");

    const subjHeadersHtml = displayedSubjects
      .map((sub) => {
        const cs = classStats.subjects[sub.id] || {
          attended: 0,
          recorded: 0,
          percentage: 0,
        };
        return `
        <th style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; text-align: center;">
          <div style="font-size: 11px; font-weight: 700;">${sub.name}</div>
          <div style="font-size: 9px; font-weight: normal; color: #64748b; margin-top: 2px;">
            ${cs.recorded > 0 ? `${cs.attended}/${cs.recorded} (${cs.percentage}%)` : "—"}
          </div>
        </th>
      `;
      })
      .join("");

    const printWindow = window.open("", "", "height=750,width=1100");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Subject-wise Attendance Report</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600&family=Great+Vibes&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 10px; color: #0f172a; background: #fff; font-size: 11px; line-height: 1.3;
          }
          .form-header {
            display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 8px;
          }
          .header-logo-area {
            display: flex; align-items: center; gap: 14px;
          }
          .brand-logo {
            height: 52px; width: auto; max-width: 120px; object-fit: contain; display: block;
          }
          .header-title-block h1 {
            font-size: 18px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #0f172a; margin: 0; line-height: 1.2;
          }
          .header-title-block .tagline {
            font-size: 9.5px; font-weight: 600; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-top: 2px;
          }
          .meta-box {
            font-size: 10px; color: #64748b; line-height: 1.4; text-align: right;
          }
          .meta-box strong { color: #0f172a; }
          .center-calligraphy-title {
            text-align: center;
            font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Brush Script MT', 'Lucida Calligraphy', 'Segoe Script', cursive, serif;
            font-size: 28px;
            font-weight: 500;
            color: #0f172a;
            margin: 4px 0 10px 0;
            padding: 2px 0 6px 0;
            border-bottom: 1px dashed #cbd5e1;
            letter-spacing: 0.5px;
          }
          .meta-strip {
            display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 10px;
          }
          .meta-label { font-size: 8px; font-weight: 600; color: #64748b; text-transform: uppercase; display: block; }
          .meta-val { font-size: 10px; font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background-color: #f1f5f9; color: #0f172a; font-weight: 700; }
          .footer { margin-top: 14px; font-size: 8px; color: #94a3b8; text-align: right; }
        </style>
      </head>
      <body>
        <div class="form-header">
          <div class="header-logo-area">
            <img src="${logoDataUrl}" class="brand-logo" alt="Concordia College Peshawar Logo" />
            <div class="header-title-block">
              <h1>Concordia College Peshawar</h1>
              <div class="tagline">A Project of Beaconhouse</div>
            </div>
          </div>
          <div class="meta-box">
            <div><strong>Generated:</strong> ${printDate}</div>
            <div><strong>Total Students:</strong> ${filteredStudents.length}</div>
          </div>
        </div>

        <div class="center-calligraphy-title">
          Subject-wise Attendance Report
        </div>

        <div class="meta-strip">
          <div><span class="meta-label">Session</span><span class="meta-val">${sessionLabel}</span></div>
          <div><span class="meta-label">Program</span><span class="meta-val">${programLabel}</span></div>
          <div><span class="meta-label">Class</span><span class="meta-val">${classLabel}</span></div>
          <div><span class="meta-label">Section</span><span class="meta-val">${sectionLabel}</span></div>
          <div><span class="meta-label">Period</span><span class="meta-val">${formattedStartDate} – ${formattedEndDate}</span></div>
          <div><span class="meta-label">Printed On</span><span class="meta-val">${printDate}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 130px;">Roll No</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Student</th>
              ${subjHeadersHtml}
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 90px;">
                <div style="font-size: 11px; font-weight: 700;">Overall</div>
                <div style="font-size: 9px; font-weight: normal; color: #64748b; margin-top: 2px;">${classStats.overallPercentage}%</div>
              </th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer">Generated via Concordia College Management System</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Helper for Status Badge Pill in Detail Panel
  const renderStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "present") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Present
        </span>
      );
    }
    if (s === "absent") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          Absent
        </span>
      );
    }
    if (s === "leave") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Leave
        </span>
      );
    }
    if (s === "short_leave" || s === "half_day" || s === "hd") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Short Leave
        </span>
      );
    }
    if (s === "holiday") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          Holiday
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
        Not marked
      </span>
    );
  };

  return (
    <div className="space-y-5 w-full">
      {/* Back Button if opened from navigation / hub */}
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
            Subject-wise Attendance Report
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review attendance by student, subject, and date range
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

      {/* 1. Single Unified Filter Bar (Session, Program, Class, Section, Date Range, Subject, Search, Export) */}
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

          {/* Export / Print Button */}
          <div className="space-y-1.5 flex items-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-9 w-full gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                  disabled={!filteredStudents.length}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2 text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export to CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={printAttendanceReport} className="gap-2 text-xs">
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>Print Report</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Two-Pane Layout */}
      {!isFilterReady ? (
        <Card className="border border-border/80 shadow-xs rounded-xl p-12 text-center bg-card">
          <FileSpreadsheet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">
            Select Filters to Generate Report
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Please select a Program, Class, and Date Range from the filters above to load student attendance.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT PANE: Main Student Roster Table */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <Card className="border border-border/80 shadow-xs overflow-hidden rounded-xl bg-card">
              <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10 border-b border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[140px] py-3 text-left font-semibold text-xs text-foreground bg-muted/40">
                        Roll No
                      </TableHead>
                      <TableHead className="min-w-[150px] py-3 text-left font-semibold text-xs text-foreground bg-muted/40">
                        Student
                      </TableHead>
                      {displayedSubjects.map((sub) => {
                        const cs = classStats.subjects[sub.id] || {
                          attended: 0,
                          recorded: 0,
                          percentage: 0,
                        };
                        return (
                          <TableHead key={sub.id} className="min-w-[130px] py-3 text-left bg-muted/40">
                            <div className="font-semibold text-xs text-foreground">
                              {sub.name}
                            </div>
                            <div className="text-[11px] font-normal text-muted-foreground mt-0.5">
                              {cs.recorded > 0
                                ? `${cs.attended} / ${cs.recorded} (${cs.percentage}%)`
                                : "—"}
                            </div>
                          </TableHead>
                        );
                      })}
                      <TableHead className="w-[100px] py-3 text-left bg-muted/40">
                        <div className="font-semibold text-xs text-foreground">
                          Overall
                        </div>
                        <div className="text-[11px] font-normal text-muted-foreground mt-0.5">
                          {classStats.overallPercentage > 0
                            ? `${classStats.overallPercentage}%`
                            : "—"}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isFetchingReport ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`skel-${i}`}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          {displayedSubjects.map((s) => (
                            <TableCell key={s.id}><Skeleton className="h-6 w-20" /></TableCell>
                          ))}
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        </TableRow>
                      ))
                    ) : pagedStudents.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3 + displayedSubjects.length}
                          className="h-48 text-center text-muted-foreground text-xs"
                        >
                          {reportData.length === 0
                            ? "No attendance records found for this class and date range."
                            : "No students matching your search query."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedStudents.map((student) => {
                        const studentId = student.id || student._id;
                        const isStudentSelected = selectedStudentId === studentId;
                        const metrics = getStudentMetrics(student);

                        return (
                          <TableRow
                            key={studentId}
                            onClick={() => setSelectedStudentId(studentId)}
                            className={`cursor-pointer transition-colors group ${
                              isStudentSelected
                                ? "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary font-medium"
                                : "hover:bg-muted/30"
                            }`}
                          >
                            {/* Roll No */}
                            <TableCell className="py-3 text-xs font-mono font-medium text-muted-foreground">
                              {student.rollNumber || "—"}
                            </TableCell>

                            {/* Student Name */}
                            <TableCell className="py-3 text-xs font-bold text-foreground uppercase tracking-tight">
                              {student.name || "—"}
                            </TableCell>

                            {/* 3. Subject Cells: Clicking a subject cell selects that subject for the sidebar! */}
                            {displayedSubjects.map((sub) => {
                              const sm = metrics.subjMap[sub.id] || {
                                attended: 0,
                                recorded: 0,
                                percentage: 0,
                                isLow: false,
                              };
                              const isCellSubjectActive =
                                isStudentSelected &&
                                String(selectedDetailSubjectId) === String(sub.id);

                              return (
                                <TableCell
                                  key={sub.id}
                                  className={`py-2 px-2 transition-all ${
                                    isCellSubjectActive
                                      ? "bg-primary/10 ring-2 ring-primary ring-inset rounded-md"
                                      : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStudentId(studentId);
                                    setSelectedDetailSubjectId(sub.id);
                                  }}
                                  title={`Click to view ${student.name}'s ${sub.name} attendance in detail`}
                                >
                                  <div
                                    className={`p-1.5 rounded-md transition-colors ${
                                      sm.isLow
                                        ? "bg-destructive/10 text-destructive font-semibold"
                                        : "text-foreground"
                                    }`}
                                  >
                                    <div className="text-xs">
                                      {sm.recorded > 0
                                        ? `${sm.attended} / ${sm.recorded} (${sm.percentage}%)`
                                        : "—"}
                                    </div>
                                    {sm.recorded > 0 && (
                                      <div className="w-full bg-muted h-1 rounded-full overflow-hidden mt-1.5">
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            sm.isLow
                                              ? "bg-destructive"
                                              : "bg-primary"
                                          }`}
                                          style={{
                                            width: `${Math.min(100, sm.percentage)}%`,
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}

                            {/* Overall Percentage + Chevron */}
                            <TableCell className="py-3 text-xs">
                              <div className="flex items-center justify-between gap-1 pr-1">
                                <span className="font-bold text-foreground">
                                  {metrics.overallPct}%
                                </span>
                                <ChevronRight
                                  className={`w-4 h-4 transition-transform ${
                                    isStudentSelected
                                      ? "text-primary translate-x-0.5"
                                      : "text-muted-foreground group-hover:translate-x-0.5"
                                  }`}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                {/* 6. Scroll Sentinel element for infinite scroll */}
                <div ref={scrollSentinelRef} className="h-6 w-full" />
              </div>

              {/* 6. Scroll Pagination Footer (Shows count, no button pagination) */}
              {filteredStudents.length > 0 && (
                <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                  <span>
                    Showing {pagedStudents.length} of {filteredStudents.length} students
                  </span>
                  {visibleCount < filteredStudents.length ? (
                    <span className="text-[11px] text-muted-foreground animate-pulse">
                      Scroll down to load more students...
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-medium">
                      All students loaded
                    </span>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT PANE: Subject Details Panel */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-4">
            <Card className="border border-border/80 shadow-xs rounded-xl overflow-hidden p-4 sm:p-5 bg-card">
              {selectedStudent ? (
                <div className="space-y-4">
                  {/* Student Header Card */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-border gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {getInitials(selectedStudent.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-foreground uppercase truncate">
                          {selectedStudent.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Roll No: {selectedStudent.rollNumber || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Overall Attendance
                      </p>
                      <p className="text-2xl font-black text-primary leading-none mt-1">
                        {selectedStudentOverallPct}%
                      </p>
                    </div>
                  </div>

                  {/* Subject Selector Tabs / Pills */}
                  {studentSubjects.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {studentSubjects.map((sub) => {
                        const isActive =
                          String(selectedDetailSubjectId) === String(sub.subjectId);
                        return (
                          <button
                            type="button"
                            key={sub.subjectId}
                            onClick={() => setSelectedDetailSubjectId(sub.subjectId)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "bg-card border border-border text-foreground hover:bg-muted"
                            }`}
                          >
                            {sub.subjectName}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Subtitle */}
                  <h4 className="text-sm font-bold text-foreground pt-1">
                    Attendance Details – {currentDetailSubject?.subjectName || "Subject Details"}
                  </h4>

                  {/* Weekly Grouped Attendance Cards */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {weeklyGroups.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                        No attendance logged for this subject in the selected date range.
                      </div>
                    ) : (
                      weeklyGroups.map((week) => (
                        <div
                          key={week.weekIndex}
                          className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs"
                        >
                          {/* Week Header */}
                          <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/30 border-b border-border">
                            <span className="text-xs font-bold text-foreground">
                              Week {week.weekIndex}{" "}
                              <span className="text-xs font-normal text-muted-foreground">
                                ({week.weekStart} – {week.weekEnd})
                              </span>
                            </span>
                            <span className="text-xs font-bold text-foreground">
                              {week.attendedCount} / {week.totalMarked || week.days.length} (
                              {week.weekPercent}%)
                            </span>
                          </div>

                          {/* 4. Week Table of Days: Shows all days in week without restriction, relying solely on records */}
                          <table className="w-full text-xs">
                            <thead className="text-[11px] font-semibold text-muted-foreground bg-muted/20 border-b border-border">
                              <tr>
                                <th className="text-left py-2 px-3.5 font-medium">Date</th>
                                <th className="text-left py-2 px-3.5 font-medium">Day</th>
                                <th className="text-left py-2 px-3.5 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {week.days.map((day) => (
                                <tr key={day.dateKey} className="hover:bg-muted/20">
                                  <td className="py-2 px-3.5 text-foreground font-medium">
                                    {day.formattedDate}
                                  </td>
                                  <td className="py-2 px-3.5 text-muted-foreground">
                                    {day.dayName}
                                  </td>
                                  <td className="py-2 px-3.5">
                                    {renderStatusBadge(day.status)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 4. Bottom Legend: Present, Absent, Leave, Holiday, Not marked */}
                  <div className="flex items-center justify-start gap-3.5 pt-3 border-t border-border text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-destructive" /> Absent
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Leave
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" /> Holiday
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/60" /> Not marked
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  Select a student from the table to view their weekly subject details.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
