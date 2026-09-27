import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, ClipboardList, FileText, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import {
  MarkAttendanceTab,
  LeaveTab,
  AttendanceReportsTab,
  IndividualReportsTab,
} from "./attendance/index.js";

const Attendance = () => {
  const location = useLocation();
  const routeTab = getRouteSubmoduleId(location.pathname, "Attendance", "mark");

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4 w-full">
        <div className="flex justify-between items-center mb-1">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <UserCheck className="w-8 h-8 text-primary" />
              Attendance Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Load students, set each status, and save attendance
            </p>
          </div>
        </div>

        <Tabs value={routeTab} className="w-full">
          <TabsList className="hidden">
            <TabsTrigger value="mark" className="gap-2">
              <UserCheck className="w-4 h-4" />Record Attendance
            </TabsTrigger>
            <TabsTrigger value="leave" className="gap-2">
              <ClipboardList className="w-4 h-4" />Leave
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="w-4 h-4" />Reports
            </TabsTrigger>
            <TabsTrigger value="individual-reports" className="gap-2">
              <User className="w-4 h-4" />Individual Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mark" className="space-y-6">
            <MarkAttendanceTab />
          </TabsContent>

          <TabsContent value="leave">
            <LeaveTab />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <AttendanceReportsTab />
          </TabsContent>

          <TabsContent value="individual-reports">
            <IndividualReportsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
