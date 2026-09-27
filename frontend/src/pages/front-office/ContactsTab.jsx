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
  const [selectedContact, setSelectedContact] = useState(null);
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
      <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Contact Directory
        </CardTitle>

        <Dialog open={contactDialog} onOpenChange={setContactDialog}>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={contactNameSearch}
                onChange={(e) => setContactNameSearch(e.target.value)}
                placeholder="Search name"
                className="w-full sm:w-[160px] lg:w-[200px] pl-8 h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[120px] sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm">
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
            <Button variant="secondary" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5" onClick={handlePrintTable}>
              Print
            </Button>
            {canCreate && (
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3" onClick={() => setEditingContact(null)}>
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
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
      <CardContent className="p-2 sm:p-6 pt-0">
        <div id="printableContacts" className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Name</TableHead>
                <TableHead className="hidden sm:table-cell py-2 px-3 text-sm">Category</TableHead>
                <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Phone</TableHead>
                <TableHead className="hidden md:table-cell py-2 px-3 text-sm">Email</TableHead>
                <TableHead className="hidden lg:table-cell py-2 px-3 text-sm">Description</TableHead>
                <TableHead className="hidden sm:table-cell py-2 px-3 text-sm no-print text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts?.map((contact) => (
                <TableRow
                  key={contact.id || contact._id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setSelectedContact(contact)}
                >
                  <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium">
                    <div className="font-semibold text-foreground">{contact.name}</div>
                    <div className="flex sm:hidden items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">
                        {contact.category}
                      </span>
                      {contact.email && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-2 px-3 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary font-medium">
                      {contact.category}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm font-mono font-medium">
                    {contact.phone || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-2 px-3 text-sm">
                    {contact.email || "-"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-2 px-3 text-sm max-w-[200px] truncate">
                    {contact.details || "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-2 px-3 text-sm no-print text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                              <Trash2 className="w-4 h-4 text-destructive" />
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

      {/* Mobile Contact Details Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Contact Details</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-3 text-xs sm:text-sm pt-2">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-semibold text-foreground">{selectedContact.name}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Category:</span>
                <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-medium">
                  {selectedContact.category}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Phone:</span>
                <a href={`tel:${selectedContact.phone}`} className="font-mono font-medium text-primary hover:underline">
                  {selectedContact.phone || "-"}
                </a>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Email:</span>
                {selectedContact.email ? (
                  <a href={`mailto:${selectedContact.email}`} className="text-primary hover:underline">
                    {selectedContact.email}
                  </a>
                ) : (
                  <span>-</span>
                )}
              </div>
              {selectedContact.details && (
                <div className="py-1.5 border-b">
                  <span className="text-muted-foreground block mb-1">Description:</span>
                  <p className="text-xs bg-muted/40 p-2 rounded border leading-relaxed">
                    {selectedContact.details}
                  </p>
                </div>
              )}
              <div className="pt-2 flex justify-end gap-2">
                {canUpdate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const c = selectedContact;
                      setSelectedContact(null);
                      handleEditContact(c);
                    }}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => {
                      const c = selectedContact;
                      setSelectedContact(null);
                      setDeleteDialog({
                        open: true,
                        id: c.id || c._id,
                        name: c.name,
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
