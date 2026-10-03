import {
  LayoutDashboard, Users, DollarSign, ClipboardCheck, GraduationCap,
  BookOpen, Settings, BriefcaseBusiness, Home, FileText, TrendingUp,
  Package, UsersRound, MessageSquare, UserCheck, AlertCircle, Phone,
  UserX, UserMinus, CalendarCheck, CalendarOff, Receipt, Tags, Layers,
  BarChart3, History, PenSquare, Award, CalendarDays, School, Grid,
  Network, Clock, Wallet, Building2, PartyPopper, FileSpreadsheet,
  UserPlus, Bed, TrendingDown, Boxes, Sliders, ArrowDownLeft,
  ArrowUpRight, PieChart, Lock, PackageOpen, ShoppingCart, Building,
  ShieldAlert, FileCode, Crown, User,
} from "lucide-react";

export const NAV_MODULES = [
  {
    icon: Crown,
    label: "Executive Dashboard",
    path: "/executive-dashboard",
    componentKey: "ExecutiveDashboard",
    description: "Institutional KPIs, financial health, cash flow, and class tuition fee averages",
  },
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/dashboard",
    componentKey: "Dashboard",
    description: "Personalized operational dashboard filtered by your allowed module access rights",
  },
  {
    icon: FileText,
    label: "Front Office",
    path: "/front-office",
    componentKey: "FrontOffice",
    description: "Manage inquiries, visitor records, complaints, and general contact directory",
    subModules: [
      { id: "inquiry", label: "Inquiry", path: "/front-office/inquiry", icon: UserPlus, description: "Track prospective student and general visitor inquiries" },
      { id: "visitor", label: "Visitor Book", path: "/front-office/visitor", icon: BookOpen, description: "Log and monitor campus visitors and entry passes" },
      { id: "complaint", label: "Complaints", path: "/front-office/complaint", icon: AlertCircle, description: "Register, track, and resolve community complaints" },
      { id: "contacts", label: "Contacts", path: "/front-office/contacts", icon: Phone, description: "Manage official and emergency contact directory" },
    ],
  },
  {
    icon: Users,
    label: "Students",
    path: "/students",
    componentKey: "Students",
    description: "Manage student admissions, profiles, statuses, and academic records",
  },
  {
    icon: UsersRound,
    label: "Staff",
    path: "/staff",
    componentKey: "Staff",
    description: "Directory and role configuration for teaching and non-teaching personnel",
    subModules: [
      { id: "directory", label: "Staff Directory", path: "/staff/directory", icon: Users, description: "View and manage teaching and non-teaching staff profiles" },
      { id: "settings", label: "Settings", path: "/staff/settings", icon: Settings, description: "Configure staff designations, categories, and working rules" },
    ],
  },
  {
    icon: ClipboardCheck,
    label: "Attendance",
    path: "/attendance",
    componentKey: "Attendance",
    description: "Track student presence, leaves, daily logs, and attendance reports",
    subModules: [
      { id: "mark", label: "Record Attendance", path: "/attendance/mark", icon: CalendarCheck, description: "Mark and update daily student and section attendance" },
      { id: "leave", label: "Leave", path: "/attendance/leave", icon: CalendarOff, description: "Review and approve student leave requests" },
      { id: "reports", label: "Reports", path: "/attendance/reports", icon: BarChart3, description: "Class-level attendance summaries and monthly analytics" },
      { id: "individual-reports", label: "Individual Reports", path: "/attendance/individual-reports", icon: FileText, description: "Detailed single-student attendance history" },
    ],
  },
  {
    icon: DollarSign,
    label: "Fee Management",
    path: "/fee-management",
    componentKey: "FeeManagement",
    description: "Challan generation, payment collections, fee structures, and financial ledgers",
    subModules: [
      { id: "challans", label: "Challans", path: "/fee-management/challans", icon: Receipt, description: "Generate, issue, and manage monthly fee challans" },
      { id: "extra-challans", label: "Extra Challans", path: "/fee-management/extra-challans", icon: FileText, description: "Issue ad-hoc, fines, and special fee challans" },
      { id: "feeheads", label: "Fee Heads", path: "/fee-management/feeheads", icon: Tags, description: "Configure tuition, examination, and recurring fee heads" },
      { id: "structures", label: "Fee Structures", path: "/fee-management/structures", icon: Layers, description: "Define program and class-wise fee package structures" },
      { id: "reports", label: "Reports", path: "/fee-management/reports", icon: BarChart3, description: "Fee collection summaries, arrears, and reconciliation logs" },
      { id: "settings", label: "Settings", path: "/fee-management/settings", icon: Sliders, description: "Set late fee policies, discounts, and payment methods" },
      { id: "student-history", label: "Student History", path: "/fee-management/student-history", icon: History, description: "Inspect full fee transaction history for any student" },
    ],
  },
  {
    icon: BookOpen,
    label: "Examination",
    path: "/examination",
    componentKey: "Examination",
    description: "Schedule exams, record marks, and generate student report cards",
    subModules: [
      { id: "exams", label: "Exams", path: "/examination/exams", icon: CalendarDays, description: "Schedule exams, terms, dates, and subject tests" },
      { id: "marks", label: "Marks Entry", path: "/examination/marks", icon: PenSquare, description: "Input and edit subject marks for examination terms" },
      { id: "results", label: "Results", path: "/examination/results", icon: Award, description: "Compute results, grade sheets, and student transcripts" },
    ],
  },
  {
    icon: MessageSquare,
    label: "Complaints",
    path: "/complaints",
    componentKey: "Complaints",
    description: "Institutional grievance tracking and feedback management",
  },
  {
    icon: GraduationCap,
    label: "Academics",
    path: "/academics",
    componentKey: "Academics",
    description: "Academic sessions, study programs, classes, subjects, and timetables",
    subModules: [
      { id: "sessions", label: "Sessions", path: "/academics/sessions", icon: CalendarDays, description: "Manage academic years and active enrollment terms" },
      { id: "programs", label: "Programs", path: "/academics/programs", icon: GraduationCap, description: "Define academic degrees, certifications, and programs" },
      { id: "classes", label: "Classes", path: "/academics/classes", icon: School, description: "Configure student grades and academic classes" },
      { id: "sections", label: "Sections", path: "/academics/sections", icon: Grid, description: "Divide classes into classroom sections" },
      { id: "subjects", label: "Subjects", path: "/academics/subjects", icon: BookOpen, description: "Define curriculum courses, codes, and credit hours" },
      { id: "scm", label: "Subject Classes", path: "/academics/scm", icon: Network, description: "Assign curriculum subjects to corresponding classes" },
      { id: "classMapping", segment: "class-mapping", label: "Teacher Classes", path: "/academics/class-mapping", icon: UserCheck, description: "Allocate teachers to class sections and subjects" },
      { id: "timetable", label: "Timetable", path: "/academics/timetable", icon: Clock, description: "Build and schedule weekly class and teacher timetables" },
    ],
  },
  {
    icon: BriefcaseBusiness,
    label: "HR & Payroll",
    path: "/hr-payroll",
    componentKey: "HRPayroll",
    description: "Staff leaves, monthly payroll, attendance, advance loans, and departments",
    subModules: [
      { id: "leaves", label: "Leaves", path: "/hr-payroll/leaves", icon: CalendarOff, description: "Manage staff leave applications, quotas, and approvals" },
      { id: "payroll", label: "Payroll", path: "/hr-payroll/payroll", icon: DollarSign, description: "Process monthly employee salaries and generate payslips" },
      { id: "attendance", label: "Attendance", path: "/hr-payroll/attendance", icon: Clock, description: "Monitor staff biometric and daily work hours" },
      { id: "advance", label: "Advance Salary", path: "/hr-payroll/advance", icon: Wallet, description: "Issue and track employee salary advances and deductions" },
      { id: "departments", label: "Departments", path: "/hr-payroll/departments", icon: Building2, description: "Organize institutional and academic departments" },
      { id: "holidays", label: "Holidays", path: "/hr-payroll/holidays", icon: PartyPopper, description: "Schedule campus holidays and institutional breaks" },
      { id: "reports", label: "Reports", path: "/hr-payroll/reports", icon: FileSpreadsheet, description: "Generate payroll summaries and HR compliance sheets" },
    ],
  },
  {
    icon: Home,
    label: "Boarding",
    path: "/hostel",
    componentKey: "Boarding",
    description: "Hostel rooms, student allocations, boarding fees, and mess expenses",
    subModules: [
      { id: "registration", label: "Registration", path: "/hostel/registration", icon: UserPlus, description: "Register and allocate rooms for resident students" },
      { id: "rooms", label: "Rooms", path: "/hostel/rooms", icon: Bed, description: "Manage hostel buildings, wings, floors, and room inventory" },
      { id: "fees", label: "Fees", path: "/hostel/fees", icon: Receipt, description: "Track boarding dues, mess charges, and payment records" },
      { id: "expenses", label: "Expenses", path: "/hostel/expenses", icon: TrendingDown, description: "Record hostel utility, maintenance, and kitchen expenses" },
      { id: "inventory", label: "Inventory", path: "/hostel/inventory", icon: Boxes, description: "Manage hostel furniture, appliances, and assets" },
      { id: "revenue", label: "Reports", path: "/hostel/revenue", icon: BarChart3, description: "Hostel occupancy statistics and income-expense reports" },
      { id: "settings", label: "Settings", path: "/hostel/settings", icon: Sliders, description: "Configure hostel rules, curfew, and mess charges" },
    ],
  },
  {
    icon: TrendingUp,
    label: "Finance",
    path: "/finance",
    componentKey: "Finance",
    description: "Revenue tracking, expense vouchers, cash flow, and financial closing",
    subModules: [
      { id: "dashboard", label: "Dashboard", path: "/finance/dashboard", icon: LayoutDashboard, description: "Financial health charts, cash flow, and monthly trends" },
      { id: "income", label: "Income", path: "/finance/income", icon: ArrowDownLeft, description: "Record miscellaneous receipts, donations, and earnings" },
      { id: "expense", label: "Expense", path: "/finance/expense", icon: ArrowUpRight, description: "Manage expenditure vouchers, invoices, and disbursements" },
      { id: "reports", label: "Reports", path: "/finance/reports", icon: PieChart, description: "View balance sheets, profit & loss, and audit reports" },
      { id: "closing", label: "Closing", path: "/finance/closing", icon: Lock, description: "Perform daily drawer and fiscal year financial closing" },
      { id: "settings", label: "Settings", path: "/finance/settings", icon: Sliders, description: "Manage expense categories, sub-categories, and income categories" },
    ],
  },
  {
    icon: Package,
    label: "Inventory",
    path: "/inventory",
    componentKey: "Inventory",
    description: "Supplies, stock levels, equipment procurement, and asset expenses",
    subModules: [
      { id: "inventory", label: "Inventory", path: "/inventory/inventory", icon: PackageOpen, description: "Track campus physical stock, assets, and reorder levels" },
      { id: "expenses", label: "Expenses", path: "/inventory/expenses", icon: ShoppingCart, description: "Log vendor purchase orders and item procurement costs" },
    ],
  },
  {
    icon: Settings,
    label: "Configuration",
    path: "/configuration",
    componentKey: "Configuration",
    description: "Campus profile, user roles, permission access, and document templates",
    subModules: [
      { id: "institute", label: "Institute", path: "/configuration/institute", icon: Building, description: "Edit institute profile, campus branding, and contact details" },
      { id: "admins", label: "Admins", path: "/configuration/admins", icon: ShieldAlert, description: "Manage administrator accounts and staff module permissions" },
      { id: "templates", label: "Templates", path: "/configuration/templates", icon: FileCode, description: "Customize challans, certificates, and ID card formats" },
      { id: "wallets", label: "Wallets / Accounts", path: "/configuration/wallets", icon: Wallet, description: "Manage treasury bank accounts, digital wallets, cash in hand, direct deposits, and contra transfers" },
      { id: "logs", label: "Activity Logs", path: "/configuration/logs", icon: History, description: "Track system-wide staff activities, real-time operations, and error logs" },
    ],
  },
];

