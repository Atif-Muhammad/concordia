import React, { useState, useRef, useEffect, useMemo } from "react";
import { validateCurrentTab } from "@/lib/staffValidation";
import { FieldError } from "@/components/ui/field-error";
import {
    IMAGE_UPLOAD_RULES,
    formatCnic,
    validateImageFile,
} from "@/lib/inputValidation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Users,
    GraduationCap,
    Briefcase,
    Eye,
    Loader2,
    Phone,
    Mail,
    Upload,
    UserCog,
    ChevronLeft as ChevronLeftIcon,
    ChevronDown,
    ChevronRight,
    IdCard,
    Shield,
    TrendingUp,
    Coins,
    Calendar,
    LayoutGrid,
    List,
    Clock,
    KeyRound,
    HeartHandshake,
    BookOpen,
} from "lucide-react";
import SalaryRevisionDialog from "./SalaryRevisionDialog.jsx";
import { MonthPicker } from "@/components/ui/month-picker";
import usePermissions from "@/hooks/usePermissions";
import {
    getAllStaff,
    createStaffAPI,
    updateStaffAPI,
    deleteStaffAPI,
    getDepartmentNames,
    getStaffById,
    getPayrollHistory,
    getStaffAttendanceHistory,
    getDefaultStaffIDCardTemplate,
    getStaffIdSettingsAPI,
    previewStaffIdAPI,
    getTeacherClassMappings,
    getTeacherSubjectMappings,
    getAcademicSessions,
} from "../../../config/apis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { NAV_MODULES } from "@/lib/navigation.jsx";
import { resolveFileUrl } from "@/lib/utils";

const STAFF_DOCUMENTS = [
    { key: "bsDegree", label: "BS/BSc Degree" },
    { key: "msDegree", label: "MS/MSc Degree" },
    { key: "phd", label: "PhD" },
    { key: "postDoc", label: "Postdoc" },
    { key: "experienceLetter", label: "Experience Letter" },
    { key: "cv", label: "CV" },
];

const EMP_DEPARTMENTS = [
    "ADMIN",
    "FINANCE",
    "SECURITY",
    "TRANSPORT",
    "CLASS_4",
    "MAINTENANCE",
    "IT_SUPPORT",
    "LIBRARY",
    "LAB",
    "OTHER",
];

const STAFF_TYPES = ["PERMANENT", "CONTRACT"];
const STAFF_STATUSES = ["ACTIVE", "TERMINATED", "RETIRED"];

export const extractStaffIdNumber = (staffIdStr) => {
    if (!staffIdStr) return "";
    const str = String(staffIdStr).trim();
    const match = str.match(/(\d+)$/);
    return match ? match[1] : "";
};

export const getStaffPrefix = (settings, roles = {}) => {
    const isSupporting = Boolean(roles.isSupportingStaff);
    const isTeach = Boolean(roles.isTeaching);
    const isNonTeach = Boolean(roles.isNonTeaching);

    if (isSupporting) {
        return settings?.supportingPrefix ?? "SS-";
    }
    if (isTeach && isNonTeach) {
        return settings?.dualPrefix ?? "D-";
    }
    if (isTeach) {
        return settings?.teachingPrefix ?? "T-";
    }
    if (isNonTeach) {
        return settings?.nonTeachingPrefix ?? "NT-";
    }
    return settings?.teachingPrefix ?? "T-";
};

export const generateStaffIdFromJoinDate = (joinDateStr, existingId = "") => {
    let year = "";
    let month = "";
    if (joinDateStr) {
        const parts = String(joinDateStr).split("T")[0].split("-");
        if (parts.length >= 2 && parts[0].length === 4) {
            year = parts[0].slice(-2);
            month = parts[1].padStart(2, "0");
        } else {
            const d = new Date(joinDateStr);
            if (!isNaN(d.getTime())) {
                year = String(d.getFullYear()).slice(-2);
                month = String(d.getMonth() + 1).padStart(2, "0");
            }
        }
    }
    if (!year || !month) {
        const now = new Date();
        year = String(now.getFullYear()).slice(-2);
        month = String(now.getMonth() + 1).padStart(2, "0");
    }
    let rand2 = "";
    const numPart = extractStaffIdNumber(existingId);
    if (numPart && numPart.length >= 2) {
        rand2 = numPart.slice(-2);
    } else {
        rand2 = Math.floor(10 + Math.random() * 90).toString();
    }
    return `${year}${month}${rand2}`;
};

export const formatStaffId = (rawId, roles = {}, settings = {}) => {
    const num = extractStaffIdNumber(rawId) || (roles?.joinDate ? generateStaffIdFromJoinDate(roles.joinDate) : "");
    if (!num) return rawId || "";
    const prefix = getStaffPrefix(settings, roles);
    return `${prefix}${num}`;
};

const initialFormData = {
    staffId: "",
    name: "",
    fatherName: "",
    cnic: "",
    email: "",
    phone: "",
    address: "",
    religion: "",
    password: "",
    isTeaching: false,
    isNonTeaching: false,
    isSupportingStaff: false,
    staffType: "PERMANENT",
    status: "ACTIVE",
    basicPay: "",
    joinDate: "",
    leaveDate: "",
    contractStart: "",
    contractEnd: "",
    specialization: "",
    highestDegree: "",
    departmentId: "",
    documents: {
        bsDegree: false,
        msDegree: false,
        phd: false,
        postDoc: false,
        experienceLetter: false,
        cv: false,
    },
    designation: "",
    empDepartment: "",
    accessRights: [],
    subModules: {},
    actions: {},
    enableLeaveConfig: false,
    sickAllowed: "",
    sickDeduction: "",
    annualAllowed: "",
    annualDeduction: "",
    casualAllowed: "",
    casualDeduction: "",
    absentDeduction: "",
    maxLateMinutes: "",
};

const STAFF_PERMISSION_MODULES = NAV_MODULES;

const isReadOnlySubmodule = (moduleLabel, subKey) => {
    if (moduleLabel === "Students" && subKey === "reports") {
        return true;
    }
    if (moduleLabel === "Attendance" && (subKey === "reports" || subKey === "individual-reports")) {
        return true;
    }
    if (moduleLabel === "Fee Management" && (subKey === "reports" || subKey === "student-history")) {
        return true;
    }
    if (moduleLabel === "HR & Payroll" && subKey === "reports") {
        return true;
    }
    if (moduleLabel === "Boarding" && (subKey === "revenue" || subKey === "reports")) {
        return true;
    }
    if (moduleLabel === "Finance" && subKey === "reports") {
        return true;
    }
    return false;
};

const isFinanceClosingSubmodule = (moduleLabel, subKey) => {
    return moduleLabel === "Finance" && subKey === "closing";
};

export const isApprovalSubmodule = (moduleLabel, subKey) => {
    return (moduleLabel === "Finance" && subKey === "expense") ||
           (moduleLabel === "HR & Payroll" && subKey === "leaves");
};
const DEFAULT_STEP_LABELS = ["Basic Info", "Employment", "Roles", "Account", "Role Details"];

