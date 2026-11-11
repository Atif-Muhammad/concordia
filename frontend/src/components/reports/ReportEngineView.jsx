import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, ArrowUpDown, FileDown, FileSpreadsheet,
  Info, Loader2, Play, Printer, RefreshCw, Wrench,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CheckboxMultiSelect from "@/components/ui/CheckboxMultiSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { ModernChartCard, MODERN_CHART_COLORS } from "@/components/ui/modern-charts";
import {
  extractReadableApiError,
  runReportQuery,
  runReportInlineAction,
  getAcademicSessions,
  getPrograms,
  getClasses,
  getSections,
  getSubjects,
  getExams,
  getDepartments,
  getTeachers,
  getAllStaff,
  getFeeHeads,
  getWallets,
  getGradeSchemes,
  searchStudents,
} from "../../../config/apis";
import {
  exportReportWorkbook,
  printOrExportPdfReport,
} from "./reportExport";

const CHART_PALETTE = [
  "#F7941E",
  MODERN_CHART_COLORS.primary,
  MODERN_CHART_COLORS.success,
  MODERN_CHART_COLORS.secondary,
  MODERN_CHART_COLORS.teal,
  MODERN_CHART_COLORS.danger,
];

const toChartNumber = (val) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

export function normalizeChartSpec(ch) {
  if (!ch || typeof ch !== "object") {
    return { type: "bar", title: "", subtitle: "", xKey: "name", nameKey: "name", dataKey: "value", series: [], data: [], isEmpty: true };
  }
  const type = String(ch.type || "bar").toLowerCase();
  const xKey = ch.xKey || ch.nameKey || "name";
  const nameKey = ch.nameKey || ch.xKey || "name";
  const fallbackKey = ch.dataKey || ch.yKey || "value";
  const rawSeries = Array.isArray(ch.series) && ch.series.length > 0
    ? ch.series
    : [{ dataKey: fallbackKey, label: ch.yLabel || ch.title || fallbackKey }];

  const series = rawSeries
    .map((s, idx) => {
      const key = s?.dataKey || s?.key || fallbackKey;
      if (!key) return null;
      return {
        dataKey: key,
        label: s?.label || s?.name || key,
        color: s?.color || CHART_PALETTE[idx % CHART_PALETTE.length],
      };
    })
    .filter(Boolean);

  const primaryDataKey = ch.dataKey || ch.yKey || series[0]?.dataKey || "value";
  const rawData = Array.isArray(ch.data) ? ch.data : [];

  const coercedData = rawData.map((row) => {
    if (!row || typeof row !== "object") return row;
    const next = { ...row };
    if (type === "pie") {
      next[primaryDataKey] = toChartNumber(row[primaryDataKey]);
    } else {
      for (const s of series) {
        next[s.dataKey] = toChartNumber(row[s.dataKey]);
      }
    }
    return next;
  });

  if (type === "pie") {
    const positiveSlices = coercedData.filter((d) => toChartNumber(d?.[primaryDataKey]) > 0);
    return {
      ...ch,
      type: "pie",
      xKey,
      nameKey,
      dataKey: primaryDataKey,
      series,
      data: positiveSlices,
      isEmpty: positiveSlices.length === 0,
    };
  }

  return {
    ...ch,
    type: type === "line" ? "line" : "bar",
    xKey,
    nameKey,
    dataKey: primaryDataKey,
    series,
    data: coercedData,
    isEmpty: coercedData.length === 0 || series.length === 0,
  };
}

const toArray = (res, nestedKey) => {
  if (Array.isArray(res)) return res;
  if (nestedKey && Array.isArray(res?.[nestedKey])) return res[nestedKey];
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
};

const getId = (item) => String(item?._id || item?.id || "");

export const OPTIONS_SOURCE_MAP = {
  sessions: "session",
  session: "session",
  programs: "program",
  program: "program",
  classes: "class",
  class: "class",
  sections: "section",
  section: "section",
  subjects: "subject",
  subject: "subject",
  exams: "exam",
  exam: "exam",
  departments: "department",
  department: "department",
  teachers: "teacher",
  teacher: "teacher",
  staff: "staff",
  cashiers: "cashier",
  cashier: "cashier",
  feeHeads: "feeHead",
  feeHead: "feeHead",
  wallets: "wallet",
  wallet: "wallet",
  students: "student",
  student: "student",
  gradeSchemes: "gradeScheme",
  gradeScheme: "gradeScheme",
};

