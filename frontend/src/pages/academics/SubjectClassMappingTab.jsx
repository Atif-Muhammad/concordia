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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  BookOpen,
  PlusCircle,
  Edit,
  Trash2,
  Eye,
  Search,
  CheckSquare,
  Square,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getPrograms,
  getClasses,
  getSubjects,
  getAcademicSessions,
  getSubjectClassMappings,
  createSubjectClassMapping,
  updateSubjectClassMapping,
  deleteSubjectClassMapping,
} from "../../../config/apis";

// Helper to safely extract MongoDB ObjectId or string ID
const resolveId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return (item.id || item._id || "").toString();
  }
  return item.toString();
};

export default function SubjectClassMappingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Academics", "scm");

  // Filters for Table
  const [scmSessionFilter, setScmSessionFilter] = useState("all");
  const [scmTableFilter, setScmTableFilter] = useState({
    programId: "all",
    classId: "all",
  });
  const [tableSearch, setTableSearch] = useState("");

  // Dialog State (Add / Edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // SCM doc or null
  const [scmDialogFilter, setScmDialogFilter] = useState({
    programId: "all",
    classId: "",
  });
  const [scmDialogSessionId, setScmDialogSessionId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const [subjectCreditHours, setSubjectCreditHours] = useState({}); // { [subId]: string }
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("");

  // View Details Modal
  const [scmViewItem, setScmViewItem] = useState(null);

  // Delete Alert Dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Queries
  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
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

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjects,
    retry: 1,
  });

  const { data: scmMappings = [], isLoading: isLoadingSCM } = useQuery({
    queryKey: ["scmMappings", scmSessionFilter],
    queryFn: () =>
      getSubjectClassMappings(
        scmSessionFilter !== "all" ? scmSessionFilter : undefined
      ),
    retry: 1,
  });

  // Default session initialization to active session
  useEffect(() => {
    if (academicSessions?.length > 0) {
      const active = academicSessions.find((s) => s.isActive);
      if (active) {
        const activeId = resolveId(active);
        setScmSessionFilter(activeId);
        setScmDialogSessionId(activeId);
      }
    }
  }, [academicSessions]);

  // Helper to find program for a given class
  const getProgramForClass = (cls) => {
    if (!cls) return null;
    if (cls.programId && typeof cls.programId === "object" && cls.programId.name) {
      return cls.programId;
    }
    const progId = resolveId(cls.programId);
    return programs.find((p) => resolveId(p) === progId) || null;
  };

  // Helper to find class object
  const getClassItem = (clsRef) => {
    if (!clsRef) return null;
    if (typeof clsRef === "object" && clsRef.name) return clsRef;
    const cId = resolveId(clsRef);
    return classes.find((c) => resolveId(c) === cId) || null;
  };

  // Helper to find session object
  const getSessionItem = (sessRef) => {
    if (!sessRef) return null;
    if (typeof sessRef === "object" && sessRef.name) return sessRef;
    const sId = resolveId(sessRef);
    return academicSessions.find((s) => resolveId(s) === sId) || null;
  };

  // Available classes in table Class dropdown filtered by selected Program
  const tableAvailableClasses = useMemo(() => {
    if (scmTableFilter.programId === "all") return classes;
    return classes.filter((c) => resolveId(c.programId) === scmTableFilter.programId);
  }, [classes, scmTableFilter.programId]);

  // Available classes in dialog Class dropdown filtered by selected Program
  const dialogAvailableClasses = useMemo(() => {
    if (scmDialogFilter.programId === "all") return classes;
    return classes.filter((c) => resolveId(c.programId) === scmDialogFilter.programId);
  }, [classes, scmDialogFilter.programId]);

  // Check if an existing mapping already exists for the class + session selected in the dialog
  const existingMappingInDialog = useMemo(() => {
    if (!scmDialogFilter.classId) return null;
    const activeSess = scmDialogSessionId && scmDialogSessionId !== "none" ? scmDialogSessionId : "";
    return scmMappings.find((m) => {
      const mClassId = resolveId(m.classId);
      const mSessId = resolveId(m.sessionId);
      if (editing && resolveId(m) === resolveId(editing)) return false;
      return mClassId === scmDialogFilter.classId && (activeSess ? mSessId === activeSess : !mSessId);
    });
  }, [scmMappings, scmDialogFilter.classId, scmDialogSessionId, editing]);

  // Filtered Mappings for Table Display
  const filteredMappings = useMemo(() => {
    return scmMappings.filter((item) => {
      // 1. Session Filter
      if (scmSessionFilter !== "all") {
        const itemSessionId = resolveId(item.sessionId);
        if (itemSessionId && itemSessionId !== scmSessionFilter) return false;
      }

      // 2. Class & Program Filter
      const cls = getClassItem(item.classId);
      const classId = resolveId(item.classId);
      const prog = getProgramForClass(cls);
      const progId = resolveId(prog || cls?.programId);

      if (scmTableFilter.programId !== "all" && progId !== scmTableFilter.programId) {
        return false;
      }

      if (scmTableFilter.classId !== "all" && classId !== scmTableFilter.classId) {
        return false;
      }

      // 3. Search text
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const className = (cls?.name || "").toLowerCase();
        const progName = (prog?.name || "").toLowerCase();
        const subjectNames = (
          Array.isArray(item.subjects) && item.subjects.length > 0
            ? item.subjects.map((s) => (typeof s.subjectId === "object" ? s.subjectId?.name : ""))
            : (item.subjectIds || []).map((s) => (typeof s === "object" ? s.name : ""))
        )
          .join(" ")
          .toLowerCase();

        return className.includes(q) || progName.includes(q) || subjectNames.includes(q);
      }

      return true;
    });
  }, [scmMappings, scmSessionFilter, scmTableFilter, tableSearch, classes, programs]);

  // Filtered Subjects in Dialog by search input
  const dialogFilteredSubjects = useMemo(() => {
    if (!subjectSearchQuery.trim()) return subjects;
    const q = subjectSearchQuery.toLowerCase();
    return subjects.filter((s) =>
      (s.name || "").toLowerCase().includes(q)
    );
  }, [subjects, subjectSearchQuery]);

  // Open Add Dialog
  const openAdd = () => {
    setEditing(null);
    setScmDialogFilter({
      programId: scmTableFilter.programId !== "all" ? scmTableFilter.programId : "all",
      classId: scmTableFilter.classId !== "all" ? scmTableFilter.classId : "",
    });
    setScmDialogSessionId(scmSessionFilter !== "all" ? scmSessionFilter : "none");
    setSelectedSubjectIds(new Set());
    setSubjectCreditHours({});
    setSubjectSearchQuery("");
    setDialogOpen(true);
  };

  // Open Edit Dialog
  const openEdit = (item) => {
    setEditing(item);
    const cls = getClassItem(item.classId);
    const prog = getProgramForClass(cls);
    const progId = resolveId(prog || cls?.programId) || "all";
    const classId = resolveId(item.classId);
    const sessId = resolveId(item.sessionId) || "none";

    setScmDialogFilter({
      programId: progId,
      classId: classId,
    });
    setScmDialogSessionId(sessId);

    // Populate pre-checked subjects and their optional credit hours
    const subjectIdsSet = new Set();
    const crMap = {};

    if (Array.isArray(item.subjects) && item.subjects.length > 0) {
      item.subjects.forEach((sEntry) => {
        const subId = resolveId(sEntry.subjectId || sEntry);
        if (subId) {
          subjectIdsSet.add(subId);
          if (sEntry.creditHours != null && Number(sEntry.creditHours) > 0) {
            crMap[subId] = sEntry.creditHours.toString();
          }
        }
      });
    } else if (Array.isArray(item.subjectIds)) {
      item.subjectIds.forEach((s) => {
        const subId = resolveId(s);
        if (subId) {
          subjectIdsSet.add(subId);
        }
      });
    }

    setSelectedSubjectIds(subjectIdsSet);
    setSubjectCreditHours(crMap);
    setSubjectSearchQuery("");
    setDialogOpen(true);
  };

  // Handle Class Selection in Dialog
  const handleDialogClassChange = (selectedClassId) => {
    setScmDialogFilter((prev) => ({ ...prev, classId: selectedClassId }));

    // If there is an existing mapping for this class and session, pre-populate its subjects & credit hours
    const activeSess = scmDialogSessionId && scmDialogSessionId !== "none" ? scmDialogSessionId : "";
    const existing = scmMappings.find((m) => {
      const mClassId = resolveId(m.classId);
      const mSessId = resolveId(m.sessionId);
      return mClassId === selectedClassId && (activeSess ? mSessId === activeSess : !mSessId);
    });

    if (existing && !editing) {
      const existingSubjects = new Set();
      const existingCr = {};

      if (Array.isArray(existing.subjects) && existing.subjects.length > 0) {
        existing.subjects.forEach((sEntry) => {
          const subId = resolveId(sEntry.subjectId || sEntry);
          if (subId) {
            existingSubjects.add(subId);
            if (sEntry.creditHours != null && Number(sEntry.creditHours) > 0) {
              existingCr[subId] = sEntry.creditHours.toString();
            }
          }
        });
      } else if (Array.isArray(existing.subjectIds)) {
        existing.subjectIds.forEach((s) => {
          const subId = resolveId(s);
          if (subId) existingSubjects.add(subId);
        });
      }

      setSelectedSubjectIds(existingSubjects);
      setSubjectCreditHours(existingCr);
    }
  };

  // Credit Hours Input Handler for a specific subject
  const handleCreditHoursChange = (subId, value) => {
    setSubjectCreditHours((prev) => ({
      ...prev,
      [subId]: value,
    }));
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      if (id) {
        return updateSubjectClassMapping(id, payload);
      }
      return createSubjectClassMapping(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scmMappings"] });
      toast({
        title: `Subject-Class mapping ${editing ? "updated" : "saved"} successfully`,
      });
      setDialogOpen(false);
      setEditing(null);
      setSelectedSubjectIds(new Set());
      setSubjectCreditHours({});
      setSubjectSearchQuery("");
    },
    onError: (err) => {
      toast({
        title: "Failed to save mapping",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSubjectClassMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scmMappings"] });
      toast({ title: "Mapping deleted successfully" });
      setDeleteDialog(false);
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast({
        title: "Failed to delete mapping",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Submit Handler
  const handleSubmit = () => {
    if (!scmDialogFilter.classId) {
      toast({
        title: "Validation Error",
        description: "Please select a class",
        variant: "destructive",
      });
      return;
    }

    if (selectedSubjectIds.size === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one subject",
        variant: "destructive",
      });
      return;
    }

    // Build subjects payload with optional credit hours: some number > 0 or null (not 0)
    const subjectsPayload = Array.from(selectedSubjectIds).map((subId) => {
      const rawCr = subjectCreditHours[subId];
      const numCr =
        rawCr != null && rawCr.toString().trim() !== "" ? Number(rawCr) : null;
      const creditHours =
        numCr != null && !isNaN(numCr) && numCr > 0 ? numCr : null;
      return {
        subjectId: subId,
        creditHours,
      };
    });

    const payload = {
      classId: scmDialogFilter.classId,
      subjectIds: Array.from(selectedSubjectIds),
      subjects: subjectsPayload,
      sessionId:
        scmDialogSessionId && scmDialogSessionId !== "none"
          ? scmDialogSessionId
          : undefined,
    };

    const targetId = editing
      ? resolveId(editing)
      : existingMappingInDialog
      ? resolveId(existingMappingInDialog)
      : null;

    saveMutation.mutate({ id: targetId, payload });
  };

  // Toggle Single Subject Checkbox
  const toggleSubject = (subId) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  // Toggle Select All Visible Subjects
  const toggleSelectAll = () => {
    const visibleIds = dialogFilteredSubjects.map((s) => resolveId(s));
    const allVisibleSelected = visibleIds.every((id) => selectedSubjectIds.has(id));

    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="w-5 h-5 text-primary" /> Subject-Class Mapping
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Assign curriculum subjects and optional credit hours for each class and academic session.
            </CardDescription>
          </div>
          {canCreate && (
            <Button onClick={openAdd} className="shrink-0 gap-2">
              <PlusCircle className="w-4 h-4" /> Add Mapping
            </Button>
          )}
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Top Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/40 rounded-lg border">
            {/* Session Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Academic Session
              </Label>
              <Select
                value={scmSessionFilter}
                onValueChange={(val) => setScmSessionFilter(val)}
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
                value={scmTableFilter.programId}
                onValueChange={(v) =>
                  setScmTableFilter({ programId: v, classId: "all" })
                }
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

            {/* Class Filter (Cascading based on Program) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Class
              </Label>
              <Select
                value={scmTableFilter.classId}
                onValueChange={(v) =>
                  setScmTableFilter((prev) => ({ ...prev, classId: v }))
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {tableAvailableClasses.map((c) => {
                    const prog = getProgramForClass(c);
                    return (
                      <SelectItem key={resolveId(c)} value={resolveId(c)}>
                        {c.name}{" "}
                        {scmTableFilter.programId === "all" && prog
                          ? `(${prog.name})`
                          : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by class, subject..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-8 bg-background"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-hidden bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">
                    Class
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">
                    Program
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">
                    Session
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">
                    Enrolled Subjects
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">
                    Total Credits
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSCM ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Loading subject-class mappings...
                    </TableCell>
                  </TableRow>
                ) : filteredMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                        <p className="font-medium text-foreground">No subject-class mappings found</p>
                        <p className="text-xs text-muted-foreground">
                          {scmTableFilter.programId !== "all" || scmTableFilter.classId !== "all" || scmSessionFilter !== "all"
                            ? "Try adjusting your filters or search terms."
                            : "Click 'Add Mapping' above to map subjects to classes."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMappings.map((item) => {
                    const cls = getClassItem(item.classId);
                    const prog = getProgramForClass(cls);
                    const sess = getSessionItem(item.sessionId);

                    let mappedSubjects = [];
                    if (Array.isArray(item.subjects) && item.subjects.length > 0) {
                      mappedSubjects = item.subjects.map((sEntry) => {
                        const subObj =
                          typeof sEntry.subjectId === "object" && sEntry.subjectId
                            ? sEntry.subjectId
                            : subjects.find((sub) => resolveId(sub) === resolveId(sEntry.subjectId)) || {
                                id: resolveId(sEntry.subjectId),
                                name: `Subject #${resolveId(sEntry.subjectId)}`,
                              };
                        const cr =
                          sEntry.creditHours != null && Number(sEntry.creditHours) > 0
                            ? Number(sEntry.creditHours)
                            : null;
                        return {
                          ...subObj,
                          creditHours: cr,
                        };
                      });
                    } else if (Array.isArray(item.subjectIds)) {
                      mappedSubjects = item.subjectIds.map((s) => {
                        const subObj =
                          typeof s === "object" && s
                            ? s
                            : subjects.find((sub) => resolveId(sub) === resolveId(s)) || {
                                id: resolveId(s),
                                name: `Subject #${resolveId(s)}`,
                              };
                        return {
                          ...subObj,
                          creditHours: null,
                        };
                      });
                    }

                    const totalCredits = mappedSubjects.reduce(
                      (acc, s) => acc + (s.creditHours || 0),
                      0
                    );

                    return (
                      <TableRow key={resolveId(item)} className="hover:bg-muted/30">
                        <TableCell className="py-3 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{cls?.name || "—"}</span>
                            {cls?.isSemester && cls?.semester && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                Sem {cls.semester}
                              </Badge>
                            )}
                            {!cls?.isSemester && cls?.year && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                Yr {cls.year}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm text-muted-foreground">
                          {prog?.name || "—"}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm">
                          {sess?.name ? (
                            <Badge variant="secondary" className="font-normal text-xs">
                              {sess.name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">All Sessions</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                            <Badge variant="default" className="text-xs font-semibold shrink-0">
                              {mappedSubjects.length} subject(s)
                            </Badge>
                            {mappedSubjects.slice(0, 3).map((sub) => (
                              <Badge
                                key={resolveId(sub)}
                                variant="outline"
                                className="text-xs bg-muted/40 font-normal"
                              >
                                {sub.name}
                                {sub.creditHours ? ` (${sub.creditHours} Cr)` : ""}
                              </Badge>
                            ))}
                            {mappedSubjects.length > 3 && (
                              <Badge variant="ghost" className="text-xs text-muted-foreground font-normal">
                                +{mappedSubjects.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm font-medium">
                          {totalCredits > 0 ? `${totalCredits} hrs` : "-"}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setScmViewItem({ item, cls, prog, sess, mappedSubjects, totalCredits })
                                  }
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
                                    onClick={() => openEdit(item)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Mapping</TooltipContent>
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
                                      setDeleteTarget(item);
                                      setDeleteDialog(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Mapping</TooltipContent>
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

      {/* ADD / EDIT DIALOG */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setSelectedSubjectIds(new Set());
            setSubjectCreditHours({});
            setSubjectSearchQuery("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {editing ? "Edit Subject-Class Mapping" : "Add Subject-Class Mapping"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update curriculum subjects and optional credit hours mapped to this class."
                : "Select a program and class, then check subjects and assign optional credit hours."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-6">
            {/* Cascading Program & Class Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Program Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Program *</Label>
                <Select
                  value={scmDialogFilter.programId}
                  onValueChange={(v) => {
                    setScmDialogFilter({ programId: v, classId: "" });
                    setSelectedSubjectIds(new Set());
                    setSubjectCreditHours({});
                  }}
                  disabled={Boolean(editing)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Program" />
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

              {/* Class Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Class *</Label>
                <Select
                  value={scmDialogFilter.classId}
                  onValueChange={handleDialogClassChange}
                  disabled={Boolean(editing)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        scmDialogFilter.programId === "all"
                          ? "Select class"
                          : "Select class in program"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {dialogAvailableClasses.map((c) => {
                      const prog = getProgramForClass(c);
                      return (
                        <SelectItem key={resolveId(c)} value={resolveId(c)}>
                          {c.name}{" "}
                          {scmDialogFilter.programId === "all" && prog
                            ? `(${prog.name})`
                            : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Session Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Academic Session (Optional)</Label>
              <Select
                value={scmDialogSessionId || "none"}
                onValueChange={(v) => setScmDialogSessionId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No session (Universal / All Sessions)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific session (All Sessions)</SelectItem>
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

            {/* Existing Mapping Notice */}
            {existingMappingInDialog && !editing && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-md text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  This class already has mapped subjects for the selected session. Submitting will update its assigned subjects and credit hours.
                </span>
              </div>
            )}

            {/* Subject Checklist Section */}
            {scmDialogFilter.classId ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Select Subjects</Label>
                    <p className="text-xs text-muted-foreground">
                      {selectedSubjectIds.size} of {subjects.length} selected
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={toggleSelectAll}
                  >
                    {dialogFilteredSubjects.every((s) => selectedSubjectIds.has(resolveId(s))) ? (
                      <>
                        <Square className="w-3.5 h-3.5" /> Deselect All
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" /> Select All
                      </>
                    )}
                  </Button>
                </div>

                {/* Subject Search Bar */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter subjects by name..."
                    value={subjectSearchQuery}
                    onChange={(e) => setSubjectSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>

                {/* Checklist Container */}
                <div className="max-h-64 overflow-y-auto border rounded-md divide-y bg-background">
                  {dialogFilteredSubjects.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      No subjects found matching your query.
                    </div>
                  ) : (
                    dialogFilteredSubjects.map((sub) => {
                      const subId = resolveId(sub);
                      const isChecked = selectedSubjectIds.has(subId);

                      return (
                        <div
                          key={subId}
                          className={`flex items-center justify-between p-2.5 hover:bg-muted/50 transition-colors ${
                            isChecked ? "bg-primary/5" : ""
                          }`}
                        >
                          {/* Subject Checkbox & Title */}
                          <div
                            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 pr-2"
                            onClick={() => toggleSubject(subId)}
                          >
                            <Checkbox
                              id={`sub-${subId}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleSubject(subId)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="truncate">
                              <p className="text-sm font-medium leading-none truncate">{sub.name}</p>
                            </div>
                          </div>

                          {/* Optional Credit Hours Input */}
                          <div className="flex items-center shrink-0">
                            {isChecked ? (
                              <div
                                className="flex items-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Label
                                  htmlFor={`cr-${subId}`}
                                  className="text-[11px] text-muted-foreground whitespace-nowrap"
                                >
                                  Credit Hrs:
                                </Label>
                                <Input
                                  id={`cr-${subId}`}
                                  type="number"
                                  min="0.5"
                                  step="0.5"
                                  placeholder="optional"
                                  value={subjectCreditHours[subId] || ""}
                                  onChange={(e) => handleCreditHoursChange(subId, e.target.value)}
                                  className="h-7 w-24 text-xs"
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic px-2">
                                Not selected
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground text-sm">
                Please select a program and class to view and assign subjects.
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                !scmDialogFilter.classId ||
                selectedSubjectIds.size === 0 ||
                saveMutation.isPending
              }
            >
              {saveMutation.isPending
                ? "Saving..."
                : editing
                ? "Update Mapping"
                : "Create Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW DETAILS DIALOG */}
      <Dialog
        open={Boolean(scmViewItem)}
        onOpenChange={(open) => {
          if (!open) setScmViewItem(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> Subject-Class Mapping Details
            </DialogTitle>
          </DialogHeader>

          {scmViewItem && (
            <div className="space-y-6 pt-2">
              {/* Header Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/40 rounded-lg border">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-semibold">
                    Class
                  </Label>
                  <p className="text-base font-semibold mt-1">
                    {scmViewItem.cls?.name || "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-semibold">
                    Program
                  </Label>
                  <p className="text-base font-semibold mt-1">
                    {scmViewItem.prog?.name || "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-semibold">
                    Session
                  </Label>
                  <p className="text-base font-semibold mt-1">
                    {scmViewItem.sess?.name || "All Sessions"}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-md bg-background">
                  <span className="text-xs text-muted-foreground">Total Subjects</span>
                  <p className="text-xl font-bold mt-0.5">
                    {scmViewItem.mappedSubjects.length}
                  </p>
                </div>
                <div className="p-3 border rounded-md bg-background">
                  <span className="text-xs text-muted-foreground">Total Credit Hours</span>
                  <p className="text-xl font-bold mt-0.5">
                    {scmViewItem.totalCredits > 0
                      ? `${scmViewItem.totalCredits} hrs`
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Subjects Table */}
              <div className="space-y-2">
                <Label className="font-semibold text-sm">Enrolled Curriculum Subjects</Label>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="py-2.5 px-3 text-xs">#</TableHead>
                        <TableHead className="py-2.5 px-3 text-xs">Subject Name</TableHead>
                        <TableHead className="py-2.5 px-3 text-xs text-right">Credit Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scmViewItem.mappedSubjects.map((sub, index) => (
                        <TableRow key={resolveId(sub)}>
                          <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs font-medium">
                            {sub.name}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-right font-medium">
                            {sub.creditHours != null && sub.creditHours > 0
                              ? `${sub.creditHours} Cr`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION ALERT DIALOG */}
      <AlertDialog
        open={deleteDialog}
        onOpenChange={(open) => {
          setDeleteDialog(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject-Class Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this subject mapping? Classes enrolled in these subjects will no longer have them listed in the curriculum for this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(resolveId(deleteTarget));
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Mapping"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
