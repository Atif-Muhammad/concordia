import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  Calendar,
  RotateCcw,
  User,
  Users,
  GraduationCap,
  BookOpen,
  FileSpreadsheet,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProgramNames,
  getAcademicSessions,
  getMissingAttendanceClassesSummary,
  getMissingAttendanceSubjectsSummary,
  getMissingAttendanceStudentsSummary,
} from "../../../config/apis";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return String(val._id || val.id || "");
  return String(val);
};

export default function MissingAttendanceReportTab({ onBack }) {
  // Navigation drilldown state (no "steps" mentioned in UI)
  // viewLevel: "classes" | "subjects" | "students"
  const [viewLevel, setViewLevel] = useState("classes");
  const [selectedClassSection, setSelectedClassSection] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // Global report filters
  const [selectedProgramId, setSelectedProgramId] = useState("*");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedSessionId, setSelectedSessionId] = useState("all");

  // Level 3 table filters
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Query programs
  const { data: programs = [], isLoading: isLoadingPrograms } = useQuery({
    queryKey: ["programs"],
    queryFn: getProgramNames,
  });

  // Query academic sessions
  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  // Pre-select active academic session
  useEffect(() => {
    if (academicSessions?.length > 0 && (selectedSessionId === "all" || !selectedSessionId)) {
      const active = academicSessions.find((s) => s.isActive || s.status === "ACTIVE");
      if (active) {
        setSelectedSessionId(String(active.id || active._id));
      }
    }
  }, [academicSessions]);

  // Level 1: Classes & Sections Summary Query
  const {
    data: classesSummaryData,
    isLoading: isLoadingClasses,
    isFetching: isFetchingClasses,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: [
      "missingAttendanceClassesSummary",
      selectedProgramId,
      selectedDate,
      selectedSessionId,
    ],
    queryFn: () =>
      getMissingAttendanceClassesSummary({
        programId: selectedProgramId !== "*" ? selectedProgramId : undefined,
        date: selectedDate,
        sessionId: selectedSessionId !== "all" ? selectedSessionId : undefined,
      }),
    enabled: viewLevel === "classes",
  });

  // Level 2: Subjects Summary Query
  const {
    data: subjectsSummaryData,
    isLoading: isLoadingSubjects,
    isFetching: isFetchingSubjects,
    refetch: refetchSubjects,
  } = useQuery({
    queryKey: [
      "missingAttendanceSubjectsSummary",
      selectedClassSection?.classId,
      selectedClassSection?.sectionId,
      selectedDate,
      selectedSessionId,
    ],
    queryFn: () =>
      getMissingAttendanceSubjectsSummary({
        classId: selectedClassSection?.classId,
        sectionId: selectedClassSection?.sectionId || undefined,
        date: selectedDate,
        sessionId: selectedSessionId !== "all" ? selectedSessionId : undefined,
      }),
    enabled: viewLevel === "subjects" && !!selectedClassSection?.classId,
  });

  // Level 3: Students Summary Query
  const {
    data: studentsSummaryData,
    isLoading: isLoadingStudents,
    isFetching: isFetchingStudents,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: [
      "missingAttendanceStudentsSummary",
      selectedClassSection?.classId,
      selectedClassSection?.sectionId,
      selectedSubject?.subjectId,
      selectedDate,
      selectedSessionId,
    ],
    queryFn: () =>
      getMissingAttendanceStudentsSummary({
        classId: selectedClassSection?.classId,
        sectionId: selectedClassSection?.sectionId || undefined,
        subjectId: selectedSubject?.subjectId,
        date: selectedDate,
        sessionId: selectedSessionId !== "all" ? selectedSessionId : undefined,
      }),
    enabled:
      viewLevel === "students" &&
      !!selectedClassSection?.classId &&
      !!selectedSubject?.subjectId,
  });

  // Level 1 -> Level 2 transition
  const handleSelectClassSection = (unit) => {
    setSelectedClassSection(unit);
    setViewLevel("subjects");
  };

  // Level 2 -> Level 3 transition
  const handleSelectSubject = (subject) => {
    setSelectedSubject(subject);
    setViewLevel("students");
  };

  // Back Navigation Handlers
  const handleBackToClasses = () => {
    setViewLevel("classes");
    setSelectedSubject(null);
  };

  const handleBackToSubjects = () => {
    setViewLevel("subjects");
  };

  // Filtered students for Level 3 table
  const filteredStudents = (studentsSummaryData?.students || []).filter((s) => {
    if (statusFilter !== "ALL") {
      if (statusFilter === "MISSING" && !s.isMissing) return false;
      if (statusFilter !== "MISSING") {
        if (s.isMissing) return false;
        if (String(s.status).toUpperCase() !== statusFilter) return false;
      }
    }

    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase();
      const matchRoll = (s.rollNumber || "").toLowerCase().includes(q);
      const matchName = (s.studentName || "").toLowerCase().includes(q);
      const matchFather = (s.fatherName || "").toLowerCase().includes(q);
      return matchRoll || matchName || matchFather;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Header & Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          {viewLevel === "classes" && onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="gap-1.5 text-xs font-semibold shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Reports
            </Button>
          )}

          {viewLevel === "subjects" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToClasses}
              className="gap-1.5 text-xs font-semibold shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Classes
            </Button>
          )}

          {viewLevel === "students" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToSubjects}
              className="gap-1.5 text-xs font-semibold shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Subjects
            </Button>
          )}

          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1">
            <span
              onClick={handleBackToClasses}
              className={`hover:text-foreground cursor-pointer ${
                viewLevel === "classes" ? "font-bold text-foreground" : ""
              }`}
            >
              Classes Overview
            </span>

            {selectedClassSection && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                <span
                  onClick={handleBackToSubjects}
                  className={`hover:text-foreground cursor-pointer ${
                    viewLevel === "subjects" ? "font-bold text-foreground" : ""
                  }`}
                >
                  {selectedClassSection.displayName}
                </span>
              </>
            )}

            {selectedSubject && viewLevel === "students" && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                <span className="font-bold text-foreground">
                  {selectedSubject.subjectName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Global Filter Bar (Only active when in Level 1 or read-only badge in Level 2/3) */}
        {viewLevel === "classes" ? (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Program Filter */}
            <div className="w-48 sm:w-56">
              <Select
                value={selectedProgramId}
                onValueChange={setSelectedProgramId}
                disabled={isLoadingPrograms}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Programs</SelectItem>
                  {programs.map((p) => {
                    const id = extractId(p);
                    const name = p.name || p.programName || "Program";
                    return (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="relative">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>

            {/* Session Filter */}
            {academicSessions.length > 0 && (
              <div className="w-36">
                <Select
                  value={selectedSessionId}
                  onValueChange={setSelectedSessionId}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {academicSessions.map((s) => (
                      <SelectItem key={s._id || s.id} value={s._id || s.id}>
                        {s.name || s.sessionName || "Session"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchClasses()}
              className="h-8 px-2 text-xs"
              title="Refresh Attendance Summary"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-mono text-xs gap-1.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Date: {selectedDate}
            </Badge>
          </div>
        )}
      </div>

      {/* =========================================================================
          LEVEL 1: CLASSES & SECTIONS GRID VIEW
          ========================================================================= */}
      {viewLevel === "classes" && (
        <div className="space-y-5">
          {/* Summary Metric Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="shadow-2xs border-border/80 bg-card rounded-2xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Total Classes / Sections
                  </p>
                  <h3 className="text-2xl font-bold mt-1 text-foreground">
                    {isLoadingClasses ? (
                      <Skeleton className="h-8 w-14" />
                    ) : (
                      classesSummaryData?.summary?.totalUnits || 0
                    )}
                  </h3>
                </div>
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Layers className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-2xs border-emerald-200 dark:border-emerald-950 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-2xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                    All Subjects Marked
                  </p>
                  <h3 className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">
                    {isLoadingClasses ? (
                      <Skeleton className="h-8 w-14" />
                    ) : (
                      classesSummaryData?.summary?.completeUnits || 0
                    )}
                  </h3>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-2xs border-rose-200 dark:border-rose-950 bg-rose-50/30 dark:bg-rose-950/20 rounded-2xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-400">
                    Missing Attendance
                  </p>
                  <h3 className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-300">
                    {isLoadingClasses ? (
                      <Skeleton className="h-8 w-14" />
                    ) : (
                      classesSummaryData?.summary?.missingUnits || 0
                    )}
                  </h3>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-600/10 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-2xs border-slate-200 dark:border-border bg-slate-50/50 dark:bg-card/50 rounded-2xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    No Students Enrolled
                  </p>
                  <h3 className="text-2xl font-bold mt-1 text-muted-foreground">
                    {isLoadingClasses ? (
                      <Skeleton className="h-8 w-14" />
                    ) : (
                      classesSummaryData?.summary?.noStudentsUnits || 0
                    )}
                  </h3>
                </div>
                <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                  <Users className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cards Grid Skeleton Loader */}
          {isLoadingClasses && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-28 rounded-md" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="pt-2 border-t border-border/60">
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoadingClasses && (!classesSummaryData?.units || classesSummaryData.units.length === 0) && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
              <Layers className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">No Classes Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No classes or sections match the selected program filter. Try selecting "All Programs" or a different date.
              </p>
            </div>
          )}

          {/* Classes & Sections Grid */}
          {!isLoadingClasses && classesSummaryData?.units?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {classesSummaryData.units.map((unit, idx) => {
                const isNoStudents = unit.isNoStudents || unit.status === "NO_STUDENTS" || unit.totalStudents === 0;
                const isGreen = !isNoStudents && unit.isComplete;

                if (isNoStudents) {
                  return (
                    <div
                      key={`${unit.classId}-${unit.sectionId || 'nosec'}-${idx}`}
                      onClick={() => handleSelectClassSection(unit)}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-border bg-slate-50/70 dark:bg-card/50 p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-2xs hover:border-slate-400 dark:hover:border-slate-600"
                    >
                      <div>
                        {/* Status Header Badge (Gray / Neutral) */}
                        <div className="flex items-center justify-between gap-2 mb-3.5">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-[11px] font-bold tracking-tight text-slate-500 dark:text-slate-400">
                              No Students Enrolled
                            </span>
                          </div>

                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono px-2 py-0.5 border bg-slate-100 dark:bg-muted text-slate-500 dark:text-slate-400 border-slate-200 dark:border-border"
                          >
                            0 Enrolled
                          </Badge>
                        </div>

                        {/* Program Name */}
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 truncate">
                          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{unit.programName || "General Program"}</span>
                        </div>

                        {/* Class Title */}
                        <h4 className="font-bold text-base text-slate-700 dark:text-slate-300 tracking-tight">
                          {unit.className}
                        </h4>
                        {unit.sectionName && (
                          <p className="text-xs font-medium text-slate-400 mt-0.5">
                            Section: <span className="text-slate-600 dark:text-slate-300 font-semibold">{unit.sectionName}</span>
                          </p>
                        )}

                        {/* Informative Disabled Message */}
                        <div className="mt-4 p-3 rounded-xl bg-slate-100/80 dark:bg-muted/40 border border-slate-200/60 dark:border-border text-xs text-slate-500 font-medium leading-relaxed">
                          No active students enrolled. Attendance is not applicable.
                        </div>
                      </div>

                      {/* Bottom Action Footer: Small Circle Arrow */}
                      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-border/60 flex items-center justify-end">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 dark:bg-muted text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-border group-hover:bg-slate-200 dark:group-hover:bg-muted/80 transition-colors shadow-2xs"
                        >
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`${unit.classId}-${unit.sectionId || 'nosec'}-${idx}`}
                    onClick={() => handleSelectClassSection(unit)}
                    className={`group relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md ${
                      isGreen
                        ? "bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-500"
                        : "bg-rose-50/20 dark:bg-rose-950/10 border-rose-300 dark:border-rose-800/60 hover:border-rose-500"
                    }`}
                  >
                    <div>
                      {/* Status Header Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3.5">
                        <div className="flex items-center gap-1.5">
                          {isGreen ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          )}
                          <span className="text-[11px] font-bold tracking-tight">
                            {isGreen ? (
                              <span className="text-emerald-700 dark:text-emerald-400">
                                Complete
                              </span>
                            ) : (
                              <span className="text-rose-700 dark:text-rose-400">
                                Missing Attendance
                              </span>
                            )}
                          </span>
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono px-2 py-0.5 border ${
                            isGreen
                              ? "bg-emerald-100/60 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                              : "bg-rose-100/60 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300"
                          }`}
                        >
                          {unit.markedSubjects} / {unit.totalSubjects} Subjects
                        </Badge>
                      </div>

                      {/* Program Name */}
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary/80 dark:text-primary mb-1 truncate">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{unit.programName || "General Program"}</span>
                      </div>

                      {/* Class Title */}
                      <h4 className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
                        {unit.className}
                      </h4>
                      {unit.sectionName && (
                        <p className="text-xs font-medium text-muted-foreground mt-0.5">
                          Section: <span className="text-foreground font-semibold">{unit.sectionName}</span>
                        </p>
                      )}

                      {/* Enrolled Students & Subject Counts */}
                      <div className="mt-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Active Students:</span>
                          <span className="font-semibold text-foreground">
                            {unit.totalStudents} enrolled
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Marked Subjects:</span>
                          <span
                            className={`font-semibold ${
                              isGreen
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {unit.markedSubjects} of {unit.totalSubjects}
                          </span>
                        </div>

                        {unit.missingSubjects > 0 && (
                          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
                            <span>Pending Subjects:</span>
                            <span className="font-bold">
                              {unit.missingSubjects} missing
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Footer: Small Circle Arrow */}
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-end">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 shadow-2xs ${
                          isGreen
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 dark:group-hover:bg-emerald-600 dark:group-hover:text-white"
                            : "bg-rose-50 text-rose-800 border border-rose-200 group-hover:bg-rose-600 group-hover:text-white dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 dark:group-hover:bg-rose-600 dark:group-hover:text-white"
                        }`}
                      >
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          LEVEL 2: SUBJECT-WISE GRID VIEW
          ========================================================================= */}
      {viewLevel === "subjects" && (
        <div className="space-y-5">
          {/* Context Banner */}
          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {selectedClassSection?.programName || subjectsSummaryData?.program?.name || "General Program"}
                </span>
                <h3 className="font-bold text-lg text-foreground">
                  {selectedClassSection?.className}
                  {selectedClassSection?.sectionName ? ` — Section ${selectedClassSection.sectionName}` : ""}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Auditing subject-wise attendance for {selectedDate}. Inspect responsible teachers and missing student counts.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-xs py-1 px-3">
                {subjectsSummaryData?.totalStudents ?? selectedClassSection?.totalStudents ?? 0} Active Students
              </Badge>
              {subjectsSummaryData?.isNoStudents || (subjectsSummaryData?.totalStudents === 0) ? (
                <Badge variant="secondary" className="text-xs py-1 px-3 font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  No Enrolled Students
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={`text-xs py-1 px-3 font-semibold ${
                    subjectsSummaryData?.summary?.missingSubjects === 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-rose-50 text-rose-700 border-rose-300"
                  }`}
                >
                  {subjectsSummaryData?.summary?.completeSubjects ?? 0} /{" "}
                  {subjectsSummaryData?.summary?.totalSubjects ?? 0} Subjects Complete
                </Badge>
              )}
            </div>
          </div>

          {/* Skeleton Loader for Level 2 */}
          {isLoadingSubjects && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32 rounded-md" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <div className="pt-2 border-t border-border/60">
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoadingSubjects && (!subjectsSummaryData?.subjects || subjectsSummaryData.subjects.length === 0) && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
              <BookOpen className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">No Subjects Mapped</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                This class does not currently have any subjects mapped in the academic setup.
              </p>
            </div>
          )}

          {/* Subject-wise Green/Red Boxes */}
          {!isLoadingSubjects && subjectsSummaryData?.subjects?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectsSummaryData.subjects.map((sub, idx) => {
                const isNoStudents = sub.isNoStudents || sub.status === 'NO_STUDENTS' || (sub.totalStudents === 0);

                if (isNoStudents) {
                  return (
                    <div
                      key={`${sub.subjectId}-${idx}`}
                      className="group relative overflow-hidden rounded-2xl border border-slate-300/80 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 p-5 flex flex-col justify-between shadow-2xs opacity-85 hover:opacity-100 transition-all duration-200"
                    >
                      <div>
                        {/* Status Header Badge */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <Info className="w-4 h-4 shrink-0" />
                            <span className="text-[11px] font-bold tracking-tight">
                              No Students Enrolled
                            </span>
                          </div>

                          {sub.subjectCode && (
                            <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
                              {sub.subjectCode}
                            </Badge>
                          )}
                        </div>

                        {/* Subject Name */}
                        <h4 className="font-bold text-base text-foreground/80 tracking-tight">
                          {sub.subjectName}
                        </h4>

                        {/* Responsible Teacher */}
                        <div className="mt-3 p-2.5 rounded-xl bg-white/50 dark:bg-card/50 border border-border/50">
                          <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            Responsible Teacher
                          </p>
                          <p className={`text-xs font-semibold mt-0.5 truncate ${
                            sub.teacherName && sub.teacherName !== "Not Assigned"
                              ? "text-foreground/80"
                              : "text-amber-600 dark:text-amber-400 font-medium italic"
                          }`}>
                            {sub.teacherName || "Not Assigned"}
                          </p>
                        </div>

                        {/* Inactive Notice */}
                        <div className="mt-3.5 p-2.5 rounded-xl bg-slate-200/50 dark:bg-slate-800/40 text-[11px] text-muted-foreground leading-relaxed">
                          Attendance is not required because this class currently has 0 active students enrolled.
                        </div>
                      </div>

                      {/* Disabled Button */}
                      <div className="mt-5 pt-3 border-t border-border/40">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="w-full justify-between text-xs text-muted-foreground font-medium h-8 px-2.5 cursor-not-allowed opacity-60"
                        >
                          <span>No Records Available</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                const isGreen = sub.isComplete;
                return (
                  <div
                    key={`${sub.subjectId}-${idx}`}
                    onClick={() => handleSelectSubject(sub)}
                    className={`group relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md ${
                      isGreen
                        ? "bg-emerald-50/25 dark:bg-emerald-950/15 border-emerald-300 dark:border-emerald-800/70 hover:border-emerald-500"
                        : "bg-rose-50/25 dark:bg-rose-950/15 border-rose-300 dark:border-rose-800/70 hover:border-rose-500"
                    }`}
                  >
                    <div>
                      {/* Status & Badge Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5">
                          {isGreen ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          )}
                          <span
                            className={`text-xs font-bold ${
                              isGreen
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-rose-700 dark:text-rose-400"
                            }`}
                          >
                            {isGreen ? "All Marked (Complete)" : `${sub.missingStudents} Missing`}
                          </span>
                        </div>

                        {sub.subjectCode && (
                          <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
                            {sub.subjectCode}
                          </Badge>
                        )}
                      </div>

                      {/* Subject Name */}
                      <h4 className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
                        {sub.subjectName}
                      </h4>

                      {/* RESPONSIBLE TEACHER NAME */}
                      <div className="mt-3 p-2.5 rounded-xl bg-white/70 dark:bg-card/70 border border-border/60">
                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1">
                          <User className="w-3 h-3 text-primary" />
                          Responsible Teacher
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 truncate ${
                          sub.teacherName && sub.teacherName !== "Not Assigned"
                            ? "text-foreground"
                            : "text-amber-600 dark:text-amber-400 font-medium italic"
                        }`}>
                          {sub.teacherName || "Not Assigned"}
                        </p>
                      </div>

                      {/* Student Attendance Numbers */}
                      <div className="mt-3.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Marked Records:</span>
                          <span className="font-semibold text-foreground">
                            {sub.markedStudents} / {sub.totalStudents} Students
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isGreen ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                            style={{
                              width: `${
                                sub.totalStudents > 0
                                  ? Math.min(100, Math.round((sub.markedStudents / sub.totalStudents) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-5 pt-3 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`w-full justify-between text-xs font-semibold h-8 px-2.5 transition-colors ${
                          isGreen
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-600 dark:hover:text-white"
                            : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-600 hover:text-white dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 dark:hover:bg-rose-600 dark:hover:text-white"
                        }`}
                      >
                        <span>Inspect Student Records</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          LEVEL 3: STUDENT ATTENDANCE TABLE VIEW
          ========================================================================= */}
      {viewLevel === "students" && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <BookOpen className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {selectedClassSection?.programName || studentsSummaryData?.program?.name || "General Program"}
                  </span>
                  <h3 className="font-bold text-lg text-foreground">
                    {selectedSubject?.subjectName}{" "}
                    {selectedSubject?.subjectCode && `(${selectedSubject.subjectCode})`}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Class: <span className="font-semibold text-foreground">{selectedClassSection?.className}{selectedClassSection?.sectionName ? ` — Section ${selectedClassSection.sectionName}` : ""}</span> •
                  Date: <span className="font-semibold text-foreground">{selectedDate}</span> •
                  Responsible Teacher: <span className="font-semibold text-foreground">{studentsSummaryData?.assignedTeacher || selectedSubject?.teacherName || "Not Assigned"}</span>
                </p>
              </div>

              {/* Status Breakdown Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs py-1">
                  Total: {studentsSummaryData?.summary?.totalStudents ?? 0}
                </Badge>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs py-1">
                  Present: {studentsSummaryData?.summary?.presentCount ?? 0}
                </Badge>
                <Badge className="bg-rose-600 hover:bg-rose-600 text-white text-xs py-1">
                  Absent: {studentsSummaryData?.summary?.absentCount ?? 0}
                </Badge>
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs py-1">
                  Leave: {studentsSummaryData?.summary?.leaveCount ?? 0}
                </Badge>
                {(studentsSummaryData?.summary?.missingCount ?? 0) > 0 && (
                  <Badge variant="destructive" className="bg-red-600 text-white font-bold text-xs py-1 animate-pulse">
                    Missing: {studentsSummaryData?.summary?.missingCount}
                  </Badge>
                )}
              </div>
            </div>

            {/* In-Table Filter & Search Toolbar */}
            <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <Input
                  placeholder="Search student name or roll..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground shrink-0">Filter Status:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Students</SelectItem>
                    <SelectItem value="MISSING">Missing Only</SelectItem>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="LEAVE">Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-16 font-bold text-xs">#</TableHead>
                  <TableHead className="font-bold text-xs">Roll Number</TableHead>
                  <TableHead className="font-bold text-xs">Student Name</TableHead>
                  <TableHead className="font-bold text-xs">Father Name</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="font-bold text-xs">Recorded At</TableHead>
                  <TableHead className="font-bold text-xs">Marked By</TableHead>
                  <TableHead className="font-bold text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoadingStudents && (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                )}

                {!isLoadingStudents && filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                      No student records match the active search or status filter.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoadingStudents && filteredStudents.map((st, idx) => {
                  const isMissing = st.isMissing;
                  const statusUpper = String(st.status || "").toUpperCase();

                  return (
                    <TableRow
                      key={st.studentId || idx}
                      className={isMissing ? "bg-rose-50/30 dark:bg-rose-950/20" : ""}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-xs text-foreground">
                        {st.rollNumber || "—"}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        {st.studentName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {st.fatherName || "—"}
                      </TableCell>
                      <TableCell>
                        {isMissing ? (
                          <Badge
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-600 text-white font-bold text-[10px] uppercase gap-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            Unmarked / Missing
                          </Badge>
                        ) : statusUpper === "PRESENT" ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold text-[10px]">
                            Present
                          </Badge>
                        ) : statusUpper === "ABSENT" ? (
                          <Badge className="bg-rose-600 hover:bg-rose-600 text-white font-semibold text-[10px]">
                            Absent
                          </Badge>
                        ) : statusUpper === "LEAVE" ? (
                          <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-semibold text-[10px]">
                            Leave
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {statusUpper || "Unknown"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {st.markedAt
                          ? format(new Date(st.markedAt), "hh:mm a")
                          : isMissing
                          ? "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {st.markedByName && st.markedByName !== "—" ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span>{st.markedByName}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {st.notes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
