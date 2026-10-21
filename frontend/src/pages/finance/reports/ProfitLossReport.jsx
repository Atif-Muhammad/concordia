import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
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
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieIcon,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getFinanceProfitLossReport } from "../../../../config/apis";

export default function ProfitLossReport({ onBack }) {
  const { toast } = useToast();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ dateFrom: "", dateTo: "" });

  // Quick preset helper
  const applyPreset = (preset) => {
    const now = new Date();
    let start = "";
    let end = "";
    if (preset === "thisMonth") {
      start = format(startOfMonth(now), "yyyy-MM-dd");
      end = format(endOfMonth(now), "yyyy-MM-dd");
    } else if (preset === "lastMonth") {
      const prev = subMonths(now, 1);
      start = format(startOfMonth(prev), "yyyy-MM-dd");
      end = format(endOfMonth(prev), "yyyy-MM-dd");
    } else if (preset === "thisYear") {
      start = format(startOfYear(now), "yyyy-MM-dd");
      end = format(endOfYear(now), "yyyy-MM-dd");
    } else if (preset === "all") {
      start = "";
      end = "";
    }
    setDateFrom(start);
    setDateTo(end);
    setAppliedFilters({ dateFrom: start, dateTo: end });
  };

  // Logo data URL cache for managed print window
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
      "financeProfitLossReport",
      appliedFilters.dateFrom,
      appliedFilters.dateTo,
    ],
    queryFn: () =>
      getFinanceProfitLossReport({
        dateFrom: appliedFilters.dateFrom || undefined,
        dateTo: appliedFilters.dateTo || undefined,
      }),
  });

  const kpis = reportData?.kpis || {
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    marginPercentage: 0,
  };

  const inflows = reportData?.inflows || {
    regularFees: 0,
    extraFees: 0,
    hostelFees: 0,
    customIncome: 0,
    total: 0,
    breakdownByCategory: [],
  };

  const outflows = reportData?.outflows || {
    generalExpenses: 0,
    boardingExpenses: 0,
    inventoryExpenses: 0,
    payrolls: 0,
    total: 0,
    breakdownByCategory: [],
  };

  // Bar Chart Data: High level Profit vs Loss Comparison
  const comparisonBarData = useMemo(() => {
    return [
      {
        name: "Financial Summary",
        Revenue: kpis.totalRevenue,
        Expenses: kpis.totalExpenses,
        NetProfit: kpis.netProfit,
      },
    ];
  }, [kpis]);

  // Channel comparison chart data
  const channelData = useMemo(() => {
    return [
      { name: "Regular Fees", type: "Inflow", amount: inflows.regularFees },
      { name: "Hostel Fees", type: "Inflow", amount: inflows.hostelFees },
      { name: "Extra Fees", type: "Inflow", amount: inflows.extraFees },
      { name: "Custom Income", type: "Inflow", amount: inflows.customIncome },
      { name: "Staff Payroll", type: "Outflow", amount: outflows.payrolls },
      { name: "General Exp.", type: "Outflow", amount: outflows.generalExpenses },
      { name: "Boarding Exp.", type: "Outflow", amount: outflows.boardingExpenses },
      { name: "Inventory", type: "Outflow", amount: outflows.inventoryExpenses },
    ].filter((x) => x.amount > 0);
  }, [inflows, outflows]);

  // Excel Export
  const handleExportExcel = () => {
    try {
      const summaryRows = [
        { "Financial Statement": "STATEMENT OF PROFIT & LOSS - CONCORDIA COLLEGE", "Amount (PKR)": "" },
        { "Financial Statement": "Reporting Period", "Amount (PKR)": `${appliedFilters.dateFrom || "Beginning"} to ${appliedFilters.dateTo || "Present"}` },
        { "Financial Statement": "Generated At", "Amount (PKR)": format(new Date(), "dd-MMM-yyyy hh:mm a") },
        { "Financial Statement": "", "Amount (PKR)": "" },
        { "Financial Statement": "1. OPERATING REVENUES (INFLOWS)", "Amount (PKR)": "" },
        { "Financial Statement": "  - Regular Tuition & Fee Collections", "Amount (PKR)": inflows.regularFees },
        { "Financial Statement": "  - Hostel / Boarding Fees", "Amount (PKR)": inflows.hostelFees },
        { "Financial Statement": "  - Extra Challan Fees", "Amount (PKR)": inflows.extraFees },
        { "Financial Statement": "  - Custom Income & Grants", "Amount (PKR)": inflows.customIncome },
        { "Financial Statement": "TOTAL OPERATING REVENUE", "Amount (PKR)": kpis.totalRevenue },
        { "Financial Statement": "", "Amount (PKR)": "" },
        { "Financial Statement": "2. OPERATING EXPENSES (OUTFLOWS)", "Amount (PKR)": "" },
        { "Financial Statement": "  - Staff Payroll & Wages", "Amount (PKR)": outflows.payrolls },
        { "Financial Statement": "  - General Operational Expenses", "Amount (PKR)": outflows.generalExpenses },
        { "Financial Statement": "  - Boarding & Hostel Expenses", "Amount (PKR)": outflows.boardingExpenses },
        { "Financial Statement": "  - Inventory & Asset Purchases", "Amount (PKR)": outflows.inventoryExpenses },
        { "Financial Statement": "TOTAL OPERATING EXPENSES", "Amount (PKR)": kpis.totalExpenses },
        { "Financial Statement": "", "Amount (PKR)": "" },
        { "Financial Statement": "3. NET OPERATING RESULT", "Amount (PKR)": "" },
        { "Financial Statement": "NET PROFIT / (LOSS)", "Amount (PKR)": kpis.netProfit },
        { "Financial Statement": "PROFIT / LOSS MARGIN (%)", "Amount (PKR)": `${kpis.marginPercentage}%` },
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(summaryRows);
      ws["!cols"] = [{ wch: 45 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
      const fileName = `Profit_and_Loss_Statement_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast({
        title: "Export Successful",
        description: `Exported Statement of Profit & Loss to ${fileName}`,
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

    const periodLabel = appliedFilters.dateFrom && appliedFilters.dateTo
      ? `${appliedFilters.dateFrom} to ${appliedFilters.dateTo}`
      : "Complete System History";

    const isProfitable = kpis.netProfit >= 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Profit & Loss Statement - Concordia College</title>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600&family=Great+Vibes&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11px; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
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
          .kpi-grid { display: flex; gap: 8px; margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; background: #f8fafc; }
          .kpi-card { flex: 1; border: none; padding: 0 4px; }
          .kpi-label { font-size: 8.5px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          .kpi-val { font-size: 11.5px; font-weight: 700; margin-top: 1px; font-family: monospace; }
          .text-income { color: #059669; }
          .text-expense { color: #e11d48; }
          .text-profit { color: #1e40af; }
          table.statement-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          table.statement-table th, table.statement-table td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; }
          table.statement-table th { background: #f8fafc; font-weight: 700; text-transform: uppercase; font-size: 10px; text-align: left; }
          .sec-header { background: #f1f5f9; font-weight: 800; color: #0f172a; text-transform: uppercase; font-size: 11px; }
          .subtotal-row { font-weight: 700; background: #f8fafc; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; }
          .grand-total-row { font-size: 13px; font-weight: 800; background: #eff6ff; border-top: 2px solid #3b82f6; border-bottom: 3px double #1d4ed8; }
          .num { text-align: right; font-family: monospace; font-size: 11.5px; }
          .footer { margin-top: 35px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 8px; }
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
              <div class="calligraphy-title">Statement of Profit & Loss</div>
              <div style="font-size: 10px; color: #64748b;">Reporting Period: <strong>${periodLabel}</strong></div>
            </td>
            <td style="text-align: right; vertical-align: top; font-size: 10px; color: #64748b;">
              Generated on: ${format(new Date(), "dd-MMM-yyyy hh:mm a")}
            </td>
          </tr>
        </table>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Revenue (Inflows)</div>
            <div class="kpi-val text-income">PKR ${kpis.totalRevenue.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Expenses (Outflows)</div>
            <div class="kpi-val text-expense">PKR ${kpis.totalExpenses.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Net ${isProfitable ? "Profit" : "Loss"}</div>
            <div class="kpi-val ${isProfitable ? "text-income" : "text-expense"}">
              PKR ${kpis.netProfit.toLocaleString()}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Profit / Loss Margin</div>
            <div class="kpi-val ${isProfitable ? "text-income" : "text-expense"}">
              ${kpis.marginPercentage}%
            </div>
          </div>
        </div>

        <table class="statement-table">
          <thead>
            <tr>
              <th>Particulars / Financial Heads</th>
              <th style="text-align: right; width: 140px;">Amount (PKR)</th>
              <th style="text-align: right; width: 80px;">% of Total</th>
            </tr>
          </thead>
          <tbody>
            <tr class="sec-header">
              <td colspan="3">1. OPERATING REVENUES (INFLOWS)</td>
            </tr>
            <tr>
              <td style="padding-left: 20px;">Regular Tuition & Fee Collections</td>
              <td class="num">${inflows.regularFees.toLocaleString()}</td>
              <td class="num">${kpis.totalRevenue > 0 ? ((inflows.regularFees / kpis.totalRevenue) * 100).toFixed(1) : "0"}%</td>
            </tr>
            <tr>
              <td style="padding-left: 20px;">Hostel / Boarding Fees</td>
              <td class="num">${inflows.hostelFees.toLocaleString()}</td>
              <td class="num">${kpis.totalRevenue > 0 ? ((inflows.hostelFees / kpis.totalRevenue) * 100).toFixed(1) : "0"}%</td>
            </tr>
            <tr>
              <td style="padding-left: 20px;">Extra Challan Fees</td>
              <td class="num">${inflows.extraFees.toLocaleString()}</td>
              <td class="num">${kpis.totalRevenue > 0 ? ((inflows.extraFees / kpis.totalRevenue) * 100).toFixed(1) : "0"}%</td>
            </tr>
            <tr>
              <td style="padding-left: 20px;">Custom Incomes & Donations</td>
              <td class="num">${inflows.customIncome.toLocaleString()}</td>
              <td class="num">${kpis.totalRevenue > 0 ? ((inflows.customIncome / kpis.totalRevenue) * 100).toFixed(1) : "0"}%</td>
            </tr>
            <tr class="subtotal-row">
              <td>TOTAL OPERATING REVENUE</td>
              <td class="num text-income">PKR ${kpis.totalRevenue.toLocaleString()}</td>
              <td class="num">100.0%</td>
            </tr>

            <tr class="sec-header">
              <td colspan="3" style="padding-top: 15px;">2. OPERATING EXPENSES (OUTFLOWS)</td>
            </tr>
            <tr>
              <td style="padding-left: 20px;">Staff Payroll & Salaries</td>
              <td class="num">${outflows.payrolls.toLocaleString()}</td>
              <td class="num">${kpis.totalExpenses > 0 ? ((outflows.payrolls / kpis.totalExpenses) * 100).toFixed(1) : "0"}%</td>
            </tr>
            <tr>
              <td style="padding-left: 20px;">General Operational Expenses</td>
              <td class="num">${outflows.generalExpenses.toLocaleString()}</td>
              <td class="num">${kpis.totalExpenses > 0 ? ((outflows.generalExpenses / kpis.totalExpenses) * 100).toFixed(1) : "0"}%</td>
            </tr>
            <tr>
              <td style="padding-left: 20px;">Boarding & Mess Operations</td>
              <td class="num">${outflows.boardingExpenses.toLocaleString()}</td>
              <td class="num">${kpis.totalExpenses > 0 ? ((outflows.boardingExpenses / kpis.totalExpenses) * 100).toFixed(1) : "0"}%</td>
            </tr>
            <tr>
              <td style="padding-left: 20px;">Inventory & Asset Purchases</td>
              <td class="num">${outflows.inventoryExpenses.toLocaleString()}</td>
              <td class="num">${kpis.totalExpenses > 0 ? ((outflows.inventoryExpenses / kpis.totalExpenses) * 100).toFixed(1) : "0"}%</td>
            </tr>
            <tr class="subtotal-row">
              <td>TOTAL OPERATING EXPENSES</td>
              <td class="num text-expense">PKR ${kpis.totalExpenses.toLocaleString()}</td>
              <td class="num">100.0%</td>
            </tr>

            <tr class="grand-total-row">
              <td>NET OPERATING ${isProfitable ? "PROFIT" : "LOSS"}</td>
              <td class="num ${isProfitable ? "text-income" : "text-expense"}">
                PKR ${kpis.netProfit.toLocaleString()}
              </td>
              <td class="num font-bold">${kpis.marginPercentage}%</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div>Concordia College Peshawar &copy; ${new Date().getFullYear()} - Financial Accounts Office</div>
          <div>Authorized Signature: _________________________</div>
        </div>
      </body>
      </html>
    `;

    await openManagedPrintWindow({
      html: htmlContent,
      title: "Statement of Profit & Loss - Concordia College",
      toast,
      printWindow,
    });
  };

  const isProfitable = kpis.netProfit >= 0;

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

      {/* Top Filter and Quick Presets Card */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Profit &amp; Loss Statement (Income vs Expenses)
              </CardTitle>
              <CardDescription className="text-xs">
                Comprehensive accounting statement of system inflows (fees &amp; custom incomes) vs outflows (payrolls &amp; expenses).
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

        <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Quick Periods:
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("thisMonth")}
              className="h-7 text-xs px-2.5"
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("lastMonth")}
              className="h-7 text-xs px-2.5"
            >
              Last Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("thisYear")}
              className="h-7 text-xs px-2.5"
            >
              This Year
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("all")}
              className="h-7 text-xs px-2.5"
            >
              All Time
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
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
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs px-4 flex-1"
                onClick={() => setAppliedFilters({ dateFrom, dateTo })}
              >
                Apply Date Filter
              </Button>
              {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-2"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setAppliedFilters({ dateFrom: "", dateTo: "" });
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
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Revenue:</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-xs sm:text-[13px] whitespace-nowrap">
            PKR {kpis.totalRevenue.toLocaleString()}
          </span>
          <span className="text-[9.5px] text-muted-foreground hidden 2xl:inline">
            (Fees: PKR {(inflows.regularFees + inflows.hostelFees + inflows.extraFees).toLocaleString()} • Direct: PKR {inflows.customIncome.toLocaleString()})
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Expenses:</span>
          <span className="font-bold text-rose-700 dark:text-rose-400 font-mono text-xs sm:text-[13px] whitespace-nowrap">
            PKR {kpis.totalExpenses.toLocaleString()}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Operating {isProfitable ? "Profit" : "Loss"}:</span>
          <span className={`font-bold font-mono text-xs sm:text-[13px] whitespace-nowrap ${isProfitable ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            PKR {kpis.netProfit.toLocaleString()}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Margin:</span>
          <span className={`font-bold font-mono text-[10.5px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${isProfitable ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}`}>
            {kpis.marginPercentage}%
          </span>
        </div>
      </div>

      {/* Visual Bar Charts: Inflow vs Outflow & Channel Distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ModernChartCard
          title="Profit vs Loss Comparison"
          subtitle="Direct comparison of Total Inflows vs Total Outflows"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonBarData} margin={{ top: 15, right: 15, left: 20, bottom: 5 }}>
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
                <Bar dataKey="Revenue" fill={MODERN_CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill={MODERN_CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                <Bar dataKey="NetProfit" name="Net Profit" fill={MODERN_CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModernChartCard>

        <ModernChartCard
          title="Inflow & Outflow Channel Breakdown"
          subtitle="Volume across distinct revenue streams and expense categories"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical" margin={{ top: 5, right: 25, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => Number(v).toLocaleString()} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={85} />
                <RechartsTooltip
                  content={
                    <ModernTooltip
                      valueFormatter={(v) => `PKR ${Number(v || 0).toLocaleString()}`}
                    />
                  }
                />
                <Bar dataKey="amount" name="Amount (PKR)" radius={[0, 4, 4, 0]}>
                  {channelData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.type === "Inflow" ? MODERN_CHART_COLORS.success : MODERN_CHART_COLORS.danger}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModernChartCard>
      </div>

      {/* Structured Statement of Profit and Loss */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-base font-bold">
            Formal Statement of Profit & Loss
          </CardTitle>
          <CardDescription className="text-xs">
            Itemized breakdown of all revenue streams and operational expenses for the selected reporting period.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-1/2">Particulars / Financial Heads</TableHead>
                <TableHead className="text-right">Category / Type</TableHead>
                <TableHead className="text-right font-mono">Amount (PKR)</TableHead>
                <TableHead className="text-right">% of Segment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Revenue Section */}
              <TableRow className="bg-slate-100/70 font-bold">
                <TableCell colSpan={4} className="text-xs text-slate-800 uppercase tracking-wider">
                  1. Operating Revenues (Inflows)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs sm:text-sm font-medium">Regular Tuition & Academic Fee Collections</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Fee Challans</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm">
                  PKR {inflows.regularFees.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {kpis.totalRevenue > 0 ? ((inflows.regularFees / kpis.totalRevenue) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs sm:text-sm font-medium">Hostel & Boarding Fee Collections</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Hostel Challans</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm">
                  PKR {inflows.hostelFees.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {kpis.totalRevenue > 0 ? ((inflows.hostelFees / kpis.totalRevenue) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs sm:text-sm font-medium">Extra & Supplementary Challans</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Extra Challans</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm">
                  PKR {inflows.extraFees.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {kpis.totalRevenue > 0 ? ((inflows.extraFees / kpis.totalRevenue) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs sm:text-sm font-medium">Custom Incomes, Grants & Donations</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Finance Income</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm">
                  PKR {inflows.customIncome.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {kpis.totalRevenue > 0 ? ((inflows.customIncome / kpis.totalRevenue) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
              <TableRow className="bg-emerald-50/50 font-bold border-y-2 border-emerald-200">
                <TableCell colSpan={2} className="text-xs sm:text-sm text-emerald-900">
                  TOTAL OPERATING REVENUE (A)
                </TableCell>
                <TableCell className="text-right font-mono text-emerald-800 text-sm sm:text-base">
                  PKR {kpis.totalRevenue.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-emerald-800 text-xs">
                  100.0%
                </TableCell>
              </TableRow>

              {/* Expenses Section */}
              <TableRow className="bg-slate-100/70 font-bold">
                <TableCell colSpan={4} className="text-xs text-slate-800 uppercase tracking-wider pt-4">
                  2. Operating Expenses (Outflows)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs sm:text-sm font-medium">Staff Payroll & Salaries</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">HR Payroll</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm">
                  PKR {outflows.payrolls.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {kpis.totalExpenses > 0 ? ((outflows.payrolls / kpis.totalExpenses) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs sm:text-sm font-medium">General Institutional Expenses</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Finance Expense</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm">
                  PKR {outflows.generalExpenses.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {kpis.totalExpenses > 0 ? ((outflows.generalExpenses / kpis.totalExpenses) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs sm:text-sm font-medium">Boarding & Hostel Operations</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Hostel Expense</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm">
                  PKR {outflows.boardingExpenses.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {kpis.totalExpenses > 0 ? ((outflows.boardingExpenses / kpis.totalExpenses) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs sm:text-sm font-medium">Inventory & Equipment Purchases</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Inventory Expense</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm">
                  PKR {outflows.inventoryExpenses.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {kpis.totalExpenses > 0 ? ((outflows.inventoryExpenses / kpis.totalExpenses) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
              <TableRow className="bg-rose-50/50 font-bold border-y-2 border-rose-200">
                <TableCell colSpan={2} className="text-xs sm:text-sm text-rose-900">
                  TOTAL OPERATING EXPENSES (B)
                </TableCell>
                <TableCell className="text-right font-mono text-rose-800 text-sm sm:text-base">
                  PKR {kpis.totalExpenses.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-rose-800 text-xs">
                  100.0%
                </TableCell>
              </TableRow>

              {/* Net Result */}
              <TableRow className={`font-bold border-y-4 ${isProfitable ? "bg-blue-50/70 border-blue-300" : "bg-amber-50/70 border-amber-300"}`}>
                <TableCell colSpan={2} className={`text-sm sm:text-base ${isProfitable ? "text-blue-950" : "text-amber-950"}`}>
                  NET OPERATING {isProfitable ? "PROFIT" : "LOSS"} (A - B)
                </TableCell>
                <TableCell className={`text-right font-mono text-base sm:text-lg ${isProfitable ? "text-blue-800" : "text-rose-700"}`}>
                  PKR {kpis.netProfit.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm font-bold">
                  {kpis.marginPercentage}% Margin
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
