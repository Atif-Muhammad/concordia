import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SlidersHorizontal, Printer, ArrowLeft } from "lucide-react";
import {
  getAcademicSessions,
  getClasses,
  getSections,
  getTeacherClasses,
  getAttendanceReport,
  getProgramNames,
} from "../../../config/apis";
import { hasPermission } from "@/lib/navigation.jsx";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return String(val._id || val.id || "");
  return String(val);
};

export default function AttendanceReportsTab({ onBack }) {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData(["currentUser"]);
  const isTeacher = currentUser?.role === "Teacher" || currentUser?.role === "TEACHER";
  const canViewAllReports = Boolean(
    currentUser?.permissions?.all === true ||
    hasPermission(currentUser, "Attendance", "reports", "read")
  );
  const isTeacherScoped = isTeacher && !canViewAllReports;

  const [showReportFilters, setShowReportFilters] = useState(true);
  const [reportStartDate, setReportStartDate] = useState(
    new Date(new Date().setDate(1)).toISOString().split("T")[0]
  );
  const [reportEndDate, setReportEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportProgramId, setReportProgramId] = useState("*");
  const [reportClassId, setReportClassId] = useState("*");
  const [reportSectionId, setReportSectionId] = useState("*");
  const [reportSessionId, setReportSessionId] = useState("all");

  const MAX_REPORT_RANGE_DAYS = 1500;
  const parseIsoDateOnly = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const getRangeDays = (start, end) => {
    if (!start || !end) return 0;
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (!Number.isFinite(days) || days <= 0 || days > MAX_REPORT_RANGE_DAYS) return 0;
    return days;
  };

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  useEffect(() => {
    if (academicSessions?.length > 0 && (reportSessionId === "all" || !reportSessionId)) {
      const active = academicSessions.find((s) => s.isActive || s.status === "ACTIVE");
      if (active) {
        setReportSessionId(String(active.id || active._id));
      }
    }
  }, [academicSessions]);

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
          prog?.name ? prog : allPrograms.find((p) => extractId(p) === pId) || { _id: pId, id: pId, name: pId }
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

  const reportFilteredClasses = useMemo(() => {
    const baseList = isTeacherScoped ? teacherClasses : allClasses;
    if (!reportProgramId || reportProgramId === "*") return baseList;
    return baseList.filter((c) => extractId(c.programId || c.program) === reportProgramId);
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
    ],
    queryFn: () => {
      const classParam = reportClassId === "*" ? "" : reportClassId;
      const sectionParam = reportSectionId === "*" ? "" : reportSectionId;
      const sessionParam = reportSessionId === "all" ? undefined : reportSessionId;
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
    enabled: false,
  });

  const dailyStats = useMemo(() => {
    if (!reportData.length || !reportStartDate || !reportEndDate) {
      return {
        totalStudents: 0,
        totalDays: 0,
        recordedClasses: 0,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        shortLeaveCount: 0,
        attendanceRate: 0,
      };
    }

    const start = parseIsoDateOnly(reportStartDate);
    const end = parseIsoDateOnly(reportEndDate);
    const totalDays = getRangeDays(start, end);

    const stats = {
      totalStudents: reportData.length,
      totalDays,
      recordedClasses: 0,
      presentCount: 0,
      absentCount: 0,
      leaveCount: 0,
      shortLeaveCount: 0,
      attendanceRate: 0,
    };

    if (!totalDays) return stats;

    reportData.forEach((student) => {
      student.subjects?.forEach((subject) => {
        subject.attendance?.forEach((att) => {
          const status = String(att.status || "").toLowerCase();
          if (status === "present") stats.presentCount++;
          else if (status === "absent") stats.absentCount++;
          else if (status === "leave") stats.leaveCount++;
          else if (status === "short_leave") stats.shortLeaveCount++;
        });
      });
    });

    stats.recordedClasses =
      stats.presentCount + stats.absentCount + stats.leaveCount + stats.shortLeaveCount;
    stats.attendanceRate = stats.recordedClasses
      ? Number(
          (
            ((stats.presentCount + stats.shortLeaveCount) / stats.recordedClasses) *
            100
          ).toFixed(1)
        )
      : 0;

    return stats;
  }, [reportData, reportStartDate, reportEndDate]);

  const reportDates = useMemo(() => {
    if (!reportStartDate || !reportEndDate) return [];

    const dates = [];
    const start = parseIsoDateOnly(reportStartDate);
    const end = parseIsoDateOnly(reportEndDate);
    const totalDays = getRangeDays(start, end);
    if (!totalDays) return dates;

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }

    return dates;
  }, [reportStartDate, reportEndDate]);

  const reportDailyTrend = useMemo(() => {
    if (!reportDates.length || !reportData.length) return [];
    const toDateKey = (value) => {
      if (!value) return "";
      if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
      return new Date(value).toISOString().slice(0, 10);
    };
    return reportDates.map((date) => {
      let present = 0;
      let absent = 0;
      let leave = 0;
      let shortLeave = 0;
      reportData.forEach((student) => {
        student.subjects?.forEach((subject) => {
          subject.attendance?.forEach((att) => {
            if (toDateKey(att.date) !== date) return;
            const status = String(att.status || "").toLowerCase();
            if (status === "present") present++;
            else if (status === "absent") absent++;
            else if (status === "leave") leave++;
            else if (status === "short_leave") shortLeave++;
          });
        });
      });
      const total = present + absent + leave + shortLeave;
      return {
        date,
        total,
        present,
        absent,
        leave,
        shortLeave,
        presentRate: total ? (present / total) * 100 : 0,
      };
    });
  }, [reportDates, reportData]);

  const printAttendanceReport = () => {
    const printContent = document.querySelector(".attendance-register-table");
    if (!printContent) return;

    const sessionObj = academicSessions.find((s) => String(s.id) === String(reportSessionId));
    const sessionLabel = sessionObj?.name || (reportSessionId === "all" ? "All Sessions" : reportSessionId);

    const progObj = availablePrograms.find((p) => extractId(p) === reportProgramId);
    const programLabel = progObj?.name || (reportProgramId === "*" ? "All Programs" : reportProgramId);

    const classObj = reportFilteredClasses.find((c) => extractId(c) === reportClassId);
    const classLabel = classObj?.name || (reportClassId === "*" ? "All Classes" : reportClassId);

    const secObj = availableSections.find((s) => extractId(s) === reportSectionId);
    const sectionLabel = isSectionApplicable
      ? (secObj?.name || (reportSectionId === "*" ? "All Sections" : reportSectionId))
      : "N/A (No Section)";

    const formattedStartDate = new Date(reportStartDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const formattedEndDate = new Date(reportEndDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const printDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    const printWindow = window.open("", "", "height=700,width=1000");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Report</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 10px;
            color: #0f172a;
            background: #fff;
            font-size: 11px;
            line-height: 1.3;
          }
          .header-container {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 16px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .logo-box {
            width: 64px;
            height: 64px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo-box img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .header-text {
            text-align: left;
          }
          .college-title {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 0.8px;
            color: #0f172a;
            text-transform: uppercase;
            margin: 0;
            line-height: 1.2;
          }
          .report-subtitle {
            font-family: 'Alex Brush', cursive;
            font-size: 28px;
            color: #334155;
            margin: 2px 0 0 0;
            line-height: 1.1;
            font-weight: normal;
          }
          .meta-strip {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 6px 10px;
            margin-bottom: 12px;
            font-size: 10px;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
          }
          .meta-label {
            font-size: 8px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-val {
            font-size: 10px;
            font-weight: 600;
            color: #0f172a;
          }
          .stats-strip {
            display: flex;
            gap: 16px;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 6px 10px;
            margin-bottom: 12px;
            font-size: 10px;
          }
          .stat-item {
            display: flex;
            gap: 4px;
          }
          .stat-label {
            color: #64748b;
            font-weight: 500;
          }
          .stat-val {
            font-weight: 700;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 5px 6px;
            text-align: center;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #0f172a;
            font-weight: 700;
          }
          .sticky {
            position: static !important;
          }
          .footer {
            margin-top: 14px;
            font-size: 8px;
            color: #94a3b8;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="logo-box">
            <img src="/logo.png" alt="Concordia College Peshawar" />
          </div>
          <div class="header-text">
            <h1 class="college-title">CONCORDIA COLLEGE PESHAWAR</h1>
            <div class="report-subtitle">Attendance Report</div>
          </div>
        </div>

        <div class="meta-strip">
          <div class="meta-item"><span class="meta-label">Session</span><span class="meta-val">${sessionLabel}</span></div>
          <div class="meta-item"><span class="meta-label">Program</span><span class="meta-val">${programLabel}</span></div>
          <div class="meta-item"><span class="meta-label">Class</span><span class="meta-val">${classLabel}</span></div>
          <div class="meta-item"><span class="meta-label">Section</span><span class="meta-val">${sectionLabel}</span></div>
          <div class="meta-item"><span class="meta-label">Period</span><span class="meta-val">${formattedStartDate} - ${formattedEndDate}</span></div>
          <div class="meta-item"><span class="meta-label">Printed On</span><span class="meta-val">${printDate}</span></div>
        </div>

        <div class="stats-strip">
          <div class="stat-item"><span class="stat-label">Students:</span> <span class="stat-val">${dailyStats.totalStudents}</span></div>
          <div class="stat-item"><span class="stat-label">Days:</span> <span class="stat-val">${dailyStats.totalDays}</span></div>
          <div class="stat-item"><span class="stat-label">Recorded:</span> <span class="stat-val">${dailyStats.recordedClasses}</span></div>
          <div class="stat-item"><span class="stat-label">Present:</span> <span class="stat-val" style="color: #166534;">${dailyStats.presentCount}</span></div>
          <div class="stat-item"><span class="stat-label">Absent:</span> <span class="stat-val" style="color: #991b1b;">${dailyStats.absentCount}</span></div>
          <div class="stat-item"><span class="stat-label">Leave:</span> <span class="stat-val" style="color: #92400e;">${dailyStats.leaveCount}</span></div>
          <div class="stat-item"><span class="stat-label">Rate:</span> <span class="stat-val" style="color: #2563eb;">${dailyStats.attendanceRate}%</span></div>
        </div>

        ${printContent.innerHTML}

        <div class="footer">
          Generated via Concordia College Management System
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="space-y-4">
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
      <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Attendance Report</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowReportFilters((s) => !s)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showReportFilters ? "Hide Filters" : "Filters"}
          </Button>
        </div>
        {isTeacher && !canViewAllReports && (
          <p className="text-sm text-muted-foreground">
            You can only view reports for your assigned classes.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`transition-all duration-300 ease-out overflow-hidden ${
            showReportFilters
              ? "max-h-[520px] opacity-100"
              : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div className="space-y-2">
              <Label>Session</Label>
              <Select
                value={reportSessionId}
                onValueChange={(val) => {
                  setReportSessionId(val);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {academicSessions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={reportProgramId}
                onValueChange={(val) => {
                  setReportProgramId(val);
                  setReportClassId("*");
                  setReportSectionId("*");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Programs" />
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

            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={reportClassId}
                onValueChange={(val) => {
                  setReportClassId(val);
                  setReportSectionId("*");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Classes</SelectItem>
                  {reportFilteredClasses.map((c) => (
                    <SelectItem key={extractId(c)} value={extractId(c)}>
                      {c.name || c.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={reportSectionId}
                onValueChange={setReportSectionId}
                disabled={!reportClassId || reportClassId === "*" || !isSectionApplicable}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={!isSectionApplicable ? "Not Applicable" : "All Sections"}
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

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={() => refetchReport()}
            disabled={!reportStartDate || !reportEndDate || isFetchingReport}
          >
            Generate Report
          </Button>
          <Button
            variant="outline"
            onClick={printAttendanceReport}
            disabled={!reportData.length}
            className="gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
        </div>

        {reportData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{dailyStats.totalStudents}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Days</p>
                <p className="text-2xl font-bold">{dailyStats.totalDays}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Recorded Classes</p>
                <p className="text-2xl font-bold">{dailyStats.recordedClasses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Present</p>
                <p className="text-2xl font-bold text-green-600">{dailyStats.presentCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-red-600">{dailyStats.absentCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
                <p className="text-2xl font-bold text-primary">{dailyStats.attendanceRate}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {reportData.length > 0 && (
          <Card className="mt-6 border-dashed">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Status Distribution</p>
                <p className="text-xs text-muted-foreground">Based on recorded class entries</p>
              </div>
              <div className="w-full h-4 rounded-full bg-muted overflow-hidden flex">
                {dailyStats.recordedClasses > 0 && (
                  <>
                    <div
                      className="bg-green-500"
                      style={{
                        width: `${(dailyStats.presentCount / dailyStats.recordedClasses) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-500"
                      style={{
                        width: `${(dailyStats.absentCount / dailyStats.recordedClasses) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-amber-500"
                      style={{
                        width: `${(dailyStats.leaveCount / dailyStats.recordedClasses) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-blue-500"
                      style={{
                        width: `${
                          (dailyStats.shortLeaveCount / dailyStats.recordedClasses) * 100
                        }%`,
                      }}
                    />
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-md border p-2">
                  <span className="text-green-600 font-semibold">Present:</span>{" "}
                  {dailyStats.presentCount}
                </div>
                <div className="rounded-md border p-2">
                  <span className="text-red-600 font-semibold">Absent:</span>{" "}
                  {dailyStats.absentCount}
                </div>
                <div className="rounded-md border p-2">
                  <span className="text-amber-600 font-semibold">Leave:</span>{" "}
                  {dailyStats.leaveCount}
                </div>
                <div className="rounded-md border p-2">
                  <span className="text-blue-600 font-semibold">Short Leave:</span>{" "}
                  {dailyStats.shortLeaveCount}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {reportDailyTrend.length > 0 && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Daily Presence Trend</p>
                <p className="text-xs text-muted-foreground">Present ratio by date</p>
              </div>
              <div className="relative h-28">
                <div className="absolute inset-0 flex items-end gap-1">
                  {reportDailyTrend.map((d) => (
                    <div key={d.date} className="flex-1 min-w-[10px] h-full flex items-end group">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-primary/85 to-primary/40 transition-all"
                        style={{ height: `${Math.max(6, d.presentRate)}%` }}
                        title={`${d.date}: ${d.present}/${d.total || 0} present`}
                      />
                    </div>
                  ))}
                </div>
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {reportDailyTrend.length > 1 && (
                    <polyline
                      points={reportDailyTrend
                        .map((d, i) => {
                          const x = (i / (reportDailyTrend.length - 1)) * 100;
                          const y = 100 - Math.max(6, d.presentRate);
                          return `${x},${y}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="1.8"
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </div>
            </CardContent>
          </Card>
        )}

        {reportData.length > 0 && (
          <div className="overflow-x-auto mt-6 border rounded-lg attendance-register-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 border-r px-3 text-sm">
                    Roll No
                  </TableHead>
                  <TableHead className="sticky left-20 bg-background z-10 border-r min-w-[200px] px-3 text-sm">
                    Student Name
                  </TableHead>
                  <TableHead className="border-r min-w-[150px] px-3 text-sm">Subject</TableHead>
                  {reportDates.map((date) => {
                    const dateObj = new Date(date);
                    return (
                      <TableHead key={date} className="text-center min-w-[60px] border-r">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">
                            {dateObj.toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                          <span className="text-xs">
                            {dateObj.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="font-bold">{dateObj.getDate()}</span>
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-center bg-green-50/50 border-r px-3 text-sm">
                    P
                  </TableHead>
                  <TableHead className="text-center bg-red-50/50 border-r px-3 text-sm">
                    A
                  </TableHead>
                  <TableHead className="text-center bg-amber-50/50 px-3 text-sm">
                    L
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((student) => {
                  const subjects = student.subjects?.length > 0
                    ? student.subjects
                    : [{ subjectId: "general", subjectName: "General", attendance: [] }];
                  return subjects.map((subject, index) => {
                    const isFirstRow = index === 0;
                    const attendanceMap = {};
                    (subject.attendance || []).forEach((att) => {
                      attendanceMap[att.date] = att.status;
                    });

                    const present = (subject.attendance || []).filter(
                      (a) => String(a.status || "").toLowerCase() === "present"
                    ).length;
                    const absent = (subject.attendance || []).filter(
                      (a) => String(a.status || "").toLowerCase() === "absent"
                    ).length;
                    const leave = (subject.attendance || []).filter(
                      (a) => String(a.status || "").toLowerCase() === "leave"
                    ).length;

                    return (
                      <TableRow
                        key={`${student.id || student._id}-${subject.subjectId}`}
                        className="hover:bg-muted/30"
                      >
                        {isFirstRow && (
                          <>
                            <TableCell
                              rowSpan={subjects.length}
                              className="font-medium sticky left-0 bg-background border-r align-top pt-4"
                            >
                              {student.rollNumber}
                            </TableCell>
                            <TableCell
                              rowSpan={subjects.length}
                              className="sticky left-20 bg-background border-r align-top pt-4"
                            >
                              {student.name}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="py-2 border-r font-medium text-sm px-3">
                          {subject.subjectName}
                        </TableCell>
                        {reportDates.map((date) => {
                          const status = attendanceMap[date];
                          return (
                            <TableCell key={date} className="text-center border-r p-2">
                              {String(status || "").toLowerCase() === "present" && (
                                <span className="inline-block w-7 h-7 leading-7 rounded-md bg-green-50 text-green-700 font-semibold text-xs">
                                  P
                                </span>
                              )}
                              {String(status || "").toLowerCase() === "absent" && (
                                <span className="inline-block w-7 h-7 leading-7 rounded-md bg-red-50 text-red-700 font-semibold text-xs">
                                  A
                                </span>
                              )}
                              {String(status || "").toLowerCase() === "leave" && (
                                <span className="inline-block w-7 h-7 leading-7 rounded-md bg-amber-50 text-amber-700 font-semibold text-xs">
                                  L
                                </span>
                              )}
                              {String(status || "").toLowerCase() === "short_leave" && (
                                <span className="inline-block w-7 h-7 leading-7 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px]">
                                  SL
                                </span>
                              )}
                              {!status && <span className="text-gray-300">-</span>}
                            </TableCell>
                          );
                        })}
                        <TableCell className="py-2 text-center font-semibold text-green-700 bg-green-50/50 border-r px-3 text-sm">
                          {present}
                        </TableCell>
                        <TableCell className="py-2 text-center font-semibold text-red-700 bg-red-50/50 border-r px-3 text-sm">
                          {absent}
                        </TableCell>
                        <TableCell className="py-2 text-center font-semibold text-amber-700 bg-amber-50/50 px-3 text-sm">
                          {leave}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
