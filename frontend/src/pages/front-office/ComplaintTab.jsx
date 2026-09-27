import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Users,
  User,
  Edit,
  Trash2,
  Eye,
  Search,
  Plus,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getComplaints,
  createComplaint as createComplaintApi,
  updateComplaint as updateComplaintApi,
  delComplaint as delComplaintApi,
  getEmployeesByDept,
  addComplaintRemark as addComplaintRemarkApi,
} from "../../../config/apis";

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "in_progress":
    case "in progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "resolved":
      return "bg-green-50 text-green-700 border-green-200";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

export default function ComplaintTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Front Office", "complaint");

  const [complaintDialog, setComplaintDialog] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [dateFilter, setDateFilter] = useState();
  const [complaintNameSearch, setComplaintNameSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: "", name: "" });
  const [viewDetailsDialog, setViewDetailsDialog] = useState({
    open: false,
    data: null,
  });

  const [complaintForm, setComplaintForm] = useState({
    type: "Student",
    complainantName: "",
    contact: "",
    details: "",
    subject: "",
    status: "Pending",
    assignedToIds: [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", employeeSearch],
    queryFn: () => getEmployeesByDept("", employeeSearch),
    enabled: true,
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ["complaints", dateFilter?.toDateString()],
    queryFn: () => getComplaints(dateFilter),
    enabled: true,
  });

  const createComplaintMutation = useMutation({
    mutationFn: createComplaintApi,
    onSuccess: () => {
      toast({ title: "Complaint registered successfully" });
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      closeComplaintDialog();
    },
    onError: (err) => {
      toast({
        title: err.message || "Complaint registration failed",
        variant: "destructive",
      });
    },
  });

  const updateComplaintMutation = useMutation({
    mutationFn: ({ id, payload }) => updateComplaintApi(id, payload),
    onSuccess: () => {
      toast({ title: "Complaint updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      closeComplaintDialog();
    },
    onError: (err) => {
      toast({
        title: err.message || "Complaint registration failed",
        variant: "destructive",
      });
    },
  });

  const deleteComplaintMutation = useMutation({
    mutationFn: delComplaintApi,
    onSuccess: () => {
      toast({ title: "Complaint deleted" });
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setDeleteDialog({ open: false, id: "", name: "" });
    },
    onError: (err) => {
      toast({
        title: err.message || "Failed to delete complaint",
        variant: "destructive",
      });
    },
  });

  const [newRemarkText, setNewRemarkText] = useState("");

  const addRemarkMutation = useMutation({
    mutationFn: ({ id, remark }) => addComplaintRemarkApi(id, { remark }),
    onSuccess: (updatedComplaint) => {
      toast({ title: "Remark added successfully" });
      setNewRemarkText("");
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAssignedComplaints"] });
      queryClient.invalidateQueries({ queryKey: ["teacherComplaints"] });
      if (updatedComplaint) {
        setViewDetailsDialog((prev) => ({
          ...prev,
          data: updatedComplaint,
        }));
      }
    },
    onError: (err) => {
      toast({
        title: err.message || "Failed to add remark",
        variant: "destructive",
      });
    },
  });

  const handleAddRemark = (e) => {
    e.preventDefault();
    if (!newRemarkText.trim() || !viewDetailsDialog.data) return;
    addRemarkMutation.mutate({
      id: viewDetailsDialog.data.id || viewDetailsDialog.data._id,
      remark: newRemarkText.trim(),
    });
  };

  const closeComplaintDialog = () => {
    setComplaintForm({
      type: "Student",
      complainantName: "",
      contact: "",
      details: "",
      subject: "",
      status: "Pending",
      assignedToIds: [],
    });
    setEditingComplaint(null);
    setComplaintDialog(false);
  };

  const handleComplaintSubmit = () => {
    if (!complaintForm.complainantName || !complaintForm.details) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    if (editingComplaint) {
      updateComplaintMutation.mutate({
        id: editingComplaint.id || editingComplaint._id,
        payload: complaintForm,
      });
    } else {
      createComplaintMutation.mutate({
        ...complaintForm,
        status: "Pending",
      });
    }
  };

  const handleEditComplaint = (complaint) => {
    const rawAssignees = complaint.assignedToIds || complaint.assignedTo || [];
    const ids = Array.isArray(rawAssignees)
      ? rawAssignees.map((a) => (typeof a === "object" ? a.id || a._id : a)).filter(Boolean)
      : [];

    setComplaintForm({
      type: complaint.type || "Student",
      complainantName: complaint.complainantName || "",
      contact: complaint.contact || "",
      details: complaint.details || complaint.description || "",
      subject: complaint.subject || "",
      status: complaint.status || "Pending",
      assignedToIds: ids,
    });
    setEditingComplaint(complaint);
    setComplaintDialog(true);
  };

  const filteredComplaints = useMemo(
    () =>
      (complaints || []).filter((complaint) =>
        !complaintNameSearch.trim() ||
        String(complaint.complainantName || "")
          .toLowerCase()
          .includes(complaintNameSearch.trim().toLowerCase())
      ),
    [complaints, complaintNameSearch]
  );

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          All Complaints
        </CardTitle>
        <Dialog open={complaintDialog} onOpenChange={setComplaintDialog}>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={complaintNameSearch}
                onChange={(e) => setComplaintNameSearch(e.target.value)}
                placeholder="Search by name"
                className="w-full sm:w-[180px] lg:w-[220px] pl-8 h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="text-xs h-8 sm:h-9 px-2.5">
                    {dateFilter ? dateFilter.toDateString() : "Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 sm:h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setDateFilter(undefined)}
                  title="Clear date filter (Show all)"
                >
                  All
                </Button>
              )}
            </div>

            {canCreate && (
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setEditingComplaint(null)}>
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Register
                </Button>
              </DialogTrigger>
            )}
          </div>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingComplaint ? "Edit" : "Register"} Complaint</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Complainant Type *</Label>
                  <Select
                    value={complaintForm.type}
                    onValueChange={(v) =>
                      setComplaintForm({ ...complaintForm, type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Student">Student</SelectItem>
                      <SelectItem value="Parent">Parent</SelectItem>
                      <SelectItem value="Staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Name *</Label>
                  <Input
                    value={complaintForm.complainantName}
                    onChange={(e) =>
                      setComplaintForm({
                        ...complaintForm,
                        complainantName: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Contact *</Label>
                  <Input
                    value={complaintForm.contact}
                    onChange={(e) =>
                      setComplaintForm({
                        ...complaintForm,
                        contact: e.target.value,
                      })
                    }
                    placeholder="0300-1234567"
                  />
                </div>

                <div>
                  <Label>Subject *</Label>
                  <Input
                    value={complaintForm.subject}
                    onChange={(e) =>
                      setComplaintForm({ ...complaintForm, subject: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Assign To Employees</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between mt-1 h-auto min-h-[40px] py-2"
                      >
                        <div className="flex flex-wrap gap-1">
                          {complaintForm.assignedToIds?.length > 0 ? (
                            complaintForm.assignedToIds.map((id) => (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                {employees.find((e) => e.id === id)?.name || id}
                                <X
                                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ids = complaintForm.assignedToIds || [];
                                    setComplaintForm({
                                      ...complaintForm,
                                      assignedToIds: ids.filter((aid) => aid !== id),
                                    });
                                  }}
                                />
                              </Badge>
                            ))
                          ) : (
                            "Select Employees"
                          )}
                        </div>
                        <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search employee..."
                          onValueChange={setEmployeeSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No employee found.</CommandEmpty>
                          <CommandGroup>
                            {employees.map((employee) => (
                              <CommandItem
                                key={employee.id}
                                value={employee.name}
                                onSelect={() => {
                                  const ids = complaintForm.assignedToIds || [];
                                  const newIds = ids.includes(employee.id)
                                    ? ids.filter((id) => id !== employee.id)
                                    : [...ids, employee.id];
                                  setComplaintForm({
                                    ...complaintForm,
                                    assignedToIds: newIds,
                                  });
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    complaintForm.assignedToIds?.includes(employee.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                {employee.name} - {employee.empDepartment}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label>Detail *</Label>
                <Textarea
                  value={complaintForm.details}
                  onChange={(e) =>
                    setComplaintForm({ ...complaintForm, details: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeComplaintDialog}>
                Cancel
              </Button>
              <Button onClick={handleComplaintSubmit}>
                {editingComplaint ? "Update" : "Submit"} Complaint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-2 sm:p-6 pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell py-2 px-3 text-sm">Date</TableHead>
              <TableHead className="hidden md:table-cell py-2 px-3 text-sm">Type</TableHead>
              <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Complainant / Subject</TableHead>
              <TableHead className="hidden lg:table-cell py-2 px-3 text-sm">Subject</TableHead>
              <TableHead className="hidden xl:table-cell py-2 px-3 text-sm">Assigned To</TableHead>
              <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Status</TableHead>
              <TableHead className="hidden sm:table-cell py-2 px-3 text-sm text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredComplaints?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-6 px-3 text-xs sm:text-sm text-center text-muted-foreground"
                >
                  No complaints recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              filteredComplaints?.map((complaint) => (
                <TableRow
                  key={complaint.id || complaint._id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() =>
                    setViewDetailsDialog({
                      open: true,
                      data: complaint,
                    })
                  }
                >
                  <TableCell className="hidden sm:table-cell py-2 px-3 text-sm">
                    {complaint.createdAt?.split("T")[0]}
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-2 px-3 text-sm">{complaint.type}</TableCell>
                  <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium">
                    <div className="font-semibold text-foreground">{complaint.complainantName}</div>
                    <div className="text-[11px] text-muted-foreground sm:hidden mt-0.5 line-clamp-1">
                      {complaint.type} · {complaint.subject || "No subject"}
                    </div>
                    <div className="text-[10px] text-muted-foreground sm:hidden mt-0.5">
                      {complaint.createdAt?.split("T")[0]}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-2 px-3 text-sm font-medium italic">
                    {complaint.subject || "—"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell py-2 px-3 text-sm">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(complaint.assignedTo || complaint.assignedToIds)?.length > 0 ? (
                        (complaint.assignedTo || complaint.assignedToIds).map((emp, idx) => {
                          const empName = typeof emp === "object" ? emp.name : (employees.find((e) => e.id === emp)?.name || emp);
                          const empKey = typeof emp === "object" ? (emp.id || emp._id || idx) : emp;
                          return (
                            <Badge
                              key={empKey}
                              variant="secondary"
                              className="text-[10px] h-5"
                            >
                              {empName}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm">
                    {canUpdate ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={complaint.status}
                          onValueChange={(v) =>
                            updateComplaintMutation.mutate({
                              id: complaint.id || complaint._id,
                              payload: { status: v },
                            })
                          }
                        >
                          <SelectTrigger
                            className={`w-[100px] sm:w-[130px] h-7 sm:h-8 text-[11px] sm:text-xs ${getStatusColor(complaint.status)}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="In_Progress">In Progress</SelectItem>
                            <SelectItem value="Resolved">Resolved</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusColor(
                          complaint.status
                        )}`}
                      >
                        {complaint.status || "Pending"}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell py-2 px-3 text-sm text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setViewDetailsDialog({
                                open: true,
                                data: complaint,
                              })
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
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditComplaint(complaint)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Complaint</TooltipContent>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeleteDialog({
                                  open: true,
                                  id: complaint.id || complaint._id,
                                  name: complaint.subject
                                    ? `"${complaint.subject}" (${complaint.complainantName})`
                                    : complaint.complainantName,
                                })
                              }
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete Complaint</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Complaint?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the complaint{" "}
              <strong className="text-foreground">{deleteDialog.name || "this record"}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteComplaintMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteComplaintMutation.isPending}
              onClick={() => deleteComplaintMutation.mutate(deleteDialog.id)}
            >
              {deleteComplaintMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Details Dialog */}
      <Dialog
        open={viewDetailsDialog.open}
        onOpenChange={(open) => setViewDetailsDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-h-[90vh] md:max-w-[680px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold border-b pb-4">
              Complaint Details
            </DialogTitle>
          </DialogHeader>
          {viewDetailsDialog.data && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Type
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.type}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Complainant Name
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.complainantName}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Subject
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.subject}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </h4>
                  <div className="text-sm font-medium">
                    <span
                      className={`px-2 py-0.5 rounded text-sm font-medium border ${getStatusColor(
                        viewDetailsDialog.data.status
                      )}`}
                    >
                      {viewDetailsDialog.data.status}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.contact || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Date
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.createdAt
                      ? new Date(viewDetailsDialog.data.createdAt).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
              </div>

              {(viewDetailsDialog.data.description || viewDetailsDialog.data.details) && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="text-sm font-semibold">Details / Description</h4>
                  <div className="bg-muted/30 p-4 rounded-md text-sm leading-relaxed whitespace-pre-wrap">
                    {viewDetailsDialog.data.description ||
                      viewDetailsDialog.data.details}
                  </div>
                </div>
              )}

              {viewDetailsDialog.data.assignedTo?.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assigned Employees
                  </h4>
                  <div className="flex flex-wrap gap-4">
                    {viewDetailsDialog.data.assignedTo.map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {emp.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp.empDepartment}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewDetailsDialog.data.remarks?.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status History & Remarks
                  </h4>
                  <div className="space-y-3">
                    {viewDetailsDialog.data.remarks.map((remark, idx) => {
                      const author =
                        remark.authorName ||
                        (typeof remark.author === "string" ? remark.author : remark.author?.name) ||
                        remark.userName ||
                        remark.name ||
                        "Staff";
                      const remarkDate = remark.createdAt || remark.date;
                      let formattedDate = "—";
                      if (remarkDate) {
                        try {
                          formattedDate = new Date(remarkDate).toLocaleString();
                        } catch {
                          formattedDate = String(remarkDate);
                        }
                      }
                      return (
                        <div
                          key={remark.id || remark._id || idx}
                          className="bg-muted/30 p-3 rounded-md text-sm space-y-1"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-primary flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-primary" />
                              {author}
                            </span>
                            <span className="text-[10px] text-muted-foreground italic">
                              {formattedDate}
                            </span>
                          </div>
                          <p className="text-muted-foreground leading-snug whitespace-pre-wrap">
                            {remark.remark || remark.text || ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {canUpdate && (
                <form onSubmit={handleAddRemark} className="space-y-2 pt-4 border-t">
                  <Label htmlFor="adminReplyText" className="text-xs font-medium">
                    Add Follow-up Remark / Action Note
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="adminReplyText"
                      placeholder="Type remark or action note..."
                      value={newRemarkText}
                      onChange={(e) => setNewRemarkText(e.target.value)}
                      className="text-xs h-9"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addRemarkMutation.isPending || !newRemarkText.trim()}
                      className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium shrink-0"
                    >
                      {addRemarkMutation.isPending ? "Posting..." : "Post Remark"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
