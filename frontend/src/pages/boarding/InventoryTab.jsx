import React, { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import { Package, Edit, Trash2, Wallet, Receipt } from "lucide-react";
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getRooms,
  getWallets,
} from "@/services/api";

export const InventoryTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Boarding", "inventory");

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [editMode, setEditMode] = useState({});
  const [inventoryFormData, setInventoryFormData] = useState({
    itemName: "",
    category: "Furniture",
    quantity: 1,
    condition: "Good",
    allocatedToRoom: "",
    isExpense: false,
    expenseAmount: 0,
    walletId: "",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: getInventoryItems,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });

  const { data: walletsData } = useQuery({
    queryKey: ['wallets'],
    queryFn: getWallets,
  });
  const activeWallets = (walletsData?.wallets || []).filter((w) => w.status === 'ACTIVE');

  const handleAddInventory = async () => {
    if (!inventoryFormData.itemName) {
      toast({ title: "Please enter item name", variant: "destructive" });
      return;
    }
    if (inventoryFormData.isExpense) {
      if (!inventoryFormData.walletId) {
        toast({ title: "Please select an account / wallet for expense deduction", variant: "destructive" });
        return;
      }
      if (!inventoryFormData.expenseAmount || Number(inventoryFormData.expenseAmount) <= 0) {
        toast({ title: "Please enter a valid expense amount", variant: "destructive" });
        return;
      }
    }
    try {
      const payload = {
        ...inventoryFormData,
        category: inventoryFormData.category.toLowerCase(),
        quantity: Number(inventoryFormData.quantity),
        isExpense: !!inventoryFormData.isExpense,
        expenseAmount: Number(inventoryFormData.expenseAmount || 0),
        walletId: inventoryFormData.isExpense ? inventoryFormData.walletId : null,
      };

      if (editMode.inventory) {
        await updateInventoryItem(editMode.inventory, payload);
        toast({ title: "Inventory item updated" });
      } else {
        await createInventoryItem({
          ...payload,
          hostelName: "Main Hostel",
        });
        toast({ title: "Inventory item added" });
      }
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] });
      queryClient.invalidateQueries({ queryKey: ['walletExpenseLogs'] });
      setInventoryOpen(false);
      setEditMode({});
      setInventoryFormData({
        itemName: "",
        category: "Furniture",
        quantity: 1,
        condition: "Good",
        allocatedToRoom: "",
        isExpense: false,
        expenseAmount: 0,
        walletId: "",
      });
    } catch (error) {
      toast({ title: "Error", description: error.message || "Failed to save item", variant: "destructive" });
    }
  };

  const handleDeleteInventory = async () => {
    if (!itemToDelete) return;
    try {
      await deleteInventoryItem(itemToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] });
      queryClient.invalidateQueries({ queryKey: ['walletExpenseLogs'] });
      toast({ title: "Item deleted successfully" });
    } catch (e) {
      toast({ title: e.message || "Failed to delete item", variant: "destructive" });
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Inventory Management</CardTitle>
            {canCreate && (
              <Button onClick={() => {
                setEditMode({});
                setInventoryFormData({
                  itemName: "",
                  category: "Furniture",
                  quantity: 1,
                  condition: "Good",
                  allocatedToRoom: "",
                  isExpense: false,
                  expenseAmount: 0,
                  walletId: "",
                });
                setInventoryOpen(true);
              }}>
                <Package className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm">Item Name</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Category</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Quantity</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Condition</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Allocated To</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Expense</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-2 px-3 text-sm font-medium">{item.itemName}</TableCell>
                    <TableCell className="py-2 px-3 text-sm capitalize">{item.category}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">{item.quantity}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <Badge variant={item.condition === "new" ? "default" : "secondary"}>
                        {item.condition}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">{item.allocatedToRoom || "Not Allocated"}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      {item.isExpense ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold font-mono text-xs text-foreground">
                            PKR {Number(item.expenseAmount || 0).toLocaleString()}
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
                      <div className="flex gap-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditMode({ inventory: item.id });
                                  setInventoryFormData({
                                    itemName: item.itemName,
                                    category: item.category.charAt(0).toUpperCase() + item.category.slice(1),
                                    quantity: item.quantity,
                                    condition: item.condition === "new" ? "New" : item.condition === "good" ? "Good" : "Repair Needed",
                                    allocatedToRoom: item.allocatedToRoom,
                                    isExpense: !!item.isExpense,
                                    expenseAmount: item.expenseAmount || 0,
                                    walletId: item.walletId || "",
                                  });
                                  setInventoryOpen(true);
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
                                  setItemToDelete(item);
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
                {inventoryItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={inventoryOpen} onOpenChange={(open) => {
        setInventoryOpen(open);
        if (!open) setEditMode({});
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode.inventory ? "Edit" : "Add"} Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name</Label>
              <Input
                value={inventoryFormData.itemName}
                onChange={(e) => setInventoryFormData({ ...inventoryFormData, itemName: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={inventoryFormData.category}
                onValueChange={(value) => setInventoryFormData({ ...inventoryFormData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Furniture">Furniture</SelectItem>
                  <SelectItem value="Appliance">Appliance</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                value={inventoryFormData.quantity}
                onChange={(e) => setInventoryFormData({ ...inventoryFormData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Condition</Label>
              <Select
                value={inventoryFormData.condition}
                onValueChange={(value) => setInventoryFormData({ ...inventoryFormData, condition: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Repair Needed">Repair Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Allocated To Room (optional)</Label>
              <Select
                value={inventoryFormData.allocatedToRoom || "none"}
                onValueChange={(value) => setInventoryFormData({ ...inventoryFormData, allocatedToRoom: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Allocated</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.roomNumber}>
                      Room {room.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Record as Expense Section */}
            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recordAsExpense"
                  checked={inventoryFormData.isExpense}
                  onCheckedChange={(checked) =>
                    setInventoryFormData({ ...inventoryFormData, isExpense: !!checked })
                  }
                />
                <Label htmlFor="recordAsExpense" className="text-sm font-medium cursor-pointer">
                  Record as expense
                </Label>
              </div>

              {inventoryFormData.isExpense && (
                <div className="p-3 bg-muted/40 border rounded-lg space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Expense Amount (PKR) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={inventoryFormData.expenseAmount || ""}
                      onChange={(e) =>
                        setInventoryFormData({
                          ...inventoryFormData,
                          expenseAmount: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className="h-9 text-sm font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Paid From Account / Wallet *</Label>
                    <Select
                      value={inventoryFormData.walletId || "none"}
                      onValueChange={(val) =>
                        setInventoryFormData({
                          ...inventoryFormData,
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
          <Button onClick={handleAddInventory}>{editMode.inventory ? "Update" : "Add"} Item</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete inventory item "{itemToDelete?.itemName}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInventory} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
