import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  UserCheck,
  AlertCircle,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/navigation.jsx";
import AttendanceReportsTab from "./AttendanceReportsTab";
import IndividualReportsTab from "./IndividualReportsTab";
import MissingAttendanceReportTab from "./MissingAttendanceReportTab";

export default function AttendanceReportsHub({ initialReport = null }) {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData(["currentUser"]);

  const canViewClassReports = Boolean(
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "Super Admin" ||
    currentUser?.permissions?.all === true ||
    hasPermission(currentUser, "Attendance", "class-reports", "read") ||
    hasPermission(currentUser, "Attendance", "reports", "read")
  );

  const canViewIndividualReports = Boolean(
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "Super Admin" ||
    currentUser?.permissions?.all === true ||
    hasPermission(currentUser, "Attendance", "individual-reports", "read") ||
    hasPermission(currentUser, "Attendance", "reports", "read")
  );

  const canViewMissingAttendance = Boolean(
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "Super Admin" ||
    currentUser?.permissions?.all === true ||
    hasPermission(currentUser, "Attendance", "missing-attendance", "read") ||
    hasPermission(currentUser, "Attendance", "reports", "read")
  );

  // selectedReport: null (cards hub) | "class" | "individual" | "missing"
  const [selectedReport, setSelectedReport] = useState(
    initialReport === "class" && canViewClassReports ? "class" :
    initialReport === "individual" && canViewIndividualReports ? "individual" :
    initialReport === "missing" && canViewMissingAttendance ? "missing" : null
  );

  // Render individual component replacing the hub view
  if (selectedReport === "class" && canViewClassReports) {
    return <AttendanceReportsTab onBack={() => setSelectedReport(null)} />;
  }

  if (selectedReport === "individual" && canViewIndividualReports) {
    return <IndividualReportsTab onBack={() => setSelectedReport(null)} />;
  }

  if (selectedReport === "missing" && canViewMissingAttendance) {
    return <MissingAttendanceReportTab onBack={() => setSelectedReport(null)} />;
  }

  // Default View: 3 Report Navigation Cards
  return (
    <div className="space-y-6 max-w-full">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10.5px] font-bold tracking-[0.2em] text-[#8c887b] dark:text-muted-foreground uppercase mb-1">
              ATTENDANCE • REPORTS &amp; AUDITS
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#22211f] dark:text-foreground">
              Institutional Attendance Reports &amp; Missing Audits
            </h1>
            <p className="text-xs sm:text-[13px] text-[#66645d] dark:text-muted-foreground mt-1.5 leading-relaxed">
              Select an attendance module below to inspect class-level attendance registers, search individual student histories, or audit missing attendance across academic programs.
            </p>
            <div className="w-10 h-1 bg-[#d97c38] rounded-full mt-2.5" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="font-mono text-xs bg-white dark:bg-card px-3 py-1 border-[#eae8df]">
              3 Report Modules Available
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid of Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: Class Attendance Reports */}
        {canViewClassReports && (
          <div
            onClick={() => setSelectedReport("class")}
            className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs hover:border-emerald-500/80 transition-all duration-200 cursor-pointer"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#2e694d] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
                <FileSpreadsheet className="w-5 h-5 text-white" strokeWidth={2.2} />
              </div>

              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-emerald-700 transition-colors">
                Class Attendance Reports
              </h3>
              <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
                Generate comprehensive class and section-level attendance registers, review monthly student presence percentages, and export printable rosters.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReport("class");
                }}
                className="w-full justify-between text-xs font-semibold shadow-xs bg-white hover:bg-emerald-50 text-slate-800 border-slate-200"
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Open Class Reports
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* CARD 2: Individual Student Attendance Reports */}
        {canViewIndividualReports && (
          <div
            onClick={() => setSelectedReport("individual")}
            className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs hover:border-blue-500/80 transition-all duration-200 cursor-pointer"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#1d4ed8] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
                <UserCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
              </div>

              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-blue-700 transition-colors">
                Individual Student Reports
              </h3>
              <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
                Search any student by name or roll number to inspect their full historical attendance log, day-by-day status breakdown, and attendance percentage.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReport("individual");
                }}
                className="w-full justify-between text-xs font-semibold shadow-xs bg-white hover:bg-blue-50 text-slate-800 border-slate-200"
              >
                <span className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  Open Student Reports
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* CARD 3: Missing Attendance Audit */}
        {canViewMissingAttendance && (
          <div
            onClick={() => setSelectedReport("missing")}
            className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs hover:border-rose-500/80 transition-all duration-200 cursor-pointer"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#b91c1c] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
                <AlertCircle className="w-5 h-5 text-white" strokeWidth={2.2} />
              </div>

              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-rose-700 transition-colors">
                Missing Attendance Audit
              </h3>
              <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
                Color-coded green/red grid tracking classes, section-wise status, subject breakdowns with responsible teacher names, and unmarked student lists.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReport("missing");
                }}
                className="w-full justify-between text-xs font-semibold shadow-xs bg-white hover:bg-rose-50 text-slate-800 border-slate-200"
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Open Missing Attendance Audit
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {!canViewClassReports && !canViewIndividualReports && !canViewMissingAttendance && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
          <AlertCircle className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">Access Restricted</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            You do not have permission to view any attendance reports. Please contact your system administrator.
          </p>
        </div>
      )}
    </div>
  );
}
