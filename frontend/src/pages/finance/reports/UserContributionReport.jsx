import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import {
  ModernChartCard,
  ModernTooltip,
  MODERN_CHART_COLORS,
} from "@/components/ui/modern-charts";
import {
  Printer,
  FileSpreadsheet,
  RotateCcw,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Scale,
  Search,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getFinanceUserContributionReport } from "../../../../config/apis";

export default function UserContributionReport({ onBack }) {
  const { toast } = useToast();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ dateFrom: "", dateTo: "" });
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedType, setSelectedType] = useState("all"); // "all" | "INCOME" | "EXPENSE"
  const [searchQuery, setSearchQuery] = useState("");

  // Drilldown modal for itemized transactions of a specific staff member
  const [drilldownStaff, setDrilldownStaff] = useState(null);

  // Logo data URL cache for print window
  const [logoDataUrl, setLogoDataUrl] = useState("");
  useEffect(() => {
    fetch("/logo.png")
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => setLogoDataUrl(reader.result);
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  const {
    data: reportData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "financeUserContributionReport",
      appliedFilters.dateFrom,
      appliedFilters.dateTo,
      selectedStaff,
      selectedType,
    ],
    queryFn: () =>
      getFinanceUserContributionReport({
        dateFrom: appliedFilters.dateFrom || undefined,
        dateTo: appliedFilters.dateTo || undefined,
        staffId: selectedStaff !== "all" ? selectedStaff : undefined,
        type: selectedType !== "all" ? selectedType : undefined,
      }),
  });

  const summary = reportData?.summary || {
    totalIncomeBrought: 0,
    totalExpenseCreated: 0,
    netContribution: 0,
    activeStaffCount: 0,
    totalEligibleStaff: 0,
  };

  const rawStaffBreakdown = reportData?.staffBreakdown || [];
  const rawItemized = reportData?.itemizedTransactions || [];

  // Filter staff by search query
  const filteredStaffBreakdown = useMemo(() => {
    if (!searchQuery.trim()) return rawStaffBreakdown;
    const q = searchQuery.toLowerCase();
    return rawStaffBreakdown.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.designation && s.designation.toLowerCase().includes(q)) ||
        (s.staffId && s.staffId.toLowerCase().includes(q))
    );
  }, [rawStaffBreakdown, searchQuery]);

  // Chart data for staff contribution ranking
  const chartData = useMemo(() => {
    return filteredStaffBreakdown
      .filter((s) => s.totalIncome > 0 || s.totalExpense > 0)
      .slice(0, 8)
      .map((s) => ({
        name: s.name.split(" ")[0] || s.name,
        fullName: s.name,
        income: s.totalIncome,
        expense: s.totalExpense,
        net: s.netContribution,
      }));
  }, [filteredStaffBreakdown]);

  // Handle drilldown transactions
  const drilldownTransactions = useMemo(() => {
    if (!drilldownStaff) return [];
    return rawItemized.filter((item) => item.staffId === drilldownStaff.id);
  }, [drilldownStaff, rawItemized]);

  // Excel Export
  const handleExportExcel = () => {
    try {
      if (filteredStaffBreakdown.length === 0) {
        toast({ title: "No Data to Export", description: "No records found matching filters.", variant: "destructive" });
        return;
      }

      const summaryRows = filteredStaffBreakdown.map((s, idx) => ({
        "Sr #": idx + 1,
        "Staff ID": s.staffId || "-",
        "Staff Name": s.name,
        "Designation": s.designation || "-",
        "Fee Collections (PKR)": s.feeCollections || 0,
        "Custom Income (PKR)": s.customIncome || 0,
        "Total Income Brought (PKR)": s.totalIncome || 0,
        "General Expenses (PKR)": s.generalExpense || 0,
        "Boarding Expenses (PKR)": s.boardingExpense || 0,
        "Inventory Expenses (PKR)": s.inventoryExpense || 0,
        "Total Expenses Created (PKR)": s.totalExpense || 0,
        "Net Contribution (PKR)": s.netContribution || 0,
        "Transactions Count": s.transactionCount || 0,
      }));

      // Append Total Summary Row
      summaryRows.push({
        "Sr #": "TOTAL",
        "Staff ID": "-",
        "Staff Name": "ALL STAFF TOTALS",
        "Designation": "-",
        "Fee Collections (PKR)": filteredStaffBreakdown.reduce((sum, s) => sum + (s.feeCollections || 0), 0),
        "Custom Income (PKR)": filteredStaffBreakdown.reduce((sum, s) => sum + (s.customIncome || 0), 0),
        "Total Income Brought (PKR)": summary.totalIncomeBrought || 0,
        "General Expenses (PKR)": filteredStaffBreakdown.reduce((sum, s) => sum + (s.generalExpense || 0), 0),
        "Boarding Expenses (PKR)": filteredStaffBreakdown.reduce((sum, s) => sum + (s.boardingExpense || 0), 0),
        "Inventory Expenses (PKR)": filteredStaffBreakdown.reduce((sum, s) => sum + (s.inventoryExpense || 0), 0),
        "Total Expenses Created (PKR)": summary.totalExpenseCreated || 0,
        "Net Contribution (PKR)": summary.netContribution || 0,
        "Transactions Count": summary.totalTransactions || 0,
      });

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      const colWidths = Object.keys(summaryRows[0] || {}).map((k) => ({
        wch: Math.max(k.length + 3, 14),
      }));
      wsSummary["!cols"] = colWidths;
      XLSX.utils.book_append_sheet(wb, wsSummary, "Staff Contribution");

      if (rawItemized.length > 0) {
        const itemizedRows = rawItemized.slice(0, 10000).map((tx, idx) => ({
          "Sr #": idx + 1,
          "Date": tx.date,
          "Staff Name": tx.staffName,
          "Type": tx.type,
          "Category": tx.category,
          "Source Module": tx.sourceModule,
          "Reference No": tx.referenceNo,
          "Description": tx.description,
          "Amount (PKR)": tx.amount,
          "Payment Mode": tx.paymentMode,
          "Wallet / Account": tx.walletName,
        }));
        const wsItemized = XLSX.utils.json_to_sheet(itemizedRows);
        wsItemized["!cols"] = Object.keys(itemizedRows[0] || {}).map((k) => ({
          wch: Math.max(k.length + 3, 14),
        }));
        XLSX.utils.book_append_sheet(wb, wsItemized, "Itemized Transactions");
      }

      const fileName = `Staff_Expense_Income_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast({
        title: "Export Successful",
        description: `Exported ${filteredStaffBreakdown.length} staff records to ${fileName}`,
      });
    } catch (e) {
      toast({ title: "Failed to export Excel", description: e.message, variant: "destructive" });
    }
  };

  // Managed Print / PDF Export
  const handlePrint = async () => {
    if (filteredStaffBreakdown.length === 0) {
      toast({ title: "No Data to Print", description: "No records found matching filters.", variant: "destructive" });
      return;
    }

    // Open print window synchronously to prevent popup blocker
    const printWindow = window.open("", "_blank");

    let logoData = logoDataUrl;
    if (!logoData) {
      try {
        const res = await fetch("/logo.png");
        if (res.ok) {
          const blob = await res.blob();
          logoData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(`${window.location.origin}/logo.png`);
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        logoData = (typeof window !== "undefined" ? window.location.origin : "") + "/logo.png";
      }
    }

    const periodLabel = appliedFilters.dateFrom && appliedFilters.dateTo
      ? `${appliedFilters.dateFrom} to ${appliedFilters.dateTo}`
      : "All Recorded Time";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Staff Expense & Income Attribution Report - Concordia College</title>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600&family=Great+Vibes&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 10mm 12mm; }
          body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 10.5px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .header-table td { vertical-align: middle; }
          .logo { width: 75px; height: auto; }
          .inst-name { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .calligraphy-title {
            font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', cursive;
            font-size: 32px;
            color: #1e3a8a;
            font-weight: 400;
            margin: 2px 0;
            line-height: 1.1;
          }
          .kpi-grid { display: flex; gap: 8px; margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; background: #f8fafc; }
          .kpi-card { flex: 1; border: none; padding: 0 4px; }
          .kpi-label { font-size: 8.5px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          .kpi-val { font-size: 11.5px; font-weight: 700; margin-top: 1px; font-family: monospace; }
          .text-income { color: #059669; }
          .text-expense { color: #e11d48; }
          .text-net { color: #2563eb; }
          table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; }
          table.data-table th { background: #f1f5f9; text-transform: uppercase; font-weight: 700; text-align: left; }
          table.data-table td.num { text-align: right; font-family: monospace; font-size: 10.5px; }
          table.data-table tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 20px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px; }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 85px;">
              ${logoData ? `<img src="${logoData}" class="logo" alt="Logo" />` : ""}
            </td>
            <td>
              <div class="inst-name">Concordia College Peshawar</div>
              <div class="calligraphy-title">Staff Expense & Income Report</div>
              <div style="font-size: 10px; color: #64748b;">Period: <strong>${periodLabel}</strong> | Excludes teaching-only &amp; supporting staff</div>
            </td>
            <td style="text-align: right; vertical-align: top; font-size: 10px; color: #64748b;">
              Printed on: ${format(new Date(), "dd-MMM-yyyy hh:mm a")}
            </td>
          </tr>
        </table>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Inflow Brought</div>
            <div class="kpi-val text-income">PKR ${summary.totalIncomeBrought.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Outflow Created</div>
            <div class="kpi-val text-expense">PKR ${summary.totalExpenseCreated.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Net Financial Contribution</div>
            <div class="kpi-val ${summary.netContribution >= 0 ? "text-income" : "text-expense"}">
              PKR ${summary.netContribution.toLocaleString()}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Active Contributing Staff</div>
            <div class="kpi-val text-net">${summary.activeStaffCount} / ${summary.totalEligibleStaff} Staff</div>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th>Staff Name</th>
              <th>Designation</th>
              <th style="text-align: right;">Fee Collections</th>
              <th style="text-align: right;">Custom Income</th>
              <th style="text-align: right;">Total Income</th>
              <th style="text-align: right;">General Exp.</th>
              <th style="text-align: right;">Boarding Exp.</th>
              <th style="text-align: right;">Inventory Exp.</th>
              <th style="text-align: right;">Total Expense</th>
              <th style="text-align: right;">Net Contribution</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStaffBreakdown.map((s, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.designation || "-"}</td>
                <td class="num">${s.feeCollections ? `PKR ${s.feeCollections.toLocaleString()}` : "-"}</td>
                <td class="num">${s.customIncome ? `PKR ${s.customIncome.toLocaleString()}` : "-"}</td>
                <td class="num text-income font-bold">PKR ${s.totalIncome.toLocaleString()}</td>
                <td class="num">${s.generalExpense ? `PKR ${s.generalExpense.toLocaleString()}` : "-"}</td>
                <td class="num">${s.boardingExpense ? `PKR ${s.boardingExpense.toLocaleString()}` : "-"}</td>
                <td class="num">${s.inventoryExpense ? `PKR ${s.inventoryExpense.toLocaleString()}` : "-"}</td>
                <td class="num text-expense font-bold">PKR ${s.totalExpense.toLocaleString()}</td>
                <td class="num font-bold ${s.netContribution >= 0 ? "text-income" : "text-expense"}">
                  PKR ${s.netContribution.toLocaleString()}
                </td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #e2e8f0;">
              <td colspan="3" style="text-align: right;">TOTALS:</td>
              <td class="num">${filteredStaffBreakdown.reduce((sum, s) => sum + s.feeCollections, 0).toLocaleString()}</td>
              <td class="num">${filteredStaffBreakdown.reduce((sum, s) => sum + s.customIncome, 0).toLocaleString()}</td>
              <td class="num text-income">PKR ${summary.totalIncomeBrought.toLocaleString()}</td>
              <td class="num">${filteredStaffBreakdown.reduce((sum, s) => sum + s.generalExpense, 0).toLocaleString()}</td>
              <td class="num">${filteredStaffBreakdown.reduce((sum, s) => sum + s.boardingExpense, 0).toLocaleString()}</td>
              <td class="num">${filteredStaffBreakdown.reduce((sum, s) => sum + s.inventoryExpense, 0).toLocaleString()}</td>
              <td class="num text-expense">PKR ${summary.totalExpenseCreated.toLocaleString()}</td>
              <td class="num font-bold ${summary.netContribution >= 0 ? "text-income" : "text-expense"}">
                PKR ${summary.netContribution.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="footer">
          <div>Concordia College Peshawar &copy; ${new Date().getFullYear()} - Financial Audit &amp; Staff Attribution</div>
          <div>Page 1 of 1</div>
        </div>
      </body>
      </html>
    `;

    await openManagedPrintWindow({
      html: htmlContent,
      title: "Staff Expense & Income Attribution Report - Concordia College",
      toast,
      printWindow,
    });
  };

  return (
    <div className="space-y-6">
      {/* Back to Reports Button */}
      {onBack && (
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-1.5 h-8 text-xs font-semibold shadow-xs bg-white dark:bg-card border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-accent"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            Back to Financial Reports
          </Button>
        </div>
      )}

      {/* Top Filter Bar */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-600" />
                Staff Expense &amp; Income Attribution Report
              </CardTitle>
              <CardDescription className="text-xs">
                Financial inflows (fee payments received + custom incomes) and outflows (expenses created) per staff member.
                Excludes teachers and supporting staff.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-1.5 h-8 text-xs font-medium text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Export as Excel (XLSX)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 h-8 text-xs font-medium text-blue-700 hover:text-blue-800 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                Print / Save as PDF
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Staff Member</Label>
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Eligible Staff</SelectItem>
                  {rawStaffBreakdown.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.designation ? `(${s.designation})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs px-4 flex-1"
                onClick={() => setAppliedFilters({ dateFrom, dateTo })}
              >
                Apply
              </Button>
              {(appliedFilters.dateFrom || appliedFilters.dateTo || selectedStaff !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-2"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setAppliedFilters({ dateFrom: "", dateTo: "" });
                    setSelectedStaff("all");
                    setSelectedType("all");
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Financial Metric Bar (Adjusted text size for strict single-row layout) */}
      <div className="rounded-lg bg-slate-50 dark:bg-card border border-slate-200 dark:border-border py-2 px-3 sm:px-4 flex items-center justify-between gap-2 overflow-x-auto text-xs shadow-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Inflows:</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-xs sm:text-[13px] whitespace-nowrap">
            PKR {summary.totalIncomeBrought.toLocaleString()}
          </span>
          <span className="text-[9.5px] text-muted-foreground hidden 2xl:inline">
            (Challans: PKR {(summary.totalFeeCollections || 0).toLocaleString()} • Direct: PKR {(summary.totalCustomIncome || 0).toLocaleString()})
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Outflows:</span>
          <span className="font-bold text-rose-700 dark:text-rose-400 font-mono text-xs sm:text-[13px] whitespace-nowrap">
            PKR {summary.totalExpenseCreated.toLocaleString()}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Net Contribution:</span>
          <span className={`font-bold font-mono text-xs sm:text-[13px] whitespace-nowrap ${summary.netContribution >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            PKR {summary.netContribution.toLocaleString()}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Eligible Staff:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100 font-mono text-xs whitespace-nowrap">
            {summary.activeStaffCount} / {summary.totalEligibleStaff}
          </span>
        </div>
      </div>

      {/* Visual Chart: Staff Ranking */}
      {chartData.length > 0 && (
        <ModernChartCard
          title="Staff Inflow & Outflow Comparison"
          subtitle="Top contributing staff members by financial volume"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => Number(v).toLocaleString()} width={80} />
                <RechartsTooltip
                  content={
                    <ModernTooltip
                      valueFormatter={(v) => `PKR ${Number(v || 0).toLocaleString()}`}
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Income Brought" fill={MODERN_CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense Created" fill={MODERN_CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModernChartCard>
      )}

      {/* Main Staff Breakdown Table */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold">
                Staff Financial Contribution Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                Detailed record of income generated vs expenses submitted by each non-teaching / both staff member.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search staff name or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Staff Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead className="text-right">Fee Collections</TableHead>
                <TableHead className="text-right">Custom Income</TableHead>
                <TableHead className="text-right font-bold text-emerald-700">Total Inflow</TableHead>
                <TableHead className="text-right">General Exp.</TableHead>
                <TableHead className="text-right">Boarding / Inv.</TableHead>
                <TableHead className="text-right font-bold text-rose-700">Total Outflow</TableHead>
                <TableHead className="text-right font-bold">Net Contribution</TableHead>
                <TableHead className="text-center w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                    Loading staff contribution report...
                  </TableCell>
                </TableRow>
              ) : filteredStaffBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                    No eligible staff records found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaffBreakdown.map((s, idx) => {
                  const boardingAndInv = (s.boardingExpense || 0) + (s.inventoryExpense || 0);
                  return (
                    <TableRow key={s.id || idx} className="hover:bg-slate-50/50">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {s.name}
                        </div>
                        {s.staffId && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: {s.staffId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {s.designation || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {s.feeCollections ? `PKR ${s.feeCollections.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {s.customIncome ? `PKR ${s.customIncome.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-700 text-xs sm:text-sm bg-emerald-50/30">
                        PKR {s.totalIncome.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {s.generalExpense ? `PKR ${s.generalExpense.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {boardingAndInv ? `PKR ${boardingAndInv.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-700 text-xs sm:text-sm bg-rose-50/30">
                        PKR {s.totalExpense.toLocaleString()}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold text-xs sm:text-sm ${s.netContribution >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        PKR {s.netContribution.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="View Itemized Entries"
                          onClick={() => setDrilldownStaff(s)}
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drilldown Modal for Individual Staff Transactions */}
      <Dialog open={Boolean(drilldownStaff)} onOpenChange={(open) => !open && setDrilldownStaff(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>{drilldownStaff?.name} {drilldownStaff?.designation ? `(${drilldownStaff.designation})` : ""} — Itemized Contributions</span>
              <Badge variant="outline" className="text-xs">
                {drilldownTransactions.length} Transactions
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-2">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0">
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead>Category / Module</TableHead>
                  <TableHead>Reference / Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drilldownTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No itemized transaction history recorded for this staff member in the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  drilldownTransactions.map((tx, idx) => (
                    <TableRow key={tx.id || idx}>
                      <TableCell className="text-xs font-mono">{tx.date || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            tx.type === "INCOME"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : "bg-rose-50 text-rose-700 border-rose-300"
                          }`}
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">{tx.category}</div>
                        <div className="text-[10px] text-muted-foreground">{tx.sourceModule}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {tx.description || tx.referenceNo || "-"}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold text-xs ${tx.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
                        PKR {tx.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
