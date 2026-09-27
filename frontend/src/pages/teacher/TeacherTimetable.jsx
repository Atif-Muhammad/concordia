import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  School,
  BookOpen,
  Layers,
  Filter,
  Search,
  Grid3X3,
  ListFilter,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { userWho, refreshTokens, getTeacherClasses, getTimetables } from '../../../config/apis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_TIME_SLOTS = [
  { label: 'Period 1', startTime: '08:00', endTime: '08:45' },
  { label: 'Period 2', startTime: '08:45', endTime: '09:30' },
  { label: 'Period 3', startTime: '09:30', endTime: '10:15' },
  { label: 'Period 4', startTime: '10:30', endTime: '11:15' },
  { label: 'Period 5', startTime: '11:15', endTime: '12:00' },
  { label: 'Period 6', startTime: '12:00', endTime: '12:45' },
  { label: 'Period 7', startTime: '12:45', endTime: '01:30' },
];

export default function TeacherTimetable() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

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

  const { data: timetablesData = [], isLoading: isTimetableLoading } = useQuery({
    queryKey: ['timetables'],
    queryFn: () => getTimetables(),
  });

  const classes = useMemo(() => {
    return Array.isArray(classesData) ? classesData : classesData?.data || [];
  }, [classesData]);

  // Extract distinct programs
  const programsList = useMemo(() => {
    const map = new Map();
    classes.forEach((cls) => {
      const prog = cls.programId || cls.program || cls.classId?.programId;
      if (prog) {
        const id = (prog._id || prog.id || prog).toString();
        const name = prog.name || 'General Program';
        if (!map.has(id)) {
          map.set(id, { id, name });
        }
      }
    });
    return Array.from(map.values());
  }, [classes]);

  // Extract distinct classes
  const classesList = useMemo(() => {
    const map = new Map();
    classes.forEach((cls) => {
      const c = cls.classId || cls.class;
      if (c) {
        const id = (c._id || c.id || c).toString();
        const name = c.name || 'Class';
        const prog = cls.programId || cls.program || c.programId;
        const progId = prog ? (prog._id || prog.id || prog).toString() : '';
        if (!map.has(id)) {
          map.set(id, { id, name, programId: progId });
        }
      }
    });
    return Array.from(map.values());
  }, [classes]);

  // Extract teacher's timetable slots
  const teacherTimetableSlots = useMemo(() => {
    if (!timetablesData || !Array.isArray(timetablesData)) return [];
    const staffIdStr = teacherStaffId ? teacherStaffId.toString() : '';
    const slots = [];

    const teacherClassIds = new Set(
      classes.map((cls) => {
        const c = cls.classId || cls.class;
        return c ? (c._id || c.id || c).toString() : '';
      }).filter(Boolean)
    );

    timetablesData.forEach((tt) => {
      const ttClassId = (tt.classId?._id || tt.classId?.id || tt.classId || '').toString();
      const ttClassName = tt.classId?.name || 'Class';
      const ttProgramName = tt.classId?.programId?.name || 'Program';
      const ttProgramId = (tt.classId?.programId?._id || tt.classId?.programId?.id || '').toString();
      const ttSectionName = tt.sectionId?.name || null;

      (tt.slots || []).forEach((slot) => {
        const slotTeacherId = (slot.teacherId?._id || slot.teacherId?.id || slot.teacherId || '').toString();
        const isMySlot =
          (slotTeacherId && slotTeacherId === staffIdStr) ||
          (!slotTeacherId && teacherClassIds.has(ttClassId));

        if (isMySlot) {
          slots.push({
            id: `${tt._id}_${slot.dayOfWeek}_${slot.startTime}`,
            dayOfWeek: (slot.dayOfWeek || '').trim(),
            startTime: slot.startTime,
            endTime: slot.endTime,
            subjectName: slot.subjectId?.name || 'Subject',
            subjectCode: slot.subjectId?.code || '',
            className: ttClassName,
            classId: ttClassId,
            sectionName: ttSectionName,
            programName: ttProgramName,
            programId: ttProgramId,
          });
        }
      });
    });

    return slots;
  }, [timetablesData, teacherStaffId, classes]);

  // Filtered slots by program & class
  const filteredSlots = useMemo(() => {
    return teacherTimetableSlots.filter((slot) => {
      if (selectedProgramFilter !== 'all' && slot.programId !== selectedProgramFilter) {
        return false;
      }
      if (selectedClassFilter !== 'all' && slot.classId !== selectedClassFilter) {
        return false;
      }
      return true;
    });
  }, [teacherTimetableSlots, selectedProgramFilter, selectedClassFilter]);

  // Time slots for rows in the calendar grid
  const calendarTimeSlots = useMemo(() => {
    const map = new Map();
    // 1. Add any time slots from actual database entries
    filteredSlots.forEach((slot) => {
      const key = `${slot.startTime} - ${slot.endTime}`;
      if (!map.has(key)) {
        map.set(key, {
          startTime: slot.startTime,
          endTime: slot.endTime,
          label: `${slot.startTime} - ${slot.endTime}`,
        });
      }
    });

    // 2. If fewer than 4 slots from DB, supplement with default periods
    if (map.size === 0) {
      DEFAULT_TIME_SLOTS.forEach((slot) => {
        const key = `${slot.startTime} - ${slot.endTime}`;
        map.set(key, {
          startTime: slot.startTime,
          endTime: slot.endTime,
          label: `${slot.label} (${slot.startTime} - ${slot.endTime})`,
        });
      });
    }

    return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [filteredSlots]);

  // Today's day name (e.g. "Monday")
  const todayDayName = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  }, []);

  const todaySlots = useMemo(() => {
    return filteredSlots.filter(
      (s) => s.dayOfWeek.toLowerCase() === todayDayName.toLowerCase()
    );
  }, [filteredSlots, todayDayName]);

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
              <CalendarIcon className="w-6 h-6 text-primary" />
              Teacher Timetable & Schedule
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Weekly calendar schedule and period-by-period teaching timetable
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('calendar')}
              className={
                activeTab === 'calendar'
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-8 text-xs gap-1.5'
                  : 'h-8 text-xs gap-1.5'
              }
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Calendar Grid (Time × Day)
            </Button>
            <Button
              variant={activeTab === 'load' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('load')}
              className={
                activeTab === 'load'
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-8 text-xs gap-1.5'
                  : 'h-8 text-xs gap-1.5'
              }
            >
              <School className="w-3.5 h-3.5" />
              Assigned Classes ({classes.length})
            </Button>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Card className="border shadow-2xs">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Today ({todayDayName})</p>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {todaySlots.length} {todaySlots.length === 1 ? 'Period' : 'Periods'}
                </p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CalendarDays className="h-4.5 w-4.5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-2xs">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Weekly Periods</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{filteredSlots.length}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Clock className="h-4.5 w-4.5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-2xs">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Classes Taught</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{classes.length}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <School className="h-4.5 w-4.5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-2xs">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Programs</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{programsList.length}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="h-4.5 w-4.5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card className="border shadow-2xs">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-primary" />
                Filter Schedule:
              </span>

              {/* Program Filter */}
              {programsList.length > 0 && (
                <div className="w-full sm:w-[220px]">
                  <Select
                    value={selectedProgramFilter}
                    onValueChange={(val) => {
                      setSelectedProgramFilter(val);
                      setSelectedClassFilter('all');
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All Programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {programsList.map((prog) => (
                        <SelectItem key={prog.id} value={prog.id}>
                          {prog.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Class Filter */}
              {classesList.length > 0 && (
                <div className="w-full sm:w-[200px]">
                  <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classesList
                        .filter(
                          (c) =>
                            selectedProgramFilter === 'all' ||
                            c.programId === selectedProgramFilter
                        )
                        .map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* View Content */}
        {activeTab === 'calendar' ? (
          /* Weekly Calendar Shape (Time × Day) */
          <Card className="border shadow-2xs">
            <CardHeader className="p-4 pb-2 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-primary" />
                    Weekly Calendar Timetable (Time × Day)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Monday to Saturday period schedule for your classes and subjects
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 w-fit">
                  Orange Accent = Your Assigned Period
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="border-collapse min-w-[850px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 border-b">
                      {/* Time slot header */}
                      <TableHead className="w-[140px] text-xs font-bold text-foreground border-r bg-muted/60 text-center py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          Time Slot
                        </div>
                      </TableHead>
                      {/* Day headers */}
                      {DAYS_OF_WEEK.map((day) => {
                        const isToday = day.toLowerCase() === todayDayName.toLowerCase();
                        return (
                          <TableHead
                            key={day}
                            className={`text-xs font-bold text-center border-r last:border-r-0 py-3 ${
                              isToday
                                ? 'bg-primary/15 text-primary font-extrabold border-b-2 border-b-primary'
                                : 'text-foreground'
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <span>{day}</span>
                              {isToday && (
                                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                                  Today
                                </span>
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calendarTimeSlots.map((timeSlot, rowIdx) => (
                      <TableRow key={timeSlot.label || rowIdx} className="hover:bg-muted/20 border-b">
                        {/* Time slot cell */}
                        <TableCell className="font-mono text-xs font-semibold text-center border-r bg-muted/20 py-4 text-foreground whitespace-nowrap">
                          {timeSlot.label}
                        </TableCell>

                        {/* Day cells */}
                        {DAYS_OF_WEEK.map((day) => {
                          const isToday = day.toLowerCase() === todayDayName.toLowerCase();
                          // Match slots for this day and overlapping time
                          const matchingSlots = filteredSlots.filter((slot) => {
                            if (slot.dayOfWeek.toLowerCase() !== day.toLowerCase()) return false;
                            return (
                              slot.startTime === timeSlot.startTime ||
                              (slot.startTime >= timeSlot.startTime && slot.startTime < timeSlot.endTime) ||
                              (timeSlot.startTime >= slot.startTime && timeSlot.startTime < slot.endTime)
                            );
                          });

                          return (
                            <TableCell
                              key={`${day}_${timeSlot.startTime}`}
                              className={`p-2 border-r last:border-r-0 align-top ${
                                isToday ? 'bg-primary/[0.03]' : ''
                              }`}
                            >
                              {matchingSlots.length === 0 ? (
                                <div className="h-16 flex items-center justify-center text-muted-foreground/30 text-xs">
                                  —
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {matchingSlots.map((slot, sIdx) => (
                                    <div
                                      key={slot.id || sIdx}
                                      className="border-l-4 border-l-primary bg-primary/10 hover:bg-primary/20 transition-colors p-2.5 rounded-r shadow-2xs border border-primary/20 space-y-1"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <p className="font-bold text-xs text-foreground truncate" title={slot.subjectName}>
                                          {slot.subjectName}
                                        </p>
                                        {slot.subjectCode && (
                                          <span className="text-[10px] font-mono text-primary font-semibold">
                                            {slot.subjectCode}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                                        <span className="font-semibold text-foreground">
                                          {slot.className}
                                        </span>
                                        {slot.sectionName && (
                                          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-medium px-1.5 py-0 h-4">
                                            {slot.sectionName}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-muted-foreground truncate" title={slot.programName}>
                                        {slot.programName}
                                      </p>
                                      <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 pt-0.5">
                                        <Clock className="w-2.5 h-2.5 text-primary shrink-0" />
                                        {slot.startTime} - {slot.endTime}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Assigned Teaching Load Summary */
          <Card className="border shadow-2xs">
            <CardHeader className="p-4 pb-2 border-b">
              <CardTitle className="text-base font-semibold">My Assigned Teaching Load</CardTitle>
              <CardDescription className="text-xs">
                All classes, sections, and subjects linked to your teaching profile
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {classes.length === 0 ? (
                <div className="text-center py-10">
                  <School className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No classes assigned yet.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {classes.map((cls, index) => {
                    const programName =
                      cls.programId?.name ||
                      cls.program?.name ||
                      cls.classId?.programId?.name ||
                      cls.class?.programId?.name ||
                      'General Program';
                    const className = cls.classId?.name || cls.class?.name || 'Class';
                    const sectionName = cls.sectionId?.name || cls.section?.name;
                    const subjectsList = cls.subjects?.length > 0
                      ? cls.subjects
                      : cls.subject
                      ? [cls.subject]
                      : [];

                    return (
                      <Card
                        key={cls.id || index}
                        className="border shadow-2xs bg-card hover:border-primary/40 transition-colors"
                      >
                        <CardHeader className="p-3.5 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base font-bold text-foreground">
                                {className}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground mt-0.5">{programName}</p>
                            </div>
                            {sectionName ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                                {sectionName}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                All Sections
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-3.5 pt-0">
                          <div className="pt-2 border-t mt-2">
                            <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-primary" />
                              Assigned Subjects:
                            </p>
                            {subjectsList.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">
                                General Class Teacher
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {subjectsList.map((sub, sIdx) => (
                                  <Badge
                                    key={sub?._id || sub?.id || sIdx}
                                    variant="secondary"
                                    className="text-xs bg-muted/60 text-foreground"
                                  >
                                    {sub?.name || 'Subject'}
                                    {sub?.code ? ` (${sub.code})` : ''}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
