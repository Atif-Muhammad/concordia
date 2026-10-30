import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import MarkAttendanceTab from "../attendance/MarkAttendanceTab";
import { UserCheck } from "lucide-react";

export default function TeacherAttendance() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <UserCheck className="w-7 h-7 sm:w-8 sm:h-8 text-primary" /> Class Attendance
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Mark and record daily student attendance for your designated Class Teacher classes.
            </p>
          </div>
        </div>

        {/* Mark Attendance Tab in Teacher Portal Mode */}
        <MarkAttendanceTab isTeacherPortal={true} />
      </div>
    </DashboardLayout>
  );
}
