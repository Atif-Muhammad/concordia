import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
  CommandItem,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  DollarSign,
  Edit,
  Trash2,
  Clock,
  ChevronsUpDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import {
  getAdvanceSalaries,
  createAdvanceSalary,
  updateAdvanceSalary,
  deleteAdvanceSalary,
  getAllStaff,
  getPayrollSheet,
} from "@/services/api";
import { extractId } from "@/lib/utils.jsx";
import { MonthPicker } from "@/components/ui/month-picker";

const formatPayrollMonthLabel = (value) => {
  if (!value || typeof value !== "string") return "";
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return value;
  return format(new Date(y, m - 1, 1), "MMM yyyy");
};

const getPayrollAdjustedMeta = (advance) => {
  if (advance?.adjustedSource === "PAYROLL") {
    const events = Array.isArray(advance?.actionAudit) ? advance.actionAudit : [];
    const payrollEvent = [...events].reverse().find((e) => e?.action === "ADJUSTED_IN_PAYROLL");
    return {
      by: payrollEvent?.byName || "System",
      month: payrollEvent?.month || advance?.month,
      at: payrollEvent?.at ? new Date(payrollEvent.at).toLocaleString() : "",
    };
  }
  if (advance?.adjustedSource === "MANUAL") return null;
  const events = Array.isArray(advance?.actionAudit) ? advance.actionAudit : [];
  const payrollEvent = [...events].reverse().find((e) => e?.action === "ADJUSTED_IN_PAYROLL");
  if (!payrollEvent) return null;
  return {
    by: payrollEvent.byName || "System",
    month: payrollEvent.month || advance?.month,
    at: payrollEvent.at ? new Date(payrollEvent.at).toLocaleString() : "",
  };
};

