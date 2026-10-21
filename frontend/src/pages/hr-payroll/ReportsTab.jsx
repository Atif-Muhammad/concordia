import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import * as XLSX from "xlsx";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarRange,
  Calculator,
  Printer,
  FileSpreadsheet,
  Search,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Info,
  Coins,
  Briefcase,
  DollarSign,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { MonthPicker } from "@/components/ui/month-picker";
import {
  getPayrollMonthWiseReport,
  getPayrollTotalsReport,
} from "@/services/api";

const MONTH_OPTIONS = [
  { value: "all", label: "All Months" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const currentYearNum = new Date().getFullYear();
const YEAR_OPTIONS = [];
for (let y = 2040; y >= 2020; y--) {
  YEAR_OPTIONS.push(String(y));
}

const formatPayrollMonth = (monthStr) => {
  if (!monthStr || typeof monthStr !== "string") return "-";
  const parts = monthStr.split("-");
  if (parts.length === 2) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(y) && !isNaN(m)) {
      try {
        return format(new Date(y, m - 1, 1), "MMM yyyy");
      } catch {
        return monthStr;
      }
    }
  }
  return monthStr;
};

const fetchLogoDataUrl = async () => {
  try {
    const res = await fetch("/logo.png");
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(`${window.location.origin}/logo.png`);
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // fallback
  }
  return typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png";
};

