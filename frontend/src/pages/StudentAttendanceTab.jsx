import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Printer, Search } from "lucide-react";
import { useMemo } from "react";

export const StudentAttendanceTab = ({
    studentSearchQuery,
    setStudentSearchQuery,
    searchResults,
    isSearching,
    selectedStudent,
    handleStudentSearch,
    handleSelectStudent,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    reportData,
    generateReport,
    isFetchingReport,
    showFilters = true,
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
                subject.attendance.forEach(a => {
                    const status = String(a.status || "").toLowerCase();
                    if (status === 'present') presentCount++;
                    else if (status === 'absent') absentCount++;
                    else if (status === 'leave') leaveCount++;
                    else if (status === 'short_leave') shortLeaveCount++;
                });
            });
        }

        // Calculate percentage based on total possible attendance slots (days * subjects)
        // Or should it be based on days? 
        // Usually attendance percentage is (Total Present / Total Classes Held) * 100
        // Total Classes Held = Sum of all attendance records across all subjects
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

        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Individual Attendance Report</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: Arial, sans-serif; margin: 20px; }');
        printWindow.document.write('h2, h3 { text-align: center; margin: 10px 0; }');
        printWindow.document.write('.student-info { margin: 20px 0; }');
        printWindow.document.write('.student-info p { margin: 5px 0; }');
        printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
        printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }');
        printWindow.document.write('th { background-color: #f5f5f5; font-weight: bold; }');
        printWindow.document.write('.present { background-color: #dcfce7; color: #166534; }');
        printWindow.document.write('.absent { background-color: #fee2e2; color: #991b1b; }');
        printWindow.document.write('.leave { background-color: #fef3c7; color: #92400e; }');
        printWindow.document.write('</style></head><body>');
        printWindow.document.write('<h2>Individual Student Attendance Report</h2>');
        printWindow.document.write('<div class="student-info">');
        printWindow.document.write('<p><strong>Student:</strong> ' + selectedStudent.fName + ' ' + selectedStudent.lName + '</p>');
        printWindow.document.write('<p><strong>Roll Number:</strong> ' + selectedStudent.rollNumber + '</p>');
        printWindow.document.write('<p><strong>Class:</strong> ' + (selectedStudent.class?.name || 'N/A') + ' - ' + (selectedStudent.section?.name || 'N/A') + '</p>');
        printWindow.document.write('<p><strong>Period:</strong> ' + new Date(startDate).toLocaleDateString() + ' to ' + new Date(endDate).toLocaleDateString() + '</p>');
        printWindow.document.write('</div>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <Card className="shadow-soft">
            <CardHeader>
                <CardTitle>Individual Student Attendance Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className={`transition-all duration-300 ease-out overflow-hidden ${showFilters ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-2 md:col-span-2">
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
                                {isSearching && <p className="text-sm text-muted-foreground">Searching...</p>}
                                {searchResults.length > 0 && (
                                    <div className="border rounded-md max-h-48 overflow-y-auto bg-card">
                                        {searchResults.map(student => (
                                            <div
                                                key={student.id}
                                                onClick={() => handleSelectStudent(student)}
                                                className="px-3 py-2 hover:bg-primary/10 cursor-pointer border-b last:border-0 transition-colors"
                                            >
                                                <p className="font-medium">{student.rollNumber} - {student.fName} {student.lName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {student.class?.name} {student.section && `- ${student.section.name}`}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {selectedStudent && (
                                    <div className="p-3 rounded-md border border-primary/30 bg-primary/10">
                                        <p className="font-medium text-foreground">Selected: {selectedStudent.rollNumber} - {selectedStudent.fName} {selectedStudent.lName}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedStudent.class?.name} {selectedStudent.section && `- ${selectedStudent.section.name}`}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex gap-4">
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
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-6">
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
                                        return student.subjects.map((subject, index) => {
                                            const isFirstRow = index === 0;
                                            const attendanceMap = {};
                                            subject.attendance.forEach(att => {
                                                const dateKey = typeof att.date === "string" && att.date.length >= 10
                                                    ? att.date.slice(0, 10)
                                                    : new Date(att.date).toISOString().slice(0, 10);
                                                attendanceMap[dateKey] = att.status;
                                            });

                                            const present = subject.attendance.filter(a => String(a.status || "").toLowerCase() === 'present').length;
                                            const absent = subject.attendance.filter(a => String(a.status || "").toLowerCase() === 'absent').length;
                                            const leave = subject.attendance.filter(a => String(a.status || "").toLowerCase() === 'leave').length;

                                            return (
                                                <TableRow key={`${student.id}-${subject.subjectId}`} className="hover:bg-muted/30">
                                                    {isFirstRow && (
                                                        <>
                                                            <TableCell rowSpan={student.subjects.length} className="font-medium sticky left-0 bg-background border-r align-top pt-4">
                                                                {student.rollNumber}
                                                            </TableCell>
                                                            <TableCell rowSpan={student.subjects.length} className="sticky left-20 bg-background border-r align-top pt-4">
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
