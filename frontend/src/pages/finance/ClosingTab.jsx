import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Trash2,
  Calendar,
  History,
  Lock,
  ChevronDown,
  ChevronRight,
  Printer,
  Receipt,
  Users,
  Wallet as WalletIcon,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getFinanceClosingDashboard,
  getFinanceClosings,
  createFinanceClosing,
  deleteFinanceClosing,
  getAcademicSessions,
} from "../../../config/apis";
import usePermissions from "@/hooks/usePermissions";
import { openManagedPrintWindow } from "@/lib/managedPrint";

const formatDateTime = (dateValue) => {
  if (!dateValue) return "N/A";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatReportDate = (dateValue) => {
  if (!dateValue) return "Today";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }); // e.g. "07-Oct-2026"
  } catch {
    return String(dateValue);
  }
};

export default function ClosingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate: canClose } = usePermissions("Finance", "closings");

  const todayDateStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [closingDate, setClosingDate] = useState(() => todayDateStr);
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [closingRemarks, setClosingRemarks] = useState("");
  const [closingTargetDate, setClosingTargetDate] = useState(() => todayDateStr);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [showHistory, setShowHistory] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);

  // Expandable row state (fee, otherIncome, payroll, otherExpense)
  // Default to expanded so sub-tables are immediately visible directly beneath their respective parent rows
  const [expandedIncomeRows, setExpandedIncomeRows] = useState(
    () => new Set(["fee", "otherIncome"])
  );
  const [expandedExpenseRows, setExpandedExpenseRows] = useState(
    () => new Set(["payroll", "otherExpense"])
  );

  const toggleIncomeRow = (key) => {
    setExpandedIncomeRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpenseRow = (key) => {
    setExpandedExpenseRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Fetch Closing Dashboard (Strictly itemized & reconciled)
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
  } = useQuery({
    queryKey: ["financeClosingDashboard", closingDate],
    queryFn: () =>
      getFinanceClosingDashboard({
        date: closingDate || undefined,
      }),
  });

  // Fetch Academic Sessions for Session display
  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessionsClosing"],
    queryFn: getAcademicSessions,
    staleTime: 5 * 60 * 1000,
  });

  const activeSessionName = useMemo(() => {
    if (Array.isArray(academicSessions)) {
      const active = academicSessions.find(
        (s) => s.isCurrent || s.status === "ACTIVE"
      );
      if (active?.name) return active.name;
      if (academicSessions[0]?.name) return academicSessions[0].name;
    }
    return "2025-2026";
  }, [academicSessions]);

  // Fetch historical closing records
  const {
    data: closingsHistory = [],
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ["financeClosings", closingDate],
    queryFn: () =>
      getFinanceClosings({
        date: closingDate || undefined,
      }),
  });

  const {
    data: allClosings = [],
  } = useQuery({
    queryKey: ["financeClosingsAll"],
    queryFn: () => getFinanceClosings(),
  });

  const closedDatesSet = new Set((allClosings || []).map((c) => c.date));
  const isExactCheckpoint = Boolean(dashboardData?.isExactCheckpoint);

  // Extracted Detailed Data Arrays
  const feeCollectionDetails = useMemo(() => dashboardData?.feeCollectionDetails || [], [dashboardData]);
  const otherIncomeDetails = useMemo(() => dashboardData?.otherIncomeDetails || [], [dashboardData]);
  const payrollDetails = useMemo(() => dashboardData?.payrollDetails || [], [dashboardData]);
  const otherExpenseDetails = useMemo(() => dashboardData?.otherExpenseDetails || [], [dashboardData]);
  const walletsDateBreakdown = useMemo(() => dashboardData?.walletsDateBreakdown || [], [dashboardData]);

  // Computed Totals (Matches backend exact figures)
  const feeCollectionTotal = useMemo(() => {
    if (dashboardData?.totalFeeCollection !== undefined) return dashboardData.totalFeeCollection;
    return feeCollectionDetails.reduce((s, c) => s + Number(c.paidAmount || 0), 0);
  }, [feeCollectionDetails, dashboardData]);

  const otherIncomeTotal = useMemo(() => {
    if (dashboardData?.totalOtherRevenue !== undefined) return dashboardData.totalOtherRevenue;
    return otherIncomeDetails.reduce((s, i) => s + Number(i.amount || 0), 0);
  }, [otherIncomeDetails, dashboardData]);

  const totalIncome = useMemo(() => {
    if (dashboardData?.totalIncome !== undefined) return dashboardData.totalIncome;
    return feeCollectionTotal + otherIncomeTotal;
  }, [feeCollectionTotal, otherIncomeTotal, dashboardData]);

  const payrollTotal = useMemo(() => {
    if (dashboardData?.totalPayroll !== undefined) return dashboardData.totalPayroll;
    return payrollDetails.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  }, [payrollDetails, dashboardData]);

  const otherExpenseTotal = useMemo(() => {
    if (dashboardData?.totalOtherExpenses !== undefined) return dashboardData.totalOtherExpenses;
    return otherExpenseDetails.reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [otherExpenseDetails, dashboardData]);

  const totalExpenses = useMemo(() => {
    if (dashboardData?.totalExpense !== undefined) return dashboardData.totalExpense;
    return payrollTotal + otherExpenseTotal;
  }, [payrollTotal, otherExpenseTotal, dashboardData]);

  const netBalance = useMemo(() => {
    if (dashboardData?.netBalance !== undefined) return dashboardData.netBalance;
    return totalIncome - totalExpenses;
  }, [totalIncome, totalExpenses, dashboardData]);

  // Wallets Sum Verification
  const walletsSumInflow = useMemo(() => {
    return walletsDateBreakdown.reduce((s, w) => s + Number(w.dateInflow || 0), 0);
  }, [walletsDateBreakdown]);

  const walletsSumOutflow = useMemo(() => {
    return walletsDateBreakdown.reduce((s, w) => s + Number(w.dateOutflow || 0), 0);
  }, [walletsDateBreakdown]);

  const walletsSumNet = useMemo(() => {
    return walletsDateBreakdown.reduce((s, w) => s + Number(w.dateNetBalance || 0), 0);
  }, [walletsDateBreakdown]);

  // Helper to extract or calculate total aggregated heads amount for a challan row without names
  const getHeadsAmount = (c) => {
    if (c.headsAmount !== undefined && c.headsAmount !== null && !isNaN(c.headsAmount)) {
      return Number(c.headsAmount);
    }
    if (typeof c.heads === 'number') return c.heads;
    if (typeof c.heads === 'string') {
      const matches = c.heads.match(/\d[\d,]*/g);
      if (matches && matches.length > 0) {
        return matches.reduce((sum, m) => sum + (Number(m.replace(/,/g, '')) || 0), 0);
      }
    }
    const derived = Number(c.totalAmount || 0) - Number(c.baseAmount || 0) - Number(c.lateFeeFine || 0);
    return Math.max(0, derived);
  };

  // Add Closing Mutation
  const addClosingMutation = useMutation({
    mutationFn: createFinanceClosing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosings"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingsAll"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      toast({
        title: "Closing Checkpoint Created",
        description: `Financial closing checkpoint for ${closingTargetDate} recorded successfully.`,
      });
      setClosingModalOpen(false);
      setClosingRemarks("");
    },
    onError: (error) => {
      toast({
        title: error.message || "Failed to record closing",
        variant: "destructive",
      });
    },
  });

  const deleteClosingMutation = useMutation({
    mutationFn: deleteFinanceClosing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosings"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingsAll"] });
      toast({ title: "Closing checkpoint deleted" });
      setDeleteConfirm({ open: false, id: null });
    },
    onError: (error) => {
      toast({
        title: error.message || "Failed to delete closing checkpoint",
        variant: "destructive",
      });
    },
  });

  const handlePerformClosing = () => {
    if (closedDatesSet.has(closingTargetDate)) {
      toast({
        title: "Duplicate Closing Date",
        description: `A closing checkpoint for ${closingTargetDate} already exists.`,
        variant: "destructive",
      });
      return;
    }
    addClosingMutation.mutate({
      remarks: closingRemarks,
      date: closingTargetDate,
    });
  };

  // Generate Print HTML matching the parent-nested table layout
  const generatePrintHtml = () => {
    const formattedDate = formatReportDate(closingDate || todayDateStr);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Daily Income & Expense Report - Concordia College Peshawar</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,600;1,700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              background: #fff;
              font-size: 10px;
              line-height: 1.35;
            }
            .header-container {
              display: flex;
              align-items: center;
              justify-content: flex-start;
              gap: 16px;
              border-bottom: 2.5px solid #ea580c;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .logo {
              height: 54px;
              width: auto;
              object-fit: contain;
            }
            .title-area {
              flex: 1;
              text-align: center;
            }
            .college-title {
              font-size: 16px;
              font-weight: 800;
              letter-spacing: 1px;
              color: #0f172a;
              text-transform: uppercase;
              margin: 0;
            }
            .calligraphic-title {
              font-family: 'Playfair Display', Georgia, serif;
              font-style: italic;
              font-size: 20px;
              font-weight: 700;
              color: #ea580c;
              margin: 2px 0;
            }
            .meta-line {
              font-size: 10px;
              color: #475569;
              font-weight: 600;
            }
            .section-header {
              font-size: 11px;
              font-weight: 800;
              color: #0f172a;
              margin: 12px 0 6px 0;
              padding-bottom: 3px;
              border-bottom: 2px solid #334155;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            table.main-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
              font-size: 9.5px;
              border: 1.5px solid #334155;
            }
            table.main-table th, table.main-table td {
              border: 1px solid #475569;
              padding: 5px 6px;
              text-align: left;
            }
            table.main-table th {
              background-color: #f1f5f9;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 8.5px;
              border: 1px solid #334155;
            }
            tr.parent-row {
              background-color: #f8fafc;
              font-weight: 700;
            }
            tr.parent-row td {
              border: 1px solid #334155;
            }
            tr.child-row > td {
              padding: 6px 8px 8px 12px !important;
              background-color: #ffffff;
              border: 1px solid #475569;
            }
            table.nested-table {
              width: 100%;
              border-collapse: collapse;
              margin: 2px 0;
              font-size: 9px;
              border: 1.5px solid #475569;
            }
            table.nested-table th, table.nested-table td {
              border: 1px solid #64748b;
              padding: 4px 6px;
            }
            table.nested-table th {
              background-color: #f1f5f9;
              color: #0f172a;
              font-weight: 700;
              font-size: 8.5px;
              border: 1px solid #475569;
            }
            .total-row {
              background-color: #f1f5f9;
              font-weight: 800;
            }
            .total-row td {
              border: 1.5px solid #334155;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .font-mono {
              font-family: "Courier New", Courier, monospace;
            }
            .summary-cards-container {
              display: flex;
              gap: 8px;
              margin: 10px 0;
            }
            .summary-card {
              flex: 1;
              padding: 6px 8px;
              border-radius: 4px;
              border: 1.5px solid #475569;
              background-color: #f8fafc;
              text-align: center;
            }
            .summary-card-title {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #475569;
            }
            .summary-card-amount {
              font-family: "Courier New", Courier, monospace;
              font-size: 14px;
              font-weight: 800;
              margin-top: 1px;
              color: #0f172a;
            }
            .summary-card.income .summary-card-amount {
              color: #047857;
            }
            .summary-card.expense .summary-card-amount {
              color: #be123c;
            }
            .summary-card.net .summary-card-amount {
              color: #c2410c;
            }
            .signatures {
              margin-top: 25px;
              display: flex;
              justify-content: space-between;
              padding-top: 14px;
            }
            .sig-line {
              width: 140px;
              text-align: center;
              border-top: 1.5px solid #1e293b;
              padding-top: 3px;
              font-size: 9px;
              font-weight: 600;
              color: #334155;
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header-container">
            <img src="/logo.png" alt="Concordia College" class="logo" />
            <div class="title-area">
              <div class="college-title">Concordia College Peshawar</div>
              <div class="calligraphic-title">Daily Income &amp; Expense Report</div>
              <div class="meta-line">
                Session: ${activeSessionName} &nbsp;|&nbsp; Report Date: ${formattedDate}
              </div>
            </div>
            <div style="width: 54px;"></div>
          </div>

          <!-- 1. Income Details Table (With nested sub-tables directly beneath each parent row) -->
          <div class="section-header">1. Income Details</div>
          <table class="main-table">
            <thead>
              <tr>
                <th style="width: 35px;" class="text-center">S.No</th>
                <th>Income Sector / Particular</th>
                <th style="width: 110px;" class="text-center">Records</th>
                <th style="width: 130px;" class="text-right">Total Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Parent Row 1: Fee Collection -->
              <tr class="parent-row">
                <td class="text-center font-mono">1</td>
                <td>Student Fee Collections</td>
                <td class="text-center font-mono">${feeCollectionDetails.length} Challans</td>
                <td class="text-right font-mono font-bold" style="color: #059669;">
                  ${feeCollectionTotal.toLocaleString()}
                </td>
              </tr>
              <!-- Child Nested Sub-table directly beneath Fee Collection -->
              <tr class="child-row">
                <td colspan="4">
                  <table class="nested-table">
                    <thead>
                      <tr>
                        <th style="width: 25px;" class="text-center">#</th>
                        <th style="width: 70px;">Challan #</th>
                        <th>Student Information (Name, Father, Roll #)</th>
                        <th style="width: 55px;" class="text-right">Base</th>
                        <th style="width: 55px;" class="text-right">Heads</th>
                        <th style="width: 50px;" class="text-right">Late Fine</th>
                        <th style="width: 55px;" class="text-right">Gross</th>
                        <th style="width: 65px;" class="text-right" style="color: #059669;">Paid (Rs.)</th>
                        <th style="width: 80px;">Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        feeCollectionDetails.length === 0
                          ? `<tr><td colspan="9" class="text-center" style="color: #94a3b8; font-style: italic;">No fee collections recorded on this date.</td></tr>`
                          : feeCollectionDetails
                              .map(
                                (c, idx) => `
                            <tr>
                              <td class="text-center font-mono">${idx + 1}</td>
                              <td class="font-mono">#${c.challanNo}</td>
                              <td><strong>${c.studentName}</strong> (Father: ${c.fatherName} • Roll: ${c.rollNumber})</td>
                              <td class="text-right font-mono">${Number(c.baseAmount || 0).toLocaleString()}</td>
                              <td class="text-right font-mono">${Number(getHeadsAmount(c) || 0).toLocaleString()}</td>
                              <td class="text-right font-mono">${Number(c.lateFeeFine || 0).toLocaleString()}</td>
                              <td class="text-right font-mono">${Number(c.totalAmount || 0).toLocaleString()}</td>
                              <td class="text-right font-mono font-bold" style="color: #059669;">${Number(c.paidAmount || 0).toLocaleString()}</td>
                              <td>${c.walletName || "Cash in Hand"}</td>
                            </tr>
                          `
                              )
                              .join("")
                      }
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- Parent Row 2: Other Revenue -->
              <tr class="parent-row">
                <td class="text-center font-mono">2</td>
                <td>Other Revenue &amp; Direct Receipts</td>
                <td class="text-center font-mono">${otherIncomeDetails.length} Entries</td>
                <td class="text-right font-mono font-bold" style="color: #059669;">
                  ${otherIncomeTotal.toLocaleString()}
                </td>
              </tr>
              <!-- Child Nested Sub-table directly beneath Other Revenue -->
              <tr class="child-row">
                <td colspan="4">
                  <table class="nested-table">
                    <thead>
                      <tr>
                        <th style="width: 25px;" class="text-center">#</th>
                        <th style="width: 110px;">Category</th>
                        <th>Description / Remarks</th>
                        <th style="width: 110px;">Source / Ref</th>
                        <th style="width: 85px;">Account</th>
                        <th style="width: 75px;" class="text-right" style="color: #059669;">Amount (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        otherIncomeDetails.length === 0
                          ? `<tr><td colspan="6" class="text-center" style="color: #94a3b8; font-style: italic;">No other revenue recorded on this date.</td></tr>`
                          : otherIncomeDetails
                              .map(
                                (inc, idx) => `
                            <tr>
                              <td class="text-center font-mono">${idx + 1}</td>
                              <td><strong>${inc.category}</strong> ${inc.subCategory ? `(${inc.subCategory})` : ""}</td>
                              <td>${inc.remarks || inc.title || "—"}</td>
                              <td>${inc.source || "Direct Receipt"}</td>
                              <td>${inc.walletName || "Cash in Hand"}</td>
                              <td class="text-right font-mono font-bold" style="color: #059669;">${Number(inc.amount || 0).toLocaleString()}</td>
                            </tr>
                          `
                              )
                              .join("")
                      }
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- Total Income Row -->
              <tr class="total-row">
                <td colspan="3" class="text-right uppercase">Total Income:</td>
                <td class="text-right font-mono font-bold" style="color: #059669;">
                  Rs. ${totalIncome.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 2. Expense Details Table (With nested sub-tables directly beneath each parent row) -->
          <div class="section-header" style="margin-top: 12px;">2. Expense Details</div>
          <table class="main-table">
            <thead>
              <tr>
                <th style="width: 35px;" class="text-center">S.No</th>
                <th>Expense Sector / Particular</th>
                <th style="width: 110px;" class="text-center">Records</th>
                <th style="width: 130px;" class="text-right">Total Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Parent Row 1: Staff Payroll -->
              <tr class="parent-row">
                <td class="text-center font-mono">1</td>
                <td>Staff Payroll &amp; Salaries</td>
                <td class="text-center font-mono">${payrollDetails.length} Staff</td>
                <td class="text-right font-mono font-bold" style="color: #e11d48;">
                  ${payrollTotal.toLocaleString()}
                </td>
              </tr>
              <!-- Child Nested Sub-table directly beneath Payroll -->
              <tr class="child-row">
                <td colspan="4">
                  <table class="nested-table">
                    <thead>
                      <tr>
                        <th style="width: 25px;" class="text-center">#</th>
                        <th>Staff Details (Name, Father, ID &amp; Designation)</th>
                        <th style="width: 70px;">Month</th>
                        <th style="width: 55px;" class="text-right">Payable</th>
                        <th style="width: 55px;" class="text-right">Deductions</th>
                        <th style="width: 55px;" class="text-right">Allowances</th>
                        <th style="width: 65px;" class="text-right" style="color: #e11d48;">Net Paid</th>
                        <th style="width: 80px;">Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        payrollDetails.length === 0
                          ? `<tr><td colspan="8" class="text-center" style="color: #94a3b8; font-style: italic;">No payroll disbursements recorded on this date.</td></tr>`
                          : payrollDetails
                              .map(
                                (p, idx) => `
                            <tr>
                              <td class="text-center font-mono">${idx + 1}</td>
                              <td><strong>${p.staffName}</strong> (Father: ${p.fatherName} • ID: ${p.employeeId} • ${p.designation})</td>
                              <td>${p.month || "—"}</td>
                              <td class="text-right font-mono">${Number(p.payable || 0).toLocaleString()}</td>
                              <td class="text-right font-mono">${Number(p.deductions || 0).toLocaleString()}</td>
                              <td class="text-right font-mono">${Number(p.allowance || 0).toLocaleString()}</td>
                              <td class="text-right font-mono font-bold" style="color: #e11d48;">${Number(p.totalAmount || 0).toLocaleString()}</td>
                              <td>${p.walletName || "Cash in Hand"}</td>
                            </tr>
                          `
                              )
                              .join("")
                      }
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- Parent Row 2: Other Operating Expenses -->
              <tr class="parent-row">
                <td class="text-center font-mono">2</td>
                <td>Other Operating Expenses</td>
                <td class="text-center font-mono">${otherExpenseDetails.length} Vouchers</td>
                <td class="text-right font-mono font-bold" style="color: #e11d48;">
                  ${otherExpenseTotal.toLocaleString()}
                </td>
              </tr>
              <!-- Child Nested Sub-table directly beneath Other Expenses -->
              <tr class="child-row">
                <td colspan="4">
                  <table class="nested-table">
                    <thead>
                      <tr>
                        <th style="width: 25px;" class="text-center">#</th>
                        <th style="width: 110px;">Category</th>
                        <th>Description / Purpose</th>
                        <th style="width: 70px;">Voucher #</th>
                        <th style="width: 100px;">Vendor / Payee</th>
                        <th style="width: 80px;">Account</th>
                        <th style="width: 70px;" class="text-right" style="color: #e11d48;">Amount (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        otherExpenseDetails.length === 0
                          ? `<tr><td colspan="7" class="text-center" style="color: #94a3b8; font-style: italic;">No operating expenses recorded on this date.</td></tr>`
                          : otherExpenseDetails
                              .map(
                                (exp, idx) => `
                            <tr>
                              <td class="text-center font-mono">${idx + 1}</td>
                              <td><strong>${exp.category}</strong> ${exp.subCategory ? `(${exp.subCategory})` : ""}</td>
                              <td>${exp.remarks || exp.title || "—"}</td>
                              <td class="font-mono">#${exp.voucherNo}</td>
                              <td>${exp.vendor || "—"}</td>
                              <td>${exp.walletName || "Cash in Hand"}</td>
                              <td class="text-right font-mono font-bold" style="color: #e11d48;">${Number(exp.amount || 0).toLocaleString()}</td>
                            </tr>
                          `
                              )
                              .join("")
                      }
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- Total Expenses Row -->
              <tr class="total-row">
                <td colspan="3" class="text-right uppercase">Total Expenses:</td>
                <td class="text-right font-mono font-bold" style="color: #e11d48;">
                  Rs. ${totalExpenses.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 3. Financial Summary & Reconciliation -->
          <div class="section-header" style="margin-top: 12px;">3. Financial Summary &amp; Treasury Reconciliation</div>
          
          <div class="summary-cards-container">
            <div class="summary-card income">
              <div class="summary-card-title">Total Income</div>
              <div class="summary-card-amount">Rs. ${totalIncome.toLocaleString()}</div>
            </div>
            <div class="summary-card expense">
              <div class="summary-card-title">Total Expenses</div>
              <div class="summary-card-amount">Rs. ${totalExpenses.toLocaleString()}</div>
            </div>
            <div class="summary-card net">
              <div class="summary-card-title">Cash in Hand / Net Holding</div>
              <div class="summary-card-amount">Rs. ${netBalance.toLocaleString()}</div>
            </div>
          </div>

          <!-- Wallets Holding Table -->
          <table class="main-table">
            <thead>
              <tr>
                <th style="width: 30px;" class="text-center">S.No</th>
                <th>Account / Wallet</th>
                <th style="width: 80px;">Type</th>
                <th style="width: 100px;" class="text-right">Date Inflow (+)</th>
                <th style="width: 100px;" class="text-right">Date Outflow (-)</th>
                <th style="width: 120px;" class="text-right">Date Net Holding</th>
              </tr>
            </thead>
            <tbody>
              ${walletsDateBreakdown
                .map(
                  (w, idx) => `
                <tr>
                  <td class="text-center font-mono">${idx + 1}</td>
                  <td><strong>${w.walletName}</strong> ${w.accountNumber ? `(#${w.accountNumber})` : ""}</td>
                  <td>${w.walletType}</td>
                  <td class="text-right font-mono" style="color: #059669;">+${Number(w.dateInflow || 0).toLocaleString()}</td>
                  <td class="text-right font-mono" style="color: #e11d48;">-${Number(w.dateOutflow || 0).toLocaleString()}</td>
                  <td class="text-right font-mono font-bold">
                    ${w.dateNetBalance >= 0 ? "+" : ""}Rs. ${Number(w.dateNetBalance || 0).toLocaleString()}
                  </td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td colspan="3" class="text-right uppercase">Reconciled Totals:</td>
                <td class="text-right font-mono font-bold" style="color: #059669;">+Rs. ${walletsSumInflow.toLocaleString()}</td>
                <td class="text-right font-mono font-bold" style="color: #e11d48;">-Rs. ${walletsSumOutflow.toLocaleString()}</td>
                <td class="text-right font-mono font-bold" style="color: #ea580c;">Rs. ${walletsSumNet.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <!-- Signatures -->
          <div class="signatures">
            <div class="sig-line">Prepared By (Accountant)</div>
            <div class="sig-line">Verified By (Finance Mgr)</div>
            <div class="sig-line">Approved By (Principal)</div>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    const html = generatePrintHtml();
    await openManagedPrintWindow({
      html,
      title: `Daily Income & Expense Report - ${closingDate || todayDateStr}`,
      toast,
    });
  };

  return (
    <div className="space-y-6">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          1. TOP BRANDING & CONTROLS HEADER
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card className="border border-border/70 shadow-xs bg-card overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Branding & Calligraphic Title */}
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src="/logo.png"
                alt="Concordia College Peshawar"
                className="h-14 sm:h-16 w-auto object-contain shrink-0"
              />
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  Concordia College Peshawar
                </div>
                <h1
                  className="text-xl sm:text-2xl md:text-3xl font-serif italic text-primary font-bold tracking-tight leading-none"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  Daily Income &amp; Expense Report
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                  <Badge variant="outline" className="text-[10px] sm:text-xs font-medium">
                    Session: {activeSessionName}
                  </Badge>
                  <span>•</span>
                  <span className="font-semibold text-foreground">
                    Report Date: {formatReportDate(closingDate || todayDateStr)}
                  </span>
                  {isExactCheckpoint && (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold">
                      Checkpoint Closed
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Date Picker & Actions */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
              <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-md border border-border">
                <Calendar className="w-3.5 h-3.5 text-primary ml-1 shrink-0" />
                <Input
                  type="date"
                  className="h-7 text-xs w-[135px] border-none bg-transparent shadow-none"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                />
                <Button
                  variant={closingDate === todayDateStr ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => setClosingDate(todayDateStr)}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setClosingDate(d.toISOString().split("T")[0]);
                  }}
                >
                  Yesterday
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintPreviewOpen(true)}
                className="h-8 text-xs font-medium flex items-center gap-1.5 bg-background shadow-xs hover:bg-muted"
                title="Print or preview closing report"
              >
                <Printer className="w-3.5 h-3.5 text-primary" />
                <span>Print / Preview</span>
              </Button>

              {canClose && (
                <Button
                  size="sm"
                  onClick={() => {
                    setClosingTargetDate(closingDate || todayDateStr);
                    setClosingModalOpen(true);
                  }}
                  className="h-8 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Perform Closing</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          2. INCOME DETAILS SECTION (NESTED SUB-TABLES BENEATH EACH ROW)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card className="border border-border/70 shadow-xs bg-slate-50/50 dark:bg-slate-900/40">
        <CardHeader className="p-3 sm:p-4 pb-2.5 sm:pb-3 flex flex-row items-center justify-between border-b">
          <div className="space-y-0.5">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              1. Income Details
            </CardTitle>
            <CardDescription className="text-[11px] sm:text-xs">
              Fee collections and direct revenue with itemized breakdowns directly beneath each sector
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-[11px] sm:text-xs text-muted-foreground mr-1.5">Total Income:</span>
            <span className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
              PKR {totalIncome.toLocaleString()}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto min-w-0">
            <Table className="w-full text-xs">
              <TableHeader>
                <TableRow className="bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-100/90 border-b text-[10.5px] sm:text-[11px]">
                  <TableHead className="w-[50px] text-center py-2 px-2.5">#</TableHead>
                  <TableHead className="py-2 px-3">Income Sector / Particular</TableHead>
                  <TableHead className="w-[120px] text-center py-2 px-2.5">Records</TableHead>
                  <TableHead className="w-[170px] text-right py-2 px-3">Total Amount (PKR)</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {/* ── PARENT ROW 1: STUDENT FEE COLLECTIONS ── */}
                <TableRow
                  onClick={() => toggleIncomeRow("fee")}
                  className={`cursor-pointer transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-semibold ${
                    expandedIncomeRows.has("fee") ? "bg-slate-100/50 dark:bg-slate-800/40" : ""
                  }`}
                >
                  <TableCell className="py-2.5 px-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 font-medium">
                      {expandedIncomeRows.has("fee") ? (
                        <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs">1</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-foreground text-xs sm:text-sm">Student Fee Collections</span>
                    </div>
                    <div className="text-[10px] sm:text-[10.5px] font-normal text-muted-foreground mt-0.5">
                      Tuition, extra, and hostel fee payments received on this date
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 px-2.5 text-center">
                    <Badge variant="outline" className="text-[10px] sm:text-[10.5px] font-mono py-0.5 px-2">
                      {feeCollectionDetails.length} {feeCollectionDetails.length === 1 ? "Challan" : "Challans"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                    PKR {feeCollectionTotal.toLocaleString()}
                  </TableCell>
                </TableRow>

                {/* ── CHILD SUB-TABLE DIRECTLY BENEATH ROW 1 (FEE CHALLANS) ── */}
                {expandedIncomeRows.has("fee") && (
                  <TableRow className="bg-slate-100/60 dark:bg-slate-900/60 hover:bg-slate-100/60 border-b border-border/60">
                    <TableCell colSpan={4} className="p-0">
                      <div className="py-2 px-2 sm:px-4 pl-4 sm:pl-8 border-t border-dashed border-border/60 bg-slate-100/40 dark:bg-slate-900/40">
                        <div className="overflow-x-auto min-w-0">
                          <Table className="w-full min-w-[700px] text-[10.5px] sm:text-xs bg-slate-50/70 dark:bg-slate-950/40 rounded border border-border/40">
                            <TableHeader>
                              <TableRow className="bg-slate-200/60 dark:bg-slate-800/70 hover:bg-slate-200/60 border-b border-border/50 text-[10px] sm:text-[10.5px]">
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[36px] text-center">#</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[95px] whitespace-nowrap">Challan #</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground min-w-[170px] sm:min-w-[190px]">Student Details</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground text-right whitespace-nowrap">Base (PKR)</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground text-right whitespace-nowrap">Heads (PKR)</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground text-right whitespace-nowrap">Late Fee</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground text-right whitespace-nowrap">Gross</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-emerald-600 dark:text-emerald-400 font-bold text-right whitespace-nowrap">Paid (PKR)</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground whitespace-nowrap">Deposit Account</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {feeCollectionDetails.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={9} className="text-center py-3.5 text-xs text-muted-foreground italic">
                                    No fee collections recorded for this closing date.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                feeCollectionDetails.map((c, idx) => (
                                  <TableRow key={c.id || idx} className="hover:bg-slate-200/40 dark:hover:bg-slate-800/50 border-b border-border/30 text-[10.5px] sm:text-xs">
                                    <TableCell className="text-center font-mono py-1.5 px-2 text-muted-foreground">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="font-mono font-bold py-1.5 px-2 whitespace-nowrap">
                                      #{c.challanNo}
                                      {c.type !== "Tuition Challan" && (
                                        <Badge variant="outline" className="text-[8.5px] py-0 px-1 ml-1 uppercase">
                                          {c.type}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 min-w-[170px]">
                                      <div className="font-semibold text-foreground text-[11px] sm:text-xs leading-tight">
                                        {c.studentName}
                                      </div>
                                      <div className="text-[10px] sm:text-[10.5px] text-muted-foreground leading-tight mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                        <span className="whitespace-nowrap">Father: {c.fatherName}</span>
                                        <span className="font-mono font-semibold text-primary whitespace-nowrap">({c.rollNumber})</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                                      {Number(c.baseAmount || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                                      {Number(getHeadsAmount(c) || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-2 text-amber-600 whitespace-nowrap">
                                      {Number(c.lateFeeFine || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-2 whitespace-nowrap">
                                      {Number(c.totalAmount || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-1.5 px-2 whitespace-nowrap">
                                      PKR {Number(c.paidAmount || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap">
                                      <Badge variant="secondary" className="text-[9.5px] font-mono py-0 px-1.5">
                                        {c.walletName || "Cash in Hand"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* ── PARENT ROW 2: OTHER REVENUE & DIRECT RECEIPTS ── */}
                <TableRow
                  onClick={() => toggleIncomeRow("otherIncome")}
                  className={`cursor-pointer transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-semibold ${
                    expandedIncomeRows.has("otherIncome") ? "bg-slate-100/50 dark:bg-slate-800/40" : ""
                  }`}
                >
                  <TableCell className="py-2.5 px-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 font-medium">
                      {expandedIncomeRows.has("otherIncome") ? (
                        <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs">2</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-foreground text-xs sm:text-sm">Other Revenue &amp; Direct Receipts</span>
                    </div>
                    <div className="text-[10px] sm:text-[10.5px] font-normal text-muted-foreground mt-0.5">
                      Canteen, transport, admissions, donations, and other direct revenues
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono py-2.5 px-2.5">
                    <Badge variant="outline" className="text-[10px] sm:text-[10.5px] font-mono py-0.5 px-2">
                      {otherIncomeDetails.length} {otherIncomeDetails.length === 1 ? "Entry" : "Entries"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                    PKR {otherIncomeTotal.toLocaleString()}
                  </TableCell>
                </TableRow>

                {/* ── CHILD SUB-TABLE DIRECTLY BENEATH ROW 2 (OTHER REVENUE) ── */}
                {expandedIncomeRows.has("otherIncome") && (
                  <TableRow className="bg-slate-100/60 dark:bg-slate-900/60 hover:bg-slate-100/60 border-b border-border/60">
                    <TableCell colSpan={4} className="p-0">
                      <div className="py-2 px-2 sm:px-4 pl-4 sm:pl-8 border-t border-dashed border-border/60 bg-slate-100/40 dark:bg-slate-900/40">
                        <div className="overflow-x-auto min-w-0">
                          <Table className="w-full min-w-[700px] text-[10.5px] sm:text-xs bg-slate-50/70 dark:bg-slate-950/40 rounded border border-border/40">
                            <TableHeader>
                              <TableRow className="bg-slate-200/60 dark:bg-slate-800/70 hover:bg-slate-200/60 border-b border-border/50 text-[10px] sm:text-[10.5px]">
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[36px] text-center">#</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[120px] whitespace-nowrap">Category</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground min-w-[160px]">Description / Remarks</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[110px] whitespace-nowrap">Source / Reference</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[110px] whitespace-nowrap">Deposit Account</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-emerald-600 dark:text-emerald-400 font-bold w-[110px] text-right whitespace-nowrap">Amount (PKR)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {otherIncomeDetails.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={6} className="text-center py-3.5 text-xs text-muted-foreground italic">
                                    No other revenue recorded for this closing date.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                otherIncomeDetails.map((inc, idx) => (
                                  <TableRow key={inc.id || idx} className="hover:bg-slate-200/40 dark:hover:bg-slate-800/50 border-b border-border/30 text-[10.5px] sm:text-xs">
                                    <TableCell className="text-center font-mono py-1.5 px-2 text-muted-foreground">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap">
                                      <Badge variant="outline" className="text-[9.5px]">
                                        {inc.category} {inc.subCategory ? `(${inc.subCategory})` : ""}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 font-medium text-foreground min-w-[160px]">
                                      {inc.remarks || inc.title || "—"}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 text-muted-foreground whitespace-nowrap text-[10px] sm:text-[11px]">
                                      {inc.source || "Direct Receipt"}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap">
                                      <Badge variant="secondary" className="text-[9.5px] font-mono py-0 px-1.5">
                                        {inc.walletName || "Cash in Hand"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-1.5 px-2 whitespace-nowrap">
                                      PKR {Number(inc.amount || 0).toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* ── TOTAL INCOME HIGHLIGHT ROW ── */}
                <TableRow className="bg-slate-100/90 dark:bg-slate-800/80 font-bold border-t">
                  <TableCell colSpan={3} className="text-right py-2 px-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-foreground">
                    Total Income:
                  </TableCell>
                  <TableCell className="text-right font-mono py-2 px-3 text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    PKR {totalIncome.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          3. EXPENSE DETAILS SECTION (NESTED SUB-TABLES BENEATH EACH ROW)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card className="border border-border/70 shadow-xs bg-slate-50/50 dark:bg-slate-900/40">
        <CardHeader className="p-3 sm:p-4 pb-2.5 sm:pb-3 flex flex-row items-center justify-between border-b">
          <div className="space-y-0.5">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              2. Expense Details
            </CardTitle>
            <CardDescription className="text-[11px] sm:text-xs">
              Staff payroll and general operational expenditures with itemized breakdowns directly beneath each sector
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-[11px] sm:text-xs text-muted-foreground mr-1.5">Total Expenses:</span>
            <span className="text-xs sm:text-sm font-mono font-bold text-rose-600 dark:text-rose-400">
              PKR {totalExpenses.toLocaleString()}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto min-w-0">
            <Table className="w-full text-xs">
              <TableHeader>
                <TableRow className="bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-100/90 border-b text-[10.5px] sm:text-[11px]">
                  <TableHead className="w-[50px] text-center py-2 px-2.5">#</TableHead>
                  <TableHead className="py-2 px-3">Expense Sector / Particular</TableHead>
                  <TableHead className="w-[120px] text-center py-2 px-2.5">Records</TableHead>
                  <TableHead className="w-[170px] text-right py-2 px-3">Total Amount (PKR)</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {/* ── PARENT ROW 1: STAFF PAYROLL & SALARIES ── */}
                <TableRow
                  onClick={() => toggleExpenseRow("payroll")}
                  className={`cursor-pointer transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-semibold ${
                    expandedExpenseRows.has("payroll") ? "bg-slate-100/50 dark:bg-slate-800/40" : ""
                  }`}
                >
                  <TableCell className="py-2.5 px-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 font-medium">
                      {expandedExpenseRows.has("payroll") ? (
                        <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs">1</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="font-bold text-foreground text-xs sm:text-sm">Staff Payroll &amp; Salaries</span>
                    </div>
                    <div className="text-[10px] sm:text-[10.5px] font-normal text-muted-foreground mt-0.5">
                      Monthly teaching &amp; administrative staff salaries disbursed on this date
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono py-2.5 px-2.5">
                    <Badge variant="outline" className="text-[10px] sm:text-[10.5px] font-mono py-0.5 px-2">
                      {payrollDetails.length} {payrollDetails.length === 1 ? "Staff" : "Staff"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                    PKR {payrollTotal.toLocaleString()}
                  </TableCell>
                </TableRow>

                {/* ── CHILD SUB-TABLE DIRECTLY BENEATH ROW 1 (PAYROLL RECORDS) ── */}
                {expandedExpenseRows.has("payroll") && (
                  <TableRow className="bg-slate-100/60 dark:bg-slate-900/60 hover:bg-slate-100/60 border-b border-border/60">
                    <TableCell colSpan={4} className="p-0">
                      <div className="py-2 px-2 sm:px-4 pl-4 sm:pl-8 border-t border-dashed border-border/60 bg-slate-100/40 dark:bg-slate-900/40">
                        <div className="overflow-x-auto min-w-0">
                          <Table className="w-full min-w-[700px] text-[10.5px] sm:text-xs bg-slate-50/70 dark:bg-slate-950/40 rounded border border-border/40">
                            <TableHeader>
                              <TableRow className="bg-slate-200/60 dark:bg-slate-800/70 hover:bg-slate-200/60 border-b border-border/50 text-[10px] sm:text-[10.5px]">
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[36px] text-center">#</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground min-w-[170px] sm:min-w-[190px]">Teacher / Staff Details</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[85px] whitespace-nowrap">Month</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground text-right whitespace-nowrap">Payable (PKR)</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-rose-600 text-right whitespace-nowrap">Deductions (PKR)</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-emerald-600 text-right whitespace-nowrap">Allowances (PKR)</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-rose-600 dark:text-rose-400 font-bold text-right whitespace-nowrap">Net Paid (PKR)</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground whitespace-nowrap">Disbursed Account</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {payrollDetails.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={8} className="text-center py-3.5 text-xs text-muted-foreground italic">
                                    No payroll disbursements recorded for this closing date.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                payrollDetails.map((p, idx) => (
                                  <TableRow key={p.id || idx} className="hover:bg-slate-200/40 dark:hover:bg-slate-800/50 border-b border-border/30 text-[10.5px] sm:text-xs">
                                    <TableCell className="text-center font-mono py-1.5 px-2 text-muted-foreground">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 min-w-[170px]">
                                      <div className="font-semibold text-foreground text-[11px] sm:text-xs leading-tight">
                                        {p.staffName}
                                      </div>
                                      <div className="text-[10px] sm:text-[10.5px] text-muted-foreground leading-tight mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                        <span className="whitespace-nowrap">Father: {p.fatherName}</span>
                                        <span className="font-mono font-semibold text-primary whitespace-nowrap">(ID: {p.employeeId})</span>
                                        <span className="text-[9.5px] text-muted-foreground truncate max-w-[120px]">• {p.designation}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 text-muted-foreground font-mono whitespace-nowrap text-[10px] sm:text-[11px]">
                                      {p.month || "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                                      {Number(p.payable || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-2 text-rose-600 whitespace-nowrap">
                                      {Number(p.deductions || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5 px-2 text-emerald-600 whitespace-nowrap">
                                      {Number(p.allowance || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-rose-600 dark:text-rose-400 py-1.5 px-2 whitespace-nowrap">
                                      PKR {Number(p.totalAmount || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap">
                                      <Badge variant="secondary" className="text-[9.5px] font-mono py-0 px-1.5">
                                        {p.walletName || "Cash in Hand"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* ── PARENT ROW 2: OTHER OPERATING EXPENSES ── */}
                <TableRow
                  onClick={() => toggleExpenseRow("otherExpense")}
                  className={`cursor-pointer transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-semibold ${
                    expandedExpenseRows.has("otherExpense") ? "bg-slate-100/50 dark:bg-slate-800/40" : ""
                  }`}
                >
                  <TableCell className="py-2.5 px-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 font-medium">
                      {expandedExpenseRows.has("otherExpense") ? (
                        <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs">2</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="font-bold text-foreground text-xs sm:text-sm">Other Operating Expenses</span>
                    </div>
                    <div className="text-[10px] sm:text-[10.5px] font-normal text-muted-foreground mt-0.5">
                      Administrative, utilities, maintenance, inventory purchases, and hostel operations
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono py-2.5 px-2.5">
                    <Badge variant="outline" className="text-[10px] sm:text-[10.5px] font-mono py-0.5 px-2">
                      {otherExpenseDetails.length} {otherExpenseDetails.length === 1 ? "Voucher" : "Vouchers"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                    PKR {otherExpenseTotal.toLocaleString()}
                  </TableCell>
                </TableRow>

                {/* ── CHILD SUB-TABLE DIRECTLY BENEATH ROW 2 (OTHER EXPENSES) ── */}
                {expandedExpenseRows.has("otherExpense") && (
                  <TableRow className="bg-slate-100/60 dark:bg-slate-900/60 hover:bg-slate-100/60 border-b border-border/60">
                    <TableCell colSpan={4} className="p-0">
                      <div className="py-2 px-2 sm:px-4 pl-4 sm:pl-8 border-t border-dashed border-border/60 bg-slate-100/40 dark:bg-slate-900/40">
                        <div className="overflow-x-auto min-w-0">
                          <Table className="w-full min-w-[700px] text-[10.5px] sm:text-xs bg-slate-50/70 dark:bg-slate-950/40 rounded border border-border/40">
                            <TableHeader>
                              <TableRow className="bg-slate-200/60 dark:bg-slate-800/70 hover:bg-slate-200/60 border-b border-border/50 text-[10px] sm:text-[10.5px]">
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[36px] text-center">#</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[120px] whitespace-nowrap">Category</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground min-w-[160px]">Description / Purpose</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[90px] whitespace-nowrap">Voucher #</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[120px] whitespace-nowrap">Vendor / Payee</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[110px] whitespace-nowrap">Paid From Account</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-rose-600 dark:text-rose-400 font-bold w-[110px] text-right whitespace-nowrap">Amount (PKR)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {otherExpenseDetails.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={7} className="text-center py-3.5 text-xs text-muted-foreground italic">
                                    No operating expenses recorded for this closing date.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                otherExpenseDetails.map((exp, idx) => (
                                  <TableRow key={exp.id || idx} className="hover:bg-slate-200/40 dark:hover:bg-slate-800/50 border-b border-border/30 text-[10.5px] sm:text-xs">
                                    <TableCell className="text-center font-mono py-1.5 px-2 text-muted-foreground">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap">
                                      <Badge variant="outline" className="text-[9.5px]">
                                        {exp.category} {exp.subCategory ? `(${exp.subCategory})` : ""}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 font-medium text-foreground min-w-[160px]">
                                      {exp.remarks || exp.title || "—"}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 font-mono text-muted-foreground whitespace-nowrap text-[10px] sm:text-[11px]">
                                      #{exp.voucherNo}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 text-muted-foreground whitespace-nowrap text-[10px] sm:text-[11px]">
                                      {exp.vendor || "—"}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap">
                                      <Badge variant="secondary" className="text-[9.5px] font-mono py-0 px-1.5">
                                        {exp.walletName || "Cash in Hand"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-rose-600 dark:text-rose-400 py-1.5 px-2 whitespace-nowrap">
                                      PKR {Number(exp.amount || 0).toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* ── TOTAL EXPENSES HIGHLIGHT ROW ── */}
                <TableRow className="bg-slate-100/90 dark:bg-slate-800/80 font-bold border-t">
                  <TableCell colSpan={3} className="text-right py-2 px-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-foreground">
                    Total Expenses:
                  </TableCell>
                  <TableCell className="text-right font-mono py-2 px-3 text-xs sm:text-sm font-extrabold text-rose-600 dark:text-rose-400">
                    PKR {totalExpenses.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          4. FINANCIAL SUMMARY & TREASURY RECONCILIATION
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card className="border border-border/70 shadow-xs bg-slate-50/50 dark:bg-slate-900/40">
        <CardHeader className="p-3 sm:p-4 pb-2.5 sm:pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                <Landmark className="w-4 h-4 text-primary" />
                3. Financial Summary &amp; Treasury Reconciliation
              </CardTitle>
              <CardDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Total daily income, total daily expenses, and net cash holdings for {formatReportDate(closingDate || todayDateStr)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10.5px] sm:text-xs font-mono bg-background">
                Date: {closingDate || todayDateStr}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4 space-y-4">
          {/* 3 Summary Cards Matching App Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Income */}
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] sm:text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Total Income
                </span>
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="text-lg sm:text-xl md:text-2xl font-mono font-extrabold text-emerald-700 dark:text-emerald-300 mt-1.5">
                PKR {totalIncome.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 truncate">
                Fee: PKR {feeCollectionTotal.toLocaleString()} + Other: PKR {otherIncomeTotal.toLocaleString()}
              </div>
            </div>

            {/* Total Expenses */}
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] sm:text-xs font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                  Total Expenses
                </span>
                <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
              <div className="text-lg sm:text-xl md:text-2xl font-mono font-extrabold text-rose-700 dark:text-rose-300 mt-1.5">
                PKR {totalExpenses.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 truncate">
                Payroll: PKR {payrollTotal.toLocaleString()} + Other: PKR {otherExpenseTotal.toLocaleString()}
              </div>
            </div>

            {/* Net Balance / Cash in Hand */}
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] sm:text-xs font-semibold text-primary uppercase tracking-wider">
                  Cash in Hand / Net
                </span>
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <WalletIcon className="w-3.5 h-3.5 text-primary" />
                </div>
              </div>
              <div className="text-lg sm:text-xl md:text-2xl font-mono font-extrabold text-foreground mt-1.5">
                PKR {netBalance.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 truncate">
                Net operational cashflow for this date
              </div>
            </div>
          </div>

          {/* Treasury Accounts & Wallets Holding Table */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                  <WalletIcon className="w-3.5 h-3.5 text-primary" />
                  Treasury Accounts &amp; Wallets Holding on {formatReportDate(closingDate || todayDateStr)}
                </h3>
                <p className="text-[10.5px] sm:text-xs text-muted-foreground">
                  Strictly itemized for inflows, outflows, and net holding registered on this date
                </p>
              </div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Reconciled 100%</span>
              </div>
            </div>

            <Card className="border border-border/70 shadow-xs overflow-hidden bg-slate-50/70 dark:bg-slate-950/40">
              <div className="overflow-x-auto min-w-0">
                <Table className="w-full min-w-[650px] text-[10.5px] sm:text-xs">
                  <TableHeader>
                    <TableRow className="bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-100/90 border-b border-border/50 text-[10px] sm:text-[10.5px]">
                      <TableHead className="w-[45px] text-center py-2 px-2.5">#</TableHead>
                      <TableHead className="py-2 px-2.5">Account / Wallet Name</TableHead>
                      <TableHead className="w-[120px] py-2 px-2.5">Type</TableHead>
                      <TableHead className="text-right text-emerald-600 dark:text-emerald-400 w-[150px] whitespace-nowrap py-2 px-2.5">Date Inflow (+)</TableHead>
                      <TableHead className="text-right text-rose-600 dark:text-rose-400 w-[150px] whitespace-nowrap py-2 px-2.5">Date Outflow (-)</TableHead>
                      <TableHead className="text-right font-bold w-[170px] whitespace-nowrap py-2 px-2.5">Date Net Holding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletsDateBreakdown.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground italic">
                          No active wallet accounts found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      walletsDateBreakdown.map((w, idx) => (
                        <TableRow key={w.walletId || idx} className="hover:bg-slate-200/40 dark:hover:bg-slate-800/50 border-b border-border/30 text-[10.5px] sm:text-xs">
                          <TableCell className="text-center font-mono py-1.5 px-2.5 text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-foreground py-1.5 px-2.5">
                            {w.walletName}
                            {w.accountNumber && (
                              <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground ml-1.5 whitespace-nowrap">
                                (#{w.accountNumber})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5 px-2.5">
                            <Badge variant="outline" className="text-[9px] uppercase font-mono">
                              {w.walletType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 py-1.5 px-2.5 whitespace-nowrap">
                            +{Number(w.dateInflow || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400 py-1.5 px-2.5 whitespace-nowrap">
                            -{Number(w.dateOutflow || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold py-1.5 px-2.5 whitespace-nowrap">
                            {w.dateNetBalance >= 0 ? "+" : ""}PKR {Number(w.dateNetBalance || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {/* Total Reconciliation Row */}
                    <TableRow className="bg-slate-100/90 dark:bg-slate-800/80 font-bold border-t text-[10.5px] sm:text-xs">
                      <TableCell colSpan={3} className="text-right uppercase tracking-wider text-foreground py-2 px-2.5">
                        Total Reconciliation:
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-2 px-2.5 whitespace-nowrap">
                        +PKR {walletsSumInflow.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-600 dark:text-rose-400 py-2 px-2.5 whitespace-nowrap">
                        -PKR {walletsSumOutflow.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-extrabold text-foreground py-2 px-2.5 whitespace-nowrap">
                        {walletsSumNet >= 0 ? "+" : ""}PKR {walletsSumNet.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-[11px] sm:text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                <strong>Reconciliation Verified:</strong> Sum of wallet inflows (PKR {walletsSumInflow.toLocaleString()}) and outflows (PKR {walletsSumOutflow.toLocaleString()}) match the day's Total Income and Total Expenses exactly.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          5. CLOSING CHECKPOINTS HISTORY & MANAGEMENT
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card className="border border-border/70 shadow-xs bg-slate-50/50 dark:bg-slate-900/40">
        <CardHeader
          className="p-3 sm:p-3.5 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors flex flex-row items-center justify-between"
          onClick={() => setShowHistory((prev) => !prev)}
        >
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <CardTitle className="text-xs sm:text-sm font-semibold">
              Historical Closing Checkpoints &amp; Audit Log
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {closingsHistory.length} checkpoints
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{showHistory ? "Hide Checkpoints" : "View Checkpoints"}</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent className="p-3 sm:p-3.5 pt-0">
            <div className="overflow-x-auto min-w-0 border rounded-md">
              <Table className="w-full min-w-[700px] text-[10.5px] sm:text-xs">
                <TableHeader>
                  <TableRow className="bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-100/90 border-b text-[10px] sm:text-[10.5px]">
                    <TableHead className="py-2 px-2.5 whitespace-nowrap">Date &amp; Time</TableHead>
                    <TableHead className="py-2 px-2.5 text-right whitespace-nowrap">Total Holding</TableHead>
                    <TableHead className="py-2 px-2.5 text-emerald-600 dark:text-emerald-400 text-right whitespace-nowrap">Inflows</TableHead>
                    <TableHead className="py-2 px-2.5 text-rose-600 dark:text-rose-400 text-right whitespace-nowrap">Outflows</TableHead>
                    <TableHead className="py-2 px-2.5 text-right whitespace-nowrap">Net Change</TableHead>
                    <TableHead className="py-2 px-2.5 whitespace-nowrap">Closed By</TableHead>
                    <TableHead className="py-2 px-2.5">Remarks</TableHead>
                    <TableHead className="py-2 px-2.5 text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isHistoryLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-xs text-muted-foreground">
                        Loading checkpoints...
                      </TableCell>
                    </TableRow>
                  ) : closingsHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-xs text-muted-foreground italic">
                        No closing checkpoints found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    closingsHistory.map((c) => (
                      <TableRow key={c._id || c.id} className="hover:bg-slate-200/40 dark:hover:bg-slate-800/50 border-b border-border/30 text-[10.5px] sm:text-xs">
                        <TableCell className="py-1.5 px-2.5 font-mono whitespace-nowrap">
                          {formatDateTime(c.closingDateTime || c.date)}
                        </TableCell>
                        <TableCell className="py-1.5 px-2.5 text-right font-mono font-bold whitespace-nowrap">
                          PKR {Number(c.totalHolding || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-1.5 px-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          +PKR {Number(c.totalInflows || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-1.5 px-2.5 text-right font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          -PKR {Number(c.totalOutflows || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-1.5 px-2.5 text-right font-mono font-semibold whitespace-nowrap">
                          {Number(c.netChange || 0) >= 0 ? "+" : ""}
                          PKR {Number(c.netChange || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-1.5 px-2.5 text-muted-foreground whitespace-nowrap">
                          {c.closedByName || "Admin"}
                        </TableCell>
                        <TableCell className="py-1.5 px-2.5 text-muted-foreground italic truncate max-w-[150px]">
                          {c.remarks || "—"}
                        </TableCell>
                        <TableCell className="py-1.5 px-2.5 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteConfirm({ open: true, id: c._id || c.id })}
                            title="Delete closing record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          6. PRINT PREVIEW MODAL
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2 font-bold">
                <Printer className="w-5 h-5 text-primary" />
                Print Preview: Daily Income &amp; Expense Report
              </DialogTitle>
              <Button size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </Button>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Verify report branding, figures, and itemized sub-tables directly beneath each sector.
            </DialogDescription>
          </DialogHeader>

          {/* Printable Document Box */}
          <div className="p-4 sm:p-6 bg-white text-slate-900 border rounded-lg shadow-sm space-y-4 my-2 text-xs">
            {/* Header with Branding */}
            <div className="flex items-center justify-between border-b-2 border-orange-600 pb-3 gap-4">
              <img src="/logo.png" alt="Concordia College" className="h-14 w-auto object-contain" />
              <div className="text-center flex-1">
                <div className="text-base font-extrabold tracking-wide uppercase text-slate-900">
                  Concordia College Peshawar
                </div>
                <div
                  className="text-2xl font-serif italic font-bold text-orange-600 my-0.5"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  Daily Income &amp; Expense Report
                </div>
                <div className="text-xs text-slate-600 font-semibold">
                  Session: {activeSessionName} &nbsp;|&nbsp; Report Date: {formatReportDate(closingDate || todayDateStr)}
                </div>
              </div>
              <div className="w-14" />
            </div>

            {/* Income Section with Nested Child Tables */}
            <div className="space-y-2">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-900 border-b pb-1">
                1. Income Details
              </div>

              <table className="w-full border-collapse border border-slate-600 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-[11px]">
                    <th className="border border-slate-500 p-1.5 text-center w-10">S.No</th>
                    <th className="border border-slate-500 p-1.5 text-left">Income Sector / Particular</th>
                    <th className="border border-slate-500 p-1.5 text-center w-28">Records</th>
                    <th className="border border-slate-500 p-1.5 text-right w-36">Total Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Parent Row 1 */}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-500 p-1.5 text-center font-mono">1</td>
                    <td className="border border-slate-500 p-1.5"><strong>Student Fee Collections</strong></td>
                    <td className="border border-slate-500 p-1.5 text-center font-mono">{feeCollectionDetails.length} Challans</td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono font-bold text-emerald-700">
                      {feeCollectionTotal.toLocaleString()}
                    </td>
                  </tr>
                  {/* Child Row 1 */}
                  <tr>
                    <td colSpan={4} className="border border-slate-500 p-2 bg-white">
                      <table className="w-full border-collapse border border-slate-500 text-[10px]">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-400 p-1 text-center w-8">#</th>
                            <th className="border border-slate-400 p-1 text-left w-20">Challan #</th>
                            <th className="border border-slate-400 p-1 text-left">Student Details</th>
                            <th className="border border-slate-400 p-1 text-right w-16">Base (Rs.)</th>
                            <th className="border border-slate-400 p-1 text-right w-16">Heads (Rs.)</th>
                            <th className="border border-slate-400 p-1 text-right w-16">Late Fee</th>
                            <th className="border border-slate-400 p-1 text-right w-16">Gross</th>
                            <th className="border border-slate-400 p-1 text-right w-20 text-emerald-700 font-bold">Paid (Rs.)</th>
                            <th className="border border-slate-400 p-1 text-left w-24">Account</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feeCollectionDetails.length === 0 ? (
                            <tr><td colSpan={9} className="border border-slate-400 p-1.5 text-center text-slate-500 italic">No fee collections recorded.</td></tr>
                          ) : (
                            feeCollectionDetails.map((c, idx) => (
                              <tr key={idx}>
                                <td className="border border-slate-400 p-1 text-center font-mono">{idx + 1}</td>
                                <td className="border border-slate-400 p-1 font-mono">#{c.challanNo}</td>
                                <td className="border border-slate-400 p-1"><strong>{c.studentName}</strong> <span className="text-slate-600">(Father: {c.fatherName || "—"}, Roll: {c.rollNumber || "—"})</span></td>
                                <td className="border border-slate-400 p-1 text-right font-mono">{Number(c.baseAmount || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono">{Number(getHeadsAmount(c) || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono">{Number(c.lateFeeFine || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono">{Number(c.totalAmount || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono font-bold text-emerald-700">{Number(c.paidAmount || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-[9px]">{c.walletName || "Cash in Hand"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Parent Row 2 */}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-500 p-1.5 text-center font-mono">2</td>
                    <td className="border border-slate-500 p-1.5"><strong>Other Revenue &amp; Direct Receipts</strong></td>
                    <td className="border border-slate-500 p-1.5 text-center font-mono">{otherIncomeDetails.length} Entries</td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono font-bold text-emerald-700">
                      {otherIncomeTotal.toLocaleString()}
                    </td>
                  </tr>
                  {/* Child Row 2 */}
                  <tr>
                    <td colSpan={4} className="border border-slate-500 p-2 bg-white">
                      <table className="w-full border-collapse border border-slate-500 text-[10px]">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-400 p-1 text-center w-8">#</th>
                            <th className="border border-slate-400 p-1 text-left w-28">Category</th>
                            <th className="border border-slate-400 p-1 text-left">Description / Remarks</th>
                            <th className="border border-slate-400 p-1 text-left w-24">Source / Ref</th>
                            <th className="border border-slate-400 p-1 text-left w-24">Account</th>
                            <th className="border border-slate-400 p-1 text-right w-20 text-emerald-700 font-bold">Amount (Rs.)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {otherIncomeDetails.length === 0 ? (
                            <tr><td colSpan={6} className="border border-slate-400 p-1.5 text-center text-slate-500 italic">No other revenue recorded.</td></tr>
                          ) : (
                            otherIncomeDetails.map((inc, idx) => (
                              <tr key={idx}>
                                <td className="border border-slate-400 p-1 text-center font-mono">{idx + 1}</td>
                                <td className="border border-slate-400 p-1 font-semibold">{inc.category}</td>
                                <td className="border border-slate-400 p-1">{inc.remarks || inc.title}</td>
                                <td className="border border-slate-400 p-1">{inc.source || "Direct Receipt"}</td>
                                <td className="border border-slate-400 p-1 text-[9px]">{inc.walletName || "Cash in Hand"}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono font-bold text-emerald-700">{Number(inc.amount || 0).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Total Income Row */}
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={3} className="border border-slate-500 p-1.5 text-right uppercase">
                      Total Income:
                    </td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono text-emerald-700 font-extrabold">
                      Rs. {totalIncome.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expense Section with Nested Child Tables */}
            <div className="space-y-2 pt-2">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-900 border-b pb-1">
                2. Expense Details
              </div>

              <table className="w-full border-collapse border border-slate-600 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-[11px]">
                    <th className="border border-slate-500 p-1.5 text-center w-10">S.No</th>
                    <th className="border border-slate-500 p-1.5 text-left">Expense Sector / Particular</th>
                    <th className="border border-slate-500 p-1.5 text-center w-28">Records</th>
                    <th className="border border-slate-500 p-1.5 text-right w-36">Total Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Parent Row 1 */}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-500 p-1.5 text-center font-mono">1</td>
                    <td className="border border-slate-500 p-1.5"><strong>Staff Payroll &amp; Salaries</strong></td>
                    <td className="border border-slate-500 p-1.5 text-center font-mono">{payrollDetails.length} Staff</td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono font-bold text-rose-700">
                      {payrollTotal.toLocaleString()}
                    </td>
                  </tr>
                  {/* Child Row 1 */}
                  <tr>
                    <td colSpan={4} className="border border-slate-500 p-2 bg-white">
                      <table className="w-full border-collapse border border-slate-500 text-[10px]">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-400 p-1 text-center w-8">#</th>
                            <th className="border border-slate-400 p-1 text-left">Staff Details</th>
                            <th className="border border-slate-400 p-1 text-left w-16">Month</th>
                            <th className="border border-slate-400 p-1 text-right w-16">Payable (Rs.)</th>
                            <th className="border border-slate-400 p-1 text-right w-16">Deductions (Rs.)</th>
                            <th className="border border-slate-400 p-1 text-right w-16">Allowances (Rs.)</th>
                            <th className="border border-slate-400 p-1 text-right w-20 text-rose-700 font-bold">Net Paid (Rs.)</th>
                            <th className="border border-slate-400 p-1 text-left w-24">Account</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollDetails.length === 0 ? (
                            <tr><td colSpan={8} className="border border-slate-400 p-1.5 text-center text-slate-500 italic">No payroll disbursements recorded.</td></tr>
                          ) : (
                            payrollDetails.map((p, idx) => (
                              <tr key={idx}>
                                <td className="border border-slate-400 p-1 text-center font-mono">{idx + 1}</td>
                                <td className="border border-slate-400 p-1"><strong>{p.staffName}</strong> <span className="text-slate-600">(Father: {p.fatherName || "—"}, ID: {p.employeeId || "—"}{p.designation ? `, ${p.designation}` : ""})</span></td>
                                <td className="border border-slate-400 p-1">{p.month || "—"}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono">{Number(p.payable || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono">{Number(p.deductions || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono">{Number(p.allowance || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono font-bold text-rose-700">{Number(p.totalAmount || 0).toLocaleString()}</td>
                                <td className="border border-slate-400 p-1 text-[9px]">{p.walletName || "Cash in Hand"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Parent Row 2 */}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-500 p-1.5 text-center font-mono">2</td>
                    <td className="border border-slate-500 p-1.5"><strong>Other Operating Expenses</strong></td>
                    <td className="border border-slate-500 p-1.5 text-center font-mono">{otherExpenseDetails.length} Vouchers</td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono font-bold text-rose-700">
                      {otherExpenseTotal.toLocaleString()}
                    </td>
                  </tr>
                  {/* Child Row 2 */}
                  <tr>
                    <td colSpan={4} className="border border-slate-500 p-2 bg-white">
                      <table className="w-full border-collapse border border-slate-500 text-[10px]">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-400 p-1 text-center w-8">#</th>
                            <th className="border border-slate-400 p-1 text-left w-28">Category</th>
                            <th className="border border-slate-400 p-1 text-left">Description / Purpose</th>
                            <th className="border border-slate-400 p-1 text-left w-16">Voucher #</th>
                            <th className="border border-slate-400 p-1 text-left w-24">Vendor / Payee</th>
                            <th className="border border-slate-400 p-1 text-left w-24">Account</th>
                            <th className="border border-slate-400 p-1 text-right w-20 text-rose-700 font-bold">Amount (Rs.)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {otherExpenseDetails.length === 0 ? (
                            <tr><td colSpan={7} className="border border-slate-400 p-1.5 text-center text-slate-500 italic">No operating expenses recorded.</td></tr>
                          ) : (
                            otherExpenseDetails.map((exp, idx) => (
                              <tr key={idx}>
                                <td className="border border-slate-400 p-1 text-center font-mono">{idx + 1}</td>
                                <td className="border border-slate-400 p-1 font-semibold">{exp.category}</td>
                                <td className="border border-slate-400 p-1">{exp.remarks || exp.title}</td>
                                <td className="border border-slate-400 p-1 font-mono">#{exp.voucherNo}</td>
                                <td className="border border-slate-400 p-1">{exp.vendor || "—"}</td>
                                <td className="border border-slate-400 p-1 text-[9px]">{exp.walletName || "Cash in Hand"}</td>
                                <td className="border border-slate-400 p-1 text-right font-mono font-bold text-rose-700">{Number(exp.amount || 0).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Total Expenses Row */}
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={3} className="border border-slate-500 p-1.5 text-right uppercase">
                      Total Expenses:
                    </td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono text-rose-700 font-extrabold">
                      Rs. {totalExpenses.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 rounded-md border border-slate-400">
              <div>
                <div className="text-[10px] uppercase text-emerald-800 font-bold">Total Income</div>
                <div className="text-base font-mono font-bold text-emerald-700">Rs. {totalIncome.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-rose-800 font-bold">Total Expenses</div>
                <div className="text-base font-mono font-bold text-rose-700">Rs. {totalExpenses.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-orange-800 font-bold">Cash in Hand / Net</div>
                <div className="text-base font-mono font-bold text-orange-600">Rs. {netBalance.toLocaleString()}</div>
              </div>
            </div>

            {/* Wallets on Date */}
            <div className="space-y-1.5">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Treasury Accounts &amp; Wallets Holding on {formatReportDate(closingDate || todayDateStr)}
              </div>
              <table className="w-full border-collapse border border-slate-600 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-[11px]">
                    <th className="border border-slate-500 p-1.5 text-center w-10">S.No</th>
                    <th className="border border-slate-500 p-1.5 text-left">Account</th>
                    <th className="border border-slate-500 p-1.5 text-left w-24">Type</th>
                    <th className="border border-slate-500 p-1.5 text-right w-28 text-emerald-700">Date Inflow (+)</th>
                    <th className="border border-slate-500 p-1.5 text-right w-28 text-rose-700">Date Outflow (-)</th>
                    <th className="border border-slate-500 p-1.5 text-right w-32">Net Holding</th>
                  </tr>
                </thead>
                <tbody>
                  {walletsDateBreakdown.map((w, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-500 p-1.5 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-500 p-1.5 font-semibold">{w.walletName}</td>
                      <td className="border border-slate-500 p-1.5">{w.walletType}</td>
                      <td className="border border-slate-500 p-1.5 text-right font-mono text-emerald-700">
                        +{Number(w.dateInflow || 0).toLocaleString()}
                      </td>
                      <td className="border border-slate-500 p-1.5 text-right font-mono text-rose-700">
                        -{Number(w.dateOutflow || 0).toLocaleString()}
                      </td>
                      <td className="border border-slate-500 p-1.5 text-right font-mono font-bold">
                        {w.dateNetBalance >= 0 ? "+" : ""}Rs. {Number(w.dateNetBalance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={3} className="border border-slate-500 p-1.5 text-right uppercase">Total Reconciliation:</td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono text-emerald-700">+Rs. {walletsSumInflow.toLocaleString()}</td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono text-rose-700">-Rs. {walletsSumOutflow.toLocaleString()}</td>
                    <td className="border border-slate-500 p-1.5 text-right font-mono text-orange-600">Rs. {walletsSumNet.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="flex justify-between pt-8 text-xs text-slate-600">
              <div className="border-t border-slate-800 w-36 text-center pt-1 font-semibold">Prepared By (Accountant)</div>
              <div className="border-t border-slate-800 w-36 text-center pt-1 font-semibold">Verified By (Finance Mgr)</div>
              <div className="border-t border-slate-800 w-36 text-center pt-1 font-semibold">Approved By (Principal)</div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setPrintPreviewOpen(false)}>
              Close
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          7. PERFORM CLOSING MODAL
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={closingModalOpen} onOpenChange={setClosingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Record Financial Closing Checkpoint
            </DialogTitle>
            <DialogDescription className="text-xs">
              Establish a permanent baseline checkpoint for this date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Closing Date</Label>
              <Input
                type="date"
                value={closingTargetDate}
                onChange={(e) => setClosingTargetDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Notes / Remarks (Optional)</Label>
              <Textarea
                placeholder="e.g. End of day reconciliation complete. All cash verified."
                value={closingRemarks}
                onChange={(e) => setClosingRemarks(e.target.value)}
                className="text-xs resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setClosingModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePerformClosing}
              disabled={addClosingMutation.isPending}
            >
              {addClosingMutation.isPending ? "Recording..." : "Confirm & Save Checkpoint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          8. DELETE CONFIRMATION DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => !open && setDeleteConfirm({ open: false, id: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Closing Checkpoint?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will remove the selected closing checkpoint from audit records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm.id && deleteClosingMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Checkpoint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
