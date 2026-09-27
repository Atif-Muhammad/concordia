import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import StudentForm from "@/components/students/StudentForm";

const EMPTY_OBJECT = {};

export const StudentFormDialog = ({
  open,
  onOpenChange,
  editingStudent,
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  rollNumberMap = {},
  onSubmit,
  isSubmitting,
  onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingStudent ? "Edit" : "Add"} Student</DialogTitle>
          <DialogDescription>
            All fields marked * are required
          </DialogDescription>
        </DialogHeader>

        <StudentForm
          key={editingStudent?.id || editingStudent?._id || (open ? "new-student-open" : "new-student")}
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
      </DialogContent>
    </Dialog>
  );
};

export default StudentFormDialog;
