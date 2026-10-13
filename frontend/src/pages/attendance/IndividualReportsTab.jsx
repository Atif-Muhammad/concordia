import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Search,
  X,
  Printer,
  Download,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  BookOpen,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getAttendanceReport,
  searchStudents,
  getSubjectsForClassWithAssignments,
} from "../../../config/apis";

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

export default function IndividualReportsTab({ onBack }) {
  const { toast } = useToast();

  // 1. Initial State: Default Date Range (1st of current month to today)
  const now = new Date();
  const defaultStart = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEnd = toLocalDateKey(now);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // 2. Student Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // 3. Subject Filter State (defaults to "all")
  const [selectedSubject, setSelectedSubject] = useState("all");

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search Students Handler
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
    setSelectedSubject("all");
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
    setSelectedSubject("all");
  };

  // Preset Date Handlers
  const handlePresetDate = (preset) => {
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

    setStartDate(toLocalDateKey(s));
    setEndDate(toLocalDateKey(e));
  };

  // 4. Fetch Attendance Data for Selected Student
  const studentId = selectedStudent?._id || selectedStudent?.id;
  const classId =
    selectedStudent?.classId?._id ||
    selectedStudent?.classId?.id ||
    selectedStudent?.classId ||
    selectedStudent?.class?.id ||
    "";
  const sectionId =
    selectedStudent?.sectionId?._id ||
    selectedStudent?.sectionId?.id ||
    selectedStudent?.sectionId ||
    selectedStudent?.section?.id ||
    "";
  const sessionId =
    selectedStudent?.sessionId?._id ||
    selectedStudent?.sessionId?.id ||
    selectedStudent?.sessionId ||
    selectedStudent?.session?.id ||
    "";
  const programId =
    selectedStudent?.programId?._id ||
    selectedStudent?.programId?.id ||
    selectedStudent?.programId ||
    selectedStudent?.program?.id ||
    "";

  // Query Curriculum Subjects for the student's class
  const { data: classCurriculumSubjects = [] } = useQuery({
    queryKey: ["individualStudentClassSubjects", classId, sectionId],
    queryFn: async () => {
      if (!classId) return [];
      try {
        const list = await getSubjectsForClassWithAssignments(
          classId,
          undefined,
          sectionId || undefined
        );
        return Array.isArray(list) ? list : [];
      } catch (err) {
        console.error("Error fetching class subjects:", err);
        return [];
      }
    },
    enabled: Boolean(classId),
    staleTime: 5 * 60 * 1000,
  });

  // Query Attendance Report
  const {
    data: reportRaw = [],
    isLoading: isLoadingReport,
    isFetching: isFetchingReport,
    refetch: refetchReport,
  } = useQuery({
    queryKey: [
      "individualStudentAttendance",
      studentId,
      startDate,
      endDate,
      classId,
      sectionId,
      programId,
    ],
    queryFn: async () => {
      if (!studentId || !startDate || !endDate) return [];
      const data = await getAttendanceReport(
        startDate,
        endDate,
        classId || undefined,
        sectionId || undefined,
        undefined,
        programId || undefined,
        studentId
      );
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(studentId && startDate && endDate),
    staleTime: 30 * 1000,
  });

  const studentReport = useMemo(() => {
    if (!reportRaw || reportRaw.length === 0) return null;
    return reportRaw[0];
  }, [reportRaw]);

  // Unified Student Subjects List (Excluding "General")
  const availableSubjects = useMemo(() => {
    const map = new Map();

    // From class curriculum
    (classCurriculumSubjects || []).forEach((sub) => {
      const sId = String(sub.id || sub._id || sub.subjectId || "");
      const sName = sub.name || sub.code || "";
      if (sId && sName && sName.toLowerCase() !== "general") {
        map.set(sId, { subjectId: sId, subjectName: sName, code: sub.code || "" });
      }
    });

    // From student attendance records
    (studentReport?.subjects || []).forEach((sub) => {
      const sId = String(sub.subjectId || sub.id || sub._id || "");
      const sName = sub.subjectName || sub.name || "";
      if (sId && sName && sName.toLowerCase() !== "general") {
        if (!map.has(sId)) {
          map.set(sId, { subjectId: sId, subjectName: sName, code: sub.code || "" });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName)
    );
  }, [classCurriculumSubjects, studentReport]);

  // Filtered Subjects depending on selectedSubject dropdown
  const filteredStudentSubjects = useMemo(() => {
    if (!studentReport?.subjects?.length) {
      if (availableSubjects.length > 0) {
        if (selectedSubject === "all") return availableSubjects.map((s) => ({ ...s, attendance: [] }));
        const match = availableSubjects.find((s) => String(s.subjectId) === String(selectedSubject));
        return match ? [{ ...match, attendance: [] }] : [];
      }
      return [];
    }

    const cleaned = studentReport.subjects.filter(
      (s) => s.subjectName && s.subjectName.toLowerCase() !== "general"
    );

    if (selectedSubject === "all") return cleaned;
    return cleaned.filter(
      (s) => String(s.subjectId || s.id || "") === String(selectedSubject)
    );
  }, [studentReport, availableSubjects, selectedSubject]);

  // Overall and Per-Subject Attendance Statistics
  const stats = useMemo(() => {
    if (!studentReport) {
      return {
        totalDays: 0,
        totalClasses: 0,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        shortLeaveCount: 0,
        holidayCount: 0,
        percentage: 0,
      };
    }

    let start = new Date(`${startDate}T00:00:00`);
    let end = new Date(`${endDate}T00:00:00`);
    const diffTime = Math.abs(end - start);
    const totalDays = isNaN(diffTime) ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let shortLeaveCount = 0;
    let holidayCount = 0;

    (filteredStudentSubjects || []).forEach((sub) => {
      (sub.attendance || []).forEach((a) => {
        const st = String(a.status || "").toLowerCase();
        if (st === "present") presentCount++;
        else if (st === "absent") absentCount++;
        else if (st === "leave") leaveCount++;
        else if (st === "short_leave") shortLeaveCount++;
        else if (st === "holiday") holidayCount++;
      });
    });

    const totalClasses = presentCount + absentCount + leaveCount + shortLeaveCount;
    const percentage =
      totalClasses > 0
        ? Math.round(((presentCount + shortLeaveCount) / totalClasses) * 100)
        : 0;

    return {
      totalDays,
      totalClasses,
      presentCount,
      absentCount,
      leaveCount,
      shortLeaveCount,
      holidayCount,
      percentage,
    };
  }, [studentReport, filteredStudentSubjects, startDate, endDate]);

  // Per-Subject Summary Metrics (Used when All Subjects is selected)
  const subjectMetrics = useMemo(() => {
    if (!studentReport?.subjects) return [];
    return studentReport.subjects
      .filter((s) => s.subjectName && s.subjectName.toLowerCase() !== "general")
      .map((sub) => {
        let present = 0;
        let absent = 0;
        let leave = 0;
        let shortLeave = 0;
        (sub.attendance || []).forEach((a) => {
          const st = String(a.status || "").toLowerCase();
          if (st === "present") present++;
          else if (st === "absent") absent++;
          else if (st === "leave") leave++;
          else if (st === "short_leave") shortLeave++;
        });
        const total = present + absent + leave + shortLeave;
        const pct = total > 0 ? Math.round(((present + shortLeave) / total) * 100) : 0;
        return {
          subjectId: sub.subjectId,
          subjectName: sub.subjectName,
          present,
          absent,
          leave,
          shortLeave,
          totalClasses: total,
          percentage: pct,
        };
      });
  }, [studentReport]);

  // Build Chronological Attendance Records Array
  const chronologicalRecords = useMemo(() => {
    if (!studentReport || !startDate || !endDate) return [];
    const list = [];

    (filteredStudentSubjects || []).forEach((sub) => {
      (sub.attendance || []).forEach((att) => {
        let dateStr = "";
        if (typeof att.date === "string") dateStr = att.date.slice(0, 10);
        else if (att.date instanceof Date) dateStr = toLocalDateKey(att.date);

        if (dateStr && dateStr >= startDate && dateStr <= endDate) {
          const dateObj = new Date(`${dateStr}T00:00:00`);
          list.push({
            dateKey: dateStr,
            dateObj,
            formattedDate: dateObj.toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            }),
            dayName: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
            subjectName: sub.subjectName,
            subjectId: sub.subjectId,
            status: String(att.status || "not_marked").toLowerCase(),
            notes: att.notes || "",
          });
        }
      });
    });

    list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return list;
  }, [studentReport, filteredStudentSubjects, startDate, endDate]);

  // Group Attendance by Weeks (Monday to Sunday, without omitting Sat/Sun)
  const weeklyGroups = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    // Map records by dateKey -> array of records on that day
    const recsByDate = new Map();
    chronologicalRecords.forEach((rec) => {
      if (!recsByDate.has(rec.dateKey)) recsByDate.set(rec.dateKey, []);
      recsByDate.get(rec.dateKey).push(rec);
    });

    const weeks = [];
    let current = new Date(start);
    let weekIndex = 1;

    while (current <= end) {
      const weekStart = new Date(current);
      const dayOfWeek = current.getDay();
      const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const sundayDate = new Date(current);
      sundayDate.setDate(current.getDate() + daysToSunday);
      const weekEnd = sundayDate > end ? new Date(end) : sundayDate;

      const days = [];
      let d = new Date(weekStart);
      let weekAttended = 0;
      let weekTotalMarked = 0;

      while (d <= weekEnd) {
        const dKey = toLocalDateKey(d);
        const dayRecs = recsByDate.get(dKey) || [];

        dayRecs.forEach((r) => {
          if (r.status === "present" || r.status === "short_leave") weekAttended++;
          if (
            r.status === "present" ||
            r.status === "short_leave" ||
            r.status === "absent" ||
            r.status === "leave"
          ) {
            weekTotalMarked++;
          }
        });

        days.push({
          dateKey: dKey,
          dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
          formattedDate: d.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          }),
          records: dayRecs,
        });

        d.setDate(d.getDate() + 1);
      }

      const weekPercent =
        weekTotalMarked > 0 ? Math.round((weekAttended / weekTotalMarked) * 100) : 0;

      weeks.push({
        weekIndex,
        weekStart: weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        }),
        weekEnd: weekEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        }),
        days,
        attendedCount: weekAttended,
        totalMarked: weekTotalMarked,
        weekPercent,
      });

      const nextDay = new Date(weekEnd);
      nextDay.setDate(nextDay.getDate() + 1);
      current = nextDay;
      weekIndex++;
    }

    return weeks;
  }, [startDate, endDate, chronologicalRecords]);

  // Student Identity Helpers
  const studentName =
    studentReport?.name ||
    `${selectedStudent?.fName || ""} ${selectedStudent?.lName || ""}`.trim() ||
    "Selected Student";
  const fatherName =
    studentReport?.fatherName ||
    selectedStudent?.fatherName ||
    selectedStudent?.fatherOrguardian ||
    selectedStudent?.parentOrGuardianName ||
    "—";
  const rollNumber = studentReport?.rollNumber || selectedStudent?.rollNumber || "—";
  const programName =
    studentReport?.program?.name ||
    selectedStudent?.program?.name ||
    selectedStudent?.programId?.name ||
    "—";
  const className =
    studentReport?.class?.name ||
    selectedStudent?.class?.name ||
    selectedStudent?.classId?.name ||
    "—";
  const sectionName =
    studentReport?.section?.name ||
    selectedStudent?.section?.name ||
    selectedStudent?.sectionId?.name ||
    "—";

  const selectedSubjectObj = availableSubjects.find(
    (s) => String(s.subjectId) === String(selectedSubject)
  );
  const subjectFilterLabel =
    selectedSubject === "all" ? "All Subjects" : selectedSubjectObj?.subjectName || selectedSubject;

  // 5. PRINT REPORT FUNCTIONALITY (With Branding Logo & Calligraphy)
  const handlePrint = async () => {
    if (!selectedStudent) {
      toast({
        title: "No Student Selected",
        description: "Please search and select a student first.",
        variant: "destructive",
      });
      return;
    }

    // Convert /logo.png to base64 DataURL for reliable rendering in new popup window
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

    const formattedStartDate = new Date(`${startDate}T00:00:00`).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "short", day: "numeric" }
    );
    const formattedEndDate = new Date(`${endDate}T00:00:00`).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "short", day: "numeric" }
    );
    const printDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const tableRowsHtml =
      chronologicalRecords.length === 0
        ? `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #64748b;">No attendance records found for this period.</td></tr>`
        : chronologicalRecords
            .map((rec, index) => {
              let badgeColor = "#475569";
              let badgeBg = "#f1f5f9";
              if (rec.status === "present") {
                badgeColor = "#166534";
                badgeBg = "#dcfce7";
              } else if (rec.status === "absent") {
                badgeColor = "#991b1b";
                badgeBg = "#fee2e2";
              } else if (rec.status === "leave") {
                badgeColor = "#92400e";
                badgeBg = "#fef3c7";
              } else if (rec.status === "holiday") {
                badgeColor = "#6b21a8";
                badgeBg = "#f3e8ff";
              }

              return `
              <tr>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; width: 40px;">${index + 1}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 500;">${rec.formattedDate}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #475569;">${rec.dayName}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${rec.subjectName}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">
                  <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; background: ${badgeBg}; color: ${badgeColor};">
                    ${rec.status}
                  </span>
                </td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #64748b;">${rec.notes || "—"}</td>
              </tr>
            `;
            })
            .join("");

    const reportTitleText =
      selectedSubject === "all"
        ? "Individual Student Attendance Report"
        : `Individual Student Attendance Report – ${subjectFilterLabel}`;

    const printWindow = window.open("", "", "height=750,width=1100");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Report - ${studentName}</title>
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
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; font-size: 10px;
          }
          .meta-label { font-size: 8px; font-weight: 600; color: #64748b; text-transform: uppercase; display: block; }
          .meta-val { font-size: 10px; font-weight: 600; color: #0f172a; }
          .stats-strip {
            display: flex; gap: 16px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 12px; margin-bottom: 12px; font-size: 10px; flex-wrap: wrap;
          }
          .stat-item { display: flex; gap: 4px; align-items: center; }
          .stat-label { color: #64748b; font-weight: 500; }
          .stat-val { font-weight: 700; color: #0f172a; }
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
            <div><strong>Roll No:</strong> ${rollNumber}</div>
          </div>
        </div>

        <div class="center-calligraphy-title">
          ${reportTitleText}
        </div>

        <div class="meta-strip">
          <div><span class="meta-label">Student Name</span><span class="meta-val">${studentName}</span></div>
          <div><span class="meta-label">Father's Name</span><span class="meta-val">${fatherName}</span></div>
          <div><span class="meta-label">Roll Number</span><span class="meta-val">${rollNumber}</span></div>
          <div><span class="meta-label">Program</span><span class="meta-val">${programName}</span></div>
          <div><span class="meta-label">Class & Section</span><span class="meta-val">${className} - ${sectionName}</span></div>
          <div><span class="meta-label">Subject</span><span class="meta-val">${subjectFilterLabel}</span></div>
          <div><span class="meta-label">Period</span><span class="meta-val">${formattedStartDate} – ${formattedEndDate}</span></div>
          <div><span class="meta-label">Printed On</span><span class="meta-val">${printDate}</span></div>
        </div>

        <div class="stats-strip">
          <div class="stat-item"><span class="stat-label">Total Days:</span> <span class="stat-val">${stats.totalDays}</span></div>
          <div class="stat-item"><span class="stat-label">Classes Held:</span> <span class="stat-val">${stats.totalClasses}</span></div>
          <div class="stat-item"><span class="stat-label">Present:</span> <span class="stat-val" style="color: #166534;">${stats.presentCount}</span></div>
          <div class="stat-item"><span class="stat-label">Absent:</span> <span class="stat-val" style="color: #991b1b;">${stats.absentCount}</span></div>
          <div class="stat-item"><span class="stat-label">Leave:</span> <span class="stat-val" style="color: #92400e;">${stats.leaveCount}</span></div>
          <div class="stat-item"><span class="stat-label">Attendance Rate:</span> <span class="stat-val" style="color: #2563eb;">${stats.percentage}%</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 40px;">#</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 110px;">Date</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 60px;">Day</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Subject</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 100px;">Status</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Remarks</th>
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

  // 6. EXPORT TO EXCEL (.xlsx)
  const handleExportExcel = () => {
    if (!selectedStudent || chronologicalRecords.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Please select a student with attendance records in this range.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary Sheet
      const summaryRows = [
        { Field: "Student Name", Value: studentName },
        { Field: "Roll Number", Value: rollNumber },
        { Field: "Father Name", Value: fatherName },
        { Field: "Program", Value: programName },
        { Field: "Class", Value: className },
        { Field: "Section", Value: sectionName },
        { Field: "Subject Filter", Value: subjectFilterLabel },
        { Field: "Date Range", Value: `${startDate} to ${endDate}` },
        { Field: "Total Period Days", Value: stats.totalDays },
        { Field: "Classes Tracked", Value: stats.totalClasses },
        { Field: "Present", Value: stats.presentCount },
        { Field: "Absent", Value: stats.absentCount },
        { Field: "Leave", Value: stats.leaveCount },
        { Field: "Short Leave", Value: stats.shortLeaveCount },
        { Field: "Attendance Rate", Value: `${stats.percentage}%` },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Student Summary");

      // Sheet 2: Per-Subject Breakdown
      if (selectedSubject === "all" && subjectMetrics.length > 0) {
        const subRows = subjectMetrics.map((sm) => ({
          "Subject": sm.subjectName,
          "Total Classes": sm.totalClasses,
          "Present": sm.present,
          "Absent": sm.absent,
          "Leave": sm.leave,
          "Short Leave": sm.shortLeave,
          "Attendance Rate (%)": `${sm.percentage}%`,
        }));
        const wsSubj = XLSX.utils.json_to_sheet(subRows);
        XLSX.utils.book_append_sheet(wb, wsSubj, "Subject Breakdown");
      }

      // Sheet 3: Day-by-Day Attendance Log
      const logRows = chronologicalRecords.map((r, i) => ({
        "S.No": i + 1,
        "Date": r.formattedDate,
        "Day": r.dayName,
        "Subject": r.subjectName,
        "Status": r.status.toUpperCase(),
        "Remarks": r.notes || "",
      }));
      const wsLog = XLSX.utils.json_to_sheet(logRows);
      XLSX.utils.book_append_sheet(wb, wsLog, "Attendance History");

      const safeRoll = (rollNumber || "Student").replace(/[^a-zA-Z0-9_-]/g, "_");
      XLSX.writeFile(
        wb,
        `Individual_Attendance_${safeRoll}_${startDate}_to_${endDate}.xlsx`
      );

      toast({
        title: "Export Successful",
        description: "Excel workbook downloaded successfully.",
      });
    } catch (err) {
      console.error("Excel export error:", err);
      toast({
        title: "Export Failed",
        description: "Unable to generate Excel file.",
        variant: "destructive",
      });
    }
  };

  // 7. EXPORT TO CSV (.csv)
  const handleExportCSV = () => {
    if (!selectedStudent || chronologicalRecords.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Please select a student with attendance records in this range.",
        variant: "destructive",
      });
      return;
    }

    const lines = [
      `"Concordia College Peshawar - Individual Student Attendance Report"`,
      `"Student Name:","${studentName}"`,
      `"Roll Number:","${rollNumber}"`,
      `"Father Name:","${fatherName}"`,
      `"Class & Section:","${className} - ${sectionName}"`,
      `"Subject:","${subjectFilterLabel}"`,
      `"Period:","${startDate} to ${endDate}"`,
      `"Overall Attendance Rate:","${stats.percentage}%"`,
      ``,
      `"S.No","Date","Day","Subject","Status","Remarks"`,
    ];

    chronologicalRecords.forEach((r, i) => {
      lines.push(
        `"${i + 1}","${r.formattedDate}","${r.dayName}","${r.subjectName}","${r.status.toUpperCase()}","${(r.notes || "").replace(/"/g, '""')}"`
      );
    });

    const csvContent = "data:text/csv;charset=utf-8," + lines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeRoll = (rollNumber || "Student").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.setAttribute(
      "download",
      `Individual_Attendance_${safeRoll}_${startDate}_to_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: "CSV file downloaded successfully.",
    });
  };

  // Helper for Status Badges
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
    if (s === "short_leave") {
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
    <div className="space-y-5">
      {/* Top Bar with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="gap-1.5 text-xs font-semibold shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Reports
            </Button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Individual Student Attendance Report
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive student attendance ledger, subject performance, and weekly audit.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedStudent || chronologicalRecords.length === 0}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs">
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Export as Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                <Download className="w-4 h-4 text-blue-600" />
                Export as CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            onClick={handlePrint}
            disabled={!selectedStudent || chronologicalRecords.length === 0}
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* FILTER BAR: Strictly Search Student, Subject Filter, and Date Range */}
      <Card className="border border-border/80 shadow-xs bg-card rounded-xl p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* 1. Search Student (Name / Roll No) */}
          <div className="md:col-span-5 relative" ref={searchContainerRef}>
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1.5">
              Search Student (Name or Roll Number)
            </Label>
            {selectedStudent ? (
              <div className="flex items-center justify-between p-2 rounded-lg border border-primary/40 bg-primary/5 min-h-[38px]">
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-xs text-foreground truncate">
                    {selectedStudent.rollNumber} – {selectedStudent.fName} {selectedStudent.lName}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedStudent.program?.name || selectedStudent.programId?.name ? `${selectedStudent.program?.name || selectedStudent.programId?.name} • ` : ""}
                    {selectedStudent.class?.name || selectedStudent.classId?.name || "Class"}
                    {selectedStudent.section?.name || selectedStudent.sectionId?.name ? ` - ${selectedStudent.section?.name || selectedStudent.sectionId?.name}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearStudent}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Type student name or roll number..."
                  value={searchQuery}
                  onChange={(e) => handleStudentSearch(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setIsSearchOpen(true);
                  }}
                  className="pl-9 text-xs h-9 bg-background"
                />
                {isSearching && (
                  <span className="absolute right-3 top-2.5 text-[11px] text-muted-foreground animate-pulse">
                    Searching...
                  </span>
                )}
              </div>
            )}

            {/* Dropdown Auto-Complete */}
            {isSearchOpen && searchResults.length > 0 && !selectedStudent && (
              <div className="border border-border rounded-xl max-h-56 overflow-y-auto bg-popover shadow-xl absolute z-30 w-full left-0 mt-1 divide-y divide-border/60">
                {searchResults.map((student) => (
                  <div
                    key={student.id || student._id}
                    onClick={() => handleSelectStudent(student)}
                    className="p-2.5 hover:bg-muted/70 cursor-pointer transition-colors"
                  >
                    <p className="font-bold text-xs text-foreground">
                      {student.rollNumber} – {student.fName} {student.lName}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {student.program?.name || student.programId?.name ? `${student.program?.name || student.programId?.name} • ` : ""}
                      {student.class?.name || student.classId?.name || "Class"}
                      {student.section?.name || student.sectionId?.name ? ` - ${student.section?.name || student.sectionId?.name}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Subject Filter (Defaults to "all") */}
          <div className="md:col-span-3">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1.5">
              Subject Filter
            </Label>
            <Select
              value={selectedSubject}
              onValueChange={setSelectedSubject}
              disabled={!selectedStudent}
            >
              <SelectTrigger className="text-xs h-9 bg-background">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">All Subjects</SelectItem>
                {availableSubjects.map((sub) => (
                  <SelectItem key={sub.subjectId} value={String(sub.subjectId)}>
                    {sub.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Date Range Filter */}
          <div className="md:col-span-4">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1.5">
              Date Range
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9 bg-background"
              />
              <span className="text-xs text-muted-foreground font-semibold">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9 bg-background"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Presets Strip */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border flex-wrap text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">
            Quick Range:
          </span>
          <button
            type="button"
            onClick={() => handlePresetDate("this_month")}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => handlePresetDate("last_month")}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Last Month
          </button>
          <button
            type="button"
            onClick={() => handlePresetDate("last_30_days")}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => handlePresetDate("last_7_days")}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Last 7 Days
          </button>
        </div>
      </Card>

      {/* STATE 1: No Student Selected Placeholder */}
      {!selectedStudent && (
        <Card className="border border-dashed border-border/80 shadow-xs bg-card/60 p-12 text-center rounded-2xl">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-lg text-foreground">
              Select a Student to View Individual Attendance
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use the search bar above to type a student's name or roll number. You can review their full attendance history, filter by subject, and export or print an official report.
            </p>
          </div>
        </Card>
      )}

      {/* STATE 2: Loading State */}
      {selectedStudent && (isLoadingReport || isFetchingReport) && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {/* STATE 3: Student Attendance Report Content */}
      {selectedStudent && !isLoadingReport && !isFetchingReport && (
        <div className="space-y-5">
          {/* Student Profile Header Card */}
          <Card className="border border-border/80 shadow-xs bg-card rounded-xl p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full bg-primary/15 text-primary font-black text-xl flex items-center justify-center shrink-0 shadow-inner">
                  {getInitials(studentName)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-foreground uppercase tracking-tight truncate">
                      {studentName}
                    </h2>
                    <Badge variant="outline" className="font-mono text-xs font-bold border-primary/40 text-primary">
                      {rollNumber}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Father's Name: <span className="font-semibold text-foreground">{fatherName}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                    <span className="font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                      {programName}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                      Class: {className}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                      Section: {sectionName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attendance Rate Big Callout */}
              <div className="bg-muted/40 border border-border rounded-xl p-4 text-right shrink-0 min-w-[150px]">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Overall Attendance
                </p>
                <div className="flex items-baseline justify-end gap-1 mt-1">
                  <span
                    className={`text-3xl font-black ${
                      stats.percentage >= 75 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {stats.percentage}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {stats.presentCount + stats.shortLeaveCount} of {stats.totalClasses} classes
                </p>
              </div>
            </div>
          </Card>

          {/* Metric KPI Cards Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <Card className="border border-border/80 shadow-2xs bg-card p-3.5">
              <p className="text-[11px] font-bold text-muted-foreground uppercase">
                Period Days
              </p>
              <p className="text-xl font-extrabold text-foreground mt-1">
                {stats.totalDays}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Calendar Days</p>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card p-3.5">
              <p className="text-[11px] font-bold text-muted-foreground uppercase">
                Classes Held
              </p>
              <p className="text-xl font-extrabold text-foreground mt-1">
                {stats.totalClasses}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Recorded Sessions</p>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card p-3.5 border-l-4 border-l-emerald-500">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                Present
              </p>
              <p className="text-xl font-extrabold text-emerald-600 mt-1">
                {stats.presentCount}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {stats.totalClasses > 0
                  ? `${Math.round((stats.presentCount / stats.totalClasses) * 100)}%`
                  : "0%"}
              </p>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card p-3.5 border-l-4 border-l-destructive">
              <p className="text-[11px] font-bold text-destructive uppercase">
                Absent
              </p>
              <p className="text-xl font-extrabold text-destructive mt-1">
                {stats.absentCount}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {stats.totalClasses > 0
                  ? `${Math.round((stats.absentCount / stats.totalClasses) * 100)}%`
                  : "0%"}
              </p>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card p-3.5 border-l-4 border-l-amber-500">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                Leave
              </p>
              <p className="text-xl font-extrabold text-amber-600 mt-1">
                {stats.leaveCount}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Approved leaves
              </p>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card p-3.5 border-l-4 border-l-purple-500">
              <p className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase">
                Holidays
              </p>
              <p className="text-xl font-extrabold text-purple-600 mt-1">
                {stats.holidayCount}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Off days</p>
            </Card>
          </div>

          {/* Per-Subject Breakdown Table (When "All Subjects" selected) */}
          {selectedSubject === "all" && subjectMetrics.length > 0 && (
            <Card className="border border-border/80 shadow-xs bg-card rounded-xl overflow-hidden p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h3 className="font-extrabold text-sm text-foreground">
                    Subject-wise Attendance Breakdown
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-semibold">
                  {subjectMetrics.length} Subjects
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold">Subject</th>
                      <th className="text-center py-2 px-3 font-semibold">Classes</th>
                      <th className="text-center py-2 px-3 font-semibold text-emerald-600">Present</th>
                      <th className="text-center py-2 px-3 font-semibold text-destructive">Absent</th>
                      <th className="text-center py-2 px-3 font-semibold text-amber-600">Leave</th>
                      <th className="text-center py-2 px-3 font-semibold">Attendance Rate</th>
                      <th className="text-right py-2 px-3 font-semibold">Filter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subjectMetrics.map((sm) => (
                      <tr key={sm.subjectId} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-bold text-foreground">
                          {sm.subjectName}
                        </td>
                        <td className="py-2.5 px-3 text-center text-foreground font-medium">
                          {sm.totalClasses}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">
                          {sm.present}
                        </td>
                        <td className="py-2.5 px-3 text-center text-destructive font-bold">
                          {sm.absent}
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-600 font-bold">
                          {sm.leave}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-black ${
                              sm.percentage >= 75 ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {sm.percentage}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSubject(sm.subjectId)}
                            className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          >
                            View Only
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Weekly Grouped Attendance Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pt-2">
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Attendance Ledger – {subjectFilterLabel}
              </h3>
              <span className="text-xs text-muted-foreground">
                Showing all days (Monday to Sunday)
              </span>
            </div>

            {weeklyGroups.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <p className="text-xs text-muted-foreground">
                  No attendance records logged for the selected dates.
                </p>
              </Card>
            ) : (
              weeklyGroups.map((week) => (
                <Card
                  key={week.weekIndex}
                  className="border border-border/80 bg-card rounded-xl overflow-hidden shadow-2xs"
                >
                  {/* Week Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
                    <span className="text-xs font-bold text-foreground">
                      Week {week.weekIndex}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({week.weekStart} – {week.weekEnd})
                      </span>
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      Attended: {week.attendedCount} / {week.totalMarked || 0} ({week.weekPercent}%)
                    </span>
                  </div>

                  {/* Day-by-Day Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/15 border-b border-border text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="text-left py-2 px-4 font-medium width-[130px]">Date</th>
                          <th className="text-left py-2 px-4 font-medium width-[80px]">Day</th>
                          {selectedSubject === "all" && (
                            <th className="text-left py-2 px-4 font-medium">Subject</th>
                          )}
                          <th className="text-left py-2 px-4 font-medium width-[140px]">Status</th>
                          <th className="text-left py-2 px-4 font-medium">Remarks / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {week.days.map((day) => {
                          if (!day.records || day.records.length === 0) {
                            return (
                              <tr key={day.dateKey} className="hover:bg-muted/15">
                                <td className="py-2 px-4 text-foreground font-medium">
                                  {day.formattedDate}
                                </td>
                                <td className="py-2 px-4 text-muted-foreground">
                                  {day.dayName}
                                </td>
                                {selectedSubject === "all" && (
                                  <td className="py-2 px-4 text-muted-foreground">—</td>
                                )}
                                <td className="py-2 px-4">
                                  {renderStatusBadge("not_marked")}
                                </td>
                                <td className="py-2 px-4 text-muted-foreground">—</td>
                              </tr>
                            );
                          }

                          return day.records.map((rec, rIdx) => (
                            <tr key={`${day.dateKey}-${rec.subjectId || rIdx}`} className="hover:bg-muted/15">
                              <td className="py-2 px-4 text-foreground font-medium">
                                {rIdx === 0 ? day.formattedDate : ""}
                              </td>
                              <td className="py-2 px-4 text-muted-foreground">
                                {rIdx === 0 ? day.dayName : ""}
                              </td>
                              {selectedSubject === "all" && (
                                <td className="py-2 px-4 font-semibold text-foreground">
                                  {rec.subjectName}
                                </td>
                              )}
                              <td className="py-2 px-4">
                                {renderStatusBadge(rec.status)}
                              </td>
                              <td className="py-2 px-4 text-muted-foreground">
                                {rec.notes || "—"}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-start gap-4 pt-3 border-t border-border text-[11px] text-muted-foreground flex-wrap">
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
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Short Leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> Holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60" /> Not marked
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
