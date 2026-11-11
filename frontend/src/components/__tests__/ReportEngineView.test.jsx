import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const mockOpenManagedPrintWindow = vi.fn();
const mockLogReportExport = vi.fn();
let capturedWb = null;

vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    writeFile: vi.fn((wb) => {
      capturedWb = wb;
    }),
  };
});

vi.mock("@/lib/managedPrint", () => ({
  openManagedPrintWindow: (...args) => mockOpenManagedPrintWindow(...args),
}));

vi.mock("../../../config/apis", async (importOriginal) => {
  const actual = await importOriginal().catch(() => ({}));
  return {
    ...actual,
    logReportExport: (...args) => mockLogReportExport(...args),
  };
});

import {
  buildFiltersSummary,
  buildReportPrintHtml,
  printOrExportPdfReport,
  exportReportWorkbook,
} from "../reports/reportExport";
import { MODULE_REPORT_LISTS } from "../reports/moduleReportConfigs";
import { NAV_MODULES, hasModuleAccess } from "@/lib/navigation";
import {
  normalizeChartSpec,
  formatExamOptionLabel,
  buildExamOption,
  isMultiSelectFilter,
} from "../reports/ReportEngineView";
import { filterSearchableOptions } from "@/components/ui/SearchableSelect";

const SAMPLE_PAYLOAD = {
  meta: {
    brandTitle: "CONCORDIA COLLEGE PESHAWAR | ERP REPORT CENTRE",
    sessionLabel: "2026 - 2027",
    generatedBy: "Principal Office",
    generatedAt: "2026-11-11T10:00:00.000Z",
    disclaimer: "Confidential — for authorized institutional use only",
  },
  report: {
    key: "fees-receivables-ageing",
    pageNumber: 16,
    title: "Outstanding Receivables Ageing Report",
    module: "Fee Management",
    purpose: "Analyze unpaid student fee balances across overdue ageing buckets.",
    selectedFilters: [
      { label: "Session", value: "2026 - 2027" },
      { label: "Program", value: "FSc Pre-Medical" },
    ],
    signatures: ["Prepared By (Accounts)", "Reviewed By (Principal)"],
  },
  kpis: [
    { label: "Total Outstanding", value: "PKR 240,000" },
    { label: "Current (Not Due)", value: "PKR 90,000" },
    { label: "1-30 Days Overdue", value: "PKR 80,000" },
    { label: "61+ Days Overdue", value: "PKR 70,000" },
    { label: "Overflow KPI Ignored", value: "999" },
  ],
  columns: [
    { key: "student", label: "Student", align: "left" },
    { key: "amount", label: "Outstanding", align: "right" },
  ],
  rows: [
    { student: "Ali <script>alert(1)</script> Khan", amount: "PKR 150,000" },
    { student: "Ayesha Bibi", amount: "PKR 90,000" },
  ],
  totalsRow: {
    student: "Institutional Total",
    amount: "PKR 240,000",
  },
  secondaryTables: [
    {
      title: "Bucket Breakdown",
      columns: [
        { key: "bucket", label: "Ageing Bucket" },
        { key: "total", label: "Amount", align: "right" },
      ],
      rows: [{ bucket: "61+ Days", total: "PKR 70,000" }],
    },
  ],
  insight: {
    severity: "warning",
    message: "29.2% of receivables are past 60 days overdue.",
  },
};

