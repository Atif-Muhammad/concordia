import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Eye,
  Clock,
  Calendar,
  User,
  Shield,
  Layers,
  ArrowRight,
  Loader2,
  RefreshCw,
  FileText,
} from "lucide-react";
import { NAV_MODULES } from "@/lib/navigation.jsx";
import { getActivityLogs, getActivityLogFilterOptions, getActivityLogById } from "@/services/api";

// Format helper for timestamp
const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
};

// Relative time helper (e.g., "5m ago")
const getRelativeTime = (dateString) => {
  if (!dateString) return "";
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffSec = Math.floor((now - past) / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
};

// Module badge color mapping
const getModuleBadgeColor = (moduleName = "") => {
  const m = moduleName.toLowerCase();
  if (m.includes("student")) return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
  if (m.includes("fee")) return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300";
  if (m.includes("staff")) return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300";
  if (m.includes("attendance")) return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300";
  if (m.includes("payroll") || m.includes("hr")) return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300";
  if (m.includes("exam")) return "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300";
  if (m.includes("finance")) return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300";
  if (m.includes("hostel") || m.includes("boarding")) return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300";
  if (m.includes("front")) return "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950 dark:text-pink-300";
  if (m.includes("inventory")) return "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950 dark:text-lime-300";
  if (m.includes("wallet")) return "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300";
  if (m.includes("auth")) return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300";
  return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
};

// Method badge color mapping
const getMethodBadge = (method = "") => {
  const m = method.toUpperCase();
  if (m === "POST") return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-mono font-bold">POST</Badge>;
  if (m === "PUT" || m === "PATCH") return <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300 text-[10px] font-mono font-bold">{m}</Badge>;
  if (m === "DELETE") return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] font-mono font-bold">DEL</Badge>;
  return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-300 text-[10px] font-mono font-bold">GET</Badge>;
};

// Format helper for display values in before/after comparison
const formatDisplayVal = (val) => {
  if (val === null || val === undefined || val === "" || val === "None") {
    return <span className="text-muted-foreground italic font-sans">None / Empty</span>;
  }
  if (typeof val === "boolean") {
    return val ? "True / Yes" : "False / No";
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  // If ISO date string
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try {
      const d = new Date(val);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return val;
    }
  }
  return String(val);
};

// Helper to parse and render installment list cleanly
const renderInstallments = (val) => {
  let list = val;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      // not json
    }
  }

  if (Array.isArray(list)) {
    if (list.length === 0) {
      return <span className="text-muted-foreground italic text-xs">No installments</span>;
    }
    return (
      <div className="space-y-1 my-0.5">
        {list.map((inst, i) => {
          const num = inst.installmentNumber || i + 1;
          const amt = Number(inst.amount || 0).toLocaleString();
          const month = inst.month ? ` (${inst.month})` : "";
          let due = "";
          if (inst.dueDate) {
            try {
              const d = new Date(inst.dueDate);
              due = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            } catch {
              due = String(inst.dueDate).split("T")[0];
            }
          }
          const status = (inst.status || "UNPAID").toUpperCase();

          return (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-1.5 py-0.5 px-2 rounded bg-background/80 border border-border/50 text-[11px]"
            >
              <span className="font-semibold text-foreground">
                Inst #{num}{month}
              </span>
              <span className="font-bold font-mono text-foreground">
                PKR {amt}
              </span>
              {due && (
                <span className="text-[10px] text-muted-foreground font-sans">
                  Due: {due}
                </span>
              )}
              <Badge
                variant="outline"
                className={`text-[9px] py-0 px-1 font-bold ${
                  status === "PAID"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : status === "OVERDUE"
                    ? "bg-rose-50 text-rose-700 border-rose-300"
                    : "bg-amber-50 text-amber-700 border-amber-300"
                }`}
              >
                {status}
              </Badge>
            </div>
          );
        })}
      </div>
    );
  }

  return formatDisplayVal(val);
};

// General value renderer
const renderFieldValue = (field, val) => {
  if (
    field === "installments" ||
    (typeof val === "string" && val.includes("installmentNumber")) ||
    (Array.isArray(val) && val[0] && (val[0].installmentNumber || val[0].month))
  ) {
    return renderInstallments(val);
  }
  return formatDisplayVal(val);
};