export const MODULE_BY_LABEL = Object.fromEntries(NAV_MODULES.map((module) => [module.label, module]));

export const getSubmoduleSegment = (subModule) => subModule.segment || subModule.id;

export const getActiveSubmoduleId = (pathname, module) => {
  const subModules = module?.subModules || [];
  if (!subModules.length) return null;
  const segment = pathname.replace(module.path, "").split("/").filter(Boolean)[0];
  return subModules.find((sub) => getSubmoduleSegment(sub) === segment)?.id || subModules[0].id;
};

export const getDefaultModulePath = (module) => module?.path || "/dashboard";

export const isDualRoleStaff = (user) =>
  Boolean(user?.isStaff && user?.isTeaching && user?.isNonTeaching);

export const hasExplicitModuleAccess = (user, moduleLabel) => {
  if (user?.role === "SUPER_ADMIN" || user?.role === "Super Admin" || user?.permissions?.all === true) return true;
  if (!user || !moduleLabel) return false;

  const target = moduleLabel.toLowerCase();

  // 1. Check granular actions / crud
  const actions = user?.permissions?.actions || user?.permissions?.crud;
  if (actions && typeof actions === "object") {
    const matchedKey = Object.keys(actions).find((k) => k.toLowerCase() === target);
    if (matchedKey && actions[matchedKey] && typeof actions[matchedKey] === "object") {
      const moduleActions = actions[matchedKey];
      const hasAnyActive = Object.values(moduleActions).some((sub) =>
        sub && typeof sub === "object" ? Object.values(sub).some(Boolean) : Boolean(sub)
      );
      if (hasAnyActive) return true;
    }
  }

  // 2. Check subModules
  const subModules = user?.permissions?.subModules;
  if (subModules && typeof subModules === "object") {
    const matchedKey = Object.keys(subModules).find((k) => k.toLowerCase() === target);
    if (matchedKey && Array.isArray(subModules[matchedKey]) && subModules[matchedKey].length > 0) {
      return true;
    }
  }

  // 3. Check modules array
  const modules = user?.permissions?.modules;
  if (Array.isArray(modules) && modules.some((m) => m?.toLowerCase() === target)) {
    return true;
  }

  return false;
};

