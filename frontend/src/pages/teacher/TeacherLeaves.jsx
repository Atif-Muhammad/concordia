import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Trash2,
  RefreshCw,
  AlertCircle,
  User,
  Info,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';
import {
  userWho,
  refreshTokens,
  getTeacherLeaves,
  applyTeacherLeave,
  cancelTeacherLeave,
  getStaffLeaveBalance
} from '../../../config/apis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Leave History Timeline Modal
function LeaveHistoryDialog({ open, onOpenChange, record }) {
  if (!record) return null;

  const actionAudit = record.actionAudit && Array.isArray(record.actionAudit) ? record.actionAudit : [];

  const getActionDetails = (actionStr) => {
    const action = String(actionStr || '').toUpperCase();
    if (action === 'STATUS_APPROVED' || action === 'APPROVED') {
      return {
        label: 'Approved',
        badgeClass: 'bg-primary text-primary-foreground',
        icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
      };
    }
    if (action === 'STATUS_REJECTED' || action === 'REJECTED') {
      return {
        label: 'Rejected',
        badgeClass: 'bg-destructive text-destructive-foreground',
        icon: <XCircle className="h-4 w-4 text-destructive" />,
      };
    }
    if (action === 'CREATED') {
      return {
        label: 'Application Submitted',
        badgeClass: 'bg-secondary text-secondary-foreground border',
        icon: <FileText className="h-4 w-4 text-primary" />,
      };
    }
    if (action === 'UPDATED') {
      return {
        label: 'Request Updated',
        badgeClass: 'bg-primary/20 text-primary border border-primary/30',
        icon: <RefreshCw className="h-4 w-4 text-primary" />,
      };
    }
    return {
      label: action.replace(/^STATUS_/, ''),
      badgeClass: 'bg-secondary text-secondary-foreground',
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-primary" />
            Application Progress & Timeline
          </DialogTitle>
        </DialogHeader>

        {/* Summary Card */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-base">
              {record.type || record.leaveType || 'Leave'}
            </span>
            <Badge
              className={
                record.status === 'APPROVED'
                  ? 'bg-primary text-primary-foreground'
                  : record.status === 'REJECTED'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-secondary text-secondary-foreground border'
              }
            >
              {record.status || 'PENDING'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              <span>
                {record.startDate?.split('T')[0]}
                {record.endDate && record.endDate !== record.startDate ? ` to ${record.endDate.split('T')[0]}` : ''}
              </span>
            </span>
            <span className="font-semibold text-foreground bg-background border border-primary/20 px-2 py-0.5 rounded">
              {record.days} {Number(record.days) > 1 ? 'days' : 'day'}
            </span>
          </div>
          {record.reason && (
            <div className="text-xs pt-1.5 border-t border-primary/10">
              <span className="text-muted-foreground font-medium">Reason: </span>
              <span className="text-foreground">{record.reason}</span>
            </div>
          )}
        </div>

        {/* Audit Log Timeline */}
        <div className="mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Review & Approvals Timeline
            </h4>
            <span className="text-xs text-muted-foreground">
              {actionAudit.length} update{actionAudit.length === 1 ? '' : 's'}
            </span>
          </div>

          {actionAudit.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground border rounded-md">
              No review actions recorded yet. Your request is currently under review by Administration / HR.
            </div>
          ) : (
            <div className="relative pl-7 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-primary/20 max-h-[280px] overflow-y-auto pr-1">
              {actionAudit.map((item, idx) => {
                const details = getActionDetails(item.action);
                let dateFormatted = '—';
                if (item.at) {
                  try {
                    dateFormatted = new Date(item.at).toLocaleString();
                  } catch {
                    dateFormatted = String(item.at);
                  }
                }

                return (
                  <div key={item._id || item.id || idx} className="relative">
                    {/* Dot Marker */}
                    <div className="absolute -left-7 top-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-background border-2 border-primary shadow-xs">
                      {details.icon}
                    </div>

                    <div className="space-y-1 bg-background/80 rounded p-1.5 border border-muted">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[11px] px-2 py-0.5 font-medium ${details.badgeClass}`}>
                          {details.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3 text-primary" />
                          <span className="font-medium text-foreground">{item.byName || 'Staff'}</span>
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {dateFormatted}
                      </div>

                      {item.notes && (
                        <p className="text-xs bg-muted/50 p-2 rounded text-foreground mt-1 border">
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
}

export default function TeacherLeaves() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRange, setSelectedRange] = useState(undefined);
  const [formData, setFormData] = useState({
    type: 'CASUAL',
    reason: ''
  });

  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  // Authenticated user query
  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const res = await userWho();
        return res;
      } catch (error) {
        if (error.response?.status === 401) {
          await refreshTokens();
          return userWho();
        }
        throw error;
      }
    },
  });

  const staffIdStr = currentUser?.refId || currentUser?.staffDbId || '';
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Leave balance query
  const { data: leaveBalance, isLoading: isBalanceLoading } = useQuery({
    queryKey: ['teacherLeaveBalance', staffIdStr, currentMonth],
    queryFn: () => getStaffLeaveBalance(staffIdStr, currentMonth),
    enabled: !!staffIdStr,
  });

  // Teacher leaves list query
  const { data: leavesData = [], isLoading: isLeavesLoading } = useQuery({
    queryKey: ['teacherLeaves'],
    queryFn: getTeacherLeaves,
  });

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

    if (presetKey === 'today') {
      setSelectedRange({ from: today, to: undefined });
    } else if (presetKey === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedRange({ from: tomorrow, to: undefined });
    } else if (presetKey === 'next3days') {
      const start = new Date(today);
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      setSelectedRange({ from: start, to: end });
    } else if (presetKey === 'thisweek') {
      const start = new Date(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 4);
      setSelectedRange({ from: start, to: end });
    }
  };

  // Determine if a preset matches the current selection
  const isPresetActive = (presetKey) => {
    if (!selectedRange?.from) return false;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const fromStr = format(selectedRange.from, 'yyyy-MM-dd');
    const toStr = selectedRange.to ? format(selectedRange.to, 'yyyy-MM-dd') : fromStr;

    if (presetKey === 'today') {
      const todayStr = format(today, 'yyyy-MM-dd');
      return fromStr === todayStr && toStr === todayStr;
    }
    if (presetKey === 'tomorrow') {
      const tm = new Date(today);
      tm.setDate(tm.getDate() + 1);
      const tmStr = format(tm, 'yyyy-MM-dd');
      return fromStr === tmStr && toStr === tmStr;
    }
    if (presetKey === 'next3days') {
      const start = new Date(today);
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      return fromStr === format(start, 'yyyy-MM-dd') && toStr === format(end, 'yyyy-MM-dd');
    }
    if (presetKey === 'thisweek') {
      const start = new Date(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 4);
      return fromStr === format(start, 'yyyy-MM-dd') && toStr === format(end, 'yyyy-MM-dd');
    }
    return false;
  };

  const presets = [
    { key: 'today', label: 'Today (1d)' },
    { key: 'tomorrow', label: 'Tomorrow (1d)' },
    { key: 'next3days', label: 'Next 3 Days (3d)' },
    { key: 'thisweek', label: 'Next 5 Days (5d)' },
  ];

  // Apply leave mutation
  const applyMutation = useMutation({
    mutationFn: applyTeacherLeave,
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Leave application submitted successfully. It will now reflect in HR & Payroll records.',
      });
      setSelectedRange(undefined);
      setFormData({ type: 'CASUAL', reason: '' });
      queryClient.invalidateQueries(['teacherLeaves']);
      queryClient.invalidateQueries(['teacherLeaveBalance']);
      queryClient.invalidateQueries(['leaveSheet']);
    },
    onError: (error) => {
      toast({
        title: 'Submission Error',
        description: error.message || 'Failed to submit leave request.',
        variant: 'destructive',
      });
    },
  });

  // Cancel leave mutation
  const cancelMutation = useMutation({
    mutationFn: cancelTeacherLeave,
    onSuccess: () => {
      toast({
        title: 'Application Cancelled',
        description: 'Your leave application was successfully cancelled.',
      });
      setConfirmCancelId(null);
      queryClient.invalidateQueries(['teacherLeaves']);
      queryClient.invalidateQueries(['teacherLeaveBalance']);
      queryClient.invalidateQueries(['leaveSheet']);
    },
    onError: (error) => {
      toast({
        title: 'Cancellation Failed',
        description: error.message || 'Could not cancel leave application.',
        variant: 'destructive',
      });
      setConfirmCancelId(null);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedRange?.from) {
      toast({
        title: 'Select Dates',
        description: 'Please select one or more dates on the calendar.',
        variant: 'destructive'
      });
      return;
    }

    const startDate = format(selectedRange.from, 'yyyy-MM-dd');
    const endDate = selectedRange.to ? format(selectedRange.to, 'yyyy-MM-dd') : startDate;

    if (!formData.reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for your leave request.',
        variant: 'destructive'
      });
      return;
    }

    applyMutation.mutate({
      startDate,
      endDate,
      days: calculatedDays || 1,
      type: formData.type,
      reason: formData.reason.trim(),
    });
  };

  if (isUserLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const leaves = Array.isArray(leavesData) ? leavesData : (leavesData?.data || []);

  // Check remaining quota for currently selected leave type
  const activeBalance = leaveBalance ? (leaveBalance[formData.type] || leaveBalance[formData.type.toLowerCase()]) : null;
  const activeRemaining = activeBalance ? (activeBalance.remaining ?? activeBalance.balance ?? ((activeBalance.allowed ?? 0) - (activeBalance.taken ?? activeBalance.used ?? 0))) : null;

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Leave Applications</h2>
            <p className="text-sm text-muted-foreground">
              Select your leave sequence directly on the calendar and track live approval status from HR.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries(['teacherLeaves']);
                queryClient.invalidateQueries(['teacherLeaveBalance']);
              }}
              className="text-xs border-primary/30 text-primary hover:bg-primary hover:text-white hover:border-primary transition-colors font-medium shadow-2xs"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Leave Balances Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { key: 'CASUAL', label: 'Casual Leave', desc: 'Personal & incidental' },
            { key: 'SICK', label: 'Sick Leave', desc: 'Medical & health' },
            { key: 'ANNUAL', label: 'Annual Leave', desc: 'Earned leaves quota' },
          ].map(({ key, label, desc }, idx) => {
            const b = leaveBalance ? (leaveBalance[key] || leaveBalance[key.toLowerCase()]) : null;
            const taken = b ? (b.taken ?? b.used ?? 0) : 0;
            const allowed = b ? (b.allowed ?? 0) : 0;
            const remaining = b ? (b.remaining ?? b.balance ?? (allowed - taken)) : 0;

            return (
              <Card key={key} className={cn("border-primary/20 shadow-xs relative overflow-hidden bg-card", idx === 2 ? "col-span-2 sm:col-span-1" : "")}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary/40" />
                <CardContent className="p-2.5 sm:p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-[10px] sm:text-xs font-bold">
                      {remaining > 0 ? `${remaining} Left` : '0 Left'}
                    </Badge>
                  </div>
                  <div className="mt-2 sm:mt-3 flex items-baseline justify-between border-t border-primary/10 pt-1.5 sm:pt-2">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Used / Quota</span>
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {isBalanceLoading ? '...' : `${taken} / ${allowed} d`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 lg:grid-cols-12 items-start">
          {/* Apply Form Card */}
          <Card className="lg:col-span-5 border-primary/20 shadow-xs">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" />
                Apply for Leave
              </CardTitle>
              <CardDescription>
                Select a single date or sequence of dates directly on the calendar.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Leave Type */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="type" className="text-xs font-medium">
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
                    <SelectTrigger className="border-primary/20 focus:ring-primary">
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

                {/* Single Calendar for Sequence of Dates */}
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
                          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold',
                        day_range_start: 'day-range-start rounded-l-md bg-primary text-primary-foreground font-semibold',
                        day_range_end: 'day-range-end rounded-r-md bg-primary text-primary-foreground font-semibold',
                        day_range_middle: 'aria-selected:bg-primary/15 aria-selected:text-primary rounded-none font-medium',
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
                            {format(selectedRange.from, 'MMM d, yyyy')}
                            {selectedRange.to && format(selectedRange.to, 'yyyy-MM-dd') !== format(selectedRange.from, 'yyyy-MM-dd')
                              ? ` → ${format(selectedRange.to, 'MMM d, yyyy')}`
                              : ' (Single Day)'}
                          </span>
                          <span className="text-muted-foreground ml-1.5">
                            ({calculatedDays} {calculatedDays === 1 ? 'day requested' : 'consecutive days'})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-primary text-primary-foreground font-bold shadow-xs">
                          {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
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
                  <Label htmlFor="reason" className="text-xs font-medium">
                    Reason for Leave <span className="text-primary">*</span>
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder="Provide a clear description of the reason for your leave..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="border-primary/20 focus-visible:ring-primary text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={applyMutation.isPending || !selectedRange?.from}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {applyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting Request...
                    </>
                  ) : (
                    `Submit Leave Application ${calculatedDays > 0 ? `(${calculatedDays} ${calculatedDays === 1 ? 'Day' : 'Days'})` : ''}`
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Leave History Card */}
          <Card className="lg:col-span-7 border-primary/20 shadow-xs">
            <CardHeader className="pb-3 border-b border-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    My Leave History
                  </CardTitle>
                  <CardDescription>
                    Live status and responses on all your submitted applications.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs border-primary/20">
                  {leaves.length} Total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLeavesLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : leaves.length === 0 ? (
                <div className="text-center py-14 px-4 space-y-2">
                  <Info className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-sm font-medium text-foreground">No leave applications yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Select your dates on the calendar on the left to submit a leave request. You can track approval status right here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-primary/10">
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3">Leave Details</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 hidden sm:table-cell">Type</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 hidden sm:table-cell">Days</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3">Status</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 text-right hidden md:table-cell">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave, index) => {
                        const statusUpper = String(leave.status || 'PENDING').toUpperCase();
                        const isPending = statusUpper === 'PENDING';
                        const isApproved = statusUpper === 'APPROVED';
                        const isRejected = statusUpper === 'REJECTED';

                        return (
                          <TableRow
                            key={leave.id || leave._id || index}
                            className="border-primary/10 hover:bg-primary/5 transition-colors cursor-pointer active:bg-primary/10"
                            onClick={() => {
                              setSelectedHistoryRecord(leave);
                              setHistoryOpen(true);
                            }}
                          >
                            <TableCell className="py-2.5 px-2 sm:px-3 text-xs">
                              <div className="font-semibold text-foreground">
                                {leave.startDate?.split('T')[0] || leave.fromDate?.split('T')[0]}
                                {leave.endDate && leave.endDate !== leave.startDate ? ` to ${leave.endDate.split('T')[0]}` : ''}
                              </div>
                              <div className="sm:hidden flex items-center gap-1.5 mt-1">
                                <Badge variant="outline" className="border-primary/20 text-[10px] px-1 py-0">
                                  {leave.type || leave.leaveType || 'CASUAL'}
                                </Badge>
                                <span className="text-[10px] font-medium text-muted-foreground">{leave.days || 1}d</span>
                              </div>
                              {leave.reason && (
                                <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate max-w-[160px] sm:max-w-[180px] mt-0.5" title={leave.reason}>
                                  {leave.reason}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 px-2 sm:px-3 text-xs hidden sm:table-cell">
                              <Badge variant="outline" className="border-primary/20 text-xs">
                                {leave.type || leave.leaveType || 'CASUAL'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 px-2 sm:px-3 text-xs font-medium text-foreground hidden sm:table-cell">
                              {leave.days || 1}d
                            </TableCell>
                            <TableCell className="py-2.5 px-2 sm:px-3 text-xs">
                              {isApproved && (
                                <Badge className="bg-primary text-primary-foreground font-semibold flex items-center gap-1 w-fit shadow-xs text-[10px] sm:text-xs">
                                  <CheckCircle2 className="h-3 w-3" /> Approved
                                </Badge>
                              )}
                              {isRejected && (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit text-[10px] sm:text-xs">
                                  <XCircle className="h-3 w-3" /> Rejected
                                </Badge>
                              )}
                              {isPending && (
                                <Badge variant="secondary" className="border flex items-center gap-1 w-fit text-muted-foreground text-[10px] sm:text-xs">
                                  <Clock className="h-3 w-3" /> Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 px-2 sm:px-3 text-xs text-right hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setSelectedHistoryRecord(leave);
                                    setHistoryOpen(true);
                                  }}
                                  title="View application timeline"
                                >
                                  <Clock className="h-4 w-4 mr-1" />
                                  <span className="hidden sm:inline text-xs">Timeline</span>
                                </Button>

                                {isPending && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setConfirmCancelId(leave.id || leave._id)}
                                    title="Cancel request"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History Dialog */}
        <LeaveHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          record={selectedHistoryRecord}
        />

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={!!confirmCancelId} onOpenChange={(open) => { if (!open) setConfirmCancelId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Leave Application?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to withdraw this leave request? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelMutation.isPending}>Keep Application</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmCancelId) cancelMutation.mutate(confirmCancelId);
                }}
                disabled={cancelMutation.isPending}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
              >
                {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Cancel Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
