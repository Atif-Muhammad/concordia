import React from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getFeeHeads,
  getAcademicSessions,
  getPrograms,
  getClasses,
  getDepartmentNames,
  getFeeStructures,
  getInstituteSettings,
  getNewFeeSettings,
  getSections,
} from "@/services/api";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign } from "lucide-react";
import {
  ChallansTab,
  ExtraChallansTab,
  FeeHeadsTab,
  FeeStructuresTab,
  FeeReportsTab,
  FeeSettingsTab,
  StudentHistoryTab,
} from "./fee-management/index.js";

const FeeManagement = () => {
  const location = useLocation();
  const routeTab = getRouteSubmoduleId(location.pathname, "Fee Management", "challans");

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['feeHeads'],
    queryFn: getFeeHeads,
  });

  const { data: academicSessions = [] } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: getAcademicSessions,
  });

  const activeSessionId = academicSessions.find(s => s.isActive)?.id?.toString() || "all";

  const { data: feeStructures = [] } = useQuery({
    queryKey: ['feeStructures'],
    queryFn: getFeeStructures,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: getPrograms,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartmentNames,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: getSections,
  });

  const { data: instituteSettings } = useQuery({
    queryKey: ['instituteSettings'],
    queryFn: getInstituteSettings,
  });

  const lateFeeFine = instituteSettings?.lateFeeFine ?? 0;

  const { data: newFeeSettings } = useQuery({
    queryKey: ['newFeeSettings'],
    queryFn: getNewFeeSettings,
  });

  const lateFeeRatePerDay = newFeeSettings?.lateFeeRatePerDay ?? 0;
  const extraChallanLateFee = newFeeSettings?.extraChallanLateFee ?? 0;
  const defaultDueDays = newFeeSettings?.defaultDueDays ?? 10;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-primary" />
              Fee Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Challan generation, payment collections, fee structures, and financial ledgers
            </p>
          </div>
        </div>

        <Tabs value={routeTab} className="space-y-6">
          <TabsList className="hidden">
            <TabsTrigger value="challans">Challans</TabsTrigger>
            <TabsTrigger value="extra-challans">Extra Challans</TabsTrigger>
            <TabsTrigger value="feeheads">Fee Heads</TabsTrigger>
            <TabsTrigger value="structures">Fee Structures</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="student-history">Student History</TabsTrigger>
          </TabsList>

          <TabsContent value="challans">
            <ChallansTab
              feeHeads={feeHeads}
              programs={programs}
              classes={classes}
              departments={departments}
              academicSessions={academicSessions}
              activeSessionId={activeSessionId}
              feeStructures={feeStructures}
              lateFeeFine={lateFeeFine}
              lateFeeRatePerDay={lateFeeRatePerDay}
              defaultDueDays={defaultDueDays}
            />
          </TabsContent>

          <TabsContent value="extra-challans">
            <ExtraChallansTab
              feeHeads={feeHeads}
              programs={programs}
              classes={classes}
              sections={sections}
              academicSessions={academicSessions}
              extraChallanLateFee={extraChallanLateFee}
            />
          </TabsContent>

          <TabsContent value="feeheads">
            <FeeHeadsTab feeHeads={feeHeads} />
          </TabsContent>

          <TabsContent value="structures">
            <FeeStructuresTab
              feeHeads={feeHeads}
              programs={programs}
              classes={classes}
              feeStructures={feeStructures}
            />
          </TabsContent>

          <TabsContent value="reports">
            <FeeReportsTab
              academicSessions={academicSessions}
              programs={programs}
              classes={classes}
              sections={sections}
              lateFeeRatePerDay={lateFeeRatePerDay}
            />
          </TabsContent>

          <TabsContent value="settings">
            <FeeSettingsTab
              instituteSettings={instituteSettings}
              newFeeSettings={newFeeSettings}
            />
          </TabsContent>

          <TabsContent value="student-history">
            <StudentHistoryTab
              academicSessions={academicSessions}
              feeHeads={feeHeads}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default FeeManagement;
