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

export const StudentResultsTab = ({
  programs = [],
  classesData: propClassesData,
  students,
  exams = [],
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

  const programOptions = useMemo(() => {
    return (
      programs?.map((program) => {
        const pId = extractId(program.id || program._id);
        const dep = program.department?.name ? ` — ${program.department.name}` : "";
        return {
          value: pId,
          label: `${program.name}${dep}`,
        };
      }) || []
    );
  }, [programs]);

  // Get available classes based on selected program(s)
  const availableClasses = useMemo(() => {
    if (selectedProgIds.length === 0) return [];
    return classesData.filter((c) => selectedProgIds.includes(extractId(c.programId || c.program)));
  }, [classesData, selectedProgIds]);

  const classOptions = useMemo(() => {
    return availableClasses.map((cls) => ({
      value: extractId(cls.id || cls._id),
      label: cls.name || "Class",
    }));
  }, [availableClasses]);

  // Selected class objects & section allowance
  const selectedClasses = useMemo(() => {
    return classesData.filter((c) => selectedClassIds.includes(extractId(c.id || c._id)));
  }, [classesData, selectedClassIds]);

  const allowSections = useMemo(() => {
    if (selectedClasses.length === 0) return true;
    return selectedClasses.some((c) => c.allowSections !== false);
  }, [selectedClasses]);

  // Auto clear section if classes do not allow sections
  useEffect(() => {
    if (!allowSections && selectedSectionIds.length > 0) {
      handleSectionChange([]);
    }
  }, [allowSections, selectedSectionIds]);

  // Get available sections based on selected classes
  const availableSections = useMemo(() => {
    if (selectedClassIds.length === 0 || !allowSections) return [];
    return sectionsData.filter((s) => selectedClassIds.includes(extractId(s.classId || s.class)));
  }, [selectedClassIds, allowSections, sectionsData]);

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
      selectedProgIds.join(","),
      selectedClassIds.join(","),
      selectedSectionIds.join(","),
    ],
    queryFn: () =>
      getStudents({
        programId: selectedProgIds.length > 0 ? selectedProgIds.join(",") : undefined,
        classId: selectedClassIds.length > 0 ? selectedClassIds.join(",") : undefined,
        sectionId: allowSections && selectedSectionIds.length > 0 ? selectedSectionIds.join(",") : undefined,
        status: "ACTIVE",
        page: 1,
        limit: 1000,
      }),
    enabled: selectedClassIds.length > 0 && !isSearchActive,
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
      const progId = extractId(student.programId || student.program?.id || student.program?._id);
      const clsId = extractId(student.classId || student.class?.id || student.class?._id);
      const secId = extractId(student.sectionId || student.section?.id || student.section?._id);
      if (selectedProgIds.length > 0 && progId && !selectedProgIds.includes(progId)) return false;
      if (selectedClassIds.length > 0 && clsId && !selectedClassIds.includes(clsId)) return false;
      if (allowSections && selectedSectionIds.length > 0 && secId && !selectedSectionIds.includes(secId)) return false;
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
        const examClassId = extractId(exam.classId || exam.class?.id || exam.class?._id);
        return !examClassId || examClassId === studentClassId;
      }) || []
    : [];

  // Format date for display
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Program Filter */}
          <div className="space-y-2">
            <Label>Select Program *</Label>
            <CheckboxMultiSelect
              title="Programs"
              placeholder="Select Programs"
              allLabel="All Programs"
              options={programOptions}
              selected={selectedProgIds}
              onChange={(v) => {
                handleProgChange(v);
                setSearchQuery("");
              }}
            />
          </div>

          {/* Class Filter */}
          <div className="space-y-2">
            <Label>Select Class *</Label>
            <CheckboxMultiSelect
              title="Classes"
              placeholder={selectedProgIds.length === 0 ? "Select program first" : "Select Classes"}
              allLabel="All Classes"
              options={classOptions}
              selected={selectedClassIds}
              onChange={handleClassChange}
              disabled={selectedProgIds.length === 0}
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
              <CheckboxMultiSelect
                title="Sections"
                placeholder={selectedClassIds.length === 0 ? "Select class first" : "All Sections"}
                allLabel="All Sections"
                options={sectionOptions}
                selected={selectedSectionIds}
                onChange={handleSectionChange}
                disabled={selectedClassIds.length === 0}
              />
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
                (!isSearchActive && selectedClassIds.length === 0) ||
                displayStudents.length === 0
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isSearchActive
                      ? displayStudents.length > 0
                        ? `Select from ${displayStudents.length} result${displayStudents.length === 1 ? "" : "s"}`
                        : "No matching students found"
                      : selectedClassIds.length > 0
                      ? "Select student"
                      : "Select class or search above"
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

          {/* Exam Filter */}
          <div className="space-y-2">
            <Label>Select Exam *</Label>
            <Select
              value={studentResultExam}
              onValueChange={setStudentResultExam}
              disabled={!studentResultStudent}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={studentResultStudent ? "Select exam" : "First select student"}
                />
              </SelectTrigger>
              <SelectContent>
                {availableExams.map((exam) => {
                  const examId = extractId(exam.id || exam._id);
                  return (
                    <SelectItem key={examId} value={examId}>
                      {exam.examName} - {exam.session} ({formatDateDisplay(exam.startDate)} -{" "}
                      {formatDateDisplay(exam.endDate)})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <div className="space-y-2 flex items-end">
            <Button
              onClick={() => studentResultMutation.mutate()}
              disabled={!studentResultStudent || !studentResultExam || studentResultMutation.isPending}
              className="w-full"
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

            {/* Student Info */}
            <Card>
              <CardHeader>
                <CardTitle>Student Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{getFullName(studentResultData.student)}</span>
                    <span className={`text-[10px] font-medium ${getStudentStatusTextTone(getStudentStatusCode(studentResultData.student)).textClass}`}>
                      ({formatStudentStatusLabel(getStudentStatusCode(studentResultData.student))})
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Roll Number</p>
                  <p className="font-medium">{studentResultData.student?.rollNumber || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Class</p>
                  <p className="font-medium">
                    {studentResultData.exam?.class?.name || studentResultData.student?.class?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Program</p>
                  <p className="font-medium">
                    {studentResultData.exam?.program?.name || studentResultData.student?.program?.name || "N/A"}
                  </p>
                </div>
                {studentResultData.student?.section && (
                  <div>
                    <p className="text-sm text-muted-foreground">Section</p>
                    <p className="font-medium">{studentResultData.student.section?.name || "N/A"}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Exam Info */}
            <Card>
              <CardHeader>
                <CardTitle>Exam Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Exam Name</p>
                  <p className="font-medium">{studentResultData.exam?.examName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Session</p>
                  <p className="font-medium">{studentResultData.exam?.session}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{studentResultData.exam?.type || "N/A"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Subject-wise Marks */}
            <Card>
              <CardHeader>
                <CardTitle>Subject-wise Marks</CardTitle>
              </CardHeader>
              <CardContent>
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
                          <TableCell>{sName}</TableCell>
                          <TableCell>{mark.totalMarks}</TableCell>
                          <TableCell>{mark.isAbsent ? "Absent" : mark.obtainedMarks}</TableCell>
                          <TableCell>
                            {mark.totalMarks > 0
                              ? ((mark.obtainedMarks / mark.totalMarks) * 100).toFixed(2)
                              : "0.00"}
                            %
                          </TableCell>
                        </TableRow>
                      )})}

                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Overall Result */}
            {studentResultData.result && (
              <Card className="bg-primary/5">
                <CardHeader>
                  <CardTitle>Overall Result</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Marks</p>
                    <p className="text-2xl font-bold">{studentResultData.result.totalMarks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Obtained Marks</p>
                    <p className="text-2xl font-bold text-primary">
                      {studentResultData.result.obtainedMarks}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Percentage</p>
                    <p className="text-2xl font-bold">
                      {(studentResultData.result.percentage || 0).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Grade</p>
                    <p className="text-2xl font-bold">{studentResultData.result.grade}</p>
                  </div>
                  {/* GPA hidden for now */}
                  {studentResultData.position && (
                    <div>
                      <p className="text-sm text-muted-foreground">Position</p>
                      <p className="text-2xl font-bold">{studentResultData.position}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
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
