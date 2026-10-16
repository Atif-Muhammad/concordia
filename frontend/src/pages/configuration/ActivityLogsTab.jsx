import React, { useState, useMemo, useRef, useCallback } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Search,
  Filter,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  RefreshCw,
  FileText,
  Activity,
  Check,
} from "lucide-react";
import { getActivityLogs, getActivityLogFilterOptions, getActivityLogById } from "@/services/api";

// Format helper for timestamp: dd-MMM-yyyy / hh:mm:ss a (e.g. 01-Sep-2026 / 01:58:12 pm)
const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? String(hours).padStart(2, "0") : "12";

    return `${day}-${month}-${year} / ${hours}:${minutes}:${seconds} ${ampm}`;
  } catch {
    return dateString;
  }
};

// Action badge styling mapped by actionType and action text
const getActionBadgeClass = (action = "", actionType = "") => {
  const act = (action || "").toLowerCase();
  const type = (actionType || "").toUpperCase();

  if (type === "DELETE" || act.includes("delete") || act.includes("remove") || act.includes("reject")) {
    return "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
  }
  if (type === "UPDATE" || act.includes("update") || act.includes("edit") || act.includes("change") || act.includes("revise")) {
    return "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
  if (type === "PAYMENT" || act.includes("paid") || act.includes("disburs") || act.includes("closing") || act.includes("approve")) {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
  }
  if (type === "PRINT" || act.includes("print")) {
    return "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
  }
  if (type === "STATUS") {
    return "bg-cyan-100 text-cyan-800 border border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800";
  }
  if (type === "CREATE" || act.includes("add") || act.includes("enroll") || act.includes("generate") || act.includes("issue")) {
    return "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
};

// Clean human-readable display for action badges
const formatActionDisplay = (action = "") => {
  if (!action) return "Action";
  const map = {
    MARK_ATTENDANCE: "Attendance Marked",
    CREATE_CHALLAN: "Challan Created",
    CREATE_FEE: "Fee Created",
    PAY_CHALLAN: "Challan Paid",
    LOGIN: "User Login",
    LOGOUT: "User Logout",
    CREATE_EXPENSE: "Expense Added",
    UPDATE_EXPENSE: "Update Expense",
    DELETE_EXPENSE: "Expense Deleted",
    CREATE_STUDENT: "Student Enrolled",
    UPDATE_STUDENT: "Update Student",
    DELETE_STUDENT: "Student Deleted",
    CREATE_STAFF: "Staff Added",
    UPDATE_STAFF: "Update Staff",
    DELETE_STAFF: "Staff Deleted",
  };
  const upper = action.toUpperCase().trim();
  if (map[upper]) return map[upper];
  if (action.includes("_")) {
    return action
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return action;
};

// Helper to sanitize any legacy logs that contain "Before Update:" / "After Update:" or raw JSON dumps
const sanitizeDetailsText = (rawText) => {
  if (!rawText) return "";
  let text = String(rawText);

  // 1. Clean legacy "Before Update:" / "After Update:" format
  if (text.includes("Before Update:") || text.includes("After Update:")) {
    if (text.includes("Before Update:") && text.includes("After Update:")) {
      const parts = text.split(/Before Update:|After Update:/i);
      const header = parts[0]?.trim().replace(/,\s*$/, "");
      const afterContent = parts[2]?.trim().replace(/\n+/g, ", ");
      if (header && afterContent) {
        text = `${header} (${afterContent})`;
      } else if (header) {
        text = header;
      } else {
        text = afterContent || text;
      }
    } else {
      text = text
        .replace(/Before Update:\s*/gi, "")
        .replace(/After Update:\s*/gi, "")
        .trim();
    }
  }

  // 2. Remove legacy Total Amount from Challan Generation logs
  if (text.includes("Challan") && text.includes("Total Amount: PKR")) {
    text = text.replace(/,\s*Total Amount:\s*PKR\s*[\d,]+/gi, "");
    text = text.replace(/Total Amount:\s*PKR\s*[\d,]+/gi, "");
  }

  // 3. Clean legacy raw JSON dumps from Challan Updates (e.g. selectedHeads / challanHeads dumps)
  if (text.includes("selectedHeads:") || text.includes("challanHeads:")) {
    // Extract added head name and amount from JSON if present
    const headMatch = text.match(/"name":"([^"]+)".*?"amount":(\d+)/);
    let headReplacement = "";
    if (headMatch) {
      const headName = headMatch[1];
      const headAmt = Number(headMatch[2]).toLocaleString();
      headReplacement = `Added Head '${headName}' (PKR ${headAmt})`;
    }

    // Strip duplicate challanHeads and selectedHeads JSON blobs
    text = text.replace(/,?\s*challanHeads:\s*'\[.*?\]'\s*→\s*'\[.*?\]'/gi, "");
    text = text.replace(/,?\s*selectedHeads:\s*'\[.*?\]'\s*→\s*'\[.*?\]'/gi, "");

    // Strip false ISO dueDate diffs where calendar date did not change
    text = text.replace(/,?\s*dueDate:\s*'"?(\d{4}-\d{2}-\d{2})T[^'"]*"'?\s*→\s*'?\1'?/gi, "");

    // If we extracted a clean head change, append it
    if (headReplacement && !text.includes(headReplacement)) {
      if (text.includes("Updated:")) {
        text = text.replace(/Updated:\s*,?\s*/, `Updated: ${headReplacement}, `);
      } else {
        text = `${text}, Updated: ${headReplacement}`;
      }
    }

    // Clean up residual commas or formatting
    text = text.replace(/Updated:\s*,?\s*$/gi, "");
    text = text.replace(/,\s*,/g, ",");
    text = text.replace(/Updated:\s*,\s*/g, "Updated: ");
    text = text.trim().replace(/,\s*$/, "");
  }

  return text;
};

// Formatter for DETAILS column text
const getLogDetailsText = (log) => {
  let text = "";
  if (log.details && log.details.trim()) {
    text = log.details;
  } else {
    const targetName = log.targetEntity?.name && log.targetEntity.name !== "Record"
      ? ` for '${log.targetEntity.name}'${log.targetEntity.identifier ? ` (${log.targetEntity.identifier})` : ""}`
      : "";

    if (log.changes && log.changes.length > 0) {
      const updatedParts = log.changes
        .map((c) => `${c.fieldLabel || c.field}: ${c.newValue !== null && c.newValue !== undefined ? c.newValue : "None"}`)
        .join(", ");
      text = `User: ${log.userName || "System"}, Action: Update ${log.module || "Record"}${targetName}${updatedParts ? ` (${updatedParts})` : ""}`;
    } else if (log.description && log.description.trim()) {
      text = log.description;
    } else {
      text = `User: ${log.userName || "System"}, Action: ${formatActionDisplay(log.action || log.method)}${targetName} on ${log.module || "System"}`;
    }
  }

  return sanitizeDetailsText(text);
};

// Component to render details cleanly as a unified text block
const RenderLogDetails = ({ log }) => {
  const detailsText = getLogDetailsText(log);

  return (
    <div className="whitespace-pre-wrap font-sans leading-relaxed break-words text-slate-800 dark:text-slate-200 max-w-3xl py-0.5">
      {detailsText}
    </div>
  );
};

// Master list of system modules
export const MASTER_MODULE_DEFINITIONS = [
  { name: "Expenses", subModules: [] },
  { name: "Income", subModules: [] },
  { name: "Closing", subModules: [] },
  { name: "Students", subModules: ["Admissions & Directory", "Student Profile"] },
  { name: "Fee Management", subModules: ["Challans", "Extra Challans", "Fee Heads", "Fee Structures", "Reports"] },
  { name: "Staff", subModules: ["Staff Directory", "Settings"] },
  { name: "HR & Payroll", subModules: ["Leaves", "Payroll", "Attendance", "Advance Salary", "Departments"] },
  { name: "Attendance", subModules: ["Record Attendance", "Leave", "Reports"] },
  { name: "Front Office", subModules: ["Inquiry", "Visitor Book", "Complaints", "Contacts"] },
  { name: "Complaints", subModules: ["Complaints"] },
  { name: "Academics", subModules: ["Sessions", "Programs", "Classes", "Sections", "Subjects", "Timetable"] },
  { name: "Examination", subModules: ["Exams", "Marks Entry", "Results"] },
  { name: "Boarding", subModules: ["Registration", "Rooms", "Fees", "Expenses", "Inventory"] },
  { name: "Inventory", subModules: ["Inventory", "Expenses"] },
  { name: "Wallets / Accounts", subModules: ["Wallets", "Contra Transfers", "Direct Deposits"] },
  { name: "Configuration", subModules: ["Institute", "Admins", "Templates", "Wallets / Accounts", "Activity Logs"] },
  { name: "Authentication", subModules: ["Login", "Logout"] },
];

export const ActivityLogsTab = () => {
  // Query Filters State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedActionType, setSelectedActionType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state for viewing full log detail
  const [selectedLog, setSelectedLog] = useState(null);

  // Fetch full log details if selected
  const { data: fullLogDetail } = useQuery({
    queryKey: ["activityLogDetail", selectedLog?._id || selectedLog?.id],
    queryFn: () => getActivityLogById(selectedLog?._id || selectedLog?.id),
    enabled: !!(selectedLog?._id || selectedLog?.id),
    staleTime: 60000,
  });
  const activeLog = fullLogDetail || selectedLog;

  // Fetch filter options (modules, etc.)
  const { data: filterOptions } = useQuery({
    queryKey: ["activityLogFilterOptions"],
    queryFn: getActivityLogFilterOptions,
    staleTime: 60000,
  });

  // Master list of all modules
  const allModules = useMemo(() => {
    const list = MASTER_MODULE_DEFINITIONS.map((m) => m.name);
    if (filterOptions?.modules && Array.isArray(filterOptions.modules)) {
      filterOptions.modules.forEach((bm) => {
        if (bm.name && !list.includes(bm.name)) {
          list.push(bm.name);
        }
      });
    }
    return list;
  }, [filterOptions]);

  // Build API query parameters
  const queryParams = useMemo(() => {
    return {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      module: selectedModule !== "all" ? selectedModule : undefined,
      actionType: selectedActionType !== "all" ? selectedActionType : undefined,
      status: selectedStatus !== "all" ? selectedStatus : undefined,
      search: searchTerm.trim() || undefined,
    };
  }, [startDate, endDate, selectedModule, selectedActionType, selectedStatus, searchTerm]);

  // Infinite Query for on-scroll pagination
  const {
    data: logsData,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["activityLogsInfinite", queryParams],
    queryFn: ({ pageParam = 1 }) =>
      getActivityLogs({
        page: pageParam,
        limit: 30,
        ...queryParams,
      }),
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Flatten logs from all fetched pages
  const logs = useMemo(() => {
    return logsData?.pages.flatMap((p) => p.logs || []) || [];
  }, [logsData]);

  const total = logsData?.pages?.[0]?.pagination?.total || 0;
  const stats = logsData?.pages?.[0]?.stats || { total: 0, successCount: 0, failedCount: 0 };

  // IntersectionObserver for infinite scroll trigger
  const observerRef = useRef();
  const lastLogRowRef = useCallback(
    (node) => {
      if (isLoading || isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  // Quick preset helper
  const applyPreset = (type) => {
    const today = new Date();
    const formatYMD = (d) => d.toISOString().split("T")[0];

    if (type === "today") {
      const t = formatYMD(today);
      setStartDate(t);
      setEndDate(t);
    } else if (type === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = formatYMD(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (type === "7days") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(today));
    } else if (type === "30days") {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(today));
    } else if (type === "clear") {
      setStartDate("");
      setEndDate("");
      setSelectedModule("all");
      setSelectedActionType("all");
      setSelectedStatus("all");
      setSearchTerm("");
    }
  };

  const hasActiveFilters =
    Boolean(startDate) ||
    Boolean(endDate) ||
    selectedModule !== "all" ||
    selectedActionType !== "all" ||
    selectedStatus !== "all" ||
    Boolean(searchTerm);

  return (
    <div className="space-y-5">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Activities
              </p>
              <h3 className="text-2xl font-bold mt-1">
                {stats.total.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Logged across all modules
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <History className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Successful
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                {stats.successCount.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Completed operations
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Failed Operations
              </p>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">
                {stats.failedCount.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Blocked / Validation errors
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                System Modules
              </p>
              <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                {allModules.length}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitored in real time
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-bold">
                <Filter className="w-4 h-4 text-primary" />
                Activity Log Search & Filter
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Monitor
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Review user operations, modified values, and system actions across all institutional modules
              </CardDescription>
            </div>

            {/* Quick Presets & Refresh */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("today")}
                className="h-8 text-xs font-medium"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("yesterday")}
                className="h-8 text-xs font-medium"
              >
                Yesterday
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("7days")}
                className="h-8 text-xs font-medium"
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("30days")}
                className="h-8 text-xs font-medium"
              >
                Last 30 Days
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyPreset("clear")}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Reset
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3.5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="space-y-1 lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Search className="w-3.5 h-3.5" /> Search Keyword
              </label>
              <div className="relative">
                <Input
                  placeholder="Search details, user, category, amount..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pr-8 text-xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Module Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Module
              </label>
              <Select
                value={selectedModule}
                onValueChange={(val) => setSelectedModule(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent className="max-h-80 overflow-y-auto">
                  <SelectItem value="all">All Modules</SelectItem>
                  {allModules.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Type Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Action Type
              </label>
              <Select
                value={selectedActionType}
                onValueChange={(val) => setSelectedActionType(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="CREATE">Added / Enrolled</SelectItem>
                  <SelectItem value="UPDATE">Updated / Modified</SelectItem>
                  <SelectItem value="DELETE">Deleted</SelectItem>
                  <SelectItem value="PAYMENT">Payment / Disbursed</SelectItem>
                  <SelectItem value="STATUS">Status Change / Approval</SelectItem>
                  <SelectItem value="AUTH">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> From Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> To Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Activity Logs Table */}
      <Card className="border shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                  <TableHead className="w-[65px] text-center text-xs font-semibold text-muted-foreground py-3.5 px-3 uppercase tracking-wider">
                    S.No
                  </TableHead>
                  <TableHead className="w-[160px] text-xs font-semibold text-muted-foreground py-3.5 px-3 uppercase tracking-wider whitespace-nowrap">
                    User
                  </TableHead>
                  <TableHead className="w-[170px] text-xs font-semibold text-muted-foreground py-3.5 px-3 uppercase tracking-wider whitespace-nowrap">
                    Action
                  </TableHead>
                  <TableHead className="w-[140px] text-xs font-semibold text-muted-foreground py-3.5 px-3 uppercase tracking-wider whitespace-nowrap">
                    Module
                  </TableHead>
                  <TableHead className="min-w-[420px] text-xs font-semibold text-muted-foreground py-3.5 px-3 uppercase tracking-wider">
                    Details
                  </TableHead>
                  <TableHead className="w-[210px] text-xs font-semibold text-muted-foreground py-3.5 px-3 uppercase tracking-wider whitespace-nowrap">
                    Date/Time
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Loading activity logs...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <History className="w-10 h-10 opacity-30" />
                        <p className="text-base font-semibold">No activity logs found</p>
                        <p className="text-xs text-muted-foreground">
                          {hasActiveFilters
                            ? "Try adjusting your filter criteria to view more records."
                            : "New user activities and system actions will appear here."}
                        </p>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyPreset("clear")}
                            className="mt-2 text-xs"
                          >
                            Reset Filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log, index) => {
                    const isLast = index === logs.length - 1;
                    const isFailed = log.status === "FAILED";
                    return (
                      <TableRow
                        key={log._id || log.id || index}
                        ref={isLast ? lastLogRowRef : null}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer transition-colors border-b border-border/70 min-h-[58px] ${
                          isFailed
                            ? "bg-rose-50/40 hover:bg-rose-50/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        {/* 1. S.NO */}
                        <TableCell className="text-center font-medium text-xs text-muted-foreground py-4 px-3 align-top">
                          {index + 1}
                        </TableCell>

                        {/* 2. USER (Plain text name only, no circular avatar) */}
                        <TableCell className="font-semibold text-xs text-foreground py-4 px-3 whitespace-nowrap align-top">
                          {log.userName || "System"}
                        </TableCell>

                        {/* 3. ACTION (Soft rounded pill badge) */}
                        <TableCell className="py-4 px-3 whitespace-nowrap align-top">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionBadgeClass(
                              log.action,
                              log.actionType
                            )}`}
                          >
                            {formatActionDisplay(log.action || (log.method === "POST" ? "Created" : log.method === "DELETE" ? "Deleted" : "Updated"))}
                          </span>
                        </TableCell>

                        {/* 4. MODULE (Framed institutional box) */}
                        <TableCell className="py-4 px-3 whitespace-nowrap align-top">
                          <span className="inline-block px-2.5 py-0.5 rounded border border-border/80 bg-muted/30 text-foreground text-xs font-medium">
                            {log.module}
                          </span>
                        </TableCell>

                        {/* 5. DETAILS (Clean unified action context) */}
                        <TableCell className="py-4 px-3 text-xs align-top">
                          <RenderLogDetails log={log} />
                        </TableCell>

                        {/* 6. DATE/TIME (dd-MMM-yyyy / hh:mm:ss a) */}
                        <TableCell className="py-4 px-3 text-xs font-mono font-medium text-muted-foreground whitespace-nowrap align-top">
                          {formatDateTime(log.timestamp)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}

                {/* Infinite Scroll Loading Row */}
                {isFetchingNextPage && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Loading more activities...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer with activity counter and scroll status */}
          <div className="flex items-center justify-between p-3.5 border-t bg-muted/20 text-xs text-muted-foreground">
            <div>
              Showing{" "}
              <span className="font-semibold text-foreground">
                {logs.length.toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {total.toLocaleString()}
              </span>{" "}
              activities
            </div>
            <div>
              {hasNextPage ? (
                <span className="text-[11px] text-muted-foreground/80 italic">
                  Scroll down to load more records
                </span>
              ) : logs.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" /> All activities loaded
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Inspection Dialog (Field changes & Endpoint removed as requested) */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="w-full sm:w-[560px] md:w-[650px] lg:w-[700px] p-0">
          <DialogHeader className="px-4 py-3 border-b flex flex-col gap-0.5">
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm sm:text-base flex items-center gap-1.5 font-bold">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                Activity Log Inspection
              </DialogTitle>
              {activeLog?.status === "FAILED" ? (
                <Badge className="bg-rose-100 text-rose-700 border-rose-300 text-[10px] font-bold gap-1 py-0.5 px-2 shrink-0">
                  <XCircle className="w-3 h-3" />
                  FAILED {activeLog?.statusCode ? `(${activeLog.statusCode})` : ""}
                </Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px] font-bold gap-1 py-0.5 px-2 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  SUCCESS {activeLog?.statusCode ? `(${activeLog.statusCode})` : ""}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Detailed audit trace and action context for this system activity
            </DialogDescription>
          </DialogHeader>

          {activeLog && (
            <div className="p-4 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
              {/* If FAILED: Highlighted Failure Reason */}
              {activeLog.status === "FAILED" && (
                <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-semibold text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Failure Reason:</span>
                  </div>
                  <div className="text-rose-900 dark:text-rose-200 text-xs font-mono bg-white/70 dark:bg-black/30 p-2 rounded border border-rose-200/50 break-words">
                    {activeLog.failureReason || "No explicit error message returned by server."}
                  </div>
                </div>
              )}

              {/* Action & Module Banner */}
              <div className="p-2.5 rounded-md border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionBadgeClass(
                      activeLog.action,
                      activeLog.actionType
                    )}`}
                  >
                    {formatActionDisplay(activeLog.action || activeLog.method)}
                  </span>
                  <span className="font-semibold text-xs text-foreground">
                    Module: {activeLog.module}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {formatDateTime(activeLog.timestamp)}
                </div>
              </div>

              {/* Full Details Display */}
              <div className="rounded-md border bg-card overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/40 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Activity Details
                </div>
                <div className="p-3 bg-muted/10">
                  <RenderLogDetails log={activeLog} />
                </div>
              </div>

              {/* Metadata Box (Endpoint completely removed) */}
              <div className="p-3 bg-muted/20 rounded-md border text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Performed By:</span>
                    <span className="font-semibold text-foreground">
                      {activeLog.userName} {activeLog.staffId ? `(${activeLog.staffId})` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">User Role:</span>
                    <span className="font-mono font-medium text-foreground">
                      {activeLog.userRole || "USER"}
                    </span>
                  </div>
                </div>
                {activeLog.userEmail && (
                  <div className="border-t border-border/40 pt-1.5">
                    <span className="text-muted-foreground text-[10px] block">Email:</span>
                    <span className="font-mono text-foreground">{activeLog.userEmail}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivityLogsTab;
