import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  Navigate,
  useLocation,
} from "react-router-dom";
import { DataProvider } from "./contexts/DataContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import DashboardLayout from "@/components/DashboardLayout";
import ModuleHub from "@/components/ModuleHub";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Students from "./pages/Students";
import Staff from "./pages/Staff";
import FeeManagement from "./pages/FeeManagement";
import Attendance from "./pages/Attendance";
import FrontOffice from "./pages/FrontOffice";
import Examination from "./pages/Examination";
import Academics from "./pages/Academics";
import HRPayroll from "./pages/HRPayroll";
import Boarding from "./pages/Boarding";
import Finance from "./pages/Finance";
import Configuration from "./pages/Configuration";
import Inventory from "./pages/Inventory";
import Complaints from "./pages/Complaints";
import NotFound from "./pages/NotFound";
import StudentVerifyPage from "./pages/students/StudentVerifyPage";
// Teacher portal pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import TeacherStudents from "./pages/teacher/TeacherStudents";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import TeacherExamination from "./pages/teacher/TeacherExamination";
import TeacherTimetable from "./pages/teacher/TeacherTimetable";
import TeacherLeaves from "./pages/teacher/TeacherLeaves";
import TeacherComplaints from "./pages/teacher/TeacherComplaints";
import TeacherProfile from "./pages/teacher/TeacherProfile";
import { refreshTokens, userWho } from "../config/apis";
import {
  NAV_MODULES,
  TEACHER_NAV_MODULES,
  MODULE_BY_LABEL,
  getActiveSubmoduleId,
  getAllowedSubmodules,
  getFirstAllowedPath,
  getSubmoduleSegment,
  hasModuleAccess,
  hasSubmoduleAccess,
  getEffectiveNavModules,
  isTeachingOnly,
} from "@/lib/navigation.jsx";

const pageComponents = {
  ExecutiveDashboard,
  Dashboard,
  FrontOffice,
  Students,
  Staff,
  Attendance,
  FeeManagement,
  Examination,
  Complaints,
  Academics,
  HRPayroll,
  Boarding,
  Finance,
  Inventory,
  Configuration,
  // Teacher portal
  TeacherDashboard,
  TeacherClasses,
  TeacherStudents,
  TeacherAttendance,
  TeacherExamination,
  TeacherTimetable,
  TeacherLeaves,
  TeacherComplaints,
  TeacherProfile,
};

function RootRoutes() {
  const { data } = useQuery({
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

  if (!data) return <Login />;
  return <Navigate to={getFirstAllowedPath(data)} replace />;
}

function PermissionRoute({ children, moduleName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: currentUser, isLoading } = useQuery({
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
            navigate("/login");
            throw error;
          }
        }
        throw error;
      }
    },
    retry: false,
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!currentUser) return <Navigate to="/" replace />;

  const module = MODULE_BY_LABEL[moduleName];
  if (!hasModuleAccess(currentUser, moduleName)) {
    return <Navigate to={getFirstAllowedPath(currentUser)} replace />;
  }

  const hasChildren = Boolean(module?.subModules?.length);
  const isBaseModulePath = hasChildren && location.pathname.replace(/\/$/, "") === module.path;
  const activeSegment = hasChildren
    ? location.pathname.replace(module.path, "").split("/").filter(Boolean)[0]
    : null;
  const isUnknownSubmodule =
    hasChildren &&
    activeSegment &&
    !module.subModules.some((subModule) => getSubmoduleSegment(subModule) === activeSegment);
  const activeSubmoduleId = getActiveSubmoduleId(location.pathname, module);
  const allowedSubmodules = getAllowedSubmodules(currentUser, module);

  if (isUnknownSubmodule) {
    return <Navigate to={allowedSubmodules[0]?.path || module.path} replace />;
  }

  if (isBaseModulePath) {
    return (
      <DashboardLayout>
        <ModuleHub module={module} />
      </DashboardLayout>
    );
  }

  if (activeSubmoduleId && !hasSubmoduleAccess(currentUser, moduleName, activeSubmoduleId)) {
    return <Navigate to={allowedSubmodules[0]?.path || module.path} replace />;
  }

  return <>{children}</>;
}

function TeacherRoute({ children }) {
  const { data: currentUser, isLoading } = useQuery({
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

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!currentUser) return <Navigate to="/" replace />;

  return children;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <DataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRoutes />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              {NAV_MODULES.map((module) => {
                const Page = pageComponents[module.componentKey];
                if (!Page) return null;
                return (
                  <Route
                    key={module.label}
                    path={`${module.path}${module.subModules?.length ? "/*" : ""}`}
                    element={
                      <PermissionRoute moduleName={module.label}>
                        <Page />
                      </PermissionRoute>
                    }
                  />
                );
              })}
              {/* Teacher portal routes - authenticated but not permission-gated */}
              {TEACHER_NAV_MODULES.map((module) => {
                const Page = pageComponents[module.componentKey];
                if (!Page) return null;
                return (
                  <Route
                    key={module.label}
                    path={`${module.path}${module.subModules?.length ? "/*" : ""}`}
                    element={
                      <TeacherRoute>
                        <Page />
                      </TeacherRoute>
                    }
                  />
                );
              })}
              {/* Personal Leave Application route for non-teaching staff & direct access */}
              <Route
                path="/leave-application"
                element={
                  <TeacherRoute>
                    <TeacherLeaves />
                  </TeacherRoute>
                }
              />
              {/* Teacher profile redirect to dashboard */}
              <Route path="/teacher/profile" element={<Navigate to="/teacher/dashboard" replace />} />
              {/* Legacy /boarding URL redirect to /hostel */}
              <Route path="/boarding" element={<Navigate to="/hostel" replace />} />
              <Route path="/boarding/*" element={<Navigate to="/hostel" replace />} />
              {/* Legacy /students sub-routes redirect to /students */}
              <Route path="/students/*" element={<Navigate to="/students" replace />} />
              {/* Public Student ID Card QR Verification */}
              <Route path="/student/verify/:id" element={<StudentVerifyPage />} />
              <Route path="/verify/:id" element={<StudentVerifyPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
