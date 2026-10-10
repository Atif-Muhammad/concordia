import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { BookOpen, PlusCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from "../../../config/apis";

const resolveId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return (item.id || item._id || "").toString();
  }
  return item.toString();
};

export default function SubjectsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Academics", "subjects");

  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjects,
    retry: 1,
  });

  const subjectMutation = useMutation({
    mutationFn: ({ id, data }) =>
      id ? updateSubject(id, data) : createSubject(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["subjects"]);
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
    mutationFn: deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries(["subjects"]);
      toast({ title: "Subject deleted successfully" });
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

  const handleCreateSubjectInline = () => {
    const name = newSubjectName.trim();
    if (!name) {
      toast({ title: "Subject name is required", variant: "destructive" });
      return;
    }

    subjectMutation.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          setNewSubjectName("");
          toast({ title: "Subject created successfully" });
        },
      }
    );
  };

  const handleStartSubjectEdit = (subject) => {
    setEditingSubjectId(resolveId(subject));
    setEditingSubjectName(subject.name || "");
  };

  const handleCancelSubjectEdit = () => {
    setEditingSubjectId(null);
    setEditingSubjectName("");
  };

  const handleUpdateSubjectInline = (subjectId) => {
    const name = editingSubjectName.trim();
    if (!name) {
      toast({ title: "Subject name is required", variant: "destructive" });
      return;
    }

    subjectMutation.mutate(
      { id: subjectId, data: { name } },
      {
        onSuccess: () => {
          handleCancelSubjectEdit();
          toast({ title: "Subject updated successfully" });
        },
      }
    );
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="w-5 h-5 text-primary" /> Subjects
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Manage all academic subjects taught across programs. Credit hours are assigned individually per class in Subject-Class Mapping.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Create Form */}
          {canCreate && (
            <div className="mb-6 flex flex-col sm:flex-row gap-2">
              <Input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSubjectInline();
                }}
                placeholder="Enter subject name, e.g. Physics, Calculus"
                className="flex-1"
              />
              <Button
                onClick={handleCreateSubjectInline}
                disabled={!newSubjectName.trim() || subjectMutation.isPending}
                className="gap-2 shrink-0 w-full sm:w-auto"
              >
                <PlusCircle className="w-4 h-4" /> Add Subject
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="border rounded-md overflow-hidden bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">
                    Name
                  </TableHead>
                  <TableHead className="py-3 px-4 text-right font-semibold text-xs uppercase tracking-wider w-36">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((s) => {
                  const sId = resolveId(s);
                  const isEditingSubject = editingSubjectId === sId;
                  return (
                    <TableRow key={sId} className="hover:bg-muted/30">
                      <TableCell className="py-3 px-4 font-medium">
                        {isEditingSubject ? (
                          <Input
                            value={editingSubjectName}
                            onChange={(e) => setEditingSubjectName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdateSubjectInline(sId);
                              if (e.key === "Escape") handleCancelSubjectEdit();
                            }}
                            autoFocus
                            placeholder="Subject name"
                            className="h-8 text-sm"
                          />
                        ) : (
                          s.name
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {isEditingSubject ? (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => handleUpdateSubjectInline(sId)}
                                disabled={
                                  !editingSubjectName.trim() ||
                                  subjectMutation.isPending
                                }
                              >
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={handleCancelSubjectEdit}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              {canUpdate && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={() => handleStartSubjectEdit(s)}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Subject</TooltipContent>
                                </Tooltip>
                              )}
                              {canDelete && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => {
                                        setDeleteTargetId(sId);
                                        setDeleteDialog(true);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete Subject</TooltipContent>
                                </Tooltip>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {subjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-12 text-muted-foreground">
                      No subjects found. Add a subject above to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will delete the subject. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
