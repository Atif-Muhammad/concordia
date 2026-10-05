import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Calendar,
  Clock,
  Coins,
  Shield,
  HeartHandshake,
  IdCard,
  School,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LayoutGrid,
  List,
  ChevronRight,
  ArrowRight,
  Pencil,
  FileText,
  CalendarDays
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  userWho,
  refreshTokens,
  getStaffById,
  getAllStaff,
  getPayrollHistory,
  getStaffAttendanceHistory,
  getTeacherClasses,
  getTeacherSubjects
} from "../../../config/apis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MonthPicker } from "@/components/ui/month-picker";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

const TEACHER_DOCUMENTS_CONFIG = [
  { key: "bsDegree", label: "BS / BSc Degree", category: "Academic Degree", icon: GraduationCap },
  { key: "msDegree", label: "MS / MSc Degree", category: "Academic Degree", icon: GraduationCap },
  { key: "phd", label: "PhD Degree", category: "Doctoral Degree", icon: GraduationCap },
  { key: "postDoc", label: "Postdoctoral Certificate", category: "Research Credential", icon: GraduationCap },
  { key: "experienceLetter", label: "Experience Letter", category: "Professional Record", icon: Briefcase },
  { key: "cv", label: "Curriculum Vitae (CV)", category: "Professional Record", icon: FileText },
];

const formatPKR = (amount = 0) => `PKR ${Math.round(Number(amount || 0)).toLocaleString()}`;