export const hasModuleAccess = (user, moduleLabel) => {
  if (user?.role === "SUPER_ADMIN" || user?.role === "Super Admin" || user?.permissions?.all === true) return true;
  // Personalized Staff Dashboard is accessible to all staff
  if (moduleLabel === "Dashboard") return true;
  const role = user?.role;
  const isTeacher = role === "Teacher" || role === "TEACHER";
  if (isTeacher && ["Attendance", "Examination", "Complaints"].includes(moduleLabel)) return true;
  if (role === "Staff" && moduleLabel === "Complaints") return true;
  return hasExplicitModuleAccess(user, moduleLabel);
};

export const hasSubmoduleAccess = (user, moduleLabel, subModuleId) => {
  if (!user) return false;
  if (user?.role === "SUPER_ADMIN" || user?.role === "Super Admin" || user?.permissions?.all === true) return true;
  if (!hasModuleAccess(user, moduleLabel)) return false;
  if (!subModuleId) return true;

  const role = user?.role;
  const isTeacher = role === "Teacher" || role === "TEACHER";
  const usesTeacherFallback =
    isTeacher &&
    ["Attendance", "Examination", "Complaints"].includes(moduleLabel) &&
    !hasExplicitModuleAccess(user, moduleLabel);
  if (usesTeacherFallback) return true;

  const module = MODULE_BY_LABEL[moduleLabel];
  const subModules = module?.subModules || [];
  if (!subModules.length) return true;

  // 1. Check granular actions / crud permissions first
  const actions = user?.permissions?.actions || user?.permissions?.crud;
  if (actions && typeof actions === "object") {
    const matchedModuleKey = Object.keys(actions).find(
      (k) => k.toLowerCase() === moduleLabel?.toLowerCase()
    );
    const moduleActions = matchedModuleKey
      ? actions[matchedModuleKey]
      : (actions[moduleLabel] || actions[moduleLabel?.toLowerCase()]);

    if (moduleActions && typeof moduleActions === "object" && Object.keys(moduleActions).length > 0) {
      const key = subModuleId || "_root";
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");

      const matchedSubKey = Object.keys(moduleActions).find(
        (k) => k.toLowerCase() === key.toLowerCase() || k.toLowerCase().replace(/[-_]/g, "") === normalizedKey
      );
      const subActions = matchedSubKey
        ? moduleActions[matchedSubKey]
        : (moduleActions[key] || moduleActions["_root"] || moduleActions[moduleLabel]);

      if (subActions && typeof subActions === "object") {
        if (typeof subActions.read === "boolean") {
          return subActions.read;
        }
        return Object.values(subActions).some(Boolean);
      }
      // Module has granular permissions defined, but this submodule is not granted
      return false;
    }
  }

  // 2. Check explicit subModules array configuration
  const subModulesConfig = user?.permissions?.subModules;
  if (subModulesConfig && typeof subModulesConfig === "object") {
    const matchedKey = Object.keys(subModulesConfig).find(
      (k) => k.toLowerCase() === moduleLabel?.toLowerCase()
    );
    const configured = matchedKey ? subModulesConfig[matchedKey] : subModulesConfig[moduleLabel];
    if (Array.isArray(configured)) {
      return configured.includes(subModuleId);
    }
  }

  // 3. Fallback to module-level access: if user was granted module and no submodule restrictions exist
  const modules = user?.permissions?.modules;
  if (Array.isArray(modules)) {
    return modules.some((m) => m?.toLowerCase() === moduleLabel?.toLowerCase());
  }

  return true;
};

