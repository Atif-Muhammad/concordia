import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Printer, Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const StudentAttendanceTab = ({
    studentSearchQuery,
    setStudentSearchQuery,
    searchResults,
    isSearching,
    selectedStudent,
    handleStudentSearch,
    handleSelectStudent,
    handleClearStudent,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    reportData,
    generateReport,
    isFetchingReport,
    showFilters = true,
    sessionId = "all",
    setSessionId,
    academicSessions = [],
}) => {
    // Calculate stats for the selected student
    const studentStats = useMemo(() => {
        if (!reportData || reportData.length === 0 || !startDate || !endDate) {
            return { totalDays: 0, presentCount: 0, absentCount: 0, leaveCount: 0, shortLeaveCount: 0, totalClasses: 0, percentage: 0 };
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const student = reportData[0];
        let presentCount = 0, absentCount = 0, leaveCount = 0, shortLeaveCount = 0;

        if (student && student.subjects) {
            student.subjects.forEach(subject => {
                subject.attendance?.forEach(a => {
                    const status = String(a.status || "").toLowerCase();
                    if (status === 'present') presentCount++;
                    else if (status === 'absent') absentCount++;
                    else if (status === 'leave') leaveCount++;
                    else if (status === 'short_leave') shortLeaveCount++;
                });
            });
        }

        const totalClasses = presentCount + absentCount + leaveCount + shortLeaveCount;
        const percentage = totalClasses > 0 ? (((presentCount + shortLeaveCount) / totalClasses) * 100).toFixed(1) : 0;

        return { totalDays, presentCount, absentCount, leaveCount, shortLeaveCount, totalClasses, percentage };
    }, [reportData, startDate, endDate]);

    // Generate all dates in the range
    const reportDates = useMemo(() => {
        if (!startDate || !endDate) return [];

        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            dates.push(date.toISOString().split('T')[0]);
        }

        return dates;
    }, [startDate, endDate]);

    const printAttendanceReport = () => {
        const printContent = document.querySelector('.individual-attendance-table');
        if (!printContent || !selectedStudent) return;

        const sessionObj = academicSessions.find((s) => String(s.id) === String(sessionId));
        const sessionLabel = sessionObj?.name || (sessionId === "all" ? "All Sessions" : sessionId);

        const studentName = `${selectedStudent.fName || ''} ${selectedStudent.lName || ''}`.trim() || selectedStudent.name || 'N/A';
        const fatherName = selectedStudent.fatherName || selectedStudent.fatherOrguardian || selectedStudent.parentOrGuardianName || reportData[0]?.fatherName || '—';
        const rollNo = selectedStudent.rollNumber || reportData[0]?.rollNumber || 'N/A';
        const progName = selectedStudent.program?.name || selectedStudent.programId?.name || reportData[0]?.program?.name || '—';
        const className = selectedStudent.class?.name || selectedStudent.classId?.name || reportData[0]?.class?.name || '—';
        const sectionName = selectedStudent.section?.name || selectedStudent.sectionId?.name || reportData[0]?.section?.name || '—';

        const formattedStartDate = new Date(startDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        const formattedEndDate = new Date(endDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        const printDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

        const printWindow = window.open('', '', 'height=700,width=1000');
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Individual Attendance Report - ${studentName}</title>
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
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 8px 12px;
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
                font-size: 11px;
                font-weight: 600;
                color: #0f172a;
              }
              .stats-strip {
                display: flex;
                gap: 16px;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-radius: 4px;
                padding: 6px 12px;
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
                <div class="report-subtitle">Individual Student Attendance Report</div>
              </div>
            </div>

            <div class="meta-strip">
              <div class="meta-item"><span class="meta-label">Student Name</span><span class="meta-val">${studentName}</span></div>
              <div class="meta-item"><span class="meta-label">Father's Name</span><span class="meta-val">${fatherName}</span></div>
              <div class="meta-item"><span class="meta-label">Roll Number</span><span class="meta-val">${rollNo}</span></div>
              <div class="meta-item"><span class="meta-label">Session</span><span class="meta-val">${sessionLabel}</span></div>
              <div class="meta-item"><span class="meta-label">Program</span><span class="meta-val">${progName}</span></div>
              <div class="meta-item"><span class="meta-label">Class & Section</span><span class="meta-val">${className} - ${sectionName}</span></div>
              <div class="meta-item"><span class="meta-label">Period</span><span class="meta-val">${formattedStartDate} - ${formattedEndDate}</span></div>
              <div class="meta-item"><span class="meta-label">Printed On</span><span class="meta-val">${printDate}</span></div>
            </div>

            <div class="stats-strip">
              <div class="stat-item"><span class="stat-label">Total Days:</span> <span class="stat-val">${studentStats.totalDays}</span></div>
              <div class="stat-item"><span class="stat-label">Classes Held:</span> <span class="stat-val">${studentStats.totalClasses}</span></div>
              <div class="stat-item"><span class="stat-label">Present:</span> <span class="stat-val" style="color: #166534;">${studentStats.presentCount}</span></div>
              <div class="stat-item"><span class="stat-label">Absent:</span> <span class="stat-val" style="color: #991b1b;">${studentStats.absentCount}</span></div>
              <div class="stat-item"><span class="stat-label">Leave:</span> <span class="stat-val" style="color: #92400e;">${studentStats.leaveCount}</span></div>
              <div class="stat-item"><span class="stat-label">Attendance Rate:</span> <span class="stat-val" style="color: #2563eb;">${studentStats.percentage}%</span></div>
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
        <Card className="shadow-soft">
            <CardHeader>
                <CardTitle>Individual Student Attendance Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className={`transition-all duration-300 ease-out overflow-hidden ${showFilters ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                            <div className="space-y-2 md:col-span-2 relative">
                                <Label>Search Student (by name or roll number)</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Type student name or roll number..."
                                        value={studentSearchQuery}
                                        onChange={(e) => handleStudentSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                {isSearching && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
                                {searchResults.length > 0 && (
                                    <div className="border rounded-md max-h-48 overflow-y-auto bg-card shadow-lg absolute z-20 w-full left-0 mt-1">
                                        {searchResults.map(student => (
                                            <div
                                                key={student.id || student._id}
                                                onClick={() => handleSelectStudent(student)}
                                                className="px-3 py-2 hover:bg-primary/10 cursor-pointer border-b last:border-0 transition-colors"
                                            >
                                                <p className="font-medium text-xs text-foreground">{student.rollNumber} - {student.fName} {student.lName}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {student.program?.name || student.programId?.name ? `${student.program?.name || student.programId?.name} • ` : ""}
                                                    {student.class?.name || student.classId?.name || "Class"}
                                                    {(student.section?.name || student.sectionId?.name) ? ` - ${student.section?.name || student.sectionId?.name}` : ""}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {selectedStudent && (
                                    <div className="p-2 rounded-md border border-primary/30 bg-primary/10 flex items-center justify-between mt-2">
                                        <div>
                                            <p className="font-semibold text-xs text-foreground">Selected: {selectedStudent.rollNumber} - {selectedStudent.fName} {selectedStudent.lName}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {selectedStudent.program?.name || selectedStudent.programId?.name ? `${selectedStudent.program?.name || selectedStudent.programId?.name} • ` : ""}
                                                {selectedStudent.class?.name || selectedStudent.classId?.name}
                                                {(selectedStudent.section?.name || selectedStudent.sectionId?.name) ? ` - ${selectedStudent.section?.name || selectedStudent.sectionId?.name}` : ""}
                                            </p>
                                        </div>
                                        {handleClearStudent && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
                                                onClick={handleClearStudent}
                                            >
                                                Clear
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {setSessionId && (
                                <div className="space-y-2">
                                    <Label>Session</Label>
                                    <Select value={sessionId} onValueChange={setSessionId}>
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
                            )}

                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-4">
                            <Button onClick={generateReport} disabled={!selectedStudent || !startDate || !endDate || isFetchingReport}>
                                Generate Report
                            </Button>
                            <Button variant="outline" onClick={printAttendanceReport} disabled={!reportData || reportData.length === 0} className="gap-2">
                                <Printer className="w-4 h-4" />
                                Print Report
                            </Button>
                        </div>
                </div>

                {reportData && reportData.length > 0 && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mt-6">
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Total Days</p>
                                    <p className="text-2xl font-bold">{studentStats.totalDays}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Present</p>
                                    <p className="text-2xl font-bold text-green-600">{studentStats.presentCount}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Absent</p>
                                    <p className="text-2xl font-bold text-red-600">{studentStats.absentCount}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Absent Fine (Est.)</p>
                                    <p className="text-2xl font-bold text-rose-600">PKR {(studentStats.absentCount * 50).toLocaleString()}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">PKR 50/subject absentee</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Leave</p>
                                    <p className="text-2xl font-bold text-amber-600">{studentStats.leaveCount}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Recorded Classes</p>
                                    <p className="text-2xl font-bold">{studentStats.totalClasses}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Attendance Rate</p>
                                    <p className="text-2xl font-bold text-primary">{studentStats.percentage}%</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="mt-4 border-dashed">
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">Status Distribution</p>
                                    <p className="text-xs text-muted-foreground">Weighted by subject attendance entries</p>
                                </div>
                                <div className="w-full h-4 rounded-full bg-muted overflow-hidden flex">
                                    {studentStats.totalClasses > 0 && (
                                        <>
                                            <div className="bg-green-500" style={{ width: `${(studentStats.presentCount / studentStats.totalClasses) * 100}%` }} />
                                            <div className="bg-red-500" style={{ width: `${(studentStats.absentCount / studentStats.totalClasses) * 100}%` }} />
                                            <div className="bg-amber-500" style={{ width: `${(studentStats.leaveCount / studentStats.totalClasses) * 100}%` }} />
                                            <div className="bg-blue-500" style={{ width: `${(studentStats.shortLeaveCount / studentStats.totalClasses) * 100}%` }} />
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="overflow-x-auto mt-6 border rounded-lg individual-attendance-table">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="sticky left-0 bg-background z-10 border-r">Roll No</TableHead>
                                        <TableHead className="sticky left-20 bg-background z-10 border-r min-w-[200px]">Student Name</TableHead>
                                        <TableHead className="border-r min-w-[150px]">Subject</TableHead>
                                        {reportDates.map(date => {
                                            const dateObj = new Date(date);
                                            return (
                                                <TableHead key={date} className="text-center min-w-[60px] border-r">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xs text-muted-foreground">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                                        <span className="text-xs">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                        <span className="font-bold">{dateObj.getDate()}</span>
                                                    </div>
                                                </TableHead>
                                            );
                                        })}
                                        <TableHead className="text-center bg-green-50/50 border-r">P</TableHead>
                                        <TableHead className="text-center bg-red-50/50 border-r">A</TableHead>
                                        <TableHead className="text-center bg-amber-50/50">L</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map(student => {
                                        const subjects = student.subjects?.length > 0
                                            ? student.subjects
                                            : [{ subjectId: 'general', subjectName: 'General', attendance: [] }];

                                        return subjects.map((subject, index) => {
                                            const isFirstRow = index === 0;
                                            const attendanceMap = {};
                                            (subject.attendance || []).forEach(att => {
                                                const dateKey = typeof att.date === "string" && att.date.length >= 10
                                                    ? att.date.slice(0, 10)
                                                    : new Date(att.date).toISOString().slice(0, 10);
                                                attendanceMap[dateKey] = att.status;
                                            });

                                            const present = (subject.attendance || []).filter(a => String(a.status || "").toLowerCase() === 'present').length;
                                            const absent = (subject.attendance || []).filter(a => String(a.status || "").toLowerCase() === 'absent').length;
                                            const leave = (subject.attendance || []).filter(a => String(a.status || "").toLowerCase() === 'leave').length;

                                            return (
                                                <TableRow key={`${student.id || student._id}-${subject.subjectId}`} className="hover:bg-muted/30">
                                                    {isFirstRow && (
                                                        <>
                                                            <TableCell rowSpan={subjects.length} className="font-medium sticky left-0 bg-background border-r align-top pt-4">
                                                                {student.rollNumber}
                                                            </TableCell>
                                                            <TableCell rowSpan={subjects.length} className="sticky left-20 bg-background border-r align-top pt-4">
                                                                {student.name}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    <TableCell className="border-r font-medium text-sm">{subject.subjectName}</TableCell>
                                                    {reportDates.map(date => {
                                                        const status = attendanceMap[date];
                                                        return (
                                                            <TableCell key={date} className="text-center border-r p-2">
                                                                {String(status || "").toLowerCase() === 'present' && <span className="inline-block w-7 h-7 leading-7 rounded-md bg-green-50 text-green-700 font-semibold text-xs">P</span>}
                                                                {String(status || "").toLowerCase() === 'absent' && <span className="inline-block w-7 h-7 leading-7 rounded-md bg-red-50 text-red-700 font-semibold text-xs">A</span>}
                                                                {String(status || "").toLowerCase() === 'leave' && <span className="inline-block w-7 h-7 leading-7 rounded-md bg-amber-50 text-amber-700 font-semibold text-xs">L</span>}
                                                                {String(status || "").toLowerCase() === 'short_leave' && <span className="inline-block w-7 h-7 leading-7 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px]">SL</span>}
                                                                {!status && <span className="text-gray-300">-</span>}
                                                            </TableCell>
                                                        );
                                                    })}
                                                    <TableCell className="text-center font-semibold text-green-700 bg-green-50/50 border-r">{present}</TableCell>
                                                    <TableCell className="text-center font-semibold text-red-700 bg-red-50/50 border-r">{absent}</TableCell>
                                                    <TableCell className="text-center font-semibold text-amber-700 bg-amber-50/50">{leave}</TableCell>
                                                </TableRow>
                                            );
                                        });
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};
