import React, { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    ChevronsUpDown,
    CalendarIcon,
    Trash2,
    Lock,
    Unlock,
    Clock,
    Plus,
    MoreVertical,
    Pencil,
    CheckCircle2,
    XCircle,
    User,
    History,
    FileText,
    RefreshCw,
    AlertCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
    getLeaveSheet,
    upsertLeave,
    getAllStaff,
    deleteStaffLeave,
    getStaffLeaveBalance,
    toggleLockStaffLeave,
    updateStaffLeaveStatus,
    applyTeacherLeave,
    userWho,
    refreshTokens,
} from "../../config/apis";
import { cn, extractId } from "@/lib/utils.jsx";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EditLeaveDialog = ({ open, onOpenChange, record, onSuccess }) => {
    const [selectedRange, setSelectedRange] = useState(undefined);
    const [calOpen, setCalOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [leaveType, setLeaveType] = useState("CASUAL");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    // Fetch leave balance for the staff member being edited
    const staffIdStr = record?.staffId ? extractId(record.staffId) : "";
    const recordMonth = record?.startDate ? String(record.startDate).slice(0, 7) : new Date().toISOString().slice(0, 7);
    const { data: leaveBalance, isFetching: balanceFetching } = useQuery({
        queryKey: ["leaveBalance", staffIdStr, recordMonth],
        queryFn: () => getStaffLeaveBalance(staffIdStr, recordMonth),
        enabled: !!staffIdStr && open,
    });

    useEffect(() => {
        if (record) {
            const parseLocalDate = (str) => {
                if (!str) return null;
                const d = str.split("T")[0];
                const [y, m, day] = d.split("-").map(Number);
                return new Date(y, m - 1, day, 12, 0, 0);
            };
            const start = parseLocalDate(record.startDate);
            const end = parseLocalDate(record.endDate);
            setSelectedRange({ from: start, to: end || start });
            setReason(record.reason || "");
            setLeaveType(record.leaveType || "CASUAL");
            setCalOpen(false);
        }
    }, [record]);

    const handleSave = async () => {
        if (!record) return;
        setIsSubmitting(true);
        try {
            const fromDate = selectedRange?.from;
            const toDate = selectedRange?.to || selectedRange?.from;
            const days = fromDate && toDate
                ? Math.floor((new Date(toDate).setHours(0, 0, 0, 0) - new Date(fromDate).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)) + 1
                : 0;

            await upsertLeave({
                leaveId: record.leaveId || record.id,
                staffId: staffIdStr,
                startDate: format(fromDate, "yyyy-MM-dd"),
                endDate: format(toDate, "yyyy-MM-dd"),
                days,
                month: format(fromDate, "yyyy-MM"),
                reason,
                status: record.status,
                leaveType,
            });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast({
                title: error.message || "Failed to update leave request",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const dateLabel = !selectedRange?.from
        ? "Pick date range..."
        : selectedRange?.to
            ? `${format(selectedRange.from, "yyyy-MM-dd")} to ${format(selectedRange.to, "yyyy-MM-dd")}`
            : format(selectedRange.from, "yyyy-MM-dd");

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v); }}>
            <DialogContent
                className="max-w-sm"
                onPointerDownOutside={(e) => { if (isSubmitting) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (isSubmitting) e.preventDefault(); }}
            >
                <DialogHeader>
                    <DialogTitle>Edit Leave Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <Label>Staff Member</Label>
                        <p className="text-sm font-medium mt-1">{record?.name || "—"}</p>
                    </div>

                    {/* Balance summary */}
                    {staffIdStr && (
                        <div>
                            {balanceFetching ? (
                                <p className="text-xs text-muted-foreground">Loading leave balance...</p>
                            ) : leaveBalance ? (
                                <div className="grid grid-cols-3 gap-1.5 text-xs">
                                    {[["CASUAL","Casual"],["SICK","Sick"],["ANNUAL","Annual"]].map(([type, label]) => {
                                        const b = leaveBalance[type] || leaveBalance[type.toLowerCase()];
                                        const taken = b ? (b.taken ?? b.used ?? 0) : 0;
                                        const allowed = b ? (b.allowed ?? 0) : 0;
                                        const rem = b ? (b.remaining ?? b.balance ?? (allowed - taken)) : 0;
                                        return (
                                            <div key={type} className={`rounded px-2 py-1 text-center border ${type === leaveType ? "ring-1 ring-primary" : ""} ${rem <= 0 ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/40"}`}>
                                                <div className="font-medium">{label}</div>
                                                <div>{b ? `${taken}/${allowed}` : "—"}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    )}

                    <div>
                        <Label>Leave Type</Label>
                        <Select value={leaveType} onValueChange={setLeaveType}>
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CASUAL">Casual Leave</SelectItem>
                                <SelectItem value="SICK">Sick Leave</SelectItem>
                                <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                            </SelectContent>
                        </Select>
                        {leaveBalance && (
                            <p className="text-xs mt-1 text-muted-foreground">
                                {(() => {
                                    const b = leaveBalance[leaveType] || leaveBalance[leaveType.toLowerCase()];
                                    if (!b) return null;
                                    const taken = b.taken ?? b.used ?? 0;
                                    const allowed = b.allowed ?? 0;
                                    const rem = b.remaining ?? b.balance ?? (allowed - taken);
                                    return <span className={rem <= 0 ? "text-destructive font-medium" : ""}>Used: {taken}/{allowed} · Remaining: {Math.max(0, rem)}</span>;
                                })()}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label>Dates</Label>
                        <Popover open={calOpen} onOpenChange={setCalOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start mt-1 font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                    {dateLabel}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="range"
                                    selected={selectedRange}
                                    onSelect={(range) => setSelectedRange(range)}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div>
                        <Label>Reason</Label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Enter reason for leave..."
                            rows={2}
                            className="mt-1"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting || !selectedRange?.from}>
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Save
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const LeaveHistoryDialog = ({ open, onOpenChange, record }) => {
    if (!record) return null;

    const actionAudit = record.actionAudit && Array.isArray(record.actionAudit) ? record.actionAudit : [];

    const getActionDetails = (actionStr) => {
        const action = String(actionStr || "").toUpperCase();
        if (action === "STATUS_APPROVED" || action === "APPROVED") {
            return {
                label: "Approved",
                badgeClass: "bg-green-500 hover:bg-green-500 text-white",
                icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
            };
        }
        if (action === "STATUS_REJECTED" || action === "REJECTED") {
            return {
                label: "Rejected",
                badgeClass: "bg-destructive hover:bg-destructive text-destructive-foreground",
                icon: <XCircle className="h-4 w-4 text-destructive" />,
            };
        }
        if (action === "CREATED") {
            return {
                label: "Request Submitted",
                badgeClass: "bg-blue-600 hover:bg-blue-600 text-white",
                icon: <FileText className="h-4 w-4 text-blue-600" />,
            };
        }
        if (action === "UPDATED") {
            return {
                label: "Request Updated",
                badgeClass: "bg-amber-500 hover:bg-amber-500 text-white",
                icon: <RefreshCw className="h-4 w-4 text-amber-600" />,
            };
        }
        if (action === "LOCKED") {
            return {
                label: "Locked",
                badgeClass: "bg-zinc-700 hover:bg-zinc-700 text-white",
                icon: <Lock className="h-4 w-4 text-zinc-700" />,
            };
        }
        if (action === "UNLOCKED") {
            return {
                label: "Unlocked",
                badgeClass: "bg-zinc-500 hover:bg-zinc-500 text-white",
                icon: <Unlock className="h-4 w-4 text-zinc-500" />,
            };
        }
        return {
            label: action.replace(/^STATUS_/, ""),
            badgeClass: "bg-secondary text-secondary-foreground",
            icon: <Clock className="h-4 w-4 text-muted-foreground" />,
        };
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        Leave Application History
                    </DialogTitle>
                </DialogHeader>

                {/* Summary Card */}
                <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-base">{record.name}</span>
                        <Badge variant="outline" className="text-xs font-medium">
                            {record.leaveType === "SICK" ? "Sick Leave" : record.leaveType === "ANNUAL" ? "Annual Leave" : "Casual Leave"}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>
                                {record.startDate?.split("T")[0]}
                                {record.endDate && record.endDate !== record.startDate ? ` to ${record.endDate.split("T")[0]}` : ""}
                            </span>
                        </span>
                        <span className="font-medium text-foreground bg-background border px-2 py-0.5 rounded">
                            {record.days} {Number(record.days) > 1 ? "days" : "day"}
                        </span>
                    </div>
                    {record.reason && (
                        <div className="text-xs pt-1.5 border-t">
                            <span className="text-muted-foreground font-medium">Reason: </span>
                            <span className="text-foreground">{record.reason}</span>
                        </div>
                    )}
                </div>

                {/* Timeline */}
                <div className="mt-2 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Action History & Progress
                        </h4>
                        <span className="text-xs text-muted-foreground">
                            {actionAudit.length} action{actionAudit.length === 1 ? "" : "s"}
                        </span>
                    </div>

                    {actionAudit.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground border rounded-md">
                            No action history recorded for this request.
                        </div>
                    ) : (
                        <div className="relative pl-7 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-border max-h-[320px] overflow-y-auto pr-1">
                            {actionAudit.map((item, idx) => {
                                const details = getActionDetails(item.action);
                                let dateFormatted = "—";
                                if (item.at) {
                                    try {
                                        dateFormatted = format(new Date(item.at), "MMM d, yyyy · hh:mm a");
                                    } catch {
                                        dateFormatted = String(item.at);
                                    }
                                }

                                return (
                                    <div key={item._id || item.id || idx} className="relative">
                                        {/* Marker */}
                                        <div className="absolute -left-7 top-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-background border-2 shadow-xs">
                                            {details.icon}
                                        </div>

                                        <div className="space-y-1 bg-background/60 rounded p-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className={`text-[11px] px-2 py-0.5 font-medium ${details.badgeClass}`}>
                                                    {details.label}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    <span className="font-medium text-foreground">{item.byName || "Admin"}</span>
                                                </span>
                                            </div>

                                            <div className="text-[11px] text-muted-foreground">
                                                {dateFormatted}
                                            </div>

                                            {item.notes && (
                                                <p className="text-xs bg-muted/60 p-2 rounded text-foreground mt-1">
                                                    {item.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Put Application Dialog for self leave application (Exact form from TeacherLeaves.jsx)
const PutApplicationDialog = ({ open, onOpenChange, currentUser, staffList, onSuccess }) => {
    const { toast } = useToast();
    const [selectedRange, setSelectedRange] = useState(undefined);
    const [formData, setFormData] = useState({
        type: "CASUAL",
        reason: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Resolve staff record for current user
    const myStaffRecord = useMemo(() => {
        if (!currentUser) return null;
        const targetId = currentUser.refId || currentUser.staffDbId || currentUser.id || currentUser._id;
        const byId = (staffList || []).find((s) => {
            const sId = s.id || s._id;
            return String(sId) === String(targetId) || (s.staffId && String(s.staffId) === String(currentUser.staffId));
        });
        if (byId) return byId;
        if (currentUser.email) {
            const byEmail = (staffList || []).find(
                (s) => s.email && s.email.toLowerCase() === currentUser.email.toLowerCase()
            );
            if (byEmail) return byEmail;
        }
        return null;
    }, [currentUser, staffList]);

    const myStaffId = myStaffRecord?.id || myStaffRecord?._id || currentUser?.refId || currentUser?.staffDbId || "";
    const staffName = myStaffRecord?.name || currentUser?.name || "Staff Member";

    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: leaveBalance, isLoading: isBalanceLoading } = useQuery({
        queryKey: ["staffLeaveBalanceSelf", myStaffId, currentMonth],
        queryFn: () => getStaffLeaveBalance(myStaffId, currentMonth),
        enabled: !!myStaffId && open,
    });

    useEffect(() => {
        if (!open) {
            setSelectedRange(undefined);
            setFormData({ type: "CASUAL", reason: "" });
        }
    }, [open]);

    // Calculate days count from sequence
    const calculatedDays = useMemo(() => {
        if (!selectedRange?.from) return 0;
        if (!selectedRange.to) return 1;
        const start = new Date(selectedRange.from);
        const end = new Date(selectedRange.to);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        return Math.max(1, diff);
    }, [selectedRange]);

    // Quick preset ranges
    const handleQuickPreset = (presetKey) => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);

        if (presetKey === "today") {
            setSelectedRange({ from: today, to: undefined });
        } else if (presetKey === "tomorrow") {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            setSelectedRange({ from: tomorrow, to: undefined });
        } else if (presetKey === "next3days") {
            const start = new Date(today);
            start.setDate(start.getDate() + 1);
            const end = new Date(start);
            end.setDate(end.getDate() + 2);
            setSelectedRange({ from: start, to: end });
        } else if (presetKey === "thisweek") {
            const start = new Date(today);
            const end = new Date(today);
            end.setDate(end.getDate() + 4);
            setSelectedRange({ from: start, to: end });
        }
    };

    const isPresetActive = (presetKey) => {
        if (!selectedRange?.from) return false;
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const fromStr = format(selectedRange.from, "yyyy-MM-dd");
        const toStr = selectedRange.to ? format(selectedRange.to, "yyyy-MM-dd") : fromStr;

        if (presetKey === "today") {
            const todayStr = format(today, "yyyy-MM-dd");
            return fromStr === todayStr && toStr === todayStr;
        }
        if (presetKey === "tomorrow") {
            const tm = new Date(today);
            tm.setDate(tm.getDate() + 1);
            const tmStr = format(tm, "yyyy-MM-dd");
            return fromStr === tmStr && toStr === tmStr;
        }
        if (presetKey === "next3days") {
            const start = new Date(today);
            start.setDate(start.getDate() + 1);
            const end = new Date(start);
            end.setDate(end.getDate() + 2);
            return fromStr === format(start, "yyyy-MM-dd") && toStr === format(end, "yyyy-MM-dd");
        }
        if (presetKey === "thisweek") {
            const start = new Date(today);
            const end = new Date(today);
            end.setDate(end.getDate() + 4);
            return fromStr === format(start, "yyyy-MM-dd") && toStr === format(end, "yyyy-MM-dd");
        }
        return false;
    };

    const presets = [
        { key: "today", label: "Today (1d)" },
        { key: "tomorrow", label: "Tomorrow (1d)" },
        { key: "next3days", label: "Next 3 Days (3d)" },
        { key: "thisweek", label: "Next 5 Days (5d)" },
    ];

    const activeBalance = leaveBalance ? (leaveBalance[formData.type] || leaveBalance[formData.type.toLowerCase()]) : null;
    const activeRemaining = activeBalance ? (activeBalance.remaining ?? activeBalance.balance ?? ((activeBalance.allowed ?? 0) - (activeBalance.taken ?? activeBalance.used ?? 0))) : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRange?.from) {
            toast({
                title: "Select Dates",
                description: "Please select one or more dates on the calendar.",
                variant: "destructive",
            });
            return;
        }

        const startDate = format(selectedRange.from, "yyyy-MM-dd");
        const endDate = selectedRange.to ? format(selectedRange.to, "yyyy-MM-dd") : startDate;

        if (!formData.reason.trim()) {
            toast({
                title: "Reason Required",
                description: "Please provide a reason for your leave request.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await applyTeacherLeave({
                staffId: myStaffId || undefined,
                startDate,
                endDate,
                days: calculatedDays || 1,
                type: formData.type,
                reason: formData.reason.trim(),
            });

            toast({
                title: "Application Submitted",
                description: "Your leave application has been submitted successfully.",
            });
            setSelectedRange(undefined);
            setFormData({ type: "CASUAL", reason: "" });
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            toast({
                title: "Submission Error",
                description: error.message || "Failed to submit leave application.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <FileText className="h-5 w-5 text-primary" />
                            Put Leave Application
                        </DialogTitle>
                        {staffName && (
                            <Badge variant="outline" className="border-primary/30 text-primary text-xs font-medium">
                                <User className="h-3 w-3 mr-1" />
                                {staffName}
                                {myStaffRecord?.empDepartment ? ` · ${myStaffRecord.empDepartment}` : ""}
                            </Badge>
                        )}
                    </div>
                    <DialogDescription>
                        Submit a leave application for yourself. This will be routed to HR & Administration for review.
                    </DialogDescription>
                </DialogHeader>

                {/* Leave Balances Summary Cards */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {[
                        { key: "CASUAL", label: "Casual Leave" },
                        { key: "SICK", label: "Sick Leave" },
                        { key: "ANNUAL", label: "Annual Leave" },
                    ].map(({ key, label }) => {
                        const b = leaveBalance ? (leaveBalance[key] || leaveBalance[key.toLowerCase()]) : null;
                        const taken = b ? (b.taken ?? b.used ?? 0) : 0;
                        const allowed = b ? (b.allowed ?? 0) : 0;
                        const remaining = b ? (b.remaining ?? b.balance ?? (allowed - taken)) : 0;

                        return (
                            <div key={key} className="rounded-lg border border-primary/20 bg-muted/40 p-2.5 space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">{label}</span>
                                    <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-[10px] font-bold px-1.5 py-0">
                                        {remaining > 0 ? `${remaining} Left` : "0 Left"}
                                    </Badge>
                                </div>
                                <div className="flex items-baseline justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-border/50">
                                    <span>Used / Quota</span>
                                    <span className="font-semibold text-foreground">
                                        {isBalanceLoading ? "..." : `${taken} / ${allowed}`}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    {/* Leave Type */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="selfLeaveType" className="text-xs font-medium">
                                Leave Type <span className="text-primary">*</span>
                            </Label>
                            {activeRemaining !== null && (
                                <span className="text-[11px] text-muted-foreground">
                                    Remaining quota: <span className="font-semibold text-primary">{activeRemaining} days</span>
                                </span>
                            )}
                        </div>
                        <Select
                            value={formData.type}
                            onValueChange={(val) => setFormData({ ...formData, type: val })}
                        >
                            <SelectTrigger id="selfLeaveType" className="border-primary/20 focus:ring-primary text-xs">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CASUAL">Casual Leave</SelectItem>
                                <SelectItem value="SICK">Sick Leave</SelectItem>
                                <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                                <SelectItem value="OTHER">Other Leave</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Sequence Calendar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                Select Dates <span className="text-primary">*</span>
                            </Label>
                            {selectedRange?.from && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedRange(undefined)}
                                    className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                >
                                    Reset Calendar
                                </button>
                            )}
                        </div>

                        {/* Quick Preset Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {presets.map(({ key, label }) => {
                                const active = isPresetActive(key);
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleQuickPreset(key)}
                                        className={cn(
                                            "h-6.5 px-2.5 text-[11px] rounded-md border font-medium transition-all shadow-2xs cursor-pointer select-none",
                                            active
                                                ? "bg-primary text-white border-primary shadow-xs font-semibold"
                                                : "bg-background text-foreground border-primary/30 hover:bg-primary hover:text-white hover:border-primary hover:shadow-xs"
                                        )}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Single Interactive Range Calendar */}
                        <div className="rounded-lg border border-primary/20 bg-background/60 p-1.5 shadow-xs flex flex-col items-center">
                            <Calendar
                                mode="range"
                                selected={selectedRange}
                                onSelect={(range) => setSelectedRange(range)}
                                className="rounded-md w-full flex justify-center"
                                classNames={{
                                    day_selected:
                                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold",
                                    day_range_start: "day-range-start rounded-l-md bg-primary text-primary-foreground font-semibold",
                                    day_range_end: "day-range-end rounded-r-md bg-primary text-primary-foreground font-semibold",
                                    day_range_middle: "aria-selected:bg-primary/15 aria-selected:text-primary rounded-none font-medium",
                                }}
                            />
                        </div>

                        {/* Sequence Selection Summary Banner */}
                        {selectedRange?.from ? (
                            <div className="rounded-md bg-primary/10 border border-primary/20 p-2.5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                    <div>
                                        <span className="font-semibold text-foreground">
                                            {format(selectedRange.from, "MMM d, yyyy")}
                                            {selectedRange.to && format(selectedRange.to, "yyyy-MM-dd") !== format(selectedRange.from, "yyyy-MM-dd")
                                                ? ` → ${format(selectedRange.to, "MMM d, yyyy")}`
                                                : " (Single Day)"}
                                        </span>
                                        <span className="text-muted-foreground ml-1.5">
                                            ({calculatedDays} {calculatedDays === 1 ? "day requested" : "consecutive days"})
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Badge className="bg-primary text-primary-foreground font-bold shadow-xs">
                                        {calculatedDays} {calculatedDays === 1 ? "Day" : "Days"}
                                    </Badge>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRange(undefined)}
                                        className="h-5 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-md border border-dashed border-primary/30 p-2 text-center text-xs text-muted-foreground">
                                Click a date for 1 day, or click a 2nd date to select a sequence of dates.
                            </div>
                        )}

                        {/* Excess warning if requested days exceed balance */}
                        {activeRemaining !== null && calculatedDays > activeRemaining && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                    Requested {calculatedDays} days exceeds your {formData.type.toLowerCase()} quota ({activeRemaining} left).
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                        <Label htmlFor="selfLeaveReason" className="text-xs font-medium">
                            Reason for Leave <span className="text-primary">*</span>
                        </Label>
                        <Textarea
                            id="selfLeaveReason"
                            placeholder="Provide a clear description of the reason for your leave..."
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            rows={3}
                            className="border-primary/20 focus-visible:ring-primary text-xs"
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isSubmitting || !selectedRange?.from}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting Request...
                                </>
                            ) : (
                                `Submit Leave Application ${calculatedDays > 0 ? `(${calculatedDays} ${calculatedDays === 1 ? "Day" : "Days"})` : ""}`
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const LeavesManagementDialog = () => {
    const { canCreate, canUpdate, canDelete } = usePermissions("HR & Payroll", "leaves");
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [activeTab, setActiveTab] = useState("teacher");
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [putApplicationOpen, setPutApplicationOpen] = useState(false);
    const [leaveFormData, setLeaveFormData] = useState({
        personId: "",
        personName: "",
        reason: "",
        leaveType: "CASUAL",
    });
    const [selectedRange, setSelectedRange] = useState(undefined);
    const [dateError, setDateError] = useState("");
    const [calOpen, setCalOpen] = useState(false);
    const [staffSearch, setStaffSearch] = useState("");
    const [comboOpen, setComboOpen] = useState(false);
    const [staffError, setStaffError] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Leave balance for selected staff
    const selectedStaffIdStr = leaveFormData.personId ? extractId(leaveFormData.personId) : "";
    const { data: leaveBalance, isFetching: balanceFetching } = useQuery({
        queryKey: ["leaveBalance", selectedStaffIdStr, month],
        queryFn: () => getStaffLeaveBalance(selectedStaffIdStr, month),
        enabled: !!selectedStaffIdStr,
    });

    const {
        data: leaveData = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ["leaveSheet", month, activeTab],
        queryFn: () => getLeaveSheet(month, activeTab),
        enabled: !!month,
    });

    // Fetch unified staff list
    const { data: staffList = [], isLoading: staffLoading } = useQuery({
        queryKey: ["allStaff"],
        queryFn: () => getAllStaff({ status: "ACTIVE" }),
    });

    // Current logged in user query
    const { data: currentUser } = useQuery({
        queryKey: ["currentUser"],
        queryFn: async () => {
            try {
                return await userWho();
            } catch (error) {
                if (error.response?.status === 401) {
                    await refreshTokens();
                    return userWho();
                }
                throw error;
            }
        },
    });

    // Resolve current user's staff record
    const myStaffRecord = useMemo(() => {
        if (!currentUser) return null;
        const targetId = currentUser.refId || currentUser.staffDbId || currentUser.id || currentUser._id;
        const byId = (staffList || []).find((s) => {
            const sId = s.id || s._id;
            return String(sId) === String(targetId) || (s.staffId && String(s.staffId) === String(currentUser.staffId));
        });
        if (byId) return byId;
        if (currentUser.email) {
            const byEmail = (staffList || []).find(
                (s) => s.email && s.email.toLowerCase() === currentUser.email.toLowerCase()
            );
            if (byEmail) return byEmail;
        }
        return null;
    }, [currentUser, staffList]);

    const myStaffId = myStaffRecord?.id || myStaffRecord?._id || currentUser?.refId || currentUser?.staffDbId || "";

    // Per-record edit and history state
    const [editingRecord, setEditingRecord] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [historyRecord, setHistoryRecord] = useState(null);
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [actionLoading, setActionLoading] = useState(null); // leaveId of in-progress action

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        setDeletingId(confirmDeleteId);
        setConfirmDeleteId(null);
        try {
            await deleteStaffLeave(confirmDeleteId);
            toast({ title: "Leave request deleted" });
            queryClient.invalidateQueries(["leaveSheet", month, activeTab]);
            queryClient.invalidateQueries(["leaveBalance"]);
            refetch();
        } catch (error) {
            toast({ title: error.message || "Failed to delete", variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    const handleStatusChange = async (leaveId, status) => {
        setActionLoading(leaveId);
        try {
            await updateStaffLeaveStatus(leaveId, status);
            toast({ title: `Status updated to ${status}` });
            queryClient.invalidateQueries(["leaveSheet", month, activeTab]);
            queryClient.invalidateQueries(["leaveBalance"]);
            refetch();
        } catch (error) {
            toast({ title: error.message || "Failed to update status", variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleLock = async (leaveId, locked) => {
        setActionLoading(leaveId);
        try {
            await toggleLockStaffLeave(leaveId, locked);
            toast({ title: locked ? "Leave locked" : "Leave unlocked" });
            queryClient.invalidateQueries(["leaveSheet", month, activeTab]);
            queryClient.invalidateQueries(["leaveBalance"]);
            refetch();
        } catch (error) {
            toast({ title: error.message || "Failed to toggle lock", variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    const statusBadge = (status) => {
        if (status === "APPROVED") return <Badge className="bg-green-500 text-white">APPROVED</Badge>;
        if (status === "REJECTED") return <Badge variant="destructive">REJECTED</Badge>;
        return <Badge variant="secondary">PENDING</Badge>;
    };

    const roleLabel = (s) => {
        if (s.isTeaching && s.isNonTeaching) return "Dual";
        if (s.isTeaching) return "Teacher";
        return "Non-Teaching";
    };

    // Handle create leave
    const handleCreateLeave = async () => {
        if (!leaveFormData.personId) {
            setStaffError("Please select a staff member");
            return;
        }
        if (!leaveFormData.reason) {
            toast({ title: "Please fill all required fields", variant: "destructive" });
            return;
        }
        if (!selectedRange?.from) {
            setDateError("Please select a date range");
            return;
        }

        try {
            setIsCreating(true);
            const fromDate = selectedRange.from;
            const toDate = selectedRange.to || selectedRange.from;
            const days = Math.floor(
                (new Date(toDate).setHours(0, 0, 0, 0) - new Date(fromDate).setHours(0, 0, 0, 0)) /
                (1000 * 60 * 60 * 24)
            ) + 1;

            await upsertLeave({
                staffId: extractId(leaveFormData.personId),
                startDate: format(fromDate, "yyyy-MM-dd"),
                endDate: format(toDate, "yyyy-MM-dd"),
                days,
                month: format(fromDate, "yyyy-MM"),
                reason: leaveFormData.reason,
                status: "PENDING",
                leaveType: leaveFormData.leaveType,
            });

            toast({ title: "Leave request created successfully" });
            setCreateDialogOpen(false);
            setLeaveFormData({ personId: "", personName: "", reason: "", leaveType: "CASUAL" });
            setSelectedRange(undefined);
            setDateError("");
            setCalOpen(false);
            setStaffSearch("");
            setComboOpen(false);
            setStaffError("");
            queryClient.invalidateQueries(["leaveSheet", month, activeTab]);
            queryClient.invalidateQueries(["leaveBalance"]);
            refetch();
        } catch (error) {
            toast({
                title: error.message || "Failed to create leave request",
                variant: "destructive",
            });
            queryClient.invalidateQueries(["leaveSheet", month, activeTab]);
            queryClient.invalidateQueries(["leaveBalance"]);
            refetch();
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <TooltipProvider>
            <div className="w-full h-full flex flex-col min-h-[600px]">
            <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Label>Month:</Label>
                    <Select
                        value={String(parseInt(month.split("-")[1] || "1", 10))}
                        onValueChange={(m) => {
                            const y = month.split("-")[0] || String(new Date().getFullYear());
                            setMonth(`${y}-${String(m).padStart(2, "0")}`);
                        }}
                    >
                        <SelectTrigger className="w-36">
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
                    <Select
                        value={month.split("-")[0] || String(new Date().getFullYear())}
                        onValueChange={(y) => {
                            const m = month.split("-")[1] || "01";
                            setMonth(`${y}-${m}`);
                        }}
                    >
                        <SelectTrigger className="w-24">
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
                <div className="flex items-center gap-2">
                    <Label>Role:</Label>
                    <Select value={activeTab} onValueChange={setActiveTab}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Staff" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Staff</SelectItem>
                            <SelectItem value="teacher">Teachers</SelectItem>
                            <SelectItem value="employee">Non-Teaching Staff</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Button
                        type="button"
                        onClick={() => setPutApplicationOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-2xs"
                    >
                        <FileText className="mr-1.5 h-4 w-4" />
                        Put Application
                    </Button>
                    {canCreate && (
                        <Button
                            type="button"
                            onClick={() => setCreateDialogOpen(true)}
                            variant="outline"
                            className="text-xs font-medium"
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Create Leave Request
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto border rounded-md">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full py-16">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="py-2 px-3 text-sm min-w-[160px]">Staff Name</TableHead>
                                <TableHead className="py-2 px-3 text-sm min-w-[160px]">Role / Dept</TableHead>
                                <TableHead className="py-2 px-3 text-sm min-w-[100px]">Leave Type</TableHead>
                                <TableHead className="py-2 px-3 text-sm min-w-[200px]">Dates</TableHead>
                                <TableHead className="py-2 px-3 text-sm min-w-[60px]">Days</TableHead>
                                <TableHead className="py-2 px-3 text-sm min-w-[200px]">Reason</TableHead>
                                <TableHead className="py-2 px-3 text-sm min-w-[100px]">Status</TableHead>
                                <TableHead className="py-2 px-3 text-sm min-w-[80px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {leaveData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-2 px-3 text-sm text-center text-muted-foreground py-8">
                                        No leave records found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                leaveData.map((row, index) => (
                                    <TableRow key={`${row.leaveId ?? row.id}-${index}`}>
                                        <TableCell className="py-2 px-3 text-sm font-medium">{row.name}</TableCell>
                                        <TableCell className="py-2 px-3 text-sm">
                                            <div>{roleLabel(row)}</div>
                                            <div className="text-xs text-muted-foreground">{row.department?.name || row.department || "—"}</div>
                                        </TableCell>
                                        <TableCell className="py-2 px-3 text-sm">
                                            <Badge variant="outline" className="text-xs">
                                                {row.leaveType === "SICK" ? "Sick" : row.leaveType === "ANNUAL" ? "Annual" : "Casual"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-2 px-3 text-sm">
                                            {row.startDate?.split("T")[0] || ""}
                                            {row.endDate && row.endDate !== row.startDate
                                                ? ` – ${row.endDate.split("T")[0]}`
                                                : ""}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 text-sm">{row.days}</TableCell>
                                        <TableCell className="py-2 px-3 text-sm">{row.reason || ""}</TableCell>
                                        <TableCell className="py-2 px-3 text-sm">
                                            <div className="flex flex-col gap-1">
                                                {statusBadge(row.status)}
                                                {row.locked && <Badge variant="outline" className="text-xs w-fit gap-1"><Lock className="h-3 w-3" />Locked</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 px-3 text-sm">
                                            <div className="flex items-center gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            disabled={actionLoading === (row.leaveId || row.id)}
                                                            onClick={() => {
                                                                setHistoryRecord(row);
                                                                setHistoryDialogOpen(true);
                                                            }}
                                                        >
                                                            <Clock className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>View action history</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                {(() => {
                                                    const rowStaffId = row.staffId ? extractId(row.staffId) : "";
                                                    const isOwnRecord = myStaffId && rowStaffId && String(myStaffId) === String(rowStaffId);
                                                    const canSelfCancel = isOwnRecord && row.status === "PENDING" && !row.locked;

                                                    if (!canUpdate && !canDelete && !canSelfCancel) return null;

                                                    return (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                {canUpdate && (
                                                                    <>
                                                                        <DropdownMenuItem
                                                                            disabled={row.locked || actionLoading === (row.leaveId || row.id)}
                                                                            onClick={() => {
                                                                                setEditingRecord(row);
                                                                                setEditDialogOpen(true);
                                                                            }}
                                                                        >
                                                                            <Pencil className="h-4 w-4 mr-2" /> Edit
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        {row.status !== "APPROVED" && (
                                                                            <DropdownMenuItem
                                                                                disabled={row.locked || actionLoading === (row.leaveId || row.id)}
                                                                                onClick={() => handleStatusChange(row.leaveId || row.id, "APPROVED")}
                                                                            >
                                                                                Approve
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {row.status !== "REJECTED" && (
                                                                            <DropdownMenuItem
                                                                                disabled={row.locked || actionLoading === (row.leaveId || row.id)}
                                                                                onClick={() => handleStatusChange(row.leaveId || row.id, "REJECTED")}
                                                                            >
                                                                                Reject
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleToggleLock(row.leaveId || row.id, !row.locked)}
                                                                        >
                                                                            {row.locked ? (
                                                                                <span className="flex items-center gap-2"><Unlock className="h-4 w-4" /> Unlock</span>
                                                                            ) : (
                                                                                <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Lock</span>
                                                                            )}
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                                {(canDelete || canSelfCancel) && (
                                                                    <>
                                                                        {canUpdate && <DropdownMenuSeparator />}
                                                                        <DropdownMenuItem
                                                                            disabled={row.locked || deletingId === (row.leaveId || row.id)}
                                                                            className="text-destructive focus:text-destructive"
                                                                            onClick={() => setConfirmDeleteId(row.leaveId || row.id)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                                            {canDelete ? "Delete" : "Cancel Application"}
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    );
                                                })()}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Edit Leave Request Dialog */}
            <EditLeaveDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                record={editingRecord}
                onSuccess={() => {
                    queryClient.invalidateQueries(["leaveSheet", month, activeTab]);
                    queryClient.invalidateQueries(["leaveBalance"]);
                    refetch();
                }}
            />

            {/* Leave Action History Dialog */}
            <LeaveHistoryDialog
                open={historyDialogOpen}
                onOpenChange={setHistoryDialogOpen}
                record={historyRecord}
            />

            {/* Create Leave Request Dialog */}
            <Dialog
                open={createDialogOpen}
                onOpenChange={(v) => { if (!isCreating) setCreateDialogOpen(v); }}
            >
                <DialogContent
                    className="max-w-sm"
                    onPointerDownOutside={(e) => { if (isCreating) e.preventDefault(); }}
                    onEscapeKeyDown={(e) => { if (isCreating) e.preventDefault(); }}
                >
                    <DialogHeader>
                        <DialogTitle>Create Leave Request</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Staff Combobox */}
                        <div>
                            <Label>Select Staff Member *</Label>
                            <Popover open={comboOpen} onOpenChange={setComboOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={comboOpen}
                                        className="w-full justify-between mt-1"
                                        disabled={staffLoading || isCreating}
                                    >
                                        {leaveFormData.personId
                                            ? staffList.find(s => extractId(s.id || s._id) === extractId(leaveFormData.personId))?.name || "Select staff member..."
                                            : staffLoading ? "Loading..." : "Select staff member..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Search staff..."
                                            value={staffSearch}
                                            onValueChange={setStaffSearch}
                                            disabled={staffLoading}
                                        />
                                        <CommandEmpty>No staff found</CommandEmpty>
                                        <CommandList>
                                            {staffList
                                                .filter(s => String(s.name || "").toLowerCase().includes(staffSearch.toLowerCase()))
                                                .map(s => {
                                                    const sId = extractId(s.id || s._id);
                                                    return (
                                                        <CommandItem
                                                            key={sId}
                                                            value={sId}
                                                            onSelect={() => {
                                                                setLeaveFormData({ ...leaveFormData, personId: sId, personName: s.name });
                                                                setStaffError("");
                                                                setComboOpen(false);
                                                            }}
                                                        >
                                                            {s.name} · {roleLabel(s)} · {s.department?.name || s.empDepartment || "—"}
                                                        </CommandItem>
                                                    );
                                                })}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {staffError && <p className="text-sm text-destructive mt-1">{staffError}</p>}
                            
                            {/* All-type balance summary */}
                            {selectedStaffIdStr && leaveBalance && !balanceFetching && (
                                <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                                    {[["CASUAL","Casual"],["SICK","Sick"],["ANNUAL","Annual"]].map(([type, label]) => {
                                        const b = leaveBalance[type] || leaveBalance[type.toLowerCase()];
                                        const taken = b ? (b.taken ?? b.used ?? 0) : 0;
                                        const allowed = b ? (b.allowed ?? 0) : 0;
                                        const rem = b ? (b.remaining ?? b.balance ?? (allowed - taken)) : 0;
                                        return (
                                            <div key={type} className={`rounded px-2 py-1 text-center border ${rem <= 0 ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/40"}`}>
                                                <div className="font-medium">{label}</div>
                                                <div>{b ? `${taken}/${allowed}` : "—"}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {selectedStaffIdStr && balanceFetching && (
                                <p className="text-xs text-muted-foreground mt-1">Loading leave balance...</p>
                            )}
                        </div>

                        {/* Dates */}
                        <div>
                            <Label>Select Dates *</Label>
                            <Popover open={calOpen} onOpenChange={setCalOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start mt-1 font-normal" disabled={isCreating}>
                                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                        {!selectedRange?.from
                                            ? "Pick date range..."
                                            : selectedRange?.to
                                                ? `${format(selectedRange.from, "yyyy-MM-dd")} to ${format(selectedRange.to, "yyyy-MM-dd")}`
                                                : format(selectedRange.from, "yyyy-MM-dd")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="range"
                                        selected={selectedRange}
                                        onSelect={(range) => { setSelectedRange(range); setDateError(""); }}
                                    />
                                </PopoverContent>
                            </Popover>
                            {dateError && <p className="text-sm text-destructive mt-1">{dateError}</p>}
                        </div>

                        {/* Leave Type */}
                        <div>
                            <Label>Leave Type *</Label>
                            <Select
                                value={leaveFormData.leaveType}
                                onValueChange={(v) => setLeaveFormData({ ...leaveFormData, leaveType: v })}
                                disabled={isCreating}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CASUAL">Casual Leave</SelectItem>
                                    <SelectItem value="SICK">Sick Leave</SelectItem>
                                    <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                                </SelectContent>
                            </Select>
                            {/* Balance indicator */}
                            {selectedStaffIdStr && (
                                <div className="mt-1.5 text-xs text-muted-foreground">
                                    {balanceFetching ? "Loading balance..." : leaveBalance ? (() => {
                                        const b = leaveBalance[leaveFormData.leaveType] || leaveBalance[leaveFormData.leaveType.toLowerCase()];
                                        if (!b) return null;
                                        const taken = b.taken ?? b.used ?? 0;
                                        const allowed = b.allowed ?? 0;
                                        const remaining = b.remaining ?? b.balance ?? (allowed - taken);
                                        return (
                                            <span className={remaining <= 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                                                Used: {taken}/{allowed} · Remaining: {Math.max(0, remaining)}
                                            </span>
                                        );
                                    })() : null}
                                </div>
                            )}
                        </div>

                        {/* Reason */}
                        <div>
                            <Label>Reason *</Label>
                            <Textarea
                                value={leaveFormData.reason}
                                onChange={(e) =>
                                    setLeaveFormData({ ...leaveFormData, reason: e.target.value })
                                }
                                placeholder="Enter reason for leave..."
                                rows={3}
                                disabled={isCreating}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                disabled={isCreating}
                                onClick={() => {
                                    setCreateDialogOpen(false);
                                    setLeaveFormData({ personId: "", personName: "", reason: "", leaveType: "CASUAL" });
                                    setSelectedRange(undefined);
                                    setDateError("");
                                    setCalOpen(false);
                                    setStaffSearch("");
                                    setComboOpen(false);
                                    setStaffError("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleCreateLeave} disabled={isCreating}>
                                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Leave Request
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Leave Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this leave request? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Put Application Dialog (Self Leave Application for all staff) */}
            <PutApplicationDialog
                open={putApplicationOpen}
                onOpenChange={setPutApplicationOpen}
                currentUser={currentUser}
                staffList={staffList}
                onSuccess={() => {
                    queryClient.invalidateQueries(["leaveSheet", month, activeTab]);
                    queryClient.invalidateQueries(["leaveBalance"]);
                    queryClient.invalidateQueries(["staffLeaveBalanceSelf"]);
                    queryClient.invalidateQueries(["teacherLeaves"]);
                    queryClient.invalidateQueries(["teacherLeaveBalance"]);
                    refetch();
                }}
            />
            </div>
        </TooltipProvider>
    );
};

export default LeavesManagementDialog;
