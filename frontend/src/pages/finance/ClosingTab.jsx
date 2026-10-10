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
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

const formatReportMonth = (monthValue) => {
  if (!monthValue) return "Current Month";
  try {
    const [y, m] = monthValue.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    if (isNaN(d.getTime())) return String(monthValue);
    return d.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(monthValue);
  }
};

export default function ClosingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate: canClose } = usePermissions("Finance", "closings");

  const todayDateStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const currentMonthStr = useMemo(() => todayDateStr.slice(0, 7), [todayDateStr]);
  const [closingMode, setClosingMode] = useState("DAILY"); // "DAILY" | "MONTHLY"
  const [closingDate, setClosingDate] = useState(() => todayDateStr);
  const [closingMonth, setClosingMonth] = useState(() => currentMonthStr);
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [closingRemarks, setClosingRemarks] = useState("");
  const [closingTargetDate, setClosingTargetDate] = useState(() => todayDateStr);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [showHistory, setShowHistory] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);

  const monthlyRange = useMemo(() => {
    if (!closingMonth) return { dateFrom: "", dateTo: "", monthName: "" };
    const [yearStr, monthStr] = closingMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const lastDay = new Date(year, month, 0).getDate();
    const dateFrom = `${closingMonth}-01`;
    const dateTo = `${closingMonth}-${String(lastDay).padStart(2, "0")}`;
    const monthName = formatReportMonth(closingMonth);
    return { dateFrom, dateTo, monthName };
  }, [closingMonth]);

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
    isFetching: isDashboardFetching,
  } = useQuery({
    queryKey: [
      "financeClosingDashboard",
      closingMode,
      closingMode === "DAILY" ? closingDate : closingMonth,
    ],
    queryFn: () => {
      if (closingMode === "MONTHLY") {
        return getFinanceClosingDashboard({
          dateFrom: monthlyRange.dateFrom,
          dateTo: monthlyRange.dateTo,
        });
      }
      return getFinanceClosingDashboard({
        date: closingDate || undefined,
      });
    },
  });

  const isDataLoading = isDashboardLoading || isDashboardFetching;

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
    queryKey: [
      "financeClosings",
      closingMode,
      closingMode === "DAILY" ? closingDate : closingMonth,
    ],
    queryFn: () => {
      if (closingMode === "MONTHLY") {
        return getFinanceClosings({
          dateFrom: monthlyRange.dateFrom,
          dateTo: monthlyRange.dateTo,
        });
      }
      return getFinanceClosings({
        date: closingDate || undefined,
      });
    },
  });

  const {
    data: allClosings = [],
  } = useQuery({
    queryKey: ["financeClosingsAll"],
    queryFn: () => getFinanceClosings(),
  });

  const closedDatesSet = new Set((allClosings || []).map((c) => c.date));
  const isExactCheckpoint = Boolean(dashboardData?.isExactCheckpoint);

  // Extracted Detailed Data Arrays (only transactions with actual money ledger inflow/outflow)
  const feeCollectionDetails = useMemo(() => {
    return (dashboardData?.feeCollectionDetails || []).filter((c) => {
      const isSettlement = c.receiptType === 'ADVANCE_SETTLEMENT' || c.receiptType === 'ARREARS_SETTLEMENT' || c.paymentMode === 'Advance Credit' || c.paymentMode === 'Arrears Transfer';
      const isZeroPaid = Number(c.paidAmount || 0) <= 0;
      return !(isSettlement || isZeroPaid);
    });
  }, [dashboardData]);
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
    const isDaily = closingMode === "DAILY";
    const reportTitle = isDaily ? "Daily Income & Expense Report" : "Monthly Income & Expense Report";
    const reportPeriodText = isDaily
      ? `Report Date: ${formatReportDate(closingDate || todayDateStr)}`
      : `Period: ${monthlyRange.monthName} (${formatReportDate(monthlyRange.dateFrom)} – ${formatReportDate(monthlyRange.dateTo)})`;

    const hasFee = feeCollectionDetails.length > 0;
    const hasOtherIncome = otherIncomeDetails.length > 0;
    const hasIncome = hasFee || hasOtherIncome;

    const hasPayroll = payrollDetails.length > 0;
    const hasOtherExpense = otherExpenseDetails.length > 0;
    const hasExpense = hasPayroll || hasOtherExpense;

    let sectionIndex = 1;

    // Income section HTML (hidden if no income data)
    let incomeSectionHtml = "";
    if (hasIncome) {
      let incomeRowsHtml = "";
      let sNoInc = 1;

      if (hasFee) {
        incomeRowsHtml += `
          <tr class="parent-row">
            <td class="text-center font-mono">${sNoInc++}</td>
            <td>Student Fee Collections</td>
            <td class="text-center font-mono">${feeCollectionDetails.length} Challans</td>
            <td class="text-right font-mono font-bold" style="color: #000000;">
              ${feeCollectionTotal.toLocaleString()}
            </td>
          </tr>
          <tr class="child-row">
            <td colspan="4">
              <table class="nested-table">
                <thead>
                  <tr>
                    <th style="width: 3.5%;" class="text-center">#</th>
                    <th style="width: 9%;">Challan #</th>
                    <th style="width: 30%;">Student Information (Name, Father, Roll #)</th>
                    <th style="width: 6.5%;" class="text-right">Base</th>
                    <th style="width: 6.5%;" class="text-right">Heads</th>
                    <th style="width: 6%;" class="text-right">Late Fine</th>
                    <th style="width: 7.5%;" class="text-right">Gross</th>
                    <th style="width: 9%;" class="text-right font-bold">Paid (Rs.)</th>
                    <th style="width: 10%;">Account</th>
                    <th style="width: 12%;">Logged By</th>
                  </tr>
                </thead>
                <tbody>
                  ${feeCollectionDetails.map((c, idx) => `
                    <tr>
                      <td class="text-center font-mono">${idx + 1}</td>
                      <td class="font-mono">${c.challanNo && c.challanNo !== "—" && c.challanNo !== "-" ? `#${c.challanNo.replace(/^#/, "")}` : (c.receiptNo || "—")}</td>
                      <td><strong>${c.studentName}</strong> (Father: ${c.fatherName} • Roll: ${c.rollNumber})</td>
                      <td class="text-right font-mono">${Number(c.baseAmount || 0).toLocaleString()}</td>
                      <td class="text-right font-mono">${Number(getHeadsAmount(c) || 0).toLocaleString()}</td>
                      <td class="text-right font-mono">${Number(c.lateFeeFine || 0).toLocaleString()}</td>
                      <td class="text-right font-mono">${Number(c.totalAmount || 0).toLocaleString()}</td>
                      <td class="text-right font-mono font-bold">
                        ${Number(c.paidAmount || 0) > 0 ? Number(c.paidAmount).toLocaleString() : (c.receiptType === 'ARREARS_SETTLEMENT' ? '0 (Arrears)' : '0 (Advance)')}
                      </td>
                      <td>${c.walletName || (Number(c.paidAmount || 0) > 0 ? "Cash in Hand" : "Non-Cash Settlement")}</td>
                      <td>${c.loggedBy || "Super Admin"}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </td>
          </tr>
        `;
      }

      if (hasOtherIncome) {
        incomeRowsHtml += `
          <tr class="parent-row">
            <td class="text-center font-mono">${sNoInc++}</td>
            <td>Other Revenue &amp; Direct Receipts</td>
            <td class="text-center font-mono">${otherIncomeDetails.length} Entries</td>
            <td class="text-right font-mono font-bold" style="color: #000000;">
              ${otherIncomeTotal.toLocaleString()}
            </td>
          </tr>
          <tr class="child-row">
            <td colspan="4">
              <table class="nested-table">
                <thead>
                  <tr>
                    <th style="width: 4%;" class="text-center">#</th>
                    <th style="width: 15%;">Category</th>
                    <th style="width: 31%;">Description / Remarks</th>
                    <th style="width: 15%;">Source / Ref</th>
                    <th style="width: 12%;">Account</th>
                    <th style="width: 12%;">Logged By</th>
                    <th style="width: 11%;" class="text-right">Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  ${otherIncomeDetails.map((inc, idx) => `
                    <tr>
                      <td class="text-center font-mono">${idx + 1}</td>
                      <td><strong>${inc.category}</strong> ${inc.subCategory ? `(${inc.subCategory})` : ""}</td>
                      <td>${inc.remarks || inc.title || "—"}</td>
                      <td>${inc.source || "Direct Receipt"}</td>
                      <td>${inc.walletName || "Cash in Hand"}</td>
                      <td>${inc.loggedBy || "Super Admin"}</td>
                      <td class="text-right font-mono font-bold">${Number(inc.amount || 0).toLocaleString()}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </td>
          </tr>
        `;
      }

      incomeRowsHtml += `
        <tr class="total-row">
          <td colspan="3" class="text-right uppercase">Total Income:</td>
          <td class="text-right font-mono font-bold" style="color: #000000;">
            Rs. ${totalIncome.toLocaleString()}
          </td>
        </tr>
      `;

      incomeSectionHtml = `
        <div class="section-header">${sectionIndex++}. Income Details</div>
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
            ${incomeRowsHtml}
          </tbody>
        </table>
      `;
    }

    // Expense section HTML (hidden if no expense data)
    let expenseSectionHtml = "";
    if (hasExpense) {
      let expenseRowsHtml = "";
      let sNoExp = 1;

      if (hasPayroll) {
        expenseRowsHtml += `
          <tr class="parent-row">
            <td class="text-center font-mono">${sNoExp++}</td>
            <td>Staff Payroll &amp; Salaries</td>
            <td class="text-center font-mono">${payrollDetails.length} Staff</td>
            <td class="text-right font-mono font-bold" style="color: #000000;">
              ${payrollTotal.toLocaleString()}
            </td>
          </tr>
          <tr class="child-row">
            <td colspan="4">
              <table class="nested-table">
                <thead>
                  <tr>
                    <th style="width: 4%;" class="text-center">#</th>
                    <th style="width: 32%;">Staff Details (Name, Father, ID &amp; Designation)</th>
                    <th style="width: 10%;">Month</th>
                    <th style="width: 8%;" class="text-right">Payable</th>
                    <th style="width: 8%;" class="text-right">Deductions</th>
                    <th style="width: 8%;" class="text-right">Allowances</th>
                    <th style="width: 10%;" class="text-right">Net Paid</th>
                    <th style="width: 10%;">Account</th>
                    <th style="width: 10%;">Disbursed By</th>
                  </tr>
                </thead>
                <tbody>
                  ${payrollDetails.map((p, idx) => `
                    <tr>
                      <td class="text-center font-mono">${idx + 1}</td>
                      <td><strong>${p.staffName}</strong> (Father: ${p.fatherName} • ID: ${p.employeeId} • ${p.designation})</td>
                      <td>${p.month || "—"}</td>
                      <td class="text-right font-mono">${Number(p.payable || 0).toLocaleString()}</td>
                      <td class="text-right font-mono">${Number(p.deductions || 0).toLocaleString()}</td>
                      <td class="text-right font-mono">${Number(p.allowance || 0).toLocaleString()}</td>
                      <td class="text-right font-mono font-bold">${Number(p.totalAmount || 0).toLocaleString()}</td>
                      <td>${p.walletName || "Cash in Hand"}</td>
                      <td>${p.disbursedBy || "Admin"}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </td>
          </tr>
        `;
      }

      if (hasOtherExpense) {
        expenseRowsHtml += `
          <tr class="parent-row">
            <td class="text-center font-mono">${sNoExp++}</td>
            <td>Other Operating Expenses</td>
            <td class="text-center font-mono">${otherExpenseDetails.length} Vouchers</td>
            <td class="text-right font-mono font-bold" style="color: #000000;">
              ${otherExpenseTotal.toLocaleString()}
            </td>
          </tr>
          <tr class="child-row">
            <td colspan="4">
              <table class="nested-table">
                <thead>
                  <tr>
                    <th style="width: 4%;" class="text-center">#</th>
                    <th style="width: 15%;">Category</th>
                    <th style="width: 28%;">Description / Purpose</th>
                    <th style="width: 10%;">Voucher #</th>
                    <th style="width: 13%;">Vendor / Payee</th>
                    <th style="width: 10%;">Account</th>
                    <th style="width: 10%;">Disbursed By</th>
                    <th style="width: 10%;" class="text-right">Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  ${otherExpenseDetails.map((exp, idx) => `
                    <tr>
                      <td class="text-center font-mono">${idx + 1}</td>
                      <td><strong>${exp.category}</strong> ${exp.subCategory ? `(${exp.subCategory})` : ""}</td>
                      <td>${exp.remarks || exp.title || "—"}</td>
                      <td class="font-mono">#${exp.voucherNo}</td>
                      <td>${exp.vendor || "—"}</td>
                      <td>${exp.walletName || "Cash in Hand"}</td>
                      <td>${exp.disbursedBy || "Admin"}</td>
                      <td class="text-right font-mono font-bold">${Number(exp.amount || 0).toLocaleString()}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </td>
          </tr>
        `;
      }

      expenseRowsHtml += `
        <tr class="total-row">
          <td colspan="3" class="text-right uppercase">Total Expenses:</td>
          <td class="text-right font-mono font-bold" style="color: #000000;">
            Rs. ${totalExpenses.toLocaleString()}
          </td>
        </tr>
      `;

      expenseSectionHtml = `
        <div class="section-header" style="margin-top: 10px;">${sectionIndex++}. Expense Details</div>
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
            ${expenseRowsHtml}
          </tbody>
        </table>
      `;
    }

    // Wallets to display
    const activeWallets = walletsDateBreakdown.filter(w =>
      Number(w.dateInflow || 0) > 0 ||
      Number(w.dateOutflow || 0) > 0 ||
      Math.abs(Number(w.dateNetBalance || 0)) > 0 ||
      Number(w.currentBalance || 0) > 0
    );
    const displayWallets = activeWallets.length > 0 ? activeWallets : walletsDateBreakdown;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${reportTitle} - Concordia College Peshawar</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,600;1,700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #000000;
              margin: 0;
              padding: 0;
              background: #fff;
              font-size: 9.5px;
              line-height: 1.35;
            }
            .header-container {
              display: flex;
              align-items: center;
              justify-content: flex-start;
              gap: 14px;
              border-bottom: 2px solid #000000;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .logo {
              height: 48px;
              width: auto;
              object-fit: contain;
            }
            .title-area {
              flex: 1;
              text-align: center;
            }
            .college-title {
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 0.8px;
              color: #000000;
              text-transform: uppercase;
              margin: 0;
            }
            .calligraphic-title {
              font-family: 'Playfair Display', Georgia, serif;
              font-style: italic;
              font-size: 19px;
              font-weight: 800;
              color: #000000;
              margin: 1px 0;
            }
            .meta-line {
              font-size: 9.5px;
              color: #000000;
              font-weight: 700;
            }
            .section-header {
              font-size: 10.5px;
              font-weight: 800;
              color: #000000;
              margin: 10px 0 4px 0;
              padding-bottom: 2px;
              border-bottom: 1.5px solid #000000;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            table.main-table {
              width: 100%;
              table-layout: fixed;
              border-collapse: collapse;
              margin-bottom: 8px;
              font-size: 9px;
              border: 1.5px solid #000000;
              box-sizing: border-box;
            }
            table.main-table th, table.main-table td {
              border: 1px solid #000000;
              padding: 4px 5px;
              text-align: left;
              word-break: break-word;
              overflow: hidden;
            }
            table.main-table th {
              background-color: #f1f5f9;
              color: #000000;
              font-weight: 800;
              text-transform: uppercase;
              font-size: 8.5px;
              border: 1.5px solid #000000;
            }
            tr.parent-row {
              background-color: #f8fafc;
              font-weight: 800;
            }
            tr.parent-row td {
              border: 1.5px solid #000000;
            }
            tr.child-row > td {
              padding: 0 !important;
              background-color: #ffffff;
              border: 1.5px solid #000000;
            }
            table.nested-table {
              width: 100%;
              table-layout: fixed;
              border-collapse: collapse;
              margin: 0;
              font-size: 8.5px;
              border: none;
              box-sizing: border-box;
            }
            table.nested-table th, table.nested-table td {
              border: 1px solid #000000;
              padding: 3px 4px;
              word-break: break-word;
              overflow: hidden;
            }
            table.nested-table th {
              background-color: #f1f5f9;
              color: #000000;
              font-weight: 800;
              font-size: 8px;
              border: 1px solid #000000;
            }
            .total-row {
              background-color: #f1f5f9;
              font-weight: 800;
            }
            .total-row td {
              border: 1.5px solid #000000;
              font-weight: 800;
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
            .font-bold {
              font-weight: 800;
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header-container">
            <img src="/logo.png" alt="Concordia College" class="logo" />
            <div class="title-area">
              <div class="college-title">Concordia College Peshawar</div>
              <div class="calligraphic-title">${reportTitle}</div>
              <div class="meta-line">
                Session: ${activeSessionName} &nbsp;|&nbsp; ${reportPeriodText}
              </div>
            </div>
            <div style="width: 48px;"></div>
          </div>

          <!-- 1. Income Details Table (Omitted if empty) -->
          ${incomeSectionHtml}

          <!-- 2. Expense Details Table (Omitted if empty) -->
          ${expenseSectionHtml}

          <!-- Financial Summary & Treasury Reconciliation -->
          <div class="section-header" style="margin-top: 10px;">${sectionIndex}. Financial Summary &amp; Treasury Reconciliation</div>

          <!-- Wallets Holding Table -->
          <table class="main-table">
            <thead>
              <tr>
                <th style="width: 5%;" class="text-center">S.No</th>
                <th style="width: 35%;">Account / Wallet</th>
                <th style="width: 15%;">Type</th>
                <th style="width: 15%;" class="text-right">Inflow (+)</th>
                <th style="width: 15%;" class="text-right">Outflow (-)</th>
                <th style="width: 15%;" class="text-right">Net Holding</th>
              </tr>
            </thead>
            <tbody>
              ${displayWallets
                .map(
                  (w, idx) => `
                <tr>
                  <td class="text-center font-mono">${idx + 1}</td>
                  <td><strong>${w.walletName}</strong> ${w.accountNumber ? `(#${w.accountNumber})` : ""}</td>
                  <td>${w.walletType}</td>
                  <td class="text-right font-mono">+${Number(w.dateInflow || 0).toLocaleString()}</td>
                  <td class="text-right font-mono">-${Number(w.dateOutflow || 0).toLocaleString()}</td>
                  <td class="text-right font-mono font-bold">
                    ${w.dateNetBalance >= 0 ? "+" : ""}Rs. ${Number(w.dateNetBalance || 0).toLocaleString()}
                  </td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td colspan="3" class="text-right uppercase">Reconciled Totals:</td>
                <td class="text-right font-mono font-bold">+Rs. ${walletsSumInflow.toLocaleString()}</td>
                <td class="text-right font-mono font-bold">-Rs. ${walletsSumOutflow.toLocaleString()}</td>
                <td class="text-right font-mono font-bold">Rs. ${walletsSumNet.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <!-- Signatures (Full-width 3 columns: Left, Center, Right) -->
          <table style="width: 100%; border: none; margin-top: 40px; border-collapse: collapse;">
            <tbody>
              <tr>
                <td style="width: 33.33%; text-align: left; border: none; vertical-align: top; padding: 0;">
                  <div style="border-top: 1.5px solid #000000; width: 150px; text-align: center; padding-top: 4px; font-size: 8.5px; font-weight: 700; color: #000000;">
                    Prepared By (Accountant)
                  </div>
                </td>
                <td style="width: 33.33%; text-align: center; border: none; vertical-align: top; padding: 0;">
                  <div style="border-top: 1.5px solid #000000; width: 150px; margin: 0 auto; text-align: center; padding-top: 4px; font-size: 8.5px; font-weight: 700; color: #000000;">
                    Verified By (Finance Mgr)
                  </div>
                </td>
                <td style="width: 33.33%; text-align: right; border: none; vertical-align: top; padding: 0;">
                  <div style="border-top: 1.5px solid #000000; width: 150px; margin-left: auto; margin-right: 0; text-align: center; padding-top: 4px; font-size: 8.5px; font-weight: 700; color: #000000;">
                    Approved By (Principal)
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    const html = generatePrintHtml();
    const docTitle = closingMode === "DAILY"
      ? `Daily Income & Expense Report - ${closingDate || todayDateStr}`
      : `Monthly Income & Expense Report - ${monthlyRange.monthName || closingMonth}`;
    await openManagedPrintWindow({
      html,
      title: docTitle,
      toast,
    });
  };

  return (
    <div className="space-y-6">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          1. TOP BRANDING & CONTROLS HEADER
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card className="border border-border/70 shadow-xs bg-card overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                  {closingMode === "DAILY" ? "Daily Income & Expense Report" : "Monthly Income & Expense Report"}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                  <Badge variant="outline" className="text-[10px] sm:text-xs font-medium">
                    Session: {activeSessionName}
                  </Badge>
                  <span>•</span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    {closingMode === "DAILY"
                      ? `Report Date: ${formatReportDate(closingDate || todayDateStr)}`
                      : `Month: ${monthlyRange.monthName} (${formatReportDate(monthlyRange.dateFrom)} – ${formatReportDate(monthlyRange.dateTo)})`}
                    {isDataLoading && (
                      <Loader2 className="w-3 h-3 animate-spin text-primary inline-block" />
                    )}
                  </span>
                  {isExactCheckpoint && (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold">
                      Checkpoint Closed
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions Group */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
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
                    setClosingTargetDate(
                      closingMode === "DAILY"
                        ? (closingDate || todayDateStr)
                        : (monthlyRange.dateTo || todayDateStr)
                    );
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

          {/* Controls Toolbar: Scope Switcher & Date Filter */}
          <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Scope Mode Switch */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Scope:</span>
              <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={closingMode === "DAILY" ? "default" : "ghost"}
                  className="h-7 text-xs font-semibold px-3"
                  onClick={() => setClosingMode("DAILY")}
                >
                  Daily Closing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={closingMode === "MONTHLY" ? "default" : "ghost"}
                  className="h-7 text-xs font-semibold px-3"
                  onClick={() => setClosingMode("MONTHLY")}
                >
                  Monthly Closing
                </Button>
              </div>
            </div>

            {/* Right: Date / Month Picker & Presets */}
            {closingMode === "DAILY" ? (
              <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border">
                <Calendar className="w-3.5 h-3.5 text-primary ml-1 shrink-0" />
                <Input
                  type="date"
                  className="h-7 text-xs w-[130px] border-none bg-transparent shadow-none"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                />
                {isDataLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0 mr-1" />
                )}
                <div className="h-4 w-px bg-border mx-0.5" />
                <Button
                  variant={closingDate === todayDateStr ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[11px] px-2.5"
                  onClick={() => setClosingDate(todayDateStr)}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2.5"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setClosingDate(d.toISOString().split("T")[0]);
                  }}
                >
                  Yesterday
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border">
                <Calendar className="w-3.5 h-3.5 text-primary ml-1 shrink-0" />
                <Input
                  type="month"
                  className="h-7 text-xs w-[130px] border-none bg-transparent shadow-none"
                  value={closingMonth}
                  onChange={(e) => setClosingMonth(e.target.value)}
                />
                {isDataLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0 mr-1" />
                )}
                <div className="h-4 w-px bg-border mx-0.5" />
                <Button
                  variant={closingMonth === currentMonthStr ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[11px] px-2.5"
                  onClick={() => setClosingMonth(currentMonthStr)}
                >
                  This Month
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2.5"
                  onClick={() => {
                    const now = new Date();
                    now.setMonth(now.getMonth() - 1);
                    const prevMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                    setClosingMonth(prevMonth);
                  }}
                >
                  Last Month
                </Button>
              </div>
            )}
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
            {isDataLoading ? (
              <Skeleton className="inline-block h-4 w-24 align-middle" />
            ) : (
              <span className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                PKR {totalIncome.toLocaleString()}
              </span>
            )}
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
                    {isDataLoading ? (
                      <Skeleton className="h-5 w-20 mx-auto rounded-full" />
                    ) : (
                      <Badge variant="outline" className="text-[10px] sm:text-[10.5px] font-mono py-0.5 px-2">
                        {feeCollectionDetails.length} {feeCollectionDetails.length === 1 ? "Challan" : "Challans"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                    {isDataLoading ? (
                      <Skeleton className="h-4 w-24 ml-auto" />
                    ) : (
                      `PKR ${feeCollectionTotal.toLocaleString()}`
                    )}
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
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground whitespace-nowrap">Logged By</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isDataLoading ? (
                                [1, 2, 3].map((idx) => (
                                  <TableRow key={idx} className="border-b border-border/30 text-[10.5px] sm:text-xs">
                                    <TableCell className="text-center font-mono py-2 px-2 text-muted-foreground"><Skeleton className="h-3.5 w-3.5 mx-auto" /></TableCell>
                                    <TableCell className="font-mono font-bold py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-16" /></TableCell>
                                    <TableCell className="py-2 px-2 min-w-[170px]"><Skeleton className="h-3.5 w-32 mb-1" /><Skeleton className="h-3 w-44" /></TableCell>
                                    <TableCell className="text-right font-mono py-2 px-2"><Skeleton className="h-3.5 w-14 ml-auto" /></TableCell>
                                    <TableCell className="text-right font-mono py-2 px-2"><Skeleton className="h-3.5 w-14 ml-auto" /></TableCell>
                                    <TableCell className="text-right font-mono py-2 px-2"><Skeleton className="h-3.5 w-10 ml-auto" /></TableCell>
                                    <TableCell className="text-right font-mono py-2 px-2"><Skeleton className="h-3.5 w-14 ml-auto" /></TableCell>
                                    <TableCell className="text-right font-mono font-bold py-2 px-2"><Skeleton className="h-3.5 w-16 ml-auto" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-5 w-20 rounded" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-24" /></TableCell>
                                  </TableRow>
                                ))
                              ) : feeCollectionDetails.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={10} className="text-center py-3.5 text-xs text-muted-foreground italic">
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
                                      {c.challanNo && c.challanNo !== "—" && c.challanNo !== "-" ? (
                                        <span>#{c.challanNo.replace(/^#/, "")}</span>
                                      ) : (
                                        <span className="text-muted-foreground font-mono font-normal">{c.receiptNo && c.receiptNo !== "—" ? c.receiptNo : "—"}</span>
                                      )}
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
                                      {c.paymentMode === "Advance Credit" || c.receiptType === "ADVANCE_SETTLEMENT" ? (
                                        <div className="flex flex-col items-end">
                                          <span className="text-purple-600 font-semibold text-[10px]">PKR 0 (Advance)</span>
                                          <span className="text-[9px] text-muted-foreground font-normal">Credit: {Number(c.advanceCreditUsed || 0).toLocaleString()}</span>
                                        </div>
                                      ) : (c.paymentMode === "Arrears Transfer" || c.receiptType === "ARREARS_SETTLEMENT") ? (
                                        <div className="flex flex-col items-end">
                                          <span className="text-amber-600 font-semibold text-[10px]">PKR 0 (Arrears)</span>
                                          <span className="text-[9px] text-muted-foreground font-normal">Settled: {Number(c.settledViaArrearsAmount || 0).toLocaleString()}</span>
                                        </div>
                                      ) : (
                                        `PKR ${Number(c.paidAmount || 0).toLocaleString()}`
                                      )}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap">
                                      <Badge variant="secondary" className="text-[9.5px] font-mono py-0 px-1.5">
                                        {c.paymentMode === "Advance Credit" || c.receiptType === "ADVANCE_SETTLEMENT"
                                          ? "Advance Credit"
                                          : (c.paymentMode === "Arrears Transfer" || c.receiptType === "ARREARS_SETTLEMENT"
                                            ? "Arrears Settlement"
                                            : (c.walletName || "Cash in Hand"))}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap text-muted-foreground">
                                      {c.loggedBy || "Super Admin"}
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
                    {isDataLoading ? (
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    ) : (
                      <Badge variant="outline" className="text-[10px] sm:text-[10.5px] font-mono py-0.5 px-2">
                        {otherIncomeDetails.length} {otherIncomeDetails.length === 1 ? "Entry" : "Entries"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                    {isDataLoading ? (
                      <Skeleton className="h-4 w-24 ml-auto" />
                    ) : (
                      `PKR ${otherIncomeTotal.toLocaleString()}`
                    )}
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
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[110px] whitespace-nowrap">Logged By</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-emerald-600 dark:text-emerald-400 font-bold w-[110px] text-right whitespace-nowrap">Amount (PKR)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isDataLoading ? (
                                [1, 2].map((idx) => (
                                  <TableRow key={idx} className="border-b border-border/30 text-[10.5px] sm:text-xs">
                                    <TableCell className="text-center font-mono py-2 px-2 text-muted-foreground"><Skeleton className="h-3.5 w-3.5 mx-auto" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-20" /></TableCell>
                                    <TableCell className="py-2 px-2 min-w-[160px]"><Skeleton className="h-3.5 w-36" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-20" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-5 w-20 rounded" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-20" /></TableCell>
                                    <TableCell className="text-right py-2 px-2"><Skeleton className="h-3.5 w-16 ml-auto" /></TableCell>
                                  </TableRow>
                                ))
                              ) : otherIncomeDetails.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={8} className="text-center py-3.5 text-xs text-muted-foreground italic">
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
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap text-muted-foreground">
                                      {inc.loggedBy || "Super Admin"}
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
            {isDataLoading ? (
              <Skeleton className="inline-block h-4 w-24 align-middle" />
            ) : (
              <span className="text-xs sm:text-sm font-mono font-bold text-rose-600 dark:text-rose-400">
                PKR {totalExpenses.toLocaleString()}
              </span>
            )}
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
                    {isDataLoading ? (
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    ) : (
                      <Badge variant="outline" className="text-[10px] sm:text-[10.5px] font-mono py-0.5 px-2">
                        {payrollDetails.length} {payrollDetails.length === 1 ? "Staff" : "Staff"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                    {isDataLoading ? (
                      <Skeleton className="h-4 w-24 ml-auto" />
                    ) : (
                      `PKR ${payrollTotal.toLocaleString()}`
                    )}
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
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground whitespace-nowrap">Disbursed By</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isDataLoading ? (
                                [1, 2].map((idx) => (
                                  <TableRow key={idx} className="border-b border-border/30 text-[10.5px] sm:text-xs">
                                    <TableCell className="text-center font-mono py-2 px-2 text-muted-foreground"><Skeleton className="h-3.5 w-3.5 mx-auto" /></TableCell>
                                    <TableCell className="py-2 px-2 min-w-[170px]"><Skeleton className="h-3.5 w-36 mb-1" /><Skeleton className="h-3 w-28" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-16" /></TableCell>
                                    <TableCell className="text-right font-mono py-2 px-2"><Skeleton className="h-3.5 w-14 ml-auto" /></TableCell>
                                    <TableCell className="text-right font-mono py-2 px-2"><Skeleton className="h-3.5 w-14 ml-auto" /></TableCell>
                                    <TableCell className="text-right font-mono py-2 px-2"><Skeleton className="h-3.5 w-14 ml-auto" /></TableCell>
                                    <TableCell className="text-right font-mono font-bold py-2 px-2"><Skeleton className="h-3.5 w-16 ml-auto" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-5 w-20 rounded" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-24" /></TableCell>
                                  </TableRow>
                                ))
                              ) : payrollDetails.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={9} className="text-center py-3.5 text-xs text-muted-foreground italic">
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
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap text-muted-foreground">
                                      {p.disbursedBy || "Admin"}
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
                    {isDataLoading ? (
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    ) : (
                      <Badge variant="outline" className="text-[10px] sm:text-[10.5px] font-mono py-0.5 px-2">
                        {otherExpenseDetails.length} {otherExpenseDetails.length === 1 ? "Voucher" : "Vouchers"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                    {isDataLoading ? (
                      <Skeleton className="h-4 w-24 ml-auto" />
                    ) : (
                      `PKR ${otherExpenseTotal.toLocaleString()}`
                    )}
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
                                <TableHead className="h-7 py-1 px-2 text-muted-foreground w-[110px] whitespace-nowrap">Disbursed By</TableHead>
                                <TableHead className="h-7 py-1 px-2 text-rose-600 dark:text-rose-400 font-bold w-[110px] text-right whitespace-nowrap">Amount (PKR)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isDataLoading ? (
                                [1, 2].map((idx) => (
                                  <TableRow key={idx} className="border-b border-border/30 text-[10.5px] sm:text-xs">
                                    <TableCell className="text-center font-mono py-2 px-2 text-muted-foreground"><Skeleton className="h-3.5 w-3.5 mx-auto" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-20" /></TableCell>
                                    <TableCell className="py-2 px-2 min-w-[160px]"><Skeleton className="h-3.5 w-36" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-16" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-20" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-5 w-20 rounded" /></TableCell>
                                    <TableCell className="py-2 px-2 whitespace-nowrap"><Skeleton className="h-3.5 w-20" /></TableCell>
                                    <TableCell className="text-right py-2 px-2"><Skeleton className="h-3.5 w-16 ml-auto" /></TableCell>
                                  </TableRow>
                                ))
                              ) : otherExpenseDetails.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={8} className="text-center py-3.5 text-xs text-muted-foreground italic">
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
                                    <TableCell className="py-1.5 px-2 whitespace-nowrap text-muted-foreground">
                                      {exp.disbursedBy || "Admin"}
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
              {isDataLoading ? (
                <div className="space-y-2 mt-2">
                  <Skeleton className="h-7 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ) : (
                <>
                  <div className="text-lg sm:text-xl md:text-2xl font-mono font-extrabold text-emerald-700 dark:text-emerald-300 mt-1.5">
                    PKR {totalIncome.toLocaleString()}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 truncate">
                    Fee: PKR {feeCollectionTotal.toLocaleString()} + Other: PKR {otherIncomeTotal.toLocaleString()}
                  </div>
                </>
              )}
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
              {isDataLoading ? (
                <div className="space-y-2 mt-2">
                  <Skeleton className="h-7 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ) : (
                <>
                  <div className="text-lg sm:text-xl md:text-2xl font-mono font-extrabold text-rose-700 dark:text-rose-300 mt-1.5">
                    PKR {totalExpenses.toLocaleString()}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 truncate">
                    Payroll: PKR {payrollTotal.toLocaleString()} + Other: PKR {otherExpenseTotal.toLocaleString()}
                  </div>
                </>
              )}
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
              {isDataLoading ? (
                <div className="space-y-2 mt-2">
                  <Skeleton className="h-7 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ) : (
                <>
                  <div className="text-lg sm:text-xl md:text-2xl font-mono font-extrabold text-foreground mt-1.5">
                    PKR {netBalance.toLocaleString()}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 truncate">
                    Net operational cashflow for this date
                  </div>
                </>
              )}
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
                    {isDataLoading ? (
                      <>
                        {[1, 2, 3].map((i) => (
                          <TableRow key={i} className="hover:bg-transparent border-b border-border/30">
                            <TableCell className="text-center py-2.5 px-2.5">
                              <Skeleton className="h-4 w-4 mx-auto" />
                            </TableCell>
                            <TableCell className="py-2.5 px-2.5">
                              <Skeleton className="h-4 w-36" />
                            </TableCell>
                            <TableCell className="py-2.5 px-2.5">
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell className="text-right py-2.5 px-2.5">
                              <Skeleton className="h-4 w-24 ml-auto" />
                            </TableCell>
                            <TableCell className="text-right py-2.5 px-2.5">
                              <Skeleton className="h-4 w-24 ml-auto" />
                            </TableCell>
                            <TableCell className="text-right py-2.5 px-2.5">
                              <Skeleton className="h-4 w-24 ml-auto" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    ) : walletsDateBreakdown.length === 0 ? (
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
                    <>
                      {[1, 2, 3].map((i) => (
                        <TableRow key={i} className="hover:bg-transparent border-b border-border/30">
                          <TableCell className="py-2.5 px-2.5"><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell className="py-2.5 px-2.5 text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          <TableCell className="py-2.5 px-2.5 text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          <TableCell className="py-2.5 px-2.5 text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          <TableCell className="py-2.5 px-2.5 text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          <TableCell className="py-2.5 px-2.5"><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="py-2.5 px-2.5"><Skeleton className="h-4 w-36" /></TableCell>
                          <TableCell className="py-2.5 px-2.5 text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                        </TableRow>
                      ))}
                    </>
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
                {closingMode === "DAILY"
                  ? "Print Preview: Daily Income & Expense Report"
                  : "Print Preview: Monthly Income & Expense Report"}
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
          <div className="p-4 sm:p-6 bg-white text-black border rounded-lg shadow-sm space-y-4 my-2 text-xs">
            {/* Header with Branding */}
            <div className="flex items-center justify-between border-b-2 border-black pb-3 gap-4">
              <img src="/logo.png" alt="Concordia College" className="h-14 w-auto object-contain" />
              <div className="text-center flex-1">
                <div className="text-base font-extrabold tracking-wide uppercase text-black">
                  Concordia College Peshawar
                </div>
                <div
                  className="text-2xl font-serif italic font-bold text-black my-0.5"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {closingMode === "DAILY" ? "Daily Income & Expense Report" : "Monthly Income & Expense Report"}
                </div>
                <div className="text-xs text-black font-semibold">
                  Session: {activeSessionName} &nbsp;|&nbsp;{" "}
                  {closingMode === "DAILY"
                    ? `Report Date: ${formatReportDate(closingDate || todayDateStr)}`
                    : `Period: ${monthlyRange.monthName} (${formatReportDate(monthlyRange.dateFrom)} – ${formatReportDate(monthlyRange.dateTo)})`}
                </div>
              </div>
              <div className="w-14" />
            </div>

            {/* Income Section with Nested Child Tables (Omitted if empty) */}
            {(() => {
              const hasFee = feeCollectionDetails.length > 0;
              const hasOtherIncome = otherIncomeDetails.length > 0;
              if (!hasFee && !hasOtherIncome) return null;

              let sNoInc = 1;
              return (
                <div className="space-y-2">
                  <div className="font-bold text-xs uppercase tracking-wider text-black border-b border-black pb-1">
                    1. Income Details
                  </div>

                  <table className="w-full table-fixed border-collapse border border-black text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-black text-[11px]">
                        <th className="border border-black p-1.5 text-center w-10">S.No</th>
                        <th className="border border-black p-1.5 text-left">Income Sector / Particular</th>
                        <th className="border border-black p-1.5 text-center w-28">Records</th>
                        <th className="border border-black p-1.5 text-right w-36">Total Amount (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Parent Row 1: Fee Collection */}
                      {hasFee && (
                        <>
                          <tr className="bg-slate-50 font-semibold">
                            <td className="border border-black p-1.5 text-center font-mono">{sNoInc++}</td>
                            <td className="border border-black p-1.5"><strong>Student Fee Collections</strong></td>
                            <td className="border border-black p-1.5 text-center font-mono">{feeCollectionDetails.length} Challans</td>
                            <td className="border border-black p-1.5 text-right font-mono font-bold text-black">
                              {feeCollectionTotal.toLocaleString()}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="border border-black p-0 bg-white">
                              <table className="w-full table-fixed border-collapse text-[10px]">
                                <thead>
                                  <tr className="bg-slate-100">
                                    <th className="border border-black p-1 text-center w-[3.5%]">#</th>
                                    <th className="border border-black p-1 text-left w-[9%]">Challan #</th>
                                    <th className="border border-black p-1 text-left w-[30%]">Student Details</th>
                                    <th className="border border-black p-1 text-right w-[6.5%]">Base</th>
                                    <th className="border border-black p-1 text-right w-[6.5%]">Heads</th>
                                    <th className="border border-black p-1 text-right w-[6%]">Late Fine</th>
                                    <th className="border border-black p-1 text-right w-[7.5%]">Gross</th>
                                    <th className="border border-black p-1 text-right w-[9%] font-bold">Paid (Rs.)</th>
                                    <th className="border border-black p-1 text-left w-[10%]">Account</th>
                                    <th className="border border-black p-1 text-left w-[12%]">Logged By</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {feeCollectionDetails.map((c, idx) => (
                                    <tr key={idx}>
                                      <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                                      <td className="border border-black p-1 font-mono">{c.challanNo && c.challanNo !== "—" && c.challanNo !== "-" ? `#${c.challanNo.replace(/^#/, "")}` : (c.receiptNo || "—")}</td>
                                      <td className="border border-black p-1 truncate"><strong>{c.studentName}</strong> <span className="text-slate-700">(Father: {c.fatherName || "—"}, Roll: {c.rollNumber || "—"})</span></td>
                                      <td className="border border-black p-1 text-right font-mono">{Number(c.baseAmount || 0).toLocaleString()}</td>
                                      <td className="border border-black p-1 text-right font-mono">{Number(getHeadsAmount(c) || 0).toLocaleString()}</td>
                                      <td className="border border-black p-1 text-right font-mono">{Number(c.lateFeeFine || 0).toLocaleString()}</td>
                                      <td className="border border-black p-1 text-right font-mono">{Number(c.totalAmount || 0).toLocaleString()}</td>
                                      <td className="border border-black p-1 text-right font-mono font-bold">{Number(c.paidAmount || 0) > 0 ? Number(c.paidAmount).toLocaleString() : (c.receiptType === 'ARREARS_SETTLEMENT' ? '0 (Arrears)' : '0 (Advance)')}</td>
                                      <td className="border border-black p-1 text-[9px] truncate">{c.walletName || "Cash in Hand"}</td>
                                      <td className="border border-black p-1 text-[9px] truncate">{c.loggedBy || "Super Admin"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Parent Row 2: Other Revenue */}
                      {hasOtherIncome && (
                        <>
                          <tr className="bg-slate-50 font-semibold">
                            <td className="border border-black p-1.5 text-center font-mono">{sNoInc++}</td>
                            <td className="border border-black p-1.5"><strong>Other Revenue &amp; Direct Receipts</strong></td>
                            <td className="border border-black p-1.5 text-center font-mono">{otherIncomeDetails.length} Entries</td>
                            <td className="border border-black p-1.5 text-right font-mono font-bold text-black">
                              {otherIncomeTotal.toLocaleString()}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="border border-black p-0 bg-white">
                              <table className="w-full table-fixed border-collapse text-[10px]">
                                <thead>
                                  <tr className="bg-slate-100">
                                    <th className="border border-black p-1 text-center w-[4%]">#</th>
                                    <th className="border border-black p-1 text-left w-[15%]">Category</th>
                                    <th className="border border-black p-1 text-left w-[31%]">Description / Remarks</th>
                                    <th className="border border-black p-1 text-left w-[15%]">Source / Ref</th>
                                    <th className="border border-black p-1 text-left w-[12%]">Account</th>
                                    <th className="border border-black p-1 text-left w-[12%]">Logged By</th>
                                    <th className="border border-black p-1 text-right w-[11%] font-bold">Amount (Rs.)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {otherIncomeDetails.map((inc, idx) => (
                                    <tr key={idx}>
                                      <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                                      <td className="border border-black p-1 font-semibold truncate">{inc.category}</td>
                                      <td className="border border-black p-1 truncate">{inc.remarks || inc.title}</td>
                                      <td className="border border-black p-1 truncate">{inc.source || "Direct Receipt"}</td>
                                      <td className="border border-black p-1 text-[9px] truncate">{inc.walletName || "Cash in Hand"}</td>
                                      <td className="border border-black p-1 text-[9px] truncate">{inc.loggedBy || "Super Admin"}</td>
                                      <td className="border border-black p-1 text-right font-mono font-bold">{Number(inc.amount || 0).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Total Income Row */}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={3} className="border border-black p-1.5 text-right uppercase">
                          Total Income:
                        </td>
                        <td className="border border-black p-1.5 text-right font-mono font-extrabold text-black">
                          Rs. {totalIncome.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Expense Section with Nested Child Tables (Omitted if empty) */}
            {(() => {
              const hasPayroll = payrollDetails.length > 0;
              const hasOtherExpense = otherExpenseDetails.length > 0;
              if (!hasPayroll && !hasOtherExpense) return null;

              let sNoExp = 1;
              return (
                <div className="space-y-2 pt-2">
                  <div className="font-bold text-xs uppercase tracking-wider text-black border-b border-black pb-1">
                    2. Expense Details
                  </div>

                  <table className="w-full table-fixed border-collapse border border-black text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-black text-[11px]">
                        <th className="border border-black p-1.5 text-center w-10">S.No</th>
                        <th className="border border-black p-1.5 text-left">Expense Sector / Particular</th>
                        <th className="border border-black p-1.5 text-center w-28">Records</th>
                        <th className="border border-black p-1.5 text-right w-36">Total Amount (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Parent Row 1: Staff Payroll */}
                      {hasPayroll && (
                        <>
                          <tr className="bg-slate-50 font-semibold">
                            <td className="border border-black p-1.5 text-center font-mono">{sNoExp++}</td>
                            <td className="border border-black p-1.5"><strong>Staff Payroll &amp; Salaries</strong></td>
                            <td className="border border-black p-1.5 text-center font-mono">{payrollDetails.length} Staff</td>
                            <td className="border border-black p-1.5 text-right font-mono font-bold text-black">
                              {payrollTotal.toLocaleString()}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="border border-black p-0 bg-white">
                              <table className="w-full table-fixed border-collapse text-[10px]">
                                <thead>
                                  <tr className="bg-slate-100">
                                    <th className="border border-black p-1 text-center w-[4%]">#</th>
                                    <th className="border border-black p-1 text-left w-[32%]">Staff Details</th>
                                    <th className="border border-black p-1 text-left w-[10%]">Month</th>
                                    <th className="border border-black p-1 text-right w-[8%]">Payable</th>
                                    <th className="border border-black p-1 text-right w-[8%]">Deductions</th>
                                    <th className="border border-black p-1 text-right w-[8%]">Allowances</th>
                                    <th className="border border-black p-1 text-right w-[10%] font-bold">Net Paid</th>
                                    <th className="border border-black p-1 text-left w-[10%]">Account</th>
                                    <th className="border border-black p-1 text-left w-[10%]">Disbursed By</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payrollDetails.map((p, idx) => (
                                    <tr key={idx}>
                                      <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                                      <td className="border border-black p-1 truncate"><strong>{p.staffName}</strong> <span className="text-slate-700">(Father: {p.fatherName || "—"}, ID: {p.employeeId || "—"})</span></td>
                                      <td className="border border-black p-1">{p.month || "—"}</td>
                                      <td className="border border-black p-1 text-right font-mono">{Number(p.payable || 0).toLocaleString()}</td>
                                      <td className="border border-black p-1 text-right font-mono">{Number(p.deductions || 0).toLocaleString()}</td>
                                      <td className="border border-black p-1 text-right font-mono">{Number(p.allowance || 0).toLocaleString()}</td>
                                      <td className="border border-black p-1 text-right font-mono font-bold">{Number(p.totalAmount || 0).toLocaleString()}</td>
                                      <td className="border border-black p-1 text-[9px] truncate">{p.walletName || "Cash in Hand"}</td>
                                      <td className="border border-black p-1 text-[9px] truncate">{p.disbursedBy || "Admin"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Parent Row 2: Other Expenses */}
                      {hasOtherExpense && (
                        <>
                          <tr className="bg-slate-50 font-semibold">
                            <td className="border border-black p-1.5 text-center font-mono">{sNoExp++}</td>
                            <td className="border border-black p-1.5"><strong>Other Operating Expenses</strong></td>
                            <td className="border border-black p-1.5 text-center font-mono">{otherExpenseDetails.length} Vouchers</td>
                            <td className="border border-black p-1.5 text-right font-mono font-bold text-black">
                              {otherExpenseTotal.toLocaleString()}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="border border-black p-0 bg-white">
                              <table className="w-full table-fixed border-collapse text-[10px]">
                                <thead>
                                  <tr className="bg-slate-100">
                                    <th className="border border-black p-1 text-center w-[4%]">#</th>
                                    <th className="border border-black p-1 text-left w-[15%]">Category</th>
                                    <th className="border border-black p-1 text-left w-[28%]">Description / Purpose</th>
                                    <th className="border border-black p-1 text-left w-[10%]">Voucher #</th>
                                    <th className="border border-black p-1 text-left w-[13%]">Vendor / Payee</th>
                                    <th className="border border-black p-1 text-left w-[10%]">Account</th>
                                    <th className="border border-black p-1 text-left w-[10%]">Disbursed By</th>
                                    <th className="border border-black p-1 text-right w-[10%] font-bold">Amount (Rs.)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {otherExpenseDetails.map((exp, idx) => (
                                    <tr key={idx}>
                                      <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                                      <td className="border border-black p-1 font-semibold truncate">{exp.category}</td>
                                      <td className="border border-black p-1 truncate">{exp.remarks || exp.title}</td>
                                      <td className="border border-black p-1 font-mono">#{exp.voucherNo}</td>
                                      <td className="border border-black p-1 truncate">{exp.vendor || "—"}</td>
                                      <td className="border border-black p-1 text-[9px] truncate">{exp.walletName || "Cash in Hand"}</td>
                                      <td className="border border-black p-1 text-[9px] truncate">{exp.disbursedBy || "Admin"}</td>
                                      <td className="border border-black p-1 text-right font-mono font-bold">{Number(exp.amount || 0).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Total Expenses Row */}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={3} className="border border-black p-1.5 text-right uppercase">
                          Total Expenses:
                        </td>
                        <td className="border border-black p-1.5 text-right font-mono text-black font-extrabold">
                          Rs. {totalExpenses.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Wallets on Date */}
            <div className="space-y-1.5">
              <div className="font-bold text-xs uppercase tracking-wider text-black">
                Treasury Accounts &amp; Wallets Holding on {closingMode === "DAILY" ? formatReportDate(closingDate || todayDateStr) : monthlyRange.monthName}
              </div>
              <table className="w-full table-fixed border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-slate-100 text-black text-[11px]">
                    <th className="border border-black p-1.5 text-center w-[5%]">S.No</th>
                    <th className="border border-black p-1.5 text-left w-[35%]">Account</th>
                    <th className="border border-black p-1.5 text-left w-[15%]">Type</th>
                    <th className="border border-black p-1.5 text-right w-[15%]">Inflow (+)</th>
                    <th className="border border-black p-1.5 text-right w-[15%]">Outflow (-)</th>
                    <th className="border border-black p-1.5 text-right w-[15%]">Net Holding</th>
                  </tr>
                </thead>
                <tbody>
                  {walletsDateBreakdown
                    .filter(w => Number(w.dateInflow || 0) > 0 || Number(w.dateOutflow || 0) > 0 || Math.abs(Number(w.dateNetBalance || 0)) > 0 || Number(w.currentBalance || 0) > 0)
                    .map((w, idx) => (
                    <tr key={idx}>
                      <td className="border border-black p-1.5 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black p-1.5 font-semibold truncate">{w.walletName}</td>
                      <td className="border border-black p-1.5 truncate">{w.walletType}</td>
                      <td className="border border-black p-1.5 text-right font-mono">
                        +{Number(w.dateInflow || 0).toLocaleString()}
                      </td>
                      <td className="border border-black p-1.5 text-right font-mono">
                        -{Number(w.dateOutflow || 0).toLocaleString()}
                      </td>
                      <td className="border border-black p-1.5 text-right font-mono font-bold">
                        {w.dateNetBalance >= 0 ? "+" : ""}Rs. {Number(w.dateNetBalance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={3} className="border border-black p-1.5 text-right uppercase">Total Reconciliation:</td>
                    <td className="border border-black p-1.5 text-right font-mono">+Rs. {walletsSumInflow.toLocaleString()}</td>
                    <td className="border border-black p-1.5 text-right font-mono">-Rs. {walletsSumOutflow.toLocaleString()}</td>
                    <td className="border border-black p-1.5 text-right font-mono">Rs. {walletsSumNet.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signature Block (Full-width: Left, Center, Right) */}
            <table className="w-full mt-10 border-none border-collapse text-xs text-black">
              <tbody>
                <tr>
                  <td className="w-1/3 text-left border-none p-0 align-top">
                    <div className="border-t-2 border-black w-36 text-center pt-1 font-bold">
                      Prepared By (Accountant)
                    </div>
                  </td>
                  <td className="w-1/3 text-center border-none p-0 align-top">
                    <div className="border-t-2 border-black w-36 mx-auto text-center pt-1 font-bold">
                      Verified By (Finance Mgr)
                    </div>
                  </td>
                  <td className="w-1/3 text-right border-none p-0 align-top">
                    <div className="border-t-2 border-black w-36 ml-auto text-center pt-1 font-bold">
                      Approved By (Principal)
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
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
