import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  CheckCircle2,
  XCircle,
  Clock,
  LockKeyhole,
  Info,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getStaffAttendance,
  getStaffLeaveBalance,
  markStaffAttendance,
  bulkMarkStaffAttendance,
  deleteStaffAttendanceRecord,
  getHolidays,
} from "@/services/api";

const ATTENDANCE_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export const getLeaveInfo = (leaveType) => {
  const t = String(leaveType || "CASUAL").toUpperCase();
  if (t === "SICK" || t === "SK") {
    return {
      code: "SK",
      label: "Sick Leave",
      badgeClass: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-200",
    };
  }
  if (t === "ANNUAL" || t === "AL") {
    return {
      code: "AL",
      label: "Annual Leave",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-200",
    };
  }
  return {
    code: "CL",
    label: "Casual Leave",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200",
  };
};

export const formatTime12h = (timeStr) => {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return timeStr;
  const hour = parseInt(parts[0], 10);
  const minute = parts[1];
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minute} ${ampm}`;
};

export const AttendanceTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = usePermissions("HR & Payroll", "attendance");
  const canEditAttendance = canCreate || canUpdate;

  const [staffAttendanceDate, setStaffAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [staffAttendanceRole, setStaffAttendanceRole] = useState("all");
  const [staffAttendanceChanges, setStaffAttendanceChanges] = useState({});
  const [leaveTypePopover, setLeaveTypePopover] = useState({
    staffId: null,
    leaveType: "casual",
  });
  const [presentPopover, setPresentPopover] = useState({
    staffId: null,
    checkInTime: "08:30",
  });
  const [halfDayPopover, setHalfDayPopover] = useState({
    staffId: null,
    checkInTime: "08:30",
    checkOutTime: "12:30",
  });

  const {
    data: staffAttendanceRows = [],
    isFetching: staffAttendanceLoading,
    refetch: refetchStaffAttendance,
  } = useQuery({
    queryKey: ["staffAttendance", staffAttendanceDate, staffAttendanceRole],
    queryFn: () => getStaffAttendance(staffAttendanceDate, staffAttendanceRole),
  });

  const staffAttendanceMonth = staffAttendanceDate
    ? staffAttendanceDate.slice(0, 7)
    : new Date().toISOString().slice(0, 7);

  const staffLeaveBalanceQueries = useQueries({
    queries: staffAttendanceRows.map((row) => {
      const sid = String(row.staffId || row.staff?.id || row.staff?._id || "");
      return {
        queryKey: ["staffLeaveBalance", sid, staffAttendanceMonth],
        queryFn: () => getStaffLeaveBalance(sid, staffAttendanceMonth),
        enabled: !!sid,
        staleTime: 60 * 1000,
      };
    }),
  });

  const staffLeaveBalanceById = useMemo(() => {
    const balances = {};
    staffAttendanceRows.forEach((row, idx) => {
      const sid = String(row.staffId || row.staff?.id || row.staff?._id || "");
      if (!sid) return;
      const data = staffLeaveBalanceQueries[idx]?.data;
      if (data) balances[sid] = data;
    });
    return balances;
  }, [staffAttendanceRows, staffLeaveBalanceQueries]);

  const hasExistingAttendance = useMemo(() => {
    return staffAttendanceRows.some((r) => !!r.id || (!!r.status && !r.isApprovedLeave && !r.isHoliday));
  }, [staffAttendanceRows]);

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: getHolidays,
  });

  const activeHoliday = useMemo(() => {
    if (staffAttendanceRows.length > 0) {
      const holidayRow = staffAttendanceRows.find((r) => r.isHoliday);
      if (holidayRow) {
        return {
          title: holidayRow.holidayTitle || "Holiday",
          isHoliday: true,
        };
      }
    }
    if (!staffAttendanceDate || !holidays.length) return null;
    const match = holidays.find((h) => {
      const s = typeof h.date === "string" ? h.date.slice(0, 10) : new Date(h.date).toISOString().slice(0, 10);
      const e = h.endDate ? (typeof h.endDate === "string" ? h.endDate.slice(0, 10) : new Date(h.endDate).toISOString().slice(0, 10)) : s;
      return staffAttendanceDate >= s && staffAttendanceDate <= e;
    });
    return match ? { title: match.title || "Holiday", isHoliday: true } : null;
  }, [staffAttendanceRows, staffAttendanceDate, holidays]);

  const isHolidayDate = Boolean(activeHoliday?.isHoliday);

  const handleFetchAttendance = async () => {
    setStaffAttendanceChanges({});
    await refetchStaffAttendance();
  };

  const setStaffAttendanceStatus = async (staffId, status) => {
    if (isHolidayDate) {
      toast({
        title: "Holiday date",
        description: "Attendance actions are blocked on a holiday.",
        variant: "destructive",
      });
      return;
    }
    const staffIdStr = String(staffId);
    const row = staffAttendanceRows.find(
      (item) => String(item.staffId || item.staff?.id || item.staff?._id) === staffIdStr
    );
    if (row?.isHoliday) {
      toast({
        title: "Holiday date",
        description: "Attendance actions are blocked on a holiday.",
        variant: "destructive",
      });
      return;
    }
    const changed = staffAttendanceChanges[staffIdStr];
    const changedStatus = typeof changed === "string" ? changed : changed?.status;
    const dbStatus = String(row?.status || "").toLowerCase();
    const currentStatus = changedStatus || dbStatus;

    if (currentStatus === status) {
      if (row?.id && dbStatus === status) {
        try {
          await deleteStaffAttendanceRecord({
            staffId: staffIdStr,
            date: staffAttendanceDate,
            attendanceId: row.id,
          });
          setStaffAttendanceChanges((prev) => {
            const next = { ...prev };
            delete next[staffIdStr];
            return next;
          });
          await queryClient.invalidateQueries({ queryKey: ["staffAttendance"] });
          await queryClient.invalidateQueries({ queryKey: ["staffLeaveBalance"] });
          await queryClient.invalidateQueries({ queryKey: ["leaveSheet"] });
          await queryClient.invalidateQueries({ queryKey: ["payrollSheet"] });
          await refetchStaffAttendance();
          toast({
            title: "Attendance removed",
            description: "Staff row is now Not Marked.",
          });
        } catch (error) {
          toast({
            title: "Failed to remove staff attendance",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      setStaffAttendanceChanges((prev) => {
        const next = { ...prev };
        delete next[staffIdStr];
        return next;
      });
      return;
    }

    setStaffAttendanceChanges((prev) => {
      const prevRow = prev?.[staffIdStr];
      const prevLeaveType =
        typeof prevRow === "object" && prevRow !== null ? prevRow.leaveType : undefined;
      const prevCheckIn =
        typeof prevRow === "object" && prevRow !== null ? prevRow.checkInTime : undefined;
      const prevCheckOut =
        typeof prevRow === "object" && prevRow !== null ? prevRow.checkOutTime : undefined;
      return {
        ...prev,
        [staffIdStr]: {
          status,
          leaveType: status === "leave" ? prevLeaveType || row?.leaveType || "casual" : undefined,
          checkInTime:
            status === "present"
              ? prevCheckIn || row?.checkInTime || new Date().toTimeString().slice(0, 5)
              : status === "half_day"
              ? prevCheckIn || row?.checkInTime || "08:30"
              : undefined,
          checkOutTime:
            status === "half_day"
              ? prevCheckOut || row?.checkOutTime || "12:30"
              : undefined,
        },
      };
    });
  };

  const openPresentPicker = (row, staffMeta) => {
    const sid = String(row.staffId || staffMeta?.id || staffMeta?._id || "");
    if (!sid) return;
    const changed = staffAttendanceChanges[sid];
    const currentCheckIn =
      (typeof changed === "object" && changed !== null ? changed.checkInTime : undefined) ||
      row.checkInTime ||
      new Date().toTimeString().slice(0, 5);
    setPresentPopover({
      staffId: sid,
      checkInTime: currentCheckIn || "08:30",
    });
  };

  const closePresentPicker = () => {
    setPresentPopover({
      staffId: null,
      checkInTime: "08:30",
    });
  };

  const confirmPresentPicker = () => {
    if (!presentPopover.staffId) return;
    const sid = String(presentPopover.staffId);
    setStaffAttendanceChanges((prev) => ({
      ...prev,
      [sid]: {
        status: "present",
        checkInTime: presentPopover.checkInTime || new Date().toTimeString().slice(0, 5),
      },
    }));
    closePresentPicker();
  };

  const openHalfDayPicker = (row, staffMeta) => {
    const sid = String(row.staffId || staffMeta?.id || staffMeta?._id || "");
    if (!sid) return;
    const changed = staffAttendanceChanges[sid];
    const currentCheckIn =
      (typeof changed === "object" && changed !== null ? changed.checkInTime : undefined) ||
      row.checkInTime ||
      "08:30";
    const currentCheckOut =
      (typeof changed === "object" && changed !== null ? changed.checkOutTime : undefined) ||
      row.checkOutTime ||
      "12:30";
    setHalfDayPopover({
      staffId: sid,
      checkInTime: currentCheckIn,
      checkOutTime: currentCheckOut,
    });
  };

  const closeHalfDayPicker = () => {
    setHalfDayPopover({
      staffId: null,
      checkInTime: "08:30",
      checkOutTime: "12:30",
    });
  };

  const confirmHalfDayPicker = () => {
    if (!halfDayPopover.staffId) return;
    const sid = String(halfDayPopover.staffId);
    setStaffAttendanceChanges((prev) => ({
      ...prev,
      [sid]: {
        status: "half_day",
        checkInTime: halfDayPopover.checkInTime || "08:30",
        checkOutTime: halfDayPopover.checkOutTime || "12:30",
      },
    }));
    closeHalfDayPicker();
  };

  const openLeaveTypePicker = (row, staffMeta) => {
    const sid = String(row.staffId || staffMeta?.id || staffMeta?._id || "");
    if (!sid) return;
    const changed = staffAttendanceChanges[sid];
    const currentLeaveType =
      (typeof changed === "object" && changed !== null ? changed.leaveType : undefined) ||
      String(row.leaveType || "CASUAL").toLowerCase();
    setLeaveTypePopover({
      staffId: sid,
      leaveType: currentLeaveType,
    });
  };

  const closeLeaveTypePicker = () => {
    setLeaveTypePopover({
      staffId: null,
      leaveType: "casual",
    });
  };

  const confirmLeaveTypePicker = () => {
    if (!leaveTypePopover.staffId) return;
    const sid = String(leaveTypePopover.staffId);
    setStaffAttendanceChanges((prev) => ({
      ...prev,
      [sid]: {
        status: "leave",
        leaveType: leaveTypePopover.leaveType || "casual",
      },
    }));
    closeLeaveTypePicker();
  };

  const isStaffAttendanceLocked = (record) => {
    const lockTimestamp = record?.generatedAt || record?.markedAt;
    return lockTimestamp
      ? Date.now() - new Date(lockTimestamp).getTime() > ATTENDANCE_EDIT_WINDOW_MS
      : false;
  };

  const handleSaveStaffAttendance = async () => {
    const editableRows = staffAttendanceRows.filter((row) => !isStaffAttendanceLocked(row));

    const payloads = editableRows
      .map((row) => {
        const staffId = String(row.staffId || row.staff?.id || row.staff?._id || row.id || "");
        if (!staffId) return null;
        const changed = staffAttendanceChanges[staffId];
        const changedStatus = typeof changed === "string" ? changed : changed?.status;
        const changedLeaveType =
          typeof changed === "object" && changed !== null ? changed.leaveType : undefined;
        const changedCheckInTime =
          typeof changed === "object" && changed !== null ? changed.checkInTime : undefined;
        const changedCheckOutTime =
          typeof changed === "object" && changed !== null ? changed.checkOutTime : undefined;

        // Save status: changed status takes precedence, otherwise existing row status
        const effectiveStatus = (changedStatus || row.status || "").toLowerCase();
        if (!effectiveStatus || effectiveStatus === "null" || effectiveStatus === "undefined") {
          return null;
        }

        const effectiveLeaveType =
          changedLeaveType ||
          row.leaveType ||
          (effectiveStatus === "leave" ? "CASUAL" : undefined);

        const effectiveCheckInTime =
          changedCheckInTime !== undefined
            ? changedCheckInTime
            : (effectiveStatus === "present" || effectiveStatus === "half_day" ? (row.checkInTime || "") : "");

        const effectiveCheckOutTime =
          changedCheckOutTime !== undefined
            ? changedCheckOutTime
            : (effectiveStatus === "half_day" ? (row.checkOutTime || "") : "");

        return {
          staffId,
          date: staffAttendanceDate,
          status: effectiveStatus.toUpperCase(),
          leaveType:
            effectiveStatus === "leave"
              ? String(effectiveLeaveType || "CASUAL").toUpperCase()
              : undefined,
          checkInTime: effectiveCheckInTime,
          checkOutTime: effectiveCheckOutTime,
          notes: row.notes || (row.isApprovedLeave ? row.leaveReason || "Approved Leave" : ""),
        };
      })
      .filter(Boolean);

    if (payloads.length === 0) {
      toast({
        title: "No marked attendance entries to save",
        description: "Mark attendance status for staff first.",
        variant: "destructive",
      });
      return;
    }

    try {
      await bulkMarkStaffAttendance({
        date: staffAttendanceDate,
        role: staffAttendanceRole,
        rows: payloads,
      });
      toast({
        title: `Attendance saved for ${payloads.length} staff member(s)`,
      });
      setStaffAttendanceChanges({});
      await queryClient.invalidateQueries({ queryKey: ["staffAttendance"] });
      await queryClient.invalidateQueries({ queryKey: ["staffLeaveBalance"] });
      await queryClient.invalidateQueries({ queryKey: ["leaveSheet"] });
      await queryClient.invalidateQueries({ queryKey: ["payrollSheet"] });
      await refetchStaffAttendance();
    } catch (error) {
      toast({
        title: "Failed to save staff attendance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMarkAllStaff = (status) => {
    if (isHolidayDate) {
      toast({
        title: "Holiday date",
        description: "Attendance actions are blocked on a holiday.",
        variant: "destructive",
      });
      return;
    }
    const currentTime = new Date().toTimeString().slice(0, 5);
    const next = { ...staffAttendanceChanges };
    staffAttendanceRows.forEach((row) => {
      const sid = String(row.staffId || row.staff?.id || row.staff?._id || "");
      if (sid && !isStaffAttendanceLocked(row)) {
        next[sid] = {
          status,
          leaveType: status === "leave" ? row.leaveType || "casual" : undefined,
          checkInTime:
            status === "present"
              ? row.checkInTime || currentTime
              : status === "half_day"
              ? row.checkInTime || "08:30"
              : undefined,
          checkOutTime:
            status === "half_day"
              ? row.checkOutTime || "12:30"
              : undefined,
        };
      }
    });
    setStaffAttendanceChanges(next);
  };

  return (
    <div className="space-y-6">
      <Card>
      <CardHeader className="pb-4 border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Staff Attendance</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Load staff, mark each status, then save attendance for the selected date.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Filters and Actions Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground shrink-0">Date:</Label>
              <Input
                type="date"
                className="w-[155px] h-9"
                value={staffAttendanceDate}
                onChange={(e) => {
                  setStaffAttendanceDate(e.target.value);
                  setStaffAttendanceChanges({});
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground shrink-0">Role:</Label>
              <Select
                value={staffAttendanceRole}
                onValueChange={(value) => {
                  setStaffAttendanceRole(value);
                  setStaffAttendanceChanges({});
                }}
              >
                <SelectTrigger className="w-[155px] h-9">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  <SelectItem value="teaching">Teaching</SelectItem>
                  <SelectItem value="non-teaching">Non-Teaching</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={handleFetchAttendance}
              disabled={staffAttendanceLoading}
            >
              {staffAttendanceLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {hasExistingAttendance ? "Fetch Attendance" : "Fetch Staff"}
            </Button>
            {canEditAttendance && (
              <Button
                size="sm"
                className="h-9 font-medium"
                onClick={handleSaveStaffAttendance}
                disabled={!staffAttendanceRows.length || staffAttendanceLoading}
              >
                Save Attendance
              </Button>
            )}
          </div>

          {canEditAttendance && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                onClick={() => handleMarkAllStaff("present")}
                disabled={!staffAttendanceRows.length || isHolidayDate}
              >
                Mark All Present
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                onClick={() => handleMarkAllStaff("absent")}
                disabled={!staffAttendanceRows.length || isHolidayDate}
              >
                Mark All Absent
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                onClick={() => handleMarkAllStaff("leave")}
                disabled={!staffAttendanceRows.length || isHolidayDate}
              >
                Mark All Leave
              </Button>
              {isHolidayDate && (
                <Badge
                  variant="outline"
                  className="text-xs bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
                >
                  {activeHoliday?.title || "Holiday"} · Actions Blocked
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Staff Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Role / Department</TableHead>
                <TableHead className="py-2 px-3 text-sm">Status</TableHead>
                <TableHead className="py-2 px-3 text-sm">Marked At</TableHead>
                <TableHead className="py-2 px-3 text-sm">Marked By</TableHead>
                <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffAttendanceLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading staff...
                  </TableCell>
                </TableRow>
              ) : staffAttendanceRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Select filters to load staff, mark attendance, then save.
                  </TableCell>
                </TableRow>
              ) : (
                staffAttendanceRows.map((row) => {
                  const s = row.staff || row;
                  const sid = String(row.staffId || s.id || s._id || "");
                  const changed = staffAttendanceChanges[sid];
                  const currentStatus =
                    (typeof changed === "string" ? changed : changed?.status) ||
                    row.status?.toLowerCase();
                  const currentLeaveType =
                    (typeof changed === "object" && changed !== null
                      ? changed.leaveType
                      : undefined) || String(row.leaveType || "CASUAL").toLowerCase();
                  const effectiveCheckInTime =
                    (typeof changed === "object" && changed !== null ? changed.checkInTime : undefined) !== undefined
                      ? changed.checkInTime
                      : row.checkInTime || "";
                  const effectiveCheckOutTime =
                    (typeof changed === "object" && changed !== null ? changed.checkOutTime : undefined) !== undefined
                      ? changed.checkOutTime
                      : row.checkOutTime || "";
                  const leaveInfo = getLeaveInfo(currentLeaveType);
                  const isLocked = isStaffAttendanceLocked(row);
                  const auditLines = [];
                  if (row.generatedAt)
                    auditLines.push(`Generated: ${new Date(row.generatedAt).toLocaleString()}`);
                  if (row.markedAt) {
                    const markerName =
                      row.admin?.name || (row.markedBy ? `User #${row.markedBy}` : "Unknown");
                    auditLines.push(`Marked: ${new Date(row.markedAt).toLocaleString()}`);
                    auditLines.push(`Marked by: ${markerName}`);
                  }
                  const markedByName =
                    row.admin?.name || (row.markedBy ? `User #${row.markedBy}` : "-");
                  const roleLabel =
                    s.isTeaching && s.isNonTeaching
                      ? "Dual"
                      : s.isTeaching
                      ? "Teaching"
                      : "Non-Teaching";
                  const deptLabel =
                    s.department?.name ||
                    s.empDepartment ||
                    s.designation ||
                    s.specialization ||
                    "-";
                  const leaveBalance = staffLeaveBalanceById[sid];

                  return (
                    <TableRow
                      key={sid}
                      className={isLocked ? "opacity-80" : ""}
                    >
                      <TableCell className="py-2 px-3 text-sm font-medium">
                        {s.name}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <div>{roleLabel}</div>
                        <div className="text-xs text-muted-foreground">{deptLabel}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          <Badge variant="outline" className="font-normal">
                            CL {leaveBalance?.CASUAL?.taken ?? 0}/
                            {leaveBalance?.CASUAL?.allowed ?? 0}
                          </Badge>
                          <Badge variant="outline" className="font-normal">
                            SK {leaveBalance?.SICK?.taken ?? 0}/
                            {leaveBalance?.SICK?.allowed ?? 0}
                          </Badge>
                          <Badge variant="outline" className="font-normal">
                            AL {leaveBalance?.ANNUAL?.taken ?? 0}/
                            {leaveBalance?.ANNUAL?.allowed ?? 0}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {currentStatus === "leave" ? (
                            <Badge
                              variant="outline"
                              className={`font-medium ${leaveInfo.badgeClass}`}
                            >
                              {leaveInfo.code} · {leaveInfo.label}
                            </Badge>
                          ) : currentStatus === "hd" || currentStatus === "holiday" ? (
                            <Badge
                              variant="outline"
                              className="font-medium bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-200"
                            >
                              HD · Holiday
                            </Badge>
                          ) : currentStatus ? (
                            <>
                              <Badge
                                variant={
                                  currentStatus === "present"
                                    ? "default"
                                    : currentStatus === "absent"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {currentStatus === "half_day" ? "HALF DAY" : currentStatus.replace("_", " ").toUpperCase()}
                              </Badge>
                              {currentStatus === "present" && effectiveCheckInTime && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      onClick={() => !isLocked && openPresentPicker(row, s)}
                                      className={`text-[11px] font-medium bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 ${!isLocked ? "cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900" : ""}`}
                                    >
                                      In: {formatTime12h(effectiveCheckInTime)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isLocked ? "Locked" : "Click to edit check-in time"}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {currentStatus === "half_day" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      onClick={() => !isLocked && openHalfDayPicker(row, s)}
                                      className={`text-[11px] font-medium bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 ${!isLocked ? "cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900" : ""}`}
                                    >
                                      {formatTime12h(effectiveCheckInTime) || "--:--"} - {formatTime12h(effectiveCheckOutTime) || "--:--"}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isLocked ? "Locked" : "Click to edit in/out times"}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {currentStatus === "absent" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 font-normal"
                                >
                                  -PKR {Number(leaveBalance?.absentDeduction || s.absentDeduction || (s.basicPay ? Math.round(Number(s.basicPay) / 30) : 0)).toLocaleString()}/day
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Not Marked</span>
                          )}
                          {row.isHoliday && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
                            >
                              {row.holidayTitle || "Holiday"}
                            </Badge>
                          )}
                          {row.isApprovedLeave && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              Approved Leave
                            </Badge>
                          )}
                          {isLocked && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <LockKeyhole className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs max-w-[240px] whitespace-pre-line">
                                Locked - attendance can only be modified within 48 hours.
                                {auditLines.length ? `\n${auditLines.join("\n")}` : ""}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm text-muted-foreground">
                        {row.markedAt ? new Date(row.markedAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm text-muted-foreground">
                        {row.markedAt ? markedByName : "-"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {isHolidayDate || row.isHoliday ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-xs text-purple-600 cursor-not-allowed font-medium">
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                  Holiday - Blocked
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Attendance actions are blocked on holidays</TooltipContent>
                          </Tooltip>
                        ) : !canEditAttendance ? (
                          <div className="flex items-center gap-1">
                            {currentStatus === "present" && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-semibold">
                                Present {row.checkInTime ? `(${formatTime12h(row.checkInTime)})` : ""}
                              </Badge>
                            )}
                            {currentStatus === "absent" && (
                              <Badge variant="destructive">Absent</Badge>
                            )}
                            {currentStatus === "halfday" && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-semibold">
                                Half Day
                              </Badge>
                            )}
                            {currentStatus === "leave" && (
                              <Badge variant="outline" className={`font-semibold ${leaveInfo.badgeClass}`}>
                                {leaveInfo.code} ({leaveInfo.label})
                              </Badge>
                            )}
                            {!currentStatus && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Popover
                              open={String(presentPopover.staffId || "") === sid}
                              onOpenChange={(open) => {
                                if (open) {
                                  openPresentPicker(row, s);
                                } else {
                                  closePresentPicker();
                                }
                              }}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <PopoverTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant={currentStatus === "present" ? "default" : "outline"}
                                      disabled={isLocked}
                                      onClick={(event) => {
                                        if (currentStatus === "present") {
                                          event.preventDefault();
                                          setStaffAttendanceStatus(sid, "present");
                                        }
                                      }}
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </Button>
                                  </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isLocked
                                    ? "Locked - 48h window has passed"
                                    : currentStatus === "present"
                                    ? "Click to remove Present status"
                                    : "Mark Present (Set Check-in Time)"}
                                </TooltipContent>
                              </Tooltip>
                              <PopoverContent
                                side="right"
                                align="start"
                                className="w-64 p-3 space-y-3"
                              >
                                <div>
                                  <h4 className="text-xs font-semibold">Mark Present</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Set check-in time for {s.name}
                                  </p>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs">Check-in Time</Label>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                      onClick={() =>
                                        setPresentPopover((prev) => ({
                                          ...prev,
                                          checkInTime: new Date().toTimeString().slice(0, 5),
                                        }))
                                      }
                                    >
                                      Set to Now
                                    </Button>
                                  </div>
                                  <Input
                                    type="time"
                                    className="h-8 text-xs"
                                    value={presentPopover.checkInTime}
                                    onChange={(e) =>
                                      setPresentPopover((prev) => ({
                                        ...prev,
                                        checkInTime: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={closePresentPicker}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={confirmPresentPicker}
                                  >
                                    Set Present
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant={currentStatus === "absent" ? "destructive" : "outline"}
                                  disabled={isLocked}
                                  onClick={() =>
                                    setStaffAttendanceStatus(sid, "absent")
                                  }
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isLocked ? "Locked - 48h window has passed" : "Mark Absent"}
                              </TooltipContent>
                            </Tooltip>
                            <Popover
                              open={String(leaveTypePopover.staffId || "") === sid}
                              onOpenChange={(open) => {
                                if (open) {
                                  openLeaveTypePicker(row, s);
                                } else {
                                  closeLeaveTypePicker();
                                }
                              }}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <PopoverTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant={currentStatus === "leave" ? "secondary" : "outline"}
                                      disabled={isLocked}
                                      onClick={(event) => {
                                        if (currentStatus === "leave") {
                                          event.preventDefault();
                                          setStaffAttendanceStatus(sid, "leave");
                                        }
                                      }}
                                    >
                                      <Clock className="w-4 h-4" />
                                    </Button>
                                  </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isLocked
                                    ? "Locked - 48h window has passed"
                                    : "Mark Leave (Select Type)"}
                                </TooltipContent>
                              </Tooltip>
                              <PopoverContent
                                side="right"
                                align="start"
                                className="w-64 p-3 space-y-2"
                              >
                                <p className="text-xs text-muted-foreground">
                                  Choose leave type for {s.name}
                                </p>
                                <Select
                                  value={leaveTypePopover.leaveType}
                                  onValueChange={(value) =>
                                    setLeaveTypePopover((prev) => ({ ...prev, leaveType: value }))
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="casual">CL · Casual Leave</SelectItem>
                                    <SelectItem value="sick">SK · Sick Leave</SelectItem>
                                    <SelectItem value="annual">AL · Annual Leave</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={closeLeaveTypePicker}
                                  >
                                    Cancel
                                  </Button>
                                  <Button size="sm" onClick={confirmLeaveTypePicker}>
                                    Set Leave
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Popover
                              open={String(halfDayPopover.staffId || "") === sid}
                              onOpenChange={(open) => {
                                if (open) {
                                  openHalfDayPicker(row, s);
                                } else {
                                  closeHalfDayPicker();
                                }
                              }}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <PopoverTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant={currentStatus === "half_day" ? "secondary" : "outline"}
                                      disabled={isLocked}
                                      onClick={(event) => {
                                        if (currentStatus === "half_day") {
                                          event.preventDefault();
                                          setStaffAttendanceStatus(sid, "half_day");
                                        }
                                      }}
                                    >
                                      1/2
                                    </Button>
                                  </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isLocked
                                    ? "Locked - 48h window has passed"
                                    : currentStatus === "half_day"
                                    ? "Click to remove Half Day status"
                                    : "Mark Half Day (Set In & Out Times)"}
                                </TooltipContent>
                              </Tooltip>
                              <PopoverContent
                                side="right"
                                align="start"
                                className="w-64 p-3 space-y-3"
                              >
                                <div>
                                  <h4 className="text-xs font-semibold">Mark Half Day</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Set check-in & check-out for {s.name}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs">Check-in Time</Label>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                          setHalfDayPopover((prev) => ({
                                            ...prev,
                                            checkInTime: new Date().toTimeString().slice(0, 5),
                                          }))
                                        }
                                      >
                                        Now
                                      </Button>
                                    </div>
                                    <Input
                                      type="time"
                                      className="h-8 text-xs"
                                      value={halfDayPopover.checkInTime}
                                      onChange={(e) =>
                                        setHalfDayPopover((prev) => ({
                                          ...prev,
                                          checkInTime: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs">Check-out Time</Label>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                          setHalfDayPopover((prev) => ({
                                            ...prev,
                                            checkOutTime: new Date().toTimeString().slice(0, 5),
                                          }))
                                        }
                                      >
                                        Now
                                      </Button>
                                    </div>
                                    <Input
                                      type="time"
                                      className="h-8 text-xs"
                                      value={halfDayPopover.checkOutTime}
                                      onChange={(e) =>
                                        setHalfDayPopover((prev) => ({
                                          ...prev,
                                          checkOutTime: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={closeHalfDayPicker}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={confirmHalfDayPicker}
                                  >
                                    Set Half Day
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                            {currentStatus === "leave" && (
                              <Badge
                                variant="outline"
                                className={`font-semibold ${leaveInfo.badgeClass}`}
                              >
                                {leaveInfo.code} ({leaveInfo.label})
                              </Badge>
                            )}
                            {currentStatus === "leave" && !!row.leaveReason && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="text-xs max-w-[260px] whitespace-pre-line">
                                  {`Leave reason: ${row.leaveReason}${
                                    row.leaveStartDate && row.leaveEndDate
                                      ? `\nPeriod: ${new Date(
                                          row.leaveStartDate
                                        ).toLocaleDateString()} - ${new Date(
                                          row.leaveEndDate
                                        ).toLocaleDateString()}`
                                      : ""
                                  }`}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
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
  </div>
);
};

export default AttendanceTab;
