import { useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap, Menu, X, LogOut, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { logout, userWho, refreshTokens, getInstituteSettings } from "../../config/apis";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import logo from "../assets/logo-full.png";
import {
  NAV_MODULES, TEACHER_NAV_MODULES, LEAVE_APPLICATION_MODULE,
  getAllowedSubmodules, hasModuleAccess,
  getEffectiveNavModules, isDualRole, isTeachingOnly, getViewMode, setViewMode,
} from "@/lib/navigation.jsx";

const DESKTOP_SIDEBAR_SCROLL_KEY = "dashboardSidebarScrollTop";
const MOBILE_SIDEBAR_SCROLL_KEY = "dashboardMobileSidebarScrollTop";

const DashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const navScrollRef = useRef(null);
  const mobileNavScrollRef = useRef(null);

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", JSON.stringify(newState));
  };

  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch current user data
  const { data: currentUser } = useQuery({
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

  // Fetch institute settings
  const { data: settings } = useQuery({
    queryKey: ["instituteSettings"],
    queryFn: getInstituteSettings,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Dual-role & teaching-only view mode state
  const isTeacherUser = isTeachingOnly(currentUser);
  const [viewMode, setViewModeState] = useState(() => getViewMode(currentUser));
  const hasDualRole = isDualRole(currentUser);
  const isInTeacherMode = isTeacherUser || viewMode === "teacher" || location.pathname.startsWith("/teacher");

  const canAccess = (label) => {
    if (isInTeacherMode || isTeacherUser) return true;
    return hasModuleAccess(currentUser, label);
  };

  // Determine which navigation modules to show
  const effectiveModules = getEffectiveNavModules(currentUser);
  const visibleModules = (isInTeacherMode || isTeacherUser)
    ? effectiveModules // Teacher modules are always accessible
    : effectiveModules.filter((item) => canAccess(item.label));

  const handleToggleViewMode = () => {
    const newMode = viewMode === "staff" ? "teacher" : "staff";
    setViewMode(newMode);
    setViewModeState(newMode);
    navigate(newMode === "teacher" ? "/teacher/dashboard" : "/dashboard");
  };

  const restoreSidebarScroll = () => {
    const desktopTop = Number(sessionStorage.getItem(DESKTOP_SIDEBAR_SCROLL_KEY) || 0);
    const mobileTop = Number(sessionStorage.getItem(MOBILE_SIDEBAR_SCROLL_KEY) || 0);
    if (navScrollRef.current) navScrollRef.current.scrollTop = desktopTop;
    if (mobileNavScrollRef.current) mobileNavScrollRef.current.scrollTop = mobileTop;
  };

  useLayoutEffect(() => {
    restoreSidebarScroll();
    const frame = requestAnimationFrame(restoreSidebarScroll);
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, visibleModules.length, sidebarCollapsed]);

  const rememberSidebarScroll = (key) => (event) => {
    sessionStorage.setItem(key, String(event.currentTarget.scrollTop));
  };

  // Find active module & submodule state for top bar
  const allModules = [...NAV_MODULES, LEAVE_APPLICATION_MODULE, ...TEACHER_NAV_MODULES];
  const activeModule = allModules.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );
  const allowedSubmodules = activeModule ? getAllowedSubmodules(currentUser, activeModule) : [];
  const hasSubmodules = Boolean(activeModule?.subModules?.length && allowedSubmodules.length > 0);
  const isSubmoduleView = hasSubmodules && location.pathname.replace(/\/$/, "") !== activeModule.path;
  const currentSub = allowedSubmodules.find(
    (s) => location.pathname === s.path || location.pathname.startsWith(`${s.path}/`)
  );

  const getUserInitials = (name, role) => {
    if (name && typeof name === "string") {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (role && typeof role === "string") {
      return role.slice(0, 2).toUpperCase();
    }
    return "SA";
  };

  const renderNavItem = (item, { mobile = false } = {}) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    // Teacher portal items and personal leave application are always accessible (no permission gating)
    const isAlwaysAccessible = item.path?.startsWith("/teacher/") || item.path === "/leave-application";
    const hasAccess = isAlwaysAccessible || canAccess(item.label);

    if (!hasAccess) return null;

    const linkClass = mobile
      ? "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
      : "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors";

    return (
      <Link
        key={item.label}
        to={item.path}
        onClick={() => {
          if (mobile) setSidebarOpen(false);
        }}
        className={cn(
          linkClass,
          "min-w-0 flex items-center group relative z-10",
          isActive
            ? "bg-black/20 text-white font-semibold shadow-inner"
            : "text-white/90 hover:bg-white/10 hover:text-white",
          sidebarCollapsed && !mobile && "justify-center px-1.5"
        )}
        title={sidebarCollapsed && !mobile ? item.label : undefined}
      >
        <Icon className={cn(mobile ? "w-4 h-4" : "w-3.5 h-3.5", "shrink-0 text-white")} strokeWidth={1.7} />
        {(!sidebarCollapsed || mobile) && <span className="truncate flex-1 tracking-normal">{item.label}</span>}
        {isActive && (!sidebarCollapsed || mobile) && (
          <ChevronRight className="w-3 h-3 shrink-0 text-white/80 ml-auto" />
        )}
      </Link>
    );
  };

  const displayName = currentUser?.name || currentUser?.user?.name || (isInTeacherMode || isTeacherUser ? "Teacher" : "Super Admin");
  const displayRole = currentUser?.designation || currentUser?.role || currentUser?.user?.role || (isInTeacherMode || isTeacherUser ? "Faculty Member" : "Staff Member");

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      try {
        localStorage.removeItem("concordia_token");
        localStorage.removeItem("concordia_viewMode");
        sessionStorage.clear();
      } catch {}
      queryClient.clear();
      queryClient.setQueryData(["currentUser"], null);
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col bg-gradient-to-b from-[#bd5319] via-[#b64b11] to-[#9e3e0a] text-white shadow-xl z-30 transition-all duration-300 ease-in-out relative overflow-hidden ${sidebarCollapsed ? "lg:w-16" : "lg:w-64"}`}
      >
        {/* Botanical watermark in bottom left */}
        <div className="absolute bottom-16 left-0 w-36 h-36 pointer-events-none opacity-25 overflow-hidden z-0 select-none">
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
            <ellipse cx="20" cy="140" rx="70" ry="24" transform="rotate(-30 20 140)" fill="currentColor" fillOpacity="0.4" />
            <ellipse cx="20" cy="140" rx="65" ry="22" transform="rotate(-60 20 140)" fill="currentColor" fillOpacity="0.35" />
            <ellipse cx="20" cy="140" rx="60" ry="20" transform="rotate(-85 20 140)" fill="currentColor" fillOpacity="0.3" />
            <ellipse cx="20" cy="140" rx="55" ry="18" transform="rotate(-5 20 140)" fill="currentColor" fillOpacity="0.3" />
            <circle cx="35" cy="125" r="14" fill="currentColor" fillOpacity="0.25" />
          </svg>
        </div>

        <div className="flex flex-col flex-grow pt-5 min-h-0 relative z-10">
          {/* Logo */}
          <div
            className={cn(
              "flex items-center gap-2 px-4 pb-4 transition-all duration-300",
              sidebarCollapsed && "px-2 justify-center"
            )}
          >
            <div className="w-full h-14 flex items-center justify-start shrink-0 overflow-hidden">
              <img
                src={settings?.logo || logo}
                alt="Logo"
                className="h-full object-contain p-0.5"
              />
            </div>
          </div>

          {/* Flat Navigation */}
          <nav
            ref={navScrollRef}
            onScroll={rememberSidebarScroll(DESKTOP_SIDEBAR_SCROLL_KEY)}
            className="flex-1 min-h-0 overflow-y-auto px-2.5 space-y-1.5"
          >
            {visibleModules.map((item) => renderNavItem(item))}
          </nav>

          {/* Dual-Role View Mode Toggle */}
          {hasDualRole && (
            <div className="px-2.5 pb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleViewMode}
                className={cn(
                  "w-full h-8 text-xs font-semibold transition-all bg-black/20 hover:bg-black/30 text-white",
                  sidebarCollapsed && "px-1 justify-center"
                )}
                title={isInTeacherMode ? "Switch to Staff View" : "Switch to Teacher View"}
              >
                <ArrowLeftRight className={cn("w-4 h-4 shrink-0", !sidebarCollapsed && "mr-1.5")} />
                {!sidebarCollapsed && (
                  <span className="truncate">
                    {isInTeacherMode ? "Staff View" : "Teacher View"}
                  </span>
                )}
              </Button>
            </div>
          )}

          {/* Collapse */}
          <div className="px-2.5 pb-1.5">
            <button
              type="button"
              onClick={toggleSidebar}
              className={cn(
                "w-full flex items-center justify-center py-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-xs transition-colors",
                sidebarCollapsed && "px-1"
              )}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">Collapse</span>
                </div>
              )}
            </button>
          </div>

          {/* Footer User Profile */}
          <div className="px-2.5 pb-3 pt-2 border-t border-black/10">
            <div
              onClick={() => setLogoutDialogOpen(true)}
              className={cn(
                "flex items-center gap-2.5 p-2 rounded-xl bg-black/10 hover:bg-black/20 text-white cursor-pointer transition-colors select-none",
                sidebarCollapsed ? "justify-center p-1.5" : "justify-between"
              )}
              title="Click to Log out"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#d97c38] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border border-white/20">
                  {getUserInitials(displayName, displayRole)}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white truncate leading-tight">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-white/70 truncate leading-tight">
                      {displayRole}
                    </p>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <ChevronDown className="w-4 h-4 text-white/80 shrink-0 ml-auto" />
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-foreground/20 z-40 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-[#bd5319] via-[#b64b11] to-[#9e3e0a] text-white z-50 shadow-2xl overflow-hidden">
            {/* Botanical watermark */}
            <div className="absolute bottom-16 left-0 w-40 h-40 pointer-events-none opacity-25 overflow-hidden z-0 select-none">
              <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
                <ellipse cx="20" cy="140" rx="70" ry="24" transform="rotate(-30 20 140)" fill="currentColor" fillOpacity="0.4" />
                <ellipse cx="20" cy="140" rx="65" ry="22" transform="rotate(-60 20 140)" fill="currentColor" fillOpacity="0.35" />
                <ellipse cx="20" cy="140" rx="60" ry="20" transform="rotate(-85 20 140)" fill="currentColor" fillOpacity="0.3" />
                <ellipse cx="20" cy="140" rx="55" ry="18" transform="rotate(-5 20 140)" fill="currentColor" fillOpacity="0.3" />
                <circle cx="35" cy="125" r="14" fill="currentColor" fillOpacity="0.25" />
              </svg>
            </div>

            <div className="flex flex-col h-full pt-5 relative z-10">
              <div className="flex items-center justify-between px-4 pb-4 border-b border-black/10">
                <div className="h-12 flex items-center overflow-hidden">
                  <img
                    src={settings?.logo || logo}
                    alt="Logo"
                    className="h-full object-contain"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="text-white hover:bg-white/10 h-8 w-8 shrink-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <nav
                ref={mobileNavScrollRef}
                onScroll={rememberSidebarScroll(MOBILE_SIDEBAR_SCROLL_KEY)}
                className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto"
              >
                {visibleModules.map((item) => renderNavItem(item, { mobile: true }))}
              </nav>
              {/* Mobile Dual-Role Toggle */}
              {hasDualRole && (
                <div className="px-3 pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { handleToggleViewMode(); setSidebarOpen(false); }}
                    className="w-full h-9 text-xs font-semibold bg-black/20 hover:bg-black/30 text-white"
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-2 shrink-0" />
                    <span>{isInTeacherMode ? "Switch to Staff View" : "Switch to Teacher View"}</span>
                  </Button>
                </div>
              )}
              {/* Mobile Footer User Profile */}
              <div className="px-3 pb-4 pt-2 border-t border-black/10">
                <div
                  onClick={() => { setSidebarOpen(false); setLogoutDialogOpen(true); }}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-black/10 hover:bg-black/20 text-white cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#d97c38] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border border-white/20">
                      {getUserInitials(displayName, displayRole)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {displayName}
                      </p>
                      <p className="text-[10px] text-white/70 truncate">
                        {displayRole}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/80 shrink-0 ml-auto" />
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <div
        className={cn(
          "flex flex-col min-h-screen transition-all duration-300",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <main className="flex-1 px-4 py-3 sm:px-6 sm:py-4 w-full overflow-x-hidden">
          <div className="lg:hidden mb-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
          </div>

          <div className="animate-in fade-in duration-300">
            {children}
          </div>
        </main>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be signed out of your account and redirected to login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DashboardLayout;