export const AdvanceSalaryTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("HR & Payroll", "advance");

  const [advanceRoleFilter, setAdvanceRoleFilter] = useState("all");
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState(null);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [advanceComboOpen, setAdvanceComboOpen] = useState(false);
  const [advanceStaffSearch, setAdvanceStaffSearch] = useState("");
  const [advanceFormData, setAdvanceFormData] = useState({
    staffId: "",
    month: new Date().toISOString().slice(0, 7),
    releaseDate: new Date().toISOString().split("T")[0],
    amount: 0,
    remarks: "",
    adjusted: false,
  });

  const { data: allStaffData = [] } = useQuery({
    queryKey: ["allStaffStats"],
    queryFn: () => getAllStaff({ status: "ACTIVE" }),
  });

  const advanceStaffOptions = useMemo(() => {
    const unique = new Map();
    (allStaffData || []).forEach((s) => {
      const sId = extractId(s?.id || s?._id);
      if (!sId || unique.has(sId)) return;
      const name = String(s.name || "").trim();
      if (!name) return;
      const role = s.isTeaching && s.isNonTeaching ? "Dual" : s.isTeaching ? "Teaching" : "Non-Teaching";
      const roleDetail = s.designation || "Staff";
      unique.set(sId, {
        id: sId,
        label: `${name} - ${role} - ${roleDetail}`,
        searchText: `${name} ${role} ${roleDetail}`.toLowerCase(),
      });
    });
    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allStaffData]);

  const { data: advanceSalaries = [] } = useQuery({
    queryKey: ["advanceSalaries", advanceRoleFilter],
    queryFn: () => getAdvanceSalaries(undefined, advanceRoleFilter),
  });

  // Fetch payroll sheet for selected month to validate and display payroll details
  const { data: targetMonthPayrollSheet = [], isLoading: isCheckingPayroll } = useQuery({
    queryKey: ["payrollSheet", advanceFormData.month, "all"],
    queryFn: () => getPayrollSheet(advanceFormData.month, "all"),
    enabled: advanceOpen && !!advanceFormData.month,
  });

  const selectedStaffPayroll = useMemo(() => {
    if (!advanceFormData.staffId || !Array.isArray(targetMonthPayrollSheet) || targetMonthPayrollSheet.length === 0) {
      return null;
    }
    const targetSid = String(extractId(advanceFormData.staffId));
    return targetMonthPayrollSheet.find(
      (r) =>
        String(r.id) === targetSid ||
        String(r.staffIdRaw) === targetSid ||
        String(r.staffId?._id) === targetSid ||
        String(r.staffId?.id) === targetSid ||
        String(r.staffId) === targetSid
    ) || null;
  }, [advanceFormData.staffId, targetMonthPayrollSheet]);

  const isSalaryAlreadyPaid = useMemo(() => {
    if (!selectedStaffPayroll) return false;
    return selectedStaffPayroll.status === "PAID";
  }, [selectedStaffPayroll]);

  const createAdvanceMutation = useMutation({
    mutationFn: createAdvanceSalary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advanceSalaries"] });
      queryClient.invalidateQueries({ queryKey: ["payrollSheet"] });
      toast({ title: "Advance salary created successfully" });
      setAdvanceOpen(false);
      setAdvanceFormData({
        staffId: "",
        month: new Date().toISOString().slice(0, 7),
        releaseDate: new Date().toISOString().split("T")[0],
        amount: 0,
        remarks: "",
        adjusted: false,
      });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateAdvanceMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdvanceSalary(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advanceSalaries"] });
      queryClient.invalidateQueries({ queryKey: ["payrollSheet"] });
      toast({ title: "Advance salary updated successfully" });
      setAdvanceOpen(false);
      setEditingAdvance(null);
      setAdvanceFormData({
        staffId: "",
        month: new Date().toISOString().slice(0, 7),
        releaseDate: new Date().toISOString().split("T")[0],
        amount: 0,
        remarks: "",
        adjusted: false,
      });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteAdvanceMutation = useMutation({
    mutationFn: deleteAdvanceSalary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advanceSalaries"] });
      queryClient.invalidateQueries({ queryKey: ["payrollSheet"] });
      toast({ title: "Advance salary deleted successfully" });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleAddAdvance = () => {
    if (!advanceFormData.staffId || !advanceFormData.amount) {
      toast({
        title: "Please fill required fields",
        variant: "destructive",
      });
      return;
    }
    if (isSalaryAlreadyPaid) {
      toast({
        title: "Salary Already Paid",
        description: `Cannot issue or update advance: salary for ${formatPayrollMonthLabel(advanceFormData.month)} has already been paid to this staff member.`,
        variant: "destructive",
      });
      return;
    }
    const payload = {
      staffId: extractId(advanceFormData.staffId),
      month: advanceFormData.month,
      releaseDate: advanceFormData.releaseDate || new Date().toISOString().split("T")[0],
      amount: parseFloat(advanceFormData.amount) || 0,
      remarks: advanceFormData.remarks || "",
      adjusted: advanceFormData.adjusted,
    };
    if (editingAdvance) {
      updateAdvanceMutation.mutate({ id: editingAdvance.id, payload });
    } else {
      createAdvanceMutation.mutate(payload);
    }
  };

  const handleEditAdvance = (advance) => {
    setEditingAdvance(advance);
    const sid = extractId(advance.staffId?.id || advance.staffId?._id || advance.staffId || "");
    setAdvanceFormData({
      staffId: sid,
      month: advance.month || advance.deductionMonth || new Date().toISOString().slice(0, 7),
      releaseDate: advance.releaseDate || advance.requestDate || new Date().toISOString().split("T")[0],
      amount: advance.amount || 0,
      remarks: advance.remarks || advance.reason || "",
      adjusted: !!advance.adjusted,
    });
    setAdvanceOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-base sm:text-lg">Advance Salary</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">Manage advance salary requests for all staff</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1.5">
                <Label className="hidden sm:inline text-xs sm:text-sm">Role:</Label>
                <Select value={advanceRoleFilter} onValueChange={setAdvanceRoleFilter}>
                  <SelectTrigger className="w-28 sm:w-40 h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="All Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    <SelectItem value="teacher">Teachers</SelectItem>
                    <SelectItem value="employee">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canCreate && (
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setAdvanceOpen(true)}>
                  <DollarSign className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Add Advance
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Staff Name</TableHead>
                  <TableHead className="hidden md:table-cell py-2 px-3 text-sm">Role / Designation</TableHead>
                  <TableHead className="hidden sm:table-cell py-2 px-3 text-sm">Deduction Month</TableHead>
                  <TableHead className="hidden lg:table-cell py-2 px-3 text-sm">Date of Release</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm text-right">Amount</TableHead>
                  <TableHead className="hidden xl:table-cell py-2 px-3 text-sm">Remarks</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Adjusted</TableHead>
                  <TableHead className="hidden sm:table-cell py-2 px-3 text-sm text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advanceSalaries?.map((advance) => (
                  <TableRow
                    key={advance.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelectedAdvance(advance)}
                  >
                    <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium">
                      <div className="font-semibold text-foreground">{advance.staff?.name || "N/A"}</div>
                      <div className="text-[11px] text-muted-foreground sm:hidden mt-0.5">
                        {advance.staff?.isTeaching ?
                          (advance.staff?.specialization ? `Teacher (${advance.staff?.specialization})` : 'Teacher') :
                          (advance.staff?.designation || "Staff")} · {formatPayrollMonthLabel(advance.month) || advance.month}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-2 px-3 text-sm">
                      <div className="text-xs">
                        {advance.staff?.isTeaching ?
                          (advance.staff?.specialization ? `Teacher (${advance.staff?.specialization})` : 'Teacher') :
                          (advance.staff?.designation || "Staff")}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-2 px-3 text-sm">{formatPayrollMonthLabel(advance.month) || advance.month}</TableCell>
                    <TableCell className="hidden lg:table-cell py-2 px-3 text-sm">
                      {advance.releaseDate ? (() => {
                        try {
                          return format(new Date(advance.releaseDate), "dd MMM yyyy");
                        } catch (e) {
                          return advance.releaseDate;
                        }
                      })() : "-"}
                    </TableCell>
                    <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold text-primary font-mono text-right">
                      PKR {Number(advance.amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell py-2 px-3 text-sm max-w-[200px]">
                      <div className="truncate">{advance.remarks || "-"}</div>
                      <div className="mt-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Clock className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs whitespace-pre-line max-w-[320px]">
                            {(() => {
                              const events = Array.isArray(advance.actionAudit) ? advance.actionAudit : [];
                              if (!events.length) return "No audit yet";
                              return events
                                .slice(-4)
                                .reverse()
                                .map((e) => `${e.action || "UPDATED"} - ${e.byName || "System"} - ${e.at ? new Date(e.at).toLocaleString() : ""}`)
                                .join("\n");
                            })()}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm">
                      {advance.adjusted ? (
                        <div className="space-y-1">
                          <Badge variant="default" className="bg-green-600 text-[11px] px-1.5 py-0.5">Adjusted</Badge>
                          {getPayrollAdjustedMeta(advance) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="hidden sm:inline-flex cursor-help text-[10px]">
                                  Adjusted via payroll ({formatPayrollMonthLabel(getPayrollAdjustedMeta(advance).month)})
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                {`By ${getPayrollAdjustedMeta(advance).by}${getPayrollAdjustedMeta(advance).at ? ` on ${getPayrollAdjustedMeta(advance).at}` : ""}`}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-2 px-3 text-sm text-right">
                      <div className="flex justify-end space-x-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditAdvance(advance);
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
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this record?")) {
                                    deleteAdvanceMutation.mutate(advance.id);
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
                {(!advanceSalaries || advanceSalaries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-2 px-3 text-sm text-center text-muted-foreground italic">
                      No advance salary records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={advanceOpen} onOpenChange={(val) => {
        if (createAdvanceMutation.isPending || updateAdvanceMutation.isPending) return;
        setAdvanceOpen(val);
        if (!val) {
          setEditingAdvance(null);
          setAdvanceStaffSearch("");
          setAdvanceComboOpen(false);
          setAdvanceFormData({
            staffId: "",
            month: new Date().toISOString().slice(0, 7),
            releaseDate: new Date().toISOString().split("T")[0],
            amount: 0,
            remarks: "",
            adjusted: false,
          });
        }
      }}>
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => {
            if (createAdvanceMutation.isPending || updateAdvanceMutation.isPending) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (createAdvanceMutation.isPending || updateAdvanceMutation.isPending) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{editingAdvance ? "Edit Advance Salary" : "Add Advance Salary"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="mb-2 block">Select Staff Member *</Label>
              <Popover open={advanceComboOpen} onOpenChange={setAdvanceComboOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className={advanceFormData.staffId ? "" : "text-muted-foreground"}>
                      {advanceFormData.staffId ? (() => { const found = advanceStaffOptions.find(s => s.id.toString() === advanceFormData.staffId); return found ? found.label : "Select staff member"; })() : "Select staff member"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search staff..."
                      value={advanceStaffSearch}
                      onValueChange={setAdvanceStaffSearch}
                    />
                    <CommandEmpty>No staff found</CommandEmpty>
                    <CommandList>
                      {advanceStaffOptions.filter(s => s.searchText.includes((advanceStaffSearch || "").toLowerCase())).map(staff => (
                        <CommandItem
                          key={staff.id}
                          value={staff.id.toString()}
                          className="cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground"
                          onSelect={() => {
                            setAdvanceFormData({ ...advanceFormData, staffId: staff.id.toString() });
                            setAdvanceStaffSearch("");
                            setAdvanceComboOpen(false);
                          }}
                        >
                          {staff.label}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="mb-2 block">Deduction Month *</Label>
              <MonthPicker
                value={advanceFormData.month}
                onChange={(val) =>
                  setAdvanceFormData({
                    ...advanceFormData,
                    month: val,
                  })
                }
              />
            </div>

            {/* Payroll Status & Month Details */}
            {advanceFormData.staffId && advanceFormData.month && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Payroll Details ({formatPayrollMonthLabel(advanceFormData.month)})
                  </span>
                  {isCheckingPayroll ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                    </span>
                  ) : selectedStaffPayroll ? (
                    <Badge
                      variant={
                        selectedStaffPayroll.status === "PAID"
                          ? "default"
                          : String(selectedStaffPayroll.status || "").toLowerCase().includes("partia")
                          ? "secondary"
                          : "outline"
                      }
                      className={
                        selectedStaffPayroll.status === "PAID"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2 py-0.5"
                          : String(selectedStaffPayroll.status || "").toLowerCase().includes("partia")
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] px-2 py-0.5"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-[10px] px-2 py-0.5"
                      }
                    >
                      {selectedStaffPayroll.status === "PAID"
                        ? "SALARY PAID"
                        : selectedStaffPayroll.status || "PENDING"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5">
                      Payroll Not Generated
                    </Badge>
                  )}
                </div>

                {selectedStaffPayroll ? (
                  <div className="space-y-1.5 pt-1.5 border-t border-border/60">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Basic Salary:</span>
                        <span className="font-medium text-foreground">
                          PKR {Number(selectedStaffPayroll.basicSalary || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total Allowances:</span>
                        <span className="font-medium text-foreground">
                          PKR {Number(selectedStaffPayroll.totalAllowances || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Other Deductions:</span>
                        <span className="font-medium text-foreground">
                          PKR {Number(selectedStaffPayroll.totalDeductions || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Advance Deducted:</span>
                        <span className="font-medium text-primary">
                          PKR {Number(selectedStaffPayroll.advanceDeduction || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-border/50 pt-1.5 flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">Net Salary:</span>
                      <span className="font-bold text-foreground">
                        PKR {Number(selectedStaffPayroll.netSalary || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                      <span>Paid: PKR {Number(selectedStaffPayroll.paidAmount || 0).toLocaleString()}</span>
                      <span className="font-semibold text-foreground">
                        Remaining Bal: PKR {Number(selectedStaffPayroll.balanceAmount || 0).toLocaleString()}
                      </span>
                    </div>

                    {isSalaryAlreadyPaid && (
                      <div className="mt-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                        <div>
                          <strong>Cannot generate advance:</strong> Salary for {formatPayrollMonthLabel(advanceFormData.month)} has already been marked as <strong>PAID</strong> for this staff member.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    No payroll sheet generated yet for {formatPayrollMonthLabel(advanceFormData.month)}. When payroll is generated, this advance salary will automatically be adjusted.
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="mb-2 block">Date of Release *</Label>
              <Input
                type="date"
                value={advanceFormData.releaseDate || ""}
                onChange={(e) =>
                  setAdvanceFormData({
                    ...advanceFormData,
                    releaseDate: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label className="mb-2 block">Amount (PKR) *</Label>
              <Input
                type="number"
                value={advanceFormData.amount}
                disabled={isSalaryAlreadyPaid}
                onChange={e => setAdvanceFormData({
                  ...advanceFormData,
                  amount: parseFloat(e.target.value) || 0,
                })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Remarks</Label>
              <Textarea
                placeholder="Optional remarks..."
                value={advanceFormData.remarks}
                disabled={isSalaryAlreadyPaid}
                onChange={e => setAdvanceFormData({
                  ...advanceFormData,
                  remarks: e.target.value,
                })}
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="adjusted"
                className="h-4 w-4 rounded border-gray-300"
                disabled={isSalaryAlreadyPaid}
                checked={advanceFormData.adjusted || false}
                onChange={e => setAdvanceFormData({
                  ...advanceFormData,
                  adjusted: e.target.checked,
                })}
              />
              <Label htmlFor="adjusted" className="cursor-pointer font-medium text-sm">Mark as Adjusted (Deducted from payroll)</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              disabled={createAdvanceMutation.isPending || updateAdvanceMutation.isPending}
              onClick={() => setAdvanceOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAdvance}
              disabled={
                createAdvanceMutation.isPending ||
                updateAdvanceMutation.isPending ||
                !advanceFormData.staffId ||
                !advanceFormData.amount ||
                isSalaryAlreadyPaid ||
                isCheckingPayroll
              }
              className={isSalaryAlreadyPaid ? "opacity-50 cursor-not-allowed" : ""}
            >
              {(createAdvanceMutation.isPending || updateAdvanceMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingAdvance ? "Update Advance" : "Save Advance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advance Salary Details Dialog */}
      <Dialog open={!!selectedAdvance} onOpenChange={(open) => !open && setSelectedAdvance(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Advance Salary Details</DialogTitle>
          </DialogHeader>
          {selectedAdvance && (
            <div className="space-y-3 text-xs sm:text-sm pt-2">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Staff Name:</span>
                <span className="font-semibold text-foreground">{selectedAdvance.staff?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Role / Designation:</span>
                <span>
                  {selectedAdvance.staff?.isTeaching ?
                    (selectedAdvance.staff?.specialization ? `Teacher (${selectedAdvance.staff?.specialization})` : 'Teacher') :
                    (selectedAdvance.staff?.designation || "Staff")}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-primary font-mono text-sm">
                  PKR {Number(selectedAdvance.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Deduction Month:</span>
                <span className="font-medium">{formatPayrollMonthLabel(selectedAdvance.month) || selectedAdvance.month}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Release Date:</span>
                <span>
                  {selectedAdvance.releaseDate ? (() => {
                    try {
                      return format(new Date(selectedAdvance.releaseDate), "dd MMM yyyy");
                    } catch (e) {
                      return selectedAdvance.releaseDate;
                    }
                  })() : "-"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Status:</span>
                {selectedAdvance.adjusted ? (
                  <Badge variant="default" className="bg-green-600">Adjusted</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </div>
              {selectedAdvance.remarks && (
                <div className="py-1.5 border-b">
                  <span className="text-muted-foreground block mb-1">Remarks:</span>
                  <p className="text-xs bg-muted/40 p-2 rounded border">{selectedAdvance.remarks}</p>
                </div>
              )}
              <div className="pt-2 flex justify-end gap-2">
                {canUpdate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const adv = selectedAdvance;
                      setSelectedAdvance(null);
                      handleEditAdvance(adv);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const id = selectedAdvance.id;
                      if (confirm("Are you sure you want to delete this record?")) {
                        setSelectedAdvance(null);
                        deleteAdvanceMutation.mutate(id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
