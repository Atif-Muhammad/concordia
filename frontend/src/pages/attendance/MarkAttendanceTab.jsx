import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Timer,
  LockKeyhole,
  SlidersHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import AttendanceConfirmationDialog from "@/components/AttendanceConfirmationDialog";
import {
  getProgramNames,
  getClasses,
  getSections,
  getSubjectsForClassWithAssignments,
  fetchStudentAttendance,
  updateStudentAttendance,
  deleteStudentAttendanceRecord,
  getTeacherClasses,
  getAcademicSessions,
  undoGenerateAttendance,
  getHolidays,
  createAttendanceSkip,
  deleteAttendanceSkip,
  getAttendanceSkips,
} from "../../../config/apis";
import { hasExplicitModuleAccess, isDualRoleStaff } from "@/lib/navigation.jsx";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return String(val._id || val.id || "");
  return String(val);
};

const normalizeAttendanceStatus = (status) => String(status || "").toLowerCase();
const toStudentAttendanceApiStatus = (status) => normalizeAttendanceStatus(status).toUpperCase();
const ATTENDANCE_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export default function MarkAttendanceTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { canCreate, canUpdate, canDelete, isSuperAdmin, currentUser } = usePermissions("Attendance", "mark");
  const isTeacher = currentUser?.role === "TEACHER" || currentUser?.role === "Teacher" || !!currentUser?.isTeaching;
  const dualRoleStaff = isDualRoleStaff(currentUser);
  const hasAttendancePermission = hasExplicitModuleAccess(currentUser, "Attendance");
  const canUseAllClasses = isSuperAdmin || (!isTeacher && hasAttendancePermission) || (dualRoleStaff && hasAttendancePermission);
  const isTeacherScoped = isTeacher && !canUseAllClasses;
  const canMarkAttendance = isTeacher || isSuperAdmin || canCreate || canUpdate;

  const [markDate, setMarkDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [fetchedStudents, setFetchedStudents] = useState([]);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
  const [attendanceChanges, setAttendanceChanges] = useState({});
  const [showMarkFilters, setShowMarkFilters] = useState(false);

  // Undo confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);
  // Transient status alert
  const [statusAlert, setStatusAlert] = useState(null);
  const statusAlertTimerRef = useRef(null);

  const showStatusAlert = useCallback((message, icon = "present") => {
    if (statusAlertTimerRef.current) clearTimeout(statusAlertTimerRef.current);
    setStatusAlert({ message, icon });
    statusAlertTimerRef.current = setTimeout(() => setStatusAlert(null), 1800);
  }, []);

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: getProgramNames,
  });

  const { data: classesData = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: sectionsData = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });
  const activeSession = academicSessions.find(s => s.isActive === true);
  const activeSessionId = activeSession?.id;

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: getHolidays,
  });

  const { data: classSkips = [], refetch: refetchSkips } = useQuery({
    queryKey: ["attendanceSkips", selectedClassId, selectedSectionId],
    queryFn: () => {
      const sid = selectedSectionId && selectedSectionId !== "*" ? selectedSectionId : undefined;
      return getAttendanceSkips(selectedClassId, sid);
    },
    enabled: !!selectedClassId,
  });

  const toLocalDateStr = (d) => {
    if (!d) return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const isGlobalHoliday = useMemo(() => {
    if (!markDate || !holidays.length) return false;
    return holidays.some(h => {
      const s = toLocalDateStr(h.date);
      const e = h.endDate ? toLocalDateStr(h.endDate) : s;
      return markDate >= s && markDate <= e;
    });
  }, [markDate, holidays]);

  const isClassHoliday = useMemo(() => {
    if (!markDate || !classSkips.length) return false;
    return classSkips.some(s => toLocalDateStr(s.date) === markDate);
  }, [markDate, classSkips]);

  const isDateHoliday = useMemo(() => {
    return isGlobalHoliday || isClassHoliday || fetchedStudents.some(s => s.isHoliday || s.attendance?.[0]?.isHoliday);
  }, [isGlobalHoliday, isClassHoliday, fetchedStudents]);

  const activeHolidayTitle = useMemo(() => {
    if (isGlobalHoliday) {
      const h = holidays.find(h => {
        const s = toLocalDateStr(h.date);
        const e = h.endDate ? toLocalDateStr(h.endDate) : s;
        return markDate >= s && markDate <= e;
      });
      if (h) return h.title || "Holiday";
    }
    if (isClassHoliday) {
      const s = classSkips.find(s => toLocalDateStr(s.date) === markDate);
      if (s) return s.reason || "Class Holiday";
    }
    const st = fetchedStudents.find(s => s.isHoliday || s.attendance?.[0]?.isHoliday);
    if (st) return st.holidayTitle || st.attendance?.[0]?.notes || "Holiday";
    return null;
  }, [isGlobalHoliday, isClassHoliday, holidays, classSkips, markDate, fetchedStudents]);

  const teacherStaffId = currentUser?.refId || currentUser?.staffDbId || currentUser?.id;
  const { data: rawTeacherClassMappings = [] } = useQuery({
    queryKey: ["teacherClasses", teacherStaffId],
    queryFn: () => getTeacherClasses(teacherStaffId),
    enabled: isTeacherScoped && !!teacherStaffId
  });

  const teacherClassMappings = useMemo(() => {
    return Array.isArray(rawTeacherClassMappings)
      ? rawTeacherClassMappings
      : rawTeacherClassMappings?.data || [];
  }, [rawTeacherClassMappings]);

  // Selected class object to inspect allowSections
  const selectedClass = useMemo(() => {
    const list = isTeacherScoped
      ? teacherClassMappings.map(m => m.classId || m.class).filter(Boolean)
      : classesData;
    return list.find(c => extractId(c) === selectedClassId) || null;
  }, [isTeacherScoped, teacherClassMappings, classesData, selectedClassId]);

  const isSectionApplicable = selectedClass ? selectedClass.allowSections !== false : true;

  const { data: subjects = [], refetch: refetchSubjects } = useQuery({
    queryKey: ["classSubjects", selectedClassId, selectedSectionId],
    queryFn: () => {
      const sectionParam = isSectionApplicable && selectedSectionId && selectedSectionId !== "*" ? selectedSectionId : undefined;
      return getSubjectsForClassWithAssignments(selectedClassId, activeSessionId, sectionParam);
    },
    enabled: false
  });

  const { data: attendanceData, refetch: refetchAttendance, isFetching, error: attendanceError } = useQuery({
    queryKey: ["studentAttendance", selectedClassId, selectedSectionId, selectedSubjectId, markDate, activeSessionId],
    queryFn: () => {
      const sectionParam = isSectionApplicable && selectedSectionId && selectedSectionId !== "*" ? selectedSectionId : "";
      return fetchStudentAttendance(selectedClassId, sectionParam, selectedSubjectId, markDate, activeSessionId);
    },
    enabled: false
  });

  const undoGenerateMutation = useMutation({
    mutationFn: (date) => undoGenerateAttendance(date),
    onSuccess: () => {
      setConfirmDialog(null);
      setFetchedStudents([]);
      setHasLoadedStudents(false);
      setAttendanceChanges({});
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const undoHolidayMutation = useMutation({
    mutationFn: (id) => id ? deleteAttendanceSkip(id) : Promise.resolve(),
    onSuccess: () => {
      setConfirmDialog(null);
      queryClient.invalidateQueries({ queryKey: ["attendanceSkips"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Programs for selection
  const availablePrograms = useMemo(() => {
    if (!isTeacherScoped) return programs;
    const teacherProgIds = new Set(
      teacherClassMappings.map(m => {
        const cls = m.classId || m.class;
        return extractId(cls?.programId || cls?.program || m.programId || m.program);
      }).filter(Boolean)
    );
    if (!teacherProgIds.size) return programs;
    return programs.filter(p => teacherProgIds.has(extractId(p)));
  }, [programs, isTeacherScoped, teacherClassMappings]);

  // Unique classes for teachers
  const teacherClasses = useMemo(() => {
    if (!isTeacherScoped) return [];
    const mapped = teacherClassMappings.map(mapping => {
      const cls = mapping.classId || mapping.class;
      if (!cls) return null;
      const prog = cls.programId || cls.program || mapping.programId || mapping.program;
      return {
        ...cls,
        id: extractId(cls),
        _id: extractId(cls),
        programId: prog,
        program: prog,
        programName: prog?.name || 'N/A'
      };
    }).filter(Boolean);
    return mapped.filter((c, idx, arr) => arr.findIndex(x => extractId(x) === extractId(c)) === idx);
  }, [isTeacherScoped, teacherClassMappings]);

  // Classes filtered by selected program
  const availableClasses = useMemo(() => {
    const baseList = isTeacherScoped ? teacherClasses : classesData;
    if (!selectedProgramId) return [];
    return baseList.filter(c => extractId(c.programId || c.program) === selectedProgramId);
  }, [isTeacherScoped, teacherClasses, classesData, selectedProgramId]);

  // Sections filtered by selected class
  const availableSections = useMemo(() => {
    if (!selectedClassId || !isSectionApplicable) return [];
    if (isTeacherScoped) {
      const matchingMappings = teacherClassMappings.filter(
        mapping => extractId(mapping.classId || mapping.class) === selectedClassId
      );
      const secs = matchingMappings
        .map(mapping => mapping.sectionId || mapping.section)
        .filter(Boolean);
      const uniqueSecs = secs.filter((section, idx, arr) => arr.findIndex(s => extractId(s) === extractId(section)) === idx);
      if (uniqueSecs.length > 0) return uniqueSecs;
    }
    if (selectedClass?.sections?.length) {
      return selectedClass.sections;
    }
    return sectionsData.filter(s => extractId(s.classId || s.class) === selectedClassId);
  }, [selectedClassId, isSectionApplicable, isTeacherScoped, teacherClassMappings, selectedClass, sectionsData]);

  const filteredSubjects = useMemo(() => {
    if (!isTeacherScoped) {
      return subjects.map(scm => ({ id: extractId(scm.subject), name: scm.subject?.name || scm.name }));
    }

    const currentTeacherStaffId = extractId(currentUser?.refId || currentUser?.staffDbId || currentUser?.id || currentUser?._id);

    // 1. Direct from teacherClassMappings for the selected class & section
    const matchingClassMappings = teacherClassMappings.filter(
      m => extractId(m.classId || m.class) === selectedClassId &&
           (!selectedSectionId || selectedSectionId === '*' || !m.sectionId || extractId(m.sectionId || m.section) === selectedSectionId)
    );
    const teacherAssignedSubjects = [];
    matchingClassMappings.forEach(m => {
      if (Array.isArray(m.subjects)) {
        m.subjects.forEach(s => {
          if (s && !teacherAssignedSubjects.some(existing => extractId(existing) === extractId(s))) {
            teacherAssignedSubjects.push({ id: extractId(s), name: s.name });
          }
        });
      }
      if (m.subjectId || m.subject) {
        const s = m.subjectId || m.subject;
        if (s && !teacherAssignedSubjects.some(existing => extractId(existing) === extractId(s))) {
          teacherAssignedSubjects.push({ id: extractId(s), name: s.name });
        }
      }
    });

    if (teacherAssignedSubjects.length > 0) {
      return teacherAssignedSubjects;
    }

    // 2. From getSubjectsForClassWithAssignments
    if (subjects.length > 0) {
      const fromClassSubjects = subjects.filter(scm => {
        const teacherList = scm.subject?.teachers || scm.teachers || [];
        return teacherList.some(t => {
          const tId = extractId(t.teacherId || t.id || t._id || t);
          return tId === currentTeacherStaffId;
        });
      }).map(scm => ({ id: extractId(scm.subject), name: scm.subject?.name || scm.name }));

      if (fromClassSubjects.length > 0) return fromClassSubjects;
    }

    return subjects.map(scm => ({ id: extractId(scm.subject), name: scm.subject?.name || scm.name }));
  }, [subjects, isTeacherScoped, currentUser, teacherClassMappings, selectedClassId, selectedSectionId]);

  const selectedClassHasWideTeacherMapping = isTeacherScoped && teacherClassMappings.some(
    mapping => extractId(mapping.classId || mapping.class) === selectedClassId && !(mapping.sectionId || mapping.section)
  );

  const handleProgramChange = (val) => {
    setSelectedProgramId(val);
    setSelectedClassId("");
    setSelectedSectionId("");
    setSelectedSubjectId("");
    setFetchedStudents([]);
    setHasLoadedStudents(false);
    setAttendanceChanges({});
  };

  const handleClassChange = (val) => {
    setSelectedClassId(val);
    const cls = classesData.find(c => extractId(c) === val) || teacherClasses.find(c => extractId(c) === val);
    const allowSec = cls ? cls.allowSections !== false : true;
    setSelectedSectionId(allowSec ? "*" : "");
    setSelectedSubjectId("");
    setFetchedStudents([]);
    setHasLoadedStudents(false);
    setAttendanceChanges({});
  };

  const handleSectionChange = (val) => {
    setSelectedSectionId(val);
    setSelectedSubjectId("");
    setFetchedStudents([]);
    setHasLoadedStudents(false);
    setAttendanceChanges({});
  };

  useEffect(() => {
    if (selectedClassId) {
      setSelectedSubjectId("");
      setFetchedStudents([]);
      setHasLoadedStudents(false);
      setAttendanceChanges({});
      refetchSubjects();
      refetchSkips();
    }
  }, [selectedClassId, selectedSectionId, activeSessionId, refetchSubjects]);

  useEffect(() => {
    if (!isTeacherScoped || !selectedClassId || selectedClassHasWideTeacherMapping || !isSectionApplicable) return;
    const allowedIds = availableSections.map(s => extractId(s));
    if (allowedIds.length > 0 && (!selectedSectionId || selectedSectionId === "*" || !allowedIds.includes(selectedSectionId))) {
      setSelectedSectionId(allowedIds[0]);
    }
  }, [isTeacherScoped, selectedClassId, selectedSectionId, selectedClassHasWideTeacherMapping, isSectionApplicable, availableSections]);

  const handleStatusChange = async (student, status) => {
    if (isDateHoliday) {
      toast({
        title: "Holiday date",
        description: "Attendance actions are blocked on a holiday.",
        variant: "destructive",
      });
      return;
    }
    const studentId = extractId(student?.id || student?._id);
    const att = student?.attendance?.[0];
    const dbStatus = normalizeAttendanceStatus(att?.status);
    const draftStatus = normalizeAttendanceStatus(attendanceChanges[studentId]);
    const currentStatus = draftStatus || dbStatus;

    if (currentStatus === status) {
      if (att?.id && dbStatus === status) {
        try {
          const sectionId = isSectionApplicable && selectedSectionId && selectedSectionId !== "*"
            ? selectedSectionId
            : (student?.section?.id ?? student?.sectionId ?? null);
          await deleteStudentAttendanceRecord({
            studentId,
            classId: selectedClassId,
            sectionId,
            subjectId: selectedSubjectId,
            date: markDate,
            attendanceId: att.id,
          });
          setAttendanceChanges(prev => {
            const next = { ...prev };
            delete next[studentId];
            return next;
          });
          const result = await refetchAttendance({ throwOnError: true });
          const list = result?.data?.attendance || (Array.isArray(result?.data) ? result.data : []);
          setFetchedStudents(list);
          setHasLoadedStudents(true);
          toast({ title: "Attendance removed", description: "Student row is now Not Marked.", variant: "success" });
        } catch (error) {
          toast({ title: "Failed to remove attendance", description: error?.message, variant: "destructive" });
        }
        return;
      }

      setAttendanceChanges(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      return;
    }

    setAttendanceChanges(prev => ({ ...prev, [studentId]: status }));
    const icons = { present: "present", absent: "absent", leave: "leave", short_leave: "short_leave" };
    const labels = { present: "Present", absent: "Absent", leave: "Leave", short_leave: "Short Leave" };
    showStatusAlert(labels[status] || status, icons[status] || "present");
  };

  const isHolidayDisabled = useMemo(() => {
    if (!markDate) return true;
    const d = new Date(markDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d > today) return true;
    return false;
  }, [markDate]);

  const handleLoadStudents = async () => {
    const missing = [];
    if (!selectedProgramId) missing.push("Program");
    if (!selectedClassId) missing.push("Class");
    if (!selectedSubjectId) missing.push("Subject");
    if (!markDate) missing.push("Date");
    if (missing.length > 0) {
      toast({ title: `Select ${missing.join(", ")} before loading students`, variant: "destructive" });
      return;
    }
    try {
      setFetchedStudents([]);
      setHasLoadedStudents(false);
      setAttendanceChanges({});
      const result = await refetchAttendance({ throwOnError: true });
      const list = result?.data?.attendance || (Array.isArray(result?.data) ? result.data : []);
      setFetchedStudents(list);
      setHasLoadedStudents(true);
    } catch (error) {
      toast({ title: error?.message || "Failed to fetch students", variant: "destructive" });
    }
  };

  const handleSaveAttendance = async () => {
    if (!fetchedStudents.length) {
      toast({ title: "Load students before saving attendance", variant: "destructive" });
      return;
    }

    const editableStudents = fetchedStudents.filter((student) => {
      const att = student.attendance?.[0];
      const lockTimestamp = att?.generatedAt || att?.markedAt;
      return !lockTimestamp || (Date.now() - new Date(lockTimestamp).getTime()) <= ATTENDANCE_EDIT_WINDOW_MS;
    });
    const editableStudentIds = new Set(editableStudents.map((student) => extractId(student.id || student._id)));

    const studentsToSave = fetchedStudents
      .map((student) => {
        const studentId = String(extractId(student.id || student._id));
        if (!editableStudentIds.has(studentId)) return null;
        const att = student.attendance?.[0];
        const status = attendanceChanges[studentId] || att?.status;
        if (!status) return null;
        return {
          studentId,
          status: toStudentAttendanceApiStatus(status),
          notes: att?.notes || (att?.isHoliday ? (att.holidayTitle || "Holiday") : "")
        };
      })
      .filter(Boolean);

    if (studentsToSave.length === 0) {
      toast({ title: "No students to save", variant: "default" });
      return;
    }

    const sectionParam = isSectionApplicable && selectedSectionId && selectedSectionId !== "*" ? selectedSectionId : null;

    const payload = {
      classId: selectedClassId,
      sectionId: sectionParam,
      subjectId: selectedSubjectId,
      sessionId: activeSessionId,
      date: markDate,
      teacherId: isTeacherScoped ? (currentUser?.id || null) : null,
      students: studentsToSave,
    };

    try {
      await updateStudentAttendance(payload);
      toast({ title: "Attendance saved", description: "Student statuses have been recorded successfully.", variant: "success" });
      const result = await refetchAttendance({ throwOnError: true });
      const list = result?.data?.attendance || (Array.isArray(result?.data) ? result.data : []);
      setFetchedStudents(list);
      setHasLoadedStudents(true);
      setAttendanceChanges({});
    } catch (error) {
      toast({ title: "Failed to save attendance", description: error?.message, variant: "destructive" });
    }
  };

  const getFullName = (student) => {
    return `${student.fName} ${student.lName || ""}`.trim();
  };

  const calculateStats = () => {
    if (!fetchedStudents.length) return { present: 0, absent: 0, leave: 0, rate: 0 };

    let present = 0, absent = 0, leave = 0;
    fetchedStudents.forEach(student => {
      const sId = extractId(student.id || student._id);
      const status = attendanceChanges[sId] ||
        student.attendance?.[0]?.status?.toLowerCase();

      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'leave' || status === 'on-leave') leave++;
    });

    const total = fetchedStudents.length;
    return {
      present,
      absent,
      leave,
      rate: total > 0 ? ((present / total) * 100).toFixed(1) : 0
    };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Attendance Controls</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowMarkFilters((s) => !s)}>
            <SlidersHorizontal className="w-4 h-4" />
            {showMarkFilters ? "Hide Filters" : "Filters"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`transition-all duration-300 ease-out overflow-hidden ${showMarkFilters ? "max-h-[360px] opacity-100" : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pb-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={markDate}
                  onChange={e => {
                    setMarkDate(e.target.value);
                    setFetchedStudents([]);
                    setHasLoadedStudents(false);
                    setAttendanceChanges({});
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Program</Label>
                <Select value={selectedProgramId} onValueChange={handleProgramChange}>
                  <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                  <SelectContent>
                    {availablePrograms.map(p => (
                      <SelectItem key={extractId(p)} value={extractId(p)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedClassId} onValueChange={handleClassChange} disabled={!selectedProgramId}>
                  <SelectTrigger><SelectValue placeholder={!selectedProgramId ? "Select program first" : "Select class"} /></SelectTrigger>
                  <SelectContent>
                    {availableClasses.map(c => (
                      <SelectItem key={extractId(c)} value={extractId(c)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={selectedSectionId}
                  onValueChange={handleSectionChange}
                  disabled={!selectedClassId || !isSectionApplicable}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedClassId
                          ? "Select class first"
                          : !isSectionApplicable
                          ? "Not Applicable"
                          : "Select section"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isSectionApplicable && (
                      <>
                        <SelectItem value="*">All Sections</SelectItem>
                        {availableSections.map(s => (
                          <SelectItem key={extractId(s)} value={extractId(s)}>{s.name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={selectedSubjectId}
                  onValueChange={(val) => {
                    setSelectedSubjectId(val);
                    setFetchedStudents([]);
                    setHasLoadedStudents(false);
                    setAttendanceChanges({});
                  }}
                  disabled={!selectedClassId}
                >
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {filteredSubjects.map(sub => (
                      <SelectItem key={extractId(sub)} value={extractId(sub)}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between border-t pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleLoadStudents}
                disabled={isFetching || !selectedProgramId || !selectedClassId || !selectedSubjectId}
              >
                {isFetching ? "Loading Students..." : "Load Students"}
              </Button>
            </div>

            {canMarkAttendance && (
              <Button onClick={handleSaveAttendance} disabled={!fetchedStudents.length}>
                Save Attendance
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attendance Stats Cards */}
      {hasLoadedStudents && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{fetchedStudents.length}</div>
              <p className="text-xs text-muted-foreground">Total Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.present}</div>
              <p className="text-xs text-muted-foreground">Present</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
              <p className="text-xs text-muted-foreground">Absent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600">{stats.rate}%</div>
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Mark Buttons */}
      {hasLoadedStudents && canMarkAttendance && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
            disabled={isDateHoliday}
            onClick={() => {
              if (isDateHoliday) return;
              const newChanges = {};
              fetchedStudents.forEach(s => { newChanges[extractId(s.id || s._id)] = "present"; });
              setAttendanceChanges(newChanges);
              showStatusAlert("All Present", "present");
            }}
          >
            Mark All Present
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={isDateHoliday}
            onClick={() => {
              if (isDateHoliday) return;
              const newChanges = {};
              fetchedStudents.forEach(s => { newChanges[extractId(s.id || s._id)] = "absent"; });
              setAttendanceChanges(newChanges);
              showStatusAlert("All Absent", "absent");
            }}
          >
            Mark All Absent
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            disabled={isDateHoliday}
            onClick={() => {
              if (isDateHoliday) return;
              const newChanges = {};
              fetchedStudents.forEach(s => { newChanges[extractId(s.id || s._id)] = "leave"; });
              setAttendanceChanges(newChanges);
              showStatusAlert("All Leave", "leave");
            }}
          >
            Mark All Leave
          </Button>
          {isDateHoliday && (
            <Badge
              variant="outline"
              className="text-xs bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
            >
              {activeHolidayTitle || "Holiday"} · Actions Blocked
            </Badge>
          )}
        </div>
      )}

      {/* Attendance Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Students Attendance Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm">Roll No</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Student Name</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Class / Section</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Current Status</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasLoadedStudents ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-2 px-3 text-sm text-center text-muted-foreground py-8">
                      Select filters and click "Load Students" to view attendance
                    </TableCell>
                  </TableRow>
                ) : fetchedStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-2 px-3 text-sm text-center text-muted-foreground py-8">
                      No students found for this class and section
                    </TableCell>
                  </TableRow>
                ) : (
                  fetchedStudents.map(student => {
                    const studentId = extractId(student.id || student._id);
                    const att = student.attendance?.[0];
                    const lockTimestamp = att?.generatedAt || att?.markedAt;
                    const isLocked = lockTimestamp && (Date.now() - new Date(lockTimestamp).getTime()) > ATTENDANCE_EDIT_WINDOW_MS;
                    const effectiveStatus = attendanceChanges[studentId] || normalizeAttendanceStatus(att?.status) || "not_marked";

                    return (
                      <TableRow key={studentId}>
                        <TableCell className="py-2 px-3 text-sm font-medium">{student.rollNumber}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">{getFullName(student)}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          {student.class?.name} {student.section?.name ? `(${student.section.name})` : ""}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          {effectiveStatus === "present" && <Badge className="bg-green-500">Present</Badge>}
                          {effectiveStatus === "absent" && <Badge className="bg-red-500">Absent</Badge>}
                          {effectiveStatus === "leave" && (
                            <Badge className="bg-amber-500">
                              Leave {att?.isApprovedLeave ? "(Approved)" : ""}
                            </Badge>
                          )}
                          {effectiveStatus === "short_leave" && <Badge className="bg-blue-500">Short Leave</Badge>}
                          {(effectiveStatus === "holiday" || effectiveStatus === "hd") && (
                            <Badge className="bg-purple-600 text-white">Holiday (HD)</Badge>
                          )}
                          {effectiveStatus === "not_marked" && <Badge variant="outline">Not Marked</Badge>}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          {isLocked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                  <LockKeyhole className="w-3.5 h-3.5 text-amber-500" /> Locked
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Attendance locked after 48h</TooltipContent>
                            </Tooltip>
                          ) : isDateHoliday ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 text-xs text-purple-600 cursor-not-allowed font-medium">
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                    Holiday - Blocked
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Attendance actions are blocked on holidays</TooltipContent>
                            </Tooltip>
                          ) : !canMarkAttendance ? (
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize font-medium ${
                                effectiveStatus === "present" ? "bg-green-50 text-green-700 border-green-200" :
                                effectiveStatus === "absent" ? "bg-red-50 text-red-700 border-red-200" :
                                effectiveStatus === "leave" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                effectiveStatus === "short_leave" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                "bg-muted text-muted-foreground"
                              }`}
                            >
                              {effectiveStatus ? effectiveStatus.replace("_", " ") : "Not Marked"}
                            </Badge>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={effectiveStatus === "present" ? "default" : "outline"}
                                className={`h-8 px-2 text-xs ${effectiveStatus === "present" ? "bg-green-600 hover:bg-green-700" : ""}`}
                                onClick={() => handleStatusChange(student, "present")}
                              >
                                P
                              </Button>
                              <Button
                                size="sm"
                                variant={effectiveStatus === "absent" ? "default" : "outline"}
                                className={`h-8 px-2 text-xs ${effectiveStatus === "absent" ? "bg-red-600 hover:bg-red-700" : ""}`}
                                onClick={() => handleStatusChange(student, "absent")}
                              >
                                A
                              </Button>
                              <Button
                                size="sm"
                                variant={effectiveStatus === "leave" ? "default" : "outline"}
                                className={`h-8 px-2 text-xs ${effectiveStatus === "leave" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                                onClick={() => handleStatusChange(student, "leave")}
                              >
                                L
                              </Button>
                              <Button
                                size="sm"
                                variant={effectiveStatus === "short_leave" ? "default" : "outline"}
                                className={`h-8 px-2 text-xs ${effectiveStatus === "short_leave" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                                onClick={() => handleStatusChange(student, "short_leave")}
                              >
                                SL
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transient Status Alert */}
      {statusAlert && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-white text-sm font-semibold transition-all duration-300 ${
            statusAlert.icon === "present" ? "bg-green-600/90" :
            statusAlert.icon === "absent" ? "bg-red-600/90" :
            statusAlert.icon === "short_leave" ? "bg-blue-600/90" :
            "bg-amber-600/90"
          }`}>
            {statusAlert.icon === "present" && <CheckCircle2 className="w-5 h-5" />}
            {statusAlert.icon === "absent" && <XCircle className="w-5 h-5" />}
            {statusAlert.icon === "leave" && <Clock className="w-5 h-5" />}
            {statusAlert.icon === "short_leave" && <Timer className="w-5 h-5" />}
            {statusAlert.message}
          </div>
        </div>
      )}

      {/* Undo confirmation dialog */}
      <AttendanceConfirmationDialog
        open={confirmDialog !== null}
        actionType={confirmDialog?.type}
        date={confirmDialog?.date}
        holidayId={confirmDialog?.holidayId}
        onUndo={() => {
          if (confirmDialog?.type === 'generate') {
            undoGenerateMutation.mutate(confirmDialog.date);
          } else if (confirmDialog?.type === 'holiday') {
            undoHolidayMutation.mutate(confirmDialog.holidayId);
          }
        }}
        onClose={() => setConfirmDialog(null)}
        isUndoing={undoGenerateMutation.isPending || undoHolidayMutation.isPending}
      />
    </div>
  );
}