const formatTime12h = (timeStr) => {
  if (!timeStr) return "-";
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return timeStr;
  const hour = parseInt(parts[0], 10);
  const minute = parts[1];
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minute} ${ampm}`;
};

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("profile");
  const [attendanceMonth, setAttendanceMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [attendanceViewMode, setAttendanceViewMode] = useState("calendar");

  // 1. Current Authenticated User Query
  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        return await userWho();
      } catch (error) {
        if (error.response?.status === 401) {
          await refreshTokens();
          return userWho();
        }
        throw error;
      }
    },
  });

  const resolvedStaffId =
    currentUser?.staffDbId ||
    currentUser?.refId ||
    currentUser?.user?.staffDbId ||
    currentUser?.user?.refId;

  // 2. Fetch Full Staff Profile Data
  const { data: staff, isLoading: isStaffLoading } = useQuery({
    queryKey: ["staffProfile", resolvedStaffId, currentUser?.email],
    queryFn: async () => {
      if (resolvedStaffId) {
        try {
          const res = await getStaffById(resolvedStaffId);
          if (res) return res;
        } catch (e) {
          console.warn("Could not fetch staff by id, falling back to email search", e);
        }
      }
      if (currentUser?.email) {
        const staffList = await getAllStaff({ search: currentUser.email });
        if (Array.isArray(staffList) && staffList.length > 0) {
          const matched =
            staffList.find(
              (s) => s.email?.toLowerCase() === currentUser.email.toLowerCase()
            ) || staffList[0];
          if (matched?._id || matched?.id) {
            return await getStaffById(matched._id || matched.id);
          }
          return matched;
        }
      }
      return null;
    },
    enabled: !!(resolvedStaffId || currentUser?.email),
  });

  const targetStaffId = staff?._id || staff?.id || resolvedStaffId;

  // 3. Payroll History Query
  const { data: payrollHistory = [], isLoading: isPayrollLoading } = useQuery({
    queryKey: ["payrollHistory", targetStaffId],
    queryFn: () => getPayrollHistory(targetStaffId, "teacher"),
    enabled: !!targetStaffId,
  });

  // 4. Attendance History Query
  const { data: attendanceHistoryData, isLoading: attendanceLoading } = useQuery({
    queryKey: ["staffAttendanceHistory", targetStaffId, attendanceMonth],
    queryFn: () => getStaffAttendanceHistory(targetStaffId, attendanceMonth),
    enabled: !!targetStaffId,
  });

  // 5. Assigned Classes Query
  const { data: classesData, isLoading: isClassesLoading } = useQuery({
    queryKey: ["teacherClasses", targetStaffId],
    queryFn: getTeacherClasses,
    enabled: !!targetStaffId,
  });

  // 6. Assigned Subjects Query
  const { data: subjectsData, isLoading: isSubjectsLoading } = useQuery({
    queryKey: ["teacherSubjects", targetStaffId],
    queryFn: getTeacherSubjects,
    enabled: !!targetStaffId,
  });

  // Calendar calculations memo
  const calendarData = useMemo(() => {
    const targetMonth = attendanceMonth || new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = targetMonth.split("-");
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const firstDay = new Date(year, m - 1, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, m, 0).getDate();

    const recordMap = new Map();
    if (attendanceHistoryData?.records) {
      attendanceHistoryData.records.forEach((r) => {
        recordMap.set(r.day, r);
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const remainingCells = (7 - ((firstDay + daysInMonth) % 7)) % 7;

    return {
      firstDay,
      daysInMonth,
      remainingCells,
      recordMap,
      todayStr,
      year,
      month: m,
    };
  }, [attendanceMonth, attendanceHistoryData]);

  // Documents memo (must be before early returns)
  const teacherDocuments = useMemo(() => {
    const docs = staff?.documents || {};
    return TEACHER_DOCUMENTS_CONFIG.map((d) => ({
      ...d,
      submitted: !!docs[d.key],
    }));
  }, [staff?.documents]);

  const submittedDocsCount = useMemo(() => {
    return teacherDocuments.filter((d) => d.submitted).length;
  }, [teacherDocuments]);

  if (isUserLoading || isStaffLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading teacher profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Derive teacher details from staff record, falling back to currentUser
  const teacherName = staff?.name || currentUser?.user?.name || currentUser?.name || "Teacher";
  const staffCode = staff?.staffId || currentUser?.staffId || "N/A";
  const designation = staff?.designation || (staff?.isTeaching ? "Teacher" : "Faculty Member");
  const departmentName = staff?.departmentId?.name || staff?.department?.name || "Medical";
  const email = staff?.email || currentUser?.email || "N/A";
  const phone = staff?.phone || "N/A";
  const cnic = staff?.cnic || "N/A";
  const address = staff?.address || "N/A";
  const status = staff?.status || "ACTIVE";
  const staffType = staff?.staffType || "PERMANENT";
  const basicPay = staff?.basicPay || 0;
  const joinDate = staff?.joinDate ? new Date(staff.joinDate).toLocaleDateString() : "04/09/2026";
  const specialization = staff?.specialization || "General Medicine";
  const highestDegree = staff?.highestDegree || "MBBS";
  const photoUrl = staff?.photo_url || currentUser?.photo_url;
  const absentDeduction = staff?.absentDeduction || (basicPay ? Math.round(basicPay / 30) : 0);

  const teacherInitials = teacherName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const assignedClasses = Array.isArray(classesData?.data)
    ? classesData.data
    : Array.isArray(classesData)
    ? classesData
    : [];

  const assignedSubjects = Array.isArray(subjectsData?.data)
    ? subjectsData.data
    : Array.isArray(subjectsData)
    ? subjectsData
    : [];

  const totalLeaves = staff?.leaveSettings
    ? (staff.leaveSettings.sickAllowed || 0) +
      (staff.leaveSettings.casualAllowed || 0) +
      (staff.leaveSettings.annualAllowed || 0)
    : "N/A";

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4 w-full">
        {/* Top Header Card (Clean, horizontal, matches uploaded design) */}
        <Card className="border shadow-xs bg-card">
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Top row: Avatar + Name / Badges + Inspirational Quote */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 md:h-18 md:w-18 ring-1 ring-border shadow-xs shrink-0">
                  <AvatarImage src={photoUrl} alt={teacherName} />
                  <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                    {teacherInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                      {teacherName}
                    </h1>
                    <Badge variant="outline" className="font-mono text-xs bg-muted/40 font-medium">
                      {staffCode}
                    </Badge>
                    <Badge
                      className={
                        status === "ACTIVE"
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-2 py-0.5"
                          : "bg-muted-foreground text-white text-xs font-semibold"
                      }
                    >
                      {status}
                    </Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {designation} <span className="text-muted-foreground/60">•</span>{" "}
                    <span className="text-foreground font-medium">{departmentName}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-medium">
                      Teaching Faculty
                    </Badge>
                    {staff?.isNonTeaching && (
                      <Badge variant="outline" className="text-[11px] font-medium bg-muted/40">
                        Non-Teaching Role
                      </Badge>
                    )}
                    {staff?.isSupportingStaff && (
                      <Badge variant="outline" className="text-[11px] font-medium bg-muted/40">
                        Supporting Staff
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[11px] font-medium bg-muted/30">
                      {staffType}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quote Block on Right */}
              <div className="hidden lg:flex flex-col border-l-2 border-primary/60 pl-4 py-1 max-w-sm">
                <p className="text-xs italic text-muted-foreground leading-relaxed">
                  “Education is the most powerful weapon which you can use to change the world.”
                </p>
                <p className="text-[11px] text-muted-foreground font-medium mt-1">
                  — Nelson Mandela
                </p>
              </div>
            </div>

            <Separator />

            {/* Bottom row: Contact info icons on left + Action buttons on right */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground font-medium truncate max-w-[220px]" title={email}>
                    {email}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground font-medium">{phone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <IdCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground font-medium">{cnic}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground font-medium truncate max-w-[200px]" title={address}>
                    {address}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto flex-wrap">
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-medium border-primary/40 hover:bg-primary/10 text-foreground">
                  <Link to="/teacher/leaves">
                    <CalendarDays className="w-3.5 h-3.5 text-primary" /> Leave Applications
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-medium border-primary/40 hover:bg-primary/10 text-foreground">
                  <Link to="/teacher/attendance">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Mark Attendance
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  <Link to="/teacher/classes">
                    <School className="w-3.5 h-3.5" /> View Classes
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full bg-card border rounded-xl p-1.5 h-auto flex flex-wrap gap-1 shadow-xs justify-start">
            <TabsTrigger
              value="profile"
              className="py-2 px-4 gap-2 text-xs md:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs"
            >
              <User className="w-4 h-4" /> Profile & Details
            </TabsTrigger>
            <TabsTrigger
              value="teaching"
              className="py-2 px-4 gap-2 text-xs md:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs"
            >
              <GraduationCap className="w-4 h-4" /> Teaching Assignments
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="py-2 px-4 gap-2 text-xs md:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs"
            >
              <Calendar className="w-4 h-4" /> Monthly Attendance
            </TabsTrigger>
            <TabsTrigger
              value="payroll"
              className="py-2 px-4 gap-2 text-xs md:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs"
            >
              <Coins className="w-4 h-4" /> Payroll & Salary
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PROFILE & DETAILS (2x2 Grid exactly like image) */}
          <TabsContent value="profile" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Personal Information */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Full Name</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{teacherName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Religion</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{staff?.religion || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Father's Name</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{staff?.fatherName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Residential Address</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5 truncate" title={address}>
                        {address}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">National ID (CNIC)</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5 font-mono">{cnic}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Contact Phone</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{phone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Employment Details */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" /> Employment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Staff ID / Code</p>
                      <Badge variant="outline" className="mt-1 font-mono text-xs bg-muted/40 font-semibold">
                        {staffCode}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Department</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{departmentName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Designation</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{designation}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Staff Type</p>
                      <Badge variant="secondary" className="mt-1 text-xs font-semibold">
                        {staffType}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Contract Type</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {staffType === "CONTRACT" && staff?.contractStart
                          ? `${new Date(staff.contractStart).toLocaleDateString()} to ${
                              staff?.contractEnd ? new Date(staff.contractEnd).toLocaleDateString() : "Ongoing"
                            }`
                          : staffType}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Joining Date</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{joinDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Teacher Documents & Verification */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" /> Teacher Documents
                    </CardTitle>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                      {submittedDocsCount} of {TEACHER_DOCUMENTS_CONFIG.length} Submitted
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 p-3 sm:p-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 border-b">
                        <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold w-[40px] sm:w-[50px] hidden sm:table-cell">#</TableHead>
                        <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold">Document Title</TableHead>
                        <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold hidden sm:table-cell">Category</TableHead>
                        <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-right sm:text-center w-[120px] sm:w-[160px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacherDocuments.map((doc, idx) => {
                        const IconComp = doc.icon;
                        const isSubmitted = doc.submitted;
                        return (
                          <TableRow key={doc.key || idx} className="hover:bg-muted/30">
                            <TableCell className="py-2 px-2 sm:px-3 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-xs font-semibold text-foreground">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <IconComp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <div>
                                  <div>{doc.label}</div>
                                  <div className="sm:hidden text-[10px] text-muted-foreground font-normal mt-0.5">{doc.category}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-xs text-muted-foreground hidden sm:table-cell">
                              {doc.category}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-right sm:text-center">
                              {isSubmitted ? (
                                <Badge className="bg-primary/10 text-primary border-primary/20 font-semibold text-[10px] sm:text-xs gap-1">
                                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Submitted
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-[10px] sm:text-xs font-medium gap-1 bg-muted/40">
                                  <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" /> Pending
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Card 4: Compensation & Leave Policy (stats + action card matching image) */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                    <Coins className="w-4 h-4 text-muted-foreground" /> Compensation & Leave Policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                    <div className="sm:col-span-3 grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Basic Salary</p>
                        <p className="text-sm font-bold text-foreground mt-1">
                          {basicPay ? formatPKR(basicPay) : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Allowances</p>
                        <p className="text-sm font-semibold text-foreground mt-1">
                          {staff?.totalAllowances ? formatPKR(staff.totalAllowances) : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Leave Balance</p>
                        <p className="text-sm font-semibold text-foreground mt-1">
                          {typeof totalLeaves === "number" ? `${totalLeaves} Days` : totalLeaves}
                        </p>
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex flex-col gap-2">
                      <Button asChild size="sm" className="w-full text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs h-8">
                        <Link to="/teacher/leaves">
                          <FileText className="w-3.5 h-3.5 mr-1" /> Apply for Leave
                        </Link>
                      </Button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("payroll")}
                        className="w-full flex items-center justify-center gap-1 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>View Detailed Policy</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: TEACHING ASSIGNMENTS */}
          <TabsContent value="teaching" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Assigned Classes */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                  <div>
                    <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                      <School className="w-4 h-4 text-blue-600" /> Assigned Classes
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Classes and sections mapped to you</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-semibold text-xs">
                    {assignedClasses.length} {assignedClasses.length === 1 ? "Class" : "Classes"}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  {isClassesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : assignedClasses.length > 0 ? (
                    <div className="space-y-2.5">
                      {assignedClasses.map((item, idx) => {
                        const className = item.classId?.name || item.class?.name || "Class";
                        const programName =
                          item.classId?.programId?.name || item.class?.program?.name || "";
                        const sectionName = item.sectionId?.name || item.section?.name || "";
                        return (
                          <div
                            key={item._id || item.id || idx}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                          >
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-foreground">{className}</p>
                              {programName && (
                                <p className="text-xs text-muted-foreground">{programName}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {sectionName && (
                                <Badge variant="outline" className="text-xs font-medium">
                                  Section {sectionName}
                                </Badge>
                              )}
                              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                <Link to="/teacher/attendance">
                                  Attendance <ArrowRight className="w-3 h-3 ml-1" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <School className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                      No classes currently assigned.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assigned Subjects */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                  <div>
                    <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-600" /> Assigned Subjects
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Course subjects you are teaching</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-semibold text-xs">
                    {assignedSubjects.length} {assignedSubjects.length === 1 ? "Subject" : "Subjects"}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  {isSubjectsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : assignedSubjects.length > 0 ? (
                    <div className="space-y-2.5">
                      {assignedSubjects.map((item, idx) => {
                        const subjectName = item.subjectId?.name || item.subject?.name || "Subject";
                        const subjectCode = item.subjectId?.code || item.subject?.code || "";
                        const relatedClass = item.classId?.name || item.class?.name || "";
                        return (
                          <div
                            key={item._id || item.id || idx}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                          >
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-foreground">{subjectName}</p>
                              {relatedClass && (
                                <p className="text-xs text-muted-foreground">Class: {relatedClass}</p>
                              )}
                            </div>
                            {subjectCode && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 text-xs font-mono">
                                {subjectCode}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                      No subjects currently assigned.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: MONTHLY ATTENDANCE */}
          <TabsContent value="attendance" className="space-y-4">
            <Card className="border shadow-xs bg-card">
              <CardHeader className="pb-3 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" /> Attendance Record
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      View your daily attendance status, check-in/out times, and leaves.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Button asChild size="sm" variant="outline" className="h-8 px-2.5 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10">
                      <Link to="/teacher/leaves">
                        <FileText className="w-3.5 h-3.5 text-primary" /> Apply for Leave
                      </Link>
                    </Button>
                    <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/40">
                      <Button
                        type="button"
                        variant={attendanceViewMode === "calendar" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 px-2.5 gap-1.5 text-xs font-medium"
                        onClick={() => setAttendanceViewMode("calendar")}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" /> Calendar
                      </Button>
                      <Button
                        type="button"
                        variant={attendanceViewMode === "table" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 px-2.5 gap-1.5 text-xs font-medium"
                        onClick={() => setAttendanceViewMode("table")}
                      >
                        <List className="w-3.5 h-3.5" /> Table
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium text-muted-foreground shrink-0">Month:</Label>
                      <div className="w-44">
                        <MonthPicker
                          value={attendanceMonth}
                          onChange={(val) => val && setAttendanceMonth(val)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Stats KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">Present Days</p>
                    <p className="text-xl font-bold text-primary mt-1">
                      {attendanceHistoryData?.stats?.present ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Recorded on time</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">Absent Days</p>
                    <p className="text-xl font-bold text-rose-600 mt-1">
                      {attendanceHistoryData?.stats?.absent ?? 0}
                    </p>
                    <p className="text-[10px] text-rose-500 mt-0.5 font-medium">
                      {attendanceHistoryData?.stats?.absent
                        ? `-PKR ${(attendanceHistoryData.stats.absent * absentDeduction).toLocaleString()} fine`
                        : "No fines"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">Half Days</p>
                    <p className="text-xl font-bold text-amber-600 mt-1">
                      {attendanceHistoryData?.stats?.halfDay ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">0.5 day recorded</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">Leaves Taken</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">
                      {attendanceHistoryData?.stats?.leave ?? 0}
                    </p>
                    <div className="flex gap-1 mt-0.5 text-[10px]">
                      <span className="text-blue-600 font-medium">
                        CL {attendanceHistoryData?.stats?.leaveBreakdown?.casual ?? 0}
                      </span>
                      <span>•</span>
                      <span className="text-orange-600 font-medium">
                        SK {attendanceHistoryData?.stats?.leaveBreakdown?.sick ?? 0}
                      </span>
                      <span>•</span>
                      <span className="text-purple-600 font-medium">
                        AL {attendanceHistoryData?.stats?.leaveBreakdown?.annual ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">Holidays</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">
                      {attendanceHistoryData?.stats?.holiday ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Official holidays</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">Attendance Rate</p>
                    <p className="text-xl font-bold text-primary mt-1">
                      {attendanceHistoryData?.stats?.attendanceRate ?? 100}%
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {attendanceHistoryData?.stats?.workingDaysTracked ?? 0} days tracked
                    </p>
                  </div>
                </div>

                {/* Calendar View vs Table View */}
                {attendanceLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm border rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    Loading attendance records...
                  </div>
                ) : !attendanceHistoryData?.records?.length ? (
                  <div className="text-center py-12 border rounded-lg bg-muted/10 text-muted-foreground text-sm">
                    No attendance records found for {attendanceMonth}.
                  </div>
                ) : attendanceViewMode === "calendar" ? (
                  <div className="space-y-3">
                    <div className="overflow-x-auto border rounded-xl p-3 bg-card shadow-xs">
                      <div className="min-w-[720px]">
                        <div className="grid grid-cols-7 gap-2 mb-2">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, idx) => (
                            <div
                              key={d}
                              className={`text-center text-xs font-semibold py-1 rounded ${
                                idx === 0
                                  ? "text-rose-600 bg-rose-50/60 dark:bg-rose-950/20"
                                  : "text-muted-foreground bg-muted/30"
                              }`}
                            >
                              {d}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                          {Array.from({ length: calendarData.firstDay }).map((_, i) => (
                            <div
                              key={`empty-pre-${i}`}
                              className="bg-muted/10 rounded-lg border border-dashed border-muted/30 min-h-[96px]"
                            />
                          ))}

                          {Array.from({ length: calendarData.daysInMonth }, (_, i) => i + 1).map((day) => {
                            const rec = calendarData.recordMap.get(day);
                            const dObj = new Date(calendarData.year, calendarData.month - 1, day);
                            const isSunday = dObj.getDay() === 0;
                            const dateStr = `${calendarData.year}-${String(calendarData.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const isToday = dateStr === calendarData.todayStr;
                            const isFuture = dateStr > calendarData.todayStr;

                            const status = rec?.status || "NOT_MARKED";

                            let cellBg = "bg-card border-border hover:bg-muted/20";
                            let badgeEl = null;

                            if (status === "PRESENT") {
                              cellBg = "bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/60";
                              badgeEl = (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 text-white">
                                  Present
                                </span>
                              );
                            } else if (status === "ABSENT") {
                              cellBg = "bg-rose-50/80 border-rose-200 dark:bg-rose-950/25 dark:border-rose-800/60";
                              badgeEl = (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-600 text-white">
                                  Absent
                                </span>
                              );
                            } else if (status === "HALF_DAY" || status === "HALF DAY") {
                              cellBg = "bg-amber-50/80 border-amber-200 dark:bg-amber-950/25 dark:border-amber-800/60";
                              badgeEl = (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500 text-white">
                                  Half Day
                                </span>
                              );
                            } else if (status === "LEAVE") {
                              cellBg = "bg-blue-50/80 border-blue-200 dark:bg-blue-950/25 dark:border-blue-800/60";
                              const lt = rec?.leaveType ? rec.leaveType.toUpperCase() : "LEAVE";
                              badgeEl = (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">
                                  Leave ({lt})
                                </span>
                              );
                            } else if (status === "HOLIDAY" || status === "HD") {
                              cellBg = "bg-purple-50/80 border-purple-200 dark:bg-purple-950/25 dark:border-purple-800/60";
                              badgeEl = (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-600 text-white">
                                  Holiday
                                </span>
                              );
                            } else if (isSunday) {
                              cellBg = "bg-muted/25 border-muted/50 text-muted-foreground";
                              badgeEl = (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border">
                                  Off
                                </span>
                              );
                            }

                            return (
                              <div
                                key={day}
                                className={`min-h-[96px] p-2 rounded-lg border flex flex-col justify-between transition-all select-none ${cellBg} ${
                                  isToday ? "ring-2 ring-primary ring-offset-1 font-semibold" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs font-bold ${isSunday ? "text-rose-500" : "text-foreground"}`}>
                                    {day}
                                  </span>
                                  {badgeEl}
                                </div>

                                <div className="space-y-0.5 text-[10px]">
                                  {rec?.checkInTime && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                      <span>In: {formatTime12h(rec.checkInTime)}</span>
                                    </div>
                                  )}
                                  {rec?.checkOutTime && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                      <span>Out: {formatTime12h(rec.checkOutTime)}</span>
                                    </div>
                                  )}
                                  {status === "ABSENT" && (
                                    <span className="font-semibold text-rose-600 block">
                                      -{formatPKR(absentDeduction)}
                                    </span>
                                  )}
                                  {status === "NOT_MARKED" && (
                                    <span className="text-muted-foreground/50 italic">
                                      {isSunday ? "Weekend" : isFuture ? "Upcoming" : "Not marked"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {Array.from({ length: calendarData.remainingCells }).map((_, i) => (
                            <div
                              key={`empty-post-${i}`}
                              className="bg-muted/10 rounded-lg border border-dashed border-muted/30 min-h-[96px]"
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Legend:</span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> Present
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-rose-600 inline-block" /> Absent
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Half Day
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" /> Leave
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-purple-600 inline-block" /> Holiday
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-muted border inline-block" /> Weekend / Off
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold">Date</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold hidden sm:table-cell">Day</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold">Status</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold">Check-in</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold hidden sm:table-cell">Check-out</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold hidden md:table-cell">Details / Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceHistoryData.records.map((rec) => {
                          const isSun = rec.isSunday;
                          const st = rec.status || "NOT_MARKED";
                          return (
                            <TableRow key={rec.date} className={isSun ? "bg-muted/20 text-muted-foreground" : ""}>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium whitespace-nowrap">
                                <div>{rec.date}</div>
                                <div className="sm:hidden text-[10px] text-muted-foreground">
                                  <span className={isSun ? "font-semibold text-rose-500" : ""}>{rec.dayOfWeek}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs whitespace-nowrap hidden sm:table-cell">
                                <span className={isSun ? "font-semibold text-rose-500" : ""}>{rec.dayOfWeek}</span>
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs">
                                <Badge
                                  className={
                                    st === "PRESENT"
                                      ? "bg-emerald-600 text-white text-[10px] sm:text-xs"
                                      : st === "ABSENT"
                                      ? "bg-rose-600 text-white text-[10px] sm:text-xs"
                                      : st === "HALF_DAY" || st === "HALF DAY"
                                      ? "bg-amber-500 text-white text-[10px] sm:text-xs"
                                      : st === "LEAVE"
                                      ? "bg-blue-600 text-white text-[10px] sm:text-xs"
                                      : st === "HOLIDAY"
                                      ? "bg-purple-600 text-white text-[10px] sm:text-xs"
                                      : "bg-muted text-muted-foreground border text-[10px] sm:text-xs"
                                  }
                                >
                                  {st === "NOT_MARKED" ? (isSun ? "Off" : "Not Marked") : st}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs whitespace-nowrap font-mono">
                                <div>{formatTime12h(rec.checkInTime)}</div>
                                <div className="sm:hidden text-[10px] text-muted-foreground">
                                  out: {formatTime12h(rec.checkOutTime)}
                                </div>
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs whitespace-nowrap font-mono hidden sm:table-cell">
                                {formatTime12h(rec.checkOutTime)}
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs text-muted-foreground hidden md:table-cell">
                                {st === "ABSENT" ? (
                                  <span className="text-rose-600 font-medium">Fine: {formatPKR(absentDeduction)}</span>
                                ) : (
                                  rec.notes || "-"
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: PAYROLL & SALARY */}
          <TabsContent value="payroll" className="space-y-4">
            <Card className="border shadow-xs bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                <div>
                  <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-600" /> Payroll History
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">Your monthly salary disbursement records</CardDescription>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Current Salary</span>
                  <span className="text-base font-bold text-emerald-600">{formatPKR(basicPay)}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {isPayrollLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : Array.isArray(payrollHistory) && payrollHistory.length > 0 ? (
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold">Month</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold hidden md:table-cell">Current Salary</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold hidden lg:table-cell">Allowances</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold hidden lg:table-cell">Deductions</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold">Net Salary</TableHead>
                          <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollHistory.map((payroll) => (
                          <TableRow key={payroll._id || payroll.id || payroll.month}>
                            <TableCell className="py-2 px-2 sm:px-3 text-xs font-semibold">{payroll.month}</TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-xs font-mono font-medium hidden md:table-cell">
                              {formatPKR(payroll.currentSalary ?? payroll.basicSalary)}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-xs font-mono text-emerald-600 font-medium hidden lg:table-cell">
                              +{formatPKR(payroll.totalAllowances || 0)}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-xs font-mono text-rose-600 font-medium hidden lg:table-cell">
                              -{formatPKR(payroll.totalDeductions || 0)}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-xs font-mono font-bold text-foreground">
                              {formatPKR(payroll.netSalary)}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-xs">
                              <Badge
                                className={
                                  payroll.status === "PAID"
                                    ? "bg-emerald-600 text-white text-[10px] sm:text-xs"
                                    : payroll.status === "PENDING"
                                    ? "bg-amber-500 text-white text-[10px] sm:text-xs"
                                    : "bg-muted-foreground text-white text-[10px] sm:text-xs"
                                }
                              >
                                {payroll.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <Coins className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    No payroll disbursement history recorded yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