export const getAllowedSubmodules = (user, module) => {
  const subModules = module?.subModules || [];
  if (!hasModuleAccess(user, module?.label)) return [];
  return subModules.filter((sub) => hasSubmoduleAccess(user, module.label, sub.id));
};

export const getFirstAllowedPath = (user) => {
  if (!user) return "/dashboard";

  // Teaching-only staff go to teacher dashboard
  if (isTeachingOnly(user)) return "/teacher/dashboard";

  // Dual-role: respect the stored view mode
  if (isDualRole(user)) {
    const mode = getViewMode();
    if (mode === "teacher") return "/teacher/dashboard";
  }

  // Super admin and non-teaching/supporting staff use normal modules
  for (const module of NAV_MODULES) {
    if (!hasModuleAccess(user, module.label)) continue;
    return module.path;
  }
  return "/dashboard";
};

export const getRouteSubmoduleId = (pathname, moduleLabel, fallback) =>
  getActiveSubmoduleId(pathname, MODULE_BY_LABEL[moduleLabel]) || fallback;

export const hasPermission = (user, moduleLabel, subModuleId, action = "read") => {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "Super Admin" || user.permissions?.all === true) return true;

  const actions = user?.permissions?.actions || user?.permissions?.crud;
  if (actions && typeof actions === "object") {
    // Match module label case-insensitively
    const matchedModuleKey = Object.keys(actions).find(
      (k) => k.toLowerCase() === moduleLabel?.toLowerCase()
    );
    const moduleActions = matchedModuleKey ? actions[matchedModuleKey] : (actions[moduleLabel] || actions[moduleLabel?.toLowerCase()]);

    if (moduleActions && typeof moduleActions === "object" && Object.keys(moduleActions).length > 0) {
      const key = subModuleId || "_root";
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");

      const matchedSubKey = Object.keys(moduleActions).find(
        (k) => k.toLowerCase() === key.toLowerCase() || k.toLowerCase().replace(/[-_]/g, "") === normalizedKey
      );
      const subActions = matchedSubKey
        ? moduleActions[matchedSubKey]
        : (moduleActions[key] || moduleActions["_root"] || moduleActions[moduleLabel]);

      if (subActions && typeof subActions === "object") {
        const act = action.toLowerCase();
        if (typeof subActions[action] === "boolean") {
          return subActions[action];
        }
        if (typeof subActions[act] === "boolean") {
          return subActions[act];
        }
        // Aliases for Pay Fee
        if (["pay", "payfee"].includes(act) && (subActions.payFee !== undefined || subActions.pay !== undefined)) {
          return Boolean(subActions.payFee ?? subActions.pay);
        }
        // Aliases for Approvals
        if (["approve", "approval", "approvals"].includes(act) && (subActions.approvals !== undefined || subActions.approve !== undefined)) {
          return Boolean(subActions.approvals ?? subActions.approve);
        }
        // Aliases for Closing
        if (["close", "closing"].includes(act) && (subActions.closing !== undefined || subActions.close !== undefined)) {
          return Boolean(subActions.closing ?? subActions.close);
        }
        if (act === "read") {
          return Object.values(subActions).some(Boolean);
        }
        return false;
      }
      return false;
    }
  }

  // Fallback for read action or when granular actions aren't configured yet
  if (action?.toLowerCase() === "read") {
    return hasSubmoduleAccess(user, moduleLabel, subModuleId);
  }

  return false;
};

