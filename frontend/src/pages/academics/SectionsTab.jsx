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
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getSections,
  getClasses,
  getPrograms,
  createSection,
  updateSection,
  deleteSection,
} from "../../../config/apis";

const initialForm = {
  sectionLetter: "A",
  shift: "Morning",
  classId: "",
  capacity: "",
  room: "",
  customName: "",
};

const resolveId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return (item.id || item._id || "").toString();
  }
  return item.toString();
};

export default function SectionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Academics", "sections");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [sectionForm, setSectionForm] = useState(initialForm);

  const [sectionFilterProgram, setSectionFilterProgram] = useState("all");
  const [sectionFilterClass, setSectionFilterClass] = useState("all");

  const { data: sections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
    retry: 1,
  });

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

  const getProgramForClass = (cls) => {
    if (!cls) return null;
    if (cls.programId && typeof cls.programId === "object" && cls.programId.name) {
      return cls.programId;
    }
    const progId = resolveId(cls.programId);
    return programs.find((p) => resolveId(p) === progId) || null;
  };

  const getClassForSection = (s) => {
    if (s.classId && typeof s.classId === "object" && s.classId.name) {
      return s.classId;
    }
    const cId = resolveId(s.classId);
    return classes.find((c) => resolveId(c) === cId) || null;
  };

  // Only allow sections for classes where allowSections is not false
  const sectionAllowedClasses = classes.filter((c) => c.allowSections !== false);

  const sectionMutation = useMutation({
    mutationFn: ({ id, data }) =>
      id ? updateSection(id, data) : createSection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast({ title: `Section ${editing ? "updated" : "created"} successfully` });
      setDialogOpen(false);
      setEditing(null);
      setSectionForm(initialForm);
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
    mutationFn: deleteSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast({ title: "Section deleted successfully" });
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
    setSectionForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    const parts = (item.name || "").split(" ");
    const shift = parts[parts.length - 1];
    const possibleLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const possibleShifts = ["Morning", "Evening"];
    const isStandard =
      possibleLetters.includes(parts[0]) &&
      possibleShifts.includes(shift) &&
      parts.length === 2;

    const cId = resolveId(item.classId);

    setSectionForm({
      sectionLetter: isStandard ? parts[0] : "Custom",
      shift: possibleShifts.includes(shift) ? shift : "Morning",
      classId: cId,
      capacity: item.capacity?.toString() || "",
      room: item.room || "",
      customName: isStandard ? "" : item.name,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    let name = "";
    if (sectionForm.sectionLetter === "Custom") {
      name = sectionForm.customName?.trim();
    } else {
      name = `${sectionForm.sectionLetter} ${sectionForm.shift}`.trim();
    }

    if (!name || !sectionForm.classId) {
      toast({
        title: "Section name, shift, and class are required",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name,
      classId: sectionForm.classId,
      capacity: sectionForm.capacity ? Number(sectionForm.capacity) : null,
      room: sectionForm.room?.trim() || null,
    };

    const editId = (editing?.id || editing?._id)?.toString();
    sectionMutation.mutate({ id: editId, data });
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  const displayNamePreview =
    sectionForm.sectionLetter === "Custom"
      ? sectionForm.customName
      : `${sectionForm.sectionLetter} ${sectionForm.shift}`.trim();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Label>Program</Label>
              <Select
                value={sectionFilterProgram}
                onValueChange={(v) => {
                  setSectionFilterProgram(v);
                  setSectionFilterClass("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((p) => {
                    const pId = resolveId(p);
                    return (
                      <SelectItem key={pId} value={pId}>
                        {p.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Class</Label>
              <Select
                value={sectionFilterClass}
                onValueChange={setSectionFilterClass}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {sectionAllowedClasses
                    .filter((c) => {
                      const cProgId = resolveId(c.programId);
                      return (
                        sectionFilterProgram === "all" ||
                        cProgId === sectionFilterProgram
                      );
                    })
                    .map((c) => {
                      const prog = getProgramForClass(c);
                      const cId = resolveId(c);
                      const label = prog?.name ? `${c.name} (${prog.name})` : c.name;
                      return (
                        <SelectItem key={cId} value={cId}>
                          {label}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              {canCreate && (
                <DialogTrigger asChild>
                  <Button onClick={openAdd}>
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Section
                  </Button>
                </DialogTrigger>
              )}

              <DialogContent className="w-[90vw] max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit" : "Add"} Section</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* CLASS */}
                  <div>
                    <Label>Class *</Label>
                    <Select
                      value={sectionForm.classId}
                      onValueChange={(v) =>
                        setSectionForm({ ...sectionForm, classId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectionAllowedClasses.map((c) => {
                          const prog = getProgramForClass(c);
                          const cId = resolveId(c);
                          const label = prog?.name ? `${c.name} (${prog.name})` : c.name;
                          return (
                            <SelectItem key={cId} value={cId}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SECTION LETTER */}
                  <div>
                    <Label>Section *</Label>
                    <Select
                      value={sectionForm.sectionLetter}
                      onValueChange={(v) =>
                        setSectionForm({ ...sectionForm, sectionLetter: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map(
                          (letter) => (
                            <SelectItem key={letter} value={letter}>
                              {letter}
                            </SelectItem>
                          )
                        )}
                        <SelectItem value="Custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CUSTOM NAME INPUT */}
                  {sectionForm.sectionLetter === "Custom" && (
                    <div>
                      <Label>Custom Name *</Label>
                      <Input
                        value={sectionForm.customName}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            customName: e.target.value,
                          })
                        }
                        placeholder="e.g. Physics Lab"
                      />
                    </div>
                  )}

                  {/* SHIFT */}
                  <div>
                    <Label>Shift *</Label>
                    <Select
                      value={sectionForm.shift}
                      onValueChange={(v) =>
                        setSectionForm({ ...sectionForm, shift: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Evening">Evening</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* PREVIEW NAME */}
                  <div>
                    <Label>Display Name (Preview)</Label>
                    <Input
                      value={displayNamePreview}
                      disabled
                      className="bg-muted font-medium"
                    />
                  </div>

                  {/* CAPACITY */}
                  <div>
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      value={sectionForm.capacity}
                      onChange={(e) =>
                        setSectionForm({
                          ...sectionForm,
                          capacity: e.target.value,
                        })
                      }
                      placeholder="e.g. 40"
                    />
                  </div>

                  {/* ROOM */}
                  <div>
                    <Label>Room</Label>
                    <Input
                      value={sectionForm.room}
                      onChange={(e) =>
                        setSectionForm({ ...sectionForm, room: e.target.value })
                      }
                      placeholder="e.g. Room 101"
                    />
                  </div>

                  {/* SUBMIT */}
                  <div className="md:col-span-2 lg:col-span-3 pt-2">
                    <Button
                      onClick={handleSubmit}
                      className="w-full"
                      disabled={
                        !sectionForm.classId ||
                        !sectionForm.sectionLetter ||
                        !sectionForm.shift ||
                        sectionMutation.isPending
                      }
                    >
                      {sectionMutation.isPending
                        ? "Saving..."
                        : editing
                        ? "Update Section"
                        : "Add Section"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Class</TableHead>
                <TableHead className="py-2 px-3 text-sm">Program</TableHead>
                <TableHead className="py-2 px-3 text-sm">Capacity</TableHead>
                <TableHead className="py-2 px-3 text-sm text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections
                .filter((s) => {
                  const cls = getClassForSection(s);
                  if (!cls) return false;
                  const cId = resolveId(cls);
                  if (
                    sectionFilterClass !== "all" &&
                    cId !== sectionFilterClass
                  ) {
                    return false;
                  }
                  const progId = resolveId(cls.programId);
                  if (
                    sectionFilterProgram !== "all" &&
                    progId !== sectionFilterProgram
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((s) => {
                  const cls = getClassForSection(s);
                  const prog = getProgramForClass(cls);
                  const sId = resolveId(s);
                  return (
                    <TableRow key={sId}>
                      <TableCell className="py-2 px-3 text-sm font-semibold text-slate-800">
                        {s.name}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {cls?.name || "-"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {prog?.name || "-"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {s.capacity || "-"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm text-right">
                        <div className="flex gap-2 justify-end">
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEdit(s)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Section</TooltipContent>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setDeleteTargetId(sId);
                                    setDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Section</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {sections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No sections found.
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
              This will permanently delete this section and may affect enrolled students.
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
