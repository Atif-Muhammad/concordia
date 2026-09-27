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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Edit, Trash2, Eye, Search, Plus, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { MonthPicker } from "@/components/ui/month-picker";
import {
  getVisitors,
  createVisitor,
  updateVisitor,
  delVisitor,
} from "../../../config/apis";
import { formatTime } from "../../lib/utils";
import usePermissions from "@/hooks/usePermissions";

const formatTimeSafe = (timeStr) => {
  if (!timeStr) return "-";
  if (/^\d{1,2}:\d{2}/.test(timeStr)) {
    const parts = timeStr.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts[1].slice(0, 2);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
  }
  return formatTime(timeStr);
};

export default function VisitorTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Front Office", "visitor");

  const [visitorDialog, setVisitorDialog] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [visitorNameSearch, setVisitorNameSearch] = useState("");
  const [visitorMonthFilter, setVisitorMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: "", name: "" });
  const [viewDetailsDialog, setViewDetailsDialog] = useState({
    open: false,
    data: null,
  });

  const [visitorForm, setVisitorForm] = useState({
    visitorName: "",
    phoneNumber: "",
    ID: "",
    purpose: "",
    persons: "",
    visitDate: new Date().toISOString().split("T")[0],
    inTime: "",
    outTime: "",
    remarks: "",
  });

  const { data: visitors = [], isLoading: visitorsLoading } = useQuery({
    queryKey: ["visitors", visitorMonthFilter],
    queryFn: () => getVisitors(visitorMonthFilter || undefined),
  });

  const createVisitorMutation = useMutation({
    mutationFn: createVisitor,
    onSuccess: () => {
      toast({ title: "Visitor recorded successfully" });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      closeVisitorDialog();
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to record visitor", variant: "destructive" }),
  });

  const updateVisitorMutation = useMutation({
    mutationFn: ({ id, payload }) => updateVisitor(id, payload),
    onSuccess: () => {
      toast({ title: "Visitor updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      closeVisitorDialog();
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to update visitor", variant: "destructive" }),
  });

  const deleteVisitorMutation = useMutation({
    mutationFn: delVisitor,
    onSuccess: () => {
      toast({ title: "Visitor deleted" });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      setDeleteDialog({ open: false, id: "" });
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to delete visitor", variant: "destructive" }),
  });

  const closeVisitorDialog = () => {
    setVisitorForm({
      visitorName: "",
      phoneNumber: "",
      ID: "",
      purpose: "",
      persons: "",
      visitDate: new Date().toISOString().split("T")[0],
      inTime: "",
      outTime: "",
      remarks: "",
    });
    setEditingVisitor(null);
    setVisitorDialog(false);
  };

  const handleVisitorSubmit = () => {
    if (!visitorForm.visitorName || !visitorForm.phoneNumber || !visitorForm.ID) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    const payload = {
      ...visitorForm,
      visitDate: visitorForm.visitDate || new Date().toISOString().split("T")[0],
    };

    if (editingVisitor) {
      updateVisitorMutation.mutate({ id: editingVisitor.id, payload });
    } else {
      createVisitorMutation.mutate(payload);
    }
  };

  const handleEditVisitor = (visitor) => {
    setVisitorForm({
      visitorName: visitor.visitorName || "",
      phoneNumber: visitor.phoneNumber || visitor.phone || "",
      ID: visitor.ID || visitor.IDCard || "",
      purpose: visitor.purpose || "",
      persons: visitor.persons || 1,
      visitDate: (visitor.visitDate || visitor.date || "").split("T")[0] || new Date().toISOString().split("T")[0],
      inTime: visitor.inTime ? (visitor.inTime.includes("T") ? visitor.inTime.split("T")[1]?.slice(0, 5) : visitor.inTime.slice(0, 5)) : "",
      outTime: visitor.outTime ? (visitor.outTime.includes("T") ? visitor.outTime.split("T")[1]?.slice(0, 5) : visitor.outTime.slice(0, 5)) : "",
      remarks: visitor.remarks || "",
    });
    setEditingVisitor(visitor);
    setVisitorDialog(true);
  };

  const filteredVisitors = useMemo(
    () =>
      visitors.filter((visitor) =>
        !visitorNameSearch.trim() ||
        String(visitor.visitorName || "")
          .toLowerCase()
          .includes(visitorNameSearch.trim().toLowerCase())
      ),
    [visitors, visitorNameSearch]
  );

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Visitor Log
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={visitorNameSearch}
              onChange={(e) => setVisitorNameSearch(e.target.value)}
              placeholder="Search by name"
              className="w-full sm:w-[180px] lg:w-[220px] pl-8 h-8 sm:h-9 text-xs sm:text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-[130px] sm:w-[180px]">
              <MonthPicker
                value={visitorMonthFilter}
                onChange={(val) => setVisitorMonthFilter(val || "")}
                className="h-8 sm:h-9 text-xs"
                placeholder="All Months"
              />
            </div>
            {visitorMonthFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 sm:h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setVisitorMonthFilter("")}
                title="Clear month filter (Show all)"
              >
                All
              </Button>
            )}
          </div>
          <Dialog open={visitorDialog} onOpenChange={setVisitorDialog}>
            {canCreate && (
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={closeVisitorDialog}>
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Add Visitor
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingVisitor ? "Edit" : "New"} Visitor Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Visitor Name *</Label>
                    <Input
                      value={visitorForm.visitorName}
                      onChange={(e) =>
                        setVisitorForm({ ...visitorForm, visitorName: e.target.value })
                      }
                      placeholder="Enter visitor name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input
                      value={visitorForm.phoneNumber}
                      onChange={(e) =>
                        setVisitorForm({ ...visitorForm, phoneNumber: e.target.value })
                      }
                      placeholder="0300-1234567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ID Card *</Label>
                    <Input
                      value={visitorForm.ID}
                      onChange={(e) =>
                        setVisitorForm({ ...visitorForm, ID: e.target.value })
                      }
                      placeholder="12345-1234567-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Visit Date</Label>
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {visitorForm.visitDate
                            ? format(new Date(visitorForm.visitDate), "PPP")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            visitorForm.visitDate
                              ? new Date(visitorForm.visitDate)
                              : undefined
                          }
                          onSelect={(date) => {
                            setVisitorForm({
                              ...visitorForm,
                              visitDate: date ? date.toLocaleDateString("en-CA") : "",
                            });
                            setDateOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>In Time</Label>
                    <Input
                      type="time"
                      value={visitorForm.inTime}
                      onChange={(e) =>
                        setVisitorForm({ ...visitorForm, inTime: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Out Time</Label>
                    <Input
                      type="time"
                      value={visitorForm.outTime}
                      onChange={(e) =>
                        setVisitorForm({ ...visitorForm, outTime: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Persons</Label>
                  <Input
                    value={visitorForm.persons}
                    onChange={(e) =>
                      setVisitorForm({ ...visitorForm, persons: e.target.value })
                    }
                    placeholder="Number of visitors"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Input
                    value={visitorForm.purpose}
                    onChange={(e) =>
                      setVisitorForm({ ...visitorForm, purpose: e.target.value })
                    }
                    placeholder="Purpose of visit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={visitorForm.remarks}
                    onChange={(e) =>
                      setVisitorForm({ ...visitorForm, remarks: e.target.value })
                    }
                    placeholder="Additional notes"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeVisitorDialog}>
                  Cancel
                </Button>
                <Button onClick={handleVisitorSubmit}>
                  {editingVisitor ? "Update" : "Record"} Visit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-6 pt-0">
        {visitorsLoading ? (
          <p className="text-center py-8 text-xs sm:text-sm text-muted-foreground">Loading visitors...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell py-2 px-3 text-sm">Date</TableHead>
                <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Visitor / Purpose</TableHead>
                <TableHead className="hidden md:table-cell py-2 px-3 text-sm">Phone</TableHead>
                <TableHead className="hidden lg:table-cell py-2 px-3 text-sm">Purpose</TableHead>
                <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm text-right sm:text-left">In/Out Time</TableHead>
                <TableHead className="hidden md:table-cell py-2 px-3 text-sm">Out Time</TableHead>
                <TableHead className="hidden xl:table-cell py-2 px-3 text-sm">Persons</TableHead>
                <TableHead className="hidden sm:table-cell py-2 px-3 text-sm text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisitors.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 px-3 text-xs sm:text-sm text-center text-muted-foreground"
                  >
                    No visitors recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filteredVisitors.map((visitor) => (
                  <TableRow
                    key={visitor.id || visitor._id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() =>
                      setViewDetailsDialog({
                        open: true,
                        data: {
                          ...visitor,
                          phone: visitor.phoneNumber || visitor.phone,
                          phoneNumber: visitor.phoneNumber || visitor.phone,
                          IDCard: visitor.ID || visitor.IDCard,
                          ID: visitor.ID || visitor.IDCard,
                          date: (visitor.visitDate || visitor.date || visitor.createdAt || "").split("T")[0],
                          visitDate: (visitor.visitDate || visitor.date || visitor.createdAt || "").split("T")[0],
                          inTime: formatTimeSafe(visitor.inTime),
                          outTime: formatTimeSafe(visitor.outTime),
                        },
                      })
                    }
                  >
                    <TableCell className="hidden sm:table-cell py-2 px-3 text-sm">
                      {(visitor.visitDate || visitor.date || visitor.createdAt || "").split("T")[0]}
                    </TableCell>
                    <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium">
                      <div className="font-semibold text-foreground">{visitor.visitorName}</div>
                      <div className="text-[11px] text-muted-foreground sm:hidden mt-0.5 line-clamp-1">
                        {visitor.purpose || "Visit"} {visitor.persons ? `(${visitor.persons} pers.)` : ""}
                      </div>
                      <div className="text-[10px] text-muted-foreground sm:hidden mt-0.5">
                        {(visitor.visitDate || visitor.date || visitor.createdAt || "").split("T")[0]} · {visitor.phoneNumber || visitor.phone || ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-2 px-3 text-sm">{visitor.phoneNumber || visitor.phone || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell py-2 px-3 text-sm font-medium truncate max-w-[130px] overflow-hidden whitespace-nowrap">
                      {visitor.purpose || "-"}
                    </TableCell>
                    <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm text-right sm:text-left">
                      <div className="font-mono text-xs">
                        {formatTimeSafe(visitor.inTime)}
                        {visitor.outTime ? ` - ${formatTimeSafe(visitor.outTime)}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-2 px-3 text-sm">
                      {formatTimeSafe(visitor.outTime)}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell py-2 px-3 text-sm">{visitor.persons || 1}</TableCell>
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
                                  data: {
                                    ...visitor,
                                    phone: visitor.phoneNumber || visitor.phone,
                                    phoneNumber: visitor.phoneNumber || visitor.phone,
                                    IDCard: visitor.ID || visitor.IDCard,
                                    ID: visitor.ID || visitor.IDCard,
                                    date: (visitor.visitDate || visitor.date || visitor.createdAt || "").split("T")[0],
                                    visitDate: (visitor.visitDate || visitor.date || visitor.createdAt || "").split("T")[0],
                                    inTime: formatTimeSafe(visitor.inTime),
                                    outTime: formatTimeSafe(visitor.outTime),
                                  },
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
                                onClick={() => handleEditVisitor(visitor)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Visitor</TooltipContent>
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
                                    id: visitor.id || visitor._id,
                                    name: visitor.visitorName,
                                  })
                                }
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Visitor</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Visitor Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the visitor entry for{" "}
              <strong className="text-foreground">{deleteDialog.name || "this visitor"}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVisitorMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteVisitorMutation.isPending}
              onClick={() => deleteVisitorMutation.mutate(deleteDialog.id)}
            >
              {deleteVisitorMutation.isPending ? "Deleting..." : "Delete"}
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
              Visitor Information
            </DialogTitle>
          </DialogHeader>
          {viewDetailsDialog.data && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Visitor Name
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.visitorName}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Phone
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.phoneNumber || viewDetailsDialog.data.phone || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    ID Card
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.ID || viewDetailsDialog.data.IDCard || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Visit Date
                  </h4>
                  <div className="text-sm font-medium">
                    {(viewDetailsDialog.data.visitDate || viewDetailsDialog.data.date)?.split("T")[0] || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    In Time
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.inTime || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Out Time
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.outTime || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Persons
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.persons || "1"}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Purpose
                  </h4>
                  <div className="text-sm font-medium">
                    {viewDetailsDialog.data.purpose || "—"}
                  </div>
                </div>
              </div>
              {viewDetailsDialog.data.remarks && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="text-sm font-semibold">Remarks</h4>
                  <div className="bg-muted/30 p-4 rounded-md text-sm leading-relaxed whitespace-pre-wrap">
                    {viewDetailsDialog.data.remarks}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
