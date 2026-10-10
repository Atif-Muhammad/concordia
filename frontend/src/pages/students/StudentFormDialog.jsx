import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import StudentForm from "@/components/students/StudentForm";
import { StudentFormSkeleton } from "@/skeletons/StudentFormSkeleton";

const EMPTY_OBJECT = {};

export const StudentFormDialog = ({
  open,
  onOpenChange,
  editingStudent,
  isLoading = false,
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  rollNumberMap = {},
  onSubmit,
  isSubmitting,
  onCancel,
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingStudent || isLoading ? "Edit" : "Add"} Student</DialogTitle>
          <DialogDescription>
            All fields marked * are required
          </DialogDescription>
        </DialogHeader>

        {isLoading || !isReady ? (
          <StudentFormSkeleton />
        ) : (
          <StudentForm
            initialData={editingStudent || EMPTY_OBJECT}
            isEditing={!!editingStudent}
            programs={programData}
            classes={classesData}
            sections={sectionsData}
            academicSessions={academicSessions}
            rollNumberMap={(rollNumberMap && typeof rollNumberMap === "object") ? rollNumberMap : EMPTY_OBJECT}
            onCancel={onCancel}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudentFormDialog;
