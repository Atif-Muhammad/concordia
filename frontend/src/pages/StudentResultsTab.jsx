import React, { useState, useEffect } from "react";
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
  studentResultStudent,
  setStudentResultStudent,
  studentResultExam,
  setStudentResultExam,
  studentResultData,
  studentResultMutation,
  printStudentResult,
  getFullName,
}) => {
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

  // Get available classes based on selected program
  const availableClasses = studentResultProgram
    ? classesData.filter((c) => extractId(c.programId) === studentResultProgram)
    : classesData;

  // Selected class object & section allowance
  const selectedClassObj = classesData.find(
    (c) => extractId(c.id || c._id) === studentResultClass
  );
  const allowSections = selectedClassObj ? selectedClassObj.allowSections !== false : true;

  // Auto clear section if class does not allow sections
  useEffect(() => {
    if (selectedClassObj && !allowSections && studentResultSection) {
      setStudentResultSection("");
    }
  }, [selectedClassObj, allowSections, studentResultSection, setStudentResultSection]);

  // Get available sections based on selected class
  const availableSections = (studentResultClass && allowSections)
    ? sectionsData.filter((s) => extractId(s.classId) === studentResultClass)
    : [];

  // --- Data Fetching ---

  // 1. Search Query
  const { data: searchResultsData } = useQuery({
    queryKey: ["searchStudent", debouncedSearch],
    queryFn: () => searchStudent(debouncedSearch),
    enabled: !!debouncedSearch && debouncedSearch.length > 2,
  });

  // 2. Class Students Query
  const { data: classStudentsData } = useQuery({
    queryKey: ["classStudentsResultTab", studentResultProgram, studentResultClass, studentResultSection],
    queryFn: () =>
      getStudents({
        programId: studentResultProgram || undefined,
        classId: studentResultClass || undefined,
        sectionId: allowSections && studentResultSection && studentResultSection !== "*" ? studentResultSection : undefined,
        status: "ACTIVE",
        page: 1,
        limit: 1000,
      }),
    enabled: !!studentResultClass && !debouncedSearch,
  });

  // Determine which list to show
  const rawList =
    debouncedSearch && debouncedSearch.length > 2
      ? Array.isArray(searchResultsData)
        ? searchResultsData
        : searchResultsData?.students || []
      : Array.isArray(classStudentsData)
      ? classStudentsData
      : classStudentsData?.students || [];

  const displayStudents = Array.isArray(rawList) ? rawList : [];

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
            placeholder="Search student by name or roll number..."
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
            <Select
              value={studentResultProgram}
              onValueChange={(v) => {
                setStudentResultProgram(v);
                setSearchQuery("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs?.map((program) => {
                  const pId = extractId(program.id || program._id);
                  return (
                    <SelectItem key={pId} value={pId}>
                      {program.name} {program.department?.name ? `— ${program.department.name}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Class Filter */}
          <div className="space-y-2">
            <Label>Select Class *</Label>
            <Select
              value={studentResultClass}
              onValueChange={setStudentResultClass}
              disabled={!studentResultProgram}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={studentResultProgram ? "Select class" : "First select program"}
                />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((cls) => {
                  const cId = extractId(cls.id || cls._id);
                  return (
                    <SelectItem key={cId} value={cId}>
                      {cls.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Section Filter (Optional) */}
          <div className="space-y-2">
            <Label>Select Section (Optional)</Label>
            {!allowSections ? (
              <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground text-sm flex items-center">
                Sections Not Applicable
              </div>
            ) : (
              <Select
                value={studentResultSection}
                onValueChange={setStudentResultSection}
                disabled={!studentResultClass}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={studentResultClass ? "All sections" : "First select class"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Sections</SelectItem>
                  {availableSections.map((section) => {
                    const sId = extractId(section.id || section._id);
                    return (
                      <SelectItem key={sId} value={sId}>
                        {section.name}
                      </SelectItem>
                    );
                  })}
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
              disabled={displayStudents.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    debouncedSearch
                      ? "Select from search results"
                      : studentResultClass
                      ? "Select student"
                      : "Select class or search"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {displayStudents.length > 0 ? (
                  displayStudents.map((student) => {
                    const sId = extractId(student.id || student._id);
                    return (
                      <SelectItem key={sId} value={sId}>
                        {getFullName(student)} ({student.rollNumber || "No Roll #"})
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
                  <p className="font-medium">{getFullName(studentResultData.student)}</p>
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
