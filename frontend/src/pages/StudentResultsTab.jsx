import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { FileUser, Printer, Search, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getStudents, searchStudent, getClasses, getSections, getSubjects } from "../../config/apis";
import { extractId } from "@/lib/utils.jsx";
import {
  isStudentActive,
  getStudentStatusCode,
  formatStudentStatusLabel,
  getStudentStatusTextTone,
} from "@/lib/studentStatus";
import { formatNormalizedFullName } from "@/lib/studentSearch";
import { CheckboxMultiSelect } from "@/components/ui/CheckboxMultiSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";

const formatDateDisplay = (dateString) => {
  if (!dateString) return "";
  const clean = dateString.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  return clean;
};

export const StudentResultsTab = ({
  programs = [],
  classesData: propClassesData,
  students,
  exams = [],
  isLoadingExams = false,
  studentResultProgram,
  setStudentResultProgram,
  studentResultClass,
  setStudentResultClass,
  studentResultSection,
  setStudentResultSection,
  studentResultProgramIds: propProgramIds,
  setStudentResultProgramIds: propSetProgramIds,
  studentResultClassIds: propClassIds,
  setStudentResultClassIds: propSetClassIds,
  studentResultSectionIds: propSectionIds,
  setStudentResultSectionIds: propSetSectionIds,
  studentResultStudent,
  setStudentResultStudent,
  studentResultExam,
  setStudentResultExam,
  studentResultData,
  studentResultMutation,
  printStudentResult,
  getFullName,
}) => {
  // Normalize multi-select props
  const selectedProgIds = useMemo(() => {
    if (Array.isArray(propProgramIds)) return propProgramIds;
    if (studentResultProgram) return [studentResultProgram];
    return [];
  }, [propProgramIds, studentResultProgram]);

  const handleProgChange = (newIds) => {
    if (propSetProgramIds) propSetProgramIds(newIds);
    else if (setStudentResultProgram) setStudentResultProgram(newIds[0] || "");
    if (setStudentResultStudent) setStudentResultStudent("");
    if (setStudentResultExam) setStudentResultExam("");
  };

  const selectedClassIds = useMemo(() => {
    if (Array.isArray(propClassIds)) return propClassIds;
    if (studentResultClass) return [studentResultClass];
    return [];
  }, [propClassIds, studentResultClass]);

  const handleClassChange = (newIds) => {
    if (propSetClassIds) propSetClassIds(newIds);
    else if (setStudentResultClass) setStudentResultClass(newIds[0] || "");
    if (setStudentResultStudent) setStudentResultStudent("");
    if (setStudentResultExam) setStudentResultExam("");
  };

  const selectedSectionIds = useMemo(() => {
    if (Array.isArray(propSectionIds)) return propSectionIds;
    if (studentResultSection && studentResultSection !== "*") return [studentResultSection];
    return [];
  }, [propSectionIds, studentResultSection]);

  const handleSectionChange = (newIds) => {
    if (propSetSectionIds) propSetSectionIds(newIds);
    else if (setStudentResultSection) setStudentResultSection(newIds[0] || "");
  };

  // Local State for Search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Classes & Sections Queries
  const { data: queryClasses = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
    enabled: !propClassesData,
  });
  const classesData = propClassesData || queryClasses;

  const { data: sectionsData = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjects,
  });

  const examOptions = useMemo(() => {
    return (exams || []).map((exam) => {
      const eId = extractId(exam.id || exam._id);
      const progName = exam.program?.name || exam.programId?.name || "";
      const clsName = exam.class?.name || exam.classId?.name || "";
      const sessionName = exam.session || exam.sessionId?.name || "";
      const dateStr = formatDateDisplay(exam.startDate);
      const label = `${exam.examName}${clsName ? ` — ${clsName}` : ""}${progName ? ` (${progName})` : ""}${sessionName ? ` [${sessionName}]` : ""}`;
      return {
        value: eId,
        label,
        keywords: `${exam.examName} ${progName} ${clsName} ${sessionName} ${dateStr}`,
      };
    });
  }, [exams]);

  const selectedExamObj = useMemo(() => {
    return (exams || []).find((e) => extractId(e.id || e._id) === studentResultExam);
  }, [exams, studentResultExam]);

  const examClassId = extractId(
    selectedExamObj?.classId || selectedExamObj?.class || selectedClassIds[0]
  );
  const selectedClassObj = classesData.find((c) => extractId(c.id || c._id) === examClassId) || selectedExamObj?.class;
  const allowSections = selectedClassObj ? selectedClassObj.allowSections !== false : true;

  // Get available sections based on selected class
  const availableSections = useMemo(() => {
    if (!examClassId || !allowSections) return [];
    return sectionsData.filter((s) => extractId(s.classId || s.class) === examClassId);
  }, [examClassId, allowSections, sectionsData]);

  const sectionOptions = useMemo(() => {
    return availableSections.map((sec) => ({
      value: extractId(sec.id || sec._id),
      label: sec.name || sec.sectionName || "Section",
    }));
  }, [availableSections]);

  // --- Data Fetching ---

  const searchTerm = debouncedSearch.trim();
  const isSearchActive = searchTerm.length >= 2;

  // 1. Search Query (across all student statuses)
  const { data: searchResultsData } = useQuery({
    queryKey: ["searchStudent", searchTerm, "all"],
    queryFn: () => searchStudent(searchTerm, { status: "all" }),
    enabled: isSearchActive,
  });

  // 2. Class Students Query
  const { data: classStudentsData } = useQuery({
    queryKey: [
      "classStudentsResultTab",
      examClassId,
      studentResultSection,
    ],
    queryFn: () =>
      getStudents({
        classId: examClassId || undefined,
        sectionId: allowSections && studentResultSection && studentResultSection !== "*" ? studentResultSection : undefined,
        status: "ACTIVE",
        page: 1,
        limit: 1000,
      }),
    enabled: !!examClassId && !isSearchActive,
  });

  // Determine which list to show
  const rawList = isSearchActive
    ? Array.isArray(searchResultsData)
      ? searchResultsData
      : searchResultsData?.students || []
    : Array.isArray(classStudentsData)
    ? classStudentsData
    : classStudentsData?.students || [];

  const displayStudents = (Array.isArray(rawList) ? rawList : [])
    .filter((student) => isSearchActive || isStudentActive(student))
    .filter((student) => {
      if (!isSearchActive) return true;
      if (examClassId) {
        const clsId = extractId(student.classId || student.class?.id || student.class?._id);
        if (clsId && clsId !== examClassId) return false;
      }
      return true;
    });

  // Get available exams for selected student (only exams for their class or program)
  const availableExams = studentResultStudent
    ? exams?.filter((exam) => {
        const student = displayStudents?.find(
          (s) => extractId(s.id || s._id) === studentResultStudent
        );
        if (!student) return true;
        const studentClassId = extractId(student.classId || student.class?.id || student.class?._id);
        const exClassId = extractId(exam.classId || exam.class?.id || exam.class?._id);
        return !exClassId || exClassId === studentClassId;
      }) || []
    : (exams || []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUser className="w-5 h-5" />
          Student Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Bar */}
        <div className="flex items-center space-x-2 bg-secondary/20 p-2 rounded-md border border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search student by name, father name, or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 bg-transparent"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Exam Filter */}
          <div className="space-y-2">
            <Label>Select Exam *</Label>
            <SearchableSelect
              options={examOptions}
              value={studentResultExam}
              onChange={(val) => {
                setStudentResultExam(val);
                setStudentResultStudent("");
                if (setStudentResultSection) setStudentResultSection("");
              }}
              allowAll={false}
              placeholder="Select Exam"
              isLoading={isLoadingExams}
              searchPlaceholder="Search exam name, class, program..."
            />
          </div>

          {/* Section Filter (Optional) */}
          <div className="space-y-2">
            <Label>Select Section (Optional)</Label>
            {!allowSections ? (
              <div className="h-9 px-3 py-2 border rounded-md bg-muted text-muted-foreground text-xs flex items-center">
                Sections Not Applicable
              </div>
            ) : (
              <Select
                value={studentResultSection || "*"}
                onValueChange={(val) => {
                  if (setStudentResultSection) setStudentResultSection(val === "*" ? "" : val);
                  setStudentResultStudent("");
                }}
                disabled={!examClassId}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={!examClassId ? "Select exam first" : "All Sections"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Sections</SelectItem>
                  {availableSections.map((sec) => (
                    <SelectItem key={extractId(sec.id || sec._id)} value={extractId(sec.id || sec._id)}>
                      {sec.name || sec.sectionName || "Section"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Student Filter */}
          <div className="space-y-2">
            <Label>Select Student *</Label>
            <Select
              value={studentResultStudent}
              onValueChange={(v) => {
                setStudentResultStudent(v);
              }}
              disabled={
                (!isSearchActive && !examClassId) ||
                displayStudents.length === 0
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue
                  placeholder={
                    isSearchActive
                      ? displayStudents.length > 0
                        ? `Select from ${displayStudents.length} result${displayStudents.length === 1 ? "" : "s"}`
                        : "No matching students found"
                      : examClassId
                      ? displayStudents.length > 0
                        ? "Select student"
                        : "No active students in class"
                      : "Select exam or search above"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {displayStudents.length > 0 ? (
                  displayStudents.map((student) => {
                    const sId = extractId(student.id || student._id);
                    const fullName = getFullName
                      ? getFullName(student)
                      : formatNormalizedFullName(student?.fName, student?.lName);
                    const statusCode = getStudentStatusCode(student);
                    const statusLabel = formatStudentStatusLabel(statusCode);
                    const { textClass } = getStudentStatusTextTone(statusCode);
                    return (
                      <SelectItem key={sId} value={sId}>
                        <span>{fullName} ({student.rollNumber || "No Roll #"})</span>
                        <span className={`ml-1.5 text-[10px] font-medium ${textClass}`}>
                          ({statusLabel})
                        </span>
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem disabled value="__none__">No students found</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <div className="space-y-2">
            <Button
              onClick={() => studentResultMutation.mutate()}
              disabled={!studentResultStudent || !studentResultExam || studentResultMutation.isPending}
              className="w-full h-9"
            >
              {studentResultMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Result Card...
                </>
              ) : (
                "Generate Result Card"
              )}
            </Button>
          </div>
        </div>

        {/* Result Display */}
        {studentResultData && (
          <div className="space-y-4 mt-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Result Card</h3>
              <Button onClick={printStudentResult} variant="outline" className="gap-2">
                <Printer className="w-4 h-4" />
                Print Result Card
              </Button>
            </div>

            {/* Student & Examination Details (Form-like 2-column layout) */}
            <div className="border rounded-md bg-card p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Student & Examination Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Student Name:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{getFullName(studentResultData.student)}</span>
                    <span className={`text-[10px] font-medium ${getStudentStatusTextTone(getStudentStatusCode(studentResultData.student)).textClass}`}>
                      ({formatStudentStatusLabel(getStudentStatusCode(studentResultData.student))})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Exam Name:</span>
                  <span className="font-semibold text-foreground">{studentResultData.exam?.examName}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Roll Number:</span>
                  <span className="font-mono font-semibold text-foreground">{studentResultData.student?.rollNumber || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Academic Session:</span>
                  <span className="font-semibold text-foreground">{studentResultData.exam?.session || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Father Name:</span>
                  <span className="font-semibold text-foreground">{studentResultData.student?.fatherOrguardian || studentResultData.student?.fatherName || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Class & Program:</span>
                  <span className="font-semibold text-foreground">
                    {studentResultData.exam?.class?.name || studentResultData.student?.class?.name || "N/A"}
                    {studentResultData.exam?.program?.name ? ` (${studentResultData.exam.program.name})` : ""}
                  </span>
                </div>
                {studentResultData.student?.section && (
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">Section:</span>
                    <span className="font-semibold text-foreground">{studentResultData.student.section?.name || "N/A"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Subject-wise Marks */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">Subject-wise Marks</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Total Marks</TableHead>
                      <TableHead>Obtained Marks</TableHead>
                      <TableHead>Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentResultData.marks?.map((mark, idx) => {
                      const subId = extractId(mark.subjectId || mark.subject);
                      const foundSub = allSubjects.find((s) => extractId(s.id || s._id) === subId);
                      const sName =
                        (mark.subject && !mark.subject.startsWith("Subject #") && !/^[0-9a-fA-F]{24}$/.test(mark.subject))
                          ? mark.subject
                          : (foundSub?.name || "Subject");
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{sName}</TableCell>
                          <TableCell>{mark.totalMarks}</TableCell>
                          <TableCell className={mark.isAbsent ? "text-destructive font-semibold" : "font-semibold"}>
                            {mark.isAbsent ? "Absent" : mark.obtainedMarks}
                          </TableCell>
                          <TableCell>
                            {mark.totalMarks > 0
                              ? ((mark.obtainedMarks / mark.totalMarks) * 100).toFixed(2)
                              : "0.00"}
                            %
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Overall Result Summary Text Strip */}
            {studentResultData.result && (
              <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-muted/30 border-y border-border text-xs rounded-md">
                <span>Total Marks: <strong className="text-foreground ml-1">{studentResultData.result.totalMarks}</strong></span>
                <span>Obtained Marks: <strong className="text-primary ml-1">{studentResultData.result.obtainedMarks}</strong></span>
                <span>Percentage: <strong className="text-foreground ml-1">{(studentResultData.result.percentage || 0).toFixed(2)}%</strong></span>
                <span>Grade: <strong className={`ml-1 ${studentResultData.result.grade === 'F' ? 'text-destructive' : 'text-emerald-600'}`}>{studentResultData.result.grade}</strong></span>
                {studentResultData.position && (
                  <span>Position: <strong className="text-foreground ml-1">{studentResultData.position}</strong></span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!studentResultData && (
          <div className="text-center py-16">
            <FileUser className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No Result Selected</p>
            <p className="text-sm text-muted-foreground mt-2">
              Select a student and exam to view their result card
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentResultsTab;