describe("Unified Report Engine — Export, Navigation & Component Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedWb = null;
    mockOpenManagedPrintWindow.mockResolvedValue(true);
    mockLogReportExport.mockResolvedValue({ success: true });
  });

  it("buildFiltersSummary formats active filter pairs and default fallback", () => {
    expect(buildFiltersSummary([])).toBe("Default filters");
    expect(buildFiltersSummary(SAMPLE_PAYLOAD.report.selectedFilters)).toBe(
      "Session: 2026 - 2027; Program: FSc Pre-Medical"
    );
  });

  it("buildReportPrintHtml generates Concordia #F7941E HTML with 4 KPIs, filter matrix, totals, insight & XSS escaping", () => {
    const html = buildReportPrintHtml(SAMPLE_PAYLOAD);

    expect(html).toContain("#F7941E");
    expect(html).toContain("CONCORDIA COLLEGE PESHAWAR | ERP REPORT CENTRE");
    expect(html).toContain("<th>FILTER</th><th>SELECTED VALUE</th>");
    expect(html).toContain("FSc Pre-Medical");
    expect(html).toContain("AT-A-GLANCE SUMMARY");
    expect(html).toContain("Total Outstanding");
    expect(html).toContain("61+ Days Overdue");
    expect(html).not.toContain("Overflow KPI Ignored");
    expect(html).toContain("Institutional Total");
    expect(html).toContain("Bucket Breakdown");
    expect(html).toContain("MANAGEMENT INSIGHT / EXCEPTIONS");
    expect(html).toContain("Prepared By (Accounts)");
    expect(html).toContain("Confidential — for authorized institutional use only");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html.toLowerCase()).not.toContain("campus");
  });

  it("buildReportPrintHtml renders empty-state message when rows array is empty", () => {
    const html = buildReportPrintHtml({
      ...SAMPLE_PAYLOAD,
      rows: [],
      totalsRow: null,
    });
    expect(html).toContain("No records found");
  });

  it("printOrExportPdfReport invokes openManagedPrintWindow and logs PDF/PRINT export outcome", async () => {
    const ok = await printOrExportPdfReport(SAMPLE_PAYLOAD, { format: "PDF" });
    expect(ok).toBe(true);
    expect(mockOpenManagedPrintWindow).toHaveBeenCalledTimes(1);
    const arg = mockOpenManagedPrintWindow.mock.calls[0][0];
    expect(arg.title).toBe("Outstanding Receivables Ageing Report");
    expect(arg.html).toContain("#F7941E");
    expect(mockLogReportExport).toHaveBeenCalledWith(
      "fees-receivables-ageing",
      expect.objectContaining({
        format: "PDF",
        status: "SUCCESS",
        recordCount: 2,
      })
    );

    mockOpenManagedPrintWindow.mockResolvedValueOnce(false);
    const failed = await printOrExportPdfReport(SAMPLE_PAYLOAD, { format: "PRINT" });
    expect(failed).toBe(false);
    expect(mockLogReportExport).toHaveBeenLastCalledWith(
      "fees-receivables-ageing",
      expect.objectContaining({
        format: "PRINT",
        status: "FAILED",
        failureReason: "Print pop-up blocked",
      })
    );
  });

  it("exportReportWorkbook builds Report Details, Summary & Filters, secondary & extra sheets without writing disk", async () => {
    const ok = await exportReportWorkbook(SAMPLE_PAYLOAD, {
      extraSheets: [
        {
          name: "Legacy Chunks",
          aoa: [["Header A", "Header B"], ["V1", 100]],
        },
      ],
    });

    expect(ok).toBe(true);
    expect(capturedWb).toBeTruthy();
    expect(capturedWb.SheetNames).toContain("Report Details");
    expect(capturedWb.SheetNames).toContain("Summary & Filters");
    expect(capturedWb.SheetNames).toContain("Bucket Breakdown");
    expect(capturedWb.SheetNames).toContain("Legacy Chunks");

    const detailsAoa = XLSX.utils.sheet_to_json(capturedWb.Sheets["Report Details"], { header: 1 });
    expect(detailsAoa[0]).toEqual(["Student", "Outstanding"]);
    expect(detailsAoa[detailsAoa.length - 1]).toEqual(["Institutional Total", "PKR 240,000"]);

    expect(mockLogReportExport).toHaveBeenCalledWith(
      "fees-receivables-ageing",
      expect.objectContaining({
        format: "EXCEL",
        status: "SUCCESS",
        recordCount: 2,
      })
    );
  });

  it("MODULE_REPORT_LISTS and navigation expose unified reports cleanly with zero campus references", () => {
    const allModuleKeys = Object.keys(MODULE_REPORT_LISTS);
    expect(allModuleKeys).toEqual(
      expect.arrayContaining([
        "Front Office",
        "Students",
        "Fee Management",
        "Examination",
        "Attendance",
        "Academics",
        "Staff",
        "HR & Payroll",
        "Finance",
        "Boarding",
        "Inventory",
        "Complaints",
        "Executive",
      ])
    );

    const uniqueReportKeys = new Set();
    for (const modKey of allModuleKeys) {
      const items = MODULE_REPORT_LISTS[modKey];
      expect(items.length).toBeGreaterThan(0);
      const localKeys = new Set();
      for (const item of items) {
        expect(localKeys.has(item.key)).toBe(false);
        localKeys.add(item.key);
        uniqueReportKeys.add(item.key);
      }
    }
    expect(uniqueReportKeys.size).toBeGreaterThanOrEqual(45);

    const serialized = JSON.stringify(MODULE_REPORT_LISTS).toLowerCase();
    expect(serialized).not.toContain('"campus');
    expect(serialized).not.toContain("campusname");
    expect(serialized).not.toContain("campusid");

    const reportCentreNav = NAV_MODULES.find((m) => m.label === "Report Centre");
    expect(reportCentreNav).toBeTruthy();
    expect(reportCentreNav.path).toBe("/reports");

    ["Front Office", "Examination", "Academics", "Staff", "Inventory"].forEach((modLabel) => {
      const mod = NAV_MODULES.find((m) => m.label === modLabel);
      expect(mod?.subModules?.some((s) => s.id === "reports")).toBe(true);
    });

    const feeReportAdmin = {
      role: "ADMIN",
      permissions: { modules: ["Fee Management"], subModules: { "Fee Management": ["reports"] } },
    };
    expect(hasModuleAccess(feeReportAdmin, "Report Centre")).toBe(true);

    const noReportAdmin = {
      role: "ADMIN",
      permissions: { modules: ["Dashboard"], subModules: {} },
    };
    expect(hasModuleAccess(noReportAdmin, "Report Centre")).toBe(false);
  });

  it("ReportEngineView component removes Save View, supports optionsSource & CheckboxMultiSelect, and handles action keys", async () => {
    const viewModule = await import("../reports/ReportEngineView");
    const {
      resolveFilterKind,
      isMultiSelectFilter,
      parseFilterValues,
      formatFilterValues,
      stripAllSentinelOptions,
      resolveActionKey,
      buildActionInitialForm,
    } = viewModule;

    // 1. optionsSource normalization for Pages 19-48
    expect(resolveFilterKind({ key: "programId", type: "select", optionsSource: "programs" })).toBe("program");
    expect(resolveFilterKind({ key: "classId", type: "select", optionsSource: "classes" })).toBe("class");
    expect(resolveFilterKind({ key: "sectionId", type: "select", optionsSource: "sections" })).toBe("section");
    expect(resolveFilterKind({ key: "gradeSchemeId", type: "select", optionsSource: "gradeSchemes" })).toBe("gradeScheme");
    expect(resolveFilterKind({ key: "status", type: "select" })).toBe("select");

    // 2. Checkbox multi-select classification & value parsing
    expect(isMultiSelectFilter({ key: "programId", type: "select", optionsSource: "programs" })).toBe(true);
    expect(isMultiSelectFilter({ key: "status", type: "select" })).toBe(true);
    expect(isMultiSelectFilter({ key: "basis", type: "select" })).toBe(false);
    expect(isMultiSelectFilter({ key: "gradeSchemeId", type: "select", optionsSource: "gradeSchemes" })).toBe(false);
    expect(isMultiSelectFilter({ key: "studentId", type: "student" })).toBe(false);

    expect(parseFilterValues("p1, p2, all")).toEqual(["p1", "p2"]);
    expect(formatFilterValues(["p1", "p2"])).toBe("p1,p2");
    expect(
      stripAllSentinelOptions([
        { value: "ALL", label: "All" },
        { value: "PAID", label: "Paid" },
      ])
    ).toEqual([{ value: "PAID", label: "Paid" }]);

    // 3. Action key & modal initial form resolution
    expect(resolveActionKey({ key: "save-grade-scheme", label: "Grading Setup" })).toBe("save-grade-scheme");
    expect(resolveActionKey({ name: "log-fee-reminder", label: "Log Reminder" })).toBe("log-fee-reminder");
    expect(
      buildActionInitialForm(
        {
          fields: [
            { key: "verified", defaultValue: "true" },
            { key: "openingCash", rowKey: "_openingCash", defaultValue: 0 },
          ],
        },
        { _openingCash: 500, actionContext: { verified: "false" } }
      )
    ).toEqual({ verified: "false", openingCash: 500 });

    // 4. Source contract checks (Save View completely removed, multi-select + filtered APIs present)
    const viewPath = path.resolve(__dirname, "../reports/ReportEngineView.jsx");
    const src = fs.readFileSync(viewPath, "utf-8");
    const apisSrc = fs.readFileSync(path.resolve(__dirname, "../../../config/apis.js"), "utf-8");
    const hubSrc = fs.readFileSync(path.resolve(__dirname, "../../pages/ReportCentre.jsx"), "utf-8");

    expect(src).toContain("Export PDF");
    expect(src).toContain("Export Excel");
    expect(src).toContain("Print");
    expect(src).toContain("CheckboxMultiSelect");
    expect(src).toContain("getGradeSchemes");
    expect(src).toContain("disabledActions");
    expect(src).toContain("MANAGEMENT INSIGHT / EXCEPTIONS");
    expect(src).toContain("runReportInlineAction");
    expect(src).toContain("Confidential — for authorized institutional use only");
    expect(src).not.toContain("Save View");
    expect(src).not.toContain("Saved Views");
    expect(src).not.toContain("getSavedReportViews");

    expect(apisSrc).toContain("getGradeSchemes");
    expect(apisSrc).not.toContain("getSavedReportViews");
    expect(apisSrc).not.toContain("saveReportView");
    expect(apisSrc).not.toContain("deleteSavedReportView");
    expect(hubSrc).not.toContain("Saved Views");
  });

  it("extractReadableApiError replaces raw DB/runtime/network messages with user-friendly text", async () => {
    const { extractReadableApiError } = await import("../../../config/apis");

    expect(
      extractReadableApiError(new Error("mongoose is not defined"), "Unable to generate report.")
    ).toBe("Unable to generate report.");

    expect(
      extractReadableApiError(
        { response: { data: { message: 'Cast to ObjectId failed for value "bad" at path "studentId"' } } },
        "Invalid selection."
      )
    ).toBe("Invalid selection.");

    expect(extractReadableApiError({ message: "Network Error" }, "Fallback")).toMatch(/reach the server/i);
    expect(extractReadableApiError({ message: "timeout of 10000ms exceeded" }, "Fallback")).toMatch(/too long/i);
    expect(extractReadableApiError({ message: "Please select a valid date." }, "Fallback")).toBe("Please select a valid date.");
  });
});