const SINGLE_SELECT_KEYS = new Set([
  "basis",
  "dueWindowDays",
  "leaveMode",
  "dataStatus",
  "firstInstStatus",
  "receiptStatus",
  "gradeSchemeId",
  "studentId",
  "examId",
]);

const CASCADE_DOWNSTREAM = {
  departmentId: ["programId", "classId", "sectionId", "subjectId", "examId", "teacherId", "staffId"],
  sessionId: ["examId"],
  programId: ["classId", "sectionId", "subjectId", "examId"],
  classId: ["sectionId", "subjectId", "examId"],
};

export function formatExamOptionLabel(exam) {
  if (!exam) return "";
  const name = exam.examName || exam.name || "Untitled Exam";
  const progName = exam.programId?.name || exam.program?.name || exam.programName || "";
  const className = exam.classId?.name || exam.class?.name || exam.className || "";
  const sessionName = exam.sessionId?.name || exam.session || "";
  const scope = [progName, className].filter(Boolean).join(" — ");
  const sessionSuffix = sessionName ? ` [${sessionName}]` : "";
  return scope ? `${name} — ${scope}${sessionSuffix}` : `${name}${sessionSuffix}`;
}

export function buildExamOption(exam) {
  const keywords = [
    exam?.examName || exam?.name,
    exam?.programId?.name || exam?.program?.name || exam?.programName,
    exam?.programId?.code || exam?.program?.code,
    exam?.classId?.name || exam?.class?.name || exam?.className,
    exam?.sessionId?.name || exam?.session,
    exam?.type,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    value: getId(exam),
    label: formatExamOptionLabel(exam),
    keywords,
  };
}

export function resolveFilterKind(filter) {
  if (!filter) return "text";
  if (filter.type && !["select", "multiselect"].includes(filter.type)) {
    return filter.type;
  }
  if (filter.optionsSource && OPTIONS_SOURCE_MAP[filter.optionsSource]) {
    return OPTIONS_SOURCE_MAP[filter.optionsSource];
  }
  return filter.type || "text";
}

export function isMultiSelectFilter(filter) {
  if (!filter) return false;
  const kind = resolveFilterKind(filter);
  if (["date", "month", "number", "text", "student", "gradeScheme"].includes(kind)) {
    return false;
  }
  if (SINGLE_SELECT_KEYS.has(filter.key)) return false;
  if (filter.multi === false || filter.multiple === false) return false;
  return true;
}

export function parseFilterValues(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter((v) => v && !/^(all|\*)$/i.test(v));
  }
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v && !/^(all|\*)$/i.test(v));
}

export function formatFilterValues(selected = []) {
  const clean = (Array.isArray(selected) ? selected : [])
    .map((v) => String(v ?? "").trim())
    .filter((v) => v && !/^(all|\*)$/i.test(v));
  return clean.join(",");
}

export function stripAllSentinelOptions(options = []) {
  return (Array.isArray(options) ? options : []).filter(
    (opt) => opt && !/^(all|\*)$/i.test(String(opt.value ?? "").trim())
  );
}

export function resolveActionKey(actionDef) {
  return actionDef?.name || actionDef?.key || "";
}

export function buildActionInitialForm(actionDef, row = null) {
  const initialForm = {};
  (actionDef?.fields || []).forEach((fld) => {
    const fieldTarget = fld.rowKey || fld.key;
    const rowVal =
      row?.[fieldTarget] ??
      row?.actionContext?.[fieldTarget] ??
      row?._meta?.[fieldTarget];
    initialForm[fld.key] = rowVal ?? fld.defaultValue ?? "";
  });
  return initialForm;
}

/**
 * Unified Concordia ERP Report Engine view reproducing the sample report book layout:
 * - Orange (#F7941E) & White header with Concordia branding & report purpose
 * - Interactive filter controls + FILTER / SELECTED VALUE table
 * - AT-A-GLANCE SUMMARY (4 KPI cards)
 * - Optional Recharts visualizations + custom extra slot
 * - Sortable REPORT DETAILS table with totals, drill-down, & inline actions
 * - MANAGEMENT INSIGHT / EXCEPTIONS amber callout
 * - Export PDF | Export Excel | Print toolbar & Confidential footer
 */
