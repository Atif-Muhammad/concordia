import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Loader2, 
  ClipboardCheck, 
  Check, 
  X, 
  CheckCheck, 
  XCircle, 
  Users, 
  Save, 
  Search, 
  Calendar,
  School,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  userWho, 
  refreshTokens, 
  getTeacherClasses,
  getClasseOrSectionAttendance,
  updateAttendance,
  getHolidays,
  getAttendanceSkips
} from '../../../config/apis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export default function TeacherAttendance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClassData, setSelectedClassData] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceState, setAttendanceState] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const res = await userWho();
        return res;
      } catch (error) {
        if (error.response?.status === 401) {
          await refreshTokens();
          return userWho();
        }
        throw error;
      }
    },
  });

  const teacherStaffId = currentUser?.refId || currentUser?.staffDbId || currentUser?.id;

  const { data: classesData, isLoading: isClassesLoading } = useQuery({
    queryKey: ['teacherClasses', teacherStaffId],
    queryFn: () => getTeacherClasses(teacherStaffId),
    enabled: !!teacherStaffId,
  });

  const classes = useMemo(() => {
    return Array.isArray(classesData) ? classesData : classesData?.data || [];
  }, [classesData]);

  // Auto-select first class when loaded
  useEffect(() => {
    if (!selectedClassData && classes.length > 0) {
      setSelectedClassData(JSON.stringify(classes[0]));
    }
  }, [classes, selectedClassData]);

  const selectedClassDetails = useMemo(() => {
    if (!selectedClassData) return null;
    try {
      return JSON.parse(selectedClassData);
    } catch (e) {
      return null;
    }
  }, [selectedClassData]);

  const classId = selectedClassDetails?.classId?._id || selectedClassDetails?.classId || selectedClassDetails?.class?._id;
  const sectionId = selectedClassDetails?.sectionId?._id || selectedClassDetails?.sectionId || selectedClassDetails?.section?._id;
  const targetId = sectionId || classId;
  const fetchFor = sectionId ? 'section' : 'class';

  // 1. Fetch holidays
  const { data: holidaysData = [] } = useQuery({
    queryKey: ['holidays'],
    queryFn: getHolidays,
  });

  // 2. Fetch class/section attendance skips
  const { data: classSkipsData = [] } = useQuery({
    queryKey: ['attendanceSkips', classId, sectionId],
    queryFn: () => getAttendanceSkips(classId, sectionId || undefined),
    enabled: !!classId,
  });

  // 3. Fetch attendance records for this class & date
  const { data: attendanceData, isLoading: isAttendanceLoading } = useQuery({
    queryKey: ['classAttendance', targetId, date, fetchFor],
    queryFn: () => getClasseOrSectionAttendance(targetId, date, fetchFor),
    enabled: !!targetId && !!date,
  });

  // Detect whether selected date is a holiday or attendance skip
  const holidayInfo = useMemo(() => {
    if (!date) return null;
    const targetDate = date.split('T')[0];

    const holidays = Array.isArray(holidaysData) ? holidaysData : holidaysData?.data || [];
    const matchedHoliday = holidays.find((h) => {
      const startDate = (h.date || '').split('T')[0];
      const endDate = (h.endDate || h.date || '').split('T')[0];
      if (!startDate) return false;
      return targetDate >= startDate && targetDate <= endDate;
    });

    if (matchedHoliday) {
      return {
        isHoliday: true,
        title: matchedHoliday.title || 'Official Holiday',
        type: matchedHoliday.type || 'Holiday',
        description: matchedHoliday.description || '',
      };
    }

    const skips = Array.isArray(classSkipsData) ? classSkipsData : classSkipsData?.data || [];
    const matchedSkip = skips.find((s) => {
      const sDate = (s.date || '').split('T')[0];
      return sDate === targetDate;
    });

    if (matchedSkip) {
      return {
        isHoliday: true,
        title: matchedSkip.reason || 'Class Holiday',
        type: 'Class Attendance Skip',
        description: matchedSkip.reason || '',
      };
    }

    // Fallback: check if backend returned isHoliday in attendance records
    const records = Array.isArray(attendanceData)
      ? attendanceData
      : attendanceData?.data?.attendanceRecords || attendanceData?.attendanceRecords || attendanceData?.data || [];
    const recordWithHoliday = records.find(r => r.isHoliday || r.status?.toUpperCase() === 'HOLIDAY');
    if (recordWithHoliday) {
      return {
        isHoliday: true,
        title: recordWithHoliday.holidayTitle || recordWithHoliday.notes || 'Official Holiday',
        type: recordWithHoliday.holidayType || 'Holiday',
        description: '',
      };
    }

    return null;
  }, [date, holidaysData, classSkipsData, attendanceData]);

  const isHoliday = !!holidayInfo?.isHoliday;

  const students = useMemo(() => {
    if (!attendanceData) return [];
    if (Array.isArray(attendanceData)) return attendanceData;
    if (Array.isArray(attendanceData?.data?.attendanceRecords)) return attendanceData.data.attendanceRecords;
    if (Array.isArray(attendanceData?.attendanceRecords)) return attendanceData.attendanceRecords;
    if (Array.isArray(attendanceData?.data)) return attendanceData.data;
    return [];
  }, [attendanceData]);

  // Synchronize attendance state when attendance records arrive
  useEffect(() => {
    if (!attendanceData) return;
    const records = Array.isArray(attendanceData)
      ? attendanceData
      : attendanceData?.data?.attendanceRecords || attendanceData?.attendanceRecords || attendanceData?.data || [];
    
    if (records.length > 0) {
      const newState = {};
      records.forEach((record) => {
        const s = record.student || record.studentId;
        const sId = (s?._id || s?.id || (typeof s === 'string' ? s : null))?.toString();
        if (sId) {
          const raw = (record.status || 'Present').trim();
          newState[sId] = raw.toUpperCase() === 'ABSENT' ? 'Absent' : 'Present';
        }
      });
      setAttendanceState(newState);
    }
  }, [attendanceData]);

  const updateMutation = useMutation({
    mutationFn: (payload) => updateAttendance(classId, sectionId, null, date, payload),
    onSuccess: () => {
      toast({ 
        title: 'Attendance Saved', 
        description: `Successfully recorded attendance for ${date}.` 
      });
      queryClient.invalidateQueries(['classAttendance', targetId, date, fetchFor]);
    },
    onError: (error) => {
      toast({ 
        title: 'Error Saving Attendance', 
        description: error.message || 'Failed to update attendance records. Please try again.', 
        variant: 'destructive' 
      });
    }
  });

  const handleStatusChange = (studentId, status) => {
    if (isHoliday) return;
    setAttendanceState(prev => ({ ...prev, [studentId]: status }));
  };

  const handleMarkAllPresent = () => {
    if (isHoliday || students.length === 0) return;
    setAttendanceState(prev => {
      const next = { ...prev };
      students.forEach(record => {
        const s = record.student || record.studentId;
        const sId = (s?._id || s?.id || (typeof s === 'string' ? s : null))?.toString();
        if (sId) next[sId] = 'Present';
      });
      return next;
    });
    toast({
      title: 'All Marked Present',
      description: `All ${students.length} students set to Present.`,
    });
  };

  const handleMarkAllAbsent = () => {
    if (isHoliday || students.length === 0) return;
    setAttendanceState(prev => {
      const next = { ...prev };
      students.forEach(record => {
        const s = record.student || record.studentId;
        const sId = (s?._id || s?.id || (typeof s === 'string' ? s : null))?.toString();
        if (sId) next[sId] = 'Absent';
      });
      return next;
    });
    toast({
      title: 'All Marked Absent',
      description: `All ${students.length} students set to Absent.`,
    });
  };

  const handleSave = () => {
    if (isHoliday) {
      toast({
        title: 'Attendance Locked',
        description: `Cannot mark or save attendance on an official holiday (${holidayInfo?.title || 'Holiday'}).`,
        variant: 'destructive',
      });
      return;
    }
    if (students.length === 0) return;

    const payload = {
      classId,
      sectionId,
      date,
      rows: students.map(record => {
        const student = record.student || record.studentId;
        const studentId = (student?._id || student?.id || (typeof student === 'string' ? student : null))?.toString();
        const status = attendanceState[studentId] || 'Present';
        return {
          studentId,
          status: status.toUpperCase()
        };
      }),
      attendanceRecords: students.map(record => {
        const student = record.student || record.studentId;
        const studentId = (student?._id || student?.id || (typeof student === 'string' ? student : null))?.toString();
        const status = attendanceState[studentId] || 'Present';
        return {
          studentId,
          status: status.toUpperCase()
        };
      })
    };
    updateMutation.mutate(payload);
  };

  // Search filter
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase().trim();
    return students.filter((record) => {
      const student = record.student || record.studentId;
      const name = (
        student?.name ||
        `${student?.fName || student?.firstName || ''} ${student?.lName || student?.lastName || ''}`.trim()
      ).toLowerCase();
      const roll = (student?.rollNumber || student?.rollNo || '').toLowerCase();
      return name.includes(term) || roll.includes(term);
    });
  }, [students, searchTerm]);

  // Live Statistics
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    students.forEach((record) => {
      const student = record.student || record.studentId;
      const sId = (student?._id || student?.id || (typeof student === 'string' ? student : null))?.toString();
      const status = attendanceState[sId] || record.status || 'Present';
      if (status.toLowerCase() === 'absent') {
        absent += 1;
      } else {
        present += 1;
      }
    });
    const total = students.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, rate };
  }, [students, attendanceState]);

  if (isUserLoading || isClassesLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-primary" />
              Mark Attendance
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Rapidly record daily student attendance (Present & Absent) for your assigned classes
            </p>
          </div>
        </div>
        
        {/* Controls Card */}
        <Card className="border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <School className="w-4 h-4 text-primary" />
              Select Class & Date
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Class & Section</Label>
              <Select onValueChange={setSelectedClassData} value={selectedClassData}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select Class & Section" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls, index) => {
                    const cName = cls.classId?.name || cls.class?.name || 'Class';
                    const sName = cls.sectionId?.name || cls.section?.name;
                    const pName = cls.programId?.name || cls.program?.name || cls.classId?.programId?.name;
                    return (
                      <SelectItem key={index} value={JSON.stringify(cls)}>
                        {cName} {sName ? `(${sName})` : '(All Sections)'} {pName ? `• ${pName}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[220px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Date</Label>
              <div className="relative">
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  max={new Date().toISOString().split('T')[0]}
                  className="h-9 text-sm pr-8"
                />
                <Calendar className="w-4 h-4 absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Attendance Sheet */}
        {selectedClassData && (
          <Card className="border shadow-2xs">
            <CardHeader className="p-4 pb-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/10">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base font-semibold text-foreground">
                    Attendance Sheet
                  </CardTitle>
                  {!isHoliday ? (
                    <>
                      <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                        {stats.present} Present
                      </Badge>
                      <Badge variant="outline" className="text-xs font-semibold bg-red-500/10 text-red-600 border-red-200">
                        {stats.absent} Absent
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono bg-muted text-foreground">
                        {stats.rate}% Rate
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs font-semibold bg-primary/15 text-primary border-primary/30">
                      Holiday • Locked
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Showing {students.length} students for {date}
                </CardDescription>
              </div>

              {/* Bulk Actions and Save Button */}
              {students.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllPresent}
                    disabled={isHoliday}
                    className="h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
                    title={isHoliday ? "Attendance disabled on holidays" : "Mark all students as Present"}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark All Present
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllAbsent}
                    disabled={isHoliday}
                    className="h-8 text-xs font-semibold gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50"
                    title={isHoliday ? "Attendance disabled on holidays" : "Mark all students as Absent"}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Mark All Absent
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={isHoliday || updateMutation.isPending || students.length === 0}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-8 text-xs gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isHoliday ? "Cannot save attendance on a holiday" : "Save attendance"}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save Attendance
                  </Button>
                </div>
              )}
            </CardHeader>

            {/* Holiday Warning Banner */}
            {isHoliday && (
              <div className="m-4 mb-2 p-3.5 sm:p-4 rounded-lg bg-primary/10 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {holidayInfo.title}
                      </span>
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[11px] font-semibold">
                        {holidayInfo.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This date is marked as an official holiday in the academic calendar. Marking or modifying attendance is disabled.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-xs font-semibold px-2.5 py-1 shrink-0 self-start sm:self-center">
                  Attendance Locked
                </Badge>
              </div>
            )}

            {/* Quick Search Bar */}
            {students.length > 5 && (
              <div className="p-3 border-b bg-muted/5">
                <div className="relative max-w-sm">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search by student name or roll number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-xs pl-8"
                  />
                </div>
              </div>
            )}

            <CardContent className="p-0">
              {isAttendanceLoading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-2">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Loading student attendance...</p>
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No students enrolled in this class/section.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[40px] sm:w-[50px] text-xs font-semibold py-2 px-2 sm:px-3 hidden sm:table-cell">#</TableHead>
                        <TableHead className="w-[140px] sm:w-[170px] text-xs font-semibold py-2 px-2 sm:px-3 hidden sm:table-cell">Roll Number</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3">Student Name</TableHead>
                        <TableHead className="w-[160px] sm:w-[240px] text-xs font-semibold text-right sm:text-center py-2 px-2 sm:px-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((record, index) => {
                        const student = record.student || record.studentId;
                        const studentId = (student?._id || student?.id || (typeof student === 'string' ? student : index))?.toString();
                        const studentName =
                          student?.name ||
                          `${student?.fName || student?.firstName || ''} ${student?.lName || student?.lastName || ''}`.trim() ||
                          'Student';
                        const rollNumber = student?.rollNumber || student?.rollNo || 'N/A';
                        const currentStatus = attendanceState[studentId] || record.status || 'Present';
                        const isAbsent = !isHoliday && currentStatus.toLowerCase() === 'absent';
                        const initials = (studentName || 'S')
                          .split(' ')
                          .filter(Boolean)
                          .map(w => w[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();

                        return (
                          <TableRow 
                            key={studentId || index} 
                            className={cn(
                              "transition-colors duration-150",
                              isHoliday
                                ? "bg-muted/10 opacity-80"
                                : isAbsent 
                                ? "bg-red-500/[0.04] border-l-4 border-l-red-500 hover:bg-red-500/[0.07]" 
                                : "hover:bg-muted/30 border-l-4 border-l-transparent"
                            )}
                          >
                            {/* Row Index */}
                            <TableCell className="text-xs text-muted-foreground font-mono py-2 px-2 sm:px-3 hidden sm:table-cell">
                              {index + 1}
                            </TableCell>

                            {/* Roll Number */}
                            <TableCell className="font-mono text-xs font-medium text-foreground py-2 px-2 sm:px-3 hidden sm:table-cell">
                              <span className="bg-muted/70 px-2 py-0.5 rounded border text-[11px]">
                                {rollNumber}
                              </span>
                            </TableCell>

                            {/* Student Name with Avatar */}
                            <TableCell className="py-2 px-2 sm:px-3">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0",
                                  isHoliday
                                    ? "bg-primary/10 text-primary"
                                    : isAbsent 
                                    ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" 
                                    : "bg-primary/10 text-primary"
                                )}>
                                  {initials}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-xs sm:text-sm text-foreground leading-tight">
                                    {studentName}
                                  </span>
                                  <div className="sm:hidden flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                    <span className="font-mono font-medium bg-muted px-1 rounded">{rollNumber}</span>
                                    {student?.fatherOrguardian && (
                                      <span className="truncate max-w-[120px]">S/D of {student.fatherOrguardian}</span>
                                    )}
                                  </div>
                                  {student?.fatherOrguardian && (
                                    <span className="hidden sm:inline text-[11px] text-muted-foreground">
                                      S/D of {student.fatherOrguardian}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Attendance Segmented Toggle Pills (Present & Absent only) or Holiday Lock */}
                            <TableCell className="text-right sm:text-center py-2 px-2 sm:px-3">
                              {isHoliday ? (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-3 sm:py-1">
                                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" /> Holiday
                                </Badge>
                              ) : (
                                <div className="inline-flex items-center p-0.5 rounded-lg border border-border/70 bg-muted/40 shadow-2xs gap-0.5 sm:gap-1">
                                  {/* Present Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(studentId, 'Present')}
                                    className={cn(
                                      "inline-flex items-center justify-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer select-none",
                                      !isAbsent
                                        ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/30"
                                        : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    )}
                                    title="Mark Present"
                                  >
                                    <Check className={cn("w-3 h-3 sm:w-3.5 sm:h-3.5", !isAbsent ? "stroke-[2.5]" : "")} />
                                    <span>P<span className="hidden sm:inline">resent</span></span>
                                  </button>

                                  {/* Absent Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(studentId, 'Absent')}
                                    className={cn(
                                      "inline-flex items-center justify-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer select-none",
                                      isAbsent
                                        ? "bg-red-600 text-white shadow-xs ring-1 ring-red-400"
                                        : "text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    )}
                                    title="Mark Absent"
                                  >
                                    <X className={cn("w-3 h-3 sm:w-3.5 sm:h-3.5", isAbsent ? "stroke-[2.5]" : "")} />
                                    <span>A<span className="hidden sm:inline">bsent</span></span>
                                  </button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
