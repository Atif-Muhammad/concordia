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
  DialogFooter,
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
import { GraduationCap, PlusCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getPrograms,
  getDepartments,
  createProgram,
  updateProgram,
  deleteProgram,
} from "../../../config/apis";

const initialForm = {
  name: "",
  description: "",
  level: "INTERMEDIATE",
  departmentId: "",
  duration: "2 years",
  customDuration: "",
  rollPrefix: "",
};

export default function ProgramsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Academics", "programs");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [programForm, setProgramForm] = useState(initialForm);

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

  const programMutation = useMutation({
    mutationFn: ({ id, data }) =>
      id ? updateProgram(id, data) : createProgram(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["programs"]);
      toast({ title: `Program ${editing ? "updated" : "created"} successfully` });
      setDialogOpen(false);
      setEditing(null);
      setProgramForm(initialForm);
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
    mutationFn: deleteProgram,
    onSuccess: () => {
      queryClient.invalidateQueries(["programs"]);
      toast({ title: "Program deleted successfully" });
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
    setProgramForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (program) => {
    setEditing(program);
    const deptId =
      program.departmentId?._id?.toString() ||
      program.departmentId?.id?.toString() ||
      (typeof program.departmentId === "string" ? program.departmentId : "") ||
      "";

    setProgramForm({
      name: program.name || "",
      description: program.description || "",
      level: program.level || "INTERMEDIATE",
      departmentId: deptId,
      duration: program.duration || "",
      customDuration: "",
      rollPrefix: program.rollPrefix || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!programForm.name || !programForm.duration || !programForm.departmentId) {
      toast({
        title: "Name, duration, and department are required",
        variant: "destructive",
      });
      return;
    }

    const finalDuration =
      programForm.duration === "custom"
        ? programForm.customDuration || "custom"
        : programForm.duration;

    const data = {
      name: programForm.name,
      description: programForm.description,
      level: programForm.level,
      departmentId: programForm.departmentId || null,
      duration: finalDuration,
      rollPrefix: programForm.rollPrefix || null,
    };

    programMutation.mutate({ id: editing?.id || editing?._id, data });
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" /> Programs
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {canCreate && (
              <DialogTrigger asChild>
                <Button onClick={openAdd} className="w-full sm:w-auto">
                  <PlusCircle className="w-4 h-4 mr-2" /> Add Program
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit" : "Add"} Program</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div>
                  <Label>Program Name *</Label>
                  <Input
                    value={programForm.name}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, name: e.target.value })
                    }
                    placeholder="Enter full program name"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {programForm.level === "INTERMEDIATE" &&
                      "e.g. FSC Pre Medical, FSC Pre Engineering"}
                    {programForm.level === "UNDERGRADUATE" &&
                      "e.g. BS Computer Science, BS Nursing"}
                    {programForm.level === "DIPLOMA" &&
                      "e.g. Diploma in Radiology"}
                    {programForm.level === "COACHING" &&
                      "e.g. 9th Class, FSC Pre Medical Coaching"}
                    {programForm.level === "SHORT_COURSE" &&
                      "e.g. Python Programming"}
                  </p>
                </div>
                <div>
                  <Label>Department *</Label>
                  <Select
                    value={programForm.departmentId}
                    onValueChange={(v) =>
                      setProgramForm({ ...programForm, departmentId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => {
                        const deptId = (dept.id || dept._id)?.toString();
                        const hodName = dept.hod?.name || dept.headOfDepartment;
                        return (
                          <SelectItem key={deptId} value={deptId}>
                            {dept.name} {hodName ? `(${hodName})` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Level *</Label>
                  <Select
                    value={programForm.level}
                    onValueChange={(level) => {
                      let defaultDuration = "";
                      if (level === "INTERMEDIATE") defaultDuration = "2 years";
                      else if (level === "UNDERGRADUATE") defaultDuration = "4 years";
                      else if (level === "DIPLOMA") defaultDuration = "2 years";
                      else if (level === "COACHING") defaultDuration = "3 months";
                      else if (level === "SHORT_COURSE") defaultDuration = "1 month";
                      setProgramForm({
                        ...programForm,
                        level,
                        duration: defaultDuration,
                        customDuration: "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERMEDIATE">Intermediate (2 Years)</SelectItem>
                      <SelectItem value="UNDERGRADUATE">Undergraduate</SelectItem>
                      <SelectItem value="DIPLOMA">Diploma (1–2 Years)</SelectItem>
                      <SelectItem value="COACHING">Coaching Classes</SelectItem>
                      <SelectItem value="SHORT_COURSE">Short Course</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration *</Label>
                  {programForm.level === "INTERMEDIATE" && (
                    <Input value="2 years" disabled className="bg-muted" />
                  )}
                  {programForm.level === "UNDERGRADUATE" && (
                    <Select
                      value={programForm.duration}
                      onValueChange={(v) =>
                        setProgramForm({
                          ...programForm,
                          duration: v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4 years">4 years</SelectItem>
                        <SelectItem value="5 years">5 years</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {programForm.level === "DIPLOMA" && (
                    <Select
                      value={programForm.duration}
                      onValueChange={(v) =>
                        setProgramForm({
                          ...programForm,
                          duration: v,
                          customDuration:
                            v === "custom" ? programForm.customDuration : "",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 year">1 year</SelectItem>
                        <SelectItem value="2 years">2 years</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {programForm.level === "COACHING" && (
                    <Select
                      value={programForm.duration}
                      onValueChange={(v) =>
                        setProgramForm({
                          ...programForm,
                          duration: v,
                          customDuration:
                            v === "custom" ? programForm.customDuration : "",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 month">1 month</SelectItem>
                        <SelectItem value="2 months">2 months</SelectItem>
                        <SelectItem value="3 months">3 months</SelectItem>
                        <SelectItem value="6 months">6 months</SelectItem>
                        <SelectItem value="1 year">1 year</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {programForm.level === "SHORT_COURSE" && (
                    <Select
                      value={programForm.duration}
                      onValueChange={(v) =>
                        setProgramForm({
                          ...programForm,
                          duration: v,
                          customDuration:
                            v === "custom" ? programForm.customDuration : "",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 week">1 week</SelectItem>
                        <SelectItem value="2 weeks">2 weeks</SelectItem>
                        <SelectItem value="1 month">1 month</SelectItem>
                        <SelectItem value="2 months">2 months</SelectItem>
                        <SelectItem value="3 months">3 months</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {programForm.duration === "custom" && (
                    <Input
                      className="mt-2"
                      placeholder="e.g. 6 weeks, 18 months"
                      value={programForm.customDuration || ""}
                      onChange={(e) =>
                        setProgramForm({
                          ...programForm,
                          customDuration: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input
                    value={programForm.description}
                    onChange={(e) =>
                      setProgramForm({
                        ...programForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Brief description"
                  />
                </div>
                <div>
                  <Label>Preceding Text (Roll No)</Label>
                  <Input
                    value={programForm.rollPrefix || ""}
                    onChange={(e) =>
                      setProgramForm({
                        ...programForm,
                        rollPrefix: e.target.value,
                      })
                    }
                    placeholder="e.g. PSH-ENG"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Prefix for student roll numbers in this program.
                  </p>
                </div>
                <DialogFooter className="pt-2 border-t mt-4 flex items-center justify-end">
                  <Button
                    onClick={handleSubmit}
                    className="w-full sm:w-auto"
                    disabled={
                      !programForm.name ||
                      !programForm.departmentId ||
                      !programForm.duration ||
                      programMutation.isPending
                    }
                  >
                    {programMutation.isPending
                      ? "Saving..."
                      : editing
                      ? "Update Program"
                      : "Add Program"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Department</TableHead>
                <TableHead className="py-2 px-3 text-sm">Level</TableHead>
                <TableHead className="py-2 px-3 text-sm">Duration</TableHead>
                <TableHead className="py-2 px-3 text-sm">Description</TableHead>
                <TableHead className="text-right px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((p) => {
                const pDeptId =
                  p.departmentId?._id?.toString() ||
                  p.departmentId?.id?.toString() ||
                  (typeof p.departmentId === "string" ? p.departmentId : null);
                const dept =
                  typeof p.departmentId === "object" && p.departmentId !== null && p.departmentId.name
                    ? p.departmentId
                    : departments.find(
                        (d) => (d.id || d._id)?.toString() === pDeptId
                      );
                const hodName = dept?.hod?.name || dept?.headOfDepartment;
                return (
                  <TableRow key={p.id || p._id}>
                    <TableCell className="py-2 font-medium px-3 text-sm">{p.name}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      {dept?.name ? (
                        <span>
                          {dept.name}
                          {hodName && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({hodName})
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      {p.level === "INTERMEDIATE" && "Intermediate"}
                      {p.level === "UNDERGRADUATE" && "BS"}
                      {p.level === "DIPLOMA" && "Diploma"}
                      {p.level === "COACHING" && "Coaching"}
                      {p.level === "SHORT_COURSE" && "Short Course"}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">{p.duration}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">{p.description || "—"}</TableCell>
                    <TableCell className="py-2 text-right px-3 text-sm">
                      <div className="flex justify-end gap-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(p)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setDeleteTargetId(p.id || p._id);
                                  setDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {programs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No programs found.
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
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
