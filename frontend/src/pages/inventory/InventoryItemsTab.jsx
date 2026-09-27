import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getSchoolInventoryItems,
    createSchoolInventoryItem,
    updateSchoolInventoryItem,
    deleteSchoolInventoryItem,
    getInventoryExpensesByItem,
    createInventoryExpense,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ClipboardList, Wrench, History, Wallet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import usePermissions from "@/hooks/usePermissions";

const categories = ["Lab Equipment", "Sports Equipment", "Library Books", "Office Supplies", "Computer Equipment", "Furniture", "Teaching Aids", "Other"];
const conditions = ["New", "Good", "Fair", "Needs Repair", "Damaged"];
const assignmentTypes = ["Class", "Department", "Lab", "Unassigned"];
const expenseTypes = ["Maintenance", "Repair", "Upgrade", "Replacement", "Other"];

export default function InventoryItemsTab() {
    const queryClient = useQueryClient();
    const { canCreate, canUpdate, canDelete } = usePermissions("Inventory", "inventory");

    const { data: schoolInventory = [], isLoading: isLoadingInventory } = useQuery({
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
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isExpenseOpen, setIsExpenseOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [historyItem, setHistoryItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterAssignment, setFilterAssignment] = useState("all");

    const [formData, setFormData] = useState({
        itemName: "",
        category: "Lab Equipment",
        quantity: 0,
        unitPrice: 0,
        purchaseDate: new Date().toISOString().split('T')[0],
        supplier: "",
        condition: "New",
        location: "",
        assignedTo: "Unassigned",
        assignedToName: "",
        warrantyExpiry: "",
        description: "",
        isExpense: false,
        expenseAmount: 0,
        walletId: ""
    });

    const [expenseData, setExpenseData] = useState({
        expenseType: "Maintenance",
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: "",
        vendor: "",
        walletId: ""
    });

    // Query for Item History
    const { data: itemHistory = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ["itemHistory", historyItem?.id],
        queryFn: () => getInventoryExpensesByItem(historyItem.id),
        enabled: !!historyItem?.id && isHistoryOpen
    });

    const createItemMutation = useMutation({
        mutationFn: createSchoolInventoryItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schoolInventory"] });
            queryClient.invalidateQueries({ queryKey: ["inventoryExpenses"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
            queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
            queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
            queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
            queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
            toast({ title: "Success", description: "Inventory item added successfully" });
            resetForm();
            setIsAddOpen(false);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const updateItemMutation = useMutation({
        mutationFn: updateSchoolInventoryItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schoolInventory"] });
            queryClient.invalidateQueries({ queryKey: ["inventoryExpenses"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
            queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
            queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
            queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
            queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
            toast({ title: "Success", description: "Inventory item updated successfully" });
            resetForm();
            setIsEditOpen(false);
            setIsAssignOpen(false);
            setSelectedItem(null);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const deleteItemMutation = useMutation({
        mutationFn: deleteSchoolInventoryItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schoolInventory"] });
            queryClient.invalidateQueries({ queryKey: ["inventoryExpenses"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
            queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
            queryClient.invalidateQueries({ queryKey: ["walletExpenseLogs"] });
            queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
            queryClient.invalidateQueries({ queryKey: ["financeLedger"] });
            toast({ title: "Success", description: "Inventory item deleted successfully" });
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

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
            setIsExpenseOpen(false);
            setSelectedItem(null);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const resetForm = () => {
        setFormData({
            itemName: "",
            category: "Lab Equipment",
            quantity: 0,
            unitPrice: 0,
            purchaseDate: new Date().toISOString().split('T')[0],
            supplier: "",
            condition: "New",
            location: "",
            assignedTo: "Unassigned",
            assignedToName: "",
            warrantyExpiry: "",
            description: "",
            isExpense: false,
            expenseAmount: 0,
            walletId: ""
        });
    };

    const resetExpenseForm = () => {
        setExpenseData({
            expenseType: "Maintenance",
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            description: "",
            vendor: "",
            walletId: ""
        });
    };

    const handleAddItem = () => {
        if (!formData.itemName || !formData.supplier || !formData.location) {
            toast({
                title: "Error",
                description: "Please fill in all required fields",
                variant: "destructive"
            });
            return;
        }
        const totalValue = formData.quantity * formData.unitPrice;
        if (formData.isExpense && !formData.walletId) {
            toast({
                title: "Error",
                description: "Please select an account/wallet for expense deduction",
                variant: "destructive"
            });
            return;
        }
        const expAmount = Number(formData.expenseAmount) > 0 ? Number(formData.expenseAmount) : totalValue;
        const newItem = {
            ...formData,
            totalValue,
            isExpense: Boolean(formData.isExpense),
            expenseAmount: formData.isExpense ? expAmount : 0,
            walletId: formData.isExpense ? formData.walletId : null,
            assignedDate: formData.assignedTo !== "Unassigned" ? new Date().toISOString().split('T')[0] : undefined
        };
        createItemMutation.mutate(newItem);
    };

    const handleEditItem = () => {
        if (!selectedItem) return;
        const totalValue = formData.quantity * formData.unitPrice;
        if (formData.isExpense && !formData.walletId) {
            toast({
                title: "Error",
                description: "Please select an account/wallet for expense deduction",
                variant: "destructive"
            });
            return;
        }
        const expAmount = Number(formData.expenseAmount) > 0 ? Number(formData.expenseAmount) : totalValue;
        updateItemMutation.mutate({
            id: selectedItem.id,
            data: {
                ...formData,
                totalValue,
                isExpense: Boolean(formData.isExpense),
                expenseAmount: formData.isExpense ? expAmount : 0,
                walletId: formData.isExpense ? formData.walletId : null
            }
        });
    };

    const handleAssignItem = () => {
        if (!selectedItem) return;
        if (formData.assignedTo !== "Unassigned" && !formData.assignedToName) {
            toast({
                title: "Error",
                description: "Please enter assignment details",
                variant: "destructive"
            });
            return;
        }
        updateItemMutation.mutate({
            id: selectedItem.id,
            data: {
                assignedTo: formData.assignedTo,
                assignedToName: formData.assignedToName || undefined,
                assignedDate: formData.assignedTo !== "Unassigned" ? new Date().toISOString().split('T')[0] : undefined
            }
        });
    };

    const handleAddExpense = () => {
        if (!selectedItem || !expenseData.description || expenseData.amount <= 0) {
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
        const newExpense = {
            inventoryItemId: selectedItem.id,
            ...expenseData
        };
        createExpenseMutation.mutate(newExpense);
    };

    const handleDeleteItem = id => {
        if (confirm("Are you sure you want to delete this item? Related expenses will remain in records.")) {
            deleteItemMutation.mutate(id);
        }
    };

    const openEditDialog = item => {
        setSelectedItem(item);
        setFormData({
            itemName: item.itemName,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            purchaseDate: item.purchaseDate,
            supplier: item.supplier,
            condition: item.condition,
            location: item.location,
            assignedTo: item.assignedTo || "Unassigned",
            assignedToName: item.assignedToName || "",
            warrantyExpiry: item.warrantyExpiry || "",
            description: item.description || "",
            isExpense: Boolean(item.isExpense),
            expenseAmount: item.expenseAmount || item.totalValue || 0,
            walletId: item.walletId || ""
        });
        setIsEditOpen(true);
    };

    const openAssignDialog = item => {
        setSelectedItem(item);
        setFormData({
            ...formData,
            assignedTo: item.assignedTo || "Unassigned",
            assignedToName: item.assignedToName || ""
        });
        setIsAssignOpen(true);
    };

    const openExpenseDialog = item => {
        setSelectedItem(item);
        resetExpenseForm();
        setIsExpenseOpen(true);
    };

    const openHistoryDialog = item => {
        setHistoryItem(item);
        setIsHistoryOpen(true);
    };

    const filteredInventory = schoolInventory?.filter(item => {
        const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) || item.location.toLowerCase().includes(searchTerm.toLowerCase()) || item.assignedToName?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
        const matchesCategory = filterCategory === "all" || item.category === filterCategory;
        const matchesAssignment = filterAssignment === "all" || (item.assignedTo || "Unassigned") === filterAssignment;
        return matchesSearch && matchesCategory && matchesAssignment;
    });

    const getConditionBadge = condition => {
        const variants = {
            "New": "default",
            "Good": "secondary",
            "Fair": "outline",
            "Needs Repair": "destructive",
            "Damaged": "destructive"
        };
        return <Badge variant={variants[condition]}>{condition}</Badge>;
    };

    const getAssignmentBadge = assignedTo => {
        if (!assignedTo || assignedTo === "Unassigned") {
            return <Badge variant="outline">Unassigned</Badge>;
        }
        return <Badge>{assignedTo}</Badge>;
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Inventory Items</CardTitle>
                        <CardDescription>Manage all inventory items, assignments, and details</CardDescription>
                    </div>
                    {canCreate && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Item
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Add New Inventory Item</DialogTitle>
                                <DialogDescription>Fill in the details to add a new item to the inventory</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="itemName">Item Name *</Label>
                                        <Input id="itemName" value={formData.itemName} onChange={e => setFormData({
                                            ...formData,
                                            itemName: e.target.value
                                        })} placeholder="Enter item name" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Category *</Label>
                                        <Select value={formData.category} onValueChange={value => setFormData({
                                            ...formData,
                                            category: value
                                        })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">Quantity *</Label>
                                        <Input id="quantity" type="number" min="1" value={formData.quantity} onChange={e => setFormData({
                                            ...formData,
                                            quantity: parseInt(e.target.value) || 0
                                        })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="unitPrice">Unit Price (PKR) *</Label>
                                        <Input id="unitPrice" type="number" min="0" value={formData.unitPrice} onChange={e => setFormData({
                                            ...formData,
                                            unitPrice: parseFloat(e.target.value) || 0
                                        })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="purchaseDate">Purchase Date</Label>
                                        <Input id="purchaseDate" type="date" value={formData.purchaseDate} onChange={e => setFormData({
                                            ...formData,
                                            purchaseDate: e.target.value
                                        })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="supplier">Supplier *</Label>
                                        <Input id="supplier" value={formData.supplier} onChange={e => setFormData({
                                            ...formData,
                                            supplier: e.target.value
                                        })} placeholder="Supplier name" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="condition">Condition</Label>
                                        <Select value={formData.condition} onValueChange={value => setFormData({
                                            ...formData,
                                            condition: value
                                        })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {conditions.map(cond => <SelectItem key={cond} value={cond}>{cond}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="location">Location *</Label>
                                        <Input id="location" value={formData.location} onChange={e => setFormData({
                                            ...formData,
                                            location: e.target.value
                                        })} placeholder="e.g., Room 101, Main Block" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                                        <Input id="warrantyExpiry" type="date" value={formData.warrantyExpiry} onChange={e => setFormData({
                                            ...formData,
                                            warrantyExpiry: e.target.value
                                        })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="assignedTo">Assign To</Label>
                                        <Select value={formData.assignedTo} onValueChange={value => setFormData({
                                            ...formData,
                                            assignedTo: value
                                        })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {assignmentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {formData.assignedTo !== "Unassigned" && (
                                    <div className="space-y-2">
                                        <Label htmlFor="assignedToName">Assignment Name *</Label>
                                        <Input id="assignedToName" value={formData.assignedToName} onChange={e => setFormData({
                                            ...formData,
                                            assignedToName: e.target.value
                                        })} placeholder="e.g., Biology Lab, HSSC XI-A, IT Department" />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea id="description" value={formData.description} onChange={e => setFormData({
                                        ...formData,
                                        description: e.target.value
                                    })} placeholder="Additional details about the item..." rows={3} />
                                </div>

                                {/* Record as Expense Section */}
                                <div className="pt-3 border-t space-y-3">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="addItemRecordAsExpense"
                                            checked={formData.isExpense}
                                            onCheckedChange={(checked) => {
                                                const isExp = !!checked;
                                                const total = (formData.quantity || 0) * (formData.unitPrice || 0);
                                                setFormData({
                                                    ...formData,
                                                    isExpense: isExp,
                                                    expenseAmount: isExp ? (formData.expenseAmount > 0 ? formData.expenseAmount : total) : 0
                                                });
                                            }}
                                        />
                                        <Label htmlFor="addItemRecordAsExpense" className="text-sm font-medium cursor-pointer">
                                            Record as expense
                                        </Label>
                                    </div>

                                    {formData.isExpense && (
                                        <div className="p-3 bg-muted/40 border rounded-lg space-y-3">
                                            <div>
                                                <Label className="text-xs font-semibold">Expense Amount (PKR) *</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={formData.expenseAmount || ""}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            expenseAmount: parseFloat(e.target.value) || 0,
                                                        })
                                                    }
                                                    placeholder="0.00"
                                                    className="h-9 text-sm font-mono mt-1"
                                                />
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    Defaults to Total Value ({((formData.quantity || 0) * (formData.unitPrice || 0)).toLocaleString()} PKR). You can adjust if needed.
                                                </p>
                                            </div>

                                            <div>
                                                <Label className="text-xs font-semibold">Paid From Account / Wallet *</Label>
                                                <Select
                                                    value={formData.walletId || "none"}
                                                    onValueChange={(val) =>
                                                        setFormData({
                                                            ...formData,
                                                            walletId: val === "none" ? "" : val,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger className="h-9 text-xs mt-1">
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
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    Amount will be deducted from this account and logged under expenses.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddItem} disabled={createItemMutation.isPending}>Add Item</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 mb-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <Input placeholder="Search items..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterAssignment} onValueChange={setFilterAssignment}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Assignment" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Assignments</SelectItem>
                                {assignmentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-2 px-3 text-sm">Item</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Category</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Qty</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Value</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Expense</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Assignment</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Location</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Condition</TableHead>
                                        <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInventory?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="py-2 px-3 text-sm text-center text-muted-foreground">
                                                No inventory items found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredInventory?.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="py-2 px-3 text-sm font-medium">{item.itemName}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">{item.category}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">{item.quantity}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm font-semibold">PKR {item.totalValue.toLocaleString()}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">
                                                    {item.isExpense ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-semibold font-mono text-xs text-rose-600">
                                                                PKR {Number(item.expenseAmount || item.totalValue || 0).toLocaleString()}
                                                            </span>
                                                            {item.walletName ? (
                                                                <Badge variant="outline" className="w-fit text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 font-normal">
                                                                    <Wallet className="w-2.5 h-2.5 mr-1" />
                                                                    {item.walletName}
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        {getAssignmentBadge(item.assignedTo)}
                                                        {item.assignedToName && <span className="text-xs text-muted-foreground">{item.assignedToName}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-sm">{item.location}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">{getConditionBadge(item.condition)}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">
                                                    <div className="flex gap-1">
                                                        {canUpdate && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(item)} title="Edit">
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Edit</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        {canUpdate && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="sm" variant="ghost" onClick={() => openAssignDialog(item)} title="Assign">
                                                                        <ClipboardList className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Assign</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        {canCreate && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="sm" variant="ghost" onClick={() => openExpenseDialog(item)} title="Add Expense">
                                                                        <Wrench className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Add Expense</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button size="sm" variant="ghost" onClick={() => openHistoryDialog(item)} title="View History">
                                                                    <History className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>View History</TooltipContent>
                                                        </Tooltip>
                                                        {canDelete && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item.id)} title="Delete">
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

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Inventory Item</DialogTitle>
                        <DialogDescription>Update item details</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Item Name</Label>
                                <Input value={formData.itemName} onChange={e => setFormData({
                                    ...formData,
                                    itemName: e.target.value
                                })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={formData.category} onValueChange={value => setFormData({
                                    ...formData,
                                    category: value
                                })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input type="number" value={formData.quantity} onChange={e => setFormData({
                                    ...formData,
                                    quantity: parseInt(e.target.value) || 0
                                })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Unit Price</Label>
                                <Input type="number" value={formData.unitPrice} onChange={e => setFormData({
                                    ...formData,
                                    unitPrice: parseFloat(e.target.value) || 0
                                })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Condition</Label>
                                <Select value={formData.condition} onValueChange={value => setFormData({
                                    ...formData,
                                    condition: value
                                })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {conditions.map(cond => <SelectItem key={cond} value={cond}>{cond}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Location</Label>
                                <Input value={formData.location} onChange={e => setFormData({
                                    ...formData,
                                    location: e.target.value
                                })} />
                            </div>
                        </div>

                        {/* Record as Expense Section */}
                        <div className="pt-3 border-t space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="editItemRecordAsExpense"
                                    checked={formData.isExpense}
                                    onCheckedChange={(checked) => {
                                        const isExp = !!checked;
                                        const total = (formData.quantity || 0) * (formData.unitPrice || 0);
                                        setFormData({
                                            ...formData,
                                            isExpense: isExp,
                                            expenseAmount: isExp ? (formData.expenseAmount > 0 ? formData.expenseAmount : total) : 0
                                        });
                                    }}
                                />
                                <Label htmlFor="editItemRecordAsExpense" className="text-sm font-medium cursor-pointer">
                                    Record as expense
                                </Label>
                            </div>

                            {formData.isExpense && (
                                <div className="p-3 bg-muted/40 border rounded-lg space-y-3">
                                    <div>
                                        <Label className="text-xs font-semibold">Expense Amount (PKR) *</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={formData.expenseAmount || ""}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    expenseAmount: parseFloat(e.target.value) || 0,
                                                })
                                            }
                                            placeholder="0.00"
                                            className="h-9 text-sm font-mono mt-1"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Defaults to Total Value ({((formData.quantity || 0) * (formData.unitPrice || 0)).toLocaleString()} PKR). You can adjust if needed.
                                        </p>
                                    </div>

                                    <div>
                                        <Label className="text-xs font-semibold">Paid From Account / Wallet *</Label>
                                        <Select
                                            value={formData.walletId || "none"}
                                            onValueChange={(val) =>
                                                setFormData({
                                                    ...formData,
                                                    walletId: val === "none" ? "" : val,
                                                })
                                            }
                                        >
                                            <SelectTrigger className="h-9 text-xs mt-1">
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
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Amount will be deducted from this account and logged under expenses.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setIsEditOpen(false);
                            setSelectedItem(null);
                        }}>Cancel</Button>
                        <Button onClick={handleEditItem}>Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assignment Dialog */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Inventory Item</DialogTitle>
                        <DialogDescription>Assign this item to a class, department, or lab</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Assign To</Label>
                            <Select value={formData.assignedTo} onValueChange={value => setFormData({
                                ...formData,
                                assignedTo: value
                            })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {assignmentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.assignedTo !== "Unassigned" && <div className="space-y-2">
                            <Label>Assignment Name</Label>
                            <Input value={formData.assignedToName} onChange={e => setFormData({
                                ...formData,
                                assignedToName: e.target.value
                            })} placeholder="e.g., Biology Lab, HSSC XI-A, IT Department" />
                        </div>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setIsAssignOpen(false);
                            setSelectedItem(null);
                        }}>Cancel</Button>
                        <Button onClick={handleAssignItem}>Save Assignment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Expense Dialog */}
            <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Expense for {selectedItem?.itemName}</DialogTitle>
                        <DialogDescription>Record maintenance, repair, or other expenses</DialogDescription>
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
                        <Button variant="outline" onClick={() => {
                            setIsExpenseOpen(false);
                            setSelectedItem(null);
                        }}>Cancel</Button>
                        <Button onClick={handleAddExpense}>Add Expense</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Maintenance History</DialogTitle>
                        <DialogDescription>
                            Expenses and maintenance records for {historyItem?.itemName}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {isLoadingHistory ? (
                            <div className="text-center py-4">Loading history...</div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="py-2 px-3 text-sm">Date</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Type</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Description</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Vendor</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Paid From</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {itemHistory.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-2 px-3 text-sm text-center text-muted-foreground">
                                                    No maintenance records found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            itemHistory.map((expense) => (
                                                <TableRow key={expense.id}>
                                                    <TableCell className="py-2 px-3 text-sm">{new Date(expense.date).toLocaleDateString()}</TableCell>
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
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
