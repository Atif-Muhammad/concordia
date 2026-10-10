import { useState, useEffect, useRef, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
import { Users, PlusCircle, Edit, Trash2, Eye, Search, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getTeacherNames,
  getClasses,
  getPrograms,
  getSections,
  getAcademicSessions,
  getTeacherClassMappings,
  deleteTeacherClassMappings,
  searchAcademicsStaff,
  getSubjectsForClassWithAssignments,
  bulkAssignTeacherToClassSubjects,
} from "../../../config/apis";

// Helper to safely extract MongoDB ObjectId or string ID
const resolveId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return (item.id || item._id || "").toString();
  }
  return item.toString();
};

export default function TeacherClassMappingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Academics", "classMapping");

  // Table Filters
  const [tcmSessionFilter, setTcmSessionFilter] = useState("all");
  const [tcmProgramFilter, setTcmProgramFilter] = useState("all");
  const [tcmClassFilter, setTcmClassFilter] = useState("all");
  const [tcmSectionFilter, setTcmSectionFilter] = useState("all");
  const [tcmTableStaffSearch, setTcmTableStaffSearch] = useState("");

  // Dialog State (Add / Edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tcmDialogSessionId, setTcmDialogSessionId] = useState("");

  // Staff search state
  const [tcmStaffSearch, setTcmStaffSearch] = useState("");
  const [tcmStaffResults, setTcmStaffResults] = useState([]);
  const [tcmStaffSearching, setTcmStaffSearching] = useState(false);
  const [tcmSelectedStaff, setTcmSelectedStaff] = useState(null);

  // Dialog Cascading Form Selectors
  const [tcmSelectedProgramId, setTcmSelectedProgramId] = useState("all");
  const [tcmSelectedClassId, setTcmSelectedClassId] = useState("");
  const [tcmSelectedSectionId, setTcmSelectedSectionId] = useState("");
  const [tcmClassSubjects, setTcmClassSubjects] = useState([]);
  const [tcmClassSubjectsLoading, setTcmClassSubjectsLoading] = useState(false);
  const [tcmSelectedSubjectIds, setTcmSelectedSubjectIds] = useState(new Set());
  const [tcmSubmitting, setTcmSubmitting] = useState(false);
  const tcmSearchTimeout = useRef(null);

  // Detail dialog state
  const [tcmViewItem, setTcmViewItem] = useState(null);
  const [tcmViewSubjects, setTcmViewSubjects] = useState([]);
  const [tcmViewSubjectsLoading, setTcmViewSubjectsLoading] = useState(false);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Queries
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: getTeacherNames,
    retry: 1,
  });

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

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
    retry: 1,
  });

  const { data: teacherClassMappings = [], isLoading: isLoadingTCM } = useQuery({
    queryKey: ["teacherClassMappings", tcmSessionFilter],
    queryFn: () =>
      getTeacherClassMappings(
        tcmSessionFilter !== "all" ? tcmSessionFilter : undefined
      ),
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteTeacherClassMappings(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacherClassMappings"] });
      queryClient.invalidateQueries({ queryKey: ["teacherSubjectMappings"] });
      queryClient.invalidateQueries({ queryKey: ["classSubjects"] });
      queryClient.invalidateQueries({ queryKey: ["teacherClasses"] });
      toast({ title: "Teacher-class mapping removed successfully" });
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
        setTcmSessionFilter(activeId);
        setTcmDialogSessionId(activeId);
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
    const sessId = resolveId(sessRef);
    return academicSessions.find((s) => resolveId(s) === sessId) || null;
  };

  // Selected Class in Dialog & allowSections check
  const selectedClassObj = useMemo(() => {
    return getClassItem(tcmSelectedClassId);
  }, [classes, tcmSelectedClassId]);

  // Check if selected class allows sections (default true unless explicitly false)
  const classAllowsSections = useMemo(() => {
    if (!selectedClassObj) return false;
    return selectedClassObj.allowSections !== false;
  }, [selectedClassObj]);

  // Available sections for the selected class
  const dialogAvailableSections = useMemo(() => {
    if (!tcmSelectedClassId || !classAllowsSections) return [];
    return sections.filter((s) => resolveId(s.classId) === tcmSelectedClassId);
  }, [sections, tcmSelectedClassId, classAllowsSections]);

  // Classes filtered by Program in the table
  const tableAvailableClasses = useMemo(() => {
    if (tcmProgramFilter === "all") return classes;
    return classes.filter((c) => resolveId(c.programId) === tcmProgramFilter);
  }, [classes, tcmProgramFilter]);

  // Sections filtered by Class in the table
  const tableAvailableSections = useMemo(() => {
    if (tcmClassFilter === "all") return [];
    return sections.filter((s) => resolveId(s.classId) === tcmClassFilter);
  }, [sections, tcmClassFilter]);

  // Classes filtered by Program in the dialog
  const dialogAvailableClasses = useMemo(() => {
    if (!tcmSelectedProgramId || tcmSelectedProgramId === "all") return classes;
    return classes.filter((c) => resolveId(c.programId) === tcmSelectedProgramId);
  }, [classes, tcmSelectedProgramId]);

  // Staff Search Handler
  const handleTcmStaffSearch = (q) => {
    setTcmStaffSearch(q);
    if (tcmSearchTimeout.current) clearTimeout(tcmSearchTimeout.current);
    if (!q.trim()) {
      setTcmStaffResults([]);
      return;
    }
    tcmSearchTimeout.current = setTimeout(async () => {
      setTcmStaffSearching(true);
      try {
        const results = await searchAcademicsStaff(q);
        setTcmStaffResults(results || []);
      } catch {
        setTcmStaffResults([]);
      } finally {
        setTcmStaffSearching(false);
      }
    }, 300);
  };

  // Load Class Subjects with current teacher assignments
  const loadTcmClassSubjects = async (
    classId,
    sessionId,
    sectionId,
    targetTeacherId
  ) => {
    if (!classId) {
      setTcmClassSubjects([]);
      return;
    }
    setTcmClassSubjectsLoading(true);
    try {
      const effectiveSessionId =
        sessionId && sessionId !== "none" && sessionId !== "all"
          ? sessionId
          : undefined;
      const effectiveSectionId =
        sectionId && sectionId !== "all" && sectionId !== "none"
          ? sectionId
          : undefined;

      const data = await getSubjectsForClassWithAssignments(
        classId,
        effectiveSessionId,
        effectiveSectionId
      );
      setTcmClassSubjects(data || []);

      // Pre-select subjects ONLY when editing an existing mapping
      const effectiveTeacher = targetTeacherId || resolveId(tcmSelectedStaff);
      if (effectiveTeacher && editing) {
        const assignedIds = new Set();
        (data || []).forEach((scm) => {
          if (scm.isClassTeacherFallback) return;
          const subId = resolveId(scm.subject?.id || scm.id);
          const teachersList = scm.subject?.teachers || scm.teachers || [];
          if (
            teachersList.some(
              (tm) => resolveId(tm.teacherId) === effectiveTeacher
            )
          ) {
            assignedIds.add(subId);
          }
        });
        if (assignedIds.size > 0) {
          setTcmSelectedSubjectIds(assignedIds);
        }
      }
    } catch (err) {
      console.error("Failed to load class subjects", err);
      setTcmClassSubjects([]);
    } finally {
      setTcmClassSubjectsLoading(false);
    }
  };

  const getTcmStaffRole = (staff) => {
    if (!staff) return "Staff";
    if (staff.isTeaching && staff.isNonTeaching) return "Dual Role";
    if (staff.isTeaching) return "Teaching";
    if (staff.isNonTeaching) return "Non-Teaching";
    return staff.designation || "Staff";
  };

  const resetAssignDialog = () => {
    setTcmStaffSearch("");
    setTcmStaffResults([]);
    setTcmSelectedStaff(null);
    setTcmSelectedProgramId("all");
    setTcmSelectedClassId("");
    setTcmSelectedSectionId("");
    setTcmClassSubjects([]);
    setTcmSelectedSubjectIds(new Set());
    const active = academicSessions.find((s) => s.isActive);
    setTcmDialogSessionId(active ? resolveId(active) : "");
  };

  const openAdd = () => {
    setEditing(null);
    resetAssignDialog();
    setDialogOpen(true);
  };

  const openTcmEdit = (mapping) => {
    setEditing(mapping);
    const teacherId = resolveId(mapping.teacherId);
    const teacherObj =
      typeof mapping.teacherId === "object" ? mapping.teacherId : null;
    const staff = teachers.find((t) => resolveId(t) === teacherId);
    const staffName = staff?.name || teacherObj?.name || "Teacher";

    setTcmSelectedStaff({
      id: teacherId,
      name: staffName,
      isTeaching: true,
      isNonTeaching: false,
    });
    setTcmStaffSearch(staffName);
    setTcmStaffResults([]);

    const classId = resolveId(mapping.classId);
    const cls = classes.find((c) => resolveId(c) === classId);
    const progId = resolveId(cls?.programId) || "all";
    const sessId = resolveId(mapping.sessionId);
    const secId = resolveId(mapping.sectionId);

    setTcmSelectedProgramId(progId);
    setTcmSelectedClassId(classId);
    setTcmDialogSessionId(sessId || "none");
    setTcmSelectedSectionId(secId);

    // Reliable immediate initialization from attached subjects if present
    if (mapping.subjects && mapping.subjects.length > 0) {
      setTcmSelectedSubjectIds(new Set(mapping.subjects.map((s) => resolveId(s))));
    } else {
      setTcmSelectedSubjectIds(new Set());
    }

    loadTcmClassSubjects(classId, sessId, secId, teacherId);
    setDialogOpen(true);
  };

  const handleTcmBulkSubmit = async () => {
    if (!tcmSelectedStaff) {
      toast({
        title: "Validation Error",
        description: "Please select a teacher",
        variant: "destructive",
      });
      return;
    }
    if (!tcmSelectedClassId) {
      toast({
        title: "Validation Error",
        description: "Please select a class",
        variant: "destructive",
      });
      return;
    }
    // Only require section if class allows sections AND sections exist for it
    if (classAllowsSections && dialogAvailableSections.length > 0 && !tcmSelectedSectionId) {
      toast({
        title: "Validation Error",
        description: "Please select a section for this class",
        variant: "destructive",
      });
      return;
    }
    if (tcmSelectedSubjectIds.size === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one subject",
        variant: "destructive",
      });
      return;
    }

    setTcmSubmitting(true);
    try {
      await bulkAssignTeacherToClassSubjects({
        id: editing ? resolveId(editing) : undefined,
        teacherId: resolveId(tcmSelectedStaff),
        classId: tcmSelectedClassId,
        sectionId: classAllowsSections && tcmSelectedSectionId ? tcmSelectedSectionId : null,
        sessionId:
          tcmDialogSessionId && tcmDialogSessionId !== "none"
            ? tcmDialogSessionId
            : null,
        subjectIds: Array.from(tcmSelectedSubjectIds),
      });

      queryClient.invalidateQueries({ queryKey: ["teacherClassMappings"] });
      queryClient.invalidateQueries({ queryKey: ["teacherSubjectMappings"] });
      queryClient.invalidateQueries({ queryKey: ["classSubjects"] });
      queryClient.invalidateQueries({ queryKey: ["teacherClasses"] });
      setDialogOpen(false);
      resetAssignDialog();
      setEditing(null);
      toast({
        title: editing
          ? "Teacher assignment updated successfully"
          : "Teacher assigned successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setTcmSubmitting(false);
    }
  };

  const openTcmDetail = (mapping) => {
    setTcmViewItem(mapping);
    setTcmViewSubjects(mapping.subjects || []);
    setTcmViewSubjectsLoading(false);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  // Filtered rows for main table
  const filteredMappings = useMemo(() => {
    return teacherClassMappings.filter((m) => {
      // 1. Session filter
      if (tcmSessionFilter !== "all") {
        const mSessId = resolveId(m.sessionId);
        if (mSessId && mSessId !== tcmSessionFilter) return false;
      }

      // 2. Program filter
      const cls = getClassItem(m.classId);
      const prog = getProgramForClass(cls);
      const progId = resolveId(prog || cls?.programId);
      if (tcmProgramFilter !== "all" && progId !== tcmProgramFilter) {
        return false;
      }

      // 3. Class filter
      const cId = resolveId(m.classId);
      if (tcmClassFilter !== "all" && cId !== tcmClassFilter) {
        return false;
      }

      // 3b. Section filter
      if (tcmSectionFilter !== "all") {
        const sId = resolveId(m.sectionId);
        if (sId !== tcmSectionFilter) return false;
      }

      // 4. Teacher search text
      if (tcmTableStaffSearch.trim()) {
        const teacher = getTeacherItem(m.teacherId);
        const searchTarget = (teacher?.name || "").toLowerCase();
        return searchTarget.includes(tcmTableStaffSearch.toLowerCase());
      }

      return true;
    });
  }, [
    teacherClassMappings,
    tcmSessionFilter,
    tcmProgramFilter,
    tcmClassFilter,
    tcmSectionFilter,
    tcmTableStaffSearch,
    classes,
    programs,
    teachers,
  ]);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="w-5 h-5 text-primary" /> Teacher-Class Assignments
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Assign teachers to specific classes, sections, and subjects for the academic session.
            </CardDescription>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                resetAssignDialog();
                setEditing(null);
              }
            }}
          >
            {canCreate && (
              <DialogTrigger asChild>
                <Button onClick={openAdd} className="shrink-0 gap-2">
                  <PlusCircle className="w-4 h-4" /> Assign Teacher
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing
                    ? "Edit Teacher Assignment"
                    : "Assign Teacher to Class & Subjects"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* 1. TEACHER / STAFF SEARCH */}
                <div>
                  <Label>Search Teacher / Staff *</Label>
                  {editing ? (
                    <div className="flex items-center gap-2 mt-1 p-2.5 border rounded-md bg-muted/60">
                      <span className="font-medium text-sm">
                        {tcmSelectedStaff?.name || "—"}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {tcmSelectedStaff ? getTcmStaffRole(tcmSelectedStaff) : ""}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto italic">
                        Teacher locked
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="relative mt-1">
                        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Type name or ID to search staff..."
                          value={tcmStaffSearch}
                          onChange={(e) => handleTcmStaffSearch(e.target.value)}
                        />
                      </div>
                      {tcmStaffSearching && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Searching...
                        </p>
                      )}
                      {tcmStaffResults.length > 0 && !tcmSelectedStaff && (
                        <div className="border rounded-md mt-1 max-h-44 overflow-y-auto shadow-sm bg-background">
                          {tcmStaffResults.map((s) => (
                            <button
                              key={resolveId(s)}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between border-b last:border-0"
                              onClick={() => {
                                setTcmSelectedStaff(s);
                                setTcmStaffSearch(s.name);
                                setTcmStaffResults([]);
                                if (tcmSelectedClassId) {
                                  loadTcmClassSubjects(
                                    tcmSelectedClassId,
                                    tcmDialogSessionId,
                                    tcmSelectedSectionId,
                                    resolveId(s)
                                  );
                                }
                              }}
                            >
                              <div>
                                <span className="font-medium">{s.name}</span>
                                {s.staffId && (
                                  <span className="text-xs text-muted-foreground ml-2 font-mono">
                                    ({s.staffId})
                                  </span>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-[10px] ml-2">
                                {getTcmStaffRole(s)}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      )}
                      {tcmSelectedStaff && (
                        <div className="flex items-center gap-2 mt-1.5 p-2 border rounded-md bg-muted/40">
                          <span className="font-medium text-sm">
                            {tcmSelectedStaff.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {getTcmStaffRole(tcmSelectedStaff)}
                          </Badge>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline ml-auto font-medium"
                            onClick={() => {
                              resetAssignDialog();
                            }}
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 2. SESSION SELECT */}
                {tcmSelectedStaff && (
                  <div>
                    <Label>Academic Session (Optional)</Label>
                    <Select
                      value={tcmDialogSessionId || "none"}
                      onValueChange={(v) => {
                        const newSession = v === "none" ? "" : v;
                        setTcmDialogSessionId(newSession);
                        if (tcmSelectedClassId) {
                          loadTcmClassSubjects(
                            tcmSelectedClassId,
                            newSession,
                            tcmSelectedSectionId,
                            resolveId(tcmSelectedStaff)
                          );
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
                )}

                {/* 3. PROGRAM SELECT */}
                {tcmSelectedStaff && (
                  <div>
                    <Label>Program</Label>
                    <Select
                      value={tcmSelectedProgramId}
                      onValueChange={(v) => {
                        setTcmSelectedProgramId(v);
                        setTcmSelectedClassId("");
                        setTcmSelectedSectionId("");
                        setTcmClassSubjects([]);
                        setTcmSelectedSubjectIds(new Set());
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
                )}

                {/* 4. CLASS SELECT */}
                {tcmSelectedStaff && (
                  <div>
                    <Label>Class *</Label>
                    <Select
                      value={tcmSelectedClassId}
                      onValueChange={(v) => {
                        setTcmSelectedClassId(v);
                        setTcmSelectedSectionId("");
                        setTcmSelectedSubjectIds(new Set());
                        loadTcmClassSubjects(
                          v,
                          tcmDialogSessionId,
                          "",
                          resolveId(tcmSelectedStaff)
                        );
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
                )}

                {/* 5. SECTION SELECT (Conditional based on allowSections) */}
                {tcmSelectedClassId && classAllowsSections && (
                  <div>
                    <Label>Section *</Label>
                    <Select
                      value={tcmSelectedSectionId}
                      onValueChange={(v) => {
                        setTcmSelectedSectionId(v);
                        if (!editing) {
                          setTcmSelectedSubjectIds(new Set());
                        }
                        loadTcmClassSubjects(
                          tcmSelectedClassId,
                          tcmDialogSessionId,
                          v,
                          resolveId(tcmSelectedStaff)
                        );
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {dialogAvailableSections.map((s) => {
                          const sId = resolveId(s);
                          return (
                            <SelectItem key={sId} value={sId}>
                              {s.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {dialogAvailableSections.length === 0 && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5" /> No sections created
                        yet for this class. Please create a section in the Sections
                        tab first.
                      </p>
                    )}
                  </div>
                )}

                {/* Info badge when class does not allow sections */}
                {tcmSelectedClassId && !classAllowsSections && (
                  <div className="p-2.5 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
                    <span>
                      This class is configured as <strong>Single-Section / No Sections</strong>. Teacher assignment applies directly to the entire class.
                    </span>
                  </div>
                )}

                {/* 6. SUBJECTS CHECKLIST */}
                {tcmSelectedClassId && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="block">
                        Subjects for this class *
                      </Label>
                      {tcmClassSubjects.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {tcmSelectedSubjectIds.size} of {tcmClassSubjects.length} selected
                        </span>
                      )}
                    </div>
                    {tcmClassSubjectsLoading ? (
                      <div className="p-4 border rounded-md text-center text-sm text-muted-foreground">
                        Loading subjects...
                      </div>
                    ) : tcmClassSubjects.length === 0 ? (
                      <div className="p-4 border rounded-md text-center text-sm text-muted-foreground">
                        No subjects mapped to this class yet. Please add subject-class mappings in the Subject-Class Mapping tab.
                      </div>
                    ) : (
                      <div className="border rounded-md max-h-56 overflow-y-auto divide-y p-2 bg-background">
                        {tcmClassSubjects.map((scm) => {
                          const subjectId = resolveId(scm.subject?.id || scm.id);
                          const subjectName = scm.subject?.name || scm.name || "Subject";
                          const assignedTeachers = scm.isClassTeacherFallback
                            ? []
                            : (scm.subject?.teachers || scm.teachers || []);
                          const effectiveTeacherId = resolveId(tcmSelectedStaff);

                          const assignedToThisStaff = assignedTeachers.some(
                            (tm) => resolveId(tm.teacherId) === effectiveTeacherId
                          );
                          const assignedToOther = assignedTeachers.find(
                            (tm) => resolveId(tm.teacherId) !== effectiveTeacherId
                          );
                          const isChecked = tcmSelectedSubjectIds.has(subjectId);

                          return (
                            <div
                              key={subjectId}
                              className="flex items-center gap-2 py-2 px-1 hover:bg-muted/40 rounded transition-colors"
                            >
                              <Checkbox
                                id={`tcm-subj-${subjectId}`}
                                checked={isChecked}
                                disabled={Boolean(assignedToOther)}
                                onCheckedChange={(checked) => {
                                  setTcmSelectedSubjectIds((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(subjectId);
                                    else next.delete(subjectId);
                                    return next;
                                  });
                                }}
                              />
                              <label
                                htmlFor={`tcm-subj-${subjectId}`}
                                className={`text-sm flex-1 font-medium select-none ${
                                  assignedToOther
                                    ? "text-muted-foreground cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <span>{subjectName}</span>
                                {scm.creditHours != null && Number(scm.creditHours) > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1 font-normal">
                                    ({scm.creditHours} Cr)
                                  </span>
                                )}
                              </label>
                              {assignedToThisStaff && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                  Currently assigned
                                </Badge>
                              )}
                              {assignedToOther && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                  {assignedToOther.teacher?.name || "Other teacher"}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 7. SUBMIT BUTTON */}
                <Button
                  className="w-full mt-2"
                  onClick={handleTcmBulkSubmit}
                  disabled={
                    !tcmSelectedStaff ||
                    !tcmSelectedClassId ||
                    (classAllowsSections && !tcmSelectedSectionId) ||
                    tcmSelectedSubjectIds.size === 0 ||
                    tcmSubmitting
                  }
                >
                  {tcmSubmitting
                    ? editing
                      ? "Updating..."
                      : "Assigning..."
                    : editing
                    ? "Update Assignment"
                    : "Assign Teacher"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Top Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 p-4 bg-muted/40 rounded-lg border">
            {/* Session Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Academic Session
              </Label>
              <Select
                value={tcmSessionFilter}
                onValueChange={setTcmSessionFilter}
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
                value={tcmProgramFilter}
                onValueChange={(v) => {
                  setTcmProgramFilter(v);
                  setTcmClassFilter("all");
                  setTcmSectionFilter("all");
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

            {/* Class Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Class
              </Label>
              <Select
                value={tcmClassFilter}
                onValueChange={(v) => {
                  setTcmClassFilter(v);
                  setTcmSectionFilter("all");
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
                        {tcmProgramFilter === "all" && prog
                          ? `(${prog.name})`
                          : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Section Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Section
              </Label>
              <Select
                value={tcmSectionFilter}
                onValueChange={setTcmSectionFilter}
                disabled={tcmClassFilter === "all" || tableAvailableSections.length === 0}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue
                    placeholder={
                      tcmClassFilter === "all"
                        ? "Select class first"
                        : tableAvailableSections.length === 0
                        ? "No sections"
                        : "All Sections"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {tableAvailableSections.map((s) => {
                    const sId = resolveId(s);
                    return (
                      <SelectItem key={sId} value={sId}>
                        {s.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Search Teacher */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Search Teacher
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 bg-background"
                  placeholder="Filter by teacher name..."
                  value={tcmTableStaffSearch}
                  onChange={(e) => setTcmTableStaffSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-hidden bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Teacher</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Class</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Program</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Section</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Subject(s)</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Session</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTCM ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Loading teacher-class assignments...
                    </TableCell>
                  </TableRow>
                ) : filteredMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-muted-foreground/50" />
                        <p className="font-medium text-foreground">No teacher-class mappings found</p>
                        <p className="text-xs text-muted-foreground">
                          {tcmProgramFilter !== "all" || tcmClassFilter !== "all" || tcmSectionFilter !== "all" || tcmSessionFilter !== "all" || tcmTableStaffSearch
                            ? "Try adjusting your filters or search."
                            : "Click 'Assign Teacher' above to assign a teacher to a class."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMappings.map((m) => {
                    const teacher = getTeacherItem(m.teacherId);
                    const cls = getClassItem(m.classId);
                    const prog = getProgramForClass(cls);
                    const section = getSectionItem(m.sectionId);
                    const session = getSessionItem(m.sessionId);
                    const mId = resolveId(m);
                    const allowsSections = cls ? cls.allowSections !== false : true;

                    return (
                      <TableRow key={mId} className="hover:bg-muted/30">
                        <TableCell className="py-3 px-4 font-medium">
                          {teacher?.name || (typeof m.teacherId === "object" ? m.teacherId.name : "—")}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm font-medium">
                          {cls?.name || (typeof m.classId === "object" ? m.classId.name : "—")}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm text-muted-foreground">
                          {prog?.name || "—"}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm">
                          {section?.name ? (
                            <Badge variant="outline" className="font-normal text-xs">
                              {section.name}
                            </Badge>
                          ) : !allowsSections ? (
                            <span className="text-muted-foreground text-xs italic">
                              Class Wide (No Sections)
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">
                              All sections
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm">
                          {m.subjects && m.subjects.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {m.subjects.map((sub, sIdx) => (
                                <Badge
                                  key={resolveId(sub) || sIdx}
                                  variant="outline"
                                  className="text-[11px] font-medium bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 transition-colors"
                                >
                                  {sub.name} {sub.code ? `(${sub.code})` : ""}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">
                              No subjects mapped
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm">
                          {session?.name ? (
                            <Badge variant="secondary" className="font-normal text-xs">
                              {session.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">All Sessions</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => openTcmDetail(m)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                            {canUpdate && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => openTcmEdit(m)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Assignment</TooltipContent>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                      setDeleteTargetId(mId);
                                      setDeleteDialog(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remove Assignment</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
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

      {/* TCM DETAIL DIALOG */}
      <Dialog
        open={Boolean(tcmViewItem)}
        onOpenChange={(open) => {
          if (!open) {
            setTcmViewItem(null);
            setTcmViewSubjects([]);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teacher Assignment Details</DialogTitle>
          </DialogHeader>
          {tcmViewItem && (() => {
            const teacher = getTeacherItem(tcmViewItem.teacherId);
            const cls = getClassItem(tcmViewItem.classId);
            const prog = getProgramForClass(cls);
            const section = getSectionItem(tcmViewItem.sectionId);
            const session = getSessionItem(tcmViewItem.sessionId);
            const allowsSections = cls ? cls.allowSections !== false : true;

            return (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4 pb-3 border-b">
                  <div>
                    <Label className="text-xs text-muted-foreground">Teacher</Label>
                    <p className="text-sm font-medium mt-0.5">
                      {teacher?.name || (typeof tcmViewItem.teacherId === "object" ? tcmViewItem.teacherId.name : "—")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Class</Label>
                    <p className="text-sm font-medium mt-0.5">
                      {cls?.name || (typeof tcmViewItem.classId === "object" ? tcmViewItem.classId.name : "—")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Program</Label>
                    <p className="text-sm font-medium mt-0.5">
                      {prog?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Section</Label>
                    <p className="text-sm font-medium mt-0.5">
                      {section?.name ? (
                        section.name
                      ) : !allowsSections ? (
                        <span className="text-muted-foreground italic">Class Wide (No Sections)</span>
                      ) : (
                        <span className="text-muted-foreground italic">All sections</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Session</Label>
                    <p className="text-sm font-medium mt-0.5">
                      {session?.name ? (
                        <span className="flex items-center gap-1">
                          {session.name}
                          {session.isActive && (
                            <Badge className="bg-emerald-500 text-white text-[10px] px-1 py-0 h-4">
                              Active
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">All Sessions</span>
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Assigned Subjects</Label>
                  {tcmViewSubjectsLoading ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Loading subjects...
                    </p>
                  ) : tcmViewSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No subjects mapped for this teacher in this class.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2 px-3 text-xs uppercase">Subject</TableHead>
                          <TableHead className="py-2 px-3 text-xs uppercase">Credit Hours</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tcmViewSubjects.map((scm, idx) => {
                          const subId = resolveId(scm.id || scm._id || scm.subject?.id);
                          const subName = scm.name || scm.subject?.name || "—";
                          const subCode = scm.code || scm.subject?.code;
                          return (
                            <TableRow key={subId || idx}>
                              <TableCell className="py-2 px-3 text-sm font-medium">
                                {subName} {subCode ? `(${subCode})` : ""}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-sm text-muted-foreground">
                                {scm.creditHours != null && Number(scm.creditHours) > 0
                                  ? `${scm.creditHours} hrs`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION ALERT */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this teacher's assignment to the class and unassign their subjects for this class/section. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
