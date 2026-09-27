import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  User,
  Info,
  AlertCircle,
  Eye,
  Calendar as CalendarIcon,
  UserCheck,
  Search,
  Filter,
  Phone,
  PlusCircle,
  MessageSquarePlus,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';
import {
  userWho,
  refreshTokens,
  getTeacherComplaints,
  getAssignedComplaints,
  submitTeacherComplaint,
  addTeacherComplaintRemark,
  updateTeacherComplaintStatus
} from '../../../config/apis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

// Status color helper for badges and triggers (Strictly Brand Orange / theme compliant - NO green/black)
const getStatusSelectStyle = (status) => {
  const s = String(status || '').toLowerCase().replace('_', ' ');
  if (s === 'resolved') {
    return 'bg-primary text-primary-foreground font-semibold border-primary shadow-2xs';
  }
  if (s === 'in progress') {
    return 'bg-primary/20 text-primary border-primary/30 font-semibold';
  }
  if (s === 'rejected' || s === 'dismissed') {
    return 'bg-destructive/15 text-destructive border-destructive/30 font-semibold';
  }
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium';
};

// Detailed Complaint View Dialog (allows reviewing full thread, toggling status, and adding remarks)
function ComplaintDetailsDialog({ open, onOpenChange, complaint, isAssignedView = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState('');

  const remarkMutation = useMutation({
    mutationFn: ({ id, remark }) => addTeacherComplaintRemark(id, { remark }),
    onSuccess: () => {
      toast({ title: 'Note Added', description: 'Your message has been attached to the complaint.' });
      setReplyText('');
      queryClient.invalidateQueries(['teacherAssignedComplaints']);
      queryClient.invalidateQueries(['teacherComplaints']);
      queryClient.invalidateQueries(['complaints']);
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit follow-up note.',
        variant: 'destructive',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateTeacherComplaintStatus(id, { status }),
    onSuccess: () => {
      toast({ title: 'Status Updated', description: 'Complaint status has been updated successfully.' });
      queryClient.invalidateQueries(['teacherAssignedComplaints']);
      queryClient.invalidateQueries(['teacherComplaints']);
      queryClient.invalidateQueries(['complaints']);
    },
    onError: (err) => {
      toast({
        title: 'Status Update Failed',
        description: err.message || 'Could not update complaint status.',
        variant: 'destructive',
      });
    },
  });

  if (!complaint) return null;

  const remarks = Array.isArray(complaint.remarks) ? complaint.remarks : [];
  const assignedStaff = Array.isArray(complaint.assignedTo) ? complaint.assignedTo : [];

  const statusStr = String(complaint.status || 'Pending').toLowerCase().replace('_', ' ');
  const isResolved = statusStr === 'resolved';
  const isInProgress = statusStr === 'in progress';
  const isRejected = statusStr === 'rejected' || statusStr === 'dismissed';

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    remarkMutation.mutate({
      id: complaint.id || complaint._id,
      remark: replyText.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <MessageSquare className="h-5 w-5 text-primary" />
            Complaint & Resolution Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Summary Box */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2.5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground text-base">
                  {complaint.title || complaint.subject || 'Complaint'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">Category: </span>
                  <Badge variant="outline" className="border-primary/30 text-xs font-medium">
                    {complaint.category || 'General'}
                  </Badge>
                  {complaint.type && (
                    <Badge variant="secondary" className="text-xs">
                      {complaint.type}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Status Display or Dropdown (if assigned view) */}
              {isAssignedView ? (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Status:</span>
                  <Select
                    value={complaint.status?.replace(' ', '_') || 'Pending'}
                    onValueChange={(val) => {
                      const normalized = val === 'In_Progress' ? 'In Progress' : val;
                      statusMutation.mutate({
                        id: complaint.id || complaint._id,
                        status: normalized,
                      });
                    }}
                    disabled={statusMutation.isPending}
                  >
                    <SelectTrigger className={cn("h-7 px-2 text-xs border font-medium", getStatusSelectStyle(complaint.status))}>
                      {statusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
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
                <Badge
                  className={
                    isResolved
                      ? 'bg-primary text-primary-foreground font-semibold flex items-center gap-1 shadow-xs'
                      : isRejected
                      ? 'bg-destructive text-destructive-foreground flex items-center gap-1'
                      : isInProgress
                      ? 'bg-primary/20 text-primary border border-primary/30 flex items-center gap-1 font-semibold'
                      : 'bg-secondary text-secondary-foreground border flex items-center gap-1'
                  }
                >
                  {isResolved && <CheckCircle2 className="h-3 w-3" />}
                  {isRejected && <XCircle className="h-3 w-3" />}
                  {isInProgress && <RefreshCw className="h-3 w-3 animate-spin" />}
                  {!isResolved && !isRejected && !isInProgress && <Clock className="h-3 w-3" />}
                  {complaint.status || 'Pending'}
                </Badge>
              )}
            </div>

            {/* Complainant & Assignment metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-primary/10 pt-2">
              <div>
                <span className="font-medium text-foreground">Complainant: </span>
                <span>{complaint.complainantName || 'Unknown'}</span>
                {complaint.contact && (
                  <span className="block text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3 text-primary" /> {complaint.contact}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-medium text-foreground">Date: </span>
                <span>{complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : '—'}</span>
                {assignedStaff.length > 0 && (
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Assigned: {assignedStaff.map(s => s.name || 'Staff').join(', ')}
                  </span>
                )}
              </div>
            </div>

            {/* Full Details */}
            <div className="text-xs pt-1 border-t border-primary/10">
              <span className="font-semibold text-muted-foreground">Description:</span>
              <p className="mt-1 text-foreground leading-relaxed whitespace-pre-wrap bg-background/60 p-2.5 rounded border border-primary/10 text-xs">
                {complaint.description || complaint.details || 'No details provided.'}
              </p>
            </div>
          </div>

          {/* Remarks Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Remarks & Activity Log
              </h4>
              <span className="text-xs text-muted-foreground">
                {remarks.length} record{remarks.length === 1 ? '' : 's'}
              </span>
            </div>

            {remarks.length === 0 ? (
              <div className="text-center py-5 text-xs text-muted-foreground border rounded-md">
                No remarks recorded yet. You can add notes below to record actions or resolution steps.
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {remarks.map((r, idx) => {
                  let dateStr = '—';
                  if (r.date || r.createdAt) {
                    try {
                      dateStr = new Date(r.date || r.createdAt).toLocaleString();
                    } catch {
                      dateStr = String(r.date || r.createdAt);
                    }
                  }
                  return (
                    <div key={r._id || r.id || idx} className="rounded-md border p-2.5 bg-muted/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-primary" />
                          {r.authorName || 'Staff Member'}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{dateStr}</span>
                      </div>
                      <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">
                        {r.remark || r.text || ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Remark Form */}
          <form onSubmit={handleSendReply} className="space-y-2 border-t pt-3">
            <Label htmlFor="replyText" className="text-xs font-medium">
              Add Action Note / Resolution Remark
            </Label>
            <div className="flex gap-2">
              <Input
                id="replyText"
                placeholder="Type resolution remark or action note..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="text-xs border-primary/20 focus-visible:ring-primary"
              />
              <Button
                type="submit"
                size="sm"
                disabled={remarkMutation.isPending || !replyText.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium"
              >
                {remarkMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1" /> Post Note
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Quick Add Remark Dialog (Single click action from the table)
function QuickRemarkDialog({ open, onOpenChange, complaint }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [remarkText, setRemarkText] = useState('');

  const remarkMutation = useMutation({
    mutationFn: ({ id, remark }) => addTeacherComplaintRemark(id, { remark }),
    onSuccess: () => {
      toast({ title: 'Remark Saved', description: 'Your remark has been attached to the complaint.' });
      setRemarkText('');
      onOpenChange(false);
      queryClient.invalidateQueries(['teacherAssignedComplaints']);
      queryClient.invalidateQueries(['teacherComplaints']);
      queryClient.invalidateQueries(['complaints']);
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit remark.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!remarkText.trim() || !complaint) return;
    remarkMutation.mutate({
      id: complaint.id || complaint._id,
      remark: remarkText.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            Add Remark to Complaint
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="p-2.5 rounded-md bg-muted/40 border text-xs space-y-1">
            <p className="font-semibold text-foreground truncate">
              {complaint?.title || complaint?.subject || 'Complaint'}
            </p>
            <p className="text-muted-foreground text-[11px]">
              Complainant: <span className="text-foreground font-medium">{complaint?.complainantName}</span> ({complaint?.type})
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quickRemark" className="text-xs font-medium">
              Action Taken / Progress Remark <span className="text-primary">*</span>
            </Label>
            <Textarea
              id="quickRemark"
              placeholder="e.g. Spoke with student/parent, issue discussed and resolved..."
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              rows={4}
              className="text-xs border-primary/20 focus-visible:ring-primary"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={remarkMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={remarkMutation.isPending || !remarkText.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {remarkMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Remark
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeacherComplaints() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('assigned');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [formData, setFormData] = useState({
    title: '',
    category: 'General',
    description: ''
  });

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [quickRemarkComplaint, setQuickRemarkComplaint] = useState(null);
  const [quickRemarkOpen, setQuickRemarkOpen] = useState(false);

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

  // Assigned complaints query
  const { data: assignedData = [], isLoading: isAssignedLoading } = useQuery({
    queryKey: ['teacherAssignedComplaints'],
    queryFn: getAssignedComplaints,
  });

  // My filed complaints query
  const { data: myComplaintsData = [], isLoading: isMyComplaintsLoading } = useQuery({
    queryKey: ['teacherComplaints'],
    queryFn: getTeacherComplaints,
  });

  // Submit filed complaint mutation
  const submitMutation = useMutation({
    mutationFn: submitTeacherComplaint,
    onSuccess: () => {
      toast({
        title: 'Complaint Submitted',
        description: 'Your complaint has been registered and forwarded to Administration.',
      });
      setFormData({ title: '', category: 'General', description: '' });
      queryClient.invalidateQueries(['teacherComplaints']);
      queryClient.invalidateQueries(['complaints']);
    },
    onError: (error) => {
      toast({
        title: 'Submission Error',
        description: error.message || 'Failed to submit complaint.',
        variant: 'destructive',
      });
    },
  });

  // Toggle status mutation for assigned complaints
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateTeacherComplaintStatus(id, { status }),
    onSuccess: () => {
      toast({ title: 'Status Updated', description: 'Complaint status changed.' });
      queryClient.invalidateQueries(['teacherAssignedComplaints']);
      queryClient.invalidateQueries(['teacherComplaints']);
      queryClient.invalidateQueries(['complaints']);
    },
    onError: (err) => {
      toast({
        title: 'Failed to update status',
        description: err.message || 'Could not update status.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({ title: 'Error', description: 'Please provide a complaint subject/title', variant: 'destructive' });
      return;
    }
    if (!formData.description.trim()) {
      toast({ title: 'Error', description: 'Please provide a detailed description', variant: 'destructive' });
      return;
    }

    submitMutation.mutate({
      title: formData.title.trim(),
      category: formData.category,
      description: formData.description.trim(),
    });
  };

  const assignedComplaints = Array.isArray(assignedData) ? assignedData : (assignedData?.data || []);
  const myComplaints = Array.isArray(myComplaintsData) ? myComplaintsData : (myComplaintsData?.data || []);

  // Filtered assigned complaints
  const filteredAssignedComplaints = useMemo(() => {
    return assignedComplaints.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        String(item.title || item.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.complainantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.description || item.details || '').toLowerCase().includes(searchQuery.toLowerCase());

      const normItemStatus = String(item.status || 'Pending').toLowerCase().replace('_', ' ');
      const matchStatus =
        statusFilter === 'All' ||
        normItemStatus === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [assignedComplaints, searchQuery, statusFilter]);

  // Assigned stats
  const assignedStats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;
    assignedComplaints.forEach((c) => {
      const s = String(c.status || '').toLowerCase().replace('_', ' ');
      if (s === 'resolved') resolved++;
      else if (s === 'in progress') inProgress++;
      else pending++;
    });
    return { total: assignedComplaints.length, pending, inProgress, resolved };
  }, [assignedComplaints]);

  if (isUserLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Complaints & Grievances</h2>
            <p className="text-sm text-muted-foreground">
              Review complaints assigned to you by Administration, resolve them, or submit tickets yourself.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries(['teacherAssignedComplaints']);
                queryClient.invalidateQueries(['teacherComplaints']);
              }}
              className="text-xs border-primary/30 text-primary hover:bg-primary hover:text-white hover:border-primary transition-colors font-medium shadow-2xs"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Sub Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
          <TabsList className="bg-muted/70 p-1 border border-primary/20 h-10">
            <TabsTrigger
              value="assigned"
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 text-xs font-semibold transition-all"
            >
              <UserCheck className="h-4 w-4" />
              Assigned to Me
              {assignedComplaints.length > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1 px-1.5 py-0 text-[10px] font-bold rounded-full",
                    activeTab === 'assigned' ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                  )}
                >
                  {assignedComplaints.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="filed"
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 text-xs font-semibold transition-all"
            >
              <FileText className="h-4 w-4" />
              Filed by Me
              {myComplaints.length > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1 px-1.5 py-0 text-[10px] font-bold rounded-full",
                    activeTab === 'filed' ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                  )}
                >
                  {myComplaints.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ASSIGNED TO ME */}
          <TabsContent value="assigned" className="space-y-4 mt-0">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-primary/20 shadow-xs relative overflow-hidden bg-card">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary/30" />
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Assigned</p>
                  <p className="text-xl font-bold text-foreground mt-1">{assignedStats.total}</p>
                </CardContent>
              </Card>
              <Card className="border-amber-500/20 shadow-xs relative overflow-hidden bg-card">
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending Action</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{assignedStats.pending}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/20 shadow-xs relative overflow-hidden bg-card">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary/60" />
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">In Progress</p>
                  <p className="text-xl font-bold text-primary mt-1">{assignedStats.inProgress}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/20 shadow-xs relative overflow-hidden bg-card">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Resolved</p>
                  <p className="text-xl font-bold text-primary mt-1">{assignedStats.resolved}</p>
                </CardContent>
              </Card>
            </div>

            {/* Complaints Table Card */}
            <Card className="border-primary/20 shadow-xs">
              <CardHeader className="pb-3 border-b border-primary/10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                      <UserCheck className="h-5 w-5 text-primary" />
                      Complaints Assigned to You
                    </CardTitle>
                    <CardDescription>
                      Assigned by administration for your review, action, and resolution.
                    </CardDescription>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or subject..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs w-[180px] sm:w-[220px] border-primary/20 focus-visible:ring-primary"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 text-xs w-[130px] border-primary/20">
                        <SelectValue placeholder="Filter Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Statuses</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isAssignedLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  </div>
                ) : filteredAssignedComplaints.length === 0 ? (
                  <div className="text-center py-14 px-4 space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-primary mx-auto opacity-40" />
                    <p className="text-sm font-medium text-foreground">No assigned complaints found</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      {searchQuery || statusFilter !== 'All'
                        ? 'No complaints matched your search criteria.'
                        : 'You currently have no complaints assigned to you by Administration.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-primary/10">
                          <TableHead className="text-xs font-semibold py-2.5 min-w-[95px]">Date</TableHead>
                          <TableHead className="text-xs font-semibold py-2.5 min-w-[85px]">Type</TableHead>
                          <TableHead className="text-xs font-semibold py-2.5 min-w-[140px]">Complainant</TableHead>
                          <TableHead className="text-xs font-semibold py-2.5 min-w-[200px]">Subject & Details</TableHead>
                          <TableHead className="text-xs font-semibold py-2.5 min-w-[140px]">Status (Toggle)</TableHead>
                          <TableHead className="text-xs font-semibold py-2.5 min-w-[120px]">Remarks</TableHead>
                          <TableHead className="text-xs font-semibold py-2.5 text-right min-w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAssignedComplaints.map((complaint) => {
                          const remarksCount = Array.isArray(complaint.remarks) ? complaint.remarks.length : 0;
                          const normStatus = complaint.status?.replace(' ', '_') || 'Pending';

                          return (
                            <TableRow key={complaint.id || complaint._id} className="border-primary/10 hover:bg-primary/5 transition-colors">
                              <TableCell className="py-3 text-xs text-muted-foreground">
                                {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : '—'}
                              </TableCell>
                              <TableCell className="py-3 text-xs">
                                <Badge variant="outline" className="border-primary/20 text-xs font-medium">
                                  {complaint.type || 'Student'}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 text-xs">
                                <p className="font-semibold text-foreground">{complaint.complainantName || '—'}</p>
                                {complaint.contact && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Phone className="h-3 w-3 text-primary" /> {complaint.contact}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="py-3 text-xs">
                                <p className="font-semibold text-foreground truncate max-w-[220px]">
                                  {complaint.title || complaint.subject || 'Complaint'}
                                </p>
                                {complaint.description && (
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[220px] mt-0.5" title={complaint.description}>
                                    {complaint.description}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="py-3 text-xs">
                                {/* Interactive status toggle dropdown matching Front Office */}
                                <Select
                                  value={normStatus}
                                  onValueChange={(val) => {
                                    const normalized = val === 'In_Progress' ? 'In Progress' : val;
                                    updateStatusMutation.mutate({
                                      id: complaint.id || complaint._id,
                                      status: normalized,
                                    });
                                  }}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <SelectTrigger className={cn("h-7 w-[125px] text-xs border font-medium", getStatusSelectStyle(complaint.status))}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="In_Progress">In Progress</SelectItem>
                                    <SelectItem value="Resolved">Resolved</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-3 text-xs">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setQuickRemarkComplaint(complaint);
                                    setQuickRemarkOpen(true);
                                  }}
                                  className="h-7 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1"
                                  title="Add or view remarks"
                                >
                                  <MessageSquarePlus className="h-3.5 w-3.5" />
                                  <span>{remarksCount > 0 ? `${remarksCount} Note${remarksCount > 1 ? 's' : ''}` : 'Add Note'}</span>
                                </Button>
                              </TableCell>
                              <TableCell className="py-3 text-xs text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-primary hover:bg-primary hover:text-white transition-colors"
                                  onClick={() => {
                                    setSelectedComplaint(complaint);
                                    setDetailsOpen(true);
                                  }}
                                  title="View full details and activity thread"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  <span className="text-xs">View</span>
                                </Button>
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
          </TabsContent>

          {/* TAB 2: FILED BY ME */}
          <TabsContent value="filed" className="mt-0">
            <div className="grid gap-4 lg:grid-cols-12 items-start">
              {/* Submit Form Card */}
              <Card className="lg:col-span-5 border-primary/20 shadow-xs">
                <CardHeader className="pb-3 border-b border-primary/10">
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Submit a Complaint / Request
                  </CardTitle>
                  <CardDescription>
                    File an official ticket. This directly syncs with Front Office & Administration.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-xs font-medium">
                        Subject / Title <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="title"
                        placeholder="Brief summary of the issue..."
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="border-primary/20 focus-visible:ring-primary text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="category" className="text-xs font-medium">
                        Category <span className="text-primary">*</span>
                      </Label>
                      <Select
                        value={formData.category}
                        onValueChange={(val) => setFormData({ ...formData, category: val })}
                      >
                        <SelectTrigger className="border-primary/20 focus:ring-primary">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="General">General Issue</SelectItem>
                          <SelectItem value="Academic">Academic / Curriculum</SelectItem>
                          <SelectItem value="Maintenance">Maintenance & Facilities</SelectItem>
                          <SelectItem value="Discipline">Student Discipline</SelectItem>
                          <SelectItem value="Administrative">Administrative / HR</SelectItem>
                          <SelectItem value="Technical">IT / Computer Lab / Equipment</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="description" className="text-xs font-medium">
                        Detailed Explanation <span className="text-primary">*</span>
                      </Label>
                      <Textarea
                        id="description"
                        placeholder="Provide full details regarding the incident, room/equipment involved, or assistance needed..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={5}
                        className="border-primary/20 focus-visible:ring-primary text-sm"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submitMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting Complaint...
                        </>
                      ) : (
                        'Submit Complaint'
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Complaints History Card */}
              <Card className="lg:col-span-7 border-primary/20 shadow-xs">
                <CardHeader className="pb-3 border-b border-primary/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                        <Clock className="h-5 w-5 text-primary" />
                        My Submitted Complaints
                      </CardTitle>
                      <CardDescription>
                        Track real-time responses and progress on your submitted complaints.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs border-primary/20">
                      {myComplaints.length} Total
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isMyComplaintsLoading ? (
                    <div className="flex justify-center items-center py-16">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    </div>
                  ) : myComplaints.length === 0 ? (
                    <div className="text-center py-14 px-4 space-y-2">
                      <Info className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                      <p className="text-sm font-medium text-foreground">No complaints filed</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        You have not registered any complaints or suggestions. Use the form on the left to submit a ticket.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow className="border-primary/10">
                            <TableHead className="text-xs font-semibold py-2.5">Subject</TableHead>
                            <TableHead className="text-xs font-semibold py-2.5">Category</TableHead>
                            <TableHead className="text-xs font-semibold py-2.5">Date</TableHead>
                            <TableHead className="text-xs font-semibold py-2.5">Status</TableHead>
                            <TableHead className="text-xs font-semibold py-2.5 text-right">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {myComplaints.map((complaint, index) => {
                            const statusStr = String(complaint.status || 'Pending').toLowerCase().replace('_', ' ');
                            const isResolved = statusStr === 'resolved';
                            const isInProgress = statusStr === 'in progress';
                            const isRejected = statusStr === 'rejected' || statusStr === 'dismissed';

                            const remarksCount = Array.isArray(complaint.remarks) ? complaint.remarks.length : 0;

                            return (
                              <TableRow key={complaint.id || complaint._id || index} className="border-primary/10 hover:bg-primary/5 transition-colors">
                                <TableCell className="py-3 text-xs">
                                  <p className="font-semibold text-foreground truncate max-w-[200px]">
                                    {complaint.title || complaint.subject || 'Complaint'}
                                  </p>
                                  {complaint.description && (
                                    <p className="text-[11px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                                      {complaint.description}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell className="py-3 text-xs">
                                  <Badge variant="outline" className="border-primary/20 text-xs">
                                    {complaint.category || 'General'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3 text-xs text-muted-foreground">
                                  {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : '—'}
                                </TableCell>
                                <TableCell className="py-3 text-xs">
                                  {isResolved && (
                                    <Badge className="bg-primary text-primary-foreground font-semibold flex items-center gap-1 w-fit shadow-xs">
                                      <CheckCircle2 className="h-3 w-3" /> Resolved
                                    </Badge>
                                  )}
                                  {isRejected && (
                                    <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                      <XCircle className="h-3 w-3" /> Rejected
                                    </Badge>
                                  )}
                                  {isInProgress && (
                                    <Badge className="bg-primary/20 text-primary border border-primary/30 flex items-center gap-1 w-fit font-semibold">
                                      <RefreshCw className="h-3 w-3 animate-spin" /> In Progress
                                    </Badge>
                                  )}
                                  {!isResolved && !isRejected && !isInProgress && (
                                    <Badge variant="secondary" className="border flex items-center gap-1 w-fit text-muted-foreground">
                                      <Clock className="h-3 w-3" /> Pending
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="py-3 text-xs text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-primary hover:bg-primary hover:text-white transition-colors"
                                    onClick={() => {
                                      setSelectedComplaint(complaint);
                                      setDetailsOpen(true);
                                    }}
                                    title="View status and response notes"
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline text-xs">View</span>
                                    {remarksCount > 0 && (
                                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                                        {remarksCount}
                                      </span>
                                    )}
                                  </Button>
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
          </TabsContent>
        </Tabs>

        {/* Detailed Modal */}
        <ComplaintDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          complaint={selectedComplaint}
          isAssignedView={activeTab === 'assigned'}
        />

        {/* Quick Remark Dialog */}
        <QuickRemarkDialog
          open={quickRemarkOpen}
          onOpenChange={setQuickRemarkOpen}
          complaint={quickRemarkComplaint}
        />
      </div>
    </DashboardLayout>
  );
}