export const ReportsTab = () => {
  const { toast } = useToast();

  // selectedReport: null (cards hub) | "month-wise" | "totals"
  const [selectedReport, setSelectedReport] = useState(null);

  // Month-Wise Report Filters
  const [mwYear, setMwYear] = useState(String(currentYearNum));
  const [mwMonth, setMwMonth] = useState("all");
  const [mwRole, setMwRole] = useState("all");
  const [mwStatus, setMwStatus] = useState("all");
  const [mwSearch, setMwSearch] = useState("");

  // Totals Report Filters
  const [totYear, setTotYear] = useState(String(currentYearNum));
  const [totMonth, setTotMonth] = useState("all");
  const [totRole, setTotRole] = useState("all");
  const [totStatus, setTotStatus] = useState("all");
  const [totSearch, setTotSearch] = useState("");

  // Totals Report Selection for Print/Preview (selectedMonthKeys)
  const [selectedMonthKeys, setSelectedMonthKeys] = useState(new Set());

  // ==========================================
  // QUERY 1: Month-Wise Payroll Report
  // ==========================================
  const {
    data: monthWiseData = { records: [], summary: {} },
    isLoading: mwLoading,
    isFetching: mwFetching,
    refetch: refetchMonthWise,
  } = useQuery({
    queryKey: ["payrollMonthWiseReport", mwYear, mwMonth, mwRole, mwStatus, mwSearch],
    queryFn: () =>
      getPayrollMonthWiseReport({
        year: mwYear,
        month: mwMonth,
        role: mwRole,
        status: mwStatus,
        search: mwSearch,
      }),
    enabled: selectedReport === "month-wise",
    staleTime: 60 * 1000,
  });

  const mwRecords = monthWiseData?.records || [];
  const mwSummary = monthWiseData?.summary || {};

  // ==========================================
  // QUERY 2: Payroll Totals Report (Grouped by Month Cards)
  // ==========================================
  const {
    data: totalsData = { monthCards: [], combined: {} },
    isLoading: totLoading,
    isFetching: totFetching,
    refetch: refetchTotals,
  } = useQuery({
    queryKey: ["payrollTotalsReport", totYear, totMonth, totRole, totStatus, totSearch],
    queryFn: () =>
      getPayrollTotalsReport({
        year: totYear,
        month: totMonth,
        role: totRole,
        status: totStatus,
        search: totSearch,
      }),
    enabled: selectedReport === "totals",
    staleTime: 60 * 1000,
  });

  const totMonthCards = totalsData?.monthCards || totalsData?.staffTotals || [];
  const totCombined = totalsData?.combined || {};

  // ==========================================
  // SELECTION HANDLERS FOR TOTALS MONTH CARDS
  // ==========================================
  const allMonthKeysOnView = useMemo(
    () => totMonthCards.map((m) => m.month || m.id),
    [totMonthCards]
  );

  const isAllMonthsSelected =
    totMonthCards.length > 0 &&
    allMonthKeysOnView.every((k) => selectedMonthKeys.has(k));

  const isSomeMonthsSelected =
    selectedMonthKeys.size > 0 && !isAllMonthsSelected;

  const toggleSelectAllMonths = useCallback(() => {
    if (isAllMonthsSelected) {
      setSelectedMonthKeys(new Set());
    } else {
      setSelectedMonthKeys(new Set(allMonthKeysOnView));
    }
  }, [isAllMonthsSelected, allMonthKeysOnView]);

  const toggleMonthSelection = useCallback((key) => {
    setSelectedMonthKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const clearMonthSelection = useCallback(() => {
    setSelectedMonthKeys(new Set());
  }, []);

  // Filtered month list based on selection for print/preview
  const effectiveTotalsMonths = useMemo(() => {
    if (selectedMonthKeys.size === 0) return totMonthCards;
    return totMonthCards.filter((m) => selectedMonthKeys.has(m.month || m.id));
  }, [totMonthCards, selectedMonthKeys]);

  // ==========================================
  // PRINT HANDLER: MONTH-WISE PAYROLL
  // ==========================================
  const handlePrintMonthWise = async () => {
    if (!mwRecords || mwRecords.length === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no payroll records for the selected filters.",
        variant: "destructive",
      });
      return;
    }

    const logoDataUrl = await fetchLogoDataUrl();
    const exportDate = format(new Date(), "dd MMMM yyyy, hh:mm a");
    const monthLabel =
      mwMonth === "all"
        ? "All Months"
        : MONTH_OPTIONS.find((m) => m.value === mwMonth)?.label || mwMonth;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Month-Wise Staff Payroll Report - ${mwYear}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page { size: A4 landscape; margin: 8mm 10mm; }
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .no-break { page-break-inside: avoid; }
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1e293b;
              background: #ffffff;
              margin: 0;
              padding: 10px;
              font-size: 10.5px;
              line-height: 1.35;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .report-container {
              width: 100%;
              margin: 0 auto;
              background: #ffffff;
              border: 1.5px solid #0f172a;
              border-top: 3px solid #0f172a;
              padding: 12px 14px;
            }
            .form-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 6px;
              gap: 12px;
            }
            .header-logo-area {
              display: flex;
              align-items: center;
              gap: 12px;
              flex: 1;
            }
            .brand-logo {
              height: 52px;
              width: auto;
              max-width: 120px;
              object-fit: contain;
              display: block;
            }
            .header-title-block h1 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #0f172a;
            }
            .header-title-block .tagline {
              font-size: 9.5px;
              font-weight: 600;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.5px;
              margin-top: 2px;
            }
            .meta-box {
              font-size: 10px;
              color: #64748b;
              line-height: 1.4;
              text-align: right;
            }
            .meta-box strong {
              color: #0f172a;
            }
            .center-calligraphy-title {
              text-align: center;
              font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Brush Script MT', 'Lucida Calligraphy', 'Segoe Script', cursive, serif;
              font-size: 26px;
              font-weight: 500;
              color: #0f172a;
              margin: 4px 0 8px 0;
              padding: 2px 0 6px 0;
              border-bottom: 1px dashed #cbd5e1;
              letter-spacing: 0.5px;
            }
            .filters-bar {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 5px 12px;
              margin-bottom: 10px;
              display: flex;
              flex-wrap: wrap;
              gap: 14px;
              font-size: 10px;
            }
            .filter-item strong {
              color: #334155;
            }
            .filter-item span {
              color: #0f172a;
              font-weight: 600;
            }
            .table-summary-bar {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-bottom: none;
              border-radius: 4px 4px 0 0;
              padding: 6px 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 12px;
              font-size: 10.5px;
              color: #334155;
            }
            .table-summary-bar .summary-item strong {
              color: #0f172a;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            thead th {
              background: #f1f5f9;
              color: #0f172a;
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              padding: 7px 8px;
              text-align: left;
              border: 1px solid #cbd5e1;
            }
            td {
              padding: 6px 8px;
              font-size: 10px;
              border: 1px solid #e2e8f0;
            }
            tr:nth-child(even) td {
              background-color: #fcfcfc;
            }
            .text-right { text-align: right; }
            .badge-paid {
              color: #15803d;
              font-weight: 700;
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
            }
            .badge-pending {
              color: #b91c1c;
              font-weight: 700;
              background: #fef2f2;
              border: 1px solid #fecaca;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
            }
            .badge-partial {
              color: #c2410c;
              font-weight: 700;
              background: #fff7ed;
              border: 1px solid #fed7aa;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
            }
            tfoot tr.grand-total-row {
              background: #f1f5f9;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              font-weight: 700;
            }
            tfoot td {
              padding: 7px 8px;
              font-size: 10.5px;
              border: 1px solid #cbd5e1;
              color: #0f172a;
            }
            .footer-sign {
              display: flex;
              justify-content: space-between;
              margin-top: 25px;
              padding-top: 15px;
              border-top: 1.5px solid #0f172a;
              font-size: 10px;
              color: #475569;
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="form-header">
              <div class="header-logo-area">
                <img src="${logoDataUrl}" class="brand-logo" alt="Concordia College Peshawar Logo" />
                <div class="header-title-block">
                  <h1>Concordia College Peshawar</h1>
                </div>
              </div>
              <div class="meta-box">
                <div><strong>Generated:</strong> ${exportDate}</div>
                <div><strong>Records:</strong> ${mwRecords.length} Payrolls</div>
              </div>
            </div>

            <div class="center-calligraphy-title">
              Month-Wise Staff Payroll Report
            </div>

            <div class="filters-bar">
              <div class="filter-item"><strong>Fiscal Year:</strong> <span>${mwYear}</span></div>
              <div class="filter-item"><strong>Month:</strong> <span>${monthLabel}</span></div>
              <div class="filter-item"><strong>Role:</strong> <span>${mwRole.toUpperCase()}</span></div>
              <div class="filter-item"><strong>Status:</strong> <span>${mwStatus.toUpperCase()}</span></div>
              ${mwSearch ? `<div class="filter-item"><strong>Search:</strong> <span>${mwSearch}</span></div>` : ""}
            </div>

            <div class="table-summary-bar">
              <div class="summary-item">Total Staff Records: <strong>${mwRecords.length}</strong></div>
              <div class="summary-item">Total Basic: <strong>PKR ${(mwSummary.totalBasic || 0).toLocaleString()}</strong></div>
              <div class="summary-item">Total Allowances: <strong>PKR ${(mwSummary.totalAllowances || 0).toLocaleString()}</strong></div>
              <div class="summary-item">Total Deductions: <strong>PKR ${(mwSummary.totalDeductions || 0).toLocaleString()}</strong></div>
              <div class="summary-item">Total Net: <strong>PKR ${(mwSummary.totalNet || 0).toLocaleString()}</strong></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 25px;">#</th>
                  <th>Staff Member</th>
                  <th>ID / Role</th>
                  <th>Department & Designation</th>
                  <th>Month</th>
                  <th class="text-right">Basic Pay</th>
                  <th class="text-right">Allowances</th>
                  <th class="text-right">Deductions</th>
                  <th class="text-right">Net Salary</th>
                  <th style="text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${mwRecords
                  .map(
                    (r, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>
                      <strong>${r.staffName}</strong><br/>
                      <span style="font-size: 8.5px; color: #64748b;">S/D/W/O: ${r.fatherName || "-"}</span>
                    </td>
                    <td>
                      ${r.empId || "-"}<br/>
                      <span style="font-size: 8.5px; color: #475569;">${r.isTeaching ? "Teaching" : "Non-Teaching"}</span>
                    </td>
                    <td>
                      ${r.designation || "-"}<br/>
                      <span style="font-size: 8.5px; color: #64748b;">${r.department || "-"}</span>
                    </td>
                    <td><strong>${formatPayrollMonth(r.month)}</strong></td>
                    <td class="text-right">PKR ${r.basicSalary.toLocaleString()}</td>
                    <td class="text-right">PKR ${r.totalAllowances.toLocaleString()}</td>
                    <td class="text-right" style="color: #b91c1c;">PKR ${r.totalDeductions.toLocaleString()}</td>
                    <td class="text-right"><strong>PKR ${r.netSalary.toLocaleString()}</strong></td>
                    <td style="text-align: center;">
                      <span class="${r.status === "PAID" ? "badge-paid" : r.status === "PARTIAL" ? "badge-partial" : "badge-pending"}">
                        ${r.status}
                      </span>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr class="grand-total-row no-break">
                  <td colspan="5" style="text-align: right; font-weight: 700;">TOTALS (${mwRecords.length} RECORDS):</td>
                  <td class="text-right" style="font-weight: 700;">PKR ${(mwSummary.totalBasic || 0).toLocaleString()}</td>
                  <td class="text-right" style="font-weight: 700;">PKR ${(mwSummary.totalAllowances || 0).toLocaleString()}</td>
                  <td class="text-right" style="font-weight: 700; color: #b91c1c;">PKR ${(mwSummary.totalDeductions || 0).toLocaleString()}</td>
                  <td class="text-right" style="font-weight: 700;">PKR ${(mwSummary.totalNet || 0).toLocaleString()}</td>
                  <td style="text-align: center;">-</td>
                </tr>
              </tfoot>
            </table>

            <div class="footer-sign no-break">
              <div><strong>Prepared By:</strong> _____________________</div>
              <div><strong>Checked By:</strong> _____________________</div>
              <div><strong>Accounts Officer:</strong> _____________________</div>
              <div><strong>Principal / Director:</strong> _____________________</div>
            </div>
          </div>
        </body>
      </html>
    `;

    await openManagedPrintWindow({
      html,
      title: `Month-Wise Staff Payroll Report - ${mwYear}`,
      toast,
    });
  };

  // ==========================================
  // EXCEL HANDLER: MONTH-WISE PAYROLL
  // ==========================================
  const handleExportMonthWiseExcel = () => {
    if (!mwRecords || mwRecords.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no payroll records for the selected filters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const rows = mwRecords.map((r, idx) => ({
        "S.No": idx + 1,
        "Employee ID": r.empId || "-",
        "Staff Name": r.staffName || "-",
        "Father Name": r.fatherName || "-",
        "Designation": r.designation || "-",
        "Department": r.department || "-",
        "Role": r.isTeaching ? "Teaching" : "Non-Teaching",
        "Month": r.month || "-",
        "Basic Pay (PKR)": r.basicSalary || 0,
        "Total Allowances (PKR)": r.totalAllowances || 0,
        "Travel Allowance": r.allowanceBreakdown?.travel || 0,
        "Medical Allowance": r.allowanceBreakdown?.medical || 0,
        "House Rent Allowance": r.allowanceBreakdown?.houseRent || 0,
        "Extra Allowance": r.allowanceBreakdown?.extra || 0,
        "Insurance Allowance": r.allowanceBreakdown?.insurance || 0,
        "Other Allowance": r.allowanceBreakdown?.other || 0,
        "Total Deductions (PKR)": r.totalDeductions || 0,
        "Absent Deduction": r.deductionBreakdown?.absent || 0,
        "Leave Deduction": r.deductionBreakdown?.leave || 0,
        "Advance Deduction": r.deductionBreakdown?.advance || 0,
        "Income Tax": r.deductionBreakdown?.tax || 0,
        "EOBI": r.deductionBreakdown?.eobi || 0,
        "Security Deduction": r.deductionBreakdown?.security || 0,
        "Late Arrival Deduction": r.deductionBreakdown?.lateArrival || 0,
        "Other Deduction": r.deductionBreakdown?.other || 0,
        "Net Salary (PKR)": r.netSalary || 0,
        "Paid Amount (PKR)": r.paidAmount || 0,
        "Payment Status": r.status || "-",
        "Payment Mode": r.paidBy || "-",
        "Payment Date": r.paymentDate ? format(new Date(r.paymentDate), "yyyy-MM-dd") : "-",
      }));

      rows.push({
        "S.No": "TOTAL",
        "Employee ID": "",
        "Staff Name": `${mwRecords.length} Records`,
        "Father Name": "",
        "Designation": "",
        "Department": "",
        "Role": "",
        "Month": "",
        "Basic Pay (PKR)": mwSummary.totalBasic || 0,
        "Total Allowances (PKR)": mwSummary.totalAllowances || 0,
        "Travel Allowance": "",
        "Medical Allowance": "",
        "House Rent Allowance": "",
        "Extra Allowance": "",
        "Insurance Allowance": "",
        "Other Allowance": "",
        "Total Deductions (PKR)": mwSummary.totalDeductions || 0,
        "Absent Deduction": "",
        "Leave Deduction": "",
        "Advance Deduction": "",
        "Income Tax": "",
        "EOBI": "",
        "Security Deduction": "",
        "Late Arrival Deduction": "",
        "Other Deduction": "",
        "Net Salary (PKR)": mwSummary.totalNet || 0,
        "Paid Amount (PKR)": mwSummary.totalPaid || 0,
        "Payment Status": "",
        "Payment Mode": "",
        "Payment Date": "",
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Month-Wise Payroll");
      XLSX.writeFile(wb, `MonthWise_Payroll_Report_${mwYear}_${mwMonth}.xlsx`);

      toast({
        title: "Export Completed",
        description: `Exported ${mwRecords.length} payroll records to Excel.`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel sheet.",
        variant: "destructive",
      });
    }
  };

  // ==========================================
  // ==========================================
  // PRINT HANDLER: TOTALS REPORT (MONTHLY TOTALS)
  // ==========================================
  const handlePrintTotals = async () => {
    if (!effectiveTotalsMonths || effectiveTotalsMonths.length === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no monthly totals records for the selected filters.",
        variant: "destructive",
      });
      return;
    }

    const logoDataUrl = await fetchLogoDataUrl();
    const exportDate = format(new Date(), "dd MMMM yyyy, hh:mm a");
    const yearLabel = totYear === "all" ? "All Years" : totYear;

    const totalBasicSelected = effectiveTotalsMonths.reduce((s, r) => s + (r.totalBasic || 0), 0);
    const totalAllowancesSelected = effectiveTotalsMonths.reduce((s, r) => s + (r.totalAllowances || 0), 0);
    const totalDeductionsSelected = effectiveTotalsMonths.reduce((s, r) => s + (r.totalDeductions || 0), 0);
    const totalNetSelected = effectiveTotalsMonths.reduce((s, r) => s + (r.totalNet || 0), 0);
    const totalPaidSelected = effectiveTotalsMonths.reduce((s, r) => s + (r.totalPaid || 0), 0);

    const isSubsetSelected = selectedMonthKeys.size > 0 && selectedMonthKeys.size < totMonthCards.length;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Payroll Totals Report - Annual Allowances & Deductions (${totYear})</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page { size: A4 landscape; margin: 8mm 10mm; }
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .no-break { page-break-inside: avoid; }
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1e293b;
              background: #ffffff;
              margin: 0;
              padding: 10px;
              font-size: 10.5px;
              line-height: 1.35;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .report-container {
              width: 100%;
              margin: 0 auto;
              background: #ffffff;
              border: 1.5px solid #0f172a;
              border-top: 3px solid #0f172a;
              padding: 12px 14px;
            }
            .form-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 6px;
              gap: 12px;
            }
            .header-logo-area {
              display: flex;
              align-items: center;
              gap: 12px;
              flex: 1;
            }
            .brand-logo {
              height: 52px;
              width: auto;
              max-width: 120px;
              object-fit: contain;
              display: block;
            }
            .header-title-block h1 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #0f172a;
            }
            .header-title-block .tagline {
              font-size: 9.5px;
              font-weight: 600;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.5px;
              margin-top: 2px;
            }
            .meta-box {
              font-size: 10px;
              color: #64748b;
              line-height: 1.4;
              text-align: right;
            }
            .meta-box strong {
              color: #0f172a;
            }
            .center-calligraphy-title {
              text-align: center;
              font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Brush Script MT', 'Lucida Calligraphy', 'Segoe Script', cursive, serif;
              font-size: 26px;
              font-weight: 500;
              color: #0f172a;
              margin: 4px 0 8px 0;
              padding: 2px 0 6px 0;
              border-bottom: 1px dashed #cbd5e1;
              letter-spacing: 0.5px;
            }
            .filters-bar {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 5px 12px;
              margin-bottom: 10px;
              display: flex;
              flex-wrap: wrap;
              gap: 14px;
              font-size: 10px;
            }
            .filter-item strong {
              color: #334155;
            }
            .filter-item span {
              color: #0f172a;
              font-weight: 600;
            }
            .table-summary-bar {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-bottom: none;
              border-radius: 4px 4px 0 0;
              padding: 6px 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 12px;
              font-size: 10.5px;
              color: #334155;
            }
            .table-summary-bar .summary-item strong {
              color: #0f172a;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            thead th {
              background: #f1f5f9;
              color: #0f172a;
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              padding: 7px 8px;
              text-align: left;
              border: 1px solid #cbd5e1;
            }
            td {
              padding: 6px 8px;
              font-size: 10px;
              border: 1px solid #e2e8f0;
            }
            tr:nth-child(even) td {
              background-color: #fcfcfc;
            }
            .text-right { text-align: right; }
            .badge-paid {
              color: #15803d;
              font-weight: 700;
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
            }
            .badge-pending {
              color: #b91c1c;
              font-weight: 700;
              background: #fef2f2;
              border: 1px solid #fecaca;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
            }
            .badge-partial {
              color: #c2410c;
              font-weight: 700;
              background: #fff7ed;
              border: 1px solid #fed7aa;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
            }
            tfoot tr.grand-total-row {
              background: #f1f5f9;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              font-weight: 700;
            }
            tfoot td {
              padding: 7px 8px;
              font-size: 10.5px;
              border: 1px solid #cbd5e1;
              color: #0f172a;
            }
            .footer-sign {
              display: flex;
              justify-content: space-between;
              margin-top: 25px;
              padding-top: 15px;
              border-top: 1.5px solid #0f172a;
              font-size: 10px;
              color: #475569;
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="form-header">
              <div class="header-logo-area">
                <img src="${logoDataUrl}" class="brand-logo" alt="Concordia College Peshawar Logo" />
                <div class="header-title-block">
                  <h1>Concordia College Peshawar</h1>
                </div>
              </div>
              <div class="meta-box">
                <div><strong>Generated:</strong> ${exportDate}</div>
                <div><strong>Scope:</strong> ${isSubsetSelected ? `Selected (${effectiveTotalsMonths.length} Months)` : `All Months (${effectiveTotalsMonths.length})`}</div>
              </div>
            </div>

            <div class="center-calligraphy-title">
              Payroll Totals Report - Allowances & Deductions
            </div>

            <div class="filters-bar">
              <div class="filter-item"><strong>Fiscal Year:</strong> <span>${yearLabel}</span></div>
              <div class="filter-item"><strong>Role:</strong> <span>${totRole.toUpperCase()}</span></div>
              <div class="filter-item"><strong>Status:</strong> <span>${totStatus.toUpperCase()}</span></div>
              ${totSearch ? `<div class="filter-item"><strong>Search:</strong> <span>${totSearch}</span></div>` : ""}
              ${isSubsetSelected ? `<div class="filter-item"><strong style="color: #b45309;">Selection:</strong> <span style="color: #b45309;">Custom ${effectiveTotalsMonths.length} Months Checked</span></div>` : ""}
            </div>

            <div class="table-summary-bar">
              <div class="summary-item">Months Evaluated: <strong>${effectiveTotalsMonths.length}</strong></div>
              <div class="summary-item">Total Basic Pay: <strong>PKR ${totalBasicSelected.toLocaleString()}</strong></div>
              <div class="summary-item">Combined Allowances: <strong>PKR ${totalAllowancesSelected.toLocaleString()}</strong></div>
              <div class="summary-item">Combined Deductions: <strong>PKR ${totalDeductionsSelected.toLocaleString()}</strong></div>
              <div class="summary-item">Total Net Salary: <strong>PKR ${totalNetSelected.toLocaleString()}</strong></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 25px;">#</th>
                  <th>Payroll Month</th>
                  <th style="text-align: center;">Staff Count</th>
                  <th class="text-right">Basic Pay</th>
                  <th class="text-right">Combined Allowances</th>
                  <th class="text-right">Combined Deductions</th>
                  <th class="text-right">Total Net Salary</th>
                  <th class="text-right">Disbursed (Paid)</th>
                  <th style="text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${effectiveTotalsMonths
                  .map(
                    (m, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${formatPayrollMonth(m.month)}</strong></td>
                    <td style="text-align: center;">${m.staffCount} Staff</td>
                    <td class="text-right">PKR ${m.totalBasic.toLocaleString()}</td>
                    <td class="text-right" style="color: #15803d; font-weight: 600;">+PKR ${m.totalAllowances.toLocaleString()}</td>
                    <td class="text-right" style="color: #b91c1c; font-weight: 600;">-PKR ${m.totalDeductions.toLocaleString()}</td>
                    <td class="text-right"><strong>PKR ${m.totalNet.toLocaleString()}</strong></td>
                    <td class="text-right">PKR ${m.totalPaid.toLocaleString()}</td>
                    <td style="text-align: center;">
                      <span class="${m.status === "PAID" ? "badge-paid" : m.status === "PARTIAL" ? "badge-partial" : "badge-pending"}">
                        ${m.status}
                      </span>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr class="grand-total-row no-break">
                  <td colspan="3" style="text-align: right; font-weight: 700;">TOTALS (${effectiveTotalsMonths.length} MONTHS):</td>
                  <td class="text-right" style="font-weight: 700;">PKR ${totalBasicSelected.toLocaleString()}</td>
                  <td class="text-right" style="font-weight: 700; color: #15803d;">PKR ${totalAllowancesSelected.toLocaleString()}</td>
                  <td class="text-right" style="font-weight: 700; color: #b91c1c;">PKR ${totalDeductionsSelected.toLocaleString()}</td>
                  <td class="text-right" style="font-weight: 700;">PKR ${totalNetSelected.toLocaleString()}</td>
                  <td class="text-right" style="font-weight: 700;">PKR ${totalPaidSelected.toLocaleString()}</td>
                  <td style="text-align: center;">-</td>
                </tr>
              </tfoot>
            </table>

            <div class="footer-sign no-break">
              <div><strong>Prepared By:</strong> _____________________</div>
              <div><strong>Checked By:</strong> _____________________</div>
              <div><strong>Accounts Officer:</strong> _____________________</div>
              <div><strong>Principal / Director:</strong> _____________________</div>
            </div>
          </div>
        </body>
      </html>
    `;

    await openManagedPrintWindow({
      html,
      title: `Payroll Totals Report - Annual Allowances & Deductions (${totYear})`,
      toast,
    });
  };

  // ==========================================
  // EXCEL HANDLER: TOTALS REPORT (MONTHLY TOTALS)
  // ==========================================
  const handleExportTotalsExcel = () => {
    if (!effectiveTotalsMonths || effectiveTotalsMonths.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no monthly totals records to export.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const rows = effectiveTotalsMonths.map((m, idx) => ({
        "S.No": idx + 1,
        "Payroll Month": formatPayrollMonth(m.month),
        "Month Key": m.month || "-",
        "Staff Count": m.staffCount || 0,
        "Total Basic Pay (PKR)": m.totalBasic || 0,
        "Total Allowances (PKR)": m.totalAllowances || 0,
        "Travel Allowance": m.allowanceBreakdown?.travel || 0,
        "Medical Allowance": m.allowanceBreakdown?.medical || 0,
        "House Rent Allowance": m.allowanceBreakdown?.houseRent || 0,
        "Extra Allowance": m.allowanceBreakdown?.extra || 0,
        "Insurance Allowance": m.allowanceBreakdown?.insurance || 0,
        "Other Allowance": m.allowanceBreakdown?.other || 0,
        "Total Deductions (PKR)": m.totalDeductions || 0,
        "Absent Deduction": m.deductionBreakdown?.absent || 0,
        "Leave Deduction": m.deductionBreakdown?.leave || 0,
        "Advance Deduction": m.deductionBreakdown?.advance || 0,
        "Income Tax": m.deductionBreakdown?.tax || 0,
        "EOBI": m.deductionBreakdown?.eobi || 0,
        "Security Deduction": m.deductionBreakdown?.security || 0,
        "Late Arrival Deduction": m.deductionBreakdown?.lateArrival || 0,
        "Other Deduction": m.deductionBreakdown?.other || 0,
        "Net Salary (PKR)": m.totalNet || 0,
        "Disbursed Amount (PKR)": m.totalPaid || 0,
        "Pending Amount (PKR)": m.totalPending || 0,
        "Status": m.status || "-",
      }));

      const totalBasicSelected = effectiveTotalsMonths.reduce((sum, r) => sum + (r.totalBasic || 0), 0);
      const totalAllowancesSelected = effectiveTotalsMonths.reduce((sum, r) => sum + (r.totalAllowances || 0), 0);
      const totalDeductionsSelected = effectiveTotalsMonths.reduce((sum, r) => sum + (r.totalDeductions || 0), 0);
      const totalNetSelected = effectiveTotalsMonths.reduce((sum, r) => sum + (r.totalNet || 0), 0);
      const totalPaidSelected = effectiveTotalsMonths.reduce((sum, r) => sum + (r.totalPaid || 0), 0);
      const totalPendingSelected = effectiveTotalsMonths.reduce((sum, r) => sum + (r.totalPending || 0), 0);

      rows.push({
        "S.No": "TOTAL",
        "Payroll Month": `Total (${effectiveTotalsMonths.length} Months)`,
        "Month Key": "",
        "Staff Count": effectiveTotalsMonths.reduce((sum, r) => sum + (r.staffCount || 0), 0),
        "Total Basic Pay (PKR)": totalBasicSelected,
        "Total Allowances (PKR)": totalAllowancesSelected,
        "Travel Allowance": "",
        "Medical Allowance": "",
        "House Rent Allowance": "",
        "Extra Allowance": "",
        "Insurance Allowance": "",
        "Other Allowance": "",
        "Total Deductions (PKR)": totalDeductionsSelected,
        "Absent Deduction": "",
        "Leave Deduction": "",
        "Advance Deduction": "",
        "Income Tax": "",
        "EOBI": "",
        "Security Deduction": "",
        "Late Arrival Deduction": "",
        "Other Deduction": "",
        "Net Salary (PKR)": totalNetSelected,
        "Disbursed Amount (PKR)": totalPaidSelected,
        "Pending Amount (PKR)": totalPendingSelected,
        "Status": "",
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Payroll Totals");
      XLSX.writeFile(wb, `Payroll_Totals_Report_${totYear}.xlsx`);

      toast({
        title: "Export Completed",
        description: `Exported ${effectiveTotalsMonths.length} monthly totals to Excel.`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel sheet.",
        variant: "destructive",
      });
    }
  };

  // =========================================================================
  // RENDER VIEW 1: MONTH-WISE PAYROLL REPORT
  // =========================================================================
  if (selectedReport === "month-wise") {
    return (
      <div className="space-y-6">
        {/* Navigation & Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedReport(null)}
              className="gap-2 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-border hover:bg-slate-100 dark:hover:bg-accent"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Reports</span>
            </Button>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <CalendarRange className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
                Month-Wise Payroll Report
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Full itemized payroll records for all staff by selected year and optional month filters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchMonthWise()}
              disabled={mwFetching}
              className="gap-2 text-xs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${mwFetching ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMonthWiseExcel}
              disabled={mwRecords.length === 0}
              className="gap-2 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </Button>
            <Button
              size="sm"
              onClick={handlePrintMonthWise}
              disabled={mwRecords.length === 0}
              className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Year Filter (Required / Primary) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-600" />
                  Select Year <span className="text-emerald-600 font-bold">*</span>
                </Label>
                <Select value={mwYear} onValueChange={setMwYear}>
                  <SelectTrigger className="w-full text-xs font-medium">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={y} className="text-xs font-medium">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Month Picker Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-600" />
                  Month Picker
                </Label>
                <MonthPicker
                  value={mwMonth === "all" ? "all" : `${mwYear}-${mwMonth}`}
                  onChange={(val) => {
                    if (!val || val === "all") {
                      setMwMonth("all");
                    } else if (val.includes("-")) {
                      const [y, m] = val.split("-");
                      setMwYear(y);
                      setMwMonth(m);
                    }
                  }}
                  allowAll={true}
                  clearable={true}
                  placeholder="All Months (Select Month)"
                  className="w-full text-xs h-9 bg-white dark:bg-card"
                />
              </div>

              {/* Staff Role Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Staff Role
                </Label>
                <Select value={mwRole} onValueChange={setMwRole}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Staff Roles</SelectItem>
                    <SelectItem value="teacher" className="text-xs">Teaching Staff</SelectItem>
                    <SelectItem value="employee" className="text-xs">Non-Teaching Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payout Status
                </Label>
                <Select value={mwStatus} onValueChange={setMwStatus}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="PAID" className="text-xs">Paid</SelectItem>
                    <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                    <SelectItem value="PARTIAL" className="text-xs">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Staff */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  Search Staff
                </Label>
                <div className="relative">
                  <Input
                    placeholder="Search name, ID, dept..."
                    value={mwSearch}
                    onChange={(e) => setMwSearch(e.target.value)}
                    className="w-full text-xs pr-7"
                  />
                  {mwSearch && (
                    <button
                      onClick={() => setMwSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <Card className="border border-border/80 shadow-xs bg-slate-50/50 dark:bg-card">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Payrolls Found
              </p>
              <h3 className="text-xl font-extrabold mt-1 text-foreground">
                {mwRecords.length}
              </h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">Records in {mwYear}</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-xs bg-slate-50/50 dark:bg-card">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Total Basic Pay
              </p>
              <h3 className="text-xl font-extrabold mt-1 text-slate-800 dark:text-slate-100">
                PKR {(mwSummary.totalBasic || 0).toLocaleString()}
              </h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">Base salaries sum</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-xs bg-emerald-50/40 dark:bg-card">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                Total Allowances
              </p>
              <h3 className="text-xl font-extrabold mt-1 text-emerald-700 dark:text-emerald-300">
                PKR {(mwSummary.totalAllowances || 0).toLocaleString()}
              </h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">Travel, med, HR, etc.</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-xs bg-red-50/40 dark:bg-card">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
                Total Deductions
              </p>
              <h3 className="text-xl font-extrabold mt-1 text-red-700 dark:text-red-300">
                PKR {(mwSummary.totalDeductions || 0).toLocaleString()}
              </h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">Tax, absent, adv, eobi</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-xs bg-blue-50/40 dark:bg-card">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                Total Net Salary
              </p>
              <h3 className="text-xl font-extrabold mt-1 text-blue-700 dark:text-blue-300">
                PKR {(mwSummary.totalNet || 0).toLocaleString()}
              </h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">Payable / disbursed</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-xs bg-amber-50/40 dark:bg-card">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Disbursed / Pending
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                  {(mwSummary.totalPaid || 0).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-xs font-bold text-red-600 dark:text-red-400">
                  {(mwSummary.totalPending || 0).toLocaleString()}
                </span>
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">Paid vs outstanding</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card className="border border-border/80 shadow-xs overflow-hidden">
          <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold">Itemized Monthly Payrolls</CardTitle>
                <CardDescription className="text-xs">
                  Showing {mwRecords.length} records for Year {mwYear}
                  {mwMonth !== "all" && ` (${MONTH_OPTIONS.find((m) => m.value === mwMonth)?.label})`}
                </CardDescription>
              </div>
              {mwFetching && (
                <Badge variant="outline" className="text-xs gap-1.5 animate-pulse">
                  <RotateCcw className="w-3 h-3 animate-spin" />
                  Updating...
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70 dark:bg-muted/40">
                    <TableHead className="w-[45px] text-center font-bold text-xs">#</TableHead>
                    <TableHead className="font-bold text-xs min-w-[180px]">Staff Details</TableHead>
                    <TableHead className="font-bold text-xs min-w-[170px]">Designation & Dept</TableHead>
                    <TableHead className="font-bold text-xs min-w-[95px]">Month</TableHead>
                    <TableHead className="font-bold text-xs text-right min-w-[110px]">Basic Pay</TableHead>
                    <TableHead className="font-bold text-xs text-right min-w-[125px]">Allowances</TableHead>
                    <TableHead className="font-bold text-xs text-right min-w-[125px]">Deductions</TableHead>
                    <TableHead className="font-bold text-xs text-right min-w-[125px]">Net Salary</TableHead>
                    <TableHead className="font-bold text-xs text-center min-w-[110px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mwLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RotateCcw className="w-6 h-6 animate-spin text-muted-foreground" />
                          <p className="text-xs text-muted-foreground font-medium">
                            Loading payroll records for {mwYear}...
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : mwRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <AlertCircle className="w-8 h-8 opacity-40" />
                          <p className="text-sm font-semibold">No Payroll Records Found</p>
                          <p className="text-xs max-w-sm">
                            No payroll sheets have been generated for Year {mwYear} matching the selected filters.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    mwRecords.map((r, idx) => (
                      <TableRow key={r.id || idx} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>

                        {/* Staff Details */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-foreground">
                              {r.staffName}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              S/D/W/O: {r.fatherName || "-"}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant="outline" className="font-mono text-[9.5px] px-1.5 py-0">
                                {r.empId}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={`text-[9.5px] px-1.5 py-0 ${
                                  r.isTeaching
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {r.isTeaching ? "Teaching" : "Non-Teaching"}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>

                        {/* Department & Designation */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-foreground">
                              {r.designation}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {r.department}
                            </span>
                          </div>
                        </TableCell>

                        {/* Month */}
                        <TableCell>
                          <Badge variant="outline" className="font-medium text-xs bg-slate-50 dark:bg-muted">
                            {formatPayrollMonth(r.month)}
                          </Badge>
                        </TableCell>

                        {/* Basic Pay */}
                        <TableCell className="text-right font-medium text-xs">
                          PKR {r.basicSalary.toLocaleString()}
                        </TableCell>

                        {/* Allowances */}
                        <TableCell className="text-right">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-right group cursor-pointer focus:outline-none">
                                <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 group-hover:underline">
                                  +PKR {r.totalAllowances.toLocaleString()}
                                </span>
                                <span className="block text-[10px] text-muted-foreground">
                                  View details
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 text-xs" align="end">
                              <h4 className="font-bold text-xs border-b pb-1 mb-2">
                                Allowance Breakdown
                              </h4>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Travel:</span>
                                  <span className="font-medium">PKR {(r.allowanceBreakdown?.travel || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Medical:</span>
                                  <span className="font-medium">PKR {(r.allowanceBreakdown?.medical || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">House Rent:</span>
                                  <span className="font-medium">PKR {(r.allowanceBreakdown?.houseRent || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Extra:</span>
                                  <span className="font-medium">PKR {(r.allowanceBreakdown?.extra || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Insurance:</span>
                                  <span className="font-medium">PKR {(r.allowanceBreakdown?.insurance || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Other:</span>
                                  <span className="font-medium">PKR {(r.allowanceBreakdown?.other || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>

                        {/* Deductions */}
                        <TableCell className="text-right">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-right group cursor-pointer focus:outline-none">
                                <span className="font-bold text-xs text-red-600 dark:text-red-400 group-hover:underline">
                                  -PKR {r.totalDeductions.toLocaleString()}
                                </span>
                                <span className="block text-[10px] text-muted-foreground">
                                  View details
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 text-xs" align="end">
                              <h4 className="font-bold text-xs border-b pb-1 mb-2">
                                Deduction Breakdown
                              </h4>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Absent:</span>
                                  <span className="font-medium">PKR {(r.deductionBreakdown?.absent || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Leave:</span>
                                  <span className="font-medium">PKR {(r.deductionBreakdown?.leave || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Advance:</span>
                                  <span className="font-medium">PKR {(r.deductionBreakdown?.advance || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Tax:</span>
                                  <span className="font-medium">PKR {(r.deductionBreakdown?.tax || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">EOBI:</span>
                                  <span className="font-medium">PKR {(r.deductionBreakdown?.eobi || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Security:</span>
                                  <span className="font-medium">PKR {(r.deductionBreakdown?.security || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Late Arrival:</span>
                                  <span className="font-medium">PKR {(r.deductionBreakdown?.lateArrival || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Other:</span>
                                  <span className="font-medium">PKR {(r.deductionBreakdown?.other || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>

                        {/* Net Salary */}
                        <TableCell className="text-right">
                          <span className="font-extrabold text-xs text-foreground">
                            PKR {r.netSalary.toLocaleString()}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold px-2 py-0.5 ${
                                r.status === "PAID"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : r.status === "PARTIAL"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                              }`}
                            >
                              {r.status}
                            </Badge>
                            {r.paidAmount > 0 && (
                              <span className="text-[9.5px] text-muted-foreground">
                                Paid: PKR {r.paidAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {mwRecords.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-slate-100/80 dark:bg-muted/80 font-bold border-t-2 border-border">
                      <TableCell colSpan={4} className="text-right text-xs">
                        TOTALS ({mwRecords.length} Records):
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        PKR {(mwSummary.totalBasic || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs text-emerald-700 dark:text-emerald-400">
                        PKR {(mwSummary.totalAllowances || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs text-red-600 dark:text-red-400">
                        PKR {(mwSummary.totalDeductions || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs font-extrabold">
                        PKR {(mwSummary.totalNet || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <span className="text-muted-foreground">-</span>
                      </TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // RENDER VIEW 2: PAYROLL TOTALS REPORT (COMBINED ALLOWANCES & DEDUCTIONS)
  // =========================================================================
  if (selectedReport === "totals") {
    return (
      <div className="space-y-6">
        {/* Navigation & Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedReport(null)}
              className="gap-2 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-border hover:bg-slate-100 dark:hover:bg-accent"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Reports</span>
            </Button>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <Calculator className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                Payroll Totals Report
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total deductions and allowances amounts combined for all staff across months.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchTotals()}
              disabled={totFetching}
              className="gap-2 text-xs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${totFetching ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTotalsExcel}
              disabled={effectiveTotalsMonths.length === 0}
              className="gap-2 text-xs text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>
                {selectedMonthKeys.size > 0
                  ? `Export Selected (${selectedMonthKeys.size})`
                  : "Export Excel"}
              </span>
            </Button>
            <Button
              size="sm"
              onClick={handlePrintTotals}
              disabled={effectiveTotalsMonths.length === 0}
              className="gap-2 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>
                {selectedMonthKeys.size > 0
                  ? `Print Selected (${selectedMonthKeys.size})`
                  : "Print Report"}
              </span>
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Optional Search Staff */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  Search Staff
                </Label>
                <div className="relative">
                  <Input
                    placeholder="Search name, ID, dept..."
                    value={totSearch}
                    onChange={(e) => setTotSearch(e.target.value)}
                    className="w-full text-xs pr-7"
                  />
                  {totSearch && (
                    <button
                      onClick={() => setTotSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Optional Year Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-amber-600" />
                  Filter Year (Optional)
                </Label>
                <Select value={totYear} onValueChange={setTotYear}>
                  <SelectTrigger className="w-full text-xs font-medium">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Years</SelectItem>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={y} className="text-xs font-medium">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Optional Month Picker Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-amber-600" />
                  Month Picker (Optional)
                </Label>
                <MonthPicker
                  value={
                    totMonth === "all"
                      ? "all"
                      : totYear !== "all"
                      ? `${totYear}-${totMonth}`
                      : `${new Date().getFullYear()}-${totMonth}`
                  }
                  onChange={(val) => {
                    if (!val || val === "all") {
                      setTotMonth("all");
                    } else if (val.includes("-")) {
                      const [y, m] = val.split("-");
                      if (totYear === "all") setTotYear(y);
                      setTotMonth(m);
                    }
                  }}
                  allowAll={true}
                  clearable={true}
                  placeholder="All Months (Optional)"
                  className="w-full text-xs h-9 bg-white dark:bg-card"
                />
              </div>

              {/* Optional Role Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Staff Role
                </Label>
                <Select value={totRole} onValueChange={setTotRole}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Staff Roles</SelectItem>
                    <SelectItem value="teacher" className="text-xs">Teaching Staff</SelectItem>
                    <SelectItem value="employee" className="text-xs">Non-Teaching Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Optional Status Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payout Status
                </Label>
                <Select value={totStatus} onValueChange={setTotStatus}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="PAID" className="text-xs">Paid</SelectItem>
                    <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                    <SelectItem value="PARTIAL" className="text-xs">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* COMBINED TOTALS KPI SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Staff & Basic Pay */}
          <Card className="border border-border/80 shadow-xs bg-slate-50/50 dark:bg-card">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Staff Included
                  </span>
                  <Users className="w-4 h-4 text-slate-500" />
                </div>
                <h3 className="text-2xl font-extrabold mt-2 text-foreground">
                  {totCombined.totalStaffCount || totMonthCards.reduce((s, m) => s + (m.staffCount || 0), 0)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">Staff Records</span>
                </h3>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Combined Basic Pay:</span>
                <span className="font-bold text-foreground">
                  PKR {(totCombined.totalBasicCombined || 0).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Combined Total Allowances (KEY USER REQUIREMENT) */}
          <Card className="border border-emerald-200 dark:border-emerald-900 shadow-xs bg-emerald-50/30 dark:bg-card">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Combined Allowances
                  </span>
                  <Coins className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-extrabold mt-2 text-emerald-700 dark:text-emerald-300">
                  PKR {(totCombined.totalAllowancesCombined || 0).toLocaleString()}
                </h3>
              </div>
              <div className="mt-3 pt-2.5 border-t border-emerald-200/60 dark:border-border/60 text-[11px] space-y-0.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Travel / Med:</span>
                  <span className="font-medium text-emerald-800 dark:text-emerald-300">
                    PKR {((totCombined.allowanceBreakdown?.travel || 0) + (totCombined.allowanceBreakdown?.medical || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>House Rent / Extra:</span>
                  <span className="font-medium text-emerald-800 dark:text-emerald-300">
                    PKR {((totCombined.allowanceBreakdown?.houseRent || 0) + (totCombined.allowanceBreakdown?.extra || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Combined Total Deductions (KEY USER REQUIREMENT) */}
          <Card className="border border-red-200 dark:border-red-900 shadow-xs bg-red-50/30 dark:bg-card">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                    Combined Deductions
                  </span>
                  <DollarSign className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="text-2xl font-extrabold mt-2 text-red-700 dark:text-red-300">
                  PKR {(totCombined.totalDeductionsCombined || 0).toLocaleString()}
                </h3>
              </div>
              <div className="mt-3 pt-2.5 border-t border-red-200/60 dark:border-border/60 text-[11px] space-y-0.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Absent & Leave:</span>
                  <span className="font-medium text-red-800 dark:text-red-300">
                    PKR {((totCombined.deductionBreakdown?.absent || 0) + (totCombined.deductionBreakdown?.leave || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax, Advance, EOBI:</span>
                  <span className="font-medium text-red-800 dark:text-red-300">
                    PKR {((totCombined.deductionBreakdown?.tax || 0) + (totCombined.deductionBreakdown?.advance || 0) + (totCombined.deductionBreakdown?.eobi || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Net Salary & Paid Status */}
          <Card className="border border-blue-200 dark:border-blue-900 shadow-xs bg-blue-50/30 dark:bg-card">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Combined Net Payout
                  </span>
                  <Briefcase className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-2xl font-extrabold mt-2 text-blue-700 dark:text-blue-300">
                  PKR {(totCombined.totalNetCombined || 0).toLocaleString()}
                </h3>
              </div>
              <div className="mt-3 pt-2.5 border-t border-blue-200/60 dark:border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Disbursed (Paid):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  PKR {(totCombined.totalPaidCombined || 0).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selection Banner (If any month card selected via checkbox) */}
        {selectedMonthKeys.size > 0 && (
          <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 px-4 py-2.5 rounded-xl text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-medium">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              <span>
                <strong>{selectedMonthKeys.size}</strong> of {totMonthCards.length} month cards selected for print / export.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMonthSelection}
                className="h-7 text-xs text-amber-800 hover:text-amber-950 dark:text-amber-300"
              >
                Clear Selection
              </Button>
              <Button
                size="sm"
                onClick={handlePrintTotals}
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              >
                <Printer className="w-3 h-3" />
                Print Selected ({selectedMonthKeys.size})
              </Button>
            </div>
          </div>
        )}

        {/* Section Header with Select All & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 border border-border/70 rounded-xl p-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Monthly Deductions &amp; Allowances Cards
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Showing total deductions and allowances breakdown per month for fiscal year {totYear === "all" ? "All Years" : totYear}. Select month cards to print or export.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {totMonthCards.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAllMonths}
                className="h-8 text-xs gap-2 border-border/80"
              >
                <Checkbox
                  checked={isAllMonthsSelected}
                  onCheckedChange={toggleSelectAllMonths}
                  aria-label="Select all month cards"
                  className="pointer-events-none"
                />
                <span>{isAllMonthsSelected ? "Deselect All" : "Select All"}</span>
              </Button>
            )}

            {totFetching && (
              <Badge variant="outline" className="text-xs gap-1.5 animate-pulse">
                <RotateCcw className="w-3 h-3 animate-spin" />
                Updating...
              </Badge>
            )}
          </div>
        </div>

        {/* MONTH CARDS GRID */}
        {totLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse p-5 space-y-4 border border-border/60">
                <div className="h-6 bg-muted rounded w-1/2" />
                <div className="h-20 bg-muted/50 rounded" />
                <div className="h-20 bg-muted/50 rounded" />
                <div className="h-8 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : totMonthCards.length === 0 ? (
          <Card className="border border-border/80 shadow-xs p-12 text-center">
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertCircle className="w-10 h-10 opacity-40 text-amber-600" />
              <h3 className="text-base font-bold text-foreground">No Payroll Records Found</h3>
              <p className="text-xs max-w-md">
                No staff payroll records were found for fiscal year {totYear === "all" ? "any year" : totYear} matching the selected filters.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {totMonthCards.map((m) => {
              const isSelected = selectedMonthKeys.has(m.month || m.id);
              return (
                <div
                  key={m.month || m.id}
                  className={`group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border transition-all duration-200 p-5 flex flex-col justify-between shadow-xs ${
                    isSelected
                      ? "border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-[#eae8df] dark:border-border hover:border-amber-400"
                  }`}
                >
                  {/* Card Top / Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMonthSelection(m.month || m.id)}
                          aria-label={`Select ${formatPayrollMonth(m.month)}`}
                          className="translate-y-[1px]"
                        />
                        <div className="w-9 h-9 rounded-xl bg-amber-600/10 text-amber-800 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <CalendarRange className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight leading-tight">
                            {formatPayrollMonth(m.month)}
                          </h3>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {m.month}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-2 py-0.5 ${
                            m.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : m.status === "PARTIAL"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                          }`}
                        >
                          {m.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 bg-white dark:bg-muted text-muted-foreground">
                          <Users className="w-2.5 h-2.5 mr-1 inline" />
                          {m.staffCount} Staff
                        </Badge>
                      </div>
                    </div>

                    {/* FINANCIAL BLOCKS: ALLOWANCES & DEDUCTIONS */}
                    <div className="space-y-3 my-4">
                      {/* ALLOWANCES BLOCK */}
                      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900/60 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                            <Coins className="w-3 h-3 text-emerald-600" />
                            Total Allowances
                          </span>
                          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
                            +PKR {(m.totalAllowances || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Itemized Allowances Breakdown */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Travel:</span>
                            <span className="font-semibold text-foreground">PKR {(m.allowanceBreakdown?.travel || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Medical:</span>
                            <span className="font-semibold text-foreground">PKR {(m.allowanceBreakdown?.medical || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>House Rent:</span>
                            <span className="font-semibold text-foreground">PKR {(m.allowanceBreakdown?.houseRent || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Extra:</span>
                            <span className="font-semibold text-foreground">PKR {(m.allowanceBreakdown?.extra || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Insurance:</span>
                            <span className="font-semibold text-foreground">PKR {(m.allowanceBreakdown?.insurance || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Other:</span>
                            <span className="font-semibold text-foreground">PKR {(m.allowanceBreakdown?.other || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* DEDUCTIONS BLOCK */}
                      <div className="rounded-xl border border-red-200/80 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900/60 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-red-600" />
                            Total Deductions
                          </span>
                          <span className="text-sm font-extrabold text-red-700 dark:text-red-300 font-mono">
                            -PKR {(m.totalDeductions || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Itemized Deductions Breakdown */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-2 border-t border-red-200/60 dark:border-red-900/40 text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Absent:</span>
                            <span className="font-semibold text-foreground">PKR {(m.deductionBreakdown?.absent || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Leave:</span>
                            <span className="font-semibold text-foreground">PKR {(m.deductionBreakdown?.leave || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Advance:</span>
                            <span className="font-semibold text-foreground">PKR {(m.deductionBreakdown?.advance || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Income Tax:</span>
                            <span className="font-semibold text-foreground">PKR {(m.deductionBreakdown?.tax || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>EOBI:</span>
                            <span className="font-semibold text-foreground">PKR {(m.deductionBreakdown?.eobi || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Security:</span>
                            <span className="font-semibold text-foreground">PKR {(m.deductionBreakdown?.security || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Late Arrival:</span>
                            <span className="font-semibold text-foreground">PKR {(m.deductionBreakdown?.lateArrival || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Other:</span>
                            <span className="font-semibold text-foreground">PKR {(m.deductionBreakdown?.other || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD FOOTER: BASIC, NET, DISBURSED & SELECTION BUTTON */}
                  <div className="pt-3 border-t border-[#eae8df] dark:border-border/60 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10.5px] text-muted-foreground block">Base Pay:</span>
                        <span className="font-bold text-foreground">PKR {(m.totalBasic || 0).toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10.5px] text-muted-foreground block">Net Salary:</span>
                        <span className="font-extrabold text-foreground text-xs">PKR {(m.totalNet || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-dashed border-border/60">
                      <div>
                        <span className="text-muted-foreground">Disbursed: </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">PKR {(m.totalPaid || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pending: </span>
                        <span className="font-bold text-red-600 dark:text-red-400">PKR {(m.totalPending || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMonthSelection(m.month || m.id)}
                        className={`w-full text-xs h-8 transition-colors ${
                          isSelected
                            ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200"
                            : ""
                        }`}
                      >
                        {isSelected ? "Selected ✓" : "Select Month Card"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // DEFAULT VIEW: CARDS NAVIGATION HUB (Matching FeeReportsTab Style)
  // =========================================================================
  return (
    <div className="space-y-6 max-w-full">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10.5px] font-bold tracking-[0.2em] text-[#8c887b] dark:text-muted-foreground uppercase mb-1">
              HR &amp; PAYROLL • REPORTS &amp; AUDITS
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#22211f] dark:text-foreground">
              Staff Payroll Reports &amp; Financial Statements
            </h1>
            <p className="text-xs sm:text-[13px] text-[#66645d] dark:text-muted-foreground mt-1.5 leading-relaxed">
              Select a reporting module below to audit detailed month-wise payroll disbursements or review consolidated allowances and deduction totals across all employees.
            </p>
            <div className="w-10 h-1 bg-[#d97c38] rounded-full mt-2.5" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="font-mono text-xs bg-white dark:bg-card px-3 py-1 border-[#eae8df]">
              2 Report Modules Available
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid of Report Navigation Cards (Left Justified, Matching Concordia ERP Navigation Boxes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: Month-Wise Payroll Report */}
        <div
          onClick={() => setSelectedReport("month-wise")}
          className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs hover:border-emerald-500/80 transition-all duration-200 cursor-pointer"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#2e694d] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
              <CalendarRange className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>

            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-emerald-700 transition-colors">
                Month-Wise Payroll Report
              </h3>
            </div>
            <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
              Select a fiscal year to retrieve comprehensive payroll sheets for all staff. Inspect itemized base salaries, detailed allowances, deductions, and disbursement statuses.
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReport("month-wise");
              }}
              className="w-full justify-between text-xs font-semibold shadow-xs bg-white hover:bg-emerald-50 text-slate-800 border-slate-200"
            >
              <span className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-emerald-600" />
                Open Month-Wise Report
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>

        {/* CARD 2: Payroll Totals Report */}
        <div
          onClick={() => setSelectedReport("totals")}
          className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs hover:border-amber-500/80 transition-all duration-200 cursor-pointer"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#c85a17] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
              <Calculator className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>

            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-amber-700 transition-colors">
                Payroll Totals Report
              </h3>
            </div>
            <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
              Total deductions and allowances amounts combined across all staff. Includes optional filters for search staff, year, month, and checkboxes for selective print preview.
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReport("totals");
              }}
              className="w-full justify-between text-xs font-semibold shadow-xs bg-white hover:bg-amber-50 text-slate-800 border-slate-200"
            >
              <span className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-600" />
                Open Totals Report
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