describe("ReportEngineView normalizeChartSpec", () => {
  it("normalizes legacy series.key, preserves colors, and coerces numeric strings", () => {
    const res = normalizeChartSpec({
      id: "grade-distribution-bar",
      title: "Grade Distribution",
      type: "bar",
      xKey: "grade",
      yKey: "students",
      series: [{ key: "students", label: "Students", color: "#F7941E" }],
      data: [
        { grade: "A+", students: "12" },
        { grade: "A", students: 8 },
      ],
    });

    expect(res.type).toBe("bar");
    expect(res.xKey).toBe("grade");
    expect(res.dataKey).toBe("students");
    expect(res.series).toEqual([
      { dataKey: "students", label: "Students", color: "#F7941E" },
    ]);
    expect(res.data).toEqual([
      { grade: "A+", students: 12 },
      { grade: "A", students: 8 },
    ]);
    expect(res.isEmpty).toBe(false);
  });

  it("synthesizes series from top-level dataKey/yKey and supports line charts", () => {
    const res = normalizeChartSpec({
      title: "Daily Collection",
      type: "line",
      xKey: "day",
      yKey: "collected",
      data: [{ day: "2026-10-01", collected: "25000" }],
    });

    expect(res.type).toBe("line");
    expect(res.series[0].dataKey).toBe("collected");
    expect(res.data[0].collected).toBe(25000);
    expect(res.isEmpty).toBe(false);
  });

  it("normalizes pie keys, drops zero slices, and marks all-zero pies empty", () => {
    const partial = normalizeChartSpec({
      title: "Bed Occupancy",
      type: "pie",
      xKey: "status",
      yKey: "beds",
      data: [
        { status: "Occupied", beds: "5" },
        { status: "Vacant", beds: 0 },
      ],
    });
    expect(partial.nameKey).toBe("status");
    expect(partial.dataKey).toBe("beds");
    expect(partial.data).toEqual([{ status: "Occupied", beds: 5 }]);
    expect(partial.isEmpty).toBe(false);

    const allZero = normalizeChartSpec({
      title: "Bed Occupancy",
      type: "pie",
      nameKey: "name",
      dataKey: "value",
      data: [
        { name: "Occupied", value: 0 },
        { name: "Vacant", value: 0 },
      ],
    });
    expect(allZero.data).toEqual([]);
    expect(allZero.isEmpty).toBe(true);
  });
});