// ─── Teacher Portal Modules ────────────────────────────────────────
// Dedicated navigation for teacher view mode. These use /teacher/* paths
// and dedicated teacher portal components.
export const TEACHER_NAV_MODULES = [
  {
    icon: LayoutDashboard,
    label: "Teacher Dashboard",
    path: "/teacher/dashboard",
    componentKey: "TeacherDashboard",
    description: "Overview of your classes, today's schedule, and quick actions",
  },
  {
    icon: School,
    label: "My Classes",
    path: "/teacher/classes",
    componentKey: "TeacherClasses",
    description: "Your assigned classes, sections, and subjects",
  },
  {
    icon: Users,
    label: "My Students",
    path: "/teacher/students",
    componentKey: "TeacherStudents",
    description: "Students in your assigned classes and sections",
  },
  {
    icon: ClipboardCheck,
    label: "Attendance",
    path: "/teacher/attendance",
    componentKey: "TeacherAttendance",
    description: "Mark and review attendance for your classes",
  },
  {
    icon: GraduationCap,
    label: "Examination",
    path: "/teacher/examination",
    componentKey: "TeacherExamination",
    description: "Enter marks, view results, and manage exam data for your subjects",
  },
  {
    icon: Clock,
    label: "Timetable",
    path: "/teacher/timetable",
    componentKey: "TeacherTimetable",
    description: "Your teaching schedule and class timetable",
  },
  {
    icon: CalendarDays,
    label: "Leave Applications",
    path: "/teacher/leaves",
    componentKey: "TeacherLeaves",
    description: "Apply for leave and track your leave history",
  },
  {
    icon: MessageSquare,
    label: "Complaints",
    path: "/teacher/complaints",
    componentKey: "TeacherComplaints",
    description: "Submit and track your complaints",
  },
];

