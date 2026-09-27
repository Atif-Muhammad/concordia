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
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  Calendar as CalendarIcon,
  Plus,
  XCircle,
} from "lucide-react";
import {
  getHolidays,
  createHoliday,
  deleteHoliday,
  getProgramNames,
  getAttendanceSkips,
  deleteAttendanceSkip,
} from "@/services/api";

export const HolidaysTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions("HR & Payroll", "holidays");

  const [holidayFilter, setHolidayFilter] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [undoHolidayDialog, setUndoHolidayDialog] = useState(null);
  const [lastRemovedHoliday, setLastRemovedHoliday] = useState(null);
  const [holidayFormData, setHolidayFormData] = useState({
    title: "",
    date: { from: new Date(), to: new Date() },
    type: "National",
    repeatYearly: false,
    description: "",
  });

  const [calendarClassId, setCalendarClassId] = useState("all");
  const [calendarSectionId, setCalendarSectionId] = useState("all");

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: getHolidays,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: getProgramNames,
  });

  const allCalendarClasses = useMemo(() =>
    programs.flatMap((p) => (p.classes || []).map((c) => ({ ...c, programName: p.name }))),
    [programs]
  );

  const calendarSections = useMemo(() => {
    if (!calendarClassId || calendarClassId === "all") return [];
    const cls = allCalendarClasses.find((c) => String(c.id) === calendarClassId);
    return cls?.sections || [];
  }, [calendarClassId, allCalendarClasses]);

  const handleCalendarClassChange = (val) => {
    setCalendarClassId(val);
    setCalendarSectionId("all");
  };

  const { data: classSkips = [] } = useQuery({
    queryKey: ["attendanceSkips", calendarClassId, calendarSectionId],
    queryFn: () => {
      const sid = calendarSectionId !== "all" ? calendarSectionId : undefined;
      return getAttendanceSkips(calendarClassId, sid);
    },
    enabled: !!calendarClassId && calendarClassId !== "all",
  });

  const calendarHolidays = useMemo(() => {
    const toLocalDateStr = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    };
    const globalEntries = holidays
      .filter((h) => {
        const ds = toLocalDateStr(h.date);
        const [y, m] = ds.split("-").map(Number);
        return y === holidayFilter.year && m === holidayFilter.month;
      })
      .map((h) => ({ ...h, _type: "global" }));

    const skipEntries = classSkips
      .filter((s) => {
        const ds = toLocalDateStr(s.date);
        const [y, m] = ds.split("-").map(Number);
        return y === holidayFilter.year && m === holidayFilter.month;
      })
      .map((s) => ({ ...s, title: s.reason || "Class Holiday", _type: "skip" }));

    const merged = new Map();
    globalEntries.forEach((e) => merged.set(toLocalDateStr(e.date), e));
    skipEntries.forEach((e) => merged.set(toLocalDateStr(e.date), e));
    return Array.from(merged.values());
  }, [holidays, classSkips, holidayFilter]);

  const calendarGrid = useMemo(() => {
    const year = holidayFilter.year;
    const month = holidayFilter.month;
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const toLocalDay = (dateStr) => {
      const d = new Date(dateStr);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).getDate();
    };
    const holidayDates = new Set(calendarHolidays.map((h) => toLocalDay(h.date)));
    const holidayMap = {};
    calendarHolidays.forEach((h) => {
      holidayMap[toLocalDay(h.date)] = h;
    });
    return { firstDay, daysInMonth, holidayDates, holidayMap };
  }, [calendarHolidays, holidayFilter]);

  const createHolidayMutation = useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast({ title: "Holiday created successfully" });
      setHolidayOpen(false);
      setHolidayFormData({
        title: "",
        date: { from: new Date(), to: new Date() },
        type: "National",
        repeatYearly: false,
        description: "",
      });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast({ title: "Holiday removed successfully" });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteSkipMutation = useMutation({
    mutationFn: deleteAttendanceSkip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendanceSkips"] });
      toast({ title: "Class holiday removed successfully" });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleRemoveHoliday = (holiday) => {
    setLastRemovedHoliday(holiday);
    if (holiday._type === "skip") {
      deleteSkipMutation.mutate(holiday.id);
    } else {
      deleteHolidayMutation.mutate(holiday.id);
    }
    setUndoHolidayDialog(null);
  };

  const handleCreateHoliday = (e) => {
    e.preventDefault();
    if (!holidayFormData.date?.from) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }
    const payload = {
      ...holidayFormData,
      date: holidayFormData.date.from,
      endDate: holidayFormData.date.to || holidayFormData.date.from,
    };
    createHolidayMutation.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
            <CardTitle className="text-base sm:text-lg">Holiday Calendar</CardTitle>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
              <Select
                value={String(holidayFilter.month)}
                onValueChange={(v) => setHolidayFilter((f) => ({ ...f, month: Number(v) }))}
              >
                <SelectTrigger className="w-28 sm:w-36 h-8 sm:h-9 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{format(new Date(2000, m - 1), "MMM")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="w-20 sm:w-24 h-8 sm:h-9 text-xs sm:text-sm"
                value={holidayFilter.year}
                onChange={(e) => setHolidayFilter((f) => ({ ...f, year: Number(e.target.value) }))}
              />
              <Select value={calendarClassId} onValueChange={handleCalendarClassChange}>
                <SelectTrigger className="w-32 sm:w-44 h-8 sm:h-9 text-xs sm:text-sm"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {allCalendarClasses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.programName} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {calendarSections.length > 0 && (
                <Select value={calendarSectionId} onValueChange={setCalendarSectionId}>
                  <SelectTrigger className="w-28 sm:w-36 h-8 sm:h-9 text-xs sm:text-sm"><SelectValue placeholder="All Sections" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {calendarSections.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {canCreate && (
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3" onClick={() => setHolidayOpen(true)}>
                  <Plus className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Add Holiday
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-[11px] sm:text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: calendarGrid.firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: calendarGrid.daysInMonth }, (_, i) => i + 1).map((day) => {
              const isHoliday = calendarGrid.holidayDates.has(day);
              const holiday = calendarGrid.holidayMap[day];
              const isSkip = isHoliday && holiday?._type === "skip";
              return (
                <div
                  key={day}
                  onClick={() => isHoliday && canDelete && setUndoHolidayDialog(holiday)}
                  className={`relative rounded-md sm:rounded-lg border text-center py-1 sm:py-2 px-0.5 sm:px-1 text-xs sm:text-sm transition-colors select-none
                    ${isSkip
                      ? `bg-orange-100 border-orange-300 text-orange-700 ${canDelete ? "cursor-pointer hover:bg-orange-200" : ""} font-semibold`
                      : isHoliday
                      ? `bg-red-100 border-red-300 text-red-700 ${canDelete ? "cursor-pointer hover:bg-red-200" : ""} font-semibold`
                      : "border-muted text-foreground"
                    }`}
                  title={isHoliday ? (canDelete ? `${holiday.title} — click to remove` : holiday.title) : undefined}
                >
                  <span>{day}</span>
                  {isHoliday && (
                    <span className={`block text-[8px] sm:text-[9px] leading-tight truncate mt-0.5 ${isSkip ? "text-orange-600" : "text-red-600"}`}>{holiday.title}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-300" />
              Global holiday
            </span>
            {calendarClassId && calendarClassId !== "all" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-orange-200 border border-orange-300" />
                Class holiday
              </span>
            )}
            <span className="text-muted-foreground/60">Click a highlighted day to remove</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Holiday</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateHoliday} className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                required
                value={holidayFormData.title}
                onChange={(e) => setHolidayFormData({ ...holidayFormData, title: e.target.value })}
                placeholder="e.g., Independence Day"
              />
            </div>
            <div>
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {holidayFormData.date?.from ? (
                      holidayFormData.date.to ? (
                        <>
                          {format(holidayFormData.date.from, "PPP")} -{" "}
                          {format(holidayFormData.date.to, "PPP")}
                        </>
                      ) : (
                        format(holidayFormData.date.from, "PPP")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="range"
                    selected={holidayFormData.date}
                    onSelect={(date) => setHolidayFormData({ ...holidayFormData, date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={holidayFormData.type}
                onValueChange={(value) => setHolidayFormData({ ...holidayFormData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="National">National</SelectItem>
                  <SelectItem value="Religious">Religious</SelectItem>
                  <SelectItem value="Public">Public</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="repeatYearly"
                className="h-4 w-4 rounded border-gray-300"
                checked={holidayFormData.repeatYearly}
                onChange={(e) => setHolidayFormData({ ...holidayFormData, repeatYearly: e.target.checked })}
              />
              <Label htmlFor="repeatYearly">Repeat Yearly</Label>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={holidayFormData.description}
                onChange={(e) => setHolidayFormData({ ...holidayFormData, description: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">Create Holiday</Button>
          </form>
        </DialogContent>
      </Dialog>

      {undoHolidayDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-popover border rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <p className="text-sm font-medium">Remove holiday <span className="font-bold">"{undoHolidayDialog.title}"</span> on {format(new Date(undoHolidayDialog.date), "PPP")}?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUndoHolidayDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleRemoveHoliday(undoHolidayDialog)} disabled={deleteHolidayMutation.isPending || deleteSkipMutation.isPending}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {lastRemovedHoliday && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-50 px-4">
          <div className="pointer-events-auto flex items-center gap-3 bg-popover border shadow-lg rounded-2xl px-4 py-3 text-sm max-w-full">
            <span className="text-foreground font-medium truncate">Holiday "{lastRemovedHoliday.title}" removed</span>
            <Button size="sm" variant="secondary" className="h-7 px-3 text-xs shrink-0" onClick={async () => {
              try {
                await createHoliday({ title: lastRemovedHoliday.title, date: lastRemovedHoliday.date, type: lastRemovedHoliday.type || "National", repeatYearly: lastRemovedHoliday.repeatYearly || false });
                queryClient.invalidateQueries({ queryKey: ["holidays"] });
                setLastRemovedHoliday(null);
              } catch (e) {
                toast({ title: "Failed to restore holiday", variant: "destructive" });
              }
            }}>Undo</Button>
            <button onClick={() => setLastRemovedHoliday(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
