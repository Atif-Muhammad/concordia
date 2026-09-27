import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  UserPlus,
  Edit,
  Trash2,
} from "lucide-react";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getTeacherNames,
} from "@/services/api";

export const DepartmentsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("HR & Payroll", "departments");

  const [deptOpen, setDeptOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deptFormData, setDeptFormData] = useState({
    id: "",
    departmentName: "",
    headOfDepartment: "",
    description: "",
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: getTeacherNames,
  });

  const addDeptMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries(["departments"]);
      toast({ title: "Department added successfully" });
      setDeptOpen(false);
      setDeptFormData({
        id: "",
        departmentName: "",
        headOfDepartment: "",
        description: "",
      });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateDeptMutation = useMutation({
    mutationFn: updateDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries(["departments"]);
      toast({ title: "Department updated successfully" });
      setDeptOpen(false);
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteDeptMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries(["departments"]);
      toast({ title: "Department deleted successfully" });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleAddDepartment = () => {
    if (!deptFormData.departmentName) {
      toast({
        title: "Please enter department name",
        variant: "destructive",
      });
      return;
    }
    addDeptMutation.mutate(deptFormData);
  };

  const handleUpdateDepartment = (depID) => {
    if (!deptFormData.departmentName) {
      toast({
        title: "Please enter department name",
        variant: "destructive",
      });
      return;
    }
    updateDeptMutation.mutate({ depID, data: deptFormData });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Department Management</CardTitle>
            {canCreate && (
              <Button
                onClick={() => {
                  setEditingDepartment(null);
                  setDeptFormData({
                    id: "",
                    departmentName: "",
                    headOfDepartment: "",
                    description: "",
                  });
                  setDeptOpen(true);
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm">Department Name</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Head of Department</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Description</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments?.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="py-2 px-3 text-sm font-medium">{dept.name}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">{dept.hod?.name || "N/A"}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">{dept.description}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <div className="flex gap-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingDepartment(dept);
                                  setDeptFormData({
                                    id: dept.id,
                                    departmentName: dept.name,
                                    headOfDepartment: dept.hod?.id,
                                    description: dept.description,
                                  });
                                  setDeptOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this department?")) {
                                    deleteDeptMutation.mutate(dept.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!departments || departments.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-2 px-3 text-sm text-center text-muted-foreground italic">
                      No departments found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDepartment ? "Update Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Department Name *</Label>
              <Input
                value={deptFormData.departmentName}
                onChange={(e) =>
                  setDeptFormData({
                    ...deptFormData,
                    departmentName: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Head of Department</Label>
              <select
                className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={deptFormData.headOfDepartment || ""}
                onChange={(e) =>
                  setDeptFormData({
                    ...deptFormData,
                    headOfDepartment: e.target.value,
                  })
                }
              >
                <option value="">Select HOD</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} - {t.specialization || "N/A"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={deptFormData.description}
                onChange={(e) =>
                  setDeptFormData({
                    ...deptFormData,
                    description: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <Button onClick={editingDepartment ? () => handleUpdateDepartment(deptFormData.id) : handleAddDepartment}>
            {editingDepartment ? "Update Department" : "Add Department"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
