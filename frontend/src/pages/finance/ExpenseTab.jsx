import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { TrendingDown, Trash2, CheckCircle2, XCircle, Wallet, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getFinanceExpenses,
  createFinanceExpense,
  deleteFinanceExpense,
  approveFinanceExpense,
  rejectFinanceExpense,
  userWho,
  getWallets,
} from "../../../config/apis";
import usePermissions from "@/hooks/usePermissions";

const getMonthDateRange = (month) => {
  if (!month) return { dateFrom: "", dateTo: "" };
  const [year, monthNum] = month.split("-");
  const firstDay = `${year}-${monthNum}-01`;
  const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
  const lastDayStr = `${year}-${monthNum}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom: firstDay, dateTo: lastDayStr };
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return getMonthDateRange(month);
};

const EXPENSE_CATEGORY_MAP = {
  Bills: ["Electricity Bill", "Gas Bill", "Water Bill", "Internet Bill", "Telephone Bill", "Generator Fuel"],
  Payroll: ["Teaching Salaries", "Non-Teaching Salaries", "Contract Wages", "Bonuses", "Payroll Taxes"],
  Operations: ["Office Supplies", "Printing & Stationery", "Software Subscription", "Bank Charges", "Courier"],
  Maintenance: ["Building Repair", "Equipment Repair", "Vehicle Maintenance", "Cleaning", "Security Services"],
  Academic: ["Books & Library", "Lab Consumables", "Exam Material", "Training & Workshops", "Sports Material"],
  StudentWelfare: ["Scholarships", "Events", "Medical Support", "Transport Support", "Meal Support"],
  Hostel: ["Hostel Food", "Hostel Utilities", "Hostel Maintenance", "Hostel Supplies"],
  Compliance: ["Tax Payment", "Legal Fee", "Licensing & NOC", "Audit Fee", "Insurance"],
  Miscellaneous: ["Donation", "Emergency", "Petty Cash", "Other"],
  Inventory: ["Inventory Purchase", "Inventory Maintenance"],
  Salaries: ["Salary Payment"],
  "Utility Bills": ["Electricity Bill", "Gas Bill", "Water Bill", "Internet Bill", "Telephone Bill"],
  Supplies: ["General Supplies"],
  Other: ["Other"],
};

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_MAP);

export default function ExpenseTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseFilterCategory, setExpenseFilterCategory] = useState("all");
  const [expenseFilterSubCategory, setExpenseFilterSubCategory] = useState("all");
  const [expenseFilterStatus, setExpenseFilterStatus] = useState("all");
  const [expenseDateFrom, setExpenseDateFrom] = useState(() => getCurrentMonthRange().dateFrom);
  const [expenseDateTo, setExpenseDateTo] = useState(() => getCurrentMonthRange().dateTo);
  const [appliedExpenseFilter, setAppliedExpenseFilter] = useState(() => getCurrentMonthRange());

  const [expenseFormData, setExpenseFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Bills",
    subCategory: "Electricity Bill",
    description: "",
    amount: 0,
    walletId: "",
  });

  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [expenseActionConfirm, setExpenseActionConfirm] = useState({ open: false, action: null, item: null });
  const [selectedApprovalWalletId, setSelectedApprovalWalletId] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Fetch active wallets for payment account selection
  const { data: walletsResponse } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
  });
  const activeWallets = (
    walletsResponse?.wallets ||
    walletsResponse?.data ||
    (Array.isArray(walletsResponse) ? walletsResponse : [])
  ).filter((w) => w.status === "ACTIVE");

  // Pre-select United Bank Limited (Main Account) as default wallet
  useEffect(() => {
    if (activeWallets.length > 0 && !expenseFormData.walletId) {
      const ubl = activeWallets.find((w) => /United Bank Limited/i.test(w.name)) ||
                  activeWallets.find((w) => w.type === "BANK") ||
                  activeWallets[0];
      if (ubl) {
        setExpenseFormData((prev) => ({ ...prev, walletId: (ubl.id || ubl._id).toString() }));
      }
    }
  }, [activeWallets, expenseFormData.walletId]);

  const { canCreate, canDelete, canApprove } = usePermissions("Finance", "expense");
  const canApproveExpense = canApprove;

  const { data: expenseData = [], isLoading: expenseLoading } = useQuery({
    queryKey: [
      "financeExpense",
      appliedExpenseFilter.dateFrom,
      appliedExpenseFilter.dateTo,
      expenseFilterCategory,
      expenseFilterSubCategory,
      expenseFilterStatus,
    ],
    queryFn: () =>
      getFinanceExpenses({
        dateFrom: appliedExpenseFilter.dateFrom,
        dateTo: appliedExpenseFilter.dateTo,
        category: expenseFilterCategory,
        subCategory: expenseFilterSubCategory,
        status: expenseFilterStatus,
      }),
    enabled: !!appliedExpenseFilter.dateFrom && !!appliedExpenseFilter.dateTo,
  });

  const addExpenseMutation = useMutation({
    mutationFn: createFinanceExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeExpense"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardExpense"] });
      queryClient.invalidateQueries({ queryKey: ["reportsExpense"] });
      queryClient.invalidateQueries({ queryKey: ["financeReportsAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
      toast({ title: "Expense submitted successfully" });
      setExpenseOpen(false);
      setExpenseFormData({
        date: new Date().toISOString().split("T")[0],
        category: "Bills",
        subCategory: "Electricity Bill",
        description: "",
        amount: 0,
        walletId: "",
      });
    },
    onError: (error) => {
      toast({ title: error.message || "Failed to add expense", variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteFinanceExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeExpense"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardExpense"] });
      queryClient.invalidateQueries({ queryKey: ["reportsExpense"] });
      queryClient.invalidateQueries({ queryKey: ["financeReportsAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
      toast({ title: "Expense record deleted" });
      setDeleteConfirm({ open: false, id: null });
    },
    onError: (error) => {
      toast({ title: error.message || "Failed to delete expense", variant: "destructive" });
    },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: approveFinanceExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeExpense"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardExpense"] });
      queryClient.invalidateQueries({ queryKey: ["reportsExpense"] });
      queryClient.invalidateQueries({ queryKey: ["financeReportsAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosing"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
      toast({ title: "Expense approved and deducted from wallet" });
      setExpenseActionConfirm({ open: false, action: null, item: null });
      setSelectedApprovalWalletId("");
    },
    onError: (error) => {
      toast({ title: error.message || "Failed to approve expense", variant: "destructive" });
    },
  });

  const rejectExpenseMutation = useMutation({
    mutationFn: rejectFinanceExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeExpense"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardExpense"] });
      queryClient.invalidateQueries({ queryKey: ["reportsExpense"] });
      queryClient.invalidateQueries({ queryKey: ["financeReportsAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosing"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
      toast({ title: "Expense rejected and excluded from totals" });
      setExpenseActionConfirm({ open: false, action: null, item: null });
      setSelectedApprovalWalletId("");
    },
    onError: (error) => {
      toast({ title: error.message || "Failed to reject expense", variant: "destructive" });
    },
  });

  const handleAddExpense = () => {
    if (!expenseFormData.description || !expenseFormData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    if (!expenseFormData.walletId) {
      toast({ title: "Please select an account/wallet to pay from", variant: "destructive" });
      return;
    }
    addExpenseMutation.mutate(expenseFormData);
  };

  const getExpenseStatusVariant = (status) => {
    if (status === "APPROVED") return "default";
    if (status === "REJECTED") return "destructive";
    return "secondary";
  };

  const formatAuditDate = (value) => (value ? new Date(value).toLocaleString() : "");

  const getExpenseAuditText = (item) => {
    if (item.source) return `Automated ${item.source}`;
    if (item.status === "APPROVED") {
      return item.approvedAt
        ? `Approved by ${item.approvedByName || "Unknown"} at ${formatAuditDate(item.approvedAt)}`
        : "Approved";
    }
    if (item.status === "REJECTED") {
      const reason = item.rejectionReason ? ` - ${item.rejectionReason}` : "";
      return item.rejectedAt
        ? `Rejected by ${item.rejectedByName || "Unknown"} at ${formatAuditDate(item.rejectedAt)}${reason}`
        : `Rejected${reason}`;
    }
    return item.createdByName ? `Submitted by ${item.createdByName}` : "Pending approval";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Expense Records</CardTitle>
            {canCreate && (
              <Button onClick={() => setExpenseOpen(true)}>
                <TrendingDown className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mt-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={expenseDateFrom}
                onChange={(e) => setExpenseDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={expenseDateTo}
                onChange={(e) => setExpenseDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={expenseFilterCategory}
                onValueChange={(value) => {
                  setExpenseFilterCategory(value);
                  setExpenseFilterSubCategory("all");
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sub Category</Label>
              <Select
                value={expenseFilterSubCategory}
                onValueChange={setExpenseFilterSubCategory}
                disabled={expenseFilterCategory === "all"}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub Categories</SelectItem>
                  {(EXPENSE_CATEGORY_MAP[expenseFilterCategory] || []).map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={expenseFilterStatus}
                onValueChange={setExpenseFilterStatus}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() =>
                  setAppliedExpenseFilter({
                    dateFrom: expenseDateFrom,
                    dateTo: expenseDateTo,
                  })
                }
              >
                Apply
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => {
                  const current = getCurrentMonthRange();
                  setExpenseDateFrom(current.dateFrom);
                  setExpenseDateTo(current.dateTo);
                  setAppliedExpenseFilter(current);
                  setExpenseFilterCategory("all");
                  setExpenseFilterSubCategory("all");
                  setExpenseFilterStatus("all");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm">Date & Category</TableHead>
                  <TableHead className="hidden md:table-cell py-2.5 px-3 text-sm">Sub Category</TableHead>
                  <TableHead className="hidden lg:table-cell py-2.5 px-3 text-sm">Paid From Account</TableHead>
                  <TableHead className="hidden lg:table-cell py-2.5 px-3 text-sm">Description</TableHead>
                  <TableHead className="py-2.5 px-2.5 sm:px-3 text-xs sm:text-sm text-center">Status</TableHead>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm text-right">Amount</TableHead>
                  <TableHead className="hidden xl:table-cell py-2.5 px-3 text-sm">Audit</TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading expense data...
                    </TableCell>
                  </TableRow>
                ) : expenseData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No expense records found for selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseData.map((item) => {
                    const isManual = !item.source;
                    const isPending = String(item.status || "Pending").toUpperCase() === "PENDING";
                    const isActionLoading =
                      approveExpenseMutation.isPending ||
                      rejectExpenseMutation.isPending ||
                      deleteExpenseMutation.isPending;
                    return (
                      <TableRow
                        key={item.id || item._id}
                        className={`cursor-pointer hover:bg-muted/40 transition-colors ${
                          isPending
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : item.status === "REJECTED" || item.status === "Rejected"
                            ? "bg-destructive/5"
                            : ""
                        }`}
                        onClick={() => setSelectedExpense(item)}
                      >
                        <TableCell className="py-2 px-3 text-xs sm:text-sm">
                          <div className="font-semibold text-foreground">{item.category}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(item.date).toLocaleDateString()}
                            {item.subCategory && <span className="text-muted-foreground/80"> • {item.subCategory}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-2 px-3 text-sm">
                          {item.subCategory || "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell py-2 px-3 text-sm">
                          {item.walletName ? (
                            <Badge variant="outline" className="font-normal bg-muted/40 text-xs">
                              {item.walletName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Unspecified</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell py-2 px-3 text-sm max-w-[200px] truncate" title={item.description}>
                          {item.description}
                        </TableCell>
                        <TableCell className="py-2 px-2.5 sm:px-3 text-center">
                          <Badge variant={getExpenseStatusVariant(item.status)} className="text-[10px] sm:text-xs">
                            {item.status || "APPROVED"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`py-2 px-3 text-xs sm:text-sm font-bold font-mono text-right ${
                            item.isCounted === false
                              ? "text-muted-foreground"
                              : "text-destructive"
                          }`}
                        >
                          PKR {Number(item.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell py-2 px-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {getExpenseAuditText(item)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2 px-3 text-sm text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && canApproveExpense && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2 text-xs flex items-center gap-1 font-medium shadow-xs"
                                  disabled={isActionLoading}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedApprovalWalletId(
                                      item.walletId || (activeWallets.length > 0 ? (activeWallets[0].id || activeWallets[0]._id) : "")
                                    );
                                    setExpenseActionConfirm({
                                      open: true,
                                      action: "approve",
                                      item,
                                    });
                                  }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Approve</span>
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive border-destructive/30 hover:bg-destructive/10 h-7 w-7 p-0"
                                      disabled={isActionLoading}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpenseActionConfirm({
                                          open: true,
                                          action: "reject",
                                          item,
                                        });
                                      }}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reject expense</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            {canDelete && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 w-7 p-0 inline-flex items-center justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm({ open: true, id: item.id });
                                    }}
                                    disabled={!!item.source || isActionLoading}
                                    title={
                                      !!item.source
                                        ? `Cannot delete automated ${item.category} records`
                                        : "Delete"
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {item.source
                                    ? "Automated records cannot be deleted here"
                                    : "Delete"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Expense Details Dialog */}
      <Dialog open={!!selectedExpense} onOpenChange={(open) => !open && setSelectedExpense(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Expense Record Details</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-3 text-xs sm:text-sm pt-2">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Category:</span>
                <Badge variant="destructive">{selectedExpense.category}</Badge>
              </div>
              {selectedExpense.subCategory && (
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Sub Category:</span>
                  <span className="font-medium">{selectedExpense.subCategory}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={getExpenseStatusVariant(selectedExpense.status)}>
                  {selectedExpense.status || "APPROVED"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Amount:</span>
                <div>
                  <span className={`font-bold font-mono text-base ${selectedExpense.isCounted === false ? "text-muted-foreground" : "text-destructive"}`}>
                    PKR {Number(selectedExpense.amount).toLocaleString()}
                  </span>
                  {selectedExpense.isCounted === false && (
                    <span className="block text-[10px] text-muted-foreground italic">(Excluded from treasury totals)</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(selectedExpense.date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Paid From Account:</span>
                <span>{selectedExpense.walletName || "Unspecified"}</span>
              </div>
              {selectedExpense.auditText && (
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Audit / Log:</span>
                  <span className="text-xs text-muted-foreground">{getExpenseAuditText(selectedExpense)}</span>
                </div>
              )}
              {selectedExpense.description && (
                <div className="py-1.5 border-b">
                  <span className="text-muted-foreground block mb-1">Description:</span>
                  <p className="text-xs bg-muted/40 p-2.5 rounded border leading-relaxed">
                    {selectedExpense.description}
                  </p>
                </div>
              )}
              {/* Actions Footer inside dialog */}
              <div className="pt-2 flex flex-wrap gap-2 justify-end">
                {String(selectedExpense.status || "Pending").toUpperCase() === "PENDING" && canApproveExpense && (
                  <>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                      onClick={() => {
                        const item = selectedExpense;
                        setSelectedApprovalWalletId(
                          item.walletId || (activeWallets.length > 0 ? (activeWallets[0].id || activeWallets[0]._id) : "")
                        );
                        setSelectedExpense(null);
                        setExpenseActionConfirm({
                          open: true,
                          action: "approve",
                          item,
                        });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 flex items-center gap-1.5"
                      onClick={() => {
                        const item = selectedExpense;
                        setSelectedExpense(null);
                        setExpenseActionConfirm({
                          open: true,
                          action: "reject",
                          item,
                        });
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}
                {canDelete && !selectedExpense.source && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex items-center gap-1.5"
                    onClick={() => {
                      const id = selectedExpense.id;
                      setSelectedExpense(null);
                      setDeleteConfirm({ open: true, id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={expenseFormData.date}
                onChange={(e) =>
                  setExpenseFormData({ ...expenseFormData, date: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={expenseFormData.category}
                onValueChange={(value) =>
                  setExpenseFormData({
                    ...expenseFormData,
                    category: value,
                    subCategory: (EXPENSE_CATEGORY_MAP[value] || [])[0] || "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub Category</Label>
              <Select
                value={expenseFormData.subCategory}
                onValueChange={(value) =>
                  setExpenseFormData({
                    ...expenseFormData,
                    subCategory: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(EXPENSE_CATEGORY_MAP[expenseFormData.category] || []).map(
                    (sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paid From Account / Wallet *</Label>
              <Select
                value={expenseFormData.walletId}
                onValueChange={(value) =>
                  setExpenseFormData({
                    ...expenseFormData,
                    walletId: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account/wallet" />
                </SelectTrigger>
                <SelectContent>
                  {activeWallets.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No active accounts available
                    </SelectItem>
                  ) : (
                    activeWallets.map((wallet) => (
                      <SelectItem
                        key={wallet.id || wallet._id}
                        value={wallet.id || wallet._id}
                      >
                        {wallet.accountName || wallet.name}{" "}
                        {wallet.accountNumber
                          ? `(${wallet.accountNumber})`
                          : `(${wallet.type})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={expenseFormData.description}
                onChange={(e) =>
                  setExpenseFormData({
                    ...expenseFormData,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={expenseFormData.amount}
                onChange={(e) =>
                  setExpenseFormData({
                    ...expenseFormData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <Button
            onClick={handleAddExpense}
            disabled={addExpenseMutation.isPending}
          >
            {addExpenseMutation.isPending ? "Submitting..." : "Submit Expense"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Expense Approval / Rejection Confirmation Dialog */}
      <AlertDialog
        open={expenseActionConfirm.open}
        onOpenChange={(open) => {
          if (!open) {
            setExpenseActionConfirm({ open: false, action: null, item: null });
            setSelectedApprovalWalletId("");
          }
        }}
      >
        <AlertDialogContent className="w-full max-w-md">
          {expenseActionConfirm.action === "approve" && expenseActionConfirm.item ? (
            (() => {
              const item = expenseActionConfirm.item;
              const ublWallet = activeWallets.find((w) => /United Bank Limited/i.test(w.name));
              const currentWalletId =
                selectedApprovalWalletId ||
                item.walletId ||
                (ublWallet ? (ublWallet.id || ublWallet._id) : (activeWallets.length > 0 ? (activeWallets[0].id || activeWallets[0]._id) : ""));
              const selectedWallet =
                activeWallets.find((w) => (w.id || w._id) === currentWalletId) ||
                activeWallets.find((w) => (w.id || w._id) === item.walletId);
              const currentBalance = Number(selectedWallet?.currentBalance || 0);
              const expenseAmount = Number(item.amount || 0);
              const projectedBalance = currentBalance - expenseAmount;
              const isNegative = projectedBalance < 0;

              return (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Approve Expense & Deduct
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Review the expense amount and the destination account / wallet from where the amount will be deducted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-4 my-2 text-sm">
                    {/* Expense Details */}
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-foreground text-sm">
                            {item.description || "Expense Record"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.category}
                            {item.subCategory ? ` · ${item.subCategory}` : ""}
                            {item.date ? ` · ${item.date}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-muted-foreground block">Expense Amount</span>
                          <span className="font-bold text-destructive text-base">
                            PKR {expenseAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Destination Account / Wallet Selection */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-primary" />
                        <span>Destination Account / Wallet (Deduct From) *</span>
                      </Label>
                      <Select
                        value={currentWalletId}
                        onValueChange={(val) => setSelectedApprovalWalletId(val)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Account / Wallet" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeWallets.length === 0 ? (
                            <SelectItem value="_none" disabled>
                              No active accounts available
                            </SelectItem>
                          ) : (
                            activeWallets.map((wallet) => (
                              <SelectItem
                                key={wallet.id || wallet._id}
                                value={wallet.id || wallet._id}
                              >
                                {wallet.accountName || wallet.name}{" "}
                                {wallet.accountNumber
                                  ? `(${wallet.accountNumber})`
                                  : `(${wallet.type})`}{" "}
                                — Bal: PKR {Number(wallet.currentBalance || 0).toLocaleString()}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Balance Breakdown Card */}
                    <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Current Wallet Balance:</span>
                        <span className="font-medium text-foreground">
                          PKR {currentBalance.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-destructive">
                        <span>Expense Deduction:</span>
                        <span className="font-medium">
                          - PKR {expenseAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center font-semibold">
                        <span>Projected Balance After Approval:</span>
                        <span
                          className={
                            isNegative
                              ? "text-amber-600 dark:text-amber-400 font-bold text-sm"
                              : "text-emerald-600 dark:text-emerald-400 font-bold text-sm"
                          }
                        >
                          PKR {projectedBalance.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Negative Balance Notice */}
                    {isNegative ? (
                      <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <span className="font-semibold">Negative balance notice:</span> The expense amount exceeds current wallet balance. The wallet balance will become negative (<strong>PKR {projectedBalance.toLocaleString()}</strong>), which is permitted.
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground italic">
                        * Approving will deduct PKR {expenseAmount.toLocaleString()} from{" "}
                        {selectedWallet?.name || "the selected wallet"} and record an expense transaction.
                      </div>
                    )}
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel
                      disabled={approveExpenseMutation.isPending}
                      onClick={() => {
                        setExpenseActionConfirm({ open: false, action: null, item: null });
                        setSelectedApprovalWalletId("");
                      }}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={approveExpenseMutation.isPending || !currentWalletId}
                      onClick={() => {
                        approveExpenseMutation.mutate({
                          id: item.id || item._id,
                          walletId: currentWalletId,
                        });
                      }}
                    >
                      {approveExpenseMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          Approving...
                        </>
                      ) : (
                        "Confirm & Approve"
                      )}
                    </Button>
                  </AlertDialogFooter>
                </>
              );
            })()
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject this expense?</AlertDialogTitle>
                <AlertDialogDescription>
                  Rejecting this expense will keep it excluded from Finance totals, reports, dashboard cards, and future closing calculations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {expenseActionConfirm.item && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <div className="font-medium">
                    {expenseActionConfirm.item.description}
                  </div>
                  <div className="text-muted-foreground">
                    {expenseActionConfirm.item.category}
                    {expenseActionConfirm.item.subCategory
                      ? ` / ${expenseActionConfirm.item.subCategory}`
                      : ""}{" "}
                    · PKR {Number(expenseActionConfirm.item.amount || 0).toLocaleString()}
                  </div>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={rejectExpenseMutation.isPending}
                  onClick={() => {
                    setExpenseActionConfirm({ open: false, action: null, item: null });
                    setSelectedApprovalWalletId("");
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={rejectExpenseMutation.isPending}
                  onClick={() => {
                    const item = expenseActionConfirm.item;
                    if (!item) return;
                    rejectExpenseMutation.mutate({ id: item.id || item._id });
                  }}
                >
                  {rejectExpenseMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Rejecting...
                    </>
                  ) : (
                    "Reject"
                  )}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this expense record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpenseMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
