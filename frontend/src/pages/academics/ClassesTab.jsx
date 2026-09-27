import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { BookOpen, PlusCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getClasses,
  getPrograms,
  getDepartments,
  createClass,
  updateClass,
  deleteClass,
} from "../../../config/apis";

const initialForm = {
  name: "",
  programId: "",
  year: "",
  semester: "",
  isSemester: false,
  rollPrefix: "",
  allowSections: true,
};

const resolveProgramId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return (item.id || item._id || "").toString();
  }
  return item.toString();
};

export default function ClassesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Academics", "classes");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [classForm, setClassForm] = useState(initialForm);

  const [filterLevel, setFilterLevel] = useState("all");
  const [filterProgram, setFilterProgram] = useState("all");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
    retry: 1,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: getPrograms,
    retry: 1,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
    retry: 1,
  });

  const getProgramForClass = (c) => {
    if (c.programId && typeof c.programId === "object" && c.programId.name) {
      return c.programId;
    }
    const progId = resolveProgramId(c.programId);
    return programs.find((p) => resolveProgramId(p) === progId) || null;
  };

  const classMutation = useMutation({
    mutationFn: ({ id, data }) =>
      id ? updateClass(id, data) : createClass(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: `Class ${editing ? "updated" : "created"} successfully` });
      setDialogOpen(false);
      setEditing(null);
      setClassForm(initialForm);
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Class deleted successfully" });
      setDeleteDialog(false);
      setDeleteTargetId(null);
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setClassForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    const progId = resolveProgramId(item.programId);
    setClassForm({
      name: item.name || "",
      programId: progId,
      year: item.year?.toString() || "",
      semester: item.semester?.toString() || "",
      isSemester: Boolean(item.isSemester),
      rollPrefix: item.rollPrefix || "",
      allowSections: item.allowSections !== false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const programId = classForm.programId;
    const name = classForm.name?.trim();
    const year = classForm.year ? Number(classForm.year) : null;
    const semester = classForm.semester ? Number(classForm.semester) : null;

    if (!programId) {
      toast({
        title: "Program is required",
        description: "Please select a program for this class.",
        variant: "destructive",
      });
      return;
    }

    if (!name) {
      toast({
        title: "Class name is required",
        description: "Please provide a name for this class / semester.",
        variant: "destructive",
      });
      return;
    }

    const editId = (editing?.id || editing?._id)?.toString();
    const exists = classes.some((c) => {
      const cId = (c.id || c._id)?.toString();
      const cProgId = resolveProgramId(c.programId);
      return (
        cId !== editId &&
        cProgId === programId.toString() &&
        c.name?.trim().toLowerCase() === name.toLowerCase()
      );
    });

    if (exists) {
      toast({
        title: "Class already exists",
        description: "A class with this name already exists for this program.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name,
      programId,
      year,
      semester,
      isSemester: Boolean(classForm.isSemester),
      rollPrefix: classForm.rollPrefix?.trim() || null,
      allowSections: classForm.allowSections !== false,
    };

    classMutation.mutate({ id: editId, data });
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  const selectedProgram = programs.find(
    (p) => resolveProgramId(p) === classForm.programId
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Classes / Semesters
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              {canCreate && (
                <DialogTrigger asChild>
                  <Button onClick={openAdd}>
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Class
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit" : "Add"} Class / Semester</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Program *</Label>
                    <Select
                      value={classForm.programId}
                      onValueChange={(v) => {
                        const prog = programs.find((p) => resolveProgramId(p) === v);
                        const isBS = prog?.level === "UNDERGRADUATE";
                        const isDiploma = prog?.level === "DIPLOMA";
                        const isIntermediate = prog?.level === "INTERMEDIATE";
                        
                        let defaultName = classForm.name;
                        if (!editing && (!classForm.name || classForm.name.startsWith("1st year") || classForm.name.startsWith("Semester") || classForm.name.startsWith("Year"))) {
                          defaultName = isIntermediate ? "1st year" : isBS ? "Semester 1" : isDiploma ? "Year 1" : "";
                        }

                        setClassForm({
                          ...classForm,
                          programId: v,
                          year: isIntermediate ? "11" : isDiploma ? "1" : "",
                          semester: isBS ? "1" : "",
                          name: defaultName,
                          isSemester: isBS,
                          rollPrefix: prog?.rollPrefix || classForm.rollPrefix,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => {
                          const pDeptId =
                            p.departmentId?._id?.toString() ||
                            p.departmentId?.id?.toString() ||
                            (typeof p.departmentId === "string" ? p.departmentId : null);
                          const dept =
                            typeof p.departmentId === "object" && p.departmentId !== null && p.departmentId.name
                              ? p.departmentId
                              : departments.find(
                                  (d) => resolveProgramId(d) === pDeptId
                                );
                          const pId = resolveProgramId(p);
                          return (
                            <SelectItem key={pId} value={pId}>
                              {p.name}
                              {dept ? ` (${dept.name})` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {classForm.programId && selectedProgram && (
                    <>
                      {selectedProgram.level === "INTERMEDIATE" && (
                        <div>
                          <Label>Year Preset (Optional)</Label>
                          <Select
                            value={classForm.year}
                            onValueChange={(v) =>
                              setClassForm({
                                ...classForm,
                                year: v,
                                name: classForm.name && !classForm.name.includes("year")
                                  ? classForm.name
                                  : v === "11" ? "1st year" : "2nd year",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select year preset" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="11">1st year (11th Grade)</SelectItem>
                              <SelectItem value="12">2nd year (12th Grade)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedProgram.level === "UNDERGRADUATE" && (
                        <div>
                          <Label>Semester Preset (Optional)</Label>
                          <Select
                            value={classForm.semester}
                            onValueChange={(v) =>
                              setClassForm({
                                ...classForm,
                                semester: v,
                                isSemester: true,
                                name: classForm.name && !classForm.name.startsWith("Semester")
                                  ? classForm.name
                                  : `Semester ${v}`,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select semester preset" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                <SelectItem key={s} value={s.toString()}>
                                  Semester {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedProgram.level === "DIPLOMA" && (
                        <div>
                          <Label>Year Preset (Optional)</Label>
                          <Select
                            value={classForm.year}
                            onValueChange={(v) =>
                              setClassForm({
                                ...classForm,
                                year: v,
                                name: classForm.name && !classForm.name.startsWith("Year")
                                  ? classForm.name
                                  : `Year ${v}`,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select year preset" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Year 1</SelectItem>
                              <SelectItem value="2">Year 2</SelectItem>
                              <SelectItem value="3">Year 3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Dynamic Class Name Input */}
                  <div>
                    <Label htmlFor="class-name">Class / Semester Name *</Label>
                    <Input
                      id="class-name"
                      value={classForm.name}
                      onChange={(e) =>
                        setClassForm({ ...classForm, name: e.target.value })
                      }
                      placeholder="e.g. 1st year Pre-Medical, Semester 1, Morning Batch"
                      className="font-medium"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter any dynamic or customized class name.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="class-roll-prefix">Preceding Text (Roll Prefix)</Label>
                    <Input
                      id="class-roll-prefix"
                      value={classForm.rollPrefix || ""}
                      onChange={(e) =>
                        setClassForm({ ...classForm, rollPrefix: e.target.value })
                      }
                      placeholder="e.g. PSH-ENG-1A"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Specific roll number prefix for this class/semester.
                    </p>
                  </div>

                  {/* Allow Sections Checkbox */}
                  <div className="pt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="allow-sections"
                        checked={classForm.allowSections !== false}
                        onCheckedChange={(checked) =>
                          setClassForm({ ...classForm, allowSections: !!checked })
                        }
                      />
                      <Label htmlFor="allow-sections" className="cursor-pointer font-medium text-sm">
                        Allow Sections
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 pl-6">
                      When checked, this class will appear in the Sections tab to configure sections.
                    </p>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    className="w-full mt-2"
                    disabled={
                      !classForm.programId ||
                      !classForm.name?.trim() ||
                      classMutation.isPending
                    }
                  >
                    {classMutation.isPending
                      ? "Saving..."
                      : editing
                      ? "Update Class"
                      : "Add Class"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Label>Filter Level</Label>
              <Select
                value={filterLevel}
                onValueChange={(v) => {
                  setFilterLevel(v);
                  setFilterProgram("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="UNDERGRADUATE">Undergraduate (BS)</SelectItem>
                  <SelectItem value="DIPLOMA">Diploma</SelectItem>
                  <SelectItem value="COACHING">Coaching</SelectItem>
                  <SelectItem value="SHORT_COURSE">Short Course</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Filter Program</Label>
              <Select value={filterProgram} onValueChange={setFilterProgram}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs
                    .filter(
                      (p) => filterLevel === "all" || p.level === filterLevel
                    )
                    .map((p) => {
                      const pId = resolveProgramId(p);
                      return (
                        <SelectItem key={pId} value={pId}>
                          {p.name}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Class Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Program</TableHead>
                <TableHead className="py-2 px-3 text-sm">Roll Prefix</TableHead>
                <TableHead className="py-2 px-3 text-sm">Type</TableHead>
                <TableHead className="py-2 px-3 text-sm">Allow Sections</TableHead>
                <TableHead className="py-2 px-3 text-sm text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes
                .filter((c) => {
                  const cProgId = resolveProgramId(c.programId);
                  if (filterProgram !== "all" && cProgId !== filterProgram) {
                    return false;
                  }
                  const prog = getProgramForClass(c);
                  if (filterLevel !== "all" && prog?.level !== filterLevel) {
                    return false;
                  }
                  return true;
                })
                .map((c) => {
                  const prog = getProgramForClass(c);
                  const cId = (c.id || c._id)?.toString();
                  return (
                    <TableRow key={cId}>
                      <TableCell className="py-2 px-3 text-sm font-semibold text-slate-800">
                        {c.name}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {prog?.name || "-"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm font-mono text-xs text-muted-foreground">
                        {c.rollPrefix || "-"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {c.isSemester
                          ? "Semester"
                          : prog?.level === "INTERMEDIATE" ||
                            prog?.level === "DIPLOMA"
                          ? "Year"
                          : "Standard"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <Badge variant={c.allowSections !== false ? "default" : "secondary"}>
                          {c.allowSections !== false ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm text-right">
                        <div className="flex gap-2 justify-end">
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEdit(c)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Class</TooltipContent>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setDeleteTargetId(cId);
                                    setDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Class</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {classes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No classes found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this class and may affect enrolled students or sections assigned to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
