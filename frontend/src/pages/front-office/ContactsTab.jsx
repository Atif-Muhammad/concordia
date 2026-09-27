import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Phone, Edit, Trash2, Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  INPUT_LIMITS,
  firstError,
  validateEmail,
  validateMaxLength,
  validateRequired,
} from "@/lib/inputValidation";
import {
  getContacts,
  createContact as createContactApi,
  updateContact as UpdateContactApi,
  delContact,
} from "../../../config/apis";

export default function ContactsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Front Office", "contacts");

  const [contactDialog, setContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [contactNameSearch, setContactNameSearch] = useState("");
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: "", name: "" });

  const [contactForm, setContactForm] = useState({
    name: "",
    category: "Emergency",
    phone: "",
    email: "",
    details: "",
  });
  const [contactErrors, setContactErrors] = useState({});

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => getContacts(),
  });

  const createContactMutation = useMutation({
    mutationFn: createContactApi,
    onSuccess: () => {
      closeContactDialog();
      toast({ title: "Contact created successfully" });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err) => {
      toast({
        title: err.message || "Contact creation failed",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, payload }) => UpdateContactApi(id, payload),
    onSuccess: () => {
      closeContactDialog();
      toast({ title: "Contact updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err) => {
      toast({
        title: err.message || "Contact update failed",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: delContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contact deleted" });
      setDeleteDialog({ open: false, id: "", name: "" });
    },
    onError: (err) => {
      toast({
        title: err.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const closeContactDialog = () => {
    setContactForm({
      name: "",
      category: "Emergency",
      phone: "",
      email: "",
      details: "",
    });
    setContactErrors({});
    setEditingContact(null);
    setContactDialog(false);
  };

  const handleContactSubmit = () => {
    const nextErrors = {
      name: firstError(
        validateRequired(contactForm.name, "Name"),
        validateMaxLength(contactForm.name, INPUT_LIMITS.name, "Name")
      ),
      phone: (() => {
        const val = String(contactForm.phone || "").trim();
        if (!val) return "Phone is required";
        if (!/^[+\d\s()-]+$/.test(val) || !/\d/.test(val)) {
          return "Phone must be a valid number";
        }
        return null;
      })(),
      email: validateEmail(contactForm.email),
      details: validateMaxLength(contactForm.details, INPUT_LIMITS.longText, "Description"),
    };
    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });
    if (Object.keys(nextErrors).length > 0) {
      setContactErrors(nextErrors);
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted fields.",
        variant: "destructive",
      });
      return;
    }
    setContactErrors({});

    if (editingContact) {
      updateContactMutation.mutate({
        id: editingContact.id || editingContact._id,
        payload: contactForm,
      });
    } else {
      createContactMutation.mutate(contactForm);
    }
  };

  const handleEditContact = (contact) => {
    setContactForm({
      name: contact.name || "",
      category: contact.category || "Emergency",
      phone: contact.phone || "",
      email: contact.email || "",
      details: contact.details || "",
    });
    setEditingContact({ ...contact, id: contact.id || contact._id });
    setContactDialog(true);
  };

  const handlePrintTable = () => {
    const content = document.getElementById("printableContacts")?.innerHTML;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Contacts</title>
          <style>
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
            }
            .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredContacts = useMemo(() => {
    const contactRows = contacts || [];
    const byCategory =
      categoryFilter === "All"
        ? contactRows
        : contactRows.filter((c) => c.category === categoryFilter);
    return byCategory.filter(
      (contact) =>
        !contactNameSearch.trim() ||
        String(contact.name || "")
          .toLowerCase()
          .includes(contactNameSearch.trim().toLowerCase())
    );
  }, [contacts, categoryFilter, contactNameSearch]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Contact Directory
        </CardTitle>

        <Dialog open={contactDialog} onOpenChange={setContactDialog}>
          <div className="flex items-center justify-center gap-x-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={contactNameSearch}
                  onChange={(e) => setContactNameSearch(e.target.value)}
                  placeholder="Search by name"
                  className="w-[200px] pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Academic">Academic</SelectItem>
                  <SelectItem value="Technical">Technical</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="secondary" onClick={handlePrintTable}>
                Print
              </Button>
            </div>
            {canCreate && (
              <DialogTrigger asChild>
                <Button onClick={() => setEditingContact(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
            )}
          </div>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingContact ? "Edit" : "Add"} Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name *</Label>
                  <Input
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, name: e.target.value })
                    }
                    placeholder="Enter name"
                    className={contactErrors.name ? "border-destructive" : ""}
                  />
                  <FieldError message={contactErrors.name} />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={contactForm.category}
                    onValueChange={(v) =>
                      setContactForm({ ...contactForm, category: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Emergency">Emergency</SelectItem>
                      <SelectItem value="Academic">Academic</SelectItem>
                      <SelectItem value="Technical">Technical</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                    placeholder="e.g. 1122, 091-5619915, 0300-1234567"
                    className={contactErrors.phone ? "border-destructive" : ""}
                  />
                  <FieldError message={contactErrors.phone} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                    placeholder="email@example.com"
                    className={contactErrors.email ? "border-destructive" : ""}
                  />
                  <FieldError message={contactErrors.email} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={contactForm.details}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, details: e.target.value })
                  }
                  placeholder="Additional details"
                  rows={2}
                  className={contactErrors.details ? "border-destructive" : ""}
                />
                <FieldError message={contactErrors.details} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeContactDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleContactSubmit}
                disabled={createContactMutation.isPending || updateContactMutation.isPending}
              >
                {createContactMutation.isPending || updateContactMutation.isPending
                  ? "Saving..."
                  : editingContact
                  ? "Update"
                  : "Add"}{" "}
                Contact
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div id="printableContacts">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Category</TableHead>
                <TableHead className="py-2 px-3 text-sm">Phone</TableHead>
                <TableHead className="py-2 px-3 text-sm">Email</TableHead>
                <TableHead className="py-2 px-3 text-sm">Description</TableHead>
                <TableHead className="py-2 px-3 text-sm no-print">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts?.map((contact) => (
                <TableRow key={contact.id || contact._id}>
                  <TableCell className="py-2 px-3 text-sm font-medium">
                    {contact.name}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                      {contact.category}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    {contact.phone || "-"}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    {contact.email || "-"}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    {contact.details || "-"}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm no-print">
                    <div className="flex gap-2">
                      {canUpdate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditContact(contact)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Contact</TooltipContent>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeleteDialog({
                                  open: true,
                                  id: contact.id || contact._id,
                                  name: contact.name,
                                })
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete Contact</TooltipContent>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!deleteContactMutation.isPending) {
            setDeleteDialog((prev) => ({ ...prev, open }));
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete contact{" "}
              {deleteDialog.name ? <strong>"{deleteDialog.name}"</strong> : "this record"}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteContactMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteContactMutation.mutate(deleteDialog.id);
              }}
              disabled={deleteContactMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
