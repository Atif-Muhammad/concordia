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
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
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
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getFinanceAnnualProfitLossReport } from "../../../../config/apis";

export default function AnnualProfitLossReport({ onBack }) {
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [yearSpan, setYearSpan] = useState("4"); // past 4 years

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

  const startYear = currentYear - parseInt(yearSpan) + 1;

  const {
    data: reportData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "financeAnnualProfitLossReport",
      startYear,
      currentYear,
      selectedYear,
    ],
    queryFn: () =>
      getFinanceAnnualProfitLossReport({
        startYear,
        endYear: currentYear,
        selectedYear: parseInt(selectedYear) || currentYear,
      }),
  });

  const yearlyComparison = reportData?.yearlyComparison || [];
  const monthlyBreakdown = reportData?.monthlyBreakdown || [];

  // Data for the Combo Chart (Bars for Revenue & Expense, Line for Margin %)
  const comboChartData = useMemo(() => {
    return yearlyComparison.map((row) => ({
      year: String(row.year),
      Revenue: row.revenue,
      Expense: row.expense,
      NetProfit: row.netProfit,
      Margin: row.marginPercentage,
    }));
  }, [yearlyComparison]);

  // Data for the Monthly Breakdown Combo Chart for selected year
  const monthlyChartData = useMemo(() => {
    return monthlyBreakdown.map((row) => ({
      month: row.month,
      Revenue: row.revenue,
      Expense: row.expense,
      NetProfit: row.netProfit,
      Margin: row.margin,
    }));
  }, [monthlyBreakdown]);

  // Selected year statistics
  const selectedYearSummary = useMemo(() => {
    const found = yearlyComparison.find((y) => String(y.year) === String(selectedYear));
    return (
      found || {
        revenue: 0,
        expense: 0,
        netProfit: 0,
        marginPercentage: 0,
        yoyGrowth: 0,
        fees: 0,
        customIncome: 0,
        payroll: 0,
        generalExpense: 0,
        boardingExpense: 0,
        inventoryExpense: 0,
      }
    );
  }, [yearlyComparison, selectedYear]);

  // Excel Export
  const handleExportExcel = () => {
    try {
      const yearlyRows = yearlyComparison.map((row, idx) => ({
        "Sr #": idx + 1,
        "Year": row.year,
        "Total Revenue (PKR)": row.revenue,
        "Fee Collections (PKR)": row.fees,
        "Custom Income (PKR)": row.customIncome,
        "Total Expenses (PKR)": row.expense,
        "Staff Payroll (PKR)": row.payroll,
        "General Expenses (PKR)": row.generalExpense,
        "Boarding Expenses (PKR)": row.boardingExpense,
        "Inventory Purchases (PKR)": row.inventoryExpense,
        "Net Operating Profit (PKR)": row.netProfit,
        "Profit Margin (%)": `${row.marginPercentage}%`,
        "YoY Revenue Growth (%)": `${row.yoyGrowth}%`,
      }));

      const monthlyRows = monthlyBreakdown.map((m) => ({
        "Month": m.month,
        "Year": selectedYear,
        "Revenue (PKR)": m.revenue,
        "Expenses (PKR)": m.expense,
        "Net Profit (PKR)": m.netProfit,
        "Margin (%)": `${m.margin}%`,
      }));

      const wb = XLSX.utils.book_new();
      const wsYearly = XLSX.utils.json_to_sheet(yearlyRows);
      wsYearly["!cols"] = Object.keys(yearlyRows[0] || {}).map((k) => ({ wch: Math.max(k.length + 3, 15) }));
      XLSX.utils.book_append_sheet(wb, wsYearly, "Yearly Comparison");

      const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
      wsMonthly["!cols"] = Object.keys(monthlyRows[0] || {}).map((k) => ({ wch: Math.max(k.length + 3, 15) }));
      XLSX.utils.book_append_sheet(wb, wsMonthly, `${selectedYear} Monthly Trend`);

      const fileName = `Annual_Profit_Loss_${selectedYear}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast({
        title: "Export Successful",
        description: `Exported Annual P&L and ${selectedYear} monthly trends to ${fileName}`,
      });
    } catch (e) {
      toast({ title: "Failed to export Excel", description: e.message, variant: "destructive" });
    }
  };

  // Managed Print Window / PDF Export
  const handlePrint = async () => {
    // Open target print window immediately in user event handler to prevent popup blocker
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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Annual Profit & Loss Report - Concordia College</title>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600&family=Great+Vibes&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 10mm 12mm; }
          body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .header-table td { vertical-align: middle; }
          .logo { width: 75px; height: auto; }
          .inst-name { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .inst-sub { font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; }
          .calligraphy-title {
            font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', cursive;
            font-size: 32px;
            color: #1e3a8a;
            font-weight: 400;
            margin: 2px 0;
            line-height: 1.1;
          }
          .kpi-grid { display: flex; gap: 8px; margin-bottom: 12px; }
          .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; background: #f8fafc; }
          .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          .kpi-val { font-size: 13px; font-weight: 800; margin-top: 2px; }
          .text-income { color: #059669; }
          .text-expense { color: #e11d48; }
          .text-profit { color: #1e40af; }
          table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; }
          table.data-table th { background: #f1f5f9; text-transform: uppercase; font-weight: 700; text-align: left; }
          table.data-table td.num { text-align: right; font-family: monospace; font-size: 10.5px; }
          table.data-table tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 25px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px; }
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
              <div class="calligraphy-title">Annual Profit & Loss Report</div>
              <div style="font-size: 10px; color: #64748b;">Yearly Multi-Year Comparative Audit (${startYear} - ${currentYear})</div>
            </td>
            <td style="text-align: right; vertical-align: top; font-size: 10px; color: #64748b;">
              Printed on: ${format(new Date(), "dd-MMM-yyyy hh:mm a")}
            </td>
          </tr>
        </table>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">${selectedYear} Total Revenue</div>
            <div class="kpi-val text-income">PKR ${selectedYearSummary.revenue.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">${selectedYear} Total Expenses</div>
            <div class="kpi-val text-expense">PKR ${selectedYearSummary.expense.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">${selectedYear} Net Profit</div>
            <div class="kpi-val ${selectedYearSummary.netProfit >= 0 ? "text-income" : "text-expense"}">
              PKR ${selectedYearSummary.netProfit.toLocaleString()}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">${selectedYear} Profit Margin</div>
            <div class="kpi-val text-profit">${selectedYearSummary.marginPercentage}%</div>
          </div>
        </div>

        <h3 style="margin: 12px 0 4px 0; font-size: 12px; font-weight: 700; color: #1e293b;">1. Multi-Year Financial Comparison</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 45px;">Year</th>
              <th style="text-align: right;">Fee Inflows</th>
              <th style="text-align: right;">Custom Incomes</th>
              <th style="text-align: right; font-weight: 800;">Total Revenue</th>
              <th style="text-align: right;">Payroll</th>
              <th style="text-align: right;">Operations</th>
              <th style="text-align: right;">Boarding / Inv.</th>
              <th style="text-align: right; font-weight: 800;">Total Expenses</th>
              <th style="text-align: right; font-weight: 800;">Net Profit</th>
              <th style="text-align: right;">Margin %</th>
              <th style="text-align: right;">YoY Growth</th>
            </tr>
          </thead>
          <tbody>
            ${yearlyComparison.map((row) => `
              <tr style="${String(row.year) === String(selectedYear) ? "background: #eff6ff; font-weight: bold;" : ""}">
                <td><strong>${row.year}</strong></td>
                <td class="num">${row.fees.toLocaleString()}</td>
                <td class="num">${row.customIncome.toLocaleString()}</td>
                <td class="num text-income font-bold">PKR ${row.revenue.toLocaleString()}</td>
                <td class="num">${row.payroll.toLocaleString()}</td>
                <td class="num">${row.generalExpense.toLocaleString()}</td>
                <td class="num">${(row.boardingExpense + row.inventoryExpense).toLocaleString()}</td>
                <td class="num text-expense font-bold">PKR ${row.expense.toLocaleString()}</td>
                <td class="num font-bold ${row.netProfit >= 0 ? "text-income" : "text-expense"}">
                  PKR ${row.netProfit.toLocaleString()}
                </td>
                <td class="num font-bold">${row.marginPercentage}%</td>
                <td class="num ${row.yoyGrowth >= 0 ? "text-income" : "text-expense"}">
                  ${row.yoyGrowth > 0 ? `+${row.yoyGrowth}%` : `${row.yoyGrowth}%`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h3 style="margin: 16px 0 4px 0; font-size: 12px; font-weight: 700; color: #1e293b;">2. Year ${selectedYear} Monthly Trend Breakdown</h3>
        <table class="data-table">
          <thead>
            <tr>
              ${monthlyBreakdown.map((m) => `<th style="text-align: center;">${m.month}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${monthlyBreakdown.map((m) => `
                <td class="num text-income" style="font-size: 9.5px;">
                  +${m.revenue.toLocaleString()}
                </td>
              `).join("")}
            </tr>
            <tr>
              ${monthlyBreakdown.map((m) => `
                <td class="num text-expense" style="font-size: 9.5px;">
                  -${m.expense.toLocaleString()}
                </td>
              `).join("")}
            </tr>
            <tr style="font-weight: bold; background: #f8fafc;">
              ${monthlyBreakdown.map((m) => `
                <td class="num ${m.netProfit >= 0 ? "text-income" : "text-expense"}" style="font-size: 9.5px;">
                  ${m.netProfit >= 0 ? `+${m.netProfit.toLocaleString()}` : `${m.netProfit.toLocaleString()}`}
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div>Concordia College Peshawar &copy; ${new Date().getFullYear()} - Annual Financial Statements</div>
          <div>Page 1 of 1</div>
        </div>
      </body>
      </html>
    `;

    await openManagedPrintWindow({
      html: htmlContent,
      title: `Annual Profit & Loss Report ${selectedYear} - Concordia College`,
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
                <CalendarDays className="h-5 w-5 text-indigo-600" />
                Annual Profit &amp; Loss Multi-Year Comparison
              </CardTitle>
              <CardDescription className="text-xs">
                Year-over-year comparative audit of institutional inflows (revenues), outflows (expenses), and profit margins.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Comparative Multi-Year Span</Label>
              <Select value={yearSpan} onValueChange={setYearSpan}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Past 3 Years ({currentYear - 2} - {currentYear})</SelectItem>
                  <SelectItem value="4">Past 4 Years ({currentYear - 3} - {currentYear})</SelectItem>
                  <SelectItem value="5">Past 5 Years ({currentYear - 4} - {currentYear})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Deep Dive Year (Monthly Breakdown)</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearlyComparison.map((row) => (
                    <SelectItem key={row.year} value={String(row.year)}>
                      Year {row.year} {row.year === currentYear ? "(Current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                size="sm"
                className="h-8 text-xs px-4 w-full"
                onClick={() => refetch()}
              >
                Refresh Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Financial Metric Bar (Adjusted text size for strict single-row layout) */}
      <div className="rounded-lg bg-slate-50 dark:bg-card border border-slate-200 dark:border-border py-2 px-3 sm:px-4 flex items-center justify-between gap-2 overflow-x-auto text-xs shadow-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
            {selectedYear} Revenue:
          </span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-xs sm:text-[13px] whitespace-nowrap">
            PKR {selectedYearSummary.revenue.toLocaleString()}
          </span>
          <span className="text-[9.5px] text-muted-foreground hidden 2xl:inline">
            (Fees: PKR {selectedYearSummary.fees.toLocaleString()})
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
            {selectedYear} Expenses:
          </span>
          <span className="font-bold text-rose-700 dark:text-rose-400 font-mono text-xs sm:text-[13px] whitespace-nowrap">
            PKR {selectedYearSummary.expense.toLocaleString()}
          </span>
          <span className="text-[9.5px] text-muted-foreground hidden 2xl:inline">
            (Payroll: PKR {selectedYearSummary.payroll.toLocaleString()})
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
            {selectedYear} Net Profit:
          </span>
          <span className={`font-bold font-mono text-xs sm:text-[13px] whitespace-nowrap ${selectedYearSummary.netProfit >= 0 ? "text-blue-700 dark:text-blue-400" : "text-rose-700 dark:text-rose-400"}`}>
            PKR {selectedYearSummary.netProfit.toLocaleString()}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
            Margin &amp; YoY:
          </span>
          <span className="font-bold font-mono text-[10.5px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 whitespace-nowrap">
            {selectedYearSummary.marginPercentage}%
          </span>
          <span className="text-[10.5px] font-semibold whitespace-nowrap">
            {selectedYearSummary.yoyGrowth >= 0 ? (
              <span className="text-emerald-600 inline-flex items-center">
                <ArrowUpRight className="h-3 w-3 inline mr-0.5" />+{selectedYearSummary.yoyGrowth}%
              </span>
            ) : (
              <span className="text-rose-600 inline-flex items-center">
                <ArrowDownRight className="h-3 w-3 inline mr-0.5" />{selectedYearSummary.yoyGrowth}%
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Visual Combo Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Multi-Year Combined Bar & Line Chart */}
        <ModernChartCard
          title="Multi-Year Combined Revenue & Expense Trend"
          subtitle="Bars represent Revenue vs Expenses, line shows Net Margin %"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={comboChartData} margin={{ top: 15, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => Number(v).toLocaleString()} width={80} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <RechartsTooltip
                  content={
                    <ModernTooltip
                      valueFormatter={(v, name) =>
                        name === "Margin" ? `${v}%` : `PKR ${Number(v || 0).toLocaleString()}`
                      }
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Revenue" fill={MODERN_CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="Expense" fill={MODERN_CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Margin"
                  name="Margin (%)"
                  stroke={MODERN_CHART_COLORS.primary}
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ModernChartCard>

        {/* 12-Month Deep Dive Combo Chart for Selected Year */}
        <ModernChartCard
          title={`Year ${selectedYear} Monthly Performance`}
          subtitle="Monthly breakdown of revenues, expenditures, and net margin"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyChartData} margin={{ top: 15, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 9.5 }} tickFormatter={(v) => Number(v).toLocaleString()} width={80} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <RechartsTooltip
                  content={
                    <ModernTooltip
                      valueFormatter={(v, name) =>
                        name === "Margin" ? `${v}%` : `PKR ${Number(v || 0).toLocaleString()}`
                      }
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Revenue" fill={MODERN_CHART_COLORS.success} radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="Expense" fill={MODERN_CHART_COLORS.danger} radius={[3, 3, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Margin"
                  name="Margin (%)"
                  stroke={MODERN_CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ModernChartCard>
      </div>

      {/* Multi-Year Comparison Table */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-base font-bold">
            Multi-Year Comparative Financial Audit
          </CardTitle>
          <CardDescription className="text-xs">
            Yearly summary of all fees collected, custom incomes, staff payroll, and operational expenditures.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-16">Year</TableHead>
                <TableHead className="text-right">Fee Collections</TableHead>
                <TableHead className="text-right">Custom Income</TableHead>
                <TableHead className="text-right font-bold text-emerald-700">Total Revenue</TableHead>
                <TableHead className="text-right">Payroll & Salaries</TableHead>
                <TableHead className="text-right">Operations & Bills</TableHead>
                <TableHead className="text-right">Boarding & Inv.</TableHead>
                <TableHead className="text-right font-bold text-rose-700">Total Expenses</TableHead>
                <TableHead className="text-right font-bold">Net Profit / (Loss)</TableHead>
                <TableHead className="text-right font-bold">Margin</TableHead>
                <TableHead className="text-right">YoY Growth</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-28 text-center text-muted-foreground">
                    Loading annual comparative report...
                  </TableCell>
                </TableRow>
              ) : yearlyComparison.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-28 text-center text-muted-foreground">
                    No historical records available for the selected range.
                  </TableCell>
                </TableRow>
              ) : (
                yearlyComparison.map((row) => {
                  const isSelected = String(row.year) === String(selectedYear);
                  const isProfitable = row.netProfit >= 0;
                  const boardingAndInv = (row.boardingExpense || 0) + (row.inventoryExpense || 0);

                  return (
                    <TableRow
                      key={row.year}
                      className={`hover:bg-slate-50/60 cursor-pointer ${isSelected ? "bg-blue-50/40 font-semibold" : ""}`}
                      onClick={() => setSelectedYear(String(row.year))}
                    >
                      <TableCell>
                        <Badge
                          variant={isSelected ? "default" : "outline"}
                          className="font-mono text-xs px-2 py-0.5"
                        >
                          {row.year}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        PKR {row.fees.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        PKR {row.customIncome.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-700 text-xs sm:text-sm bg-emerald-50/20">
                        PKR {row.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        PKR {row.payroll.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        PKR {row.generalExpense.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        PKR {boardingAndInv.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-700 text-xs sm:text-sm bg-rose-50/20">
                        PKR {row.expense.toLocaleString()}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold text-xs sm:text-sm ${isProfitable ? "text-emerald-700" : "text-rose-700"}`}>
                        PKR {row.netProfit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.marginPercentage}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.yoyGrowth !== 0 ? (
                          <span className={row.yoyGrowth > 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                            {row.yoyGrowth > 0 ? `+${row.yoyGrowth}%` : `${row.yoyGrowth}%`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