export const ReportEngineView = ({
  reportKey,
  initialFilters = {},
  onDrillDown,
  extraSheets = [],
  renderExtraContent,
  compact = false,
}) => {
  const { toast } = useToast();

  const [filters, setFilters] = useState(() => ({ ...initialFilters }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...initialFilters }));
  const [localSearch, setLocalSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });
  const [studentQuery, setStudentQuery] = useState("");
  const [actionModal, setActionModal] = useState({ open: false, action: null, row: null, form: {} });

  useEffect(() => {
    setFilters({ ...initialFilters });
    setAppliedFilters({ ...initialFilters });
    setLocalSearch("");
    setSortConfig({ key: null, dir: "asc" });
  }, [reportKey]);

  const { data: payload, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["report-engine", reportKey, appliedFilters],
    queryFn: () => runReportQuery(reportKey, appliedFilters),
    enabled: Boolean(reportKey),
    keepPreviousData: false,
  });

  const schemaTypes = useMemo(() => {
    const set = new Set();
    (payload?.report?.filterSchema || []).forEach((f) => set.add(resolveFilterKind(f)));
    return set;
  }, [payload?.report?.filterSchema]);

  // Lazy server-side filtered lookup queries — only fetch reference lists required by filterSchema
  const { data: sessions = [] } = useQuery({
    queryKey: ["ref-sessions"],
    queryFn: () => getAcademicSessions().then((r) => toArray(r)),
    enabled: schemaTypes.has("session"),
    staleTime: 5 * 60_000,
  });
  const { data: exams = [] } = useQuery({
    queryKey: [
      "ref-exams",
      filters.sessionId || "",
      filters.programId || "",
      filters.classId || "",
    ],
    queryFn: () =>
      getExams({
        sessionId: filters.sessionId || undefined,
        programId: filters.programId || undefined,
        classId: filters.classId || undefined,
      }).then((r) => toArray(r)),
    enabled: schemaTypes.has("exam"),
    staleTime: 60_000,
  });
  const selectedExam = useMemo(
    () => exams.find((e) => getId(e) === String(filters.examId || "")) || null,
    [exams, filters.examId]
  );
  const effectiveProgramId = filters.programId || getId(selectedExam?.programId);
  const effectiveClassId = filters.classId || getId(selectedExam?.classId);
  const effectiveSessionId = filters.sessionId || getId(selectedExam?.sessionId);

  const { data: programs = [] } = useQuery({
    queryKey: ["ref-programs", filters.departmentId || ""],
    queryFn: () =>
      getPrograms(filters.departmentId ? { departmentId: filters.departmentId } : {}).then((r) =>
        toArray(r)
      ),
    enabled: schemaTypes.has("program") || schemaTypes.has("class"),
    staleTime: 60_000,
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["ref-classes", effectiveProgramId || "", filters.departmentId || ""],
    queryFn: () =>
      getClasses({
        programId: effectiveProgramId || undefined,
        departmentId: filters.departmentId || undefined,
      }).then((r) => toArray(r)),
    enabled: schemaTypes.has("class") || schemaTypes.has("section"),
    staleTime: 60_000,
  });
  const { data: sections = [] } = useQuery({
    queryKey: ["ref-sections", effectiveClassId || "", effectiveProgramId || ""],
    queryFn: () =>
      getSections({
        classId: effectiveClassId || undefined,
        programId: effectiveProgramId || undefined,
      }).then((r) => toArray(r)),
    enabled: schemaTypes.has("section"),
    staleTime: 60_000,
  });
  const { data: subjects = [] } = useQuery({
    queryKey: [
      "ref-subjects",
      effectiveProgramId || "",
      effectiveClassId || "",
      effectiveSessionId || "",
    ],
    queryFn: () =>
      getSubjects({
        programId: effectiveProgramId || undefined,
        classId: effectiveClassId || undefined,
        sessionId: effectiveSessionId || undefined,
      }).then((r) => toArray(r)),
    enabled: schemaTypes.has("subject"),
    staleTime: 60_000,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["ref-departments"],
    queryFn: () => getDepartments().then((r) => toArray(r)),
    enabled: schemaTypes.has("department"),
    staleTime: 5 * 60_000,
  });
  const { data: teachers = [] } = useQuery({
    queryKey: [
      "ref-teachers",
      filters.departmentId || "",
      effectiveProgramId || "",
      effectiveClassId || "",
    ],
    queryFn: () =>
      getTeachers({
        departmentId: filters.departmentId || undefined,
        programId: effectiveProgramId || undefined,
        classId: effectiveClassId || undefined,
      }).then((r) => toArray(r)),
    enabled: schemaTypes.has("teacher"),
    staleTime: 60_000,
  });
  const { data: staffList = [] } = useQuery({
    queryKey: ["ref-staff", filters.departmentId || ""],
    queryFn: () =>
      getAllStaff(filters.departmentId ? { departmentId: filters.departmentId } : {}).then((r) =>
        toArray(r, "staff")
      ),
    enabled: schemaTypes.has("staff") || schemaTypes.has("cashier"),
    staleTime: 60_000,
  });
  const { data: feeHeads = [] } = useQuery({
    queryKey: ["ref-feeHeads"],
    queryFn: () => getFeeHeads().then((r) => toArray(r)),
    enabled: schemaTypes.has("feeHead"),
    staleTime: 5 * 60_000,
  });
  const { data: wallets = [] } = useQuery({
    queryKey: ["ref-wallets"],
    queryFn: () => getWallets().then((r) => toArray(r)),
    enabled: schemaTypes.has("wallet"),
    staleTime: 5 * 60_000,
  });
  const { data: gradeSchemes = [] } = useQuery({
    queryKey: ["ref-grade-schemes"],
    queryFn: () => getGradeSchemes().then((r) => toArray(r, "schemes")),
    enabled: schemaTypes.has("gradeScheme"),
    staleTime: 5 * 60_000,
  });
  const { data: studentMatches = [] } = useQuery({
    queryKey: [
      "ref-student-search",
      studentQuery,
      effectiveSessionId || "",
      effectiveProgramId || "",
      effectiveClassId || "",
      filters.sectionId || "",
    ],
    queryFn: () =>
      searchStudents(studentQuery, {
        sessionId: effectiveSessionId || undefined,
        programId: effectiveProgramId || undefined,
        classId: effectiveClassId || undefined,
        sectionId: filters.sectionId || undefined,
        limit: 25,
      }).then((r) => toArray(r, "students")),
    enabled: schemaTypes.has("student"),
    staleTime: 30_000,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, body }) => runReportInlineAction(reportKey, action, body),
    onSuccess: (res) => {
      toast({ title: "Action completed", description: res?.message || "Report data updated." });
      setActionModal({ open: false, action: null, row: null, form: {} });
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Action failed",
        description: extractReadableApiError(err, "Unable to complete this action. Please review your inputs and try again."),
        variant: "destructive",
      });
    },
  });

  const visibleColumns = useMemo(() => payload?.columns || [], [payload?.columns]);

  const filteredAndSortedRows = useMemo(() => {
    const raw = payload?.rows || [];
    const q = localSearch.trim().toLowerCase();
    const searched = q
      ? raw.filter((row) =>
          visibleColumns.some((c) =>
            String(row[c.key] ?? "").toLowerCase().includes(q)
          )
        )
      : raw;

    if (!sortConfig.key) return searched;
    return [...searched].sort((a, b) => {
      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      const na = Number(String(av ?? "").replace(/[^0-9.-]/g, ""));
      const nb = Number(String(bv ?? "").replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(na) && !Number.isNaN(nb) && String(av) !== "" && String(bv) !== "") {
        return sortConfig.dir === "asc" ? na - nb : nb - na;
      }
      return sortConfig.dir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [payload?.rows, visibleColumns, localSearch, sortConfig]);

  const toggleSort = (colKey) => {
    setSortConfig((prev) =>
      prev.key === colKey
        ? { key: colKey, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: colKey, dir: "asc" }
    );
  };

  const applyFilters = () => setAppliedFilters({ ...filters });
  const resetFilters = () => {
    setFilters({});
    setAppliedFilters({});
    setLocalSearch("");
  };

  const setFilterValue = (key, nextValue) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: nextValue };
      const cleared = CASCADE_DOWNSTREAM[key];
      if (cleared) {
        cleared.forEach((childKey) => {
          if (childKey in next) delete next[childKey];
        });
      }
      return next;
    });
  };

  const getDynamicOptions = (f) => {
    if (Array.isArray(f.options) && f.options.length > 0) return f.options;
    const extraOpts = payload?.rawExtra?.filterOptions?.[f.key];
    if (Array.isArray(extraOpts)) return extraOpts;
    switch (resolveFilterKind(f)) {
      case "session":
        return sessions.map((s) => ({ value: getId(s), label: s.name }));
      case "program":
        return programs.map((p) => ({ value: getId(p), label: p.name }));
      case "class":
        return classes.map((c) => ({ value: getId(c), label: c.name }));
      case "section":
        return sections.map((s) => ({ value: getId(s), label: s.name }));
      case "subject":
        return subjects.map((s) => ({ value: getId(s), label: s.name }));
      case "exam":
        return exams.map((e) => buildExamOption(e));
      case "department":
        return departments.map((d) => ({ value: getId(d), label: d.name }));
      case "teacher":
        return teachers.map((t) => ({ value: getId(t), label: t.name }));
      case "staff":
      case "cashier":
        return staffList.map((s) => ({ value: getId(s), label: s.name }));
      case "feeHead":
        return feeHeads.map((h) => ({ value: getId(h), label: h.name }));
      case "wallet":
        return wallets.map((w) => ({ value: getId(w), label: `${w.name} (${w.type})` }));
      case "gradeScheme":
        return gradeSchemes.map((gs) => ({
          value: getId(gs),
          label: gs.name || gs.scaleName || getId(gs),
        }));
      default:
        return [];
    }
  };

  const renderFilterControl = (f) => {
    const val = filters[f.key] ?? "";
    const kind = resolveFilterKind(f);
    if (kind === "date") {
      return (
        <Input
          type="date"
          value={val}
          onChange={(e) => setFilterValue(f.key, e.target.value)}
          className="h-9"
        />
      );
    }
    if (kind === "month") {
      return (
        <Input
          type="month"
          value={val}
          onChange={(e) => setFilterValue(f.key, e.target.value)}
          className="h-9"
        />
      );
    }
    if (kind === "number") {
      return (
        <Input
          type="number"
          value={val}
          placeholder={f.placeholder || String(f.defaultValue ?? "")}
          onChange={(e) => setFilterValue(f.key, e.target.value)}
          className="h-9"
        />
      );
    }
    if (kind === "text") {
      return (
        <Input
          type="text"
          value={val}
          placeholder={f.placeholder || `Filter ${f.label.toLowerCase()}...`}
          onChange={(e) => setFilterValue(f.key, e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          className="h-9"
        />
      );
    }
    if (kind === "student") {
      return (
        <div className="space-y-1">
          <Input
            type="text"
            value={studentQuery}
            placeholder="Search student name / ID..."
            onChange={(e) => setStudentQuery(e.target.value)}
            className="h-8 text-xs"
          />
          <Select
            value={val || "all"}
            onValueChange={(v) => setFilterValue(f.key, v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Default / First Matching</SelectItem>
              {studentMatches.map((s) => (
                <SelectItem key={getId(s)} value={getId(s)}>
                  {s.rollNumber ? `${s.rollNumber} — ` : ""}{[s.fName, s.lName].filter(Boolean).join(" ") || s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    const opts = getDynamicOptions(f);
    if (isMultiSelectFilter(f)) {
      const multiOpts = stripAllSentinelOptions(opts).map((o) => ({
        value: String(o.value),
        label: String(o.label ?? o.value),
      }));
      return (
        <CheckboxMultiSelect
          title={f.label}
          placeholder={`All ${f.label}`}
          allLabel={`All ${f.label}`}
          options={multiOpts}
          selected={parseFilterValues(val)}
          onChange={(nextSelected) => setFilterValue(f.key, formatFilterValues(nextSelected))}
          className="w-full"
        />
      );
    }

    if (f.searchable || kind === "exam") {
      const searchableOpts = stripAllSentinelOptions(opts).map((o) => ({
        value: String(o.value),
        label: String(o.label ?? o.value),
        keywords: o.keywords || "",
      }));
      return (
        <SearchableSelect
          value={val || ""}
          onChange={(next) => setFilterValue(f.key, next)}
          options={searchableOpts}
          placeholder={`All ${f.label}`}
          allLabel={`All ${f.label}`}
          searchPlaceholder={`Search ${f.label.toLowerCase()}...`}
          className="w-full"
        />
      );
    }

    const hasAllOption = opts.some((o) => /^(all|\*)$/i.test(String(o.value ?? "")));
    return (
      <Select
        value={val || (hasAllOption ? String(opts.find((o) => /^(all|\*)$/i.test(String(o.value ?? "")))?.value) : "all")}
        onValueChange={(v) => setFilterValue(f.key, /^(all|\*)$/i.test(v) ? "" : v)}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder={`All ${f.label}`} />
        </SelectTrigger>
        <SelectContent>
          {!hasAllOption && <SelectItem value="all">All</SelectItem>}
          {opts.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const openActionDialog = (actionDef, row = null) => {
    setActionModal({
      open: true,
      action: actionDef,
      row,
      form: buildActionInitialForm(actionDef, row),
    });
  };

  const handleRowClick = (row) => {
    if (row?.drilldownKey && onDrillDown) {
      onDrillDown(row.drilldownKey, row.drilldownFilters || {});
    }
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="p-6 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>
            Unable to load report: {extractReadableApiError(error, "Please check your filters and try again.")}
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const meta = payload?.meta || {};
  const rep = payload?.report || {};
  const kpis = payload?.kpis || [];
  const insight = payload?.insight || {};
  const charts = payload?.charts || [];
  const secondaryTables = payload?.secondaryTables || [];
  const reportActions = rep.inlineActions || [];

  return (
    <div className="space-y-4">
      {/* Branded Concordia Report Header (#F7941E Orange + White) */}
      <Card className="overflow-hidden border-[#F7941E]/30 shadow-sm">
        <div className="h-2 bg-[#F7941E]" />
        <CardHeader className="pb-3 bg-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-[#F7941E]">
                {meta.brandTitle || "CONCORDIA COLLEGE PESHAWAR | ERP REPORT CENTRE"}
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 mt-0.5">
                {rep.title || "Loading report..."}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {rep.module || ""}
                {meta.sessionLabel ? ` • ${meta.sessionLabel}` : ""}
                {rep.pageNumber ? ` • Template #${rep.pageNumber}` : ""}
              </p>
              {rep.purpose ? (
                <div className="mt-2.5 text-xs bg-orange-50/70 border-l-4 border-[#F7941E] px-3 py-1.5 text-slate-700 rounded-r">
                  <span className="font-semibold text-slate-900">Purpose: </span>
                  {rep.purpose}
                </div>
              ) : null}
            </div>

            {/* Action Toolbar: Export PDF | Export Excel | Print */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-[#F7941E]/40 hover:bg-orange-50"
                disabled={isLoading || !payload}
                onClick={() => printOrExportPdfReport(payload, { format: "PDF", toast })}
              >
                <FileDown className="w-3.5 h-3.5 text-[#F7941E]" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-emerald-300 hover:bg-emerald-50"
                disabled={isLoading || !payload}
                onClick={() => exportReportWorkbook(payload, { extraSheets, toast })}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={isLoading || !payload}
                onClick={() => printOrExportPdfReport(payload, { format: "PRINT", toast })}
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Filter Bar + Report-level Inline Action Buttons */}
        <CardContent className="pt-0 pb-4 space-y-3 bg-white">
          {((rep.filterSchema || []).length > 0 || reportActions.filter((a) => a.scope !== "row").length > 0) && (
            <div className="p-3 rounded-lg border border-orange-100 bg-orange-50/30 space-y-3">
              {(rep.filterSchema || []).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(rep.filterSchema || []).map((f) => (
                    <div
                      key={f.key}
                      className={
                        f.key === "examId" || f.searchable
                          ? "space-y-1 sm:col-span-2"
                          : "space-y-1"
                      }
                    >
                      <Label className="text-[11px] font-medium text-slate-600">{f.label}</Label>
                      {renderFilterControl(f)}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {(rep.filterSchema || []).length > 0 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={applyFilters}
                      disabled={isFetching}
                      className="h-8 bg-[#F7941E] hover:bg-[#e08212] text-white text-xs gap-1.5"
                    >
                      {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Apply Filters
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs gap-1">
                      <RefreshCw className="w-3 h-3" /> Reset
                    </Button>
                  </div>
                ) : (
                  <div />
                )}

                {reportActions.filter((a) => a.scope !== "row").length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {reportActions
                      .filter((a) => a.scope !== "row")
                      .map((act) => (
                        <Button
                          key={resolveActionKey(act) || act.label}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1 border-orange-300 text-orange-800 hover:bg-orange-100"
                          onClick={() => openActionDialog(act, null)}
                        >
                          <Wrench className="w-3 h-3" />
                          {act.label}
                        </Button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FILTER | SELECTED VALUE strip matching PDF template */}
          {(rep.selectedFilters || []).length > 0 && !compact && (
            <div className="overflow-x-auto rounded border border-orange-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F7941E] text-white">
                    <th className="text-left px-3 py-1.5 font-semibold w-1/3">FILTER</th>
                    <th className="text-left px-3 py-1.5 font-semibold">SELECTED VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {rep.selectedFilters.map((sf, i) => (
                    <tr key={`${sf.label}-${i}`} className="border-t border-orange-50 odd:bg-orange-50/20">
                      <td className="px-3 py-1 font-medium text-slate-700">{sf.label}</td>
                      <td className="px-3 py-1 text-slate-600">{sf.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#F7941E]" />
            <span className="text-sm">Compiling report data...</span>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* AT-A-GLANCE SUMMARY (4 KPI Cards) */}
          {kpis.length > 0 && (
            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-orange-700 mb-2">
                AT-A-GLANCE SUMMARY
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.slice(0, 4).map((kpi, idx) => (
                  <Card
                    key={`${kpi.label}-${idx}`}
                    className={`border-t-4 border-t-[#F7941E] shadow-sm ${
                      kpi.drilldownKey && onDrillDown ? "cursor-pointer hover:bg-orange-50/30 transition" : ""
                    }`}
                    onClick={() => kpi.drilldownKey && onDrillDown?.(kpi.drilldownKey, kpi.drilldownFilters || {})}
                  >
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
                      <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Optional Charts Section */}
          {charts.length > 0 && (
            <div className={`grid grid-cols-1 ${charts.length > 1 ? "lg:grid-cols-2" : ""} gap-4`}>
              {charts.map((rawChart, idx) => {
                const ch = normalizeChartSpec(rawChart);
                return (
                  <ModernChartCard
                    key={`${ch.id || ch.title || "chart"}-${idx}`}
                    title={ch.title}
                    subtitle={ch.subtitle}
                    empty={ch.isEmpty}
                  >
                    <div className="h-[240px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height={240} minWidth={0}>
                        {ch.type === "pie" ? (
                          <PieChart>
                            <Pie
                              data={ch.data}
                              dataKey={ch.dataKey}
                              nameKey={ch.nameKey}
                              outerRadius={80}
                              label
                            >
                              {ch.data.map((entry, ci) => (
                                <Cell
                                  key={ci}
                                  fill={entry?.color || CHART_PALETTE[ci % CHART_PALETTE.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        ) : ch.type === "line" ? (
                          <LineChart data={ch.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={ch.xKey} tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            {ch.series.map((s) => (
                              <Line
                                key={s.dataKey}
                                type="monotone"
                                dataKey={s.dataKey}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                              />
                            ))}
                          </LineChart>
                        ) : (
                          <BarChart data={ch.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={ch.xKey} tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            {ch.series.map((s) => (
                              <Bar
                                key={s.dataKey}
                                dataKey={s.dataKey}
                                name={s.label}
                                fill={s.color}
                                radius={[4, 4, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </ModernChartCard>
                );
              })}
            </div>
          )}

          {/* Preserved Custom Visualizations Hook (e.g. Fee Analytics / Finance YoY / Boarding Charts) */}
          {typeof renderExtraContent === "function" ? renderExtraContent(payload) : null}

          {/* REPORT DETAILS Data Table */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-orange-700">
                  REPORT DETAILS
                </span>
                <Badge variant="secondary" className="text-[11px]">
                  {filteredAndSortedRows.length} rows
                </Badge>
              </div>
              <Input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Quick search within results..."
                className="h-8 w-full sm:w-64 text-xs"
              />
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F7941E] hover:bg-[#F7941E]">
                    {visibleColumns.map((col) => (
                      <TableHead
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className={`text-white font-semibold text-xs cursor-pointer select-none whitespace-nowrap ${
                          col.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          <ArrowUpDown className="w-3 h-3 opacity-80" />
                        </span>
                      </TableHead>
                    ))}
                    {reportActions.some((a) => a.scope === "row") && (
                      <TableHead className="text-white font-semibold text-xs text-right">Action</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + (reportActions.some((a) => a.scope === "row") ? 1 : 0)}
                        className="h-24 text-center text-xs text-muted-foreground"
                      >
                        No records match the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedRows.map((row, idx) => (
                      <TableRow
                        key={row.id || row._id || idx}
                        onClick={() => handleRowClick(row)}
                        className={`${idx % 2 === 1 ? "bg-orange-50/20" : ""} ${
                          row.drilldownKey ? "cursor-pointer hover:bg-orange-50/70" : ""
                        }`}
                      >
                        {visibleColumns.map((col) => (
                          <TableCell
                            key={col.key}
                            className={`text-xs py-2 whitespace-nowrap ${
                              col.align === "right" ? "text-right font-medium" : "text-left"
                            }`}
                          >
                            {row[col.key] ?? "—"}
                          </TableCell>
                        ))}
                        {reportActions.some((a) => a.scope === "row") && (
                          <TableCell
                            className="text-right py-1.5 whitespace-nowrap space-x-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {reportActions
                              .filter((a) => a.scope === "row" && (!a.when || a.when(row)))
                              .map((act) => {
                                const actKey = resolveActionKey(act);
                                const isDisabled =
                                  Boolean(row.actionDisabled) ||
                                  (Array.isArray(row.disabledActions) && row.disabledActions.includes(actKey));
                                return (
                                  <Button
                                    key={actKey || act.label}
                                    size="sm"
                                    variant="outline"
                                    disabled={isDisabled}
                                    className="h-7 px-2 text-[11px] border-orange-300 text-orange-800 hover:bg-orange-100 disabled:opacity-40"
                                    onClick={() => openActionDialog(act, row)}
                                  >
                                    {act.label}
                                  </Button>
                                );
                              })}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                  {payload?.totalsRow && (
                    <TableRow className="bg-orange-100/80 font-bold border-t-2 border-[#F7941E]">
                      {visibleColumns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={`text-xs py-2 font-bold ${
                            col.align === "right" ? "text-right" : "text-left"
                          }`}
                        >
                          {payload.totalsRow[col.key] ?? ""}
                        </TableCell>
                      ))}
                      {reportActions.some((a) => a.scope === "row") && <TableCell />}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Optional Secondary Audit / Breakdown Tables */}
          {secondaryTables.map((st, sIdx) => (
            <Card key={`${st.title}-${sIdx}`} className="shadow-sm">
              <CardHeader className="py-2.5 px-4 border-b bg-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {st.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      {(st.columns || []).map((col) => (
                        <TableHead
                          key={col.key}
                          className={`text-xs font-semibold ${col.align === "right" ? "text-right" : "text-left"}`}
                        >
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(st.rows || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={st.columns?.length || 1} className="text-center text-xs py-4 text-muted-foreground">
                          No entries.
                        </TableCell>
                      </TableRow>
                    ) : (
                      st.rows.map((r, ri) => (
                        <TableRow key={ri}>
                          {(st.columns || []).map((c) => (
                            <TableCell key={c.key} className={`text-xs py-1.5 ${c.align === "right" ? "text-right" : "text-left"}`}>
                              {r[c.key] ?? "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {/* MANAGEMENT INSIGHT / EXCEPTIONS */}
          {insight?.message && (
            <div className="rounded-lg border border-orange-200 border-l-4 border-l-[#F7941E] bg-amber-50/90 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
              {insight.severity === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-[#F7941E] shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-[#F7941E] shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold uppercase tracking-wider text-[10px] text-orange-800 mb-0.5">
                  MANAGEMENT INSIGHT / EXCEPTIONS
                </div>
                <p className="leading-relaxed">{insight.message}</p>
              </div>
            </div>
          )}

          {/* Footer metadata */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-slate-500 pt-1 px-1">
            <span>
              Generated on {meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : ""} | Generated by:{" "}
              {meta.generatedBy || "Administrator"}
            </span>
            <span>{meta.disclaimer || "Confidential — for authorized institutional use only"}</span>
          </div>
        </>
      )}

      {/* Inline Operational Action Modal */}
      <Dialog
        open={actionModal.open}
        onOpenChange={(open) => !open && setActionModal({ open: false, action: null, row: null, form: {} })}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{actionModal.action?.label || "Update Record"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(actionModal.action?.fields || []).length === 0 ? (
              <p className="text-sm text-slate-600">
                Apply "{actionModal.action?.label || "this action"}" to the selected record?
              </p>
            ) : (
              (actionModal.action?.fields || []).map((fld) => (
                <div key={fld.key} className="space-y-1">
                  <Label className="text-xs">{fld.label}</Label>
                  {fld.type === "select" ? (
                    <Select
                      value={String(actionModal.form[fld.key] ?? "")}
                      onValueChange={(v) => setActionModal((p) => ({ ...p, form: { ...p.form, [fld.key]: v } }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(fld.options || []).map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={fld.type || "text"}
                      value={actionModal.form[fld.key] ?? ""}
                      placeholder={fld.placeholder || ""}
                      onChange={(e) => setActionModal((p) => ({ ...p, form: { ...p.form, [fld.key]: e.target.value } }))}
                    />
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal({ open: false, action: null, row: null, form: {} })}>
              Cancel
            </Button>
            <Button
              className="bg-[#F7941E] hover:bg-[#e08212] text-white"
              disabled={actionMutation.isPending}
              onClick={() =>
                actionMutation.mutate({
                  action: resolveActionKey(actionModal.action),
                  body: { ...actionModal.row?.actionContext, ...actionModal.form },
                })
              }
            >
              {actionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportEngineView;