// ─── View Mode Helpers ────────────────────────────────────────────
// Dual-role staff can toggle between "staff" and "teacher" views.
const VIEW_MODE_KEY = "concordia_viewMode";

export const getViewMode = () => {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) || "staff";
  } catch {
    return "staff";
  }
};

export const setViewMode = (mode) => {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // ignore
  }
};

export const isDualRole = (user) => {
  if (!user) return false;
  return Boolean(
    (user.isTeaching && user.isNonTeaching) ||
    user.role === "Dual" ||
    user.role === "DUAL"
  );
};

export const isTeachingOnly = (user) => {
  if (!user) return false;
  if (isDualRole(user)) return false;
  return Boolean(
    user.isTeaching ||
    user.role === "Teacher" ||
    user.role === "TEACHER"
  );
};

export const getEffectiveNavModules = (user) => {
  if (!user) return [];
  if (user.role === "SUPER_ADMIN") return NAV_MODULES;

  // If dual role, respect view mode toggle
  if (isDualRole(user)) {
    const mode = getViewMode();
    return mode === "teacher" ? TEACHER_NAV_MODULES : NAV_MODULES;
  }

  // Teaching-only staff always see teacher portal
  if (isTeachingOnly(user)) return TEACHER_NAV_MODULES;

  // Non-teaching, supporting staff, or any other role
  return NAV_MODULES;
};
