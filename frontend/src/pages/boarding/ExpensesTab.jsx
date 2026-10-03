import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import { DollarSign, Edit, Trash2, Wallet } from "lucide-react";
import {
  getHostelExpenses,
  createHostelExpense,
  updateHostelExpense,
  deleteHostelExpense,
  getWallets,
} from "@/services/api";
import { getFinanceCategories } from "../../../config/apis";

export const ExpensesTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Boarding", "expenses");

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editMode, setEditMode] = useState({});
  const [expenseFormData, setExpenseFormData] = useState({
    expenseTitle: "",
    category: "Hostel",
    subCategory: "Hostel Food",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    remarks: "",
    walletId: "",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const { data: dynamicCategories = [] } = useQuery({
    queryKey: ['financeCategories', 'EXPENSE'],
    queryFn: () => getFinanceCategories('EXPENSE'),
  });

  const expenseCategoryMap = useMemo(() => {
    const map = {
      Hostel: ["Hostel Food", "Hostel Utilities", "Hostel Maintenance", "Hostel Supplies"],
    };
    if (dynamicCategories && dynamicCategories.length > 0) {
      dynamicCategories.forEach((cat) => {
        map[cat.name] = cat.subCategories || [];
      });
    }
    return map;
  }, [dynamicCategories]);

  const expenseCategories = useMemo(() => Object.keys(expenseCategoryMap), [expenseCategoryMap]);

  const { data: hostelExpenses = [] } = useQuery({
    queryKey: ['hostelExpenses'],
    queryFn: getHostelExpenses,
  });

  const { data: walletsData } = useQuery({
    queryKey: ['wallets'],
    queryFn: getWallets,
  });
  const activeWallets = (walletsData?.wallets || []).filter((w) => w.status === 'ACTIVE');

  const handleAddExpense = async () => {
    if (!expenseFormData.expenseTitle || !expenseFormData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    try {
      if (editMode.expense) {
        await updateHostelExpense(editMode.expense, expenseFormData);
        toast({ title: "Expense updated" });
      } else {
        await createHostelExpense(expenseFormData);
        toast({ title: "Expense added" });
      }
      queryClient.invalidateQueries({ queryKey: ['hostelExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] });
      queryClient.invalidateQueries({ queryKey: ['walletExpenseLogs'] });
      setExpenseOpen(false);
      setEditMode({});
      setExpenseFormData({
        expenseTitle: "",
        category: "Hostel",
        subCategory: "Hostel Food",
        amount: 0,
        date: new Date().toISOString().split("T")[0],
        remarks: "",
        walletId: "",
      });
    } catch (error) {
      toast({ title: "Error", description: error.message || "Failed to save expense", variant: "destructive" });
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteHostelExpense(expenseToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['hostelExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] });
      queryClient.invalidateQueries({ queryKey: ['walletExpenseLogs'] });
      toast({ title: "Expense deleted successfully" });
    } catch (e) {
      toast({ title: e.message || "Failed to delete expense", variant: "destructive" });
    } finally {
      setDeleteConfirmOpen(false);
      setExpenseToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Hostel Expenses</CardTitle>
            {canCreate && (
              <Button onClick={() => {
                setEditMode({});
                setExpenseFormData({
                  expenseTitle: "",
                  category: "Hostel",
                  subCategory: (expenseCategoryMap["Hostel"] || [])[0] || "",
                  amount: 0,
                  date: new Date().toISOString().split("T")[0],
                  remarks: "",
                  walletId: "",
                });
                setExpenseOpen(true);
              }}>
                <DollarSign className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm">Title</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Amount</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Paid From Account</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Date</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Remarks</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hostelExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="py-2 px-3 text-sm font-medium">
                      <div>{expense.expenseTitle}</div>
                      {(expense.category || expense.subCategory) && (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {expense.category && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal">
                              {expense.category}
                            </Badge>
                          )}
                          {expense.subCategory && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal text-muted-foreground">
                              {expense.subCategory}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm font-semibold text-foreground">
                      PKR {Number(expense.amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      {expense.walletName ? (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 font-normal">
                          <Wallet className="w-3 h-3 mr-1" />
                          {expense.walletName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">{expense.date}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">{expense.remarks}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <div className="flex gap-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditMode({ expense: expense.id });
                                  setExpenseFormData({
                                    expenseTitle: expense.expenseTitle,
                                    category: expense.category || "Hostel",
                                    subCategory: expense.subCategory || "",
                                    amount: expense.amount,
                                    date: expense.date,
                                    remarks: expense.remarks,
                                    walletId: expense.walletId || "",
                                  });
                                  setExpenseOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setExpenseToDelete(expense);
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {hostelExpenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No expenses found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={expenseOpen} onOpenChange={(open) => {
        setExpenseOpen(open);
        if (!open) setEditMode({});
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode.expense ? "Edit" : "Add"} Boarding Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Expense Title</Label>
              <Input
                value={expenseFormData.expenseTitle}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, expenseTitle: e.target.value })}
                placeholder="e.g. Mess groceries, Gas cylinders"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={expenseFormData.category || "Hostel"}
                onValueChange={(val) =>
                  setExpenseFormData({
                    ...expenseFormData,
                    category: val,
                    subCategory: (expenseCategoryMap[val] || [])[0] || "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(expenseCategoryMap[expenseFormData.category] || []).length > 0 && (
              <div>
                <Label>Sub Category</Label>
                <Select
                  value={expenseFormData.subCategory || ""}
                  onValueChange={(val) =>
                    setExpenseFormData({
                      ...expenseFormData,
                      subCategory: val,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Sub-Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(expenseCategoryMap[expenseFormData.category] || []).map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Amount (PKR)</Label>
              <Input
                type="number"
                value={expenseFormData.amount}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Paid From Account / Wallet</Label>
              <Select
                value={expenseFormData.walletId || "none"}
                onValueChange={(val) => setExpenseFormData({ ...expenseFormData, walletId: val === "none" ? "" : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Account / Wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Do not deduct from wallet)</SelectItem>
                  {activeWallets.map((w) => (
                    <SelectItem key={w.id || w._id} value={w.id || w._id}>
                      {w.name} ({w.type}) {w.bankName ? `• ${w.bankName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Expense amount will be deducted from this account.</p>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={expenseFormData.date}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={expenseFormData.remarks}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, remarks: e.target.value })}
                placeholder="Optional remarks or notes"
              />
            </div>
          </div>
          <Button onClick={handleAddExpense}>{editMode.expense ? "Update" : "Add"} Expense</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete expense "{expenseToDelete?.expenseTitle}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
