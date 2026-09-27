import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFeeHeads, createFeeHead, updateFeeHead, deleteFeeHead } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";

export const FeeHeadsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Fee Management", "feeheads");

  const [feeHeadOpen, setFeeHeadOpen] = useState(false);
  const [editingFeeHead, setEditingFeeHead] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [feeHeadForm, setFeeHeadForm] = useState({
    name: "",
    description: "",
    amount: "",
    type: "monthly",
    isTuition: false,
    isFine: false,
    isLabFee: false,
    isLibraryFee: false,
    isRegistrationFee: false,
    isAdmissionFee: false,
    isProspectusFee: false,
    isExaminationFee: false,
    isAlliedCharges: false,
    isHostelFee: false,
    isOther: false,
  });

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['feeHeads'],
    queryFn: getFeeHeads,
  });

  const resetFeeHeadForm = () => {
    setFeeHeadForm({
      name: "",
      description: "",
      amount: "",
      type: "monthly",
      isTuition: false,
      isFine: false,
      isLabFee: false,
      isLibraryFee: false,
      isRegistrationFee: false,
      isAdmissionFee: false,
      isProspectusFee: false,
      isExaminationFee: false,
      isAlliedCharges: false,
      isHostelFee: false,
      isOther: false,
    });
    setEditingFeeHead(null);
  };

  const createHeadMutation = useMutation({
    mutationFn: createFeeHead,
    onSuccess: () => {
      queryClient.invalidateQueries(['feeHeads']);
      toast({ title: "Fee head created successfully" });
      setFeeHeadOpen(false);
      resetFeeHeadForm();
    },
    onError: (error) => toast({ title: error.message, variant: "destructive" }),
  });

  const updateHeadMutation = useMutation({
    mutationFn: ({ id, data }) => updateFeeHead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['feeHeads']);
      toast({ title: "Fee head updated successfully" });
      setFeeHeadOpen(false);
      resetFeeHeadForm();
    },
    onError: (error) => toast({ title: error.message, variant: "destructive" }),
  });

  const deleteHeadMutation = useMutation({
    mutationFn: deleteFeeHead,
    onSuccess: () => {
      queryClient.invalidateQueries(['feeHeads']);
      toast({ title: "Fee head deleted" });
      setDeleteDialogOpen(false);
    },
    onError: (error) => toast({ title: error.message, variant: "destructive" }),
  });

  const handleSubmitFeeHead = () => {
    if (!feeHeadForm.name || !feeHeadForm.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    const payload = {
      name: feeHeadForm.name,
      amount: parseFloat(feeHeadForm.amount),
      description: feeHeadForm.description,
      type: feeHeadForm.type,
      isTuition: feeHeadForm.isTuition,
      isFine: feeHeadForm.isFine,
      isLabFee: feeHeadForm.isLabFee,
      isLibraryFee: feeHeadForm.isLibraryFee,
      isRegistrationFee: feeHeadForm.isRegistrationFee,
      isAdmissionFee: feeHeadForm.isAdmissionFee,
      isProspectusFee: feeHeadForm.isProspectusFee,
      isExaminationFee: feeHeadForm.isExaminationFee,
      isAlliedCharges: feeHeadForm.isAlliedCharges,
      isHostelFee: feeHeadForm.isHostelFee,
      isOther: feeHeadForm.isOther,
    };

    if (editingFeeHead) {
      updateHeadMutation.mutate({ id: editingFeeHead.id, data: payload });
    } else {
      createHeadMutation.mutate(payload);
    }
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    deleteHeadMutation.mutate(itemToDelete.id);
    setItemToDelete(null);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fee Heads</CardTitle>
            {canCreate && (
              <Button onClick={() => {
                resetFeeHeadForm();
                setFeeHeadOpen(true);
              }} className="gap-2">
                <Plus className="w-4 h-4" />Add Fee Head
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm">Name</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Description</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Amount</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Type</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeHeads.map(head => (
                  <TableRow key={head.id}>
                    <TableCell className="text-sm px-3 py-2 font-medium">{head.name}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">{head.description}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">PKR {(head.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <Badge>Charge</Badge>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <div className="flex gap-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditingFeeHead(head);
                                setFeeHeadForm({
                                  name: head.name,
                                  description: head.description,
                                  amount: head.amount.toString(),
                                  type: head.type || "monthly",
                                  isTuition: head.isTuition || false,
                                  isFine: head.isFine || false,
                                  isLabFee: head.isLabFee || false,
                                  isLibraryFee: head.isLibraryFee || false,
                                  isRegistrationFee: head.isRegistrationFee || false,
                                  isAdmissionFee: head.isAdmissionFee || false,
                                  isProspectusFee: head.isProspectusFee || false,
                                  isExaminationFee: head.isExaminationFee || false,
                                  isAlliedCharges: head.isAlliedCharges || false,
                                  isHostelFee: head.isHostelFee || false,
                                  isOther: head.isOther || false,
                                });
                                setFeeHeadOpen(true);
                              }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Fee Head</TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => {
                                setItemToDelete({
                                  type: "feeHead",
                                  id: head.id,
                                });
                                setDeleteDialogOpen(true);
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Fee Head</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Fee Head Dialog */}
      <Dialog open={feeHeadOpen} onOpenChange={setFeeHeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFeeHead ? "Edit" : "Add"} Fee Head</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={feeHeadForm.name} onChange={e => setFeeHeadForm({
                ...feeHeadForm,
                name: e.target.value,
              })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={feeHeadForm.description} onChange={e => setFeeHeadForm({
                ...feeHeadForm,
                description: e.target.value,
              })} />
            </div>
            <div className="space-y-2">
              <Label>Amount (PKR)</Label>
              <Input type="number" value={feeHeadForm.amount} onChange={e => setFeeHeadForm({
                ...feeHeadForm,
                amount: e.target.value,
              })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isTuition" checked={feeHeadForm.isTuition} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isTuition: e.target.checked,
                  isFine: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                  isOther: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isTuition">Tuition Fee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isFine" checked={feeHeadForm.isFine} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isFine: e.target.checked,
                  isTuition: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                  isOther: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isFine">Fine</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isLabFee" checked={feeHeadForm.isLabFee} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isTuition: false,
                  isFine: false,
                  isLabFee: e.target.checked,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                  isOther: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isLabFee">Lab Fee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isLibraryFee" checked={feeHeadForm.isLibraryFee} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isLibraryFee: e.target.checked,
                  isTuition: false,
                  isFine: false,
                  isLabFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isLibraryFee">Library Fee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isRegistrationFee" checked={feeHeadForm.isRegistrationFee} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isRegistrationFee: e.target.checked,
                  isTuition: false,
                  isFine: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isRegistrationFee">Registration Fee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isAdmissionFee" checked={feeHeadForm.isAdmissionFee} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isAdmissionFee: e.target.checked,
                  isTuition: false,
                  isFine: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isAdmissionFee">Admission Fee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isProspectusFee" checked={feeHeadForm.isProspectusFee} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isProspectusFee: e.target.checked,
                  isTuition: false,
                  isFine: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isProspectusFee">Prospectus Fee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isExaminationFee" checked={feeHeadForm.isExaminationFee} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isExaminationFee: e.target.checked,
                  isTuition: false,
                  isFine: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isExaminationFee">Examination Fee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isAlliedCharges" checked={feeHeadForm.isAlliedCharges} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isAlliedCharges: e.target.checked,
                  isTuition: false,
                  isFine: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isHostelFee: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isAlliedCharges">Allied Charges</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isHostelFee" checked={feeHeadForm.isHostelFee} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isHostelFee: e.target.checked,
                  isTuition: false,
                  isFine: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isOther: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isHostelFee">Hostel Fee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isOther" checked={feeHeadForm.isOther} onChange={e => setFeeHeadForm({
                  ...feeHeadForm,
                  isOther: e.target.checked,
                  isTuition: false,
                  isFine: false,
                  isLabFee: false,
                  isLibraryFee: false,
                  isRegistrationFee: false,
                  isAdmissionFee: false,
                  isProspectusFee: false,
                  isExaminationFee: false,
                  isAlliedCharges: false,
                  isHostelFee: false,
                })} className="w-4 h-4" />
                <Label htmlFor="isOther">Others</Label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setFeeHeadOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmitFeeHead}
                disabled={createHeadMutation.isPending || updateHeadMutation.isPending}
              >
                {createHeadMutation.isPending || updateHeadMutation.isPending ? "Saving..." : (editingFeeHead ? "Update" : "Add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the fee head.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