// Fallback target extractor for historical logs
const getFallbackTarget = (log) => {
  if (!log) return null;
  const t = log.targetEntity;
  let name = (t?.name && t.name !== "Student" && t.name !== "Record") ? t.name : "";
  let identifier = t?.identifier || "";
  let subTitle = t?.subTitle || "";
  let entityType = t?.entityType || log.module || "";

  const desc = log.description || "";
  const b = log.body || {};
  const first = b.fName || b.firstName || "";
  const last = b.lName || b.lastName || "";
  const composed = `${first} ${last}`.trim();

  if (!name) {
    if (composed) name = composed;
    else if (b.name) name = b.name;
    else if (b.studentName) name = b.studentName;
    else if (b.title) name = b.title;
    else if (b.accountName) name = b.accountName;
    else if (b.itemName) name = b.itemName;
  }

  if (!subTitle) {
    const father = b.fatherOrguardian || b.fatherName || b.guardianName;
    if (father) subTitle = `Father: ${father}`;
    else if (b.designation) subTitle = `Designation: ${b.designation}`;
    else if (b.category) subTitle = b.category;
    else if (b.amount != null) subTitle = `PKR ${Number(b.amount).toLocaleString()}`;
    else if (b.feeMonth) subTitle = `Month: ${b.feeMonth}`;
  }

  if (!identifier) {
    const roll = b.rollNumber || b.rollNo;
    if (roll) identifier = `Roll: ${roll}`;
    else if (b.staffId) identifier = `Staff ID: ${b.staffId}`;
    else if (b.challanNo || b.challanNumber) identifier = `Challan: #${b.challanNo || b.challanNumber}`;
    else if (b.voucherNo) identifier = `Voucher: ${b.voucherNo}`;
    else if (b.receiptNo) identifier = `Receipt: ${b.receiptNo}`;
    else if (b.itemCode) identifier = `Item: ${b.itemCode}`;
    else if (b.accountNumber) identifier = `Account: ${b.accountNumber}`;
  }

  // Regex extractors from description for older historical logs
  if (log.module === "Students" || desc.toLowerCase().includes("student")) {
    if (!entityType) entityType = "Student";
    if (!identifier) {
      const rollMatch = desc.match(/\(Roll:\s*([^)]+)\)/i);
      if (rollMatch) identifier = `Roll: ${rollMatch[1]}`;
    }
    if (!name) {
      const nameMatch = desc.match(/(?:student|record|admitted new student):\s*([^(\n•]+)/i);
      if (nameMatch && nameMatch[1].trim() && nameMatch[1].trim() !== "Student") {
        name = nameMatch[1].trim();
      }
    }
  } else if (log.module === "Staff" || desc.toLowerCase().includes("staff")) {
    if (!entityType) entityType = "Staff";
    if (!identifier) {
      const staffMatch = desc.match(/\(Staff ID:\s*([^)]+)\)/i) || desc.match(/\(([A-Z]+-\d+)\)/i);
      if (staffMatch) identifier = `Staff ID: ${staffMatch[1]}`;
    }
    if (!name) {
      const nameMatch = desc.match(/(?:staff|record):\s*([^(\n•]+)/i);
      if (nameMatch && nameMatch[1].trim() && nameMatch[1].trim() !== "Staff") {
        name = nameMatch[1].trim();
      }
    }
  } else if (log.module?.includes("Fee") || desc.toLowerCase().includes("challan")) {
    if (!entityType) entityType = "FeeChallan";
    if (!identifier) {
      const chMatch = desc.match(/#([A-Za-z0-9\-]+)/);
      if (chMatch) identifier = `Challan: #${chMatch[1]}`;
    }
  }

  if (name || identifier || subTitle) {
    return {
      name: name || t?.name || "Record",
      identifier,
      subTitle,
      entityType: entityType || "Record"
    };
  }

  return t || null;
};

// Fallback cell renderer for Target Record column in the table
const renderTargetFallback = (log) => {
  const target = getFallbackTarget(log);
  if (target?.name) {
    return (
      <div className="space-y-0.5">
        <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
          <span className="truncate">{target.name}</span>
          {target.entityType && (
            <Badge
              variant="outline"
              className="text-[9px] py-0 px-1 font-mono uppercase bg-muted/50 text-muted-foreground border-border/80 shrink-0"
            >
              {target.entityType}
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
          {target.identifier && (
            <span className="font-mono font-medium text-foreground/80">
              {target.identifier}
            </span>
          )}
          {target.identifier && target.subTitle && (
            <span className="text-muted-foreground/40">•</span>
          )}
          {target.subTitle && (
            <span className="truncate">{target.subTitle}</span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
      <span className="text-muted-foreground/50">—</span>
      <span className="truncate">{log.subModule || log.module || "System Operation"}</span>
    </div>
  );
};

// Complete master module tree aligning 100% with the sidebar navigation & system features
export const MASTER_MODULE_DEFINITIONS = [
  {
    name: "Executive Dashboard",
    subModules: ["Overview", "Financial KPIs", "Class Tuition Averages"],
  },
  {
    name: "Dashboard",
    subModules: ["Overview", "Operational Snapshots"],
  },
  {
    name: "Front Office",
    subModules: ["Inquiry", "Visitor Book", "Complaints", "Contacts"],
  },
  {
    name: "Students",
    subModules: ["Admissions & Directory", "Student Profile", "Status & History", "Academic Records"],
  },
  {
    name: "Staff",
    subModules: ["Staff Directory", "Settings"],
  },
  {
    name: "Attendance",
    subModules: ["Record Attendance", "Leave", "Reports", "Individual Reports", "Teacher Attendance"],
  },
  {
    name: "Fee Management",
    subModules: ["Challans", "Extra Challans", "Fee Heads", "Fee Structures", "Reports", "Settings", "Student History"],
  },
  {
    name: "Examination",
    subModules: ["Exams", "Marks Entry", "Results"],
  },
  {
    name: "Complaints",
    subModules: ["Complaints List", "Register Complaint", "Resolution & Status"],
  },
  {
    name: "Academics",
    subModules: ["Sessions", "Programs", "Classes", "Sections", "Subjects", "Subject Classes", "Teacher Classes", "Timetable"],
  },
  {
    name: "HR & Payroll",
    subModules: ["Leaves", "Payroll", "Attendance", "Advance Salary", "Departments", "Holidays", "Reports"],
  },
  {
    name: "Boarding",
    subModules: ["Registration", "Rooms", "Fees", "Expenses", "Inventory", "Reports", "Settings"],
  },
  {
    name: "Finance",
    subModules: ["Dashboard", "Income", "Expense", "Reports", "Closing"],
  },
  {
    name: "Inventory",
    subModules: ["Inventory", "Expenses"],
  },
  {
    name: "Wallets / Accounts",
    subModules: ["Wallets", "Contra Transfers", "Direct Deposits"],
  },
  {
    name: "Configuration",
    subModules: ["Institute", "Admins", "Templates", "Wallets / Accounts", "Activity Logs"],
  },
  {
    name: "Authentication",
    subModules: ["Login", "Logout", "Session"],
  },
];

export const ActivityLogsTab = () => {
  // Query Filters State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedSubModule, setSelectedSubModule] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state for viewing log detail
  const [selectedLog, setSelectedLog] = useState(null);

  // Fetch full log details if selected
  const { data: fullLogDetail } = useQuery({
    queryKey: ["activityLogDetail", selectedLog?._id || selectedLog?.id],
    queryFn: () => getActivityLogById(selectedLog?._id || selectedLog?.id),
    enabled: !!(selectedLog?._id || selectedLog?.id),
    staleTime: 60000,
  });
  const activeLog = fullLogDetail || selectedLog;

  // Fetch filter options (distinct modules, submodules, staff list)
  const { data: filterOptions } = useQuery({
    queryKey: ["activityLogFilterOptions"],
    queryFn: getActivityLogFilterOptions,
    staleTime: 60000,
  });

  // Build API query parameters
  const queryParams = useMemo(() => {
    return {
      page,
      limit,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      staffId: selectedStaff !== "all" ? selectedStaff : undefined,
      module: selectedModule !== "all" ? selectedModule : undefined,
      subModule: selectedSubModule !== "all" ? selectedSubModule : undefined,
      status: selectedStatus !== "all" ? selectedStatus : undefined,
      search: searchTerm.trim() || undefined,
    };
  }, [
    page,
    limit,
    startDate,
    endDate,
    startTime,
    endTime,
    selectedStaff,
    selectedModule,
    selectedSubModule,
    selectedStatus,
    searchTerm,
  ]);

  // Fetch activity logs
  const {
    data: logsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["activityLogs", queryParams],
    queryFn: () => getActivityLogs(queryParams),
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 };
  const stats = logsData?.stats || { total: 0, successCount: 0, failedCount: 0 };

  // Master list of all modules in exact sidebar order + sub-modules
  const allModules = useMemo(() => {
    const list = MASTER_MODULE_DEFINITIONS.map((m) => ({
      name: m.name,
      subModules: [...m.subModules],
    }));

    if (filterOptions?.modules && Array.isArray(filterOptions.modules)) {
      filterOptions.modules.forEach((bm) => {
        const existing = list.find((m) => m.name.toLowerCase() === bm.name.toLowerCase());
        if (existing) {
          (bm.subModules || []).forEach((sub) => {
            if (sub && !existing.subModules.includes(sub)) {
              existing.subModules.push(sub);
            }
          });
        } else if (bm.name) {
          list.push({
            name: bm.name,
            subModules: bm.subModules || [],
          });
        }
      });
    }

    return list;
  }, [filterOptions]);

  // Sub-modules available for currently selected module
  const availableSubModules = useMemo(() => {
    if (selectedModule === "all") return [];
    const mod = allModules.find(
      (m) => m.name.toLowerCase() === selectedModule.toLowerCase()
    );
    return mod?.subModules || [];
  }, [allModules, selectedModule]);

  // Quick preset helper
  const applyPreset = (type) => {
    const today = new Date();
    const formatYMD = (d) => d.toISOString().split("T")[0];

    setPage(1);
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
      setStartTime("");
      setEndTime("");
      setSelectedStaff("all");
      setSelectedModule("all");
      setSelectedSubModule("all");
      setSelectedStatus("all");
      setSearchTerm("");
    }
  };

  const hasActiveFilters =
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(startTime) ||
    Boolean(endTime) ||
    selectedStaff !== "all" ||
    selectedModule !== "all" ||
    selectedSubModule !== "all" ||
    selectedStatus !== "all" ||
    Boolean(searchTerm);

  return (
    <div className="space-y-6">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Activities
              </p>
              <h3 className="text-2xl font-bold mt-1">
                {stats.total.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Across all system modules
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <History className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Successful
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                {stats.successCount.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Operations completed successfully
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Failed Operations
              </p>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">
                {stats.failedCount.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Blocked / Validation / System errors
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600">
              <XCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tracked Modules
              </p>
              <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                {allModules.length}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                100% full system coverage
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & Action Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                Activity Log Filters
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live (5s)
                </span>
              </CardTitle>
              <CardDescription>
                Filter system logs by date range, time of day, staff member, module, or status
              </CardDescription>
            </div>

            {/* Quick Presets & Refresh */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("today")}
                className="h-8 text-xs"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("yesterday")}
                className="h-8 text-xs"
              >
                Yesterday
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("7days")}
                className="h-8 text-xs"
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("30days")}
                className="h-8 text-xs"
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

        <CardContent className="pt-4 space-y-4">
          {/* Row 1: Search & Date/Time filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="space-y-1 lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Search className="w-3.5 h-3.5" /> Search Keywords
              </label>
              <div className="relative">
                <Input
                  placeholder="Search description, staff name, staffId, error..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 pr-8"
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

            {/* Date Range: From */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> From Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            {/* Date Range: To */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> To Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                Status
              </label>
              <Select
                value={selectedStatus}
                onValueChange={(val) => {
                  setSelectedStatus(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="SUCCESS">Success Only</SelectItem>
                  <SelectItem value="FAILED">Failed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Time Filter, Staff Filter, Module, SubModule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1 border-t">
            {/* Time Filter: From */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> From Time
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            {/* Time Filter: To */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> To Time
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            {/* Staff Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Staff Member
              </label>
              <Select
                value={selectedStaff}
                onValueChange={(val) => {
                  setSelectedStaff(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Staff Members" />
                </SelectTrigger>
                <SelectContent className="max-h-80 overflow-y-auto">
                  <SelectItem value="all">All Staff Members</SelectItem>
                  {filterOptions?.staffList?.map((s) => (
                    <SelectItem key={s.staffId || s.email} value={s.staffId || s.email}>
                      {s.staffId ? `[${s.staffId}] ` : ""}{s.name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Module Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Module
              </label>
              <Select
                value={selectedModule}
                onValueChange={(val) => {
                  setSelectedModule(val);
                  setSelectedSubModule("all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent className="max-h-80 overflow-y-auto">
                  <SelectItem value="all">All Modules</SelectItem>
                  {allModules.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-module Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                Sub-module
              </label>
              <Select
                value={selectedSubModule}
                onValueChange={(val) => {
                  setSelectedSubModule(val);
                  setPage(1);
                }}
                disabled={selectedModule === "all"}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Sub-modules" />
                </SelectTrigger>
                <SelectContent className="max-h-80 overflow-y-auto">
                  <SelectItem value="all">All Sub-modules</SelectItem>
                  {availableSubModules.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                  {availableSubModules.length === 0 && selectedModule !== "all" && (
                    <SelectItem value="General">General</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs Table */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[170px] text-xs font-semibold py-3 px-4">
                    Timestamp
                  </TableHead>
                  <TableHead className="w-[180px] text-xs font-semibold py-3 px-4">
                    Staff / User
                  </TableHead>
                  <TableHead className="w-[160px] text-xs font-semibold py-3 px-4">
                    Module & Sub-module
                  </TableHead>
                  <TableHead className="w-[100px] text-xs font-semibold py-3 px-4">
                    Action
                  </TableHead>
                  <TableHead className="w-[240px] text-xs font-semibold py-3 px-4">
                    Target Record
                  </TableHead>
                  <TableHead className="w-[130px] text-xs font-semibold py-3 px-4 text-center">
                    Status
                  </TableHead>
                  <TableHead className="w-[70px] text-xs font-semibold py-3 px-4 text-center">
                    View
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm">Loading activity logs...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <History className="w-10 h-10 opacity-30" />
                        <p className="text-base font-medium">No activity logs found</p>
                        <p className="text-xs text-muted-foreground">
                          {hasActiveFilters
                            ? "Try adjusting or resetting your filter criteria to view more records."
                            : "System actions and staff operations will appear here as they occur."}
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
                  logs.map((log) => {
                    const isFailed = log.status === "FAILED";
                    const target = getFallbackTarget(log);
                    return (
                      <TableRow
                        key={log._id || log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors group ${
                          isFailed ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                        }`}
                      >
                        {/* Timestamp */}
                        <TableCell className="py-2 px-3 sm:px-4 text-xs font-mono whitespace-nowrap">
                          <div className="font-medium text-foreground">
                            {formatDateTime(log.timestamp)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {getRelativeTime(log.timestamp)}
                          </div>
                        </TableCell>

                        {/* Staff / User */}
                        <TableCell className="py-2 px-3 sm:px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase shrink-0">
                              {log.userName?.charAt(0) || "U"}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                                <span>{log.userName || "System"}</span>
                                {log.staffId && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1 font-mono font-bold bg-amber-50 text-amber-700 border-amber-300 shrink-0"
                                  >
                                    {log.staffId}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {log.userEmail || log.userRole}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Module & Sub-module */}
                        <TableCell className="py-2 px-3 sm:px-4">
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] sm:text-[11px] font-medium border ${getModuleBadgeColor(
                                log.module
                              )}`}
                            >
                              {log.module}
                            </Badge>
                            {log.subModule && (
                              <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
                                <span className="truncate">{log.subModule}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Action & Method */}
                        <TableCell className="py-2 px-3 sm:px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {getMethodBadge(log.method)}
                          </div>
                        </TableCell>

                        {/* Target Record */}
                        <TableCell className="py-2 px-3 sm:px-4">
                          {target?.name && target.name !== "Record" ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                                <span className="truncate">{target.name}</span>
                                {target.entityType && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] py-0 px-1 font-mono uppercase bg-muted/60 text-muted-foreground border-border shrink-0"
                                  >
                                    {target.entityType}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                                {target.identifier && (
                                  <span className="font-mono font-medium text-foreground/80">
                                    {target.identifier}
                                  </span>
                                )}
                                {target.identifier && target.subTitle && (
                                  <span className="text-muted-foreground/40">•</span>
                                )}
                                {target.subTitle && (
                                  <span className="truncate">{target.subTitle}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            renderTargetFallback(log)
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-2 px-3 sm:px-4 text-center whitespace-nowrap">
                          {isFailed ? (
                            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200 dark:bg-rose-950 dark:text-rose-300 text-[10px] sm:text-xs gap-1 font-semibold">
                              <XCircle className="w-3 h-3" />
                              FAILED
                              {log.statusCode && (
                                <span className="opacity-80">({log.statusCode})</span>
                              )}
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] sm:text-xs gap-1 font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              SUCCESS
                            </Badge>
                          )}
                        </TableCell>

                        {/* Details View Action */}
                        <TableCell className="py-2 px-3 sm:px-4 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary group-hover:text-primary transition-colors"
                            title="View Log Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-muted/20">
            <div className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {pagination.total > 0 ? (page - 1) * limit + 1 : 0}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(page * limit, pagination.total)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {pagination.total.toLocaleString()}
              </span>{" "}
              activities
            </div>

            <div className="flex items-center gap-3">
              {/* Rows Per Page */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Rows per page:</span>
                <Select
                  value={String(limit)}
                  onValueChange={(val) => {
                    setLimit(parseInt(val, 10));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Prev / Next Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="h-8 px-3 text-xs"
                >
                  Previous
                </Button>
                <div className="text-xs px-2 text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                  <span className="font-semibold text-foreground">{pagination.totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages || isLoading}
                  className="h-8 px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent
          className="w-full sm:w-[540px] md:w-[620px] lg:w-[700px] p-0"
          bodyClassName="p-2 sm:p-2.5 flex-1 flex flex-col gap-2 overflow-y-auto min-h-0"
        >
          <DialogHeader className="px-3 py-2 border-b shrink-0 flex flex-col gap-0.5">
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm sm:text-base flex items-center gap-1.5 font-bold">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                Activity Log Inspection
              </DialogTitle>
              {activeLog?.status === "FAILED" ? (
                <Badge className="bg-rose-100 text-rose-700 border-rose-300 text-[10px] font-bold gap-1 py-0.5 px-1.5 shrink-0">
                  <XCircle className="w-3 h-3" />
                  FAILED {activeLog?.statusCode ? `(${activeLog.statusCode})` : ""}
                </Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px] font-bold gap-1 py-0.5 px-1.5 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  SUCCESS {activeLog?.statusCode ? `(${activeLog.statusCode})` : ""}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
              Detailed audit trace and field modifications for this system activity
            </DialogDescription>
          </DialogHeader>

          {activeLog && (
            <div className="space-y-2 text-xs">
              {/* If FAILED: Highlighted Failure Reason Card */}
              {activeLog.status === "FAILED" && (
                <div className="p-2 rounded-md bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-semibold text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Failure Reason:</span>
                  </div>
                  <div className="text-rose-900 dark:text-rose-200 text-xs font-medium bg-white/60 dark:bg-black/30 p-1.5 rounded border border-rose-200/50 break-words font-mono">
                    {activeLog.failureReason || "No explicit error message returned by server."}
                  </div>
                </div>
              )}

              {/* 1. Target Entity Identification Bar */}
              {(() => {
                const target = getFallbackTarget(activeLog);
                if (!target || (!target.name && !target.identifier)) return null;

                const displayName = target.name && target.name !== "Student" && target.name !== "Record"
                  ? target.name
                  : (target.identifier || target.entityType || "Record");

                return (
                  <div className="px-2.5 py-1.5 rounded-md border border-primary/20 bg-primary/5 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-foreground">
                        {displayName}
                      </span>
                      {target.subTitle && (
                        <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">
                          — {target.subTitle}
                        </span>
                      )}
                      {target.identifier && (
                        <span className="text-[11px] sm:text-xs font-mono font-bold text-primary">
                          — {target.identifier}
                        </span>
                      )}
                    </div>
                    {target.entityType && (
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase font-mono font-bold py-0 px-1.5 bg-background text-primary border-primary/30 shrink-0"
                      >
                        {target.entityType}
                      </Badge>
                    )}
                  </div>
                );
              })()}

              {/* 2. Moved Activity Description */}
              <div className="px-2.5 py-1.5 rounded-md border bg-muted/20 text-xs flex flex-col sm:flex-row sm:items-baseline gap-1">
                <span className="font-bold text-muted-foreground shrink-0 text-[10px] sm:text-[11px] uppercase tracking-wider">
                  Description:
                </span>
                <span className="font-medium text-foreground text-xs leading-relaxed break-words">
                  {activeLog.description}
                </span>
              </div>

              {/* 3. Field Changes Comparison: Single Unified Big Box */}
              {activeLog.changes && activeLog.changes.length > 0 ? (
                <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
                  {/* Big Box Header */}
                  <div className="px-2.5 py-1.5 bg-muted/40 border-b flex items-center justify-between">
                    <div className="text-[11px] sm:text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <span>Field Modifications</span>
                      <Badge variant="secondary" className="text-[9px] sm:text-[10px] font-mono font-bold py-0 px-1.5">
                        {activeLog.changes.length} {activeLog.changes.length === 1 ? "field" : "fields"}
                      </Badge>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground font-mono">
                      Old Value → New Value
                    </div>
                  </div>

                  {/* Big Box Rows */}
                  <div className="divide-y divide-border/60">
                    {activeLog.changes.map((change, idx) => (
                      <div key={idx} className="p-2 sm:p-2.5 hover:bg-muted/10 transition-colors space-y-1">
                        {/* Field Label Header */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            {change.fieldLabel || change.field}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            {change.field}
                          </span>
                        </div>

                        {/* Two Columns with Arrow inside this row */}
                        <div className="grid grid-cols-[1fr,auto,1fr] items-stretch gap-1.5 sm:gap-2 text-xs">
                          {/* Box 1: Before (Old Value) */}
                          <div className="p-1.5 sm:p-2 rounded bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 min-w-0">
                            <div className="text-[9px] uppercase font-bold tracking-wider text-amber-700/80 dark:text-amber-400 mb-0.5">
                              Before (Old Value)
                            </div>
                            <div className="text-[11px] sm:text-xs font-mono font-medium text-foreground break-words whitespace-pre-wrap">
                              {renderFieldValue(change.field, change.oldValue)}
                            </div>
                          </div>

                          {/* Arrow Right Indicator */}
                          <div className="flex items-center justify-center px-0.5 text-muted-foreground">
                            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                          </div>

                          {/* Box 2: After (New Value) */}
                          <div className="p-1.5 sm:p-2 rounded bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-300/70 dark:border-emerald-700/50 min-w-0">
                            <div className="text-[9px] uppercase font-bold tracking-wider text-emerald-700/80 dark:text-emerald-400 mb-0.5">
                              After (New Value)
                            </div>
                            <div className="text-[11px] sm:text-xs font-mono font-bold text-emerald-950 dark:text-emerald-100 break-words whitespace-pre-wrap">
                              {renderFieldValue(change.field, change.newValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Fallback when changes array is not present (historical logs or request body) */
                activeLog.body && Object.keys(activeLog.body).length > 0 && (
                  <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
                    <div className="px-2.5 py-1.5 bg-muted/40 border-b text-[11px] sm:text-xs font-bold text-foreground uppercase tracking-wider">
                      Payload Attributes
                    </div>
                    <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {Object.entries(activeLog.body)
                        .filter(([k]) => !['_id', 'password', 'token', 'id'].includes(k))
                        .slice(0, 8)
                        .map(([k, v]) => (
                          <div key={k} className="p-1.5 rounded border bg-muted/20 text-xs">
                            <div className="font-semibold text-muted-foreground text-[9px] uppercase">
                              {k.replace(/([A-Z])/g, ' $1')}
                            </div>
                            <div className="font-mono font-medium text-foreground truncate mt-0.5 text-[11px]">
                              {typeof v === 'object' ? renderFieldValue(k, v) : String(v)}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              )}

              {/* 4. Grid of Key Technical Info */}
              <div className="p-2 sm:p-2.5 bg-muted/20 rounded-md border text-xs space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[9px] sm:text-[10px]">Timestamp:</span>
                    <span className="font-semibold text-foreground font-mono text-[10px] sm:text-[11px]">
                      {formatDateTime(activeLog.timestamp)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px] sm:text-[10px]">Performed By:</span>
                    <span className="font-semibold text-foreground text-[10px] sm:text-[11px]">
                      {activeLog.userName} {activeLog.staffId ? `(${activeLog.staffId})` : ""}
                    </span>
                  </div>
                </div>
                <div className="border-t border-border/40 pt-1">
                  <span className="text-muted-foreground block text-[9px] sm:text-[10px]">Role / Email:</span>
                  <span className="font-mono text-foreground text-[10px] sm:text-[11px] break-all">
                    {activeLog.userEmail || "N/A"}{" "}
                    <Badge variant="outline" className="text-[9px] font-mono py-0 px-1 ml-1 font-bold">
                      {activeLog.userRole}
                    </Badge>
                  </span>
                </div>
                <div className="border-t border-border/40 pt-1">
                  <span className="text-muted-foreground block text-[9px] sm:text-[10px]">Endpoint:</span>
                  <span className="font-mono text-foreground break-all block text-[10px] sm:text-[11px]">
                    [{activeLog.method}] {activeLog.endpoint}
                  </span>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
