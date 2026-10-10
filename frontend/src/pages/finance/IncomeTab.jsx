import React, { useState, useEffect, useMemo } from "react";
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
  DialogFooter,
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
import { TrendingUp, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getFinanceIncomes,
  createFinanceIncome,
  deleteFinanceIncome,
  getWallets,
  getFinanceCategories,
} from "../../../config/apis";

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

const DEFAULT_INCOME_CATEGORIES = [
  "Tuition Fee",
  "Extra Challan",
  "Hostel Challan",
  "Donation",
  "Funding",
  "Revenue",
  "Investments",
  "Other Income",
];

export default function IncomeTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions("Finance", "income");

  const { data: dynamicCategories = [] } = useQuery({
    queryKey: ["financeCategories", "INCOME"],
    queryFn: () => getFinanceCategories("INCOME"),
  });

  const incomeCategoryMap = useMemo(() => {
    const map = {};
    DEFAULT_INCOME_CATEGORIES.forEach((cat) => {
      map[cat] = [];
    });
    if (dynamicCategories && dynamicCategories.length > 0) {
      dynamicCategories.forEach((cat) => {
        map[cat.name] = cat.subCategories || [];
      });
    }
    return map;
  }, [dynamicCategories]);

  const incomeCategories = useMemo(
    () => Object.keys(incomeCategoryMap),
    [incomeCategoryMap]
  );

  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeFilterCategory, setIncomeFilterCategory] = useState("all");
  const [incomeDateFrom, setIncomeDateFrom] = useState(() => getCurrentMonthRange().dateFrom);
  const [incomeDateTo, setIncomeDateTo] = useState(() => getCurrentMonthRange().dateTo);
  const [appliedIncomeFilter, setAppliedIncomeFilter] = useState(() => getCurrentMonthRange());

  const [incomeFormData, setIncomeFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Donation",
    subCategory: "",
    description: "",
    amount: 0,
    walletId: "",
  });

  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [selectedIncome, setSelectedIncome] = useState(null);

  // Fetch active wallets for deposit account selection
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
    if (activeWallets.length > 0 && !incomeFormData.walletId) {
      const ubl = activeWallets.find((w) => /United Bank Limited/i.test(w.name)) ||
                  activeWallets.find((w) => w.type === "BANK") ||
                  activeWallets[0];
      if (ubl) {
        setIncomeFormData((prev) => ({ ...prev, walletId: (ubl.id || ubl._id).toString() }));
      }
    }
  }, [activeWallets, incomeFormData.walletId]);

  const { data: incomeData = [], isLoading: incomeLoading } = useQuery({
    queryKey: [
      "financeIncome",
      appliedIncomeFilter.dateFrom,
      appliedIncomeFilter.dateTo,
      incomeFilterCategory,
    ],
    queryFn: () =>
      getFinanceIncomes({
        dateFrom: appliedIncomeFilter.dateFrom,
        dateTo: appliedIncomeFilter.dateTo,
        category: incomeFilterCategory,
      }),
    enabled: !!appliedIncomeFilter.dateFrom && !!appliedIncomeFilter.dateTo,
  });

  const addIncomeMutation = useMutation({
    mutationFn: createFinanceIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeIncome"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardIncome"] });
      queryClient.invalidateQueries({ queryKey: ["reportsIncome"] });
      queryClient.invalidateQueries({ queryKey: ["financeReportsAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
      toast({ title: "Income added successfully" });
      setIncomeOpen(false);
      setIncomeFormData({
        date: new Date().toISOString().split("T")[0],
        category: "Donation",
        subCategory: "",
        description: "",
        amount: 0,
        walletId: "",
      });
    },
    onError: (error) => {
      toast({ title: error.message || "Failed to add income", variant: "destructive" });
    },
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: deleteFinanceIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeIncome"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardIncome"] });
      queryClient.invalidateQueries({ queryKey: ["reportsIncome"] });
      queryClient.invalidateQueries({ queryKey: ["financeReportsAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
      toast({ title: "Income record deleted" });
      setDeleteConfirm({ open: false, id: null });
    },
    onError: (error) => {
      toast({ title: error.message || "Failed to delete income", variant: "destructive" });
    },
  });

  const handleAddIncome = () => {
    if (!incomeFormData.description || !incomeFormData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    if (!incomeFormData.walletId) {
      toast({ title: "Please select an account/wallet for deposit", variant: "destructive" });
      return;
    }
    addIncomeMutation.mutate(incomeFormData);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>Income Records</CardTitle>
            {canCreate && (
              <Button onClick={() => setIncomeOpen(true)} className="w-full sm:w-auto">
                <TrendingUp className="mr-2 h-4 w-4" />
                Add Income
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 mt-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={incomeDateFrom}
                onChange={(e) => setIncomeDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={incomeDateTo}
                onChange={(e) => setIncomeDateTo(e.target.value)}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs">Category</Label>
              <Select
                value={incomeFilterCategory}
                onValueChange={setIncomeFilterCategory}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {incomeCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() =>
                  setAppliedIncomeFilter({
                    dateFrom: incomeDateFrom,
                    dateTo: incomeDateTo,
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
                  setIncomeDateFrom(current.dateFrom);
                  setIncomeDateTo(current.dateTo);
                  setAppliedIncomeFilter(current);
                  setIncomeFilterCategory("all");
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
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm">Deposit Account</TableHead>
                  <TableHead className="hidden md:table-cell py-2.5 px-3 text-sm">Description</TableHead>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm text-right">Amount</TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading income data...
                    </TableCell>
                  </TableRow>
                ) : incomeData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No income records found for selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeData.map((item) => (
                    <TableRow
                      key={item.id || item._id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedIncome(item)}
                    >
                      <TableCell className="py-2 px-3 text-xs sm:text-sm">
                        <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{item.category}</span>
                          {item.subCategory && (
                            <Badge variant="outline" className="text-[10px] font-normal py-0 px-1 text-muted-foreground">
                              {item.subCategory}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(item.date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2 px-3 text-sm">
                        {item.walletName ? (
                          <Badge variant="outline" className="font-normal bg-muted/40 text-xs">
                            {item.walletName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Unspecified</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2 px-3 text-sm max-w-[220px] truncate" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs sm:text-sm font-bold text-success text-right font-mono">
                        PKR {Number(item.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2 px-3 text-sm text-right">
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 w-7 p-0 inline-flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({ open: true, id: item.id || item._id });
                                }}
                                disabled={!!item.source}
                                title={
                                  !!item.source
                                    ? `Cannot delete automated ${item.category} records`
                                    : "Delete"
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Income Dialog */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Income</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={incomeFormData.date}
                onChange={(e) =>
                  setIncomeFormData({ ...incomeFormData, date: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Deposit Into Account / Wallet *</Label>
              <Select
                value={incomeFormData.walletId}
                onValueChange={(value) =>
                  setIncomeFormData({ ...incomeFormData, walletId: value })
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
              <Label>Category</Label>
              <Select
                value={incomeFormData.category}
                onValueChange={(value) =>
                  setIncomeFormData({
                    ...incomeFormData,
                    category: value,
                    subCategory: (incomeCategoryMap[value] || [])[0] || "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {incomeCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(incomeCategoryMap[incomeFormData.category] || []).length > 0 && (
              <div>
                <Label>Sub Category</Label>
                <Select
                  value={incomeFormData.subCategory}
                  onValueChange={(value) =>
                    setIncomeFormData({
                      ...incomeFormData,
                      subCategory: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(incomeCategoryMap[incomeFormData.category] || []).map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Description</Label>
              <Textarea
                value={incomeFormData.description}
                onChange={(e) =>
                  setIncomeFormData({
                    ...incomeFormData,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={incomeFormData.amount}
                onChange={(e) =>
                  setIncomeFormData({
                    ...incomeFormData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 border-t mt-4 flex items-center justify-end gap-2 shrink-0">
            <Button
              onClick={handleAddIncome}
              disabled={addIncomeMutation.isPending}
              className="w-full sm:w-auto"
            >
              {addIncomeMutation.isPending ? "Adding..." : "Add Income"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Income Details Dialog */}
      <Dialog open={!!selectedIncome} onOpenChange={(open) => !open && setSelectedIncome(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Income Record Details</DialogTitle>
          </DialogHeader>
          {selectedIncome && (
            <div className="space-y-3 text-xs sm:text-sm pt-2">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Category:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="default">{selectedIncome.category}</Badge>
                  {selectedIncome.subCategory && (
                    <Badge variant="outline">{selectedIncome.subCategory}</Badge>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-success font-mono text-base">
                  + PKR {Number(selectedIncome.amount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(selectedIncome.date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Deposit Account:</span>
                <span>{selectedIncome.walletName || "Unspecified"}</span>
              </div>
              {selectedIncome.description && (
                <div className="py-1.5 border-b">
                  <span className="text-muted-foreground block mb-1">Description:</span>
                  <p className="text-xs bg-muted/40 p-2.5 rounded border leading-relaxed">
                    {selectedIncome.description}
                  </p>
                </div>
              )}
              {canDelete && !selectedIncome.source && (
                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      const id = selectedIncome.id || selectedIncome._id;
                      setSelectedIncome(null);
                      setDeleteConfirm({ open: true, id });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete Record
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the income record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteIncomeMutation.mutate(deleteConfirm.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
