import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getAcademicSessions,
  createAcademicSession,
  updateAcademicSession,
  deleteAcademicSession,
} from "../../../config/apis";

const initialForm = {
  name: "",
  startDate: "",
  endDate: "",
  isActive: false,
};

export default function SessionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Academics", "sessions");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [sessionForm, setSessionForm] = useState(initialForm);

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
    retry: 1,
  });

  const sessionMutation = useMutation({
    mutationFn: ({ id, data }) =>
      id ? updateAcademicSession(id, data) : createAcademicSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["academicSessions"]);
      toast({ title: `Session ${editing ? "updated" : "created"} successfully` });
      setDialogOpen(false);
      setEditing(null);
      setSessionForm(initialForm);
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAcademicSession,
    onSuccess: () => {
      queryClient.invalidateQueries(["academicSessions"]);
      toast({ title: "Session deleted successfully" });
      setDeleteDialog(false);
      setDeleteTargetId(null);
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setSessionForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (session) => {
    setEditing(session);
    setSessionForm({
      name: session.name || "",
      startDate: session.startDate
        ? new Date(session.startDate).toISOString().split("T")[0]
        : "",
      endDate: session.endDate
        ? new Date(session.endDate).toISOString().split("T")[0]
        : "",
      isActive: Boolean(session.isActive),
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!sessionForm.name || !sessionForm.startDate || !sessionForm.endDate) {
      toast({
        title: "Name, start date, and end date are required",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name: sessionForm.name,
      startDate: new Date(sessionForm.startDate).toISOString(),
      endDate: new Date(sessionForm.endDate).toISOString(),
      isActive: Boolean(sessionForm.isActive),
    };

    sessionMutation.mutate({ id: editing?.id, data });
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Academic Sessions</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {canCreate && (
              <DialogTrigger asChild>
                <Button onClick={openAdd} className="w-full sm:w-auto">
                  <PlusCircle className="mr-2" /> Add Session
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit" : "Add"} Academic Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Session Name *</Label>
                  <Input
                    value={sessionForm.name}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, name: e.target.value })
                    }
                    placeholder="e.g. 2023-2024"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date *</Label>
                    <Input
                      type="date"
                      value={sessionForm.startDate}
                      onChange={(e) =>
                        setSessionForm({ ...sessionForm, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>End Date *</Label>
                    <Input
                      type="date"
                      value={sessionForm.endDate}
                      onChange={(e) =>
                        setSessionForm({ ...sessionForm, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={sessionForm.isActive}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, isActive: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <Label htmlFor="isActive">Set as Active Session</Label>
                </div>
                <DialogFooter className="pt-2 border-t mt-4 flex items-center justify-end">
                  <Button
                    onClick={handleSubmit}
                    className="w-full sm:w-auto"
                    disabled={sessionMutation.isPending}
                  >
                    {sessionMutation.isPending
                      ? "Saving..."
                      : editing
                      ? "Update Session"
                      : "Add Session"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Session Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Start Date</TableHead>
                <TableHead className="py-2 px-3 text-sm">End Date</TableHead>
                <TableHead className="py-2 px-3 text-sm">Status</TableHead>
                <TableHead className="text-right px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {academicSessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium py-2 px-3 text-sm">{s.name}</TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    {s.startDate ? new Date(s.startDate).toLocaleDateString() : "N/A"}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    {s.endDate ? new Date(s.endDate).toLocaleDateString() : "N/A"}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    {s.isActive ? (
                      <Badge className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2 py-2 px-3 text-sm">
                    {canUpdate && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(s)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeleteTargetId(s.id);
                              setDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {academicSessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No academic sessions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