describe("Combined Exam & Program Searchable Select", () => {
  it("treats examId and explicit multi=false filters as single-select", () => {
    expect(isMultiSelectFilter({ key: "examId", type: "select", optionsSource: "exams" })).toBe(false);
    expect(isMultiSelectFilter({ key: "examId", type: "select", optionsSource: "exams", multi: false, searchable: true })).toBe(false);
  });

  it("formats exam options with program, class, and session and matches multi-token searches", () => {
    const exams = [
      {
        _id: "e1",
        examName: "Mid Term 2026",
        type: "Midterm",
        programId: { _id: "p1", name: "FSc Pre-Medical", code: "FSC-MED" },
        classId: { _id: "c1", name: "1st Year" },
        sessionId: { _id: "s1", name: "2026-2027" },
      },
      {
        _id: "e2",
        examName: "Mid Term 2026",
        type: "Midterm",
        programId: { _id: "p2", name: "ICS Physics", code: "ICS" },
        classId: { _id: "c2", name: "2nd Year" },
        sessionId: { _id: "s1", name: "2026-2027" },
      },
    ];

    expect(formatExamOptionLabel(exams[0])).toBe("Mid Term 2026 — FSc Pre-Medical — 1st Year [2026-2027]");

    const options = exams.map(buildExamOption);
    expect(filterSearchableOptions(options, "med mid").map((o) => o.value)).toEqual(["e1"]);
    expect(filterSearchableOptions(options, "ics 2nd").map((o) => o.value)).toEqual(["e2"]);
    expect(filterSearchableOptions(options, "fsc-med").map((o) => o.value)).toEqual(["e1"]);
    expect(filterSearchableOptions(options, "").map((o) => o.value)).toEqual(["e1", "e2"]);
  });
});
