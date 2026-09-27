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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getLeaves,
  createLeave,
  updateLeave,
  searchStudents,
} from "../../../config/apis";
import { extractId } from "@/lib/utils.jsx";

export default function LeaveTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Attendance", "leave");

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);

  const [leaveFormData, setLeaveFormData] = useState({
    applicantType: "STUDENT",
    studentId: "",
    leaveType: "CASUAL",
    reason: "",
    fromDate: new Date().toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
  });

  // Student Search state
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const monthQueryParam = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

  // Queries - fetch only STUDENT leaves for the selected month/year
  const { data: leavesData = { data: [], total: 0 }, refetch: refetchLeaves, isLoading } = useQuery({
    queryKey: ["leaves", "STUDENT", monthQueryParam],
    queryFn: () => getLeaves({ pageParam: 1, type: "STUDENT", month: monthQueryParam }),
  });

  const createLeaveMutation = useMutation({
    mutationFn: createLeave,
    onSuccess: () => {
      toast({ title: "Student leave request submitted successfully" });
      refetchLeaves();
      queryClient.invalidateQueries({ queryKey: ["studentAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      setLeaveOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Failed to submit leave", description: error.message, variant: "destructive" });
    },
  });

  const updateLeaveMutation = useMutation({
    mutationFn: ({ id, status }) => updateLeave(id, status),
    onSuccess: () => {
      toast({ title: "Leave status updated successfully" });
      refetchLeaves();
      queryClient.invalidateQueries({ queryKey: ["studentAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (error) => {
      toast({ title: "Failed to update leave", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setLeaveFormData({
      applicantType: "STUDENT",
      studentId: "",
      leaveType: "CASUAL",
      reason: "",
      fromDate: new Date().toISOString().split("T")[0],
      toDate: new Date().toISOString().split("T")[0],
    });
    setStudentSearchQuery("");
    setSearchResults([]);
    setSelectedStudent(null);
  };

  const handleStudentSearch = async (query) => {
    setStudentSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchStudents(query);
      setSearchResults(results || []);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStudent = (student) => {
    const sid = extractId(student.id || student._id);
    setSelectedStudent(student);
    setLeaveFormData((prev) => ({
      ...prev,
      studentId: sid,
      applicantType: "STUDENT",
    }));
    setStudentSearchQuery(`${student.rollNumber} - ${student.fName} ${student.lName || ""}`.trim());
    setSearchResults([]);
  };

  const calculateDays = (from, to) => {
    if (!from || !to) return 1;
    const f = new Date(from);
    const t = new Date(to);
    const diff = Math.round(Math.abs(t - f) / (1000 * 60 * 60 * 24)) + 1;
    return isNaN(diff) || diff < 1 ? 1 : diff;
  };

  const handleSubmitLeave = () => {
    if (!leaveFormData.studentId) {
      toast({ title: "Please select a student", variant: "destructive" });
      return;
    }
    if (!leaveFormData.reason || !leaveFormData.fromDate || !leaveFormData.toDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const days = calculateDays(leaveFormData.fromDate, leaveFormData.toDate);
    const payload = {
      applicantType: "STUDENT",
      studentId: leaveFormData.studentId,
      fromDate: leaveFormData.fromDate,
      toDate: leaveFormData.toDate,
      days,
      reason: leaveFormData.reason,
      leaveType: leaveFormData.leaveType || "CASUAL",
    };

    createLeaveMutation.mutate(payload);
  };

  const rawLeaves = Array.isArray(leavesData?.data)
    ? leavesData.data
    : Array.isArray(leavesData)
    ? leavesData
    : [];

  const leaveList = rawLeaves.filter(
    (leave) => (leave.applicantType ? leave.applicantType === "STUDENT" : !leave.staffId)
  );

  const filteredLeaves = leaveList.filter((leave) => {
    // Status filter
    if (statusFilter !== "ALL" && (leave.status || "PENDING").toUpperCase() !== statusFilter) {
      return false;
    }
    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const s = leave.student || (typeof leave.studentId === "object" ? leave.studentId : null);
      const studentName = s ? `${s.fName || ""} ${s.lName || ""}`.toLowerCase() : "";
      const roll = (s?.rollNumber || "").toLowerCase();
      const className = (s?.class?.name || "").toLowerCase();
      const reason = (leave.reason || "").toLowerCase();
      if (!studentName.includes(q) && !roll.includes(q) && !className.includes(q) && !reason.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Student Leave Requests</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Review and manage student leave requests, synchronized with student attendance
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setLeaveOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Submit Student Leave
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name, roll no, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Month:</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-32 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Year:</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-24 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 15 }, (_, i) => 2020 + i).map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 h-9 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm">Student</TableHead>
                  <TableHead className="hidden md:table-cell py-2.5 px-3 text-sm">Class & Roll</TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm">Leave Type</TableHead>
                  <TableHead className="hidden lg:table-cell py-2.5 px-3 text-sm">Period</TableHead>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm text-right sm:text-center">Days</TableHead>
                  <TableHead className="hidden xl:table-cell py-2.5 px-3 text-sm">Reason</TableHead>
                  <TableHead className="py-2.5 px-2.5 sm:px-3 text-xs sm:text-sm text-center">Status</TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading student leave requests...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No student leave requests found matching the criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeaves.map((leave) => {
                    const s = leave.student || (typeof leave.studentId === "object" ? leave.studentId : null);
                    const displayName = s ? `${s.fName || ""} ${s.lName || ""}`.trim() : "Student";
                    const details = `${s?.rollNumber ? `Roll: ${s.rollNumber}` : ""} ${s?.class?.name ? `(${s.class.name})` : ""}`.trim();
                    const leaveId = leave.id || leave._id;
                    const days = leave.days || calculateDays(leave.fromDate, leave.toDate);

                    return (
                      <TableRow
                        key={leaveId}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setSelectedLeave({ leave, displayName, details, days, leaveId })}
                      >
                        <TableCell className="py-2.5 px-3 text-xs sm:text-sm font-medium">
                          <div className="font-semibold text-foreground">{displayName}</div>
                          {details && (
                            <div className="text-[11px] text-muted-foreground sm:hidden mt-0.5">
                              {details}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground sm:hidden">
                            {leave.fromDate} {leave.toDate && leave.toDate !== leave.fromDate ? `→ ${leave.toDate}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-2.5 px-3 text-sm text-muted-foreground text-xs">
                          {details || "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2.5 px-3 text-sm">
                          <Badge
                            variant="outline"
                            className={
                              leave.leaveType === "SICK"
                                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                : leave.leaveType === "ANNUAL"
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {leave.leaveType === "SICK" ? "Sick" : leave.leaveType === "ANNUAL" ? "Annual" : "Casual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell py-2.5 px-3 text-sm whitespace-nowrap">
                          {leave.fromDate} {leave.toDate && leave.toDate !== leave.fromDate ? `to ${leave.toDate}` : ""}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-xs sm:text-sm text-right sm:text-center font-medium font-mono">
                          {days} {days === 1 ? "day" : "days"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell py-2.5 px-3 text-sm max-w-[180px] truncate">
                          {leave.reason || "—"}
                        </TableCell>
                        <TableCell className="py-2.5 px-2.5 sm:px-3 text-center">
                          <Badge
                            className={`text-[10px] sm:text-xs ${
                              leave.status === "APPROVED"
                                ? "bg-green-600 hover:bg-green-600"
                                : leave.status === "REJECTED"
                                ? "bg-red-600 hover:bg-red-600"
                                : "bg-amber-500 hover:bg-amber-500"
                            }`}
                          >
                            {leave.status || "PENDING"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2.5 px-3 text-sm text-right">
                          {canUpdate && leave.status === "PENDING" ? (
                            <div className="flex gap-1.5 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmAction({
                                    id: leaveId,
                                    status: "APPROVED",
                                    applicantName: displayName,
                                    leaveType: leave.leaveType || "CASUAL",
                                    fromDate: leave.fromDate,
                                    toDate: leave.toDate,
                                  });
                                }}
                                disabled={updateLeaveMutation.isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmAction({
                                    id: leaveId,
                                    status: "REJECTED",
                                    applicantName: displayName,
                                    leaveType: leave.leaveType || "CASUAL",
                                    fromDate: leave.fromDate,
                                    toDate: leave.toDate,
                                  });
                                }}
                                disabled={updateLeaveMutation.isPending}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
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

      {/* Leave Request Dialog */}
      <Dialog
        open={leaveOpen}
        onOpenChange={(val) => {
          if (createLeaveMutation.isPending) return;
          setLeaveOpen(val);
          if (!val) resetForm();
        }}
      >
        <DialogContent
          className="max-w-lg"
          onPointerDownOutside={(e) => createLeaveMutation.isPending && e.preventDefault()}
          onEscapeKeyDown={(e) => createLeaveMutation.isPending && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Submit Student Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Student Search Section */}
            <div className="space-y-2">
              <Label>Search Student (by name or roll number)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Type student name or roll number..."
                  value={studentSearchQuery}
                  onChange={(e) => handleStudentSearch(e.target.value)}
                  className="pl-9"
                  disabled={createLeaveMutation.isPending}
                />
              </div>
              {isSearching && <p className="text-xs text-muted-foreground">Searching...</p>}
              {searchResults.length > 0 && (
                <div className="border rounded-md max-h-44 overflow-y-auto divide-y">
                  {searchResults.map((student) => (
                    <div
                      key={student.id || student._id}
                      onClick={() => handleSelectStudent(student)}
                      className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                    >
                      <p className="font-medium">{student.rollNumber} - {student.fName} {student.lName || ""}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.class?.name || "No Class"} {student.section && `- Section ${student.section.name}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <div className="p-2.5 bg-accent/60 border rounded-md text-xs">
                  <p className="font-medium text-foreground">
                    Selected: {selectedStudent.rollNumber} - {selectedStudent.fName} {selectedStudent.lName || ""}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedStudent.class?.name || ""} {selectedStudent.section && `- Section ${selectedStudent.section.name}`}
                  </p>
                </div>
              )}
            </div>

            {/* Leave Type (Casual, Sick, Annual) */}
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select
                value={leaveFormData.leaveType}
                onValueChange={(val) => setLeaveFormData({ ...leaveFormData, leaveType: val })}
                disabled={createLeaveMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASUAL">Casual Leave</SelectItem>
                  <SelectItem value="SICK">Sick Leave</SelectItem>
                  <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={leaveFormData.fromDate}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, fromDate: e.target.value })}
                  disabled={createLeaveMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={leaveFormData.toDate}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, toDate: e.target.value })}
                  disabled={createLeaveMutation.isPending}
                />
              </div>
            </div>

            {/* Days duration helper */}
            <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded flex items-center justify-between">
              <span>Total Duration:</span>
              <span className="font-semibold text-foreground">
                {calculateDays(leaveFormData.fromDate, leaveFormData.toDate)} day(s)
              </span>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={leaveFormData.reason}
                onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                placeholder="Enter detailed reason for leave..."
                rows={3}
                disabled={createLeaveMutation.isPending}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setLeaveOpen(false)}
                disabled={createLeaveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitLeave}
                disabled={createLeaveMutation.isPending}
              >
                {createLeaveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Details Dialog */}
      <Dialog open={!!selectedLeave} onOpenChange={(open) => !open && setSelectedLeave(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-3 text-xs sm:text-sm pt-2">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Student:</span>
                <span className="font-semibold text-foreground">{selectedLeave.displayName}</span>
              </div>
              {selectedLeave.details && (
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Class & Roll:</span>
                  <span>{selectedLeave.details}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Leave Type:</span>
                <Badge variant="outline" className="text-xs">
                  {selectedLeave.leave.leaveType || "Casual"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Period:</span>
                <span>
                  {selectedLeave.leave.fromDate} {selectedLeave.leave.toDate && selectedLeave.leave.toDate !== selectedLeave.leave.fromDate ? `to ${selectedLeave.leave.toDate}` : ""}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-semibold">{selectedLeave.days} {selectedLeave.days === 1 ? "day" : "days"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Status:</span>
                <Badge
                  className={`text-xs ${
                    selectedLeave.leave.status === "APPROVED"
                      ? "bg-green-600 hover:bg-green-600"
                      : selectedLeave.leave.status === "REJECTED"
                      ? "bg-red-600 hover:bg-red-600"
                      : "bg-amber-500 hover:bg-amber-500"
                  }`}
                >
                  {selectedLeave.leave.status || "PENDING"}
                </Badge>
              </div>
              {selectedLeave.leave.reason && (
                <div className="py-1.5 border-b">
                  <span className="text-muted-foreground block mb-1">Reason:</span>
                  <p className="text-xs bg-muted/40 p-2.5 rounded border leading-relaxed">
                    {selectedLeave.leave.reason}
                  </p>
                </div>
              )}
              {canUpdate && selectedLeave.leave.status === "PENDING" && (
                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      const item = selectedLeave;
                      setSelectedLeave(null);
                      setConfirmAction({
                        id: item.leaveId,
                        status: "APPROVED",
                        applicantName: item.displayName,
                        leaveType: item.leave.leaveType || "CASUAL",
                        fromDate: item.leave.fromDate,
                        toDate: item.leave.toDate,
                      });
                    }}
                  >
                    Approve Request
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => {
                      const item = selectedLeave;
                      setSelectedLeave(null);
                      setConfirmAction({
                        id: item.leaveId,
                        status: "REJECTED",
                        applicantName: item.displayName,
                        leaveType: item.leave.leaveType || "CASUAL",
                        fromDate: item.leave.fromDate,
                        toDate: item.leave.toDate,
                      });
                    }}
                  >
                    Reject Request
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Approve / Reject */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open && !updateLeaveMutation.isPending) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.status === "APPROVED"
                ? `Approve Leave Request (${confirmAction?.leaveType || "Leave"})?`
                : "Reject Leave Request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.status === "APPROVED"
                ? `Are you sure you want to approve the ${confirmAction?.leaveType || ""} leave for ${
                    confirmAction?.applicantName
                  } from ${confirmAction?.fromDate} to ${
                    confirmAction?.toDate || confirmAction?.fromDate
                  }? This will automatically mark their Student Attendance as LEAVE.`
                : `Are you sure you want to reject the leave request for ${confirmAction?.applicantName}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateLeaveMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction) {
                  updateLeaveMutation.mutate({
                    id: confirmAction.id,
                    status: confirmAction.status,
                  });
                  setConfirmAction(null);
                }
              }}
              className={
                confirmAction?.status === "APPROVED"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }
              disabled={updateLeaveMutation.isPending}
            >
              {updateLeaveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {confirmAction?.status === "APPROVED" ? "Yes, Approve" : "Yes, Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
