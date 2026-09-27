import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Users, GraduationCap, CalendarCheck, FileText,
  ClipboardList, Bed, MessageSquare, PhoneCall, BookOpen,
  BriefcaseBusiness, Boxes, Settings, ChevronRight, ShieldAlert,
  AlertCircle, CheckCircle2, Clock
} from "lucide-react";

import {
  getAcademicSessions,
  getDashboardStats,
  userWho,
  refreshTokens,
} from "../../config/apis";
import { hasModuleAccess, MODULE_BY_LABEL } from "@/lib/navigation.jsx";

const subRoute = (moduleLabel, subModuleId) => {
  const module = MODULE_BY_LABEL[moduleLabel];
  if (!module) return "/dashboard";
  return module.subModules?.find((sub) => sub.id === subModuleId)?.path || module.subModules?.[0]?.path || module.path;
};

// Accurate navigation routes for all Concordia modules
const MODULE_ROUTES = {
  FrontOffice: subRoute("Front Office", "inquiry") || "/front-office",
  Students: subRoute("Students", "active") || "/students",
  Staff: subRoute("Staff", "directory") || "/staff",
  Attendance: subRoute("Attendance", "mark") || "/attendance",
  FeeManagement: subRoute("Fee Management", "challans") || "/fee-management",
  Examination: subRoute("Examination", "results") || "/examination",
  Complaints: "/complaints",
  Academics: subRoute("Academics", "programs") || "/academics",
  HRPayroll: subRoute("HR & Payroll", "leaves") || "/hr-payroll",
  Boarding: "/hostel",
  Inventory: subRoute("Inventory", "items") || "/inventory",
  Configuration: subRoute("Configuration", "roles") || "/configuration",
};