function StepIndicator({ currentStep, completedSteps, onStepClick, stepLabels }) {
    const labels = stepLabels || DEFAULT_STEP_LABELS;
    return (
        <div className="flex items-center w-full mb-6 px-2">
            {labels.map((label, i) => {
                const step = i + 1;
                const isActive = step === currentStep;
                const isCompleted = completedSteps.has(step);

                let circleClass = "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 cursor-pointer select-none transition-colors duration-200 ";
                if (isActive) {
                    circleClass += "bg-primary text-primary-foreground border-primary";
                } else if (isCompleted) {
                    circleClass += "bg-green-500 text-white border-green-500";
                } else {
                    circleClass += "bg-muted text-muted-foreground border-muted";
                }

                return (
                    <React.Fragment key={step}>
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className={circleClass}
                                onClick={() => onStepClick(step)}
                                data-step={step}
                                data-state={isActive ? "active" : isCompleted ? "completed" : "upcoming"}
                            >
                                {step}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
                        </div>
                        {i < labels.length - 1 && (
                            <div className="flex-1 h-0.5 mx-1 mb-4 bg-muted overflow-hidden rounded">
                                <div
                                    className="h-full bg-green-500 transition-all duration-300"
                                    style={{ width: isCompleted ? "100%" : "0%" }}
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

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

function StaffDetailView({ staffId, onBack, onEdit, onReviseSalary, onViewIdCard, canUpdate = true }) {
    const [activeTab, setActiveTab] = useState("info");
    const [attendanceMonth, setAttendanceMonth] = useState(
        new Date().toISOString().slice(0, 7)
    );
    const [attendanceViewMode, setAttendanceViewMode] = useState("calendar");
    const [assignmentSessionId, setAssignmentSessionId] = useState("all");

    const { data: staff, isLoading } = useQuery({
        queryKey: ["staff", staffId],
        queryFn: () => getStaffById(staffId),
    });

    const { data: staffIdSettings } = useQuery({
        queryKey: ["staffIdSettings"],
        queryFn: getStaffIdSettingsAPI,
    });

    const { data: payrollHistory = [] } = useQuery({
        queryKey: ["payrollHistory", staffId],
        queryFn: () => getPayrollHistory(staffId, staff?.isTeaching ? "teacher" : "employee"),
        enabled: !!staff,
    });

    const { data: attendanceHistoryData, isLoading: attendanceLoading } = useQuery({
        queryKey: ["staffAttendanceHistory", staffId, attendanceMonth],
        queryFn: () => getStaffAttendanceHistory(staffId, attendanceMonth),
        enabled: !!staffId && activeTab === "attendance",
    });

    // Teaching assignments data
    const { data: academicSessions = [] } = useQuery({
        queryKey: ["academicSessions"],
        queryFn: getAcademicSessions,
        enabled: !!staff?.isTeaching && activeTab === "teaching",
    });

    const { data: allTCM = [], isLoading: tcmLoading } = useQuery({
        queryKey: ["teacherClassMappings", assignmentSessionId],
        queryFn: () => getTeacherClassMappings(assignmentSessionId !== "all" ? assignmentSessionId : undefined),
        enabled: !!staff?.isTeaching && activeTab === "teaching",
    });

    const { data: allTSM = [], isLoading: tsmLoading } = useQuery({
        queryKey: ["teacherSubjectMappings"],
        queryFn: () => getTeacherSubjectMappings(),
        enabled: !!staff?.isTeaching && activeTab === "teaching",
    });

    // Filter + group assignments for this teacher
    const teacherAssignments = useMemo(() => {
        if (!staff) return { classes: [], subjectsByClass: {} };

        const sid = staff._id || staff.id;

        // Class assignments for this teacher (optionally filtered by session)
        const myClassMappings = (Array.isArray(allTCM) ? allTCM : []).filter(m => {
            const tid = m.teacherId?._id || m.teacherId?.id || m.teacherId;
            return String(tid) === String(sid);
        });

        // Subject mappings for this teacher
        const mySubjectMappings = (Array.isArray(allTSM) ? allTSM : []).filter(m => {
            const tid = m.teacherId?._id || m.teacherId?.id || m.teacherId;
            if (String(tid) !== String(sid)) return false;
            // Filter by session if selected
            if (assignmentSessionId && assignmentSessionId !== "all") {
                const mSid = m.sessionId?._id || m.sessionId?.id || m.sessionId;
                return String(mSid) === String(assignmentSessionId);
            }
            return true;
        });

        // Group class assignments: classId+sectionId → { class, section, session, subjects }
        const classMap = new Map();
        myClassMappings.forEach(m => {
            const classObj = m.classId || {};
            const sectionObj = m.sectionId || null;
            const sessionObj = m.sessionId || null;
            const key = `${classObj._id || classObj.id || "none"}_${sectionObj?._id || sectionObj?.id || "none"}_${sessionObj?._id || sessionObj?.id || "none"}`;
            if (!classMap.has(key)) {
                classMap.set(key, {
                    id: m._id || m.id,
                    class: classObj,
                    program: classObj.programId || null,
                    section: sectionObj,
                    session: sessionObj,
                    subjects: [],
                });
            }
        });

        // Attach subjects to their class groups
        mySubjectMappings.forEach(m => {
            if (!m.subjectId) return; // skip non-subject mappings
            const classId = m.classId?._id || m.classId?.id || m.classId || "none";
            const sectionId = m.sectionId?._id || m.sectionId?.id || m.sectionId || "none";
            const sessionId = m.sessionId?._id || m.sessionId?.id || m.sessionId || "none";
            const key = `${classId}_${sectionId}_${sessionId}`;
            if (classMap.has(key)) {
                if (m.subjectId) classMap.get(key).subjects.push(m.subjectId);
            } else {
                // Subject without a class entry — create one
                classMap.set(key, {
                    id: m._id || m.id,
                    class: m.classId || {},
                    program: m.classId?.programId || null,
                    section: m.sectionId || null,
                    session: m.sessionId || null,
                    subjects: m.subjectId ? [m.subjectId] : [],
                });
            }
        });

        return {
            classes: Array.from(classMap.values()).sort((a, b) => {
                const pa = a.program?.name || "";
                const pb = b.program?.name || "";
                if (pa !== pb) return pa.localeCompare(pb);
                return (a.class?.name || "").localeCompare(b.class?.name || "");
            }),
        };
    }, [staff, allTCM, allTSM, assignmentSessionId]);

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

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!staff) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Staff member not found</p>
                <Button onClick={onBack} className="mt-4">Go Back</Button>
            </div>
        );
    }

    const getRoleBadges = () => {
        const badges = [];
        if (staff.isTeaching) {
            badges.push(
                <Badge key="teaching" className="bg-blue-500 text-white">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    Teaching
                </Badge>
            );
        }
        if (staff.isNonTeaching) {
            badges.push(
                <Badge key="non-teaching" className="bg-purple-500 text-white">
                    <Briefcase className="w-3 h-3 mr-1" />
                    Non-Teaching
                </Badge>
            );
        }
        if (staff.isSupportingStaff) {
            badges.push(
                <Badge key="supporting" className="bg-amber-600 text-white">
                    <HeartHandshake className="w-3 h-3 mr-1" />
                    Supporting Staff
                </Badge>
            );
        }
        return badges;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="gap-2">
                    <ChevronLeftIcon className="w-4 h-4" />
                    Back to Staff List
                </Button>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onViewIdCard && onViewIdCard(staff)}
                        className="gap-2"
                    >
                        <IdCard className="w-4 h-4" />
                        ID Card
                    </Button>
                    {canUpdate && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => onReviseSalary && onReviseSalary(staff)}
                                className="gap-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
                            >
                                <Coins className="w-4 h-4" />
                                Salary Revision
                            </Button>
                            <Button onClick={onEdit} className="gap-2">
                                <Pencil className="w-4 h-4" />
                                Edit Staff
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        <Avatar className="h-24 w-24">
                            <AvatarImage src={resolveFileUrl(staff.photo_url || staff.photo)} alt={staff.name} />
                            <AvatarFallback className="text-2xl">
                                {staff.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold">{staff.name}</h2>
                                <Badge className={staff.status === "ACTIVE" ? "bg-green-500" : "bg-gray-500"}>
                                    {staff.status}
                                </Badge>
                                {staff.staffId && (
                                    <Badge variant="outline" className="font-mono text-xs font-semibold">
                                        ID: {formatStaffId(staff.staffId, staff, staffIdSettings) || staff.staffId}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground font-medium">{staff.designation || (staff.isTeaching ? "Teacher" : (staff.isSupportingStaff ? "Supporting Staff" : "Staff"))}</p>
                            <div className="flex gap-2 mt-2">{getRoleBadges()}</div>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                {staff.email && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        {staff.email}
                                    </div>
                                )}
                                {staff.phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        {staff.phone}
                                    </div>
                                )}
                                {staff.cnic && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <IdCard className="w-4 h-4 text-muted-foreground" />
                                        {staff.cnic}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="info">Info</TabsTrigger>
                    {staff.isTeaching && <TabsTrigger value="teaching">Teaching Assignments</TabsTrigger>}
                    <TabsTrigger value="payroll">Payroll History</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance History</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Personal Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Father's Name</span>
                                    <span>{staff.fatherName || "-"}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Address</span>
                                    <span className="text-right max-w-[200px]">{staff.address || "-"}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Employment Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Staff Type</span>
                                    <span>{staff.staffType}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Current Salary</span>
                                    <span className="font-semibold text-primary">PKR {staff.basicPay?.toLocaleString() || "-"}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Base Salary</span>
                                    <span>PKR {(staff.baseSalary || staff.basicPay)?.toLocaleString() || "-"}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Daily Absent Fine</span>
                                    <span className="font-medium text-amber-600 dark:text-amber-400">
                                        PKR {(staff.absentDeduction || (staff.basicPay ? Math.round(staff.basicPay / 30) : 0))?.toLocaleString()} / day
                                    </span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Join Date</span>
                                    <span>{staff.joinDate ? new Date(staff.joinDate).toLocaleDateString() : "-"}</span>
                                </div>
                                {staff.staffType === "CONTRACT" && (
                                    <>
                                        <Separator />
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Contract Period</span>
                                            <span>
                                                {staff.contractStart ? new Date(staff.contractStart).toLocaleDateString() : "-"} to{" "}
                                                {staff.contractEnd ? new Date(staff.contractEnd).toLocaleDateString() : "-"}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {staff.isTeaching && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <GraduationCap className="w-5 h-5 text-blue-500" />
                                        Teaching Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Specialization</span>
                                        <span>{staff.specialization || "-"}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Highest Degree</span>
                                        <span>{staff.highestDegree || "-"}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Department</span>
                                        <span>{staff.department?.name || "-"}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {staff.isNonTeaching && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Briefcase className="w-5 h-5 text-purple-500" />
                                        Non-Teaching Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Designation</span>
                                        <span>{staff.designation || "-"}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Linked Department</span>
                                        <span>{staff.department?.name || "-"}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Employee Department</span>
                                        <span>{staff.empDepartment?.replace("_", " ") || "-"}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {(staff.isTeaching || staff.isNonTeaching) && (
                            <Card className="col-span-2">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Shield className="w-5 h-5 text-orange-500" />
                                            System Access Rights
                                        </CardTitle>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> R: Read
                                            </span>
                                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span> C: Create
                                            </span>
                                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                                <span className="w-2 h-2 rounded-full bg-amber-600 inline-block"></span> U: Update
                                            </span>
                                            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                                                <span className="w-2 h-2 rounded-full bg-rose-600 inline-block"></span> D: Delete
                                            </span>
                                            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                                <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span> Pay Fee
                                            </span>
                                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                                                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span> Approvals
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        const actions = staff.permissions?.actions || staff.permissions?.crud;
                                        if (actions && Object.keys(actions).length > 0) {
                                            const activeModuleEntries = Object.entries(actions).filter(([_, subObj]) => {
                                                if (!subObj || typeof subObj !== "object") return false;
                                                return Object.values(subObj).some((act) => act && Object.values(act).some(Boolean));
                                            });

                                            if (activeModuleEntries.length > 0) {
                                                return (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {activeModuleEntries.map(([modName, subObj]) => {
                                                            const activeEntries = Object.entries(subObj).filter(
                                                                ([_, act]) => act && Object.values(act).some(Boolean)
                                                            );
                                                            return (
                                                                <div key={modName} className="p-2.5 rounded-lg border bg-muted/20">
                                                                    <p className="text-xs font-semibold text-primary mb-1.5">{modName}</p>
                                                                    <div className="space-y-1">
                                                                        {activeEntries.map(([subKey, act]) => (
                                                                            <div key={subKey} className="flex items-center justify-between text-xs py-0.5 border-b border-border/30 last:border-0">
                                                                                <span className="text-muted-foreground capitalize">
                                                                                    {subKey === "_root" ? modName : subKey.replace(/[-_]/g, " ")}
                                                                                </span>
                                                                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                                                                    {act.read && <Badge className="h-4 px-1 text-[10px] bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300">R</Badge>}
                                                                                    {!isReadOnlySubmodule(modName, subKey) && !isFinanceClosingSubmodule(modName, subKey) && act.create && <Badge className="h-4 px-1 text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">C</Badge>}
                                                                                    {!isReadOnlySubmodule(modName, subKey) && !isFinanceClosingSubmodule(modName, subKey) && act.update && <Badge className="h-4 px-1 text-[10px] bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300">U</Badge>}
                                                                                    {!isReadOnlySubmodule(modName, subKey) && !isFinanceClosingSubmodule(modName, subKey) && act.delete && <Badge className="h-4 px-1 text-[10px] bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300">D</Badge>}
                                                                                    {Boolean(act.payFee || act.pay) && <Badge className="h-4 px-1 text-[10px] bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300">Pay Fee</Badge>}
                                                                                    {Boolean(act.approvals || act.approve) && <Badge className="h-4 px-1 text-[10px] bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">Approvals</Badge>}
                                                                                    {Boolean(act.closing || act.close) && <Badge className="h-4 px-1 text-[10px] bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300">Closing</Badge>}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            }
                                        }

                                        return (
                                            <div className="flex flex-wrap gap-2">
                                                {[...new Set([
                                                    ...(staff.permissions?.modules || []),
                                                    ...(staff.isTeaching && !staff.isNonTeaching ? ["Attendance"] : []),
                                                    ...(staff.isTeaching && !staff.isNonTeaching ? ["Examination", "Complaints"] : ["Complaints"])
                                                ])].map((module) => (
                                                    <Badge key={module} variant="secondary" className="bg-orange-50 text-orange-700 border-orange-100 font-medium">
                                                        {module}
                                                    </Badge>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="teaching" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <BookOpen className="w-5 h-5" />
                                    Teaching Assignments
                                </CardTitle>
                                <Select value={assignmentSessionId} onValueChange={setAssignmentSessionId}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Filter by session" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sessions</SelectItem>
                                        {academicSessions.map((s) => (
                                            <SelectItem key={s._id || s.id} value={s._id || s.id}>
                                                {s.name || s.label || `${s.startYear}-${s.endYear}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {(tcmLoading || tsmLoading) ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : teacherAssignments.classes.length > 0 ? (
                                <div className="space-y-3">
                                    {teacherAssignments.classes.map((entry, idx) => (
                                        <div key={entry.id || idx} className="border rounded-lg p-3 bg-muted/30">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <GraduationCap className="w-4 h-4 text-primary" />
                                                    <span className="font-medium">
                                                        {entry.class?.name || "Unknown Class"}
                                                    </span>
                                                    {entry.program?.name && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {entry.program.name}
                                                        </Badge>
                                                    )}
                                                    {entry.section?.name && (
                                                        <Badge variant="outline" className="text-xs">
                                                            Section: {entry.section.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {entry.session && (
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs">
                                                        {entry.session.name || entry.session.label || ""}
                                                    </Badge>
                                                )}
                                            </div>
                                            {entry.subjects.length > 0 && (
                                                <div className="ml-6 flex flex-wrap gap-1.5 mt-1">
                                                    {entry.subjects.map((sub, si) => (
                                                        <Badge key={sub._id || sub.id || si} variant="outline" className="text-xs bg-white">
                                                            {sub.name || "Unknown Subject"}
                                                            {sub.code && <span className="ml-1 text-muted-foreground">({sub.code})</span>}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center py-8">
                                    No teaching assignments found{assignmentSessionId !== "all" ? " for the selected session" : ""}.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payroll" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Payroll History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {payrollHistory.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="py-2 px-3 text-sm">Month</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Basic Salary</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Deductions</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Allowances</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Net Salary</TableHead>
                                            <TableHead className="py-2 px-3 text-sm">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payrollHistory.map((payroll) => (
                                            <TableRow key={payroll.id}>
                                                <TableCell className="py-2 px-3 text-sm">{payroll.month}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm">PKR {(payroll.currentSalary ?? payroll.basicSalary)?.toLocaleString()}</TableCell>
                                                <TableCell className="py-2 px-3 text-sm text-red-500">
                                                    -PKR {payroll.totalDeductions?.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-sm text-green-500">
                                                    +PKR {payroll.totalAllowances?.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-sm font-medium">
                                                    PKR {payroll.netSalary?.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-sm">
                                                    <Badge className={payroll.status === "PAID" ? "bg-green-500" : "bg-yellow-500"}>
                                                        {payroll.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-muted-foreground text-center py-8">No payroll records found</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="attendance" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3 border-b">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        Monthly Attendance Records
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        View and track day-by-day attendance, check-in/out times, leaves, and holidays.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/40">
                                        <Button
                                            type="button"
                                            variant={attendanceViewMode === "calendar" ? "secondary" : "ghost"}
                                            size="sm"
                                            className="h-8 px-2.5 gap-1.5 text-xs font-medium"
                                            onClick={() => setAttendanceViewMode("calendar")}
                                        >
                                            <LayoutGrid className="w-3.5 h-3.5" />
                                            Calendar
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={attendanceViewMode === "table" ? "secondary" : "ghost"}
                                            size="sm"
                                            className="h-8 px-2.5 gap-1.5 text-xs font-medium"
                                            onClick={() => setAttendanceViewMode("table")}
                                        >
                                            <List className="w-3.5 h-3.5" />
                                            Table
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
                                    <p className="text-xl font-bold text-emerald-600 mt-1">
                                        {attendanceHistoryData?.stats?.present ?? 0}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">On time & active</p>
                                </div>
                                <div className="p-3 rounded-lg border bg-card">
                                    <p className="text-xs text-muted-foreground">Absent Days</p>
                                    <p className="text-xl font-bold text-rose-600 mt-1">
                                        {attendanceHistoryData?.stats?.absent ?? 0}
                                    </p>
                                    <p className="text-[10px] text-rose-500 mt-0.5">
                                        {attendanceHistoryData?.stats?.absent
                                            ? `PKR ${(attendanceHistoryData.stats.absent * (staff.absentDeduction || (staff.basicPay ? Math.round(staff.basicPay / 30) : 0))).toLocaleString()} fine`
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
                                        <span className="text-blue-600">CL {attendanceHistoryData?.stats?.leaveBreakdown?.casual ?? 0}</span>
                                        <span>•</span>
                                        <span className="text-orange-600">SK {attendanceHistoryData?.stats?.leaveBreakdown?.sick ?? 0}</span>
                                        <span>•</span>
                                        <span className="text-purple-600">AL {attendanceHistoryData?.stats?.leaveBreakdown?.annual ?? 0}</span>
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
                                        {attendanceHistoryData?.stats?.workingDaysTracked ?? 0} tracked days
                                    </p>
                                </div>
                            </div>

                            {/* View Switch: Calendar or Table */}
                            {attendanceLoading ? (
                                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm border rounded-lg">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    Loading attendance records...
                                </div>
                            ) : !attendanceHistoryData?.records?.length ? (
                                <div className="text-center py-12 border rounded-lg bg-muted/10 text-muted-foreground text-sm">
                                    No attendance records found for this month.
                                </div>
                            ) : attendanceViewMode === "calendar" ? (
                                <div className="space-y-3">
                                    {/* 7-column Calendar View */}
                                    <div className="overflow-x-auto border rounded-xl p-3 bg-card shadow-xs">
                                        <div className="min-w-[720px]">
                                            {/* Weekday column headers */}
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

                                            {/* Days Grid */}
                                            <div className="grid grid-cols-7 gap-2">
                                                {/* Leading empty cells before the 1st of month */}
                                                {Array.from({ length: calendarData.firstDay }).map((_, i) => (
                                                    <div
                                                        key={`empty-pre-${i}`}
                                                        className="bg-muted/10 rounded-lg border border-dashed border-muted/30 min-h-[98px]"
                                                    />
                                                ))}

                                                {/* Month day cells */}
                                                {Array.from({ length: calendarData.daysInMonth }, (_, i) => i + 1).map((day) => {
                                                    const rec = calendarData.recordMap.get(day);
                                                    const dObj = new Date(calendarData.year, calendarData.month - 1, day);
                                                    const isSunday = dObj.getDay() === 0;
                                                    const dateStr = `${calendarData.year}-${String(calendarData.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                                    const isToday = dateStr === calendarData.todayStr;
                                                    const isFuture = dateStr > calendarData.todayStr;
                                                    const dailyAbsentFine = staff.absentDeduction || (staff.basicPay ? Math.round(staff.basicPay / 30) : 0);

                                                    const status = rec?.status || "NOT_MARKED";

                                                    let cellBg = "bg-card border-border hover:bg-muted/20";
                                                    let badgeEl = null;

                                                    if (status === "PRESENT") {
                                                        cellBg = "bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30";
                                                        badgeEl = (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 text-white shadow-xs">
                                                                Present
                                                            </span>
                                                        );
                                                    } else if (status === "ABSENT") {
                                                        cellBg = "bg-rose-50/80 border-rose-200 dark:bg-rose-950/25 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/35";
                                                        badgeEl = (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-600 text-white shadow-xs">
                                                                Absent
                                                            </span>
                                                        );
                                                    } else if (status === "HALF_DAY" || status === "HALF DAY") {
                                                        cellBg = "bg-amber-50/80 border-amber-200 dark:bg-amber-950/25 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/35";
                                                        badgeEl = (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500 text-white shadow-xs">
                                                                Half Day
                                                            </span>
                                                        );
                                                    } else if (status === "LEAVE") {
                                                        cellBg = "bg-blue-50/80 border-blue-200 dark:bg-blue-950/25 dark:border-blue-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/35";
                                                        const lt = rec?.leaveType ? rec.leaveType.toUpperCase() : "LEAVE";
                                                        badgeEl = (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white shadow-xs">
                                                                Leave ({lt})
                                                            </span>
                                                        );
                                                    } else if (status === "HOLIDAY" || status === "HD") {
                                                        cellBg = "bg-purple-50/80 border-purple-200 dark:bg-purple-950/25 dark:border-purple-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/35";
                                                        badgeEl = (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-600 text-white shadow-xs">
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

                                                    const hoverTooltip = `${dateStr} (${rec?.dayOfWeek || dObj.toLocaleDateString("en-US", { weekday: "long" })})\nStatus: ${
                                                        status === "NOT_MARKED" ? (isSunday ? "Sunday / Off" : isFuture ? "Upcoming" : "Not Marked") : status
                                                    }${rec?.checkInTime ? `\nCheck-in: ${formatTime12h(rec.checkInTime)}` : ""}${
                                                        rec?.checkOutTime ? `\nCheck-out: ${formatTime12h(rec.checkOutTime)}` : ""
                                                    }${rec?.notes ? `\nNotes: ${rec.notes}` : ""}${rec?.markedBy ? `\nMarked By: ${rec.markedBy}` : ""}`;

                                                    return (
                                                        <div
                                                            key={day}
                                                            title={hoverTooltip}
                                                            className={`min-h-[98px] p-2 rounded-lg border flex flex-col justify-between transition-all select-none ${cellBg} ${
                                                                isToday ? "ring-2 ring-primary ring-offset-1 font-semibold" : ""
                                                            }`}
                                                        >
                                                            {/* Top row: Day number & badge */}
                                                            <div className="flex items-center justify-between gap-1">
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-sm font-bold ${isSunday ? "text-rose-500" : "text-foreground"}`}>
                                                                        {day}
                                                                    </span>
                                                                    {isToday && (
                                                                        <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 bg-primary text-primary-foreground rounded">
                                                                            Today
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {badgeEl}
                                                            </div>

                                                            {/* Middle content: Check-in/out, deduction fine, notes */}
                                                            <div className="mt-1 space-y-0.5 flex-1 flex flex-col justify-center">
                                                                {status === "PRESENT" && (
                                                                    <div className="text-[10px] space-y-0.5">
                                                                        <div className="flex items-center gap-1 text-emerald-800 dark:text-emerald-300 font-medium">
                                                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                                                            <span>In: {formatTime12h(rec.checkInTime)}</span>
                                                                        </div>
                                                                        {rec.checkOutTime && (
                                                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                                                <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                                                                <span>Out: {formatTime12h(rec.checkOutTime)}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {status === "ABSENT" && (
                                                                    <div className="text-[10px]">
                                                                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                                                                            -PKR {dailyAbsentFine.toLocaleString()}
                                                                        </span>
                                                                        {rec?.notes && (
                                                                            <p className="text-[9px] text-muted-foreground truncate mt-0.5" title={rec.notes}>
                                                                                {rec.notes}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {(status === "HALF_DAY" || status === "HALF DAY") && (
                                                                    <div className="text-[10px] space-y-0.5">
                                                                        <div className="flex items-center gap-1 text-amber-800 dark:text-amber-300 font-medium">
                                                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                                                            <span>{rec?.checkInTime ? formatTime12h(rec.checkInTime) : "Half Day"}</span>
                                                                        </div>
                                                                        {rec?.checkOutTime && (
                                                                            <div className="text-[9px] text-muted-foreground">
                                                                                Out: {formatTime12h(rec.checkOutTime)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {status === "LEAVE" && (
                                                                    <div className="text-[10px] text-blue-700 dark:text-blue-300">
                                                                        <p className="truncate font-medium" title={rec?.notes || "Approved Leave"}>
                                                                            {rec?.notes || "Approved Leave"}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {(status === "HOLIDAY" || status === "HD") && (
                                                                    <div className="text-[10px] text-purple-700 dark:text-purple-300">
                                                                        <p className="truncate font-medium" title={rec?.notes || "Holiday"}>
                                                                            {rec?.notes || "Holiday"}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {status === "NOT_MARKED" && (
                                                                    <div className="text-[10px]">
                                                                        {isSunday ? (
                                                                            <span className="text-muted-foreground/60 italic">Weekend</span>
                                                                        ) : isFuture ? (
                                                                            <span className="text-muted-foreground/40 italic">Upcoming</span>
                                                                        ) : (
                                                                            <span className="text-muted-foreground/50 italic">Not marked</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Bottom info: markedBy if present */}
                                                            {rec?.markedBy && (
                                                                <div className="pt-1 text-[9px] text-muted-foreground truncate border-t border-black/5 dark:border-white/5">
                                                                    By {rec.markedBy}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Trailing empty cells */}
                                                {Array.from({ length: calendarData.remainingCells }).map((_, i) => (
                                                    <div
                                                        key={`empty-post-${i}`}
                                                        className="bg-muted/10 rounded-lg border border-dashed border-muted/30 min-h-[98px]"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
                                        <span className="font-semibold text-foreground">Legend:</span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" />
                                            Present
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded bg-rose-600 inline-block" />
                                            Absent
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                                            Half Day
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" />
                                            Leave (CL/SK/AL)
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded bg-purple-600 inline-block" />
                                            Holiday
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded bg-muted border inline-block" />
                                            Sunday / Off
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                /* Detailed Table View */
                                <div className="overflow-x-auto border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/40">
                                                <TableHead className="py-2.5 px-3 text-xs font-semibold">Date</TableHead>
                                                <TableHead className="py-2.5 px-3 text-xs font-semibold">Day</TableHead>
                                                <TableHead className="py-2.5 px-3 text-xs font-semibold">Status</TableHead>
                                                <TableHead className="py-2.5 px-3 text-xs font-semibold">Check-in</TableHead>
                                                <TableHead className="py-2.5 px-3 text-xs font-semibold">Check-out</TableHead>
                                                <TableHead className="py-2.5 px-3 text-xs font-semibold">Marked By</TableHead>
                                                <TableHead className="py-2.5 px-3 text-xs font-semibold">Notes / Details</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {attendanceHistoryData.records.map((rec) => {
                                                const isSun = rec.isSunday;
                                                return (
                                                    <TableRow
                                                        key={rec.date}
                                                        className={isSun ? "bg-muted/20 text-muted-foreground" : ""}
                                                    >
                                                        <TableCell className="py-2 px-3 text-xs font-medium whitespace-nowrap">
                                                            {rec.date}
                                                        </TableCell>
                                                        <TableCell className="py-2 px-3 text-xs whitespace-nowrap">
                                                            <span className={isSun ? "font-semibold text-rose-500" : ""}>
                                                                {rec.dayOfWeek}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-2 px-3 text-xs">
                                                            {rec.status === "PRESENT" ? (
                                                                <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-700">
                                                                    PRESENT
                                                                </Badge>
                                                            ) : rec.status === "ABSENT" ? (
                                                                <Badge variant="destructive" className="text-[10px]">
                                                                    ABSENT
                                                                </Badge>
                                                            ) : rec.status === "HALF_DAY" || rec.status === "HALF DAY" ? (
                                                                <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                                                                    HALF DAY
                                                                </Badge>
                                                            ) : rec.status === "LEAVE" ? (
                                                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300">
                                                                    LEAVE {rec.leaveType ? `(${rec.leaveType.toUpperCase()})` : ""}
                                                                </Badge>
                                                            ) : rec.status === "HOLIDAY" || rec.status === "HD" ? (
                                                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300">
                                                                    HOLIDAY
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-[11px] text-muted-foreground">Not Marked</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                                                            {rec.checkInTime ? formatTime12h(rec.checkInTime) : "-"}
                                                        </TableCell>
                                                        <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                                                            {rec.checkOutTime ? formatTime12h(rec.checkOutTime) : "-"}
                                                        </TableCell>
                                                        <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                                                            {rec.markedBy || "-"}
                                                        </TableCell>
                                                        <TableCell className="py-2 px-3 text-xs text-muted-foreground max-w-[200px] truncate">
                                                            {rec.notes || "-"}
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
            </Tabs>
        </div>
    );
}

export default function StaffDirectoryTab() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { canCreate, canUpdate, canDelete } = usePermissions("Staff", "directory");

    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [salaryRevisionOpen, setSalaryRevisionOpen] = useState(false);
    const [salaryRevisionStaff, setSalaryRevisionStaff] = useState(null);
    const [viewingStaff, setViewingStaff] = useState(null);
    const [editingStaff, setEditingStaff] = useState(null);
    const [staffToDelete, setStaffToDelete] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [formTab, setFormTab] = useState("basic");
    const [errors, setErrors] = useState({});
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [idCardPreview, setIdCardPreview] = useState(null);
    const [moduleSearchTerm, setModuleSearchTerm] = useState("");
    const [expandedModules, setExpandedModules] = useState({});

    const photoInputRef = useRef(null);

    const { data: staffList = [], isLoading: staffLoading } = useQuery({
        queryKey: ["staff", roleFilter, statusFilter, searchTerm],
        queryFn: () => {
            const filters = {};
            if (roleFilter === "teaching") {
                filters.isTeaching = true;
                filters.isNonTeaching = false;
            } else if (roleFilter === "non-teaching") {
                filters.isTeaching = false;
                filters.isNonTeaching = true;
            } else if (roleFilter === "dual") {
                filters.isTeaching = true;
                filters.isNonTeaching = true;
            } else if (roleFilter === "supporting") {
                filters.isSupportingStaff = true;
            }
            if (statusFilter && statusFilter !== "all") filters.status = statusFilter;
            if (searchTerm) filters.search = searchTerm;
            return getAllStaff(filters);
        },
    });

    const { data: departments = [] } = useQuery({
        queryKey: ["departments"],
        queryFn: getDepartmentNames,
    });

    const { data: staffIdSettings } = useQuery({
        queryKey: ["staffIdSettings"],
        queryFn: getStaffIdSettingsAPI,
    });

    const createMutation = useMutation({
        mutationFn: createStaffAPI,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff"] });
            queryClient.invalidateQueries({ queryKey: ["teachers"] });
            toast({ title: "Staff created successfully" });
            handleCloseDialog();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => updateStaffAPI(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff"] });
            queryClient.invalidateQueries({ queryKey: ["teachers"] });
            toast({ title: "Staff updated successfully" });
            handleCloseDialog();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteStaffAPI,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff"] });
            queryClient.invalidateQueries({ queryKey: ["teachers"] });
            toast({ title: "Staff deleted successfully" });
            setDeleteOpen(false);
            setStaffToDelete(null);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    useEffect(() => {
        if (editingStaff) return;
        if (!dialogOpen) return;

        const targetDate = formData.joinDate || new Date().toISOString().split("T")[0];

        const timer = setTimeout(async () => {
            try {
                const response = await previewStaffIdAPI({
                    isTeaching: formData.isTeaching,
                    isNonTeaching: formData.isNonTeaching,
                    isSupportingStaff: formData.isSupportingStaff,
                    joinDate: targetDate,
                });
                if (response?.staffId) {
                    setFormData(prev => ({ ...prev, staffId: response.staffId }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        staffId: formatStaffId(prev.staffId || generateStaffIdFromJoinDate(targetDate), prev, staffIdSettings)
                    }));
                }
            } catch {
                setFormData(prev => ({
                    ...prev,
                    staffId: formatStaffId(prev.staffId || generateStaffIdFromJoinDate(targetDate), prev, staffIdSettings)
                }));
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [dialogOpen, editingStaff, formData.joinDate, formData.isTeaching, formData.isNonTeaching, formData.isSupportingStaff, staffIdSettings]);

    useEffect(() => {
        if (!editingStaff || !staffIdSettings) return;
        setFormData(prev => {
            const formatted = formatStaffId(prev.staffId, prev, staffIdSettings);
            if (formatted && formatted !== prev.staffId) {
                return { ...prev, staffId: formatted };
            }
            return prev;
        });
    }, [staffIdSettings, editingStaff]);

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingStaff(null);
        setFormData(initialFormData);
        setPhotoFile(null);
        setPhotoPreview(null);
        setFormTab("basic");
        setErrors({});
        setCompletedSteps(new Set());
        setModuleSearchTerm("");
    };

    const handleOpenCreate = () => {
        setFormData({
            ...initialFormData,
            staffId: formatStaffId(generateStaffIdFromJoinDate(new Date().toISOString().split("T")[0]), initialFormData, staffIdSettings),
        });
        setEditingStaff(null);
        setModuleSearchTerm("");
        setDialogOpen(true);
    };

    const handleOpenEdit = async (staff) => {
        setEditingStaff(staff);
        setFormTab("basic");
        setErrors({});
        setPhotoFile(null);
        setCompletedSteps(new Set([1, 2, 3]));
        setModuleSearchTerm("");

        const applyStaffData = (data) => {
            const savedActions = data.permissions?.actions || data.permissions?.crud || {};
            const savedModules = data.permissions?.modules || [];
            const savedSubModules = data.permissions?.subModules || {};

            const initialActions = {};

            STAFF_PERMISSION_MODULES.forEach((mod) => {
                const childIds = mod.subModules?.map((s) => s.id) || [];
                const modSavedActions = savedActions[mod.label] || savedActions[mod.componentKey] || savedActions[mod.path] || {};

                if (childIds.length > 0) {
                    childIds.forEach((subId) => {
                        const isFeeChallan = mod.label === "Fee Management" && (subId === "challans" || subId === "extra-challans");
                        const isApprovalAction = isApprovalSubmodule(mod.label, subId);
                        const isFinanceClosing = isFinanceClosingSubmodule(mod.label, subId);

                        const isReadOnly = isReadOnlySubmodule(mod.label, subId);
                        if (modSavedActions[subId]) {
                            if (!initialActions[mod.label]) initialActions[mod.label] = {};
                            initialActions[mod.label][subId] = {
                                read: Boolean(modSavedActions[subId].read),
                                create: (isReadOnly || isFinanceClosing) ? false : Boolean(modSavedActions[subId].create),
                                update: (isReadOnly || isFinanceClosing) ? false : Boolean(modSavedActions[subId].update),
                                delete: (isReadOnly || isFinanceClosing) ? false : Boolean(modSavedActions[subId].delete),
                                ...(isFeeChallan ? {
                                    payFee: Boolean(modSavedActions[subId].payFee ?? modSavedActions[subId].pay),
                                    pay: Boolean(modSavedActions[subId].payFee ?? modSavedActions[subId].pay),
                                } : {}),
                                ...(isApprovalAction ? {
                                    approvals: Boolean(modSavedActions[subId].approvals ?? modSavedActions[subId].approve),
                                    approve: Boolean(modSavedActions[subId].approvals ?? modSavedActions[subId].approve),
                                } : {}),
                                ...(isFinanceClosing ? {
                                    closing: Boolean(modSavedActions[subId].closing ?? modSavedActions[subId].close),
                                    close: Boolean(modSavedActions[subId].closing ?? modSavedActions[subId].close),
                                } : {}),
                            };
                        } else {
                            // Backward compatibility: check if subId was previously selected
                            const hasSub = Array.isArray(savedSubModules[mod.label])
                                ? savedSubModules[mod.label].includes(subId)
                                : (Array.isArray(savedSubModules[mod.componentKey])
                                    ? savedSubModules[mod.componentKey].includes(subId)
                                    : savedModules.includes(mod.label) || savedModules.includes(mod.componentKey));
                            if (hasSub) {
                                if (!initialActions[mod.label]) initialActions[mod.label] = {};
                                initialActions[mod.label][subId] = {
                                    read: true,
                                    create: false,
                                    update: false,
                                    delete: false,
                                    ...(isFeeChallan ? { payFee: false, pay: false } : {}),
                                    ...(isApprovalAction ? { approvals: false, approve: false } : {}),
                                    ...(isFinanceClosing ? { closing: false, close: false } : {}),
                                };
                            }
                        }
                    });
                } else {
                    const rootAct = modSavedActions._root || modSavedActions[mod.label] || modSavedActions.ACTIVE || modSavedActions.active || Object.values(modSavedActions)[0];
                    if (rootAct && typeof rootAct === "object") {
                        if (!initialActions[mod.label]) initialActions[mod.label] = {};
                        initialActions[mod.label]._root = {
                            read: Boolean(rootAct.read),
                            create: Boolean(rootAct.create),
                            update: Boolean(rootAct.update),
                            delete: Boolean(rootAct.delete),
                        };
                    } else if (savedModules.includes(mod.label) || savedModules.includes(mod.componentKey)) {
                        if (!initialActions[mod.label]) initialActions[mod.label] = {};
                        initialActions[mod.label]._root = {
                            read: true,
                            create: false,
                            update: false,
                            delete: false,
                        };
                    }
                }
            });

            // Safe date formatting for input[type="date"]
            const formatDate = (val) => {
                if (!val) return "";
                if (typeof val === "string") return val.split("T")[0];
                try {
                    return new Date(val).toISOString().split("T")[0];
                } catch {
                    return "";
                }
            };

            // Safe departmentId extraction whether populated object or string/ObjectId
            const deptId = data.departmentId?._id
                ? String(data.departmentId._id)
                : (data.departmentId?.id
                    ? String(data.departmentId.id)
                    : (data.departmentId && typeof data.departmentId !== "object" ? String(data.departmentId) : ""));

            // Case-insensitive match for employee department
            const matchedEmpDept = EMP_DEPARTMENTS.find(
                (d) => d.toLowerCase() === String(data.empDepartment || "").toLowerCase()
            ) || data.empDepartment || "";

            const hasLeaveSettings = Boolean(
                data.leaveSettings && (
                    data.leaveSettings.sickAllowed != null ||
                    data.leaveSettings.sickDeduction != null ||
                    data.leaveSettings.annualAllowed != null ||
                    data.leaveSettings.annualDeduction != null ||
                    data.leaveSettings.casualAllowed != null ||
                    data.leaveSettings.casualDeduction != null ||
                    data.leaveSettings.absentDeduction != null ||
                    data.leaveSettings.maxLateMinutes != null
                )
            ) || (
                data.sickAllowed != null ||
                data.annualAllowed != null ||
                data.casualAllowed != null ||
                data.absentDeduction != null ||
                data.maxLateMinutes != null
            );

            setFormData({
                staffId: formatStaffId(data.staffId, data, staffIdSettings) || data.staffId || "",
                name: data.name || "",
                fatherName: data.fatherName || "",
                cnic: data.cnic || "",
                email: data.email || "",
                phone: data.phone || "",
                address: data.address || "",
                religion: data.religion || "",
                password: "",
                isTeaching: Boolean(data.isTeaching),
                isNonTeaching: Boolean(data.isNonTeaching),
                isSupportingStaff: Boolean(data.isSupportingStaff),
                staffType: data.staffType ? String(data.staffType).toUpperCase() : "PERMANENT",
                status: data.status ? String(data.status).toUpperCase() : "ACTIVE",
                basicPay: data.basicPay != null ? String(data.basicPay) : "",
                joinDate: formatDate(data.joinDate),
                leaveDate: formatDate(data.leaveDate),
                contractStart: formatDate(data.contractStart),
                contractEnd: formatDate(data.contractEnd),
                specialization: data.specialization || "",
                highestDegree: data.highestDegree || "",
                departmentId: deptId,
                documents: {
                    ...initialFormData.documents,
                    ...(data.documents || {}),
                },
                designation: data.designation || "",
                empDepartment: matchedEmpDept,
                accessRights: data.permissions?.modules || [],
                subModules: data.permissions?.subModules || {},
                actions: initialActions,
                enableLeaveConfig: hasLeaveSettings,
                sickAllowed: data.leaveSettings?.sickAllowed != null
                    ? String(data.leaveSettings.sickAllowed)
                    : (data.sickAllowed != null ? String(data.sickAllowed) : ""),
                sickDeduction: data.leaveSettings?.sickDeduction != null
                    ? String(data.leaveSettings.sickDeduction)
                    : (data.sickDeduction != null ? String(data.sickDeduction) : ""),
                annualAllowed: data.leaveSettings?.annualAllowed != null
                    ? String(data.leaveSettings.annualAllowed)
                    : (data.annualAllowed != null ? String(data.annualAllowed) : ""),
                annualDeduction: data.leaveSettings?.annualDeduction != null
                    ? String(data.leaveSettings.annualDeduction)
                    : (data.annualDeduction != null ? String(data.annualDeduction) : ""),
                casualAllowed: data.leaveSettings?.casualAllowed != null
                    ? String(data.leaveSettings.casualAllowed)
                    : (data.casualAllowed != null ? String(data.casualAllowed) : ""),
                casualDeduction: data.leaveSettings?.casualDeduction != null
                    ? String(data.leaveSettings.casualDeduction)
                    : (data.casualDeduction != null ? String(data.casualDeduction) : ""),
                absentDeduction: data.leaveSettings?.absentDeduction != null
                    ? String(data.leaveSettings.absentDeduction)
                    : (data.absentDeduction != null ? String(data.absentDeduction) : ""),
                maxLateMinutes: data.leaveSettings?.maxLateMinutes != null
                    ? String(data.leaveSettings.maxLateMinutes)
                    : (data.maxLateMinutes != null ? String(data.maxLateMinutes) : ""),
            });

            if (data.photo_url || data.photo) {
                setPhotoPreview(data.photo_url || data.photo);
            } else {
                setPhotoPreview(null);
            }
        };

        // Pre-fill immediately with provided staff object
        applyStaffData(staff);
        setDialogOpen(true);

        // Fetch fresh full data in background to ensure all relations & permissions are 100% current
        const sId = staff.id || staff._id;
        if (sId) {
            try {
                const freshStaff = await getStaffById(sId);
                if (freshStaff) {
                    setEditingStaff(freshStaff);
                    applyStaffData(freshStaff);
                }
            } catch (err) {
                console.error("Failed to fetch fresh staff details for edit:", err);
            }
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const error = validateImageFile(file);
            if (error) {
                setErrors(prev => ({ ...prev, photo: error }));
                e.target.value = "";
                return;
            }
            setErrors(prev => { const next = { ...prev }; delete next.photo; return next; });
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const getModuleChildIds = (module) => module.subModules?.map((subModule) => subModule.id) || [];

    const getSubmoduleActions = (moduleLabel, subModuleKey = "_root") => {
        const mod = formData.actions?.[moduleLabel];
        const current = mod?.[subModuleKey] || {};
        const isFeeChallan = moduleLabel === "Fee Management" && (subModuleKey === "challans" || subModuleKey === "extra-challans");
        const isApprovalAction = isApprovalSubmodule(moduleLabel, subModuleKey);

        return {
            read: Boolean(current.read),
            create: Boolean(current.create),
            update: Boolean(current.update),
            delete: Boolean(current.delete),
            ...(isFeeChallan ? {
                payFee: Boolean(current.payFee ?? current.pay),
                pay: Boolean(current.payFee ?? current.pay),
            } : {}),
            ...(isApprovalAction ? {
                approvals: Boolean(current.approvals ?? current.approve),
                approve: Boolean(current.approvals ?? current.approve),
            } : {}),
            ...current,
        };
    };

    const handleActionToggle = (moduleLabel, subModuleKey, action, checked) => {
        const current = getSubmoduleActions(moduleLabel, subModuleKey);
        let next = { ...current };

        if (action === "read") {
            if (checked) {
                next.read = true;
            } else {
                Object.keys(next).forEach((k) => { next[k] = false; });
                next.read = false;
            }
        } else {
            if (checked) {
                next[action] = true;
                next.read = true; // Auto give read access!
                if (action === "payFee") next.pay = true;
                if (action === "pay") next.payFee = true;
                if (action === "approvals") next.approve = true;
                if (action === "approve") next.approvals = true;
                if (action === "closing") next.close = true;
                if (action === "close") next.closing = true;
            } else {
                next[action] = false;
                if (action === "payFee") next.pay = false;
                if (action === "pay") next.payFee = false;
                if (action === "approvals") next.approve = false;
                if (action === "approve") next.approvals = false;
                if (action === "closing") next.close = false;
                if (action === "close") next.closing = false;
            }
        }

        const isSubActive = Object.values(next).some(Boolean);

        const nextActions = {
            ...(formData.actions || {}),
            [moduleLabel]: {
                ...(formData.actions?.[moduleLabel] || {}),
                [subModuleKey]: next,
            }
        };

        const currentSubs = Array.isArray(formData.subModules?.[moduleLabel])
            ? [...formData.subModules[moduleLabel]]
            : [];
        let nextSubs = currentSubs;

        if (subModuleKey !== "_root") {
            if (isSubActive) {
                if (!nextSubs.includes(subModuleKey)) {
                    nextSubs.push(subModuleKey);
                }
            } else {
                nextSubs = nextSubs.filter((id) => id !== subModuleKey);
            }
        }

        const nextSubModules = { ...(formData.subModules || {}) };
        if (nextSubs.length > 0) {
            nextSubModules[moduleLabel] = nextSubs;
        } else {
            delete nextSubModules[moduleLabel];
        }

        const moduleActions = nextActions[moduleLabel] || {};
        const hasAnyActiveInModule = Object.values(moduleActions).some(
            (s) => s && Object.values(s).some(Boolean)
        );

        let nextAccessRights = formData.accessRights || [];
        if (hasAnyActiveInModule) {
            if (!nextAccessRights.includes(moduleLabel)) {
                nextAccessRights = [...nextAccessRights, moduleLabel];
            }
        } else {
            nextAccessRights = nextAccessRights.filter((lbl) => lbl !== moduleLabel);
        }

        setFormData(prev => ({
            ...prev,
            actions: nextActions,
            subModules: nextSubModules,
            accessRights: nextAccessRights,
        }));
    };

    const handleToggleSubmoduleAll = (moduleLabel, subModuleKey) => {
        const cur = getSubmoduleActions(moduleLabel, subModuleKey);
        const isFeeChallan = moduleLabel === "Fee Management" && (subModuleKey === "challans" || subModuleKey === "extra-challans");
        const isApprovalAction = isApprovalSubmodule(moduleLabel, subModuleKey);
        const isFinanceClosing = isFinanceClosingSubmodule(moduleLabel, subModuleKey);
        const isReadOnly = isReadOnlySubmodule(moduleLabel, subModuleKey);

        const allChecked = isReadOnly
            ? Boolean(cur.read)
            : isFinanceClosing
            ? Boolean(cur.read && (cur.closing || cur.close))
            : (cur.read && cur.create && cur.update && cur.delete
                && (!isFeeChallan || (cur.payFee && cur.pay))
                && (!isApprovalAction || (cur.approvals && cur.approve)));
        const target = !allChecked;

        const next = {
            read: target,
            create: (isReadOnly || isFinanceClosing) ? false : target,
            update: (isReadOnly || isFinanceClosing) ? false : target,
            delete: (isReadOnly || isFinanceClosing) ? false : target,
            ...(isFeeChallan ? { payFee: target, pay: target } : {}),
            ...(isApprovalAction ? { approvals: target, approve: target } : {}),
            ...(isFinanceClosing ? { closing: target, close: target } : {}),
        };

        const nextActions = {
            ...(formData.actions || {}),
            [moduleLabel]: {
                ...(formData.actions?.[moduleLabel] || {}),
                [subModuleKey]: next,
            }
        };

        const currentSubs = Array.isArray(formData.subModules?.[moduleLabel])
            ? [...formData.subModules[moduleLabel]]
            : [];
        let nextSubs = currentSubs;

        if (subModuleKey !== "_root") {
            if (target) {
                if (!nextSubs.includes(subModuleKey)) nextSubs.push(subModuleKey);
            } else {
                nextSubs = nextSubs.filter((id) => id !== subModuleKey);
            }
        }

        const nextSubModules = { ...(formData.subModules || {}) };
        if (nextSubs.length > 0) {
            nextSubModules[moduleLabel] = nextSubs;
        } else {
            delete nextSubModules[moduleLabel];
        }

        const moduleActions = nextActions[moduleLabel] || {};
        const hasAnyActiveInModule = Object.values(moduleActions).some(
            (s) => s && Object.values(s).some(Boolean)
        );

        let nextAccessRights = formData.accessRights || [];
        if (hasAnyActiveInModule) {
            if (!nextAccessRights.includes(moduleLabel)) {
                nextAccessRights = [...nextAccessRights, moduleLabel];
            }
        } else {
            nextAccessRights = nextAccessRights.filter((lbl) => lbl !== moduleLabel);
        }

        setFormData(prev => ({
            ...prev,
            actions: nextActions,
            subModules: nextSubModules,
            accessRights: nextAccessRights,
        }));
    };

    const handleModuleBatch = (module, mode) => {
        // mode: 'full' | 'read' | 'none'
        const childIds = getModuleChildIds(module);
        const keys = childIds.length > 0 ? childIds : ["_root"];

        const newModActions = {};
        keys.forEach((key) => {
            const isFeeChallan = module.label === "Fee Management" && (key === "challans" || key === "extra-challans");
            const isApprovalAction = isApprovalSubmodule(module.label, key);
            const isFinanceClosing = isFinanceClosingSubmodule(module.label, key);
            const isReadOnly = isReadOnlySubmodule(module.label, key);

            if (mode === "full") {
                newModActions[key] = {
                    read: true,
                    create: (!isReadOnly && !isFinanceClosing),
                    update: (!isReadOnly && !isFinanceClosing),
                    delete: (!isReadOnly && !isFinanceClosing),
                    ...(isFeeChallan ? { payFee: true, pay: true } : {}),
                    ...(isApprovalAction ? { approvals: true, approve: true } : {}),
                    ...(isFinanceClosing ? { closing: true, close: true } : {}),
                };
            } else if (mode === "read") {
                newModActions[key] = {
                    read: true,
                    create: false,
                    update: false,
                    delete: false,
                    ...(isFeeChallan ? { payFee: false, pay: false } : {}),
                    ...(isApprovalAction ? { approvals: false, approve: false } : {}),
                    ...(isFinanceClosing ? { closing: false, close: false } : {}),
                };
            } else {
                newModActions[key] = {
                    read: false,
                    create: false,
                    update: false,
                    delete: false,
                    ...(isFeeChallan ? { payFee: false, pay: false } : {}),
                    ...(isApprovalAction ? { approvals: false, approve: false } : {}),
                    ...(isFinanceClosing ? { closing: false, close: false } : {}),
                };
            }
        });

        const nextActions = {
            ...(formData.actions || {}),
            [module.label]: newModActions,
        };

        const nextSubModules = { ...(formData.subModules || {}) };
        if (mode === "none") {
            delete nextSubModules[module.label];
        } else if (childIds.length > 0) {
            nextSubModules[module.label] = childIds;
        }

        let nextAccessRights = formData.accessRights || [];
        if (mode === "none") {
            nextAccessRights = nextAccessRights.filter((lbl) => lbl !== module.label);
        } else {
            if (!nextAccessRights.includes(module.label)) {
                nextAccessRights = [...nextAccessRights, module.label];
            }
        }

        setFormData(prev => ({
            ...prev,
            actions: nextActions,
            subModules: nextSubModules,
            accessRights: nextAccessRights,
        }));
    };

    const handleGrantAll = () => {
        const nextActions = {};
        const nextSubModules = {};
        const nextAccessRights = [];

        STAFF_PERMISSION_MODULES.forEach((mod) => {
            nextAccessRights.push(mod.label);
            const childIds = getModuleChildIds(mod);
            nextActions[mod.label] = {};
            if (childIds.length > 0) {
                nextSubModules[mod.label] = childIds;
                childIds.forEach((subId) => {
                    const isFeeChallan = mod.label === "Fee Management" && (subId === "challans" || subId === "extra-challans");
                    const isApprovalAction = isApprovalSubmodule(mod.label, subId);
                    const isFinanceClosing = isFinanceClosingSubmodule(mod.label, subId);
                    const isReadOnly = isReadOnlySubmodule(mod.label, subId);

                    nextActions[mod.label][subId] = {
                        read: true,
                        create: (!isReadOnly && !isFinanceClosing),
                        update: (!isReadOnly && !isFinanceClosing),
                        delete: (!isReadOnly && !isFinanceClosing),
                        ...(isFeeChallan ? { payFee: true, pay: true } : {}),
                        ...(isApprovalAction ? { approvals: true, approve: true } : {}),
                        ...(isFinanceClosing ? { closing: true, close: true } : {}),
                    };
                });
            } else {
                nextActions[mod.label]._root = { read: true, create: true, update: true, delete: true };
            }
        });

        setFormData(prev => ({
            ...prev,
            actions: nextActions,
            subModules: nextSubModules,
            accessRights: nextAccessRights,
        }));
    };

    const handleRevokeAll = () => {
        setFormData(prev => ({
            ...prev,
            actions: {},
            subModules: {},
            accessRights: [],
        }));
    };

    const toggleModuleExpanded = (label) => {
        setExpandedModules(prev => ({
            ...prev,
            [label]: prev[label] === undefined ? false : !prev[label],
        }));
    };

    const handleExpandAll = () => {
        const exp = {};
        STAFF_PERMISSION_MODULES.forEach((m) => { exp[m.label] = true; });
        setExpandedModules(exp);
    };

    const handleCollapseAll = () => {
        const col = {};
        STAFF_PERMISSION_MODULES.forEach((m) => { col[m.label] = false; });
        setExpandedModules(col);
    };

    const filteredModules = useMemo(() => {
        if (!moduleSearchTerm.trim()) return STAFF_PERMISSION_MODULES;
        const q = moduleSearchTerm.toLowerCase();
        return STAFF_PERMISSION_MODULES.filter((m) => {
            if (m.label.toLowerCase().includes(q)) return true;
            if (m.description?.toLowerCase().includes(q)) return true;
            if (m.subModules?.some((s) => s.label.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))) {
                return true;
            }
            return false;
        });
    }, [moduleSearchTerm]);

    const handleSubmit = () => {
        if (!formData.name?.trim()) {
            toast({ title: "Name is required", variant: "destructive" });
            return;
        }
        if (!formData.isTeaching && !formData.isNonTeaching && !formData.isSupportingStaff) {
            toast({ title: "Select at least one role", description: "Staff must be Teaching, Non-Teaching, or Supporting Staff", variant: "destructive" });
            return;
        }
        if (!formData.isSupportingStaff && !editingStaff && !formData.password) {
            toast({ title: "Password is required for new staff", variant: "destructive" });
            return;
        }
        const allErrors = {
            ...validateCurrentTab("basic", formData, !!editingStaff),
            ...validateCurrentTab("employment", formData, !!editingStaff),
            ...validateCurrentTab("roles", formData, !!editingStaff),
            ...validateCurrentTab("account", formData, !!editingStaff),
            photo: validateImageFile(photoFile),
        };
        Object.keys(allErrors).forEach((key) => {
            if (!allErrors[key]) delete allErrors[key];
        });
        if (Object.keys(allErrors).length > 0) {
            setErrors(allErrors);
            toast({ title: "Validation Error", description: "Please fix the highlighted fields.", variant: "destructive" });
            return;
        }

        const excludedKeys = new Set([
            "documents",
            "accessRights",
            "subModules",
            "actions",
            "enableLeaveConfig",
            "sickAllowed",
            "sickDeduction",
            "annualAllowed",
            "annualDeduction",
            "casualAllowed",
            "casualDeduction",
            "absentDeduction",
            "maxLateMinutes",
        ]);

        const submitData = new FormData();

        Object.keys(formData).forEach((key) => {
            if (excludedKeys.has(key)) {
                // Handled separately below
            } else if (key === "password" && !formData[key]) {
                // Skip empty password on edit
            } else if (key === "departmentId") {
                submitData.append(key, formData[key] === "" || formData[key] === "none" ? "" : formData[key]);
            } else {
                const value = formData[key];
                if (value !== "" || key === "name") {
                    submitData.append(key, value);
                }
            }
        });

        submitData.append("permissions", JSON.stringify({
            modules: formData.accessRights || [],
            subModules: formData.subModules || {},
            actions: formData.actions || {},
            crud: formData.actions || {},
        }));
        submitData.append("documents", JSON.stringify(formData.documents));
        submitData.append("sickAllowed", formData.enableLeaveConfig ? (formData.sickAllowed || "0") : "0");
        submitData.append("sickDeduction", formData.enableLeaveConfig ? (formData.sickDeduction || "0") : "0");
        submitData.append("annualAllowed", formData.enableLeaveConfig ? (formData.annualAllowed || "0") : "0");
        submitData.append("annualDeduction", formData.enableLeaveConfig ? (formData.annualDeduction || "0") : "0");
        submitData.append("casualAllowed", formData.enableLeaveConfig ? (formData.casualAllowed || "0") : "0");
        const calculatedAbsentFine = formData.basicPay ? String(Math.round(Number(formData.basicPay) / 30)) : (formData.absentDeduction || "0");
        submitData.append("absentDeduction", calculatedAbsentFine);
        submitData.append("maxLateMinutes", formData.enableLeaveConfig ? (formData.maxLateMinutes || "0") : "0");

        if (photoFile) {
            submitData.append("photo", photoFile);
        } else if (!photoPreview && (editingStaff?.photo_url || editingStaff?.photo)) {
            submitData.append("removePhoto", "true");
            submitData.append("photo_url", "");
        }

        if (editingStaff) {
            updateMutation.mutate({ id: editingStaff.id, data: submitData });
        } else {
            createMutation.mutate(submitData);
        }
    };

    const handleConfirmDelete = () => {
        if (!staffToDelete) return;
        deleteMutation.mutate(staffToDelete.id);
    };

    const formTabs = useMemo(() => {
        return formData.isSupportingStaff
            ? ["basic", "employment", "roles", "account"]
            : ["basic", "employment", "roles", "account", "details"];
    }, [formData.isSupportingStaff]);

    const currentStepLabels = useMemo(() => {
        return formData.isSupportingStaff
            ? ["Basic Info", "Employment", "Roles", "Account"]
            : ["Basic Info", "Employment", "Roles", "Account", "Role Details"];
    }, [formData.isSupportingStaff]);

    const tabToStep = useMemo(() => {
        const map = {};
        formTabs.forEach((tab, idx) => {
            map[tab] = idx + 1;
        });
        return map;
    }, [formTabs]);

    const stepToTab = useMemo(() => {
        const map = {};
        formTabs.forEach((tab, idx) => {
            map[idx + 1] = tab;
        });
        return map;
    }, [formTabs]);

    const handleNext = () => {
        const tabErrors = validateCurrentTab(formTab, formData, !!editingStaff);
        if (Object.keys(tabErrors).length > 0) {
            setErrors(tabErrors);
            return;
        }
        setErrors({});
        const idx = formTabs.indexOf(formTab);
        if (idx < formTabs.length - 1) {
            setCompletedSteps(prev => new Set([...prev, idx + 1]));
            setFormTab(formTabs[idx + 1]);
        }
    };

    const handleStepClick = (step) => {
        const currentStep = tabToStep[formTab] || 1;
        if (step === currentStep) return;
        if (step < currentStep) {
            setErrors({});
            setCompletedSteps(prev => {
                const next = new Set(prev);
                for (let s = step; s <= formTabs.length; s++) next.delete(s);
                return next;
            });
            setFormTab(stepToTab[step] || "basic");
        } else {
            const tabErrors = validateCurrentTab(formTab, formData, !!editingStaff);
            if (Object.keys(tabErrors).length > 0) {
                setErrors(tabErrors);
                return;
            }
            setErrors({});
            setCompletedSteps(prev => new Set([...prev, currentStep]));
            setFormTab(stepToTab[step] || "basic");
        }
    };

    const getRoleBadges = (staff) => {
        const badges = [];
        if (staff.isTeaching) {
            badges.push(
                <Badge key="teaching" className="bg-blue-500 hover:bg-blue-600 text-white">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    Teaching
                </Badge>
            );
        }
        if (staff.isNonTeaching) {
            badges.push(
                <Badge key="non-teaching" className="bg-purple-500 hover:bg-purple-600 text-white">
                    <Briefcase className="w-3 h-3 mr-1" />
                    Non-Teaching
                </Badge>
            );
        }
        if (staff.isSupportingStaff) {
            badges.push(
                <Badge key="supporting" className="bg-amber-600 hover:bg-amber-700 text-white">
                    <HeartHandshake className="w-3 h-3 mr-1" />
                    Supporting Staff
                </Badge>
            );
        }
        return badges;
    };

    const getStatusBadge = (status) => {
        const colors = {
            ACTIVE: "bg-green-500",
            TERMINATED: "bg-red-500",
            RETIRED: "bg-gray-500",
        };
        return (
            <Badge className={`${colors[status] || "bg-gray-500"} text-white`}>
                {status}
            </Badge>
        );
    };

    const handleViewIdCard = async (staff) => {
        try {
            const template = await getDefaultStaffIDCardTemplate();
            if (!template?.htmlContent) {
                toast({ title: "No default ID card template found", description: "Please set a default template in Configuration > Templates", variant: "destructive" });
                return;
            }
            const isTeacher = staff.isTeaching && !staff.isNonTeaching;
            const empId = formatStaffId(staff.staffId || staff.employeeId || staff.employee_id || staff.id, staff, staffIdSettings) || staff.staffId || "";
            const html = template.htmlContent
                .replace(/\{\{name\}\}/gi, staff.name || "")
                .replace(/\{\{designation\}\}/gi, staff.isTeaching ? (staff.specialization || "Teacher") : (staff.designation || "Staff"))
                .replace(/\{\{employeeId\}\}/gi, String(empId))
                .replace(/\{\{staffId\}\}/gi, String(empId))
                .replace(/\{\{empId\}\}/gi, String(empId))
                .replace(/\{\{employee_id\}\}/gi, String(empId))
                .replace(/\{\{fatherName\}\}/gi, staff.fatherName || "")
                .replace(/\{\{phone\}\}/gi, staff.phone || "")
                .replace(/\{\{cnic\}\}/gi, staff.cnic || "")
                .replace(/\{\{email\}\}/gi, staff.email || "")
                .replace(/\{\{address\}\}/gi, staff.address || "")
                .replace(/\{\{department\}\}/gi, staff.department?.name || staff.departmentName || "")
                .replace(/\{\{employeePhoto\}\}/gi, resolveFileUrl(staff.photo_url || staff.photo || ""))
                .replace(/\{\{issueDate\}\}/gi, new Date().toLocaleDateString())
                .replace(/\{\{EmpOrTeacher\}\}/gi, isTeacher ? "TEACHER" : "EMPLOYEE")
                .replace(/\{\{dob\}\}/gi, staff.dob ? new Date(staff.dob).toLocaleDateString() : "")
                .replace(/\{\{bloodGroup\}\}/gi, staff.bloodGroup || "");
            setIdCardPreview({ html, staffName: staff.name });
        } catch (err) {
            toast({ title: "Failed to load ID card template", description: err.message, variant: "destructive" });
        }
    };

    if (viewingStaff) {
        return (
            <>
                <StaffDetailView
                    staffId={viewingStaff.id}
                    onBack={() => setViewingStaff(null)}
                    onEdit={() => {
                        handleOpenEdit(viewingStaff);
                        setViewingStaff(null);
                    }}
                    onReviseSalary={(s) => {
                        setSalaryRevisionStaff(s || viewingStaff);
                        setSalaryRevisionOpen(true);
                    }}
                    onViewIdCard={(s) => handleViewIdCard(s || viewingStaff)}
                    canUpdate={canUpdate}
                />
                <SalaryRevisionDialog
                    open={salaryRevisionOpen}
                    onOpenChange={setSalaryRevisionOpen}
                    staff={salaryRevisionStaff}
                />
            </>
        );
    }

    return (
        <div className="space-y-6">
            {canCreate && (
                <div className="flex justify-end">
                    <Button onClick={handleOpenCreate} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Staff
                    </Button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                <Card className={`cursor-pointer hover:shadow-md transition-shadow ${roleFilter === "all" ? "ring-2 ring-primary" : ""}`} onClick={() => setRoleFilter("all")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Staff</p>
                                <p className="text-2xl font-bold">{staffList.length}</p>
                            </div>
                            <Users className="w-8 h-8 text-primary opacity-80" />
                        </div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:shadow-md transition-shadow ${roleFilter === "teaching" ? "ring-2 ring-blue-500" : ""}`} onClick={() => setRoleFilter("teaching")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Teaching</p>
                                <p className="text-2xl font-bold">
                                    {staffList.filter((s) => s.isTeaching && !s.isNonTeaching).length}
                                </p>
                            </div>
                            <GraduationCap className="w-8 h-8 text-blue-500 opacity-80" />
                        </div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:shadow-md transition-shadow ${roleFilter === "non-teaching" ? "ring-2 ring-purple-500" : ""}`} onClick={() => setRoleFilter("non-teaching")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Non-Teaching</p>
                                <p className="text-2xl font-bold">
                                    {staffList.filter((s) => s.isNonTeaching && !s.isTeaching).length}
                                </p>
                            </div>
                            <Briefcase className="w-8 h-8 text-purple-500 opacity-80" />
                        </div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:shadow-md transition-shadow ${roleFilter === "dual" ? "ring-2 ring-orange-500" : ""}`} onClick={() => setRoleFilter("dual")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Dual Role</p>
                                <p className="text-2xl font-bold">
                                    {staffList.filter((s) => s.isTeaching && s.isNonTeaching).length}
                                </p>
                            </div>
                            <UserCog className="w-8 h-8 text-orange-500 opacity-80" />
                        </div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:shadow-md transition-shadow ${roleFilter === "supporting" ? "ring-2 ring-amber-500" : ""}`} onClick={() => setRoleFilter("supporting")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Supporting</p>
                                <p className="text-2xl font-bold">
                                    {staffList.filter((s) => s.isSupportingStaff).length}
                                </p>
                            </div>
                            <HeartHandshake className="w-8 h-8 text-amber-500 opacity-80" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    name="staff-directory-search"
                                    autoComplete="off"
                                    placeholder="Search by name, email, CNIC..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="teaching">Teaching Only</SelectItem>
                                <SelectItem value="non-teaching">Non-Teaching Only</SelectItem>
                                <SelectItem value="dual">Dual Role</SelectItem>
                                <SelectItem value="supporting">Supporting Staff Only</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {STAFF_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Staff Table */}
            <Card>
                <CardContent className="pt-6">
                    {staffLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : staffList.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No staff members found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Staff</TableHead>
                                    <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm hidden sm:table-cell">Role</TableHead>
                                    <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm hidden md:table-cell">Contact</TableHead>
                                    <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Position / Dept</TableHead>
                                    <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm">Status</TableHead>
                                    <TableHead className="py-2 px-2 sm:px-3 text-xs sm:text-sm text-right hidden md:table-cell">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {staffList.map((staff) => (
                                    <TableRow
                                        key={staff.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted/80"
                                        onClick={() => setViewingStaff(staff)}
                                    >
                                        <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-7 w-7 sm:h-9 sm:w-9 shrink-0">
                                                    <AvatarImage src={resolveFileUrl(staff.photo_url || staff.photo)} alt={staff.name} />
                                                    <AvatarFallback className="text-[10px] sm:text-xs">
                                                        {staff.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{staff.name}</p>
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">{formatStaffId(staff.staffId, staff, staffIdSettings) || staff.staffId || "No ID"}</p>
                                                    <div className="flex sm:hidden gap-1 mt-0.5">{getRoleBadges(staff)}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm hidden sm:table-cell">
                                            <div className="flex flex-wrap gap-1">{getRoleBadges(staff)}</div>
                                        </TableCell>
                                        <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm hidden md:table-cell">
                                            <div className="space-y-0.5">
                                                {staff.email && (
                                                    <p className="text-xs flex items-center gap-1 truncate max-w-[160px]">
                                                        <Mail className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{staff.email}</span>
                                                    </p>
                                                )}
                                                {staff.phone && (
                                                    <p className="text-xs flex items-center gap-1 text-muted-foreground">
                                                        <Phone className="w-3 h-3 shrink-0" />
                                                        <span>{staff.phone}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm">
                                            <div className="min-w-0">
                                                {staff.designation && (
                                                    <p className="font-medium truncate text-xs sm:text-sm">{staff.designation}</p>
                                                )}
                                                {staff.isTeaching && (
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                                        {staff.department?.name || "No Dept"} {staff.specialization ? `(${staff.specialization})` : ""}
                                                    </p>
                                                )}
                                                {staff.isNonTeaching && !staff.isTeaching && (
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{staff.empDepartment?.replace("_", " ")}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm">{getStatusBadge(staff.status)}</TableCell>
                                        <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm text-right hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => handleViewIdCard(staff)}
                                                        >
                                                            <IdCard className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>ID Card</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => setViewingStaff(staff)}
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>View</TooltipContent>
                                                </Tooltip>
                                                {canUpdate && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                                                onClick={() => {
                                                                    setSalaryRevisionStaff(staff);
                                                                    setSalaryRevisionOpen(true);
                                                                }}
                                                            >
                                                                <TrendingUp className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Salary Revision</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {canUpdate && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => handleOpenEdit(staff)}
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Edit</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {canDelete && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => {
                                                                    setStaffToDelete(staff);
                                                                    setDeleteDialogOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Delete</TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* ID Card Preview Dialog */}
            <Dialog open={!!idCardPreview} onOpenChange={() => setIdCardPreview(null)}>
                <DialogContent className="max-w-fit max-h-[90vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>ID Card — {idCardPreview?.staffName}</DialogTitle>
                    </DialogHeader>
                    <div dangerouslySetInnerHTML={{ __html: idCardPreview?.html || "" }} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIdCardPreview(null)}>Close</Button>
                        <Button onClick={() => {
                            const win = window.open("", "_blank");
                            win.document.write(`<html><head><title>ID Card</title></head><body style="margin:0;padding:20px;">${idCardPreview?.html}</body></html>`);
                            win.document.close();
                            win.focus();
                            win.print();
                            win.close();
                        }}>Print</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
                        </DialogTitle>
                        <DialogDescription>
                            Fill in the details below. Staff can have teaching, non-teaching, or both roles.
                        </DialogDescription>
                    </DialogHeader>

                    <div>
                        <Label>Staff ID <span className="text-xs text-muted-foreground ml-1">Auto Generated (Prefix + YYMM + 2 digits)</span></Label>
                        <Input
                            value={formData.staffId || ""}
                            readOnly
                            disabled
                            placeholder="Auto-generated from prefix & join date"
                            className="bg-muted/40 font-mono font-medium"
                        />
                    </div>

                    <Tabs value={formTab} onValueChange={setFormTab}>
                        <StepIndicator
                            currentStep={tabToStep[formTab] || 1}
                            completedSteps={completedSteps}
                            onStepClick={handleStepClick}
                            stepLabels={currentStepLabels}
                        />

                        <TabsContent value="basic" className="space-y-4 mt-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20 cursor-pointer" onClick={() => photoInputRef.current?.click()}>
                                    <AvatarImage src={resolveFileUrl(photoPreview)} />
                                    <AvatarFallback className="bg-muted">
                                        <Upload className="w-6 h-6 text-muted-foreground" />
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => photoInputRef.current?.click()}
                                        >
                                            Upload Photo
                                        </Button>
                                        {photoPreview && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    setPhotoFile(null);
                                                    setPhotoPreview(null);
                                                    if (photoInputRef.current) photoInputRef.current.value = "";
                                                    setErrors(prev => { const next = { ...prev }; delete next.photo; return next; });
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, JPEG. Max 10MB</p>
                                    <FieldError message={errors.photo} />
                                </div>
                                <input
                                    ref={photoInputRef}
                                    type="file"
                                    accept={IMAGE_UPLOAD_RULES.accept}
                                    className="hidden"
                                    onChange={handlePhotoChange}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Name <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => {
                                            setFormData({ ...formData, name: e.target.value });
                                            setErrors(prev => { const next = {...prev}; delete next.name; return next; });
                                        }}
                                        placeholder="Full Name"
                                        className={errors.name ? "border-destructive" : ""}
                                    />
                                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                                </div>
                                <div>
                                    <Label>Father's Name <span className="text-xs text-muted-foreground ml-1">Optional</span></Label>
                                    <Input
                                        value={formData.fatherName}
                                        onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                                        placeholder="Father's Name"
                                    />
                                </div>
                                <div>
                                    <Label>CNIC <span className="text-xs text-muted-foreground ml-1">Optional</span></Label>
                                    <Input
                                        value={formData.cnic}
                                        onChange={(e) => setFormData({ ...formData, cnic: formatCnic(e.target.value) })}
                                        placeholder="12345-1234567-1"
                                        className={errors.cnic ? "border-destructive" : ""}
                                    />
                                    <FieldError message={errors.cnic} />
                                </div>
                                <div>
                                    <Label>Phone <span className="text-xs text-muted-foreground ml-1">Optional</span></Label>
                                    <Input
                                        autoComplete="off"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="03001234567"
                                        className={errors.phone ? "border-destructive" : ""}
                                    />
                                    <FieldError message={errors.phone} />
                                </div>
                                <div>
                                    <Label>Religion <span className="text-xs text-muted-foreground ml-1">Optional</span></Label>
                                    <Input
                                        value={formData.religion}
                                        onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                                        placeholder="e.g. Islam, Christianity"
                                    />
                                </div>
                                <div>
                                    <Label>Designation <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                    <Input
                                        value={formData.designation}
                                        onChange={(e) => {
                                            setFormData({ ...formData, designation: e.target.value });
                                            setErrors(prev => { const next = {...prev}; delete next.designation; return next; });
                                        }}
                                        placeholder="e.g., Office Manager, Principal, Security Guard"
                                        className={errors.designation ? "border-destructive" : ""}
                                    />
                                    {errors.designation && <p className="text-xs text-destructive mt-1">{errors.designation}</p>}
                                </div>
                            </div>
                            <div>
                                <Label>Address <span className="text-xs text-muted-foreground ml-1">Optional</span></Label>
                                <Input
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Full Address"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="employment" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Staff Type <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                    <Select
                                        value={formData.staffType}
                                        onValueChange={(value) => {
                                            setFormData({ ...formData, staffType: value });
                                            setErrors(prev => { const next = {...prev}; delete next.staffType; return next; });
                                        }}
                                    >
                                        <SelectTrigger className={errors.staffType ? "border-destructive" : ""}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STAFF_TYPES.map((t) => (
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.staffType && <p className="text-xs text-destructive mt-1">{errors.staffType}</p>}
                                </div>
                                <div>
                                    <Label>Status <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(value) => {
                                            setFormData({ ...formData, status: value });
                                            setErrors(prev => { const next = {...prev}; delete next.status; return next; });
                                        }}
                                    >
                                        <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STAFF_STATUSES.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.status && <p className="text-xs text-destructive mt-1">{errors.status}</p>}
                                </div>
                                <div>
                                    <Label>Basic Pay (PKR) <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                    <Input
                                        type="number"
                                        value={formData.basicPay}
                                        onChange={(e) => {
                                            setFormData({ ...formData, basicPay: e.target.value });
                                            setErrors(prev => { const next = {...prev}; delete next.basicPay; return next; });
                                        }}
                                        placeholder="50000"
                                        className={errors.basicPay ? "border-destructive" : ""}
                                    />
                                    {errors.basicPay && <p className="text-xs text-destructive mt-1">{errors.basicPay}</p>}
                                </div>
                                <div>
                                    <Label>Join Date <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.joinDate}
                                        onChange={(e) => {
                                            const newJoinDate = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                joinDate: newJoinDate,
                                                staffId: editingStaff ? prev.staffId : formatStaffId(generateStaffIdFromJoinDate(newJoinDate, prev.staffId), prev, staffIdSettings)
                                            }));
                                            setErrors(prev => { const next = {...prev}; delete next.joinDate; return next; });
                                        }}
                                        className={errors.joinDate ? "border-destructive" : ""}
                                    />
                                    {errors.joinDate && <p className="text-xs text-destructive mt-1">{errors.joinDate}</p>}
                                </div>
                                {formData.staffType === "CONTRACT" && (
                                    <>
                                        <div>
                                            <Label>Contract Start <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                            <Input
                                                type="date"
                                                value={formData.contractStart}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, contractStart: e.target.value });
                                                    setErrors(prev => { const next = {...prev}; delete next.contractStart; return next; });
                                                }}
                                                className={errors.contractStart ? "border-destructive" : ""}
                                            />
                                            {errors.contractStart && <p className="text-xs text-destructive mt-1">{errors.contractStart}</p>}
                                        </div>
                                        <div>
                                            <Label>Contract End <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                            <Input
                                                type="date"
                                                value={formData.contractEnd}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, contractEnd: e.target.value });
                                                    setErrors(prev => { const next = {...prev}; delete next.contractEnd; return next; });
                                                }}
                                                className={errors.contractEnd ? "border-destructive" : ""}
                                            />
                                            {errors.contractEnd && <p className="text-xs text-destructive mt-1">{errors.contractEnd}</p>}
                                        </div>
                                    </>
                                )}
                                {(formData.status === "TERMINATED" || formData.status === "RETIRED") && (
                                    <div>
                                        <Label>Leave Date <span className="text-xs text-muted-foreground ml-1">Required</span></Label>
                                        <Input
                                            type="date"
                                            value={formData.leaveDate}
                                            onChange={(e) => {
                                                setFormData({ ...formData, leaveDate: e.target.value });
                                                setErrors(prev => { const next = {...prev}; delete next.leaveDate; return next; });
                                            }}
                                            className={errors.leaveDate ? "border-destructive" : ""}
                                        />
                                        {errors.leaveDate && <p className="text-xs text-destructive mt-1">{errors.leaveDate}</p>}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 space-y-3">
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold">Configure Leave Policy</p>
                                            <Badge variant="outline" className="text-[10px] font-normal">Optional</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Define allowed leave days, deduction rates (leaves & absent), and maximum allowed late arrival minutes.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.enableLeaveConfig}
                                        onCheckedChange={(checked) => setFormData({ ...formData, enableLeaveConfig: checked })}
                                    />
                                </div>

                                {formData.enableLeaveConfig && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {[
                                                { label: "Sick", allowedKey: "sickAllowed", deductionKey: "sickDeduction" },
                                                { label: "Annual", allowedKey: "annualAllowed", deductionKey: "annualDeduction" },
                                                { label: "Casual", allowedKey: "casualAllowed", deductionKey: "casualDeduction" },
                                            ].map(({ label, allowedKey, deductionKey }) => (
                                                <div key={label} className="border rounded-lg p-3 space-y-3 bg-card">
                                                    <p className="text-sm font-medium">{label} Leave</p>
                                                    <div>
                                                        <Label className="text-xs text-muted-foreground">Allowed Days <span className="text-xs text-muted-foreground ml-1">Optional</span></Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={formData[allowedKey]}
                                                            onChange={(e) => setFormData({ ...formData, [allowedKey]: e.target.value })}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-muted-foreground">Deduction per Extra Day (PKR) <span className="text-xs text-muted-foreground ml-1">Optional</span></Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={formData[deductionKey]}
                                                            onChange={(e) => setFormData({ ...formData, [deductionKey]: e.target.value })}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Absent & Late Arrival Policy */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                            <div className="border rounded-lg p-3 space-y-3 bg-card">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-sm font-medium">Deduction Amount per Absent</p>
                                                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                                                            Auto-calculated
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Daily fine deducted during monthly payroll calculation (Salary / 30)
                                                    </p>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">
                                                        Absent Fine (PKR / Day)
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        readOnly
                                                        disabled
                                                        value={formData.basicPay ? Math.round(Number(formData.basicPay) / 30) : (formData.absentDeduction || "0")}
                                                        className="bg-muted cursor-not-allowed font-medium text-foreground"
                                                    />
                                                    <p className="text-[11px] text-muted-foreground mt-1">
                                                        Auto-generated as Salary / 30 (1 day absent fine). Not editable.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="border rounded-lg p-3 space-y-3 bg-card">
                                                <div>
                                                    <p className="text-sm font-medium">Maximum Allowed Late Arrival</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Allowed grace threshold before arrival is counted as Late in attendance
                                                    </p>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">
                                                        Max Late Arrival (Minutes) <span className="text-xs text-muted-foreground ml-1">Optional</span>
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={formData.maxLateMinutes}
                                                        onChange={(e) => setFormData({ ...formData, maxLateMinutes: e.target.value })}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="roles" className="space-y-6 mt-4">
                            <div className="space-y-4">
                                <p className="text-xs text-muted-foreground">Select the staff member's role category below.</p>
                                <div className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                                    formData.isSupportingStaff ? "opacity-50 cursor-not-allowed bg-muted/20" : ""
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <GraduationCap className="w-6 h-6 text-blue-500" />
                                        <div>
                                            <p className="font-medium">Teaching Role</p>
                                            <p className="text-sm text-muted-foreground">
                                                Can be assigned to classes and subjects
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        disabled={formData.isSupportingStaff}
                                        checked={formData.isTeaching}
                                        onCheckedChange={(checked) => {
                                            const nextRoles = {
                                                isTeaching: checked,
                                                isNonTeaching: formData.isNonTeaching,
                                                isSupportingStaff: checked ? false : formData.isSupportingStaff,
                                            };
                                            const updatedStaffId = formatStaffId(formData.staffId, nextRoles, staffIdSettings);
                                            setFormData((prev) => ({
                                                ...prev,
                                                ...nextRoles,
                                                staffId: updatedStaffId || prev.staffId,
                                            }));
                                            setErrors((prev) => {
                                                const next = { ...prev };
                                                delete next.roles;
                                                return next;
                                            });
                                        }}
                                    />
                                </div>

                                <div className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                                    formData.isSupportingStaff ? "opacity-50 cursor-not-allowed bg-muted/20" : ""
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <Briefcase className="w-6 h-6 text-purple-500" />
                                        <div>
                                            <p className="font-medium">Non-Teaching Role</p>
                                            <p className="text-sm text-muted-foreground">
                                                Administrative or operational staff with system permissions
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        disabled={formData.isSupportingStaff}
                                        checked={formData.isNonTeaching}
                                        onCheckedChange={(checked) => {
                                            const nextRoles = {
                                                isTeaching: formData.isTeaching,
                                                isNonTeaching: checked,
                                                isSupportingStaff: checked ? false : formData.isSupportingStaff,
                                            };
                                            const updatedStaffId = formatStaffId(formData.staffId, nextRoles, staffIdSettings);
                                            setFormData((prev) => ({
                                                ...prev,
                                                ...nextRoles,
                                                staffId: updatedStaffId || prev.staffId,
                                            }));
                                            setErrors((prev) => {
                                                const next = { ...prev };
                                                delete next.roles;
                                                return next;
                                            });
                                        }}
                                    />
                                </div>

                                <div className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                                    formData.isSupportingStaff ? "bg-amber-50/60 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800" : ""
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <HeartHandshake className="w-6 h-6 text-amber-500" />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">Supporting Staff</p>
                                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                                                    No Portal Login Required
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Ground staff, drivers, janitors, guards, cafeteria & maintenance. Cannot have Teaching or Non-Teaching roles, and skips Role Details configuration.
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={formData.isSupportingStaff}
                                        onCheckedChange={(checked) => {
                                            const nextRoles = {
                                                isSupportingStaff: checked,
                                                isTeaching: checked ? false : formData.isTeaching,
                                                isNonTeaching: checked ? false : formData.isNonTeaching,
                                            };
                                            const updatedStaffId = formatStaffId(formData.staffId, nextRoles, staffIdSettings);
                                            setFormData((prev) => ({
                                                ...prev,
                                                ...nextRoles,
                                                staffId: updatedStaffId || prev.staffId,
                                            }));
                                            setErrors((prev) => {
                                                const next = { ...prev };
                                                delete next.roles;
                                                return next;
                                            });
                                        }}
                                    />
                                </div>

                                {!formData.isTeaching && !formData.isNonTeaching && !formData.isSupportingStaff && (
                                    <p className="text-sm text-red-500 text-center">
                                        Please select at least one role
                                    </p>
                                )}
                                {errors.roles && <p className="text-xs text-destructive mt-1">{errors.roles}</p>}
                            </div>
                        </TabsContent>

                        <TabsContent value="account" className="space-y-6 mt-4">
                            <div className="p-4 border rounded-lg bg-card space-y-4">
                                <div>
                                    <h4 className="font-semibold text-base flex items-center gap-2">
                                        <KeyRound className="w-5 h-5 text-primary" />
                                        Portal Login & Credentials
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formData.isSupportingStaff
                                            ? "Supporting staff typically do not require system login credentials. Email and password are not required. You may leave them empty or provide them if portal access is needed."
                                            : "Configure system login credentials. Teaching and non-teaching staff require a registered email and password to log in to the portal."}
                                    </p>
                                </div>

                                {formData.isSupportingStaff ? (
                                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                        <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>
                                            <strong>Supporting Staff Selected:</strong> Login credentials are optional. If no email and password are provided, no user login account will be generated.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                                        <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>
                                            <strong>Required Credentials:</strong> An active email address and secure password are required for staff authentication.
                                        </span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <Label>
                                            Email Address
                                            {formData.isSupportingStaff ? (
                                                <span className="text-xs text-muted-foreground ml-1">Optional</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground ml-1">Required</span>
                                            )}
                                        </Label>
                                        <Input
                                            type="email"
                                            autoComplete="off"
                                            value={formData.email}
                                            onChange={(e) => {
                                                setFormData({ ...formData, email: e.target.value });
                                                setErrors((prev) => {
                                                    const next = { ...prev };
                                                    delete next.email;
                                                    return next;
                                                });
                                            }}
                                            placeholder="email@example.com"
                                            className={errors.email ? "border-destructive" : ""}
                                        />
                                        {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                                    </div>

                                    <div>
                                        <Label>
                                            {editingStaff ? "New Password" : "Password"}
                                            {formData.isSupportingStaff ? (
                                                <span className="text-xs text-muted-foreground ml-1">Optional</span>
                                            ) : !editingStaff ? (
                                                <span className="text-xs text-muted-foreground ml-1">Required</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground ml-1">Optional</span>
                                            )}
                                        </Label>
                                        <PasswordInput
                                            autoComplete="off"
                                            value={formData.password}
                                            onChange={(e) => {
                                                setFormData({ ...formData, password: e.target.value });
                                                setErrors((prev) => {
                                                    const next = { ...prev };
                                                    delete next.password;
                                                    return next;
                                                });
                                            }}
                                            placeholder={editingStaff ? "Leave blank to keep current" : (formData.isSupportingStaff ? "Optional password" : "Password")}
                                            className={errors.password ? "border-destructive" : ""}
                                        />
                                        {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="details" className="space-y-4 mt-4">
                            {formData.isTeaching && (
                                <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
                                    <h4 className="font-medium flex items-center gap-2">
                                        <GraduationCap className="w-4 h-4 text-blue-500" />
                                        Teaching Details
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Specialization</Label>
                                            <Input
                                                value={formData.specialization}
                                                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                                placeholder="e.g., Computer Science"
                                            />
                                        </div>
                                        <div>
                                            <Label>Highest Degree</Label>
                                            <Input
                                                value={formData.highestDegree}
                                                onChange={(e) => setFormData({ ...formData, highestDegree: e.target.value })}
                                                placeholder="e.g., PhD, MS"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Label>Department</Label>
                                            <Select
                                                value={formData.departmentId}
                                                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Department" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60 overflow-y-auto">
                                                    {departments.map((d) => {
                                                        const dId = String(d.id || d._id || "");
                                                        return <SelectItem key={dId} value={dId}>{d.name}</SelectItem>;
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Documents</Label>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            {STAFF_DOCUMENTS.map((doc) => (
                                                <label key={doc.key} className="flex items-center gap-2 text-sm">
                                                    <Checkbox
                                                        checked={formData.documents[doc.key]}
                                                        onCheckedChange={(checked) =>
                                                            setFormData({
                                                                ...formData,
                                                                documents: { ...formData.documents, [doc.key]: checked },
                                                            })
                                                        }
                                                    />
                                                    {doc.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formData.isNonTeaching && (
                                <div className="space-y-4 p-4 border rounded-lg bg-purple-50/50">
                                    <h4 className="font-medium flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-purple-500" />
                                        Non-Teaching Details
                                    </h4>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <Label>Linked Department (Report FK)</Label>
                                            <Select
                                                value={formData.departmentId || "none"}
                                                onValueChange={(value) =>
                                                    setFormData({
                                                        ...formData,
                                                        departmentId: value === "none" ? "" : value,
                                                    })
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Department (optional)" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60 overflow-y-auto">
                                                    <SelectItem value="none">Not linked</SelectItem>
                                                    {departments.map((d) => {
                                                        const dId = String(d.id || d._id || "");
                                                        return <SelectItem key={dId} value={dId}>{d.name}</SelectItem>;
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Employee Department</Label>
                                            <Select
                                                value={formData.empDepartment}
                                                onValueChange={(value) => setFormData({ ...formData, empDepartment: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Department" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60 overflow-y-auto">
                                                    {EMP_DEPARTMENTS.map((d) => (
                                                        <SelectItem key={d} value={d}>{d.replace("_", " ")}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="pt-2 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <Label className="text-base font-semibold flex items-center gap-2">
                                                    <Shield className="w-4 h-4 text-orange-500" />
                                                    System Access Rights (CRUD Permissions)
                                                </Label>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Configure Read, Create, Update, and Delete rights. Granting Create, Update, or Delete automatically enables Read access.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs px-2.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                                                    onClick={handleGrantAll}
                                                >
                                                    Grant All
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs px-2.5 text-rose-700 border-rose-300 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                                                    onClick={handleRevokeAll}
                                                >
                                                    Revoke All
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs px-2 text-muted-foreground"
                                                    onClick={handleExpandAll}
                                                >
                                                    Expand
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs px-2 text-muted-foreground"
                                                    onClick={handleCollapseAll}
                                                >
                                                    Collapse
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Search Filter */}
                                        <div className="relative">
                                            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Filter modules or submodules (e.g. inquiry, attendance, finance)..."
                                                value={moduleSearchTerm}
                                                onChange={(e) => setModuleSearchTerm(e.target.value)}
                                                className="pl-8 h-9 text-xs"
                                            />
                                        </div>

                                        {/* Modules List */}
                                        <div className="space-y-3 p-3 bg-muted/10 rounded-lg border max-h-[500px] overflow-y-auto">
                                            {filteredModules.map((module) => {
                                                const ModIcon = module.icon || Shield;
                                                const childIds = getModuleChildIds(module);
                                                const isRootModule = childIds.length === 0;
                                                const isExpanded = expandedModules[module.label] !== false;

                                                const modActions = formData.actions?.[module.label] || {};
                                                const activeSubs = isRootModule
                                                    ? (modActions._root?.read ? 1 : 0)
                                                    : childIds.filter((cid) => modActions[cid]?.read).length;
                                                const totalCount = isRootModule ? 1 : childIds.length;
                                                const isFullAccess = isRootModule
                                                    ? (modActions._root?.read && modActions._root?.create && modActions._root?.update && modActions._root?.delete)
                                                    : (childIds.length > 0 && childIds.every((cid) => {
                                                        const a = modActions[cid];
                                                        if (isReadOnlySubmodule(module.label, cid)) {
                                                            return Boolean(a && a.read);
                                                        }
                                                        if (isFinanceClosingSubmodule(module.label, cid)) {
                                                            return Boolean(a && a.read && (a.closing || a.close));
                                                        }
                                                        const isFeeChallan = module.label === "Fee Management" && (cid === "challans" || cid === "extra-challans");
                                                        const isApprovalAction = isApprovalSubmodule(module.label, cid);
                                                        return a && a.read && a.create && a.update && a.delete
                                                            && (!isFeeChallan || (a.payFee || a.pay))
                                                            && (!isApprovalAction || (a.approvals || a.approve));
                                                    }));
                                                const isModuleActive = activeSubs > 0;

                                                return (
                                                    <div
                                                        key={module.label}
                                                        className={`rounded-lg border transition-all ${
                                                            isModuleActive
                                                                ? "border-primary/40 bg-card shadow-xs"
                                                                : "border-border/60 bg-card/60"
                                                        }`}
                                                    >
                                                        {/* Module Header */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-muted/20 rounded-t-lg">
                                                            <div
                                                                className="flex items-center gap-2.5 cursor-pointer select-none flex-1 min-w-0"
                                                                onClick={() => toggleModuleExpanded(module.label)}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    className="text-muted-foreground hover:text-foreground transition-transform p-0.5"
                                                                    aria-label="Toggle collapse"
                                                                >
                                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                </button>
                                                                <div className={`p-1.5 rounded-md ${isModuleActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                                                    <ModIcon className="w-4 h-4" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-semibold truncate">{module.label}</span>
                                                                        {isFullAccess ? (
                                                                            <Badge variant="outline" className="text-[10px] py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                                                                                Full
                                                                            </Badge>
                                                                        ) : isModuleActive ? (
                                                                            <Badge variant="outline" className="text-[10px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300">
                                                                                Partial ({activeSubs}/{totalCount})
                                                                            </Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground truncate">
                                                                        {module.description || (isRootModule ? "Direct module" : `${childIds.length} submodules`)}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Module Batch Actions */}
                                                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 text-[11px] px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                                                                    onClick={() => handleModuleBatch(module, "full")}
                                                                >
                                                                    Full
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 text-[11px] px-2 text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                                                                    onClick={() => handleModuleBatch(module, "read")}
                                                                >
                                                                    Read Only
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleModuleBatch(module, "none")}
                                                                >
                                                                    Clear
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Submodules Body */}
                                                        {isExpanded && (
                                                            <div className="p-2.5 space-y-2 border-t border-border/40">
                                                                {isRootModule ? (
                                                                    (() => {
                                                                        const subKey = "_root";
                                                                        const actions = getSubmoduleActions(module.label, subKey);
                                                                        const isAll = actions.read && actions.create && actions.update && actions.delete;

                                                                        return (
                                                                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-md border transition-all ${
                                                                                actions.read ? "bg-muted/30 border-border" : "bg-background border-border/40"
                                                                            }`}>
                                                                                <div className="flex items-center gap-2">
                                                                                    <ModIcon className="w-4 h-4 text-muted-foreground" />
                                                                                    <span className="text-xs font-medium">{module.label} (Direct Module)</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                        actions.read ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                    }`}>
                                                                                        <Checkbox
                                                                                            checked={actions.read}
                                                                                            onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "read", Boolean(checked))}
                                                                                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                                                        />
                                                                                        <span>Read</span>
                                                                                    </label>
                                                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                        actions.create ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                    }`}>
                                                                                        <Checkbox
                                                                                            checked={actions.create}
                                                                                            onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "create", Boolean(checked))}
                                                                                            className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                                                        />
                                                                                        <span>Create</span>
                                                                                    </label>
                                                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                        actions.update ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                    }`}>
                                                                                        <Checkbox
                                                                                            checked={actions.update}
                                                                                            onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "update", Boolean(checked))}
                                                                                            className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                                                                        />
                                                                                        <span>Update</span>
                                                                                    </label>
                                                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                        actions.delete ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                    }`}>
                                                                                        <Checkbox
                                                                                            checked={actions.delete}
                                                                                            onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "delete", Boolean(checked))}
                                                                                            className="data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                                                                                        />
                                                                                        <span>Delete</span>
                                                                                    </label>
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="h-6 px-1.5 text-[11px] text-muted-foreground"
                                                                                        onClick={() => handleToggleSubmoduleAll(module.label, subKey)}
                                                                                    >
                                                                                        {isAll ? "Revoke" : "All"}
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()
                                                                ) : (
                                                                    module.subModules.map((subModule) => {
                                                                        const SubIcon = subModule.icon;
                                                                        const subKey = subModule.id;
                                                                        const actions = getSubmoduleActions(module.label, subKey);
                                                                        const isFeeChallan = module.label === "Fee Management" && (subKey === "challans" || subKey === "extra-challans");
                                                                        const isApprovalAction = isApprovalSubmodule(module.label, subKey);
                                                                        const isFinanceClosing = isFinanceClosingSubmodule(module.label, subKey);
                                                                        const isReadOnly = isReadOnlySubmodule(module.label, subKey);
                                                                        const isAll = isReadOnly
                                                                            ? Boolean(actions.read)
                                                                            : isFinanceClosing
                                                                            ? Boolean(actions.read && (actions.closing || actions.close))
                                                                            : (actions.read && actions.create && actions.update && actions.delete
                                                                                && (!isFeeChallan || (actions.payFee || actions.pay))
                                                                                && (!isApprovalAction || (actions.approvals || actions.approve)));

                                                                        return (
                                                                            <div
                                                                                key={subKey}
                                                                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-md border transition-all ${
                                                                                    actions.read ? "bg-muted/30 border-border" : "bg-background border-border/40"
                                                                                }`}
                                                                            >
                                                                                <div className="flex items-center gap-2 min-w-[160px]">
                                                                                    {SubIcon ? <SubIcon className="w-4 h-4 text-muted-foreground shrink-0" /> : <Shield className="w-4 h-4 text-muted-foreground shrink-0" />}
                                                                                    <div className="min-w-0">
                                                                                        <span className="text-xs font-medium block truncate">{subModule.label}</span>
                                                                                        {subModule.description && (
                                                                                            <span className="text-[10px] text-muted-foreground hidden sm:block truncate max-w-[200px]">{subModule.description}</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                        actions.read ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                    }`}>
                                                                                        <Checkbox
                                                                                            checked={actions.read}
                                                                                            onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "read", Boolean(checked))}
                                                                                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                                                        />
                                                                                        <span>Read</span>
                                                                                    </label>
                                                                                    {!isReadOnly && !isFinanceClosing && (
                                                                                        <>
                                                                                            <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                                actions.create ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                            }`}>
                                                                                                <Checkbox
                                                                                                    checked={actions.create}
                                                                                                    onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "create", Boolean(checked))}
                                                                                                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                                                                />
                                                                                                <span>Create</span>
                                                                                            </label>
                                                                                            <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                                actions.update ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                            }`}>
                                                                                                <Checkbox
                                                                                                    checked={actions.update}
                                                                                                    onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "update", Boolean(checked))}
                                                                                                    className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                                                                                />
                                                                                                <span>Update</span>
                                                                                            </label>
                                                                                            <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                                actions.delete ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                            }`}>
                                                                                                <Checkbox
                                                                                                    checked={actions.delete}
                                                                                                    onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "delete", Boolean(checked))}
                                                                                                    className="data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                                                                                                />
                                                                                                <span>Delete</span>
                                                                                            </label>
                                                                                        </>
                                                                                    )}
                                                                                    {isFeeChallan && (
                                                                                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                            Boolean(actions.payFee || actions.pay) ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                        }`}>
                                                                                            <Checkbox
                                                                                                checked={Boolean(actions.payFee || actions.pay)}
                                                                                                onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "payFee", Boolean(checked))}
                                                                                                className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                                                                            />
                                                                                            <span>Pay Fee</span>
                                                                                        </label>
                                                                                    )}
                                                                                    {isApprovalSubmodule(module.label, subKey) && (
                                                                                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                            Boolean(actions.approvals || actions.approve) ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                        }`}>
                                                                                            <Checkbox
                                                                                                checked={Boolean(actions.approvals || actions.approve)}
                                                                                                onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "approvals", Boolean(checked))}
                                                                                                className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                                                                            />
                                                                                            <span>Approvals</span>
                                                                                        </label>
                                                                                    )}
                                                                                    {isFinanceClosing && (
                                                                                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors border ${
                                                                                            Boolean(actions.closing || actions.close) ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800" : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                                                        }`}>
                                                                                            <Checkbox
                                                                                                checked={Boolean(actions.closing || actions.close)}
                                                                                                onCheckedChange={(checked) => handleActionToggle(module.label, subKey, "closing", Boolean(checked))}
                                                                                                className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                                                                                            />
                                                                                            <span>Closing</span>
                                                                                        </label>
                                                                                    )}
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="h-6 px-1.5 text-[11px] text-muted-foreground"
                                                                                        onClick={() => handleToggleSubmoduleAll(module.label, subKey)}
                                                                                    >
                                                                                        {isAll ? "Revoke" : "All"}
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!formData.isTeaching && !formData.isNonTeaching && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <UserCog className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Select a role in the "Roles" tab to configure details</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-between gap-3 mt-4">
                        <Button
                            variant="outline"
                            disabled={createMutation.isPending || updateMutation.isPending}
                            onClick={() => {
                                const idx = formTabs.indexOf(formTab);
                                if (idx > 0) {
                                    setErrors({});
                                    const prevStep = idx;
                                    setCompletedSteps(prev => {
                                        const next = new Set(prev);
                                        for (let s = prevStep; s <= formTabs.length; s++) next.delete(s);
                                        return next;
                                    });
                                    setFormTab(formTabs[idx - 1]);
                                } else {
                                    handleCloseDialog();
                                }
                            }}
                        >
                            {formTab === "basic" ? "Cancel" : "Back"}
                        </Button>
                        <div className="flex items-center gap-2">
                            {editingStaff && formTab !== formTabs[formTabs.length - 1] && (
                                <Button
                                    variant="outline"
                                    onClick={handleSubmit}
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        "Update Staff"
                                    )}
                                </Button>
                            )}
                            {formTab !== formTabs[formTabs.length - 1] ? (
                                <Button onClick={handleNext} disabled={createMutation.isPending || updateMutation.isPending}>
                                    Next
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    {(createMutation.isPending || updateMutation.isPending) && (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    )}
                                    {editingStaff
                                        ? (updateMutation.isPending ? "Updating Staff..." : "Update Staff")
                                        : (createMutation.isPending ? "Adding Staff..." : "Add Staff")}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{staffToDelete?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <SalaryRevisionDialog
                open={salaryRevisionOpen}
                onOpenChange={setSalaryRevisionOpen}
                staff={salaryRevisionStaff}
            />
        </div>
    );
}
