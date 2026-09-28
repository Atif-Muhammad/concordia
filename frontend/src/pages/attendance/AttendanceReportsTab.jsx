import React, { useState, useMemo } from "react";
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
import { SlidersHorizontal, Printer } from "lucide-react";
import {
  getAcademicSessions,
  getClasses,
  getSections,
  getTeacherClasses,
  getAttendanceReport,
} from "../../../config/apis";
import { hasPermission } from "@/lib/navigation.jsx";

export default function AttendanceReportsTab() {
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

  const { data: allClasses = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: allSections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  const { data: teacherClassMappings = [] } = useQuery({
    queryKey: ["teacherClasses"],
    queryFn: getTeacherClasses,
    enabled: isTeacherScoped,
  });

  const teacherClasses = isTeacherScoped
    ? teacherClassMappings
        .map((mapping) => ({
          ...mapping.class,
          programName: mapping.class?.program?.name || "N/A",
        }))
        .filter(Boolean)
    : [];

  const uniqueTeacherClasses = teacherClasses.filter(
    (c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx
  );

  const reportFilteredClasses = isTeacherScoped ? uniqueTeacherClasses : allClasses;

  const {
    data: reportData = [],
    refetch: refetchReport,
    isFetching: isFetchingReport,
  } = useQuery({
    queryKey: [
      "attendanceReport",
      reportStartDate,
      reportEndDate,
      reportClassId,
      reportSectionId,
      reportSessionId,
    ],
    queryFn: () => {
      const classParam = reportClassId === "*" ? "" : reportClassId;
      const sectionParam = reportSectionId === "*" ? "" : reportSectionId;
      const sessionParam = reportSessionId === "all" ? undefined : reportSessionId;
      return getAttendanceReport(
        reportStartDate,
        reportEndDate,
        classParam,
        sectionParam,
        sessionParam
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

    const printWindow = window.open("", "", "height=600,width=800");
    printWindow.document.write("<html><head><title>Attendance Report</title>");
    printWindow.document.write("<style>");
    printWindow.document.write("body { font-family: Arial, sans-serif; margin: 20px; }");
    printWindow.document.write("table { width: 100%; border-collapse: collapse; }");
    printWindow.document.write(
      "th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }"
    );
    printWindow.document.write("th { background-color: #f5f5f5; font-weight: bold; }");
    printWindow.document.write(".present { background-color: #dcfce7; color: #166534; }");
    printWindow.document.write(".absent { background-color: #fee2e2; color: #991b1b; }");
    printWindow.document.write(".leave { background-color: #fef3c7; color: #92400e; }");
    printWindow.document.write("</style></head><body>");
    printWindow.document.write('<h2 style="text-align: center;">Attendance Report</h2>');
    printWindow.document.write(
      '<p style="text-align: center;">' +
        new Date(reportStartDate).toLocaleDateString() +
        " to " +
        new Date(reportEndDate).toLocaleDateString() +
        "</p>"
    );
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  return (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Session</Label>
              <Select
                value={reportSessionId}
                onValueChange={(val) => {
                  setReportSessionId(val);
                  refetchReport();
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end mt-4">
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
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.programName} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section (Optional)</Label>
              <Select
                value={reportSectionId}
                onValueChange={setReportSectionId}
                disabled={!reportClassId || reportClassId === "*"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Sections</SelectItem>
                  {reportClassId &&
                    reportClassId !== "*" &&
                    allSections
                      .filter((s) => s.classId === Number(reportClassId))
                      .map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
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
                  return (student.subjects || []).map((subject, index) => {
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
                        key={`${student.id}-${subject.subjectId}`}
                        className="hover:bg-muted/30"
                      >
                        {isFirstRow && (
                          <>
                            <TableCell
                              rowSpan={student.subjects?.length || 1}
                              className="font-medium sticky left-0 bg-background border-r align-top pt-4"
                            >
                              {student.rollNumber}
                            </TableCell>
                            <TableCell
                              rowSpan={student.subjects?.length || 1}
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
  );
}
