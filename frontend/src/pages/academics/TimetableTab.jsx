import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, PlusCircle, Edit, Trash2, Printer, AlertCircle, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getClasses,
  getPrograms,
  getSections,
  getSubjects,
  getTeacherNames,
  getTeacherSubjectMappings,
  getAcademicSessions,
  getTimetables,
  getSubjectsForClassWithAssignments,
  upsertTimetable,
  deleteTimetable,
} from "../../../config/apis";

// Helper to safely extract MongoDB ObjectId or string ID
const resolveId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return (item.id || item._id || "").toString();
  }
  return item.toString();
};

function to12h(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function groupSlotsToSchedules(slots) {
  const map = new Map();
  for (const s of slots) {
    const key = resolveId(s.subjectId);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        teacherId: resolveId(s.teacherId),
        dayAssignments: [],
      });
    }
    const entry = map.get(key);
    if (!entry.teacherId && s.teacherId) {
      entry.teacherId = resolveId(s.teacherId);
    }
    entry.dayAssignments.push({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    });
  }
  return Array.from(map.entries()).map(([subjectId, data]) => ({
    subjectId,
    teacherId: data.teacherId || "",
    dayAssignments: data.dayAssignments,
  }));
}

function flattenSchedulesToSlots(schedules) {
  const result = [];
  for (const sched of schedules) {
    if (!sched.subjectId) continue;
    for (const da of sched.dayAssignments) {
      if (!da.dayOfWeek || !da.startTime || !da.endTime) continue;
      result.push({
        dayOfWeek: da.dayOfWeek,
        startTime: da.startTime,
        endTime: da.endTime,
        subjectId: resolveId(sched.subjectId),
        teacherId: resolveId(sched.teacherId) || null,
      });
    }
  }
  return result;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAYS_LIST = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const DAY_SHORT = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export default function TimetableTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Academics", "timetable");

  // Top Filter Bar
  const [timetableFilterSession, setTimetableFilterSession] = useState("all");
  const [timetableFilterProgram, setTimetableFilterProgram] = useState("all");
  const [timetableFilterClass, setTimetableFilterClass] = useState("all");
  const [timetableFilterSection, setTimetableFilterSection] = useState("all");

  // Dialog State (Create / Edit)
  const [ttDialogOpen, setTtDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [ttProgramId, setTtProgramId] = useState("all");
  const [ttClassId, setTtClassId] = useState("");
  const [ttSectionId, setTtSectionId] = useState("");
  const [ttSessionId, setTtSessionId] = useState("");
  const [ttAvailableClassSubjects, setTtAvailableClassSubjects] = useState([]);
  const [ttSubjectsLoading, setTtSubjectsLoading] = useState(false);
  const [ttSubjectSchedules, setTtSubjectSchedules] = useState([]);
  const [ttSaving, setTtSaving] = useState(false);

  // Delete Dialog State
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Queries
  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: getPrograms,
    retry: 1,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
    retry: 1,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
    retry: 1,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjects,
    retry: 1,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: getTeacherNames,
    retry: 1,
  });

  const { data: teacherSubjectMappings = [] } = useQuery({
    queryKey: ["teacherSubjectMappings"],
    queryFn: getTeacherSubjectMappings,
    retry: 1,
  });

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
    retry: 1,
  });

  const { data: timetables = [], isLoading: isLoadingTimetables } = useQuery({
    queryKey: ["timetables", timetableFilterSession, timetableFilterClass],
    queryFn: () =>
      getTimetables(
        timetableFilterSession !== "all" ? timetableFilterSession : null,
        timetableFilterClass !== "all" ? timetableFilterClass : null
      ),
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTimetable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      toast({ title: "Timetable deleted successfully" });
      setDeleteDialog(false);
      setDeleteTargetId(null);
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Default session initialization to active session
  useEffect(() => {
    if (academicSessions?.length > 0) {
      const active = academicSessions.find((s) => s.isActive);
      if (active) {
        const activeId = resolveId(active);
        setTimetableFilterSession(activeId);
        setTtSessionId(activeId);
      }
    }
  }, [academicSessions]);

  // Helpers to resolve associated entities
  const getClassItem = (clsRef) => {
    if (!clsRef) return null;
    if (typeof clsRef === "object" && clsRef.name) return clsRef;
    const cId = resolveId(clsRef);
    return classes.find((c) => resolveId(c) === cId) || null;
  };

  const getProgramForClass = (cls) => {
    if (!cls) return null;
    if (cls.programId && typeof cls.programId === "object" && cls.programId.name) {
      return cls.programId;
    }
    const progId = resolveId(cls.programId);
    return programs.find((p) => resolveId(p) === progId) || null;
  };

  const getTeacherItem = (tRef) => {
    if (!tRef) return null;
    if (typeof tRef === "object" && tRef.name) return tRef;
    const tId = resolveId(tRef);
    return teachers.find((t) => resolveId(t) === tId) || null;
  };

  const getSectionItem = (sRef) => {
    if (!sRef) return null;
    if (typeof sRef === "object" && sRef.name) return sRef;
    const sId = resolveId(sRef);
    return sections.find((s) => resolveId(s) === sId) || null;
  };

  const getSessionItem = (sessRef) => {
    if (!sessRef) return null;
    if (typeof sessRef === "object" && sessRef.name) return sessRef;
    const sId = resolveId(sessRef);
    return academicSessions.find((s) => resolveId(s) === sId) || null;
  };

  // Helper to get all assigned subjects for a teacher (for dropdown display)
  const getTeacherSubjectsText = (teacherId) => {
    const tId = resolveId(teacherId);
    if (!tId) return "";

    const assignedSubjectNames = new Set();

    // 1. From current class subjects
    (ttAvailableClassSubjects || []).forEach((scm) => {
      const subName = scm.subject?.name || scm.name;
      const tList = scm.subject?.teachers || [];
      if (subName && tList.some((t) => resolveId(t.teacherId) === tId)) {
        assignedSubjectNames.add(subName);
      }
    });

    // 2. From all teacher-subject mappings
    (teacherSubjectMappings || []).forEach((m) => {
      if (resolveId(m.teacherId) === tId && m.subjectId) {
        const name =
          typeof m.subjectId === "object"
            ? m.subjectId.name
            : subjects.find((s) => resolveId(s) === resolveId(m.subjectId))?.name;
        if (name) assignedSubjectNames.add(name);
      }
    });

    const list = Array.from(assignedSubjectNames);
    return list.length > 0 ? list.join(", ") : "";
  };

  // Table Filter Cascades
  const tableAvailableClasses = useMemo(() => {
    if (timetableFilterProgram === "all") return classes;
    return classes.filter((c) => resolveId(c.programId) === timetableFilterProgram);
  }, [classes, timetableFilterProgram]);

  const tableSelectedClassObj = useMemo(() => {
    if (timetableFilterClass === "all") return null;
    return getClassItem(timetableFilterClass);
  }, [classes, timetableFilterClass]);

  const tableClassAllowsSections = useMemo(() => {
    if (!tableSelectedClassObj) return false;
    return tableSelectedClassObj.allowSections !== false;
  }, [tableSelectedClassObj]);

  const tableAvailableSections = useMemo(() => {
    if (!timetableFilterClass || timetableFilterClass === "all" || !tableClassAllowsSections) {
      return [];
    }
    return sections.filter((s) => resolveId(s.classId) === timetableFilterClass);
  }, [sections, timetableFilterClass, tableClassAllowsSections]);

  // Dialog Cascades
  const dialogAvailableClasses = useMemo(() => {
    if (!ttProgramId || ttProgramId === "all") return classes;
    return classes.filter((c) => resolveId(c.programId) === ttProgramId);
  }, [classes, ttProgramId]);

  const dialogSelectedClassObj = useMemo(() => {
    return getClassItem(ttClassId);
  }, [classes, ttClassId]);

  const dialogClassAllowsSections = useMemo(() => {
    if (!dialogSelectedClassObj) return false;
    return dialogSelectedClassObj.allowSections !== false;
  }, [dialogSelectedClassObj]);

  const dialogAvailableSections = useMemo(() => {
    if (!ttClassId || !dialogClassAllowsSections) return [];
    return sections.filter((s) => resolveId(s.classId) === ttClassId);
  }, [sections, ttClassId, dialogClassAllowsSections]);

  // Load Assigned Subjects & Common Teachers for selected Class/Section
  const loadAssignedSubjectsAndTeachers = async (classId, sessionId, sectionId) => {
    if (!classId) {
      setTtAvailableClassSubjects([]);
      return;
    }
    setTtSubjectsLoading(true);
    try {
      const effectiveSess =
        sessionId && sessionId !== "none" && sessionId !== "all"
          ? sessionId
          : undefined;
      const effectiveSec =
        sectionId && sectionId !== "all" && sectionId !== "none"
          ? sectionId
          : undefined;

      const data = await getSubjectsForClassWithAssignments(
        classId,
        effectiveSess,
        effectiveSec
      );
      setTtAvailableClassSubjects(data || []);
    } catch (err) {
      console.error("Failed to load class subjects & teachers", err);
      setTtAvailableClassSubjects([]);
    } finally {
      setTtSubjectsLoading(false);
    }
  };

  const openTimetableDialog = (existing) => {
    if (existing) {
      const classId = resolveId(existing.classId);
      const cls = getClassItem(classId);
      const progId = resolveId(cls?.programId) || "all";
      const secId = resolveId(existing.sectionId);
      const sessId = resolveId(existing.sessionId);

      setEditingId(resolveId(existing));
      setTtProgramId(progId);
      setTtClassId(classId);
      setTtSectionId(secId);
      setTtSessionId(sessId || "none");
      setTtSubjectSchedules(groupSlotsToSchedules(existing.slots || []));

      loadAssignedSubjectsAndTeachers(classId, sessId, secId);
    } else {
      const defaultProgram =
        timetableFilterProgram !== "all" ? timetableFilterProgram : "all";
      const defaultClass =
        timetableFilterClass !== "all" ? timetableFilterClass : "";
      const activeSess = academicSessions.find((s) => s.isActive);
      const defaultSess = activeSess
        ? resolveId(activeSess)
        : timetableFilterSession !== "all"
        ? timetableFilterSession
        : "none";

      setEditingId(null);
      setTtProgramId(defaultProgram);
      setTtClassId(defaultClass);
      setTtSectionId("");
      setTtSessionId(defaultSess);
      setTtSubjectSchedules([]);

      if (defaultClass) {
        loadAssignedSubjectsAndTeachers(defaultClass, defaultSess, "");
      } else {
        setTtAvailableClassSubjects([]);
      }
    }
    setTtDialogOpen(true);
  };

  const addSubjectSchedule = (subjectId) => {
    const scmItem = ttAvailableClassSubjects.find(
      (s) => resolveId(s.subject?.id || s.id) === subjectId
    );
    const commonTeachers = scmItem?.subject?.teachers || [];
    const defaultTeacherId =
      commonTeachers.length > 0 ? resolveId(commonTeachers[0].teacherId) : "";

    setTtSubjectSchedules((prev) => [
      ...prev,
      {
        subjectId,
        teacherId: defaultTeacherId,
        dayAssignments: [
          {
            dayOfWeek: "Monday",
            startTime: "09:00",
            endTime: "10:00",
          },
        ],
      },
    ]);
  };

  const removeSubjectSchedule = (schedIdx) => {
    setTtSubjectSchedules((prev) => prev.filter((_, i) => i !== schedIdx));
  };

  const updateSubjectTeacher = (schedIdx, teacherId) => {
    setTtSubjectSchedules((prev) =>
      prev.map((s, i) => {
        if (i !== schedIdx) return s;
        return {
          ...s,
          teacherId,
        };
      })
    );
  };

  const addDayAssignment = (schedIdx) => {
    setTtSubjectSchedules((prev) =>
      prev.map((s, i) =>
        i === schedIdx
          ? {
              ...s,
              dayAssignments: [
                ...s.dayAssignments,
                {
                  dayOfWeek: "Monday",
                  startTime: "",
                  endTime: "",
                },
              ],
            }
          : s
      )
    );
  };

  const removeDayAssignment = (schedIdx, daIdx) => {
    setTtSubjectSchedules((prev) =>
      prev.map((s, i) =>
        i === schedIdx
          ? {
              ...s,
              dayAssignments: s.dayAssignments.filter((_, j) => j !== daIdx),
            }
          : s
      )
    );
  };

  const updateDayAssignment = (schedIdx, daIdx, field, value) => {
    setTtSubjectSchedules((prev) =>
      prev.map((s, i) =>
        i === schedIdx
          ? {
              ...s,
              dayAssignments: s.dayAssignments.map((da, j) =>
                j === daIdx ? { ...da, [field]: value } : da
              ),
            }
          : s
      )
    );
  };

  const handleTimetableSave = async () => {
    if (!ttClassId) {
      toast({
        title: "Validation Error",
        description: "Please select a class",
        variant: "destructive",
      });
      return;
    }
    if (dialogClassAllowsSections && !ttSectionId) {
      toast({
        title: "Validation Error",
        description: "Please select a section for this class",
        variant: "destructive",
      });
      return;
    }
    const slots = flattenSchedulesToSlots(ttSubjectSchedules);
    if (slots.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please configure at least one period with a valid day, start time, and end time",
        variant: "destructive",
      });
      return;
    }

    setTtSaving(true);
    try {
      await upsertTimetable({
        id: editingId || undefined,
        classId: ttClassId,
        sectionId: dialogClassAllowsSections && ttSectionId ? ttSectionId : null,
        sessionId: ttSessionId && ttSessionId !== "none" ? ttSessionId : null,
        slots,
      });

      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      setTtDialogOpen(false);
      toast({
        title: editingId ? "Timetable updated successfully" : "Timetable created successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setTtSaving(false);
    }
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  // Filtered Timetables for display in main view
  const filteredTimetables = useMemo(() => {
    return timetables
      .filter((tt) => {
        // Session filter
        if (timetableFilterSession !== "all") {
          const sId = resolveId(tt.sessionId);
          if (sId && sId !== timetableFilterSession) return false;
        }

        // Program filter
        const cls = getClassItem(tt.classId);
        const prog = getProgramForClass(cls);
        const progId = resolveId(prog || cls?.programId);
        if (timetableFilterProgram !== "all" && progId !== timetableFilterProgram) {
          return false;
        }

        // Class filter
        const cId = resolveId(tt.classId);
        if (timetableFilterClass !== "all" && cId !== timetableFilterClass) {
          return false;
        }

        // Section filter
        if (timetableFilterSection !== "all") {
          const secId = resolveId(tt.sectionId);
          if (secId !== timetableFilterSection) return false;
        }

        return true;
      })
      .slice()
      .sort((a, b) => {
        const aMin = (a.slots || []).map((s) => s.startTime).sort()[0] || "";
        const bMin = (b.slots || []).map((s) => s.startTime).sort()[0] || "";
        return aMin.localeCompare(bMin);
      });
  }, [
    timetables,
    timetableFilterSession,
    timetableFilterProgram,
    timetableFilterClass,
    timetableFilterSection,
    classes,
    programs,
  ]);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Clock className="w-5 h-5 text-primary" /> Timetable
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Configure class and section class schedules, periods, and assigned subject teachers.
            </CardDescription>
          </div>
          {canCreate && (
            <Button onClick={() => openTimetableDialog(null)} className="shrink-0 gap-2 w-full sm:w-auto">
              <PlusCircle className="w-4 h-4" /> Add / Edit Timetable
            </Button>
          )}
        </CardHeader>

        {/* Timetable Editor Dialog */}
        <Dialog open={ttDialogOpen} onOpenChange={setTtDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Timetable" : "Create New Timetable"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Program -> Class -> Section -> Session Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
                {/* 1. Academic Session */}
                <div>
                  <Label>Academic Session</Label>
                  <Select
                    value={ttSessionId || "none"}
                    onValueChange={(v) => {
                      const newSess = v === "none" ? "" : v;
                      setTtSessionId(newSess);
                      if (ttClassId) {
                        loadAssignedSubjectsAndTeachers(ttClassId, newSess, ttSectionId);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All Sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All Sessions</SelectItem>
                      {academicSessions.map((s) => (
                        <SelectItem key={resolveId(s)} value={resolveId(s)}>
                          <span className="flex items-center gap-2">
                            {s.name}
                            {s.isActive && (
                              <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-4">
                                Active
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Program */}
                <div>
                  <Label>Program</Label>
                  <Select
                    value={ttProgramId}
                    onValueChange={(v) => {
                      setTtProgramId(v);
                      setTtClassId("");
                      setTtSectionId("");
                      setTtAvailableClassSubjects([]);
                      setTtSubjectSchedules([]);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All Programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {programs.map((p) => (
                        <SelectItem key={resolveId(p)} value={resolveId(p)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Class */}
                <div>
                  <Label>Class *</Label>
                  <Select
                    value={ttClassId}
                    onValueChange={(v) => {
                      setTtClassId(v);
                      setTtSectionId("");
                      setTtSubjectSchedules([]);
                      loadAssignedSubjectsAndTeachers(v, ttSessionId, "");
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {dialogAvailableClasses.map((c) => {
                        const prog = getProgramForClass(c);
                        const cId = resolveId(c);
                        const label = prog?.name
                          ? `${c.name} (${prog.name})`
                          : c.name;
                        return (
                          <SelectItem key={cId} value={cId}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Section (Conditional based on allowSections) */}
                <div>
                  <Label>
                    Section {dialogClassAllowsSections && "*"}
                  </Label>
                  {ttClassId && !dialogClassAllowsSections ? (
                    <div className="mt-1 p-2 border rounded-md bg-blue-50 text-xs text-blue-800 font-medium h-9 flex items-center">
                      Class Wide (No Sections)
                    </div>
                  ) : (
                    <Select
                      value={ttSectionId}
                      onValueChange={(v) => {
                        setTtSectionId(v);
                        loadAssignedSubjectsAndTeachers(ttClassId, ttSessionId, v);
                      }}
                      disabled={!ttClassId || !dialogClassAllowsSections}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue
                          placeholder={
                            !ttClassId
                              ? "Select class first"
                              : dialogAvailableSections.length === 0
                              ? "No sections created"
                              : "Select section"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {dialogAvailableSections.map((s) => (
                          <SelectItem key={resolveId(s)} value={resolveId(s)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Warning when class allows sections but has none */}
              {ttClassId && dialogClassAllowsSections && dialogAvailableSections.length === 0 && (
                <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    This class allows sections, but no sections have been created yet. Please add a section in the Sections tab first before creating a timetable.
                  </span>
                </div>
              )}

              {/* Subject-Centric Timetable Editor */}
              {ttClassId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-semibold text-sm">Class Curriculum & Periods</h4>
                    {ttSubjectsLoading && (
                      <span className="text-xs text-muted-foreground animate-pulse">
                        Loading assigned subjects & teachers...
                      </span>
                    )}
                  </div>

                  {/* Add Subject dropdown */}
                  {ttAvailableClassSubjects.length === 0 && !ttSubjectsLoading ? (
                    <div className="p-6 border rounded-lg text-center text-sm text-muted-foreground bg-muted/20">
                      <p className="font-medium text-foreground">No subjects mapped to this class</p>
                      <p className="text-xs mt-1">
                        Please assign curriculum subjects in the <strong>Subject-Class Mapping</strong> tab before scheduling periods.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {(() => {
                        const addedSubjectIds = new Set(
                          ttSubjectSchedules.map((s) => resolveId(s.subjectId))
                        );
                        const availableSubjects = ttAvailableClassSubjects.filter(
                          (m) =>
                            !addedSubjectIds.has(
                              resolveId(m.subject?.id || m.id)
                            )
                        );

                        return (
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Select
                                value=""
                                onValueChange={(v) => {
                                  if (v) addSubjectSchedule(v);
                                }}
                                disabled={availableSubjects.length === 0}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      availableSubjects.length === 0
                                        ? "All assigned subjects added to timetable"
                                        : "+ Select a subject to add schedule..."
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSubjects.map((m) => {
                                    const subId = resolveId(m.subject?.id || m.id);
                                    const subName = m.subject?.name || m.name || `Subject #${subId}`;
                                    const commonTeachers = m.subject?.teachers || [];
                                    const teacherNames = commonTeachers
                                      .map((t) => {
                                        const tName = t.teacher?.name || "Teacher";
                                        const tSubText = getTeacherSubjectsText(t.teacherId);
                                        return tSubText ? `${tName} (${tSubText})` : tName;
                                      })
                                      .join(", ");

                                    return (
                                      <SelectItem key={subId} value={subId}>
                                        <div className="flex items-center justify-between gap-4 w-full">
                                          <span>{subName}</span>
                                          {teacherNames && (
                                            <span className="text-xs text-muted-foreground">
                                              ({teacherNames})
                                            </span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Subject Schedule Cards */}
                  <div className="space-y-4">
                    {ttSubjectSchedules.map((sched, schedIdx) => {
                      const schedSubId = resolveId(sched.subjectId);
                      const scmItem = ttAvailableClassSubjects.find(
                        (s) => resolveId(s.subject?.id || s.id) === schedSubId
                      );
                      const subjectName =
                        scmItem?.subject?.name ||
                        subjects.find((s) => resolveId(s) === schedSubId)?.name ||
                        `Subject #${schedSubId}`;
                      const commonTeachers = scmItem?.subject?.teachers || [];

                      // Partition teachers into assigned-to-this-subject vs others (unique list, no duplicate IDs)
                      const commonTeacherIdSet = new Set(
                        commonTeachers.map((ct) => resolveId(ct.teacherId))
                      );
                      const assignedTeachersList = teachers.filter((t) =>
                        commonTeacherIdSet.has(resolveId(t))
                      );
                      const otherTeachersList = teachers.filter(
                        (t) => !commonTeacherIdSet.has(resolveId(t))
                      );

                      return (
                        <div
                          key={schedIdx}
                          className="border rounded-lg p-4 space-y-4 bg-background shadow-xs"
                        >
                          {/* Card Header: Subject + Top-Level Assigned Teacher */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {subjectName}
                              </span>
                              {scmItem?.creditHours != null && Number(scmItem.creditHours) > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                  {scmItem.creditHours} Cr
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Top-Level Teacher Selector for this subject */}
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                  Teacher:
                                </Label>
                                <Select
                                  value={sched.teacherId || "none"}
                                  onValueChange={(v) =>
                                    updateSubjectTeacher(
                                      schedIdx,
                                      v === "none" ? "" : v
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs min-w-[220px]">
                                    <SelectValue placeholder="Select teacher" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    <SelectItem value="none">
                                      <em>No Teacher Assigned</em>
                                    </SelectItem>
                                    {assignedTeachersList.length > 0 && (
                                      <>
                                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
                                          Assigned to this class & subject
                                        </div>
                                        {assignedTeachersList.map((t) => {
                                          const tId = resolveId(t);
                                          const subText = getTeacherSubjectsText(tId);
                                          return (
                                            <SelectItem key={tId} value={tId}>
                                              {t.name} {subText ? `(${subText})` : ""}
                                            </SelectItem>
                                          );
                                        })}
                                      </>
                                    )}
                                    {otherTeachersList.length > 0 && (
                                      <>
                                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
                                          All Teachers
                                        </div>
                                        {otherTeachersList.map((t) => {
                                          const tId = resolveId(t);
                                          const subText = getTeacherSubjectsText(tId);
                                          return (
                                            <SelectItem key={tId} value={tId}>
                                              {t.name} {subText ? `(${subText})` : ""}
                                            </SelectItem>
                                          );
                                        })}
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSubjectSchedule(schedIdx)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 text-xs"
                              >
                                ✕ Remove
                              </Button>
                            </div>
                          </div>

                          {/* Day Assignments List (Day, Start Time, End Time only - no per-day teacher) */}
                          <div className="space-y-2">
                            {sched.dayAssignments.length > 0 && (
                              <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
                                <span>Day of Week</span>
                                <span>Start Time</span>
                                <span>End Time</span>
                                <span />
                              </div>
                            )}

                            {sched.dayAssignments.map((da, daIdx) => (
                              <div
                                key={daIdx}
                                className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 items-center"
                              >
                                <Select
                                  value={da.dayOfWeek}
                                  onValueChange={(v) =>
                                    updateDayAssignment(
                                      schedIdx,
                                      daIdx,
                                      "dayOfWeek",
                                      v
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DAYS.map((day) => (
                                      <SelectItem key={day} value={day}>
                                        {day}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Input
                                  type="time"
                                  value={da.startTime}
                                  onChange={(e) =>
                                    updateDayAssignment(
                                      schedIdx,
                                      daIdx,
                                      "startTime",
                                      e.target.value
                                    )
                                  }
                                  className="h-8 text-xs"
                                />

                                <Input
                                  type="time"
                                  value={da.endTime}
                                  onChange={(e) =>
                                    updateDayAssignment(
                                      schedIdx,
                                      daIdx,
                                      "endTime",
                                      e.target.value
                                    )
                                  }
                                  className="h-8 text-xs"
                                />

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    removeDayAssignment(schedIdx, daIdx)
                                  }
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  ✕
                                </Button>
                              </div>
                            ))}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addDayAssignment(schedIdx)}
                            className="h-7 text-xs"
                          >
                            + Add Period
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 border-t mt-4 flex items-center justify-end">
                <Button
                  className="w-full sm:w-auto"
                  onClick={handleTimetableSave}
                  disabled={
                    !ttClassId ||
                    (dialogClassAllowsSections && !ttSectionId) ||
                    ttSubjectSchedules.length === 0 ||
                    ttSaving
                  }
                >
                  {ttSaving
                    ? "Saving Timetable..."
                    : editingId
                    ? "Update Timetable"
                    : "Save Timetable"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <CardContent className="pt-6 space-y-6">
          {/* Top Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/40 rounded-lg border">
            {/* Session Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Academic Session
              </Label>
              <Select
                value={timetableFilterSession}
                onValueChange={setTimetableFilterSession}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {academicSessions.map((s) => (
                    <SelectItem key={resolveId(s)} value={resolveId(s)}>
                      <span className="flex items-center gap-2">
                        {s.name}
                        {s.isActive && (
                          <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-4">
                            Active
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Program Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Program
              </Label>
              <Select
                value={timetableFilterProgram}
                onValueChange={(v) => {
                  setTimetableFilterProgram(v);
                  setTimetableFilterClass("all");
                  setTimetableFilterSection("all");
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={resolveId(p)} value={resolveId(p)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class Filter (Cascading) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Class
              </Label>
              <Select
                value={timetableFilterClass}
                onValueChange={(v) => {
                  setTimetableFilterClass(v);
                  setTimetableFilterSection("all");
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {tableAvailableClasses.map((c) => {
                    const prog = getProgramForClass(c);
                    const cId = resolveId(c);
                    return (
                      <SelectItem key={cId} value={cId}>
                        {c.name}{" "}
                        {timetableFilterProgram === "all" && prog
                          ? `(${prog.name})`
                          : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Section Filter (Conditional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Section
              </Label>
              <Select
                value={timetableFilterSection}
                onValueChange={setTimetableFilterSection}
                disabled={
                  timetableFilterClass === "all" ||
                  !tableClassAllowsSections ||
                  tableAvailableSections.length === 0
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {tableAvailableSections.map((s) => (
                    <SelectItem key={resolveId(s)} value={resolveId(s)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Weekly Grid View */}
          {isLoadingTimetables ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">Loading timetables...</p>
            </div>
          ) : filteredTimetables.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-foreground">No timetables found</p>
              <p className="text-xs mt-1">
                {timetableFilterProgram !== "all" ||
                timetableFilterClass !== "all" ||
                timetableFilterSession !== "all"
                  ? "Try adjusting your filters or click 'Add / Edit Timetable' to create one."
                  : "Click 'Add / Edit Timetable' above to schedule class periods."}
              </p>
            </div>
          ) : (
            filteredTimetables.map((tt) => {
              const cls = getClassItem(tt.classId);
              const prog = getProgramForClass(cls);
              const section = getSectionItem(tt.sectionId);
              const session = getSessionItem(tt.sessionId);
              const allowsSections = cls ? cls.allowSections !== false : true;

              const sessionLabel = session?.name ? ` · ${session.name}` : "";
              const label =
                (section
                  ? `${cls?.name} — ${section.name}`
                  : `${cls?.name} (${prog?.name || ""})` +
                    (!allowsSections ? " [Class Wide]" : "")) + sessionLabel;

              const slots = tt.slots || [];
              const timeSlots = Array.from(
                new Set(slots.map((s) => s.startTime).filter(Boolean))
              ).sort();

              const handlePrint = () => {
                const win = window.open("", "_blank");
                if (!win) return;
                win.document.write(`<!DOCTYPE html><html><head><title>${label}</title><style>
                  body{font-family:Arial,sans-serif;padding:32px}h2{text-align:center;margin-bottom:16px}
                  table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px 10px;text-align:center;font-size:13px}
                  th{background:#f0f0f0;font-weight:600}.empty{color:#aaa}
                </style></head><body><h2>${label} Timetable</h2><table><thead><tr>
                  <th>Time</th>${DAYS_LIST.map((d) => `<th>${d}</th>`).join("")}</tr></thead><tbody>
                  ${timeSlots
                    .map((startTime) => {
                      const endTime =
                        slots.find((s) => s.startTime === startTime)?.endTime || "";
                      return `<tr><td><strong>${to12h(
                        startTime
                      )}</strong>${endTime ? `–${to12h(endTime)}` : ""}</td>${DAYS_LIST.map(
                        (day) => {
                          const s = slots.find(
                            (sl) =>
                              sl.startTime === startTime && sl.dayOfWeek === day
                          );
                          if (!s) return `<td class="empty">—</td>`;
                          const subj = subjects.find(
                            (sub) => resolveId(sub) === resolveId(s.subjectId)
                          );
                          const teach =
                            s.teacherId && typeof s.teacherId === "object"
                              ? s.teacherId
                              : getTeacherItem(s.teacherId);
                          return `<td><strong>${subj?.name || "—"}</strong><br/><small style="color:#555">${
                            teach?.name || ""
                          }</small></td>`;
                        }
                      ).join("")}</tr>`;
                    })
                    .join("")}
                </tbody></table></body></html>`);
                win.document.close();
                win.onload = () => win.print();
              };

              return (
                <div key={resolveId(tt)} className="mb-6 p-4 border rounded-lg bg-background shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b">
                    <div>
                      <span className="font-semibold text-base">{label}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {session?.isActive && (
                          <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-4">
                            Active Session
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {slots.length} period(s) scheduled
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canUpdate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTimetableDialog(tt)}
                          className="gap-1.5 h-8 text-xs"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePrint}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print
                      </Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setDeleteTargetId(resolveId(tt));
                            setDeleteDialog(true);
                          }}
                          className="h-8 px-2.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {timeSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No periods defined yet. Click Edit to add periods.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20 border-r text-xs">
                              Day
                            </th>
                            {timeSlots.map((startTime) => {
                              const endTime =
                                slots.find((s) => s.startTime === startTime)
                                  ?.endTime || "";
                              return (
                                <th
                                  key={startTime}
                                  className="px-3 py-2 text-center font-medium text-xs min-w-[120px] whitespace-nowrap"
                                >
                                  <div>{to12h(startTime)}</div>
                                  {endTime && (
                                    <div className="text-muted-foreground/60 font-normal text-[11px]">
                                      {to12h(endTime)}
                                    </div>
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS_LIST.map((day, i) => (
                            <tr
                              key={day}
                              className={i % 2 === 0 ? "" : "bg-muted/20"}
                            >
                              <td className="px-3 py-2 border-r text-xs text-muted-foreground font-semibold whitespace-nowrap align-middle">
                                {DAY_SHORT[day]}
                              </td>
                              {timeSlots.map((startTime) => {
                                const slot = slots.find(
                                  (s) =>
                                    s.startTime === startTime &&
                                    s.dayOfWeek === day
                                );
                                if (!slot)
                                  return (
                                    <td
                                      key={startTime}
                                      className="px-3 py-2 text-center text-muted-foreground/30 text-xs"
                                    >
                                      —
                                    </td>
                                  );

                                const subj = subjects.find(
                                  (s) => resolveId(s) === resolveId(slot.subjectId)
                                );
                                const teach =
                                  slot.teacherId && typeof slot.teacherId === "object"
                                    ? slot.teacherId
                                    : getTeacherItem(slot.teacherId);

                                return (
                                  <td
                                    key={startTime}
                                    className="px-2 py-1.5 align-top"
                                  >
                                    <div className="rounded-md bg-primary/5 border border-primary/20 px-2 py-1.5 text-xs space-y-1">
                                      <div className="font-semibold text-foreground leading-tight">
                                        {subj?.name || "—"}
                                      </div>
                                      {teach?.name && (
                                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                          <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <span className="truncate">{teach.name}</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this class timetable. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
