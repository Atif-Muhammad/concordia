import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Calendar as CalendarIcon,
    UserCheck,
    XCircle,
    Clock,
    LockKeyhole,
    Loader2,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import AttendanceConfirmationDialog from "@/components/AttendanceConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
import {
    getStaffAttendance,
    bulkMarkStaffAttendance,
    deleteStaffAttendanceRecord,
    markDateAsHoliday,
    undoGenerateAttendance,
    undoMarkHoliday,
    getHolidays,
    deleteStaffAttendanceByDate,
    getStaffIdSettingsAPI,
} from "../../../config/apis";
import { formatStaffId } from "./StaffDirectoryTab.jsx";

const ATTENDANCE_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export default function StaffAttendanceTab() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [attendanceDate, setAttendanceDate] = useState(new Date());
    const [attendanceRoleFilter, setAttendanceRoleFilter] = useState("all");
    const [attendanceDraftRows, setAttendanceDraftRows] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

    const attendanceDateStr = attendanceDate ? format(attendanceDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

    const { data: staffIdSettings } = useQuery({
        queryKey: ["staffIdSettings"],
        queryFn: getStaffIdSettingsAPI,
    });

    const { data: attendanceData = [], isFetching: attendanceLoading, refetch: refetchAttendance } = useQuery({
        queryKey: ["staffAttendance", attendanceDateStr, attendanceRoleFilter],
        queryFn: () => getStaffAttendance(attendanceDateStr, attendanceRoleFilter),
    });

    useEffect(() => {
        setAttendanceDraftRows(
            Array.isArray(attendanceData)
                ? attendanceData.map((row) => {
                    const isLeave = String(row?.status || '').toUpperCase() === 'LEAVE';
                    return {
                        ...row,
                        leaveType: isLeave ? String(row?.leaveType || 'CASUAL').toUpperCase() : null,
                    };
                })
                : []
        );
    }, [attendanceData]);

    const { data: holidays = [] } = useQuery({
        queryKey: ["holidays"],
        queryFn: getHolidays,
    });

    const isDateHoliday = useMemo(() => {
        return holidays.some(h => {
            const d = new Date(h.date);
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
            return local === attendanceDateStr;
        });
    }, [holidays, attendanceDateStr]);

    const isAttendanceGenerated = attendanceData.length > 0;

    const visibleAttendanceRows = useMemo(() => {
        const scoped = attendanceDraftRows.filter((record) => {
            if (attendanceRoleFilter === "all") return true;
            const isTeaching = record.staff?.isTeaching;
            const isNonTeaching = record.staff?.isNonTeaching;
            if (attendanceRoleFilter === "teaching") return isTeaching;
            if (attendanceRoleFilter === "non-teaching") return isNonTeaching;
            return true;
        });

        const byStaff = new Map();
        const score = (r) => {
            let s = 0;
            if (r?.id) s += 4;
            if (r?.generatedAt) s += 3;
            if (r?.markedAt) s += 2;
            return s;
        };

        for (const row of scoped) {
            const sid = Number(row?.staff?.id ?? row?.staffId);
            if (!Number.isFinite(sid)) continue;
            const prev = byStaff.get(sid);
            if (!prev || score(row) > score(prev)) byStaff.set(sid, row);
        }

        const deduped = Array.from(byStaff.values());
        const hasAttendance = deduped.some((r) => r?.id || r?.generatedAt || r?.markedAt);
        return hasAttendance
            ? deduped.filter((r) => r?.id || r?.generatedAt || r?.markedAt)
            : deduped;
    }, [attendanceDraftRows, attendanceRoleFilter]);

    const isFutureDate = useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const sel = new Date(attendanceDateStr); sel.setHours(0, 0, 0, 0);
        return sel > today;
    }, [attendanceDateStr]);

    const saveAttendanceMutation = useMutation({
        mutationFn: bulkMarkStaffAttendance,
        onSuccess: async () => {
            toast({ title: "Success", description: "Attendance saved successfully" });
            await queryClient.invalidateQueries({ queryKey: ["staffAttendance", attendanceDateStr, attendanceRoleFilter] });
            await refetchAttendance();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleAttendanceStatusChange = async (record, val) => {
        const staffId = record.staff?.id ?? record.staffId;
        if (!staffId) return;

        if (val === "UNMARKED") {
            if (record.id) {
                try {
                    await deleteStaffAttendanceRecord({ staffId, date: attendanceDateStr, attendanceId: record.id });
                    setAttendanceDraftRows((prev) =>
                        prev.map((r) =>
                            (r.staff?.id ?? r.staffId) === staffId
                                ? { ...r, id: undefined, status: null, leaveType: null, notes: "", markedAt: null, markedBy: null, admin: null }
                                : r
                        )
                    );
                    await queryClient.invalidateQueries({ queryKey: ["staffLeaveBalance"] });
                    await queryClient.invalidateQueries({ queryKey: ["payrollSheet"] });
                    await refetchAttendance();
                    toast({ title: "Attendance removed", description: "Staff row is now Not Marked.", variant: "success" });
                } catch (error) {
                    toast({ title: "Failed to remove attendance", description: error.message, variant: "destructive" });
                }
                return;
            }

            setAttendanceDraftRows((prev) =>
                prev.map((r) =>
                    (r.staff?.id ?? r.staffId) === staffId
                        ? { ...r, status: null, leaveType: null, notes: "" }
                        : r
                )
            );
            return;
        }

        const upperVal = String(val).toUpperCase();
        setAttendanceDraftRows((prev) =>
            prev.map((r) => {
                if ((r.staff?.id ?? r.staffId) !== staffId) return r;
                return {
                    ...r,
                    status: upperVal,
                    leaveType: upperVal === "LEAVE" ? (r.leaveType || "CASUAL") : null,
                };
            })
        );
    };

    const handleSaveAttendanceDraft = () => {
        const records = attendanceDraftRows
            .filter((r) => r.status)
            .map((r) => ({
                staffId: r.staff?.id ?? r.staffId,
                status: r.status,
                leaveType: r.status === "LEAVE" ? (r.leaveType || "CASUAL") : undefined,
                notes: r.notes || "",
            }));

        if (!records.length) {
            toast({ title: "No records to save", description: "Mark at least one staff member before saving." });
            return;
        }

        saveAttendanceMutation.mutate({
            date: attendanceDateStr,
            records,
            role: attendanceRoleFilter !== "all" ? attendanceRoleFilter : undefined,
        });
    };

    const handleMarkAll = (status) => {
        setAttendanceDraftRows((prev) =>
            prev.map((r) => {
                const isLocked = r.generatedAt && (Date.now() - new Date(r.generatedAt).getTime()) > ATTENDANCE_EDIT_WINDOW_MS;
                if (isLocked) return r;
                return {
                    ...r,
                    status,
                    leaveType: status === "LEAVE" ? (r.leaveType || "CASUAL") : null,
                };
            })
        );
    };

    const handleGenerateAttendance = async (force = false) => {
        if (!force && isDateHoliday) {
            setPendingAction('generate');
            setOverrideDialogOpen(true);
            return;
        }

        try {
            await bulkMarkStaffAttendance({
                date: attendanceDateStr,
                role: attendanceRoleFilter !== "all" ? attendanceRoleFilter : undefined,
                autoGenerate: true,
            });
            await queryClient.invalidateQueries({ queryKey: ["staffAttendance", attendanceDateStr, attendanceRoleFilter] });
            await refetchAttendance();
            setConfirmDialog({ type: 'generate', date: attendanceDate });
        } catch (error) {
            toast({ title: "Failed to generate attendance", description: error.message, variant: "destructive" });
        }
    };

    const undoGenerateMutation = useMutation({
        mutationFn: () => deleteStaffAttendanceByDate(attendanceDateStr, attendanceRoleFilter !== "all" ? attendanceRoleFilter : undefined),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["staffAttendance", attendanceDateStr, attendanceRoleFilter] });
            await refetchAttendance();
            setConfirmDialog(null);
            toast({ title: "Attendance generation undone successfully" });
        },
        onError: (error) => {
            toast({ title: "Failed to undo", description: error.message, variant: "destructive" });
        },
    });

    const handleMarkDateHoliday = async (force = false) => {
        if (!force && isAttendanceGenerated) {
            setPendingAction('holiday');
            setOverrideDialogOpen(true);
            return;
        }

        try {
            const res = await markDateAsHoliday({
                date: attendanceDateStr,
                title: "Staff Holiday",
                type: "Staff",
            });
            await queryClient.invalidateQueries({ queryKey: ["holidays"] });
            await queryClient.invalidateQueries({ queryKey: ["staffAttendance", attendanceDateStr, attendanceRoleFilter] });
            await refetchAttendance();
            setConfirmDialog({ type: 'holiday', date: attendanceDate, holidayId: res?.holiday?.id });
        } catch (error) {
            toast({ title: "Failed to mark holiday", description: error.message, variant: "destructive" });
        }
    };

    const undoHolidayMutation = useMutation({
        mutationFn: (holidayId) => undoMarkHoliday(holidayId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["holidays"] });
            await queryClient.invalidateQueries({ queryKey: ["staffAttendance", attendanceDateStr, attendanceRoleFilter] });
            await refetchAttendance();
            setConfirmDialog(null);
            toast({ title: "Holiday undone successfully" });
        },
        onError: (error) => {
            toast({ title: "Failed to undo holiday", description: error.message, variant: "destructive" });
        },
    });

    const handleOverrideConfirm = () => {
        setOverrideDialogOpen(false);
        if (pendingAction === 'generate') {
            handleGenerateAttendance(true);
        } else if (pendingAction === 'holiday') {
            handleMarkDateHoliday(true);
        }
        setPendingAction(null);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Attendance Management</CardTitle>
                    <div className="flex items-center gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={`w-[240px] justify-start text-left font-normal ${!attendanceDate && "text-muted-foreground"}`}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {attendanceDate ? format(attendanceDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    mode="single"
                                    selected={attendanceDate}
                                    onSelect={(d) => d && setAttendanceDate(d)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Action buttons bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/40 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Select value={attendanceRoleFilter} onValueChange={setAttendanceRoleFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Staff" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Staff</SelectItem>
                                    <SelectItem value="teaching">Teaching Staff</SelectItem>
                                    <SelectItem value="non-teaching">Non-Teaching Staff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleGenerateAttendance(false)}
                                disabled={isFutureDate || attendanceLoading}
                            >
                                Generate Today's Attendance
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleMarkDateHoliday(false)}
                                disabled={isFutureDate || attendanceLoading}
                            >
                                Mark as Holiday
                            </Button>
                            <Button
                                onClick={handleSaveAttendanceDraft}
                                disabled={saveAttendanceMutation.isPending}
                            >
                                {saveAttendanceMutation.isPending && (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                )}
                                {saveAttendanceMutation.isPending ? "Saving..." : "Save Attendance"}
                            </Button>
                        </div>
                    </div>

                    {/* Quick status buttons */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Mark all visible as:</span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleMarkAll("PRESENT")}
                        >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Present
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleMarkAll("ABSENT")}
                        >
                            <XCircle className="w-4 h-4 mr-1" />
                            Absent
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => handleMarkAll("LATE")}
                        >
                            <Clock className="w-4 h-4 mr-1" />
                            Late
                        </Button>
                    </div>

                    {/* Attendance Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="py-2 px-3 text-sm">Staff</TableHead>
                                    <TableHead className="py-2 px-3 text-sm">Role</TableHead>
                                    <TableHead className="py-2 px-3 text-sm">Department</TableHead>
                                    <TableHead className="py-2 px-3 text-sm">Status</TableHead>
                                    <TableHead className="py-2 px-3 text-sm">Notes</TableHead>
                                    <TableHead className="py-2 px-3 text-sm">Audit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleAttendanceRows.map((record) => {
                                    const staff = record.staff || {};
                                    const isLocked = record.generatedAt && (Date.now() - new Date(record.generatedAt).getTime()) > ATTENDANCE_EDIT_WINDOW_MS;
                                    const auditTitle = record.markedAt
                                        ? `Marked at: ${new Date(record.markedAt).toLocaleString()}${record.admin?.name ? ` by ${record.admin.name}` : ''}`
                                        : record.generatedAt
                                            ? `Generated at: ${new Date(record.generatedAt).toLocaleString()}${record.generatedByName || record.admin?.name ? ` by ${record.generatedByName || record.admin.name}` : ''}`
                                            : null;

                                    return (
                                        <TableRow key={staff.id || record.id}>
                                            <TableCell className="py-2 px-3 text-sm">
                                                <div>
                                                    <p className="font-medium">{staff.name || "Unknown"}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{formatStaffId(staff.staffId, staff, staffIdSettings) || staff.staffId || ""}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-sm">
                                                {staff.isTeaching && staff.isNonTeaching ? (
                                                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Dual</span>
                                                ) : staff.isTeaching ? (
                                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Teaching</span>
                                                ) : (
                                                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Non-Teaching</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-sm">
                                                {staff.department?.name || staff.empDepartment?.replace("_", " ") || "-"}
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={record.status || "UNMARKED"}
                                                        disabled={isLocked}
                                                        onValueChange={(val) => handleAttendanceStatusChange(record, val)}
                                                    >
                                                        <SelectTrigger className="w-[130px]">
                                                            <SelectValue placeholder="Not Marked" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="UNMARKED">Not Marked</SelectItem>
                                                            <SelectItem value="PRESENT">Present</SelectItem>
                                                            <SelectItem value="ABSENT">Absent</SelectItem>
                                                            <SelectItem value="LEAVE">Leave</SelectItem>
                                                            <SelectItem value="LATE">Late</SelectItem>
                                                            <SelectItem value="HALF_DAY">Half Day</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {record.status === "LEAVE" && (
                                                        <Select
                                                            value={record.leaveType || "CASUAL"}
                                                            disabled={isLocked}
                                                            onValueChange={(val) =>
                                                                setAttendanceDraftRows((prev) =>
                                                                    prev.map((r) =>
                                                                        r.staff?.id === record.staff?.id
                                                                            ? { ...r, leaveType: String(val).toUpperCase() }
                                                                            : r
                                                                    )
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger className="w-[120px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="CASUAL">Casual</SelectItem>
                                                                <SelectItem value="SICK">Sick</SelectItem>
                                                                <SelectItem value="ANNUAL">Annual</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                    {isLocked ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="text-amber-500 cursor-help"><LockKeyhole className="w-3.5 h-3.5" /></span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="text-xs max-w-[240px] whitespace-pre-line">
                                                                Locked — attendance can only be modified within 48 hours of generation.{auditTitle ? `\n${auditTitle}` : ""}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : auditTitle ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="text-muted-foreground/50 cursor-help"><CalendarIcon className="w-3 h-3" /></span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="text-xs max-w-[200px] whitespace-pre-line">{auditTitle}</TooltipContent>
                                                        </Tooltip>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-sm">
                                                <Input
                                                    className="h-8 w-[200px]"
                                                    placeholder="Notes..."
                                                    disabled={isLocked}
                                                    value={record.notes || ""}
                                                    onChange={(e) =>
                                                        setAttendanceDraftRows((prev) =>
                                                            prev.map((r) =>
                                                                r.staff?.id === record.staff?.id
                                                                    ? { ...r, notes: e.target.value }
                                                                    : r
                                                            )
                                                        )
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="py-2 px-3 text-sm">
                                                {record.autoGenerated ? (
                                                    <div className="text-xs space-y-0.5">
                                                        <div className="text-muted-foreground">Auto-generated</div>
                                                        {record.generatedAt && (
                                                            <div className="text-[10px] text-muted-foreground">{new Date(record.generatedAt).toLocaleString()}</div>
                                                        )}
                                                        {(record.generatedByName || record.admin?.name) && (
                                                            <div className="text-[10px] font-medium text-primary">
                                                                by {record.generatedByName || record.admin?.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs space-y-0.5">
                                                        <div className="text-muted-foreground">Manual</div>
                                                        {record.markedAt && (
                                                            <div className="text-[10px] text-muted-foreground">{new Date(record.markedAt).toLocaleString()}</div>
                                                        )}
                                                        {record.admin?.name && (
                                                            <div className="text-[10px] font-medium text-primary">by {record.admin.name}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {visibleAttendanceRows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-2 px-3 text-sm text-center">
                                            No attendance records found for this date.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AttendanceConfirmationDialog
                open={confirmDialog !== null}
                actionType={confirmDialog?.type}
                date={confirmDialog?.date}
                holidayId={confirmDialog?.holidayId}
                onUndo={() => {
                    if (confirmDialog?.type === 'generate') {
                        undoGenerateMutation.mutate(confirmDialog.date);
                    } else if (confirmDialog?.type === 'holiday') {
                        undoHolidayMutation.mutate(confirmDialog.holidayId);
                    }
                }}
                onClose={() => setConfirmDialog(null)}
                isUndoing={undoGenerateMutation.isPending || undoHolidayMutation.isPending}
            />

            {/* Override confirmation dialog */}
            <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {pendingAction === 'generate' ? "Generate on Holiday?" : "Mark Holiday with Existing Attendance?"}
                        </DialogTitle>
                        <DialogDescription>
                            {pendingAction === 'generate'
                                ? `${format(attendanceDate, "PPP")} is marked as a holiday. Do you still want to generate attendance?`
                                : `Attendance has already been generated for ${format(attendanceDate, "PPP")}. Marking as holiday will delete existing attendance records for the selected role. Continue?`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setOverrideDialogOpen(false); setPendingAction(null); }}>Cancel</Button>
                        <Button onClick={handleOverrideConfirm}>Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
