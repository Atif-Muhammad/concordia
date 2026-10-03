import React, { useState, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  TrendingDown,
  TrendingUp,
  Plus,
  Search,
  Pencil,
  Trash2,
  Lock,
  Tag,
  Loader2,
  Sliders,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getFinanceCategories,
  createFinanceCategory,
  updateFinanceCategory,
  deleteFinanceCategory,
  addFinanceSubCategory,
  updateFinanceSubCategory,
  deleteFinanceSubCategory,
} from "../../../config/apis";

export const FinanceSettingsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeType, setActiveType] = useState("EXPENSE"); // "EXPENSE" | "INCOME"
  const [searchTerm, setSearchTerm] = useState("");

  // Category Add/Edit Dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null); // null for new, category object for edit
  const [categoryFormData, setCategoryFormData] = useState({ name: "", description: "" });

  // Delete Category Alert Dialog state
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // Sub-category Add Inline state: { [categoryId]: string }
  const [subCategoryInputs, setSubCategoryInputs] = useState({});
  const [activeAddSubCatId, setActiveAddSubCatId] = useState(null);

  // Sub-category Edit Dialog state
  const [editingSubCategory, setEditingSubCategory] = useState(null); // { categoryId, categoryName, oldName, newName }

  // Delete Sub-category Alert Dialog state
  const [subCategoryToDelete, setSubCategoryToDelete] = useState(null); // { categoryId, categoryName, subName }

  // Query categories
  const {
    data: categories = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["financeCategories", activeType],
    queryFn: () => getFinanceCategories(activeType),
  });

  // Create Category Mutation
  const createCategoryMutation = useMutation({
    mutationFn: (data) => createFinanceCategory({ ...data, type: activeType }),
    onSuccess: () => {
      queryClient.invalidateQueries(["financeCategories"]);
      toast({ title: "Success", description: "Category created successfully" });
      setIsCategoryDialogOpen(false);
      setCategoryFormData({ name: "", description: "" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create category",
      });
    },
  });

  // Update Category Mutation
  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => updateFinanceCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["financeCategories"]);
      toast({ title: "Success", description: "Category updated successfully" });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryFormData({ name: "", description: "" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update category",
      });
    },
  });

  // Delete Category Mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => deleteFinanceCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["financeCategories"]);
      toast({ title: "Success", description: "Category deleted successfully" });
      setCategoryToDelete(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete category",
      });
    },
  });

  // Add Sub-category Mutation
  const addSubCategoryMutation = useMutation({
    mutationFn: ({ categoryId, name }) => addFinanceSubCategory(categoryId, name),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["financeCategories"]);
      toast({ title: "Success", description: "Sub-category added successfully" });
      setSubCategoryInputs((prev) => ({ ...prev, [variables.categoryId]: "" }));
      setActiveAddSubCatId(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add sub-category",
      });
    },
  });

  // Update Sub-category Mutation
  const updateSubCategoryMutation = useMutation({
    mutationFn: ({ categoryId, oldName, newName }) =>
      updateFinanceSubCategory(categoryId, oldName, newName),
    onSuccess: () => {
      queryClient.invalidateQueries(["financeCategories"]);
      toast({ title: "Success", description: "Sub-category renamed successfully" });
      setEditingSubCategory(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update sub-category",
      });
    },
  });

  // Delete Sub-category Mutation
  const deleteSubCategoryMutation = useMutation({
    mutationFn: ({ categoryId, subName }) => deleteFinanceSubCategory(categoryId, subName),
    onSuccess: () => {
      queryClient.invalidateQueries(["financeCategories"]);
      toast({ title: "Success", description: "Sub-category deleted successfully" });
      setSubCategoryToDelete(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete sub-category",
      });
    },
  });

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(term) ||
        (cat.description && cat.description.toLowerCase().includes(term)) ||
        (cat.subCategories &&
          cat.subCategories.some((sub) => sub.toLowerCase().includes(term)))
    );
  }, [categories, searchTerm]);

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: "", description: "" });
    setIsCategoryDialogOpen(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryFormData({ name: cat.name, description: cat.description || "" });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = (e) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Category name is required",
      });
      return;
    }
    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory._id,
        data: { name: categoryFormData.name.trim(), description: categoryFormData.description.trim() },
      });
    } else {
      createCategoryMutation.mutate({
        name: categoryFormData.name.trim(),
        description: categoryFormData.description.trim(),
      });
    }
  };

  const handleAddSubCategory = (categoryId) => {
    const val = (subCategoryInputs[categoryId] || "").trim();
    if (!val) return;
    addSubCategoryMutation.mutate({ categoryId, name: val });
  };

  const handleSaveEditedSubCategory = (e) => {
    e.preventDefault();
    if (!editingSubCategory?.newName?.trim()) return;
    updateSubCategoryMutation.mutate({
      categoryId: editingSubCategory.categoryId,
      oldName: editingSubCategory.oldName,
      newName: editingSubCategory.newName.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Navigation Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border rounded-lg p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            Finance Categories & Sub-Categories
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure system and custom classifications for tracking institutional finances.
          </p>
        </div>

        <Tabs
          value={activeType}
          onValueChange={(val) => {
            setActiveType(val);
            setSearchTerm("");
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-2 w-full sm:w-64">
            <TabsTrigger value="EXPENSE" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="INCOME" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Income
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Control Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${activeType.toLowerCase()} categories or sub-categories...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs sm:text-sm"
          />
        </div>

        <Button
          onClick={handleOpenAddCategory}
          size="sm"
          className="gap-2 h-9 text-xs sm:text-sm"
        >
          <Plus className="w-4 h-4" />
          Add {activeType === "EXPENSE" ? "Expense" : "Income"} Category
        </Button>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p className="text-sm">Loading categories...</p>
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          <p className="text-sm font-medium">Failed to load categories. Please try again.</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center bg-card border rounded-lg">
          <Tag className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-base font-semibold">No categories found</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {searchTerm
              ? `No categories match "${searchTerm}".`
              : `Create your first ${activeType.toLowerCase()} category to get started.`}
          </p>
          {!searchTerm && (
            <Button onClick={handleOpenAddCategory} size="sm" className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const isDefault = !!cat.isDefault;
            const subCount = cat.subCategories?.length || 0;
            const isAddingSub = activeAddSubCatId === cat._id;

            return (
              <Card
                key={cat._id}
                className="flex flex-col justify-between border hover:border-primary/40 hover:shadow-md transition-all"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-semibold">
                          {cat.name}
                        </CardTitle>
                        {isDefault ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal flex items-center gap-1"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            Default
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-primary border-primary/30 font-normal"
                          >
                            Custom
                          </Badge>
                        )}
                      </div>
                      {cat.description ? (
                        <CardDescription className="text-xs line-clamp-2">
                          {cat.description}
                        </CardDescription>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 italic">
                          No description provided
                        </p>
                      )}
                    </div>

                    {/* Category Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => handleOpenEditCategory(cat)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit Category</TooltipContent>
                      </Tooltip>

                      {!isDefault && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setCategoryToDelete(cat)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete Category</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-between space-y-3">
                  {/* Sub-categories List */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-2">
                      <span>Sub-Categories ({subCount})</span>
                      {!isAddingSub && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 transition-colors"
                          onClick={() => setActiveAddSubCatId(cat._id)}
                        >
                          <Plus className="w-3 h-3" />
                          Add Sub-Category
                        </Button>
                      )}
                    </div>

                    {/* Inline Add Sub-category Input */}
                    {isAddingSub && (
                      <div className="flex items-center gap-1.5 mb-2.5 bg-muted/40 p-1.5 rounded-md border border-dashed">
                        <Input
                          placeholder="New sub-category name..."
                          size="sm"
                          value={subCategoryInputs[cat._id] || ""}
                          onChange={(e) =>
                            setSubCategoryInputs((prev) => ({
                              ...prev,
                              [cat._id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddSubCategory(cat._id);
                            } else if (e.key === "Escape") {
                              setActiveAddSubCatId(null);
                            }
                          }}
                          className="h-7 text-xs bg-background"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          disabled={
                            !(subCategoryInputs[cat._id] || "").trim() ||
                            addSubCategoryMutation.isPending
                          }
                          onClick={() => handleAddSubCategory(cat._id)}
                        >
                          {addSubCategoryMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => setActiveAddSubCatId(null)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}

                    {subCount === 0 ? (
                      <p className="text-xs text-muted-foreground/60 italic py-1">
                        No sub-categories defined.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {cat.subCategories.map((sub) => (
                          <div
                            key={sub}
                            className="group flex items-center gap-1 bg-muted/60 hover:bg-muted text-foreground text-xs px-2 py-0.5 rounded border border-border/50 transition-colors"
                          >
                            <span className="font-normal">{sub}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity ml-1 -mr-1">
                              <button
                                type="button"
                                className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded transition-colors"
                                onClick={() =>
                                  setEditingSubCategory({
                                    categoryId: cat._id,
                                    categoryName: cat.name,
                                    oldName: sub,
                                    newName: sub,
                                  })
                                }
                                title="Edit sub-category"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                className="p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded ml-0.5 transition-colors"
                                onClick={() =>
                                  setSubCategoryToDelete({
                                    categoryId: cat._id,
                                    categoryName: cat.name,
                                    subName: sub,
                                  })
                                }
                                title="Delete sub-category"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveCategory}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : `Add ${activeType === "EXPENSE" ? "Expense" : "Income"} Category`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="catName">Category Name *</Label>
                <Input
                  id="catName"
                  placeholder="e.g., Marketing, Transport, Research..."
                  value={categoryFormData.name}
                  onChange={(e) =>
                    setCategoryFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="catDesc">Description</Label>
                <Textarea
                  id="catDesc"
                  placeholder="Optional brief description of this category..."
                  rows={3}
                  value={categoryFormData.description}
                  onChange={(e) =>
                    setCategoryFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCategoryDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createCategoryMutation.isPending || updateCategoryMutation.isPending
                }
              >
                {createCategoryMutation.isPending || updateCategoryMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                  </>
                ) : (
                  "Save Category"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sub-category Dialog */}
      <Dialog
        open={!!editingSubCategory}
        onOpenChange={(open) => !open && setEditingSubCategory(null)}
      >
        <DialogContent className="max-w-sm">
          <form onSubmit={handleSaveEditedSubCategory}>
            <DialogHeader>
              <DialogTitle>Edit Sub-Category</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <p className="text-xs text-muted-foreground">
                In Category:{" "}
                <span className="font-semibold text-foreground">
                  {editingSubCategory?.categoryName}
                </span>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="subCatNewName">Sub-Category Name *</Label>
                <Input
                  id="subCatNewName"
                  value={editingSubCategory?.newName || ""}
                  onChange={(e) =>
                    setEditingSubCategory((prev) => ({
                      ...prev,
                      newName: e.target.value,
                    }))
                  }
                  required
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingSubCategory(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !editingSubCategory?.newName?.trim() ||
                  updateSubCategoryMutation.isPending
                }
              >
                {updateSubCategoryMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Renaming...
                  </>
                ) : (
                  "Rename"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation Alert */}
      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category{" "}
              <strong>"{categoryToDelete?.name}"</strong> and all its sub-categories?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCategoryMutation.mutate(categoryToDelete._id)}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Sub-category Confirmation Alert */}
      <AlertDialog
        open={!!subCategoryToDelete}
        onOpenChange={(open) => !open && setSubCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sub-Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the sub-category{" "}
              <strong>"{subCategoryToDelete?.subName}"</strong> from category{" "}
              <strong>"{subCategoryToDelete?.categoryName}"</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteSubCategoryMutation.mutate({
                  categoryId: subCategoryToDelete.categoryId,
                  subName: subCategoryToDelete.subName,
                })
              }
              disabled={deleteSubCategoryMutation.isPending}
            >
              {deleteSubCategoryMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FinanceSettingsTab;
