import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getPrograms,
  getDepartmentNames,
  getClasses,
} from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

const cleanProgramName = (name) => {
  if (!name) return "";
  return name.replace(/\s*-\s*$/, "").trim();
};

export const FeeStructuresTab = ({
  programs: propPrograms,
  classes: propClasses,
  feeStructures: propFeeStructures,
} = {}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Fee Management", "structures");

  const [structureOpen, setStructureOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [filterProgramId, setFilterProgramId] = useState("all");

  const [structureForm, setStructureForm] = useState({
    programId: "",
    classId: "",
    totalAmount: "",
    installments: "1",
  });

  const { data: fetchedFeeStructures = [] } = useQuery({
    queryKey: ['feeStructures'],
    queryFn: getFeeStructures,
  });

  const { data: fetchedPrograms = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: getPrograms,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartmentNames,
  });

  const { data: fetchedClasses = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const feeStructures = propFeeStructures && propFeeStructures.length > 0 ? propFeeStructures : fetchedFeeStructures;
  const programs = propPrograms && propPrograms.length > 0 ? propPrograms : fetchedPrograms;
  const classes = propClasses && propClasses.length > 0 ? propClasses : fetchedClasses;

  // Classes filtered by the selected program in the add/edit form
  const availableClasses = useMemo(() => {
    if (!structureForm.programId) return [];
    return classes.filter((cls) => {
      const clsProgId = extractId(cls.programId);
      if (clsProgId && clsProgId === structureForm.programId) {
        return true;
      }
      const selectedProg = programs.find((p) => extractId(p) === structureForm.programId);
      if (selectedProg?.classes && Array.isArray(selectedProg.classes)) {
        return selectedProg.classes.some((c) => extractId(c) === extractId(cls));
      }
      return false;
    });
  }, [classes, programs, structureForm.programId]);

  const resetStructureForm = () => {
    setStructureForm({
      programId: "",
      classId: "",
      totalAmount: "",
      installments: "1",
    });
    setEditingStructure(null);
  };

  const createStructureMutation = useMutation({
    mutationFn: createFeeStructure,
    onSuccess: () => {
      queryClient.invalidateQueries(['feeStructures']);
      toast({ title: "Fee structure created successfully" });
      setStructureOpen(false);
      resetStructureForm();
    },
    onError: (error) => toast({ title: error.message || "Failed to create fee structure", variant: "destructive" }),
  });

  const updateStructureMutation = useMutation({
    mutationFn: ({ id, data }) => updateFeeStructure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['feeStructures']);
      toast({ title: "Fee structure updated successfully" });
      setStructureOpen(false);
      resetStructureForm();
    },
    onError: (error) => toast({ title: error.message || "Failed to update fee structure", variant: "destructive" }),
  });

  const deleteStructureMutation = useMutation({
    mutationFn: deleteFeeStructure,
    onSuccess: () => {
      queryClient.invalidateQueries(['feeStructures']);
      toast({ title: "Fee structure deleted" });
      setDeleteDialogOpen(false);
    },
    onError: (error) => toast({ title: error.message || "Failed to delete fee structure", variant: "destructive" }),
  });

  const handleSubmitStructure = () => {
    if (!structureForm.programId || !structureForm.classId || !structureForm.totalAmount) {
      toast({ title: "Please fill required fields (Program, Class, Total Amount)", variant: "destructive" });
      return;
    }

    const payload = {
      programId: structureForm.programId,
      classId: structureForm.classId,
      totalAmount: parseFloat(structureForm.totalAmount),
      installments: parseInt(structureForm.installments, 10) || 1,
    };

    if (isNaN(payload.totalAmount) || payload.totalAmount < 0) {
      toast({ title: "Please enter a valid total amount", variant: "destructive" });
      return;
    }

    const structureId = editingStructure ? (editingStructure.id || editingStructure._id) : null;

    if (structureId) {
      updateStructureMutation.mutate({ id: structureId, data: payload });
    } else {
      createStructureMutation.mutate(payload);
    }
  };

  const handleEditClick = (structure) => {
    setEditingStructure(structure);
    const progId = extractId(structure.programId || structure.program);
    const clsId = extractId(structure.classId || structure.class);

    setStructureForm({
      programId: progId,
      classId: clsId,
      totalAmount: structure.totalAmount !== undefined && structure.totalAmount !== null ? structure.totalAmount.toString() : "",
      installments: (structure.installments || 1).toString(),
    });
    setStructureOpen(true);
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    const idToDelete = itemToDelete.id || itemToDelete._id;
    deleteStructureMutation.mutate(idToDelete);
    setItemToDelete(null);
  };

  const filteredStructures = useMemo(() => {
    if (!filterProgramId || filterProgramId === "all") return feeStructures;
    return feeStructures.filter((s) => {
      const pId = extractId(s.programId || s.program);
      return pId === filterProgramId;
    });
  }, [feeStructures, filterProgramId]);

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>Fee Structures</CardTitle>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="w-full sm:w-56">
                <Select value={filterProgramId} onValueChange={setFilterProgramId}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Filter by Program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {programs.map((p) => {
                      const pId = extractId(p);
                      return (
                        <SelectItem key={pId} value={pId}>
                          {cleanProgramName(p.name)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {canCreate && (
                <Button
                  onClick={() => {
                    resetStructureForm();
                    setStructureOpen(true);
                  }}
                  className="gap-2 h-9 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  Add Fee Structure
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm">Program</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Class</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Total Amount</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Installments</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStructures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No fee structures found. Click &quot;Add Fee Structure&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStructures.map((structure) => {
                    const structureId = structure.id || structure._id;
                    const pId = extractId(structure.programId || structure.program);
                    const cId = extractId(structure.classId || structure.class);

                    const progObj =
                      structure.program ||
                      (typeof structure.programId === "object" ? structure.programId : null) ||
                      programs.find((p) => extractId(p) === pId);
                    const rawProgName = progObj?.name || (pId ? "Unknown Program" : "—");
                    const progName = cleanProgramName(rawProgName);

                    const classObj =
                      structure.class ||
                      (typeof structure.classId === "object" ? structure.classId : null) ||
                      classes.find((c) => extractId(c) === cId);
                    const className = classObj?.name || (cId ? "Unknown Class" : "—");

                    return (
                      <TableRow key={structureId}>
                        <TableCell className="text-sm px-3 py-2 font-medium">{progName}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">{className}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">PKR {(structure.totalAmount || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">{structure.installments || 1}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          <div className="flex gap-2">
                            {canUpdate && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" onClick={() => handleEditClick(structure)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Fee Structure</TooltipContent>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setItemToDelete({
                                        type: "structure",
                                        id: structureId,
                                      });
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Fee Structure</TooltipContent>
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

      {/* Structure Dialog */}
      <Dialog open={structureOpen} onOpenChange={setStructureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStructure ? "Edit" : "Add"} Fee Structure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Program *</Label>
                <Select
                  value={structureForm.programId || ""}
                  onValueChange={(v) =>
                    setStructureForm((prev) => ({
                      ...prev,
                      programId: v,
                      classId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => {
                      const pId = extractId(p);
                      const dept =
                        (typeof p.departmentId === "object" ? p.departmentId : null) ||
                        departments.find((d) => extractId(d) === extractId(p.departmentId));
                      return (
                        <SelectItem key={pId} value={pId}>
                          {cleanProgramName(p.name)} {dept?.name ? `(${dept.name})` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Class *</Label>
                <Select
                  value={structureForm.classId || ""}
                  onValueChange={(v) =>
                    setStructureForm((prev) => ({
                      ...prev,
                      classId: v,
                    }))
                  }
                  disabled={!structureForm.programId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !structureForm.programId
                          ? "Select Program First"
                          : availableClasses.length === 0
                          ? "No classes in program"
                          : "Select Class"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map((c) => {
                      const cId = extractId(c);
                      return (
                        <SelectItem key={cId} value={cId}>
                          {c.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Total Amount (PKR) *</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={structureForm.totalAmount}
                onChange={(e) =>
                  setStructureForm((prev) => ({
                    ...prev,
                    totalAmount: e.target.value,
                  }))
                }
                placeholder="Enter total tuition amount"
              />
            </div>

            <div className="space-y-2">
              <Label>Installments</Label>
              <Input
                type="number"
                min="1"
                max="24"
                value={structureForm.installments}
                onChange={(e) =>
                  setStructureForm((prev) => ({
                    ...prev,
                    installments: e.target.value,
                  }))
                }
                placeholder="Number of installments (default 1)"
              />
            </div>

            <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 border-t mt-4 flex items-center justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setStructureOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitStructure}
                disabled={createStructureMutation.isPending || updateStructureMutation.isPending}
              >
                {createStructureMutation.isPending || updateStructureMutation.isPending
                  ? "Saving..."
                  : editingStructure
                  ? "Update"
                  : "Add"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the fee structure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
