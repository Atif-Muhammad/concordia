import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/navigation.jsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  FileText,
  FileSpreadsheet,
  FileCheck,
  UserCheck,
  Search,
  Loader2,
  Printer,
  X,
  ArrowRight,
  GraduationCap,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { resolveFileUrl } from "@/lib/utils";
import {
  getProgramNames,
  getClasses,
  getSections,
  getAcademicSessions,
  getStudents,
  searchStudent,
  getStudentById,
} from "../../../config/apis";
import { StudentProfilePrintDialog } from "./StudentProfilePrintTemplate";
import { StudentDocumentReportDialog } from "./StudentDocumentReportTemplate";
import { StudentDataExportDialog } from "./StudentDataExportDialog";

export const StudentReportsTab = ({
  programData: propPrograms,
  classesData: propClasses,
  sectionsData: propSections,
  academicSessions: propSessions,
}) => {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData(["currentUser"]);

  const canViewDocReport = Boolean(
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "Super Admin" ||
    currentUser?.permissions?.all === true ||
    hasPermission(currentUser, "Students", "document-reports", "read") ||
    hasPermission(currentUser, "Students", "reports", "read")
  );

  const canViewDataExport = Boolean(
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "Super Admin" ||
    currentUser?.permissions?.all === true ||
    hasPermission(currentUser, "Students", "export-students", "read") ||
    hasPermission(currentUser, "Students", "reports", "read")
  );

  const canViewIndividualReport = Boolean(
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "Super Admin" ||
    currentUser?.permissions?.all === true ||
    hasPermission(currentUser, "Students", "individual-student-report", "read") ||
    hasPermission(currentUser, "Students", "reports", "read")
  );

  // Shared academic queries (use props if passed, otherwise fetch)
  const { data: programData = [] } = useQuery({
    queryKey: ["programs-with-classes"],
    queryFn: getProgramNames,
    enabled: !propPrograms || propPrograms.length === 0,
    initialData: propPrograms,
  });

  const { data: classesData = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
    enabled: !propClasses || propClasses.length === 0,
    initialData: propClasses,
  });

  const { data: sectionsData = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
    enabled: !propSections || propSections.length === 0,
    initialData: propSections,
  });

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: getAcademicSessions,
    enabled: !propSessions || propSessions.length === 0,
    initialData: propSessions,
  });

  // Modal open states
  const [docReportOpen, setDocReportOpen] = useState(false);
  const [dataExportOpen, setDataExportOpen] = useState(false);
  const [profilePrintOpen, setProfilePrintOpen] = useState(false);

  // Student search for Individual Student Report
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isLoadingStudentDetails, setIsLoadingStudentDetails] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Real-time debounced student search (searches by roll number or student name)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let results = [];
        // First try the specialized student search endpoint
        try {
          const res = await searchStudent(trimmed);
          if (Array.isArray(res)) {
            results = res;
          } else if (res && Array.isArray(res.students)) {
            results = res.students;
          } else if (res && Array.isArray(res.data)) {
            results = res.data;
          }
        } catch {
          // Fallback to getStudents query with searchQuery param
          const res = await getStudents({
            searchQuery: trimmed,
            status: "all",
            limit: 15,
          });
          results = Array.isArray(res) ? res : res?.students || res?.data || [];
        }

        setSearchResults(results || []);
      } catch (err) {
        console.error("Failed to search students for report:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Handle selecting a student from search results & opening individual report
  const handleSelectStudentForReport = async (student) => {
    setIsLoadingStudentDetails(true);
    try {
      const studentId = student?._id || student?.id;
      let fullStudent = student;
      if (studentId) {
        try {
          const fresh = await getStudentById(studentId);
          if (fresh) {
            fullStudent = fresh;
          }
        } catch (err) {
          console.warn("Could not fetch complete student details, using summary:", err);
        }
      }
      setSelectedStudent(fullStudent);
      setProfilePrintOpen(true);
    } finally {
      setIsLoadingStudentDetails(false);
    }
  };

  const getStudentProgramName = (s) => {
    if (!s) return "—";
    if (s.program?.name) return s.program.name;
    const pId = (s.programId?._id || s.programId?.id || s.programId || "").toString();
    const found = programData.find((p) => (p._id || p.id)?.toString() === pId);
    return found?.name || "—";
  };

  const getStudentClassName = (s) => {
    if (!s) return "—";
    if (s.class?.name) return s.class.name;
    const cId = (s.classId?._id || s.classId?.id || s.classId || "").toString();
    const found = classesData.find((c) => (c._id || c.id)?.toString() === cId);
    return found?.name || "—";
  };

  const getStudentSectionName = (s) => {
    if (!s) return "";
    if (s.section?.name) return s.section.name;
    const secId = (s.sectionId?._id || s.sectionId?.id || s.sectionId || "").toString();
    const found = sectionsData.find((sec) => (sec._id || sec.id)?.toString() === secId);
    return found?.name ? `(${found.name})` : "";
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10.5px] font-bold tracking-[0.2em] text-[#8c887b] dark:text-muted-foreground uppercase mb-1">
              STUDENT MANAGEMENT • EXPORTS &amp; AUDITS
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#22211f] dark:text-foreground">
              Student Reports &amp; Document Exports
            </h1>
            <p className="text-xs sm:text-[13px] text-[#66645d] dark:text-muted-foreground mt-1.5 leading-relaxed">
              Generate official document checklists, export institutional databases with fee installment plans, or search any student to build customizable individual profile reports.
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

      {/* Grid of Report Boxes (Matching Concordia ERP Navigation Boxes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* BOX 1: Document Submission Checklist Report */}
        {canViewDocReport && (
          <div className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs  hover:border-amber-400/80 transition-all duration-200">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#c85a17] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
                <FileCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
              </div>

              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-amber-700 transition-colors">
                Document Submission Report
              </h3>
              <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
                Audit mandatory and optional admission documents (Form B, Photographs, Matric &amp; Inter DMCs, Father CNIC, Affidavit) with program, class, and section level breakdown.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
              <Button
                onClick={() => setDocReportOpen(true)}
                className="w-full justify-between bg-white hover:bg-orange-50 text-slate-800 border border-slate-200 font-semibold text-xs shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-orange-600" />
                  Launch Document Report
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* BOX 2: Master Student Data Export */}
        {canViewDataExport && (
          <div className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs  hover:border-amber-400/80 transition-all duration-200">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#3d5a45] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
                <FileSpreadsheet className="w-5 h-5 text-white" strokeWidth={2.2} />
              </div>

              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-amber-700 transition-colors">
                Export Students Database
              </h3>
              <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
                Export complete student database records with fee installment schedules, personal info, contact details, and enrollment statuses directly to Excel (.xlsx) or formatted print layout.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
              <Button
                onClick={() => setDataExportOpen(true)}
                className="w-full justify-between bg-white hover:bg-emerald-50 text-slate-800 border border-slate-200 font-semibold text-xs shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Export Student Records
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* BOX 3: Individual Student Report Quick Launch */}
        {canViewIndividualReport && (
          <div className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs  hover:border-amber-400/80 transition-all duration-200">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#b88628] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
                <UserCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
              </div>

              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-amber-700 transition-colors">
                Individual Student Report
              </h3>
              <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
                Select specific sections and fields with live student preview data. Features real-time A4 document preview, customizable field checkboxes, and instant Excel / PDF export.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
              <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>Search student below to launch</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
              </div>
            </div>
          </div>
        )}
      </div>

      {!canViewDocReport && !canViewDataExport && !canViewIndividualReport && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
          <AlertCircle className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">Access Restricted</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            You do not have permission to view any student reports. Please contact your system administrator.
          </p>
        </div>
      )}

      {/* Dedicated Interactive Student Search for Individual Student Report */}
      {canViewIndividualReport && (
        <Card className="rounded-2xl border border-[#eae8df] dark:border-border bg-[#fdfcf8] dark:bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-[#f0eee6] dark:border-border/60 bg-white/70 dark:bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base sm:text-lg font-bold text-[#22211f] dark:text-foreground flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-600" />
                Individual Student Report — Search &amp; Launch
              </CardTitle>
              <CardDescription className="text-xs text-[#6e6b62] dark:text-muted-foreground">
                Search for any student by name or roll number to customize field selection and generate their profile report.
              </CardDescription>
            </div>

            {selectedStudent && (
              <Button
                size="sm"
                onClick={() => setProfilePrintOpen(true)}
                className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs w-full sm:w-auto"
              >
                <Printer className="w-3.5 h-3.5 text-orange-400" />
                Re-open {selectedStudent.fName || "Student"}'s Report
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Search Input Bar */}
          <div className="relative max-w-2xl">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search student by name or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-10 text-sm bg-white dark:bg-background border-slate-200 dark:border-border rounded-xl shadow-xs"
            />
            {isSearching ? (
              <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-amber-600" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Search Status & Results Display */}
          {searchQuery.trim().length >= 2 && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  Found <strong className="text-slate-800">{searchResults.length}</strong> matching students for "{searchQuery}"
                </span>
                <span className="text-[11px] text-slate-400">
                  Click any student to open report dialog
                </span>
              </div>

              {searchResults.length === 0 && !isSearching ? (
                <div className="p-8 text-center border rounded-xl bg-white border-dashed border-slate-200">
                  <p className="text-sm font-medium text-slate-700">No students found matching "{searchQuery}"</p>
                  <p className="text-xs text-slate-400 mt-1">Please verify the roll number or spelling of the student's name.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchResults.map((student) => {
                    const sId = student._id || student.id;
                    const studentName = `${student.fName || ""} ${student.lName || ""}`.trim() || student.name || "Student";
                    const rollNo = student.rollNumber || "No Roll #";
                    const father = student.fatherOrguardian || student.fatherName || "—";
                    const progName = getStudentProgramName(student);
                    const className = getStudentClassName(student);
                    const secName = getStudentSectionName(student);
                    const status = student.status || "ACTIVE";

                    return (
                      <div
                        key={sId}
                        onClick={() => handleSelectStudentForReport(student)}
                        className="group p-3.5 rounded-xl border border-slate-200 hover:border-amber-500/80 bg-white hover:bg-amber-50/20 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10 border border-slate-200 shrink-0">
                            <AvatarImage src={resolveFileUrl(student.picture || student.studentPhoto)} />
                            <AvatarFallback className="bg-amber-100 text-amber-800 font-bold text-xs">
                              {studentName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate group-hover:text-amber-700 transition-colors">
                                {studentName}
                              </h4>
                              <Badge
                                variant={status === "ACTIVE" ? "default" : "secondary"}
                                className="text-[9px] uppercase px-1.5 py-0 shrink-0"
                              >
                                {status}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                {rollNo}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate">
                                s/o {father}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 mt-1.5 truncate">
                              {progName} • {className} {secName}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-amber-700">
                          <span className="flex items-center gap-1">
                            <Printer className="w-3 h-3" /> Customize &amp; Print Report
                          </span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Currently Selected Student Card if open */}
          {selectedStudent && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {selectedStudent.fName} {selectedStudent.lName}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs bg-white">
                      {selectedStudent.rollNumber || "No Roll"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {getStudentProgramName(selectedStudent)} • {getStudentClassName(selectedStudent)} {getStudentSectionName(selectedStudent)}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => setProfilePrintOpen(true)}
                className="gap-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                Open Report with Field Selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* DIALOG 1: DOCUMENT SUBMISSION REPORT DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      <StudentDocumentReportDialog
        open={docReportOpen}
        onOpenChange={setDocReportOpen}
        programData={programData}
        classesData={classesData}
        sectionsData={sectionsData}
        academicSessions={academicSessions}
        status="ACTIVE"
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* DIALOG 2: MASTER STUDENT DATA EXPORT DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      <StudentDataExportDialog
        open={dataExportOpen}
        onOpenChange={setDataExportOpen}
        programData={programData}
        classesData={classesData}
        sectionsData={sectionsData}
        academicSessions={academicSessions}
        status="ACTIVE"
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* DIALOG 3: INDIVIDUAL STUDENT REPORT EXPORT DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      <StudentProfilePrintDialog
        open={profilePrintOpen}
        onOpenChange={setProfilePrintOpen}
        student={selectedStudent}
        programData={programData}
        classesData={classesData}
        sectionsData={sectionsData}
        academicSessions={academicSessions}
        isNewlyCreated={false}
      />
    </div>
  );
};

export default StudentReportsTab;
