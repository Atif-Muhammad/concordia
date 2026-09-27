import React from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import {
  LeavesTab,
  PayrollTab,
  AttendanceTab,
  AdvanceSalaryTab,
  DepartmentsTab,
  HolidaysTab,
  ReportsTab,
} from "./hr-payroll/index.js";

const HRPayroll = () => {
  const location = useLocation();
  const activeTab = getRouteSubmoduleId(location.pathname, "HR & Payroll", "leaves");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Wallet className="w-8 h-8 text-primary" />
              HR & Payroll Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage employees, payroll, attendance, and leaves
            </p>
          </div>
        </div>

        <Tabs value={activeTab}>
          <TabsList className="hidden">
            <TabsTrigger value="leaves">Leaves</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="advance">Advance Salary</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="leaves" className="space-y-4">
            <LeavesTab />
          </TabsContent>

          <TabsContent value="payroll" className="space-y-4">
            <PayrollTab />
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <AttendanceTab />
          </TabsContent>

          <TabsContent value="advance" className="space-y-4">
            <AdvanceSalaryTab />
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <DepartmentsTab />
          </TabsContent>

          <TabsContent value="holidays" className="space-y-4">
            <HolidaysTab />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default HRPayroll;
