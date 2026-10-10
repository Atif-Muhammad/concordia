import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, SaveAll, CheckCircle, Printer, MoreHorizontal, Eye, Info, CalendarPlus, CreditCard, Clock3, Wallet, History, AlertTriangle, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { generatePayroll, getMissingPayrollStaff, getPayrollSheet, recordPayrollPayment, upsertPayroll, getPayrollTemplates, getPayrollHistory, getWallets, deductPayrollFromWallet, getPayrollDeductionLogs } from "../../config/apis";
import usePermissions from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { MonthPicker } from "@/components/ui/month-picker";
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

const PayrollManagementDialog = ({ open, onOpenChange }) => {
  const { canCreate, canUpdate, canDelete } = usePermissions("HR & Payroll", "payroll");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState("all");
  const [dismissedMissing, setDismissedMissing] = useState(false);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [paymentRow, setPaymentRow] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentMethod: "Cash", remarks: "", paymentDate: new Date().toISOString().split("T")[0], transactionId: "", chequeNumber: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Wallets data
  const { data: walletData } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
    enabled: open,
  });
  const wallets = useMemo(() => {
    const list = walletData?.wallets || [];
    return list.filter((w) => w.status === "ACTIVE");
  }, [walletData]);

  // Wallet payment dialog state
  const [walletPaymentDialogOpen, setWalletPaymentDialogOpen] = useState(false);
  const [walletPaymentTarget, setWalletPaymentTarget] = useState(null);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [walletPaymentDate, setWalletPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [walletPaymentReference, setWalletPaymentReference] = useState("");
  const [walletPaymentRemarks, setWalletPaymentRemarks] = useState("");

  // Month-wise deduction logs dialog state
  const [walletLogsDialogOpen, setWalletLogsDialogOpen] = useState(false);
  const [walletLogMonthFilter, setWalletLogMonthFilter] = useState("all");
  const [walletLogWalletFilter, setWalletLogWalletFilter] = useState("all");
  const [selectedLogForDetail, setSelectedLogForDetail] = useState(null);

  // Deduction logs query
  const { data: deductionLogsData, isLoading: isLogsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["payrollDeductionLogs", walletLogMonthFilter, walletLogWalletFilter],
    queryFn: () => getPayrollDeductionLogs({
      month: walletLogMonthFilter === "all" ? undefined : walletLogMonthFilter,
      walletId: walletLogWalletFilter === "all" ? undefined : walletLogWalletFilter,
    }),
    enabled: open && walletLogsDialogOpen,
  });
  const deductionLogs = deductionLogsData?.logs || [];

  const {
    data: payrollData = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["payrollSheet", month, activeTab],
    queryFn: () => getPayrollSheet(month, activeTab),
    enabled: open,
  });

  const { data: missingStaff = [], refetch: refetchMissing } = useQuery({
    queryKey: ["missingPayrollStaff", month, activeTab],
    queryFn: () => getMissingPayrollStaff(month, activeTab),
    enabled: open,
  });

  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    if (open) {
      getPayrollTemplates().then(data => {
        console.log("Fetched Payroll Templates:", data);
        setTemplates(data);
      }).catch(console.error);
    }
  }, [open]);

  const upsertMutation = useMutation({
    mutationFn: upsertPayroll,
    onSuccess: () => {
      toast({ title: "Payroll updated successfully" });
      queryClient.invalidateQueries(["payrollSheet", month, activeTab]);
      refetch();
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: generatePayroll,
    onSuccess: (result) => {
      toast({
        title: `Generated: ${result.generatedCount || 0} | Regenerated: ${result.regeneratedCount || 0} | Skipped Locked: ${result.skippedLockedCount || 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ["payrollSheet", month, activeTab] });
      queryClient.invalidateQueries({ queryKey: ["missingPayrollStaff", month, activeTab] });
      queryClient.invalidateQueries({ queryKey: ["advanceSalaries"] });
      setDismissedMissing(false);
      setSelectedRows(new Set());
      refetch();
      refetchMissing();
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ payrollId, data }) => recordPayrollPayment(payrollId, data),
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      queryClient.invalidateQueries({ queryKey: ["payrollSheet", month, activeTab] });
      queryClient.invalidateQueries({ queryKey: ["advanceSalaries"] });
      setPaymentRow(null);
      setPaymentForm({ amount: "", paymentMethod: "Cash", remarks: "", paymentDate: new Date().toISOString().split("T")[0], transactionId: "", chequeNumber: "" });
      refetch();
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const walletDeductionMutation = useMutation({
    mutationFn: deductPayrollFromWallet,
    onSuccess: (res) => {
      toast({
        title: "Disbursement Successful",
        description: `Successfully disbursed PKR ${Number(res.totalAmount || 0).toLocaleString()} from ${res.wallet?.name || "wallet"} for ${res.count || 0} staff.`
      });
      queryClient.invalidateQueries({ queryKey: ["payrollSheet"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      queryClient.invalidateQueries({ queryKey: ["advanceSalaries"] });
      queryClient.invalidateQueries({ queryKey: ["payrollDeductionLogs"] });
      setWalletPaymentDialogOpen(false);
      setWalletPaymentTarget(null);
      setSelectedRows(new Set());
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Payment Error",
        description: err.message || "Failed to process payroll wallet deduction",
        variant: "destructive"
      });
    }
  });

  // Bulk save functionality
  const [isSaving, setIsSaving] = useState(false);

  const handleBulkSave = async () => {
    setIsSaving(true);
    try {
      for (const row of localData.filter((item) => item.status !== "PAID")) {
        await upsertMutation.mutateAsync({
          id: row.payrollId || row._id || row.id,
          month,
          baseSalary: Number(row.baseSalary ?? row.basicSalary) || 0,
          currentSalary: Number(row.currentSalary ?? row.basicSalary) || 0,
          basicSalary: Number(row.baseSalary ?? row.basicSalary) || 0,
          securityDeduction: Number(row.securityDeduction) || 0,
          advanceDeduction: Number(row.advanceDeduction) || 0,
          absentDeduction: Number(row.absentDeduction) || 0,
          leaveDeduction: Number(row.leaveDeduction) || 0,
          otherDeduction: Number(row.otherDeduction) || 0,
          incomeTax: Number(row.incomeTax) || 0,
          eobi: Number(row.eobi) || 0,
          lateArrivalDeduction: Number(row.lateArrivalDeduction) || 0,
          extraAllowance: Number(row.extraAllowance) || 0,
          travelAllowance: Number(row.travelAllowance) || 0,
          houseRentAllowance: Number(row.houseRentAllowance) || 0,
          medicalAllowance: Number(row.medicalAllowance) || 0,
          insuranceAllowance: Number(row.insuranceAllowance) || 0,
          otherAllowance: Number(row.otherAllowance) || 0,
          staffId: row.staffIdRaw || row.staffId?._id || row.staffId?.id || row.id,
        });
      }
      toast({ title: "All payroll records saved successfully" });
      queryClient.invalidateQueries(["payrollSheet", month, activeTab]);
      refetch();
    } catch (error) {
      toast({
        title: error.message || "Failed to save payrolls",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Checkbox selection state
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Handle select all
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(new Set(localData.map((_, index) => index)));
    } else {
      setSelectedRows(new Set());
    }
  };

  // Handle individual row selection
  const handleRowSelect = (index, checked) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(index);
    } else {
      newSelected.delete(index);
    }
    setSelectedRows(newSelected);
  };

  const handleGeneratePayroll = () => {
    generateMutation.mutate({ month, type: activeTab });
  };

  const handleRegenerateSelected = () => {
    const selectedStaffIds = Array.from(selectedRows)
      .map((index) => localData[index])
      .map((row) => row.staffIdRaw || row.staffId?._id || row.staffId?.id || row.id)
      .filter(Boolean);

    if (selectedStaffIds.length === 0) {
      toast({
        title: "No staff selected",
        description: "Please select at least one staff member via checkbox to re-generate payroll.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      month,
      type: activeTab,
      staffIds: selectedStaffIds,
    });
  };

  const handleGenerateOrRegenerate = () => {
    if (localData.length > 0) {
      if (selectedRows.size === 0) {
        toast({
          title: "Select staff to re-generate",
          description: "Please select staff member(s) via checkbox to re-generate payroll.",
          variant: "destructive",
        });
        return;
      }
      setConfirmRegenerateOpen(true);
      return;
    }
    handleGeneratePayroll();
  };

  const handleAddMissingStaff = () => {
    generateMutation.mutate({
      month,
      type: activeTab,
      staffIds: missingStaff.map((staff) => staff.id),
    });
  };

  const handleOpenBulkWalletPayment = () => {
    const rows = Array.from(selectedRows)
      .map((index) => localData[index])
      .filter((row) => row?.status !== "PAID" && Number(row.balanceAmount ?? row.netSalary ?? 0) > 0);

    if (rows.length === 0) {
      toast({
        title: "No unpaid staff selected",
        description: "Please select one or more staff members with pending balance.",
        variant: "destructive",
      });
      return;
    }

    const defaultWallet = wallets[0];
    setWalletPaymentTarget({ type: "bulk", rows });
    setSelectedWalletId(defaultWallet?.id || defaultWallet?._id || "");
    setWalletPaymentRemarks(`Bulk payroll disbursement for ${month} (${rows.length} staff)`);
    setWalletPaymentDate(new Date().toISOString().split("T")[0]);
    setWalletPaymentReference("");
    setWalletPaymentDialogOpen(true);
  };

  const handleOpenSingleWalletPayment = (row, full = false) => {
    const netSalary = Number(row.netSalary ?? 0);
    const balance = Number(row.balanceAmount ?? (row.status === "PAID" ? 0 : netSalary));
    const dueAmount = full ? (balance > 0 ? balance : netSalary) : balance;

    const defaultWallet = wallets[0];
    setWalletPaymentTarget({
      type: "single",
      row,
      amount: dueAmount,
      isFull: full
    });
    setSelectedWalletId(defaultWallet?.id || defaultWallet?._id || "");
    setWalletPaymentRemarks(full ? `Full salary payment for ${row.name}` : `Salary payment for ${row.name}`);
    setWalletPaymentDate(new Date().toISOString().split("T")[0]);
    setWalletPaymentReference("");
    setWalletPaymentDialogOpen(true);
  };

  const activeSelectedWallet = useMemo(() => {
    return wallets.find((w) => w.id === selectedWalletId || String(w._id) === String(selectedWalletId)) || null;
  }, [wallets, selectedWalletId]);

  const totalDeductionAmount = useMemo(() => {
    if (!walletPaymentTarget) return 0;
    if (walletPaymentTarget.type === "bulk") {
      return (walletPaymentTarget.rows || []).reduce(
        (sum, r) => sum + Number(r.balanceAmount ?? r.netSalary ?? 0),
        0
      );
    }
    return Number(walletPaymentTarget.amount || 0);
  }, [walletPaymentTarget]);

  const currentWalletBalance = Number(activeSelectedWallet?.currentBalance || 0);
  const projectedWalletBalance = currentWalletBalance - totalDeductionAmount;

  const handleConfirmWalletPayment = () => {
    if (!selectedWalletId) {
      toast({ title: "Please select a wallet / account", variant: "destructive" });
      return;
    }

    if (!walletPaymentTarget) return;

    let totalAmount = 0;
    let staffDetails = [];

    if (walletPaymentTarget.type === "bulk") {
      const rows = walletPaymentTarget.rows || [];
      staffDetails = rows.map((r) => {
        const amt = Number(r.balanceAmount ?? r.netSalary ?? 0);
        return {
          payrollId: r.payrollId || r._id || r.id,
          staffId: r.staffIdRaw || r.staffId?._id || r.staffId?.id || r.staffId || r.id,
          name: r.name || r.staffName || "Staff Member",
          designation: r.designation || (r.isTeaching ? "Teacher" : "Staff"),
          amount: amt,
          month: r.month || month,
        };
      });
      totalAmount = staffDetails.reduce((sum, s) => sum + s.amount, 0);
    } else if (walletPaymentTarget.type === "single") {
      const r = walletPaymentTarget.row;
      const amt = Number(walletPaymentTarget.amount || 0);
      if (amt <= 0) {
        toast({ title: "Payment amount must be greater than zero", variant: "destructive" });
        return;
      }
      staffDetails = [{
        payrollId: r.payrollId || r._id || r.id,
        staffId: r.staffIdRaw || r.staffId?._id || r.staffId?.id || r.staffId || r.id,
        name: r.name || r.staffName || "Staff Member",
        designation: r.designation || (r.isTeaching ? "Teacher" : "Staff"),
        amount: amt,
        month: r.month || month,
      }];
      totalAmount = amt;
    }

    if (totalAmount <= 0) {
      toast({ title: "Total payment amount must be greater than zero", variant: "destructive" });
      return;
    }

    walletDeductionMutation.mutate({
      walletId: selectedWalletId,
      totalAmount,
      payrollMonth: month,
      date: walletPaymentDate,
      remarks: walletPaymentRemarks,
      referenceNo: walletPaymentReference,
      staffDetails,
    });
  };

  const handleBulkMarkPaid = handleOpenBulkWalletPayment;
  const openPaymentDialog = handleOpenSingleWalletPayment;

  const handleRecordPayment = () => {
    if (!paymentRow) return;
    const targetId = paymentRow.payrollId || paymentRow._id || paymentRow.id;
    if (!targetId) {
      toast({ title: "Payroll record ID missing", variant: "destructive" });
      return;
    }
    const payAmount = Number(paymentForm.amount || 0);
    if (payAmount <= 0) {
      toast({ title: "Payment amount must be greater than zero", variant: "destructive" });
      return;
    }
    paymentMutation.mutate({
      payrollId: targetId,
      data: {
        amount: payAmount,
        paymentMethod: paymentForm.paymentMethod,
        paidBy: paymentForm.paymentMethod,
        remarks: paymentForm.remarks,
        paymentDate: paymentForm.paymentDate,
        transactionId: paymentForm.transactionId,
        chequeNumber: paymentForm.chequeNumber,
      },
    });
  };

  // Preview state
  const [previewHtml, setPreviewHtml] = useState(null);

  // Print individual payslip (Salary Slip)
  const handlePrintPayslip = (row) => {
    // 1. Try Specific (Default)
    let template = templates.find(t => (t.type || '').toUpperCase().includes('SLIP') && t.isDefault);

    // 2. Try Specific (Any)
    if (!template) {
      template = templates.find(t => (t.type || '').toUpperCase().includes('SLIP'));
    }

    // 3. Fallback to ANY template if nothing else works (Fail-safe)
    if (!template && templates.length > 0) {
      console.warn("No 'SLIP' template found. Falling back to first available template.");
      template = templates[0];
    }

    console.log("Selected Template:", template);

    const htmlContent = generatePayslipHtml(template, row, "Salary Slip");
    const printWindow = window.open("", "", "width=800,height=600");
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePreviewPayslip = (row) => {
    // 1. Try Specific (Default)
    let template = templates.find(t => (t.type || '').toUpperCase().includes('SLIP') && t.isDefault);

    // 2. Try Specific (Any)
    if (!template) {
      template = templates.find(t => (t.type || '').toUpperCase().includes('SLIP'));
    }

    // 3. Fallback to ANY template if nothing else works (Fail-safe)
    if (!template && templates.length > 0) {
      console.warn("No 'SLIP' template found. Falling back to first available template.");
      template = templates[0];
    }

    const htmlContent = generatePayslipHtml(template, row, "Salary Slip Preview");
    setPreviewHtml(htmlContent);
  };

  const generatePayslipHtml = (template, row, title) => {
    let htmlContent = "";
    if (template) {
      let content = template.htmlContent || "";
      // Basic check if it looks like HTML
      if (!content.trim().startsWith("<")) {
        content = `<div style="white-space: pre-wrap; font-family: monospace;">${content}</div>`;
      }

      htmlContent = content
        .replace(/{{name}}/g, row.name)
        .replace(/{{id}}/g, row.id)
        .replace(/{{designation}}/g, row.designation)
        .replace(/{{department}}/g, row.department)
        .replace(/{{month}}/g, new Date(month).toLocaleString("default", { month: "long", year: "numeric" }))
        .replace(/{{basicSalary}}/g, Number(row.baseSalary ?? row.basicSalary ?? 0).toLocaleString())
        .replace(/{{baseSalary}}/g, Number(row.baseSalary ?? row.basicSalary ?? 0).toLocaleString())
        .replace(/{{currentSalary}}/g, Number(row.currentSalary ?? row.basicSalary ?? 0).toLocaleString())
        .replace(/{{securityDeduction}}/g, Number(row.securityDeduction).toLocaleString())
        .replace(/{{advanceDeduction}}/g, Number(row.advanceDeduction).toLocaleString())
        .replace(/{{absentDeduction}}/g, Number(row.absentDeduction).toLocaleString())
        .replace(/{{leaveDeduction}}/g, Number(row.leaveDeduction).toLocaleString())
        .replace(/{{otherDeduction}}/g, Number(row.otherDeduction).toLocaleString())
        .replace(/{{incomeTax}}/g, Number(row.incomeTax).toLocaleString())
        .replace(/{{eobi}}/g, Number(row.eobi).toLocaleString())
        .replace(/{{lateArrivalDeduction}}/g, Number(row.lateArrivalDeduction).toLocaleString())
        .replace(/{{totalDeductions}}/g, Number(row.totalDeductions).toLocaleString())
        .replace(/{{extraAllowance}}/g, Number(row.extraAllowance).toLocaleString())
        .replace(/{{travelAllowance}}/g, Number(row.travelAllowance).toLocaleString())
        .replace(/{{houseRentAllowance}}/g, Number(row.houseRentAllowance).toLocaleString())
        .replace(/{{medicalAllowance}}/g, Number(row.medicalAllowance).toLocaleString())
        .replace(/{{insuranceAllowance}}/g, Number(row.insuranceAllowance).toLocaleString())
        .replace(/{{otherAllowance}}/g, Number(row.otherAllowance).toLocaleString())
        .replace(/{{totalAllowances}}/g, Number(row.totalAllowances).toLocaleString())
        .replace(/{{netSalary}}/g, Number(row.netSalary).toLocaleString())
        .replace(/{{status}}/g, row.status)
        .replace(/{{paymentDate}}/g, row.paymentDate || "N/A");
    } else {
      htmlContent = `
            <html>
                <head><title>${title}</title></head>
                <body>
                    <div style="text-align: center; padding: 20px;">
                        <h1>${title}</h1>
                        <p style="color: red; font-weight: bold;">CRITICAL ERROR: No Template Object Selected.</p>
                        <p>We tried finding 'SLIP'. We tried falling back to [0]. Nothing worked.</p>
                        <p>Employee: ${row.name}</p>
                        <hr/>
                        <p style="color: grey; font-size: 12px; white-space: pre-wrap; text-align: left;">
                            Debug Info:<br/>
                            Templates Loaded: ${templates.length}<br/>
                            Raw Data: ${JSON.stringify(templates, null, 2)}
                        </p>
                    </div>
                </body>
            </html>
        `;
    }
    return htmlContent;
  }

  // Payroll Print (History)
  const handlePrintPayrollDetails = async (row) => {
    try {
      const historyData = await getPayrollHistory(row.id, row.isTeaching ? 'teacher' : 'all');

      let template = templates.find(t => (t.type || '').toUpperCase().includes('SHEET') && t.isDefault);
      if (!template) {
        template = templates.find(t => (t.type || '').toUpperCase().includes('SHEET'));
      }
      if (!template && templates.length > 0) {
        template = templates[0];
      }

      const htmlContent = generateSheetHtml(template, historyData, `Payroll History - ${row.name}`);

      const printWindow = window.open("", "", "width=1000,height=800");
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      // Wait for images/styles to load then print
      setTimeout(() => {
        printWindow.print();
      }, 500);

    } catch (error) {
      console.error("Failed to fetch payroll history", error);
      toast({ title: "Failed to load history", variant: "destructive" });
    }
  };

  const printTemplate = (template, row, title) => {
    // Deprecated in favor of generatePayslipHtml separation
  }




  // Print monthly sheet
  const handlePrintMonth = () => {
    let template = templates.find(t => (t.type || '').toUpperCase().includes('SHEET') && t.isDefault);
    if (!template) {
      template = templates.find(t => (t.type || '').toUpperCase().includes('SHEET'));
    }
    if (!template && templates.length > 0) {
      template = templates[0];
    }
    const htmlContent = generateSheetHtml(template);

    const printWindow = window.open("", "", "width=1000,height=800");
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePreviewSheet = () => {
    let template = templates.find(t => (t.type || '').toUpperCase().includes('SHEET') && t.isDefault);
    if (!template) {
      template = templates.find(t => (t.type || '').toUpperCase().includes('SHEET'));
    }
    if (!template && templates.length > 0) {
      template = templates[0];
    }
    const htmlContent = generateSheetHtml(template);
    setPreviewHtml(htmlContent);
  };

  const generateSheetHtml = (template, data = null, customTitle = null) => {
    // data allows overriding (e.g. for history print)
    const isHistory = !!data; // true when printing history for a single employee
    const rawData = data || localData;
    const title = customTitle || new Date(month).toLocaleString("default", { month: "long", year: "numeric" });

    // Normalize rows – history data has name/designation under populated staffId
    const rowsData = rawData.map(row => ({
      ...row,
      name: row.name || row.staffId?.name || "Unknown",
      designation: row.designation || row.staffId?.designation || row.staffId?.specialization || "",
      baseSalary: Number(row.baseSalary ?? row.basicSalary ?? 0),
      currentSalary: Number(row.currentSalary ?? row.basicSalary ?? 0),
      totalAllowances: Number(row.totalAllowances || 0),
      totalDeductions: Number(row.totalDeductions || 0),
      netSalary: Number(row.netSalary || 0),
    }));

    // Format month string for history rows (e.g. "2025-06" → "June 2025")
    const formatMonth = (m) => {
      if (!m) return "";
      try { return new Date(m + "-15").toLocaleString("default", { month: "long", year: "numeric" }); }
      catch { return m; }
    };

    // Generate rows HTML – 8 columns matching template header
    // (Sr, Employee Name / Month, Designation, Basic Salary, Incremented Salary, Allowances, Deductions, Total Payable)
    const rowsHtml = rowsData.map((row, index) => `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>${isHistory ? formatMonth(row.month) : row.name}</td>
        <td>${row.designation}</td>
        <td class="text-right">${row.baseSalary.toLocaleString()}</td>
        <td class="text-right"><strong>${row.currentSalary.toLocaleString()}</strong></td>
        <td class="text-right">${row.totalAllowances.toLocaleString()}</td>
        <td class="text-right">${row.totalDeductions.toLocaleString()}</td>
        <td class="text-right"><strong>${row.netSalary.toLocaleString()}</strong></td>
      </tr>
    `).join("");

    let htmlContent = "";
    if (template) {
      let content = template.htmlContent || "";
      if (!content.trim().startsWith("<")) {
        content = `<div style="white-space: pre-wrap; font-family: monospace;">${content}</div>`;
      }

      htmlContent = content
        .replace(/{{month}}/g, title) // Use title instead of month for flexibility
        .replace(/{{rows}}/g, rowsHtml)
        .replace(/{{totalBasicSalary}}/g, rowsData.reduce((sum, row) => sum + Number(row.baseSalary ?? row.basicSalary ?? 0), 0).toLocaleString())
        .replace(/{{totalCurrentSalary}}/g, rowsData.reduce((sum, row) => sum + Number(row.currentSalary ?? row.basicSalary ?? 0), 0).toLocaleString())
        .replace(/{{totalAllowances}}/g, rowsData.reduce((sum, row) => sum + Number(row.totalAllowances), 0).toLocaleString())
        .replace(/{{totalDeductions}}/g, rowsData.reduce((sum, row) => sum + Number(row.totalDeductions), 0).toLocaleString())
        .replace(/{{totalNetSalary}}/g, rowsData.reduce((sum, row) => sum + Number(row.netSalary), 0).toLocaleString());
    } else {
      // Fallback
      htmlContent = `
            <html>
                <head><title>Payroll Sheet</title></head>
                <body>
                    <div style="text-align: center; padding: 20px;">
                        <h1>Payroll Sheet - ${new Date(month).toLocaleString("default", { month: "long", year: "numeric" })}</h1>
                        <p style="color: red;">CRITICAL ERROR: No Template Found.</p>
                        <hr/>
                        <p style="color: gray; font-size: 10px; white-space: pre-wrap; text-align: left;">
                            <strong>Debug Info:</strong><br/>
                            Loaded Templates: ${templates.length}<br/>
                            Raw Data: ${JSON.stringify(templates, null, 2)}
                        </p>
                    </div>
                </body>
            </html>
        `;
    }
    return htmlContent;
  };

  // Local state to handle input changes before saving
  const [localData, setLocalData] = useState([]);

  useEffect(() => {
    if (payrollData && payrollData.length > 0) {
      // Ensure all numeric fields and identifiers are properly initialized
      const initializedData = payrollData.map((row) => {
        const baseSalary = Number(row.baseSalary ?? row.basicSalary ?? 0);
        const currentSalary = Number(row.currentSalary ?? row.basicSalary ?? 0);
        const totalDeductions = Number(row.totalDeductions || 0);
        const totalAllowances = Number(row.totalAllowances || 0);
        const netSalary = Number(
          row.netSalary ?? Math.max(0, currentSalary + totalAllowances - totalDeductions)
        );
        const paidAmount = Number(
          row.paidAmount ||
            (Array.isArray(row.payments)
              ? row.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
              : 0)
        );
        const balanceAmount =
          row.status === "PAID"
            ? 0
            : Number(row.balanceAmount ?? Math.max(0, netSalary - paidAmount));

        return {
          ...row,
          name: row.name || row.staffId?.name || "Unknown Staff",
          designation: row.designation || row.staffId?.designation || "",
          department: row.department || row.staffId?.empDepartment || row.staffId?.departmentId?.name || "",
          roleLabel: row.roleLabel || (row.staffId?.isTeaching ? "Teaching" : "Non-Teaching"),
          payrollId: row.payrollId || row._id || row.id,
          baseSalary,
          currentSalary,
          basicSalary: baseSalary,
          securityDeduction: Number(row.securityDeduction || 0),
          advanceDeduction: Number(row.advanceDeduction || 0),
          absentDeduction: Number(row.absentDeduction || 0),
          absentCount: Number(row.absentCount || 0),
          absentRate: Number(row.absentRate || 0),
          leaveDeduction: Number(row.leaveDeduction || 0),
          leaveBreakdown: row.leaveBreakdown || null,
          otherDeduction: Number(row.otherDeduction || 0),
          incomeTax: Number(row.incomeTax || 0),
          eobi: Number(row.eobi || 0),
          lateArrivalDeduction: Number(row.lateArrivalDeduction || 0),
          totalDeductions,
          extraAllowance: Number(row.extraAllowance || 0),
          travelAllowance: Number(row.travelAllowance || 0),
          houseRentAllowance: Number(row.houseRentAllowance || 0),
          medicalAllowance: Number(row.medicalAllowance || 0),
          insuranceAllowance: Number(row.insuranceAllowance || 0),
          otherAllowance: Number(row.otherAllowance || 0),
          totalAllowances,
          netSalary,
          paidAmount,
          balanceAmount,
        };
      });
      setLocalData(initializedData);
    } else {
      setLocalData([]);
    }
  }, [payrollData]);

  // Reset selections when data changes
  useEffect(() => {
    setSelectedRows(new Set());
    setDismissedMissing(false);
  }, [localData.length, month, activeTab]);

  // Handle input changes and recalculate totals
  const handleInputChange = (index, field, value) => {
    const newData = [...localData];

    // Parse the value
    const numValue = Number(value) || 0;

    // Update the specific field
    newData[index][field] = numValue;

    // Recalculate totals based on what changed
    if (['securityDeduction', 'advanceDeduction', 'absentDeduction', 'leaveDeduction', 'otherDeduction', 'incomeTax', 'eobi', 'lateArrivalDeduction'].includes(field)) {
      newData[index].totalDeductions =
        Number(newData[index].securityDeduction || 0) +
        Number(newData[index].advanceDeduction || 0) +
        Number(newData[index].absentDeduction || 0) +
        Number(newData[index].leaveDeduction || 0) +
        Number(newData[index].otherDeduction || 0) +
        Number(newData[index].incomeTax || 0) +
        Number(newData[index].eobi || 0) +
        Number(newData[index].lateArrivalDeduction || 0);
    }
    else if (['extraAllowance', 'travelAllowance', 'otherAllowance', 'houseRentAllowance', 'medicalAllowance', 'insuranceAllowance'].includes(field)) {
      newData[index].totalAllowances =
        Number(newData[index].extraAllowance || 0) +
        Number(newData[index].travelAllowance || 0) +
        Number(newData[index].otherAllowance || 0) +
        Number(newData[index].houseRentAllowance || 0) +
        Number(newData[index].medicalAllowance || 0) +
        Number(newData[index].insuranceAllowance || 0);
    }

    // Always recalculate net salary using currentSalary as center of attraction
    const salaryBase = Number(newData[index].currentSalary ?? newData[index].basicSalary ?? 0);
    newData[index].netSalary =
      salaryBase -
      Number(newData[index].totalDeductions || 0) +
      Number(newData[index].totalAllowances || 0);

    // Ensure net salary is not negative
    if (newData[index].netSalary < 0) {
      newData[index].netSalary = 0;
    }

    // Recalculate balance amount against already paid amount
    newData[index].balanceAmount = Math.max(
      0,
      newData[index].netSalary - Number(newData[index].paidAmount || 0)
    );

    setLocalData(newData);
  };

  const renderAuditIcon = (row, field) => {
    const audit = row?.amountAudit?.[field];
    const fallbackAt = row?.auditFallbackAt ? new Date(row.auditFallbackAt).toLocaleString() : null;
    const fallbackBy = row?.auditFallbackByName || "Unknown";
    if (!audit?.at && !fallbackAt) return null;
    const label = audit?.at
      ? `${audit.byName || "Unknown"} - ${new Date(audit.at).toLocaleString()}`
      : `${fallbackBy} - ${fallbackAt}`;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Clock3 className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };
  return (
    <div className="w-full h-full flex flex-col min-h-[600px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs font-semibold">Month:</Label>
            <div className="w-40 sm:w-44">
              <MonthPicker
                value={month}
                onChange={(val) => {
                  if (val) setMonth(val);
                }}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs font-semibold">Role:</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-36 sm:w-40 h-9 text-xs">
                <SelectValue placeholder="All Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="employee">Non-Teaching Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
          {(canCreate || canUpdate) && (
            <Button
              onClick={handleGenerateOrRegenerate}
              disabled={generateMutation.isPending}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              {generateMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
              )}
              {localData.length > 0
                ? `Re-generate${selectedRows.size > 0 ? ` (${selectedRows.size})` : ""}`
                : "Generate Payroll"}
            </Button>
          )}
          <Button onClick={handlePrintMonth} variant="outline" size="sm" disabled={localData.length === 0} className="flex-1 sm:flex-initial">
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
          <Button onClick={handlePreviewSheet} variant="outline" size="sm" disabled={localData.length === 0} className="flex-1 sm:flex-initial">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Preview
          </Button>
          {canUpdate && (
            <Button
              onClick={handleBulkMarkPaid}
              disabled={selectedRows.size === 0}
              variant="outline"
              size="sm"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 flex-1 sm:flex-initial"
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              Paid ({selectedRows.size})
            </Button>
          )}
          <Button
            onClick={() => setWalletLogsDialogOpen(true)}
            variant="outline"
            size="sm"
            className="text-primary hover:text-primary hover:bg-primary/10 border-primary/30 flex-1 sm:flex-initial"
          >
            <Wallet className="mr-1.5 h-3.5 w-3.5" />
            Logs
          </Button>
          {canUpdate && (
            <Button onClick={handleBulkSave} disabled={isSaving} size="sm" className="w-full sm:w-auto font-medium">
              {isSaving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <SaveAll className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save All
            </Button>
          )}
        </div>
      </div>

      {localData.length > 0 && missingStaff.length > 0 && !dismissedMissing && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-medium">New staff detected without payroll for this month.</div>
            <div className="text-xs sm:text-sm">{missingStaff.length} staff member(s) can be added to {new Date(`${month}-01`).toLocaleString("default", { month: "long", year: "numeric" })} payroll.</div>
          </div>
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            {(canCreate || canUpdate) && (
              <Button size="sm" onClick={handleAddMissingStaff} disabled={generateMutation.isPending} className="flex-1 sm:flex-initial">
                Add to Payroll
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDismissedMissing(true)} className="flex-1 sm:flex-initial">
              Not Now
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto border rounded-md">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : localData.length === 0 ? (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center gap-4 text-center p-8">
            <div>
              <div className="text-lg font-semibold">No payroll generated for this month</div>
              <div className="text-sm text-muted-foreground mt-1">
                Select the month and staff type, then generate payroll when you are ready.
              </div>
            </div>
            {canCreate && (
              <Button onClick={handleGeneratePayroll} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarPlus className="mr-2 h-4 w-4" />
                )}
                Generate Payroll
              </Button>
            )}
          </div>
        ) : (
          <Table className="min-w-[2400px]">
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="py-2 px-1 text-center w-[36px] min-w-[36px] max-w-[36px] md:sticky md:left-0 md:z-20 bg-background">
                  <Checkbox
                    checked={
                      selectedRows.size === localData.length &&
                      localData.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="py-2 px-2 text-xs font-semibold w-[130px] min-w-[130px] max-w-[130px] md:sticky md:left-[36px] md:z-20 bg-background">
                  Staff Details
                </TableHead>
                <TableHead className="py-2 px-1 text-xs w-[80px] min-w-[80px] max-w-[80px] md:sticky md:left-[166px] md:z-20 bg-background whitespace-nowrap">Basic Pay</TableHead>
                <TableHead className="py-2 px-1 text-xs w-[85px] min-w-[85px] max-w-[85px] font-semibold text-primary md:sticky md:left-[246px] md:z-20 bg-background whitespace-nowrap md:shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]">Current Salary</TableHead>

                <TableHead
                  className="py-2 px-3 text-sm text-center border-l-2 border-red-400 bg-red-100 dark:bg-red-950/40 dark:border-red-700"
                  colSpan={9}
                >
                  Deductions (PKR)
                </TableHead>

                <TableHead
                  className="py-2 px-3 text-sm text-center border-l-2 border-green-400 bg-green-100 dark:bg-green-950/40 dark:border-green-700"
                  colSpan={7}
                >
                  Allowances (PKR)
                </TableHead>

                <TableHead className="py-2 px-3 text-sm min-w-[100px] border-l font-bold">
                  Net Salary
                </TableHead>
                <TableHead className="py-2 px-3 text-sm min-w-[100px]">Status</TableHead>
                <TableHead className="py-2 px-3 text-sm min-w-[50px]"></TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="md:sticky md:left-0 md:z-20 bg-background w-[36px] min-w-[36px] max-w-[36px]"></TableHead>
                <TableHead className="md:sticky md:left-[36px] md:z-20 bg-background w-[130px] min-w-[130px] max-w-[130px]"></TableHead>
                <TableHead className="md:sticky md:left-[166px] md:z-20 bg-background w-[80px] min-w-[80px] max-w-[80px]"></TableHead>
                <TableHead className="md:sticky md:left-[246px] md:z-20 bg-background w-[85px] min-w-[85px] max-w-[85px] md:shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]"></TableHead>

                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 border-r border-red-200 dark:border-red-800">
                  Security
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 border-r border-red-200 dark:border-red-800">
                  Advance
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 border-r border-red-200 dark:border-red-800">
                  Absent
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 border-r border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-1">
                    Leave
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[180px]">
                        Deduction for excess leaves (casual + sick + annual combined)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 border-r border-red-200 dark:border-red-800">
                  Other
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 border-r border-red-200 dark:border-red-800">
                  Tax
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 border-r border-red-200 dark:border-red-800">
                  EOBI
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 border-r border-red-200 dark:border-red-800">
                  Late
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/40 font-bold border-r-2 border-red-400 dark:border-red-700">
                  Total
                </TableHead>

                <TableHead className="py-2 px-3 text-sm bg-green-100 dark:bg-green-950/40 border-r border-green-200 dark:border-green-800">
                  Extra
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-green-100 dark:bg-green-950/40 border-r border-green-200 dark:border-green-800">
                  Travel
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-green-100 dark:bg-green-950/40 border-r border-green-200 dark:border-green-800">
                  Other
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-green-100 dark:bg-green-950/40 border-r border-green-200 dark:border-green-800">
                  House Rent
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-green-100 dark:bg-green-950/40 border-r border-green-200 dark:border-green-800">
                  Medical
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-green-100 dark:bg-green-950/40 border-r border-green-200 dark:border-green-800">
                  Insurance
                </TableHead>
                <TableHead className="py-2 px-3 text-sm bg-green-100 dark:bg-green-950/30 font-bold border-r-2 border-green-400 dark:border-green-700">
                  Total
                </TableHead>

                <TableHead className="border-l"></TableHead>
                <TableHead></TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localData.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="py-2 px-1 text-center w-[36px] min-w-[36px] max-w-[36px] md:sticky md:left-0 md:z-10 bg-background">
                    <Checkbox
                      checked={selectedRows.has(index)}
                      onCheckedChange={(checked) =>
                        handleRowSelect(index, checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="py-2 px-2 text-xs w-[130px] min-w-[130px] max-w-[130px] md:sticky md:left-[36px] md:z-10 bg-background">
                    <div className="font-medium truncate" title={row.name}>{row.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate" title={row.roleLabel || row.designation}>{row.roleLabel || row.designation || "N/A"}</div>
                    <div className="text-[10px] text-muted-foreground/80 truncate" title={row.roleDepartmentLabel || row.department}>{row.roleDepartmentLabel || row.department || "N/A"}</div>
                  </TableCell>
                  <TableCell className="py-2 px-1 text-xs text-muted-foreground whitespace-nowrap w-[80px] min-w-[80px] max-w-[80px] md:sticky md:left-[166px] md:z-10 bg-background">
                    PKR {Number(row.baseSalary ?? row.basicSalary ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-2 px-1 text-xs font-semibold text-primary whitespace-nowrap w-[85px] min-w-[85px] max-w-[85px] md:sticky md:left-[246px] md:z-10 bg-background md:shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                    PKR {Number(row.currentSalary ?? row.basicSalary ?? 0).toLocaleString()}
                  </TableCell>

                  {/* Deductions Inputs */}
                  <TableCell className="bg-red-50 dark:bg-red-950/20 border-r border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.securityDeduction} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "securityDeduction", e.target.value)} />
                      {renderAuditIcon(row, "securityDeduction")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-red-50 dark:bg-red-950/20 border-r border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.advanceDeduction} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "advanceDeduction", e.target.value)} />
                      {renderAuditIcon(row, "advanceDeduction")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-red-50 dark:bg-red-950/20 border-r border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.absentDeduction} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "absentDeduction", e.target.value)} />
                      {renderAuditIcon(row, "absentDeduction")}
                      {row.absentCount > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {row.absentCount} absent day(s) @ PKR {Number(row.absentRate || 0).toLocaleString()}/day (auto-synced)
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="bg-red-50 dark:bg-red-950/20 border-r border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="h-8 w-20"
                        value={row.leaveDeduction || 0}
                        disabled={row.status === "PAID"}
                        onChange={(e) =>
                          handleInputChange(index, "leaveDeduction", e.target.value)
                        }
                      />
                      {renderAuditIcon(row, "leaveDeduction")}
                      {row.leaveBreakdown && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs space-y-0.5">
                            <div>Casual: {row.leaveBreakdown.casual || 0} day(s) {row.leaveBreakdown.excessCasual > 0 ? `(excess: ${row.leaveBreakdown.excessCasual})` : ""}</div>
                            <div>Sick: {row.leaveBreakdown.sick || 0} day(s) {row.leaveBreakdown.excessSick > 0 ? `(excess: ${row.leaveBreakdown.excessSick})` : ""}</div>
                            <div>Annual: {row.leaveBreakdown.annual || 0} day(s) {row.leaveBreakdown.excessAnnual > 0 ? `(excess: ${row.leaveBreakdown.excessAnnual})` : ""}</div>
                            <div className="text-[10px] text-muted-foreground pt-0.5 border-t">Auto-synced from attendance</div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="bg-red-50 dark:bg-red-950/20 border-r border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.otherDeduction} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "otherDeduction", e.target.value)} />
                      {renderAuditIcon(row, "otherDeduction")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-red-50 dark:bg-red-950/20 border-r border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.incomeTax} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "incomeTax", e.target.value)} />
                      {renderAuditIcon(row, "incomeTax")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-red-50 dark:bg-red-950/20 border-r border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.eobi} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "eobi", e.target.value)} />
                      {renderAuditIcon(row, "eobi")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-red-50 dark:bg-red-950/20 border-r border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.lateArrivalDeduction} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "lateArrivalDeduction", e.target.value)} />
                      {renderAuditIcon(row, "lateArrivalDeduction")}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm bg-red-100 dark:bg-red-950/30 font-medium text-red-700 dark:text-red-400 border-r-2 border-red-400 dark:border-red-700">
                    {Number(row.totalDeductions).toLocaleString()}
                  </TableCell>

                  {/* Allowances Inputs */}
                  <TableCell className="bg-green-50 dark:bg-green-950/20 border-r border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.extraAllowance} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "extraAllowance", e.target.value)} />
                      {renderAuditIcon(row, "extraAllowance")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950/20 border-r border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.travelAllowance} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "travelAllowance", e.target.value)} />
                      {renderAuditIcon(row, "travelAllowance")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950/20 border-r border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.otherAllowance} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "otherAllowance", e.target.value)} />
                      {renderAuditIcon(row, "otherAllowance")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950/20 border-r border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.houseRentAllowance} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "houseRentAllowance", e.target.value)} />
                      {renderAuditIcon(row, "houseRentAllowance")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950/20 border-r border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.medicalAllowance} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "medicalAllowance", e.target.value)} />
                      {renderAuditIcon(row, "medicalAllowance")}
                    </div>
                  </TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950/20 border-r border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20" value={row.insuranceAllowance} disabled={row.status === "PAID"} onChange={(e) => handleInputChange(index, "insuranceAllowance", e.target.value)} />
                      {renderAuditIcon(row, "insuranceAllowance")}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm bg-green-100 dark:bg-green-950/30 font-medium text-green-700 dark:text-green-400 border-r-2 border-green-400 dark:border-green-700">
                    {Number(row.totalAllowances).toLocaleString()}
                  </TableCell>

                  <TableCell className="py-2 px-3 text-sm border-l font-bold">
                    {Number(row.netSalary).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    <div className="space-y-1">
                      <Badge
                        variant={
                          row.status === "PAID"
                            ? "default"
                            : String(row.status || "").toLowerCase().includes("partia")
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          row.status === "PAID"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : String(row.status || "").toLowerCase().includes("partia")
                            ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                        }
                      >
                        {String(row.status || "").toLowerCase().includes("partia")
                          ? "PARTIALLY PAID"
                          : row.status || "PENDING"}
                      </Badge>
                      {Number(row.paidAmount || 0) > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Paid: PKR {Number(row.paidAmount || 0).toLocaleString()}
                        </div>
                      )}
                      {row.status !== "PAID" && (
                        <div className="text-xs text-muted-foreground font-medium">
                          Bal: PKR {Number(row.balanceAmount ?? Math.max(0, (row.netSalary || 0) - (row.paidAmount || 0))).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePrintPayslip(row)}>
                          <Printer className="mr-2 h-4 w-4" />
                          Print Salary Slip
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintPayrollDetails(row)}>
                          <Printer className="mr-2 h-4 w-4" />
                          Payroll Print
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePreviewPayslip(row)}>
                          <Printer className="mr-2 h-4 w-4" />
                          Preview Slip
                        </DropdownMenuItem>
                        {row.status !== "PAID" && canUpdate && (
                          <>
                            <DropdownMenuItem onClick={() => openPaymentDialog(row, true)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark Fully Paid
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPaymentDialog(row)}>
                              <CreditCard className="mr-2 h-4 w-4" />
                              Record Partial Payment
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Re-generate Payroll ({selectedRows.size} selected)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will refresh and re-generate payroll records for {selectedRows.size} selected staff member{selectedRows.size === 1 ? "" : "s"} for {new Date(month + "-01").toLocaleString("default", { month: "long", year: "numeric" })}.
              Any custom values entered in deductions or allowances for them may be overwritten, and this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRegenerateOpen(false);
                handleRegenerateSelected();
              }}
            >
              Re-generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!paymentRow} onOpenChange={() => setPaymentRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payroll Payment</DialogTitle>
          </DialogHeader>
          {paymentRow && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <div className="font-medium">{paymentRow.name}</div>
                <div className="text-muted-foreground">
                  Net PKR {Number(paymentRow.netSalary || 0).toLocaleString()} - Balance PKR {Number(paymentRow.balanceAmount || 0).toLocaleString()}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="1"
                  max={Number(paymentRow.balanceAmount ?? paymentRow.netSalary) > 0 ? Number(paymentRow.balanceAmount ?? paymentRow.netSalary) : undefined}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                    <SelectItem value="JazzCash">JazzCash</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {["Bank Transfer", "EasyPaisa", "JazzCash"].includes(paymentForm.paymentMethod) && (
                <div className="space-y-2">
                  <Label>Transaction ID / Number</Label>
                  <Input
                    value={paymentForm.transactionId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                    placeholder="Enter transaction reference"
                  />
                </div>
              )}

              {paymentForm.paymentMethod === "Cheque" && (
                <div className="space-y-2">
                  <Label>Cheque Number</Label>
                  <Input
                    value={paymentForm.chequeNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, chequeNumber: e.target.value })}
                    placeholder="Enter cheque number"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              {paymentRow.payments?.length > 0 && (
                <div className="space-y-2">
                  <Label>Payment History</Label>
                  <div className="max-h-36 overflow-auto rounded-md border divide-y">
                    {paymentRow.payments.map((payment) => (
                      <div key={payment.id} className="p-2 text-xs">
                        <div className="font-medium">PKR {Number(payment.amount || 0).toLocaleString()} by {payment.paidByName}</div>
                        <div className="text-muted-foreground">
                          {new Date(payment.paidAt).toLocaleString()} {payment.paymentMethod ? `- ${payment.paymentMethod}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaymentRow(null)}>Cancel</Button>
                <Button onClick={handleRecordPayment} disabled={paymentMutation.isPending}>
                  {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Payslip Preview</DialogTitle>
          </DialogHeader>
          <div dangerouslySetInnerHTML={{ __html: previewHtml || "" }} />
        </DialogContent>
      </Dialog>

      {/* Wallet Deduction / Payment Confirmation Dialog */}
      <Dialog open={walletPaymentDialogOpen} onOpenChange={setWalletPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Disburse Salary from Account / Safe
            </DialogTitle>
            <DialogDescription>
              {walletPaymentTarget?.type === "bulk"
                ? `Paying ${walletPaymentTarget.rows?.length || 0} selected staff members`
                : `Paying salary for ${walletPaymentTarget?.row?.name || "staff"}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Wallet Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Account / Cash Safe</Label>
              <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose wallet or account..." />
                </SelectTrigger>
                <SelectContent>
                  {wallets.length === 0 ? (
                    <SelectItem value="none" disabled>No active wallets found</SelectItem>
                  ) : (
                    wallets.map((w) => (
                      <SelectItem key={w.id || w._id} value={w.id || w._id}>
                        {w.name} ({w.type}) — Bal: PKR {Number(w.currentBalance || 0).toLocaleString()}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Financial Projection Card */}
            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Current Account Balance:</span>
                <span className="font-semibold text-foreground">
                  PKR {currentWalletBalance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Total Payroll Deduction:</span>
                <span className="font-bold text-primary">
                  PKR {totalDeductionAmount.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between items-center text-xs">
                <span className="font-medium">Projected Balance After:</span>
                <span
                  className={`font-bold text-sm ${
                    projectedWalletBalance < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  PKR {projectedWalletBalance.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Negative balance notification */}
            {projectedWalletBalance < 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong>Notice:</strong> Account balance will go negative (PKR {projectedWalletBalance.toLocaleString()}). The payment will still be disbursed and transaction ledger recorded.
                </div>
              </div>
            )}

            {/* If single row payment, let user tweak the amount if needed */}
            {walletPaymentTarget?.type === "single" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Amount (PKR)</Label>
                <Input
                  type="number"
                  min="1"
                  value={walletPaymentTarget.amount || ""}
                  onChange={(e) =>
                    setWalletPaymentTarget({
                      ...walletPaymentTarget,
                      amount: Number(e.target.value),
                    })
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Disbursement Date</Label>
                <Input
                  type="date"
                  value={walletPaymentDate}
                  onChange={(e) => setWalletPaymentDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reference / Cheque No.</Label>
                <Input
                  placeholder="Optional reference"
                  value={walletPaymentReference}
                  onChange={(e) => setWalletPaymentReference(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Remarks / Description</Label>
              <Input
                placeholder="Disbursement remarks..."
                value={walletPaymentRemarks}
                onChange={(e) => setWalletPaymentRemarks(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWalletPaymentDialogOpen(false)}
              disabled={walletDeductionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmWalletPayment}
              disabled={walletDeductionMutation.isPending || !selectedWalletId || totalDeductionAmount <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {walletDeductionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm & Disburse (PKR {totalDeductionAmount.toLocaleString()})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Month-wise Deduction Logs Dialog */}
      <Dialog open={walletLogsDialogOpen} onOpenChange={setWalletLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Month-wise Payroll Deduction Logs
            </DialogTitle>
            <DialogDescription>
              Complete history of salary disbursements and treasury deductions across all accounts and months.
            </DialogDescription>
          </DialogHeader>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border my-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Month:</Label>
                <div className="w-44">
                  <MonthPicker
                    value={walletLogMonthFilter === "all" ? "" : walletLogMonthFilter}
                    onChange={(val) => setWalletLogMonthFilter(val || "all")}
                    placeholder="All Months"
                    className="h-8 text-xs"
                  />
                </div>
                {walletLogMonthFilter !== "all" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => setWalletLogMonthFilter("all")}
                  >
                    All Months
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Account / Safe:</Label>
                <Select
                  value={walletLogWalletFilter}
                  onValueChange={setWalletLogWalletFilter}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="All Wallets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts & Safes</SelectItem>
                    {wallets.map((w) => (
                      <SelectItem key={w.id || w._id} value={w.id || w._id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => refetchLogs()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {/* Logs Table */}
          <div className="flex-1 overflow-auto border rounded-md">
            {isLogsLoading ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : deductionLogs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No payroll deduction logs recorded yet for the selected filters.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="text-xs">Payroll Month</TableHead>
                    <TableHead className="text-xs">Disbursed Date</TableHead>
                    <TableHead className="text-xs">Account / Safe</TableHead>
                    <TableHead className="text-xs text-right">Amount Deducted</TableHead>
                    <TableHead className="text-xs text-center">Staff Count</TableHead>
                    <TableHead className="text-xs text-right">Balance After</TableHead>
                    <TableHead className="text-xs">Disbursed By</TableHead>
                    <TableHead className="text-xs text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductionLogs.map((log) => {
                    const monthDisplay = log.payrollMonth
                      ? new Date(`${log.payrollMonth}-01`).toLocaleString("default", { month: "short", year: "numeric" })
                      : "—";
                    const dateDisplay = log.date
                      ? new Date(log.date).toLocaleDateString()
                      : "—";
                    const walletName = log.sourceWallet?.name || "Account";
                    const walletType = log.sourceWallet?.type || "";

                    return (
                      <TableRow key={log._id || log.id}>
                        <TableCell className="font-semibold text-xs">
                          {monthDisplay}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {dateDisplay}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="font-normal text-[11px]">
                            {walletName} {walletType ? `(${walletType})` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-right text-foreground">
                          PKR {Number(log.amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Badge variant="secondary" className="text-[11px] px-2 py-0">
                            {log.staffCount || log.staffDetails?.length || 1} staff
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          <span className={Number(log.balanceAfter || 0) < 0 ? "text-destructive font-bold" : "text-muted-foreground"}>
                            PKR {Number(log.balanceAfter || 0).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.performedBy?.name || "System"}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 text-primary hover:bg-primary/10"
                            onClick={() => setSelectedLogForDetail(log)}
                          >
                            Breakdown
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Staff Breakdown Modal for a specific deduction log */}
      <Dialog open={!!selectedLogForDetail} onOpenChange={() => setSelectedLogForDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Disbursement Breakdown Details</DialogTitle>
            <DialogDescription>
              {selectedLogForDetail && (
                <>
                  Month: {selectedLogForDetail.payrollMonth} | Account: {selectedLogForDetail.sourceWallet?.name || "Wallet"} | Total: PKR {Number(selectedLogForDetail.amount || 0).toLocaleString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedLogForDetail && (
            <div className="space-y-3 py-2">
              <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursed Date:</span>
                  <span className="font-medium">{new Date(selectedLogForDetail.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursed By:</span>
                  <span className="font-medium">{selectedLogForDetail.performedBy?.name || "Admin"}</span>
                </div>
                {selectedLogForDetail.referenceNo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference / Cheque:</span>
                    <span className="font-mono">{selectedLogForDetail.referenceNo}</span>
                  </div>
                )}
                {selectedLogForDetail.remarks && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remarks:</span>
                    <span>{selectedLogForDetail.remarks}</span>
                  </div>
                )}
              </div>

              <div className="max-h-64 overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Staff Name</TableHead>
                      <TableHead className="text-xs">Designation</TableHead>
                      <TableHead className="text-xs text-right">Amount (PKR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedLogForDetail.staffDetails || []).map((s, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{s.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.designation || "—"}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">
                          PKR {Number(s.amount || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setSelectedLogForDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default PayrollManagementDialog;
