import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Shield, Lock, Edit, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { NAV_MODULES } from "@/lib/navigation.jsx";
import {
  getAdmins,
  createAdmin as createAdminAPI,
  updateAdmin as updateAdminAPI,
  deleteAdmin as deleteAdminAPI,
} from "@/services/api";
import usePermissions from "@/hooks/usePermissions";

export const AdminsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Configuration", "admins");
  const allModules = NAV_MODULES;

  const [dialog, setDialog] = useState({ type: "", open: false });
  const [editing, setEditing] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN",
    accessRights: [],
    subModules: {},
  });
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    adminId: "",
    newPassword: "",
    confirmPassword: "",
  });

  const mapAdminData = (admin) => {
    const permissions = admin.permissions || {};
    return {
      id: admin.id,
      name: admin.name || admin.email.split("@")[0],
      email: admin.email,
      role: admin.role,
      accessRights: permissions.modules || [],
      subModules: permissions.subModules || {},
    };
  };

  const { data: adminsRaw = [], isLoading: adminsLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: getAdmins,
  });

  const admins = Array.isArray(adminsRaw) ? adminsRaw.map(mapAdminData) : [];

  const createAdminMutation = useMutation({
    mutationFn: createAdminAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast({ title: "Admin created successfully" });
      setDialog({ type: "", open: false });
      setAdminForm({ name: "", email: "", password: "", role: "ADMIN", accessRights: [], subModules: {} });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Failed to create admin", variant: "destructive" });
    },
  });

  const updateAdminMutation = useMutation({
    mutationFn: ({ id, data }) => updateAdminAPI(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast({ title: "Admin updated successfully" });
      setDialog({ type: "", open: false });
      setEditing(null);
      setAdminForm({ name: "", email: "", password: "", role: "ADMIN", accessRights: [], subModules: {} });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Failed to update admin", variant: "destructive" });
    },
  });

  const deleteAdminMutation = useMutation({
    mutationFn: deleteAdminAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast({ title: "Admin deleted successfully" });
      setDeleteDialog(false);
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Failed to delete admin", variant: "destructive" });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: ({ id, data }) => updateAdminAPI(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast({ title: "Password updated successfully" });
      setPasswordDialog(false);
      setPasswordForm({ adminId: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Failed to update password", variant: "destructive" });
    },
  });

  const toggleAccessMutation = useMutation({
    mutationFn: ({ id, data }) => updateAdminAPI(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast({
        title: "Success",
        description: `Access updated for ${variables.module}`,
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Failed to update access rights", variant: "destructive" });
    },
  });

  const renderButtonContent = (loading, loadingText, defaultContent) =>
    loading ? (
      <>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        {loadingText}
      </>
    ) : (
      defaultContent
    );

  const handleAdminSubmit = () => {
    const adminData = {
      name: adminForm.name,
      email: adminForm.email,
      password: adminForm.password,
      role: "ADMIN",
      permissions: {
        modules: adminForm.accessRights || [],
        subModules: adminForm.subModules || {},
      },
    };

    if (editing) {
      const updateData = { ...adminData };
      if (!adminForm.password) {
        delete updateData.password;
      }
      updateAdminMutation.mutate({ id: editing.id, data: updateData });
    } else {
      createAdminMutation.mutate(adminData);
    }
  };

  const toggleAccessRight = async (adminId, module) => {
    const admin = admins.find((a) => a.id === adminId);
    if (!admin) return;
    const moduleConfig = allModules.find((m) => m.label === module);
    const childIds = moduleConfig?.subModules?.map((sub) => sub.id) || [];
    const hasAccess = admin.accessRights.includes(module);
    const newAccessRights = hasAccess
      ? admin.accessRights.filter((m) => m !== module)
      : [...admin.accessRights, module];
    const newSubModules = { ...(admin.subModules || {}) };
    if (hasAccess) {
      delete newSubModules[module];
    } else if (childIds.length > 0) {
      newSubModules[module] = childIds;
    }

    const updateData = {
      permissions: { modules: newAccessRights, subModules: newSubModules },
    };

    toggleAccessMutation.mutate({ id: adminId, data: updateData, module });
  };

  const toggleSubmoduleAccess = async (adminId, module, subModuleId) => {
    const admin = admins.find((a) => a.id === adminId);
    if (!admin) return;
    const moduleConfig = allModules.find((m) => m.label === module);
    const childIds = moduleConfig?.subModules?.map((sub) => sub.id) || [];
    const explicitChildren = admin.subModules?.[module];
    const current = Array.isArray(explicitChildren)
      ? explicitChildren
      : admin.accessRights?.includes(module)
        ? childIds
        : [];
    const nextChildren = current.includes(subModuleId)
      ? current.filter((id) => id !== subModuleId)
      : [...current, subModuleId];
    const newSubModules = { ...(admin.subModules || {}), [module]: nextChildren };
    let newAccessRights = admin.accessRights || [];
    if (nextChildren.length === 0) {
      delete newSubModules[module];
      newAccessRights = newAccessRights.filter((m) => m !== module);
    } else if (!newAccessRights.includes(module)) {
      newAccessRights = [...newAccessRights, module];
    }
    toggleAccessMutation.mutate({
      id: adminId,
      data: { permissions: { modules: newAccessRights, subModules: newSubModules } },
      module,
    });
  };

  const openEditAdmin = (admin) => {
    setEditing(admin);
    setAdminForm({
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      role: admin.role || "ADMIN",
      accessRights: admin.accessRights || [],
      subModules: admin.subModules || {},
    });
    setDialog({
      type: "admin",
      open: true,
    });
  };

  const handlePasswordUpdate = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    const updateData = {
      password: passwordForm.newPassword,
    };
    updatePasswordMutation.mutate({ id: passwordForm.adminId, data: updateData });
  };

  const openPasswordDialog = (adminId) => {
    setPasswordForm({
      adminId,
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "admin") {
      deleteAdminMutation.mutate(deleteTarget.id);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          System Administrators
        </CardTitle>
      </CardHeader>

      <Dialog
        open={dialog.type === "admin" && dialog.open}
        onOpenChange={(open) =>
          setDialog({
            type: "admin",
            open,
          })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Super Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={adminForm.name}
                onChange={(e) =>
                  setAdminForm({
                    ...adminForm,
                    name: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                value={adminForm.email}
                onChange={(e) =>
                  setAdminForm({
                    ...adminForm,
                    email: e.target.value,
                  })
                }
              />
            </div>
            <DialogFooter>
              <Button
                onClick={handleAdminSubmit}
                className="w-full"
                disabled={createAdminMutation.isPending || updateAdminMutation.isPending}
              >
                {renderButtonContent(
                  createAdminMutation.isPending || updateAdminMutation.isPending,
                  "Saving...",
                  "Update Account"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2 px-3 text-sm">Name</TableHead>
              <TableHead className="py-2 px-3 text-sm">Email</TableHead>
              <TableHead className="py-2 px-3 text-sm">Role</TableHead>
              <TableHead className="py-2 px-3 text-sm">Access Rights</TableHead>
              <TableHead className="text-right px-3 text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminsLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Loading admins...
                </TableCell>
              </TableRow>
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No admins found.
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => {
                return (
                  <TableRow key={admin.id}>
                    <TableCell className="py-2 px-3 text-sm">{admin.name}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">{admin.email}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <Badge variant={admin.role === "SUPER_ADMIN" ? "default" : "secondary"}>
                        {admin.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      {admin.role === "SUPER_ADMIN" ? (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50/50 px-3 py-1.5 rounded-full w-fit border border-green-100">
                          <Shield className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold uppercase tracking-wider">
                            Full system Access
                          </span>
                        </div>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!canUpdate}
                              className="h-8 gap-2 border-dashed hover:border-primary hover:text-primary transition-colors"
                            >
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs">Manage Permissions</span>
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-1">
                                {admin.accessRights.length}
                              </Badge>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[450px] p-0 bg-popover shadow-2xl border-border rounded-xl overflow-hidden"
                            align="start"
                            sideOffset={8}
                          >
                            <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-sm text-foreground">Module Access</h4>
                                <p className="text-[10px] text-muted-foreground">
                                  Toggle module permissions for this admin
                                </p>
                              </div>
                              <Badge variant="outline" className="bg-primary/5 text-primary border-border text-[10px]">
                                {admin.accessRights.length} Active
                              </Badge>
                            </div>

                            <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
                              {allModules.map((module) => {
                                const childIds = module.subModules?.map((subModule) => subModule.id) || [];
                                const explicitChildren = admin.subModules?.[module.label];
                                const selectedChildren = Array.isArray(explicitChildren)
                                  ? explicitChildren
                                  : admin.accessRights.includes(module.label)
                                    ? childIds
                                    : [];
                                const selectedChildSet = new Set(selectedChildren);
                                const hasAccess = admin.accessRights.includes(module.label);
                                const hasChildren = childIds.length > 0;
                                const allChildrenSelected = hasChildren
                                  ? childIds.every((childId) => selectedChildSet.has(childId))
                                  : hasAccess;
                                const someChildrenSelected =
                                  hasChildren && childIds.some((childId) => selectedChildSet.has(childId));

                                return (
                                  <div
                                    key={module.label}
                                    className={cn(
                                      "rounded-lg border transition-all duration-200",
                                      hasAccess
                                        ? "bg-primary/5 border-border"
                                        : "bg-background border-border/70"
                                    )}
                                  >
                                    <div className="flex items-center gap-3 px-3 py-2.5">
                                      <Checkbox
                                        checked={
                                          hasChildren && someChildrenSelected && !allChildrenSelected
                                            ? "indeterminate"
                                            : allChildrenSelected
                                        }
                                        onCheckedChange={() => toggleAccessRight(admin.id, module.label)}
                                        aria-label={`${module.label} access`}
                                      />
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-foreground">{module.label}</p>
                                        {hasChildren && (
                                          <p className="text-[10px] text-muted-foreground">
                                            {selectedChildSet.size} of {childIds.length} submodules
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {hasChildren && (
                                      <div className="border-t border-border/70 px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {module.subModules.map((subModule) => (
                                          <label
                                            key={subModule.id}
                                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer"
                                          >
                                            <Checkbox
                                              checked={selectedChildSet.has(subModule.id)}
                                              onCheckedChange={() =>
                                                toggleSubmoduleAccess(admin.id, module.label, subModule.id)
                                              }
                                              aria-label={`${module.label} ${subModule.label} access`}
                                            />
                                            <span className="truncate">{subModule.label}</span>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="bg-muted/10 px-4 py-2 border-t mt-1">
                              <p className="text-[9px] text-center text-muted-foreground uppercase tracking-widest font-semibold italic">
                                Changes are saved automatically
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      {canUpdate && (
                        <div className="flex gap-2 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditAdmin(admin)}
                              >
                                <Edit className="w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPasswordDialog(admin.id)}
                              >
                                <Shield className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Change Password</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAdminMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteAdminMutation.isPending}>
              {renderButtonContent(deleteAdminMutation.isPending, "Deleting...", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Update Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Update Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Password</Label>
              <PasswordInput
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <PasswordInput
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Re-type new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handlePasswordUpdate} disabled={updatePasswordMutation.isPending}>
              {renderButtonContent(updatePasswordMutation.isPending, "Updating...", "Update Password")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminsTab;
