import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getInventoryExpenses,
    getSchoolInventoryItems,
    createInventoryExpense,
    updateInventoryExpense,
    deleteInventoryExpense,
    getWallets,
} from "../../../config/apis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import usePermissions from "@/hooks/usePermissions";

const expenseTypes = ["Maintenance", "Repair", "Upgrade", "Replacement", "Other"];

export default function InventoryExpensesTab() {
    const queryClient = useQueryClient();
    const { canCreate, canUpdate, canDelete } = usePermissions("Inventory", "expenses");

    const { data: inventoryExpenses = [], isLoading: isLoadingExpenses } = useQuery({
        queryKey: ["inventoryExpenses"],
        queryFn: getInventoryExpenses
    });

    const { data: schoolInventory = [] } = useQuery({
        queryKey: ["schoolInventory"],
        queryFn: getSchoolInventoryItems
    });

    // Fetch active treasury accounts / wallets
    const { data: walletsResponse } = useQuery({
        queryKey: ["wallets"],
        queryFn: getWallets,
    });
    const activeWallets = (
        walletsResponse?.wallets ||
        walletsResponse?.data ||
        (Array.isArray(walletsResponse) ? walletsResponse : [])
    ).filter((w) => w.status === "ACTIVE");

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isExpenseEditOpen, setIsExpenseEditOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);
    const [selectedItemId, setSelectedItemId] = useState("");

    const [expenseData, setExpenseData] = useState({
        expenseType: "Maintenance",
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: "",
        vendor: "",
        walletId: ""
    });

    const resetExpenseForm = () => {
        setExpenseData({
            expenseType: "Maintenance",
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            description: "",
            vendor: "",
            walletId: ""
        });
        setSelectedItemId("");
    };

    const createExpenseMutation = useMutation({
        mutationFn: createInventoryExpense,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventoryExpenses"] });
            queryClient.invalidateQueries({ queryKey: ["schoolInventory"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
            queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
            queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
            queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
            queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
            toast({ title: "Success", description: "Expense added successfully" });
            resetExpenseForm();
            setIsAddOpen(false);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const updateExpenseMutation = useMutation({
        mutationFn: updateInventoryExpense,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventoryExpenses"] });
            queryClient.invalidateQueries({ queryKey: ["schoolInventory"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
            queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
            queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
            queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
            queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
            toast({ title: "Success", description: "Expense updated successfully" });
            resetExpenseForm();
            setIsExpenseEditOpen(false);
            setSelectedExpense(null);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: deleteInventoryExpense,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventoryExpenses"] });
            queryClient.invalidateQueries({ queryKey: ["schoolInventory"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
            queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
            queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
            queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
            queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
            toast({ title: "Success", description: "Expense deleted successfully" });
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleAddExpense = () => {
        if (!selectedItemId || !expenseData.description || expenseData.amount <= 0) {
            toast({
                title: "Error",
                description: "Please select an item and fill in all required fields",
                variant: "destructive"
            });
            return;
        }
        if (!expenseData.walletId) {
            toast({
                title: "Error",
                description: "Please select an account/wallet to pay from",
                variant: "destructive"
            });
            return;
        }

        const newExpense = {
            inventoryItemId: selectedItemId,
            ...expenseData
        };

        createExpenseMutation.mutate(newExpense);
    };

    const handleEditExpense = () => {
        if (!selectedExpense || !expenseData.description || expenseData.amount <= 0) {
            toast({
                title: "Error",
                description: "Please fill in all required fields",
                variant: "destructive"
            });
            return;
        }
        if (!expenseData.walletId) {
            toast({
                title: "Error",
                description: "Please select an account/wallet to pay from",
                variant: "destructive"
            });
            return;
        }
        updateExpenseMutation.mutate({
            id: selectedExpense.id,
            data: expenseData
        });
    };

    const handleDeleteExpense = id => {
        if (confirm("Are you sure you want to delete this expense record?")) {
            deleteExpenseMutation.mutate(id);
        }
    };

    const openExpenseEditDialog = expense => {
        setSelectedExpense(expense);
        setExpenseData({
            expenseType: expense.expenseType,
            amount: expense.amount,
            date: expense.date,
            description: expense.description,
            vendor: expense.vendor || "",
            walletId: expense.walletId || ""
        });
        setIsExpenseEditOpen(true);
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Inventory Expenses</CardTitle>
                        <CardDescription>Track maintenance, repairs, and other inventory-related expenses</CardDescription>
                    </div>
                    {canCreate && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={resetExpenseForm}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Expense
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Record Inventory Expense</DialogTitle>
                                <DialogDescription>Record maintenance, repair, or other expenses for an item</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>Inventory Item *</Label>
                                    <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                                        <SelectContent>
                                            {schoolInventory.map(item => (
                                                <SelectItem key={item.id} value={String(item.id)}>
                                                    {item.itemName} ({item.category})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Expense Type *</Label>
                                    <Select value={expenseData.expenseType} onValueChange={value => setExpenseData({
                                        ...expenseData,
                                        expenseType: value
                                    })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {expenseTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Amount (PKR) *</Label>
                                    <Input type="number" min="0" value={expenseData.amount} onChange={e => setExpenseData({
                                        ...expenseData,
                                        amount: parseFloat(e.target.value) || 0
                                    })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date *</Label>
                                    <Input type="date" value={expenseData.date} onChange={e => setExpenseData({
                                        ...expenseData,
                                        date: e.target.value
                                    })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Vendor</Label>
                                    <Input value={expenseData.vendor} onChange={e => setExpenseData({
                                        ...expenseData,
                                        vendor: e.target.value
                                    })} placeholder="Service provider or supplier" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description *</Label>
                                    <Textarea value={expenseData.description} onChange={e => setExpenseData({
                                        ...expenseData,
                                        description: e.target.value
                                    })} placeholder="Details about the expense" rows={3} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Paid From Account / Wallet *</Label>
                                    <Select
                                        value={expenseData.walletId || "none"}
                                        onValueChange={(val) =>
                                            setExpenseData({
                                                ...expenseData,
                                                walletId: val === "none" ? "" : val,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="-- Select Account / Wallet --" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- Select Account / Wallet --</SelectItem>
                                            {activeWallets.map((w) => (
                                                <SelectItem key={w.id || w._id} value={w.id || w._id}>
                                                    {w.name} ({w.type}) {w.bankName ? `• ${w.bankName}` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Amount will be deducted from this account and tracked under expenses.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddExpense} disabled={createExpenseMutation.isPending}>Add Expense</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-2 px-3 text-sm">Date</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Item</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Type</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Description</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Vendor</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Paid From</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Amount</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inventoryExpenses?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="py-2 px-3 text-sm text-center text-muted-foreground">
                                                No expenses recorded
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        inventoryExpenses?.map(expense => (
                                            <TableRow key={expense.id}>
                                                <TableCell className="py-2 px-3 text-sm">{new Date(expense.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm font-medium">{expense.inventoryItem?.itemName || expense.itemName}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">
                                                    <Badge variant="outline">{expense.expenseType}</Badge>
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-sm">{expense.description}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">{expense.vendor || "-"}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">
                                                    {expense.walletName ? (
                                                        <Badge variant="outline" className="w-fit text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 font-normal">
                                                            <Wallet className="w-2.5 h-2.5 mr-1" />
                                                            {expense.walletName}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-sm font-semibold">PKR {expense.amount.toLocaleString()}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">
                                                    <div className="flex gap-1">
                                                        {canUpdate && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="sm" variant="ghost" onClick={() => openExpenseEditDialog(expense)} title="Edit">
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Edit</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        {canDelete && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteExpense(expense.id)} title="Delete">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Delete</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Expense Dialog */}
            <Dialog open={isExpenseEditOpen} onOpenChange={setIsExpenseEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Expense</DialogTitle>
                        <DialogDescription>Update expense details</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Expense Type *</Label>
                            <Select value={expenseData.expenseType} onValueChange={value => setExpenseData({
                                ...expenseData,
                                expenseType: value
                            })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {expenseTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Amount (PKR) *</Label>
                            <Input type="number" min="0" step="0.01" value={expenseData.amount} onChange={e => setExpenseData({
                                ...expenseData,
                                amount: parseFloat(e.target.value) || 0
                            })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input type="date" value={expenseData.date} onChange={e => setExpenseData({
                                ...expenseData,
                                date: e.target.value
                            })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description *</Label>
                            <Textarea value={expenseData.description} onChange={e => setExpenseData({
                                ...expenseData,
                                description: e.target.value
                            })} placeholder="Describe the expense" rows={3} />
                        </div>
                        <div className="space-y-2">
                            <Label>Vendor</Label>
                            <Input value={expenseData.vendor} onChange={e => setExpenseData({
                                ...expenseData,
                                vendor: e.target.value
                            })} placeholder="Vendor or service provider name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Paid From Account / Wallet *</Label>
                            <Select
                                value={expenseData.walletId || "none"}
                                onValueChange={(val) =>
                                    setExpenseData({
                                        ...expenseData,
                                        walletId: val === "none" ? "" : val,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="-- Select Account / Wallet --" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Select Account / Wallet --</SelectItem>
                                    {activeWallets.map((w) => (
                                        <SelectItem key={w.id || w._id} value={w.id || w._id}>
                                            {w.name} ({w.type}) {w.bankName ? `• ${w.bankName}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Amount will be deducted from this account and tracked under expenses.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setIsExpenseEditOpen(false);
                            setSelectedExpense(null);
                        }}>Cancel</Button>
                        <Button onClick={handleEditExpense}>Update Expense</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