const StatCard = ({ title, icon: Icon, value, subtitle, onClick, isLoading, extraValues, accentColor = "border-l-primary" }) => (
  <Card
    className={`hover:shadow-md transition-all cursor-pointer border-l-4 ${accentColor} relative group`}
    onClick={onClick}
  >
    <ChevronRight className="w-4 h-4 text-muted-foreground absolute top-4 right-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pr-8">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center">
        <Icon className="h-4 w-4 text-foreground/80" />
      </div>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="flex h-12 items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold tracking-tight">{value !== undefined && value !== null ? value : "-"}</div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {extraValues && extraValues.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border/50 space-y-1.5">
              {extraValues.map((v, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{v.label}</span>
                  <span className="font-semibold text-foreground/90">{v.value !== undefined && v.value !== null ? v.value : "-"}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedSessionId, setSelectedSessionId] = useState("");

  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        return await userWho();
      } catch (error) {
        if (error.response?.status === 401) {
          try {
            await refreshTokens();
            return await userWho();
          } catch {
            return null;
          }
        }
        return null;
      }
    },
    retry: false,
  });

  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      const activeSession = sessions.find((s) => s.isActive);
      const chosen = activeSession ? (activeSession.id || activeSession._id) : (sessions[0].id || sessions[0]._id);
      setSelectedSessionId(chosen ? chosen.toString() : "all");
    }
  }, [sessions, selectedSessionId]);

  const sid = selectedSessionId || "all";

  // Real-time backend stats for all modules
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["dashboard-all-stats", sid],
    queryFn: () => getDashboardStats({ sessionId: sid === "all" ? undefined : sid }),
    staleTime: 45000,
  });

  if (isUserLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Permission access flags
  const canSeeStudents = hasModuleAccess(currentUser, "Students");
  const canSeeAttendance = hasModuleAccess(currentUser, "Attendance");
  const canSeeStaff = hasModuleAccess(currentUser, "Staff");
  const canSeeFees = hasModuleAccess(currentUser, "Fee Management");
  const canSeeFrontOffice = hasModuleAccess(currentUser, "Front Office");
  const canSeeAcademics = hasModuleAccess(currentUser, "Academics");
  const canSeeHostel = hasModuleAccess(currentUser, "Boarding");
  const canSeeInventory = hasModuleAccess(currentUser, "Inventory");
  const canSeeHR = hasModuleAccess(currentUser, "HR & Payroll");
  const canSeeExamination = hasModuleAccess(currentUser, "Examination");
  const canSeeComplaints = hasModuleAccess(currentUser, "Complaints");
  const canSeeConfiguration = hasModuleAccess(currentUser, "Configuration");

  const selectedSessionObj = sessions.find(
    (s) => (s.id || s._id)?.toString() === selectedSessionId
  );
  const sessionName = selectedSessionId === "all" ? "All Time" : (selectedSessionObj?.name || "Current Session");

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">

        {/* Personalized Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Staff Dashboard</h1>
              <Badge variant="outline" className="text-xs font-normal">Operational</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back, <span className="font-semibold text-foreground">{currentUser?.name || "Staff Member"}</span>
              {" · "}{currentUser?.designation || currentUser?.role || "Staff"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Session:</span>
            <div className="w-full sm:w-56">
              <Select
                value={selectedSessionId || ""}
                onValueChange={setSelectedSessionId}
                disabled={isLoadingSessions}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  {sessions.map((session) => {
                    const sId = (session.id || session._id)?.toString();
                    return (
                      <SelectItem key={sId} value={sId}>
                        <span className="flex items-center gap-2">
                          {session.name}
                          {session.isActive && (
                            <Badge className="bg-emerald-500 text-white text-[10px] py-0 px-1 h-4">Active</Badge>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Module Snapshots Grid (Strictly Permission-Gated, Operational Counts Only) */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Module Activity Snapshots
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {/* Students Module */}
            {canSeeStudents && (
              <StatCard
                title="Students"
                icon={GraduationCap}
                value={stats?.students?.total ?? stats?.totalStudents ?? 0}
                subtitle={`${sessionName} · Enrolled`}
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.Students)}
                accentColor="border-l-blue-600"
                extraValues={[
                  { label: "Active", value: stats?.students?.active ?? stats?.activeStudents ?? 0 },
                  { label: "Expelled", value: stats?.students?.expelled ?? 0 },
                  { label: "Passed Out", value: stats?.students?.passedOut ?? 0 },
                ]}
              />
            )}

            {/* Attendance Module */}
            {canSeeAttendance && (
              <StatCard
                title="Today's Attendance"
                icon={CalendarCheck}
                value={stats?.attendance?.rate !== undefined ? `${stats.attendance.rate}%` : "-"}
                subtitle={`${stats?.attendance?.present ?? stats?.todayAttendance ?? 0} present records today`}
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.Attendance)}
                accentColor="border-l-emerald-600"
                extraValues={[
                  { label: "Present", value: stats?.attendance?.present ?? stats?.todayAttendance ?? 0 },
                  { label: "Absent", value: stats?.attendance?.absent ?? 0 },
                  { label: "On Leave", value: stats?.attendance?.leave ?? 0 },
                ]}
              />
            )}

            {/* Staff Module */}
            {canSeeStaff && (
              <StatCard
                title="Staff Directory"
                icon={Users}
                value={stats?.staff?.total ?? stats?.totalStaff ?? 0}
                subtitle="Total active personnel"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.Staff)}
                accentColor="border-l-indigo-600"
                extraValues={[
                  { label: "Teaching", value: stats?.staff?.teaching ?? stats?.teachingStaff ?? 0 },
                  { label: "Non-Teaching", value: stats?.staff?.nonTeaching ?? stats?.nonTeachingStaff ?? 0 },
                  { label: "Supporting", value: stats?.staff?.supporting ?? 0 },
                ]}
              />
            )}

            {/* Fee Management Module (Counts Only, Zero Finance Data) */}
            {canSeeFees && (
              <StatCard
                title="Fee Challans"
                icon={FileText}
                value={stats?.fees?.totalChallans ?? 0}
                subtitle="Total session challans"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.FeeManagement)}
                accentColor="border-l-amber-600"
                extraValues={[
                  { label: "Paid Challans", value: stats?.fees?.paidChallans ?? 0 },
                  { label: "Pending Challans", value: stats?.fees?.pendingChallans ?? 0 },
                  { label: "Overdue Challans", value: stats?.fees?.overdueChallans ?? 0 },
                  { label: "Extra Challans", value: stats?.fees?.extraChallans ?? 0 },
                ]}
              />
            )}

            {/* Front Office Module */}
            {canSeeFrontOffice && (
              <StatCard
                title="Front Office"
                icon={PhoneCall}
                value={stats?.frontOffice?.inquiries ?? stats?.pendingInquiries ?? 0}
                subtitle="Pending visitor inquiries"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.FrontOffice)}
                accentColor="border-l-sky-600"
                extraValues={[
                  { label: "Inquiries", value: stats?.frontOffice?.inquiries ?? 0 },
                  { label: "Visitor Records", value: stats?.frontOffice?.visitors ?? 0 },
                  { label: "Complaints", value: stats?.frontOffice?.complaints ?? 0 },
                  { label: "Calls / Contacts", value: stats?.frontOffice?.calls ?? 0 },
                ]}
              />
            )}

            {/* Academics Module */}
            {canSeeAcademics && (
              <StatCard
                title="Academics"
                icon={BookOpen}
                value={stats?.academics?.classes ?? 0}
                subtitle="Active classes"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.Academics)}
                accentColor="border-l-purple-600"
                extraValues={[
                  { label: "Programs", value: stats?.academics?.programs ?? 0 },
                  { label: "Classes", value: stats?.academics?.classes ?? 0 },
                  { label: "Sections", value: stats?.academics?.sections ?? 0 },
                  { label: "Subjects", value: stats?.academics?.subjects ?? 0 },
                ]}
              />
            )}

            {/* Boarding / Hostel Module (Uses accurate /hostel URL) */}
            {canSeeHostel && (
              <StatCard
                title="Boarding / Hostel"
                icon={Bed}
                value={stats?.hostel?.residents ?? 0}
                subtitle="Allocated resident students"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.Boarding)}
                accentColor="border-l-teal-600"
                extraValues={[
                  { label: "Registered Residents", value: stats?.hostel?.residents ?? 0 },
                  { label: "Hostel Rooms", value: stats?.hostel?.rooms ?? 0 },
                ]}
              />
            )}

            {/* Inventory Module */}
            {canSeeInventory && (
              <StatCard
                title="Inventory"
                icon={Boxes}
                value={stats?.inventory?.totalItems ?? 0}
                subtitle="Tracked stock items"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.Inventory)}
                accentColor="border-l-orange-600"
                extraValues={[
                  { label: "Total Items", value: stats?.inventory?.totalItems ?? 0 },
                  { label: "Low Stock Alert", value: stats?.inventory?.lowStock ?? 0 },
                ]}
              />
            )}

            {/* HR & Payroll Module */}
            {canSeeHR && (
              <StatCard
                title="HR & Payroll"
                icon={BriefcaseBusiness}
                value={stats?.hr?.pendingLeaves ?? 0}
                subtitle="Pending staff leaves"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.HRPayroll)}
                accentColor="border-l-rose-600"
                extraValues={[
                  { label: "Pending Leaves", value: stats?.hr?.pendingLeaves ?? 0 },
                  { label: "Advance Salary Reqs", value: stats?.hr?.pendingAdvanceSalary ?? 0 },
                ]}
              />
            )}

            {/* Examination Module */}
            {canSeeExamination && (
              <StatCard
                title="Examination"
                icon={ClipboardList}
                value={stats?.examination?.totalExams ?? 0}
                subtitle="Scheduled exams this session"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.Examination)}
                accentColor="border-l-violet-600"
                extraValues={[
                  { label: "Total Exams", value: stats?.examination?.totalExams ?? 0 },
                  { label: "Session", value: sessionName },
                ]}
              />
            )}

            {/* Complaints Module */}
            {canSeeComplaints && (
              <StatCard
                title="Complaints"
                icon={MessageSquare}
                value={stats?.complaints?.pending ?? stats?.pendingComplaints ?? 0}
                subtitle="Pending complaint tickets"
                isLoading={isStatsLoading}
                onClick={() => navigate(MODULE_ROUTES.Complaints)}
                accentColor="border-l-red-600"
                extraValues={[
                  { label: "Pending", value: stats?.complaints?.pending ?? 0 },
                  { label: "Status", value: "Review Required" },
                ]}
              />
            )}

            {/* Configuration Module */}
            {canSeeConfiguration && (
              <StatCard
                title="Configuration"
                icon={Settings}
                value="Configured"
                subtitle="Roles, templates & system"
                isLoading={false}
                onClick={() => navigate(MODULE_ROUTES.Configuration)}
                accentColor="border-l-slate-600"
                extraValues={[
                  { label: "Access Level", value: currentUser?.role || "Admin" },
                  { label: "Settings", value: "Available" },
                ]}
              />
            )}

          </div>
        </div>

        {/* Quick Launchpad to Allowed Modules */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Your Accessible Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {canSeeStudents && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Students)} className="text-xs h-8">
                  <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Students
                </Button>
              )}
              {canSeeAttendance && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Attendance)} className="text-xs h-8">
                  <CalendarCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Attendance
                </Button>
              )}
              {canSeeStaff && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Staff)} className="text-xs h-8">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  Staff
                </Button>
              )}
              {canSeeFees && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.FeeManagement)} className="text-xs h-8">
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  Fee Challans
                </Button>
              )}
              {canSeeFrontOffice && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.FrontOffice)} className="text-xs h-8">
                  <PhoneCall className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                  Front Office
                </Button>
              )}
              {canSeeAcademics && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Academics)} className="text-xs h-8">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                  Academics
                </Button>
              )}
              {canSeeHostel && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Boarding)} className="text-xs h-8">
                  <Bed className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                  Boarding / Hostel
                </Button>
              )}
              {canSeeExamination && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Examination)} className="text-xs h-8">
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5 text-violet-600" />
                  Examination
                </Button>
              )}
              {canSeeHR && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.HRPayroll)} className="text-xs h-8">
                  <BriefcaseBusiness className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                  HR & Payroll
                </Button>
              )}
              {canSeeInventory && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Inventory)} className="text-xs h-8">
                  <Boxes className="w-3.5 h-3.5 mr-1.5 text-orange-600" />
                  Inventory
                </Button>
              )}
              {canSeeComplaints && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Complaints)} className="text-xs h-8">
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-red-600" />
                  Complaints
                </Button>
              )}
              {canSeeConfiguration && (
                <Button variant="outline" size="sm" onClick={() => navigate(MODULE_ROUTES.Configuration)} className="text-xs h-8">
                  <Settings className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                  Configuration
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
