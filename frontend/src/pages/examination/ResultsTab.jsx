import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, PlusCircle, Printer, SlidersHorizontal, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StudentResultsTab } from "../StudentResultsTab";
import {
  getExams,
  getClasses,
  getProgramNames,
  getResults,
  getStudents,
  generateResults,
  getStudentResult,
  getDefaultReportCardTemplate,
  getTeacherClasses,
  getAcademicSessions,
  getSubjects,
} from "@/services/api";
import { extractId } from "@/lib/utils.jsx";
import { hasExplicitModuleAccess, isDualRoleStaff } from "@/lib/navigation.jsx";
import usePermissions from "@/hooks/usePermissions";

export const ResultsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = usePermissions("Examination", "results");

  const [resultDialog, setResultDialog] = useState(false);
  const [resultFilterProgram, setResultFilterProgram] = useState("");
  const [resultFilterClass, setResultFilterClass] = useState("");
  const [resultsSessionFilter, setResultsSessionFilter] = useState("");
  const [showResultsFilters, setShowResultsFilters] = useState(true);
  const sessionInitializedRef = React.useRef(false);

  // Student Results filters
  const [studentResultProgram, setStudentResultProgram] = useState("");
  const [studentResultClass, setStudentResultClass] = useState("");
  const [studentResultSection, setStudentResultSection] = useState("");
  const [studentResultStudent, setStudentResultStudent] = useState("");
  const [studentResultExam, setStudentResultExam] = useState("");
  const [studentResultData, setStudentResultData] = useState(null);

  const [resultForm, setResultForm] = useState({
    studentId: "",
    examId: "",
    classId: "",
    totalMarks: "",
    obtainedMarks: "",
    percentage: "",
    gpa: "",
    grade: "",
    position: "",
    remarks: "",
  });

  // Cascading filter resets
  useEffect(() => {
    setResultFilterClass("");
  }, [resultFilterProgram]);

  useEffect(() => {
    setResultFilterProgram("");
    setResultFilterClass("");
  }, [resultsSessionFilter]);

  // Student Results cascading resets
  useEffect(() => {
    setStudentResultClass("");
    setStudentResultSection("");
    setStudentResultStudent("");
    setStudentResultExam("");
    setStudentResultData(null);
  }, [studentResultProgram]);

  useEffect(() => {
    setStudentResultSection("");
    setStudentResultStudent("");
    setStudentResultExam("");
    setStudentResultData(null);
  }, [studentResultClass]);

  useEffect(() => {
    setStudentResultStudent("");
    setStudentResultExam("");
    setStudentResultData(null);
  }, [studentResultSection]);

  useEffect(() => {
    setStudentResultExam("");
    setStudentResultData(null);
  }, [studentResultStudent]);

  useEffect(() => {
    setStudentResultData(null);
  }, [studentResultExam]);

  // Role checking
  const currentUser = queryClient.getQueryData(["currentUser"]);
  const isTeacherRole =
    currentUser?.role === "TEACHER" || currentUser?.role === "Teacher";
  const dualRoleStaff = isDualRoleStaff(currentUser);
  const hasExaminationPermission = hasExplicitModuleAccess(currentUser, "Examination");
  const isTeacher = isTeacherRole && (!dualRoleStaff || !hasExaminationPermission);

  const { data: teacherClassMappings = [] } = useQuery({
    queryKey: ["teacherClasses"],
    queryFn: getTeacherClasses,
    enabled: isTeacher,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: getProgramNames,
  });

  const { data: classesData = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: () => getExams(),
  });

  const { data: rawStudents = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => getStudents("", "", "", ""),
  });

  const students = useMemo(() => {
    if (Array.isArray(rawStudents)) return rawStudents;
    return rawStudents?.students || [];
  }, [rawStudents]);

  const { data: allSubjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjects,
  });

  const { data: sessions = [], isError: isSessionsError } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  useEffect(() => {
    if (isSessionsError) {
      toast({ title: "Failed to load academic sessions", variant: "destructive" });
    }
  }, [isSessionsError, toast]);

  useEffect(() => {
    if (!sessionInitializedRef.current && sessions && sessions.length > 0) {
      const active = sessions.find((s) => s.isActive) || sessions[0];
      if (active) {
        setResultsSessionFilter(extractId(active.id || active._id));
      }
      sessionInitializedRef.current = true;
    }
  }, [sessions]);

  const { data: results = [], isLoading: isLoadingResults } = useQuery({
    queryKey: ["results", resultsSessionFilter],
    queryFn: () => getResults(resultsSessionFilter || undefined),
  });

  const resultsSessionObj = sessions.find((s) => extractId(s.id || s._id) === resultsSessionFilter);
  const resultsSessionName = resultsSessionObj?.name;
  const resultsSessionFilteredExams = resultsSessionFilter
    ? exams.filter((e) => {
        const examSessionId = extractId(e.sessionId || e.session?.id || e.session?._id);
        const examSessionName = typeof e.session === "string" ? e.session : e.session?.name;
        return (
          examSessionId === resultsSessionFilter ||
          (resultsSessionName && examSessionName && examSessionName.toLowerCase() === resultsSessionName.toLowerCase())
        );
      })
    : exams;

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

  const getFullName = (student) => {
    return `${student.fName} ${student.lName || ""}`.trim();
  };

  const calculateGrade = (percentage) => {
    if (percentage >= 90) return { grade: "A+", gpa: 4.0 };
    if (percentage >= 80) return { grade: "A", gpa: 3.7 };
    if (percentage >= 70) return { grade: "B+", gpa: 3.3 };
    if (percentage >= 60) return { grade: "B", gpa: 3.0 };
    if (percentage >= 50) return { grade: "C", gpa: 2.5 };
    if (percentage >= 40) return { grade: "D", gpa: 2.0 };
    if (percentage >= 33) return { grade: "E", gpa: 1.0 };
    return { grade: "F", gpa: 0.0 };
  };

  const generateResultsMutation = useMutation({
    mutationFn: ({ examId, classId }) => generateResults(examId, classId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["results"] });
      toast({
        title: "Results generated successfully",
        description: `Generated ${data?.length || 0} results`,
      });
      setResultDialog(false);
    },
    onError: (err) => {
      console.error("Generate results error:", err);
      toast({
        title: "Failed to generate results",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const studentResultMutation = useMutation({
    mutationFn: () => getStudentResult(studentResultStudent, studentResultExam),
    onSuccess: (data) => {
      setStudentResultData(data);
      toast({ title: "Result fetched successfully" });
    },
    onError: (error) => {
      toast({ title: error.message || "Failed to fetch result", variant: "destructive" });
    },
  });

  const printResults = (examId) => {
    const exam = exams.find((e) => extractId(e.id || e._id) === extractId(examId));
    if (!exam) return;
    const filtered = results
      .filter((r) => extractId(r.examId || r.exam?.id || r.exam?._id) === extractId(examId))
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

    const printWin = window.open("", "_blank");
    printWin?.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${exam.examName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #000; padding: 10px; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>${exam.examName} - Results</h1>
        <h2>Session: ${exam.session}</h2>
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Name</th>
              <th>Roll No</th>
              <th>Total</th>
              <th>Obtained</th>
              <th>%</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map((r, i) => {
                const s = r.student;
                return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${getFullName(s) || "N/A"}</td>
                  <td>${s?.rollNumber || "N/A"}</td>
                  <td>${r.totalMarks}</td>
                  <td>${r.obtainedMarks}</td>
                  <td>${r.percentage.toFixed(2)}%</td>
                  <td>${r.grade}</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWin?.document.close();
    printWin?.print();
  };

  const printStudentResult = async () => {
    if (!studentResultData) {
      toast({ title: "No result to print", variant: "destructive" });
      return;
    }

    const { student, exam, marks, result, position } = studentResultData;

    try {
      const template = await getDefaultReportCardTemplate();

      if (!template) {
        toast({
          title: "No default template found",
          description: "Please set a default report card template in Configuration",
          variant: "destructive",
        });
        return;
      }

      const subjectsData = marks.map((mark) => {
        const subId = extractId(mark.subjectId || mark.subject);
        const foundSub = allSubjects.find((s) => extractId(s.id || s._id) === subId);
        const sName =
          (mark.subject && !mark.subject.startsWith("Subject #") && !/^[0-9a-fA-F]{24}$/.test(mark.subject))
            ? mark.subject
            : (foundSub?.name || "Subject");
        return {
          name: sName,
          totalMarks: mark.totalMarks,
          obtainedMarks: mark.obtainedMarks,
          percentage: ((mark.obtainedMarks / mark.totalMarks) * 100).toFixed(2),
          grade: calculateGrade((mark.obtainedMarks / mark.totalMarks) * 100).grade,
          isAbsent: mark.isAbsent || false,
        };
      });

      const programYear = exam.program?.year || exam.class?.year || 3;
      const showGPA = programYear > 2;

      const marksRowsHtml = subjectsData
        .map(
          (subject, index) => `
      <tr style="border-bottom: 1px solid #000;">
          <td style="text-align: center; border-right: 1px solid #000; padding: 4px;">${
            index + 1
          }</td>
          <td style="border-right: 1px solid #000; padding: 4px;">${subject.name}</td>
          <td style="text-align: center; border-right: 1px solid #000; padding: 4px;">${
            subject.totalMarks
          }</td>
          <td style="text-align: center; border-right: 1px solid #000; padding: 4px; ${
            subject.isAbsent
              ? "background-color: #fee2e2; color: #dc2626; font-weight: bold;"
              : ""
          }">${subject.isAbsent ? "Absent" : subject.obtainedMarks}</td>
          <td style="text-align: center; border-right: 1px solid #000; padding: 4px;">${
            subject.percentage
          }%</td>
          <td style="text-align: center; padding: 4px;">${subject.grade}</td>
        </tr>
  `
        )
        .join("");

      let filledTemplate = template.htmlContent;
      const printDate = new Date().toLocaleString();

      filledTemplate = filledTemplate
        .replace(/{{instituteName}}/g, "Concordia College")
        .replace(/{{instituteAddress}}/g, "Peshawar, Pakistan")
        .replace(/{{examType}}/g, exam.type || exam.examName || "")
        .replace(/{{examName}}/g, exam.examName || "")
        .replace(/{{session}}/g, exam.session || "")
        .replace(/{{printDate}}/g, printDate)
        .replace(/{{studentName}}/g, getFullName(student))
        .replace(/{{fatherName}}/g, student.fatherOrguardian || "N/A")
        .replace(/{{rollNo}}/g, student.rollNumber || "N/A")
        .replace(/{{regNo}}/g, student.rollNumber || "N/A")
        .replace(/{{admNo}}/g, student.id || "N/A")
        .replace(
          /{{class}}/g,
          exam.class?.name + (exam?.program?.name ? ` (${exam?.program?.name})` : "") ||
            (student.class ? student.class.name : "") +
              (exam?.program?.name ? `(${exam?.program?.name})` : "")
        )
        .replace(/{{section}}/g, student.section ? student.section.name : "")
        .replace(/{{sectionVisibilityClass}}/g, student.section ? "" : "hidden-section")
        .replace(
          /{{studentPhotoOrPlaceholder}}/g,
          student.photo_url
            ? `<img src="${student.photo_url}" alt="Student Photo" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<div class="student-pho" style="font-size: 10px; color: #666;">No Photo</div>`
        )
        .replace(/{{studentPhoto}}/g, student.photo_url || "")
        .replace(/{{marksRows}}/g, marksRowsHtml)
        .replace(/{{totalMarks}}/g, result.totalMarks)
        .replace(/{{obtainedMarks}}/g, result.obtainedMarks)
        .replace(/{{percentage}}/g, result.percentage.toFixed(2))
        .replace(/{{grade}}/g, result.grade)
        .replace(/{{gradeColor}}/g, result.grade === "F" ? "#dc2626" : "#059669")
        .replace(/{{gpa}}/g, showGPA ? result.gpa.toFixed(2) : "N/A")
        .replace(/{{position}}/g, position || "N/A")
        .replace(/{{status}}/g, result.grade === "F" ? "FAIL" : "PASS")
        .replace(/{{remarks}}/g, result.remarks || "");

      filledTemplate = filledTemplate.replace(/{{[^{}]+}}/g, "");

      const printWin = window.open("", "_blank");
      printWin?.document.write(filledTemplate);
      printWin?.document.close();
      printWin?.print();
    } catch (error) {
      console.error("Print error:", error);
      toast({
        title: "Failed to print result card",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <Tabs defaultValue="class-results" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="class-results">Examination Results</TabsTrigger>
        <TabsTrigger value="student-results">Student Results</TabsTrigger>
      </TabsList>

      {/* Class/Section Results Tab */}
      <TabsContent value="class-results">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Examination Results by Class
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowResultsFilters((s) => !s)}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {showResultsFilters ? "Hide Filters" : "Filters"}
                </Button>
                <Dialog
                  open={resultDialog}
                  onOpenChange={(open) => {
                    if (!generateResultsMutation.isPending) {
                      setResultDialog(open);
                    }
                  }}
                >
                  {canCreate && (
                    <DialogTrigger asChild>
                      <Button>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Generate Results
                      </Button>
                    </DialogTrigger>
                  )}
                  <DialogContent
                    onPointerDownOutside={(e) => {
                      if (generateResultsMutation.isPending) e.preventDefault();
                    }}
                    onEscapeKeyDown={(e) => {
                      if (generateResultsMutation.isPending) e.preventDefault();
                    }}
                  >
                    <DialogHeader>
                      <DialogTitle>Generate Results</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Select Exam *</Label>
                        <Select
                          value={resultForm.examId}
                          onValueChange={(value) => {
                            const matchedExam = exams.find((e) => extractId(e.id || e._id) === value);
                            setResultForm({
                              ...resultForm,
                              examId: value,
                              classId: matchedExam?.classId ? extractId(matchedExam.classId) : "",
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select exam" />
                          </SelectTrigger>
                          <SelectContent>
                            {resultsSessionFilteredExams
                              ?.filter((e) =>
                                isTeacher
                                  ? teacherClassMappings.some((m) => extractId(m.classId) === extractId(e.classId))
                                  : true
                              )
                              ?.map((exam) => {
                                const eId = extractId(exam.id || exam._id);
                                return (
                                  <SelectItem key={eId} value={eId}>
                                    {exam.examName} - {exam.session} ({exam.program?.name || "Program"}
                                    {exam.program?.department?.name
                                      ? ` — ${exam.program.department.name}`
                                      : ""}{" "}
                                    - {exam.class?.name || "All Classes"})
                                    {exam.startDate ? ` (${formatDateDisplay(exam.startDate)})` : ""}
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Select Class (Optional)</Label>
                        <Select
                          value={resultForm.classId || ""}
                          onValueChange={(value) =>
                            setResultForm({ ...resultForm, classId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All classes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="*">All Classes</SelectItem>
                            {(() => {
                              const selectedExam = exams.find(
                                (e) => extractId(e.id || e._id) === resultForm.examId
                              );
                              if (selectedExam?.classId) {
                                const cls = classesData.find(
                                  (c) => extractId(c.id || c._id) === extractId(selectedExam.classId)
                                ) || selectedExam.class;
                                if (cls) {
                                  return (
                                    <SelectItem value={extractId(cls.id || cls._id || selectedExam.classId)}>
                                      {cls.name || "Class"}
                                    </SelectItem>
                                  );
                                }
                              }
                              return classesData.map((cls) => (
                                <SelectItem key={extractId(cls.id || cls._id)} value={extractId(cls.id || cls._id)}>
                                  {cls.name}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => {
                          if (!resultForm.examId) {
                            toast({ title: "Please select an exam", variant: "destructive" });
                            return;
                          }
                          generateResultsMutation.mutate({
                            examId: resultForm.examId,
                            classId: resultForm.classId && resultForm.classId !== "*" ? resultForm.classId : undefined,
                          });
                        }}
                        className="w-full"
                        disabled={generateResultsMutation.isPending}
                      >
                        {generateResultsMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating Results...
                          </>
                        ) : (
                          "Generate Results"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div
              className={`transition-all duration-300 ease-out overflow-hidden ${
                showResultsFilters
                  ? "max-h-[520px] opacity-100 mt-4"
                  : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
              }`}
            >
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Session Filter</Label>
                  <Select
                    value={resultsSessionFilter || "__all__"}
                    onValueChange={(v) => setResultsSessionFilter(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Sessions</SelectItem>
                      {sessions.map((s) => {
                        const sId = extractId(s.id || s._id);
                        return (
                          <SelectItem key={sId} value={sId}>
                            <span className="flex items-center gap-2">
                              {s.name}
                              {s.isActive && (
                                <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1">
                                  Active
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Filter by Program</Label>
                  <Select
                    value={resultFilterProgram}
                    onValueChange={setResultFilterProgram}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="*">All Programs</SelectItem>
                      {programs
                        ?.filter((p) =>
                          isTeacher
                            ? teacherClassMappings.some((m) => extractId(m.class?.programId) === extractId(p.id || p._id))
                            : true
                        )
                        ?.map((p) => {
                          const pId = extractId(p.id || p._id);
                          return (
                            <SelectItem key={pId} value={pId}>
                              {p.name} {p.department?.name ? `— ${p.department.name} ` : ""}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Filter by Class</Label>
                  <Select
                    value={resultFilterClass}
                    onValueChange={setResultFilterClass}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="*">All Classes</SelectItem>
                      {(() => {
                        const available = resultFilterProgram && resultFilterProgram !== "*"
                          ? classesData.filter((c) => extractId(c.programId) === resultFilterProgram)
                          : classesData;
                        return available
                          .filter((cls) =>
                            isTeacher
                              ? teacherClassMappings.some((m) => extractId(m.classId) === extractId(cls.id || cls._id))
                              : true
                          )
                          .map((cls) => {
                            const cId = extractId(cls.id || cls._id);
                            return (
                              <SelectItem key={cId} value={cId}>
                                {cls.name}
                              </SelectItem>
                            );
                          });
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingResults ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                <p className="text-sm">Loading examination results...</p>
              </div>
            ) : !resultFilterProgram && !resultsSessionFilter ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-4">📊</p>
                <p className="text-lg font-medium text-muted-foreground">
                  Select a Program or Session to View Results
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Choose a program or session from the filters above to see examination results
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-4">📭</p>
                <p className="text-lg font-medium text-muted-foreground">No Results Found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Generate results for this exam/program to see them here
                </p>
              </div>
            ) : (
              <>
                {resultsSessionFilteredExams?.map((exam) => {
                  const examIdStr = extractId(exam.id || exam._id);
                  let examResults = results.filter((r) => extractId(r.examId || r.exam?.id || r.exam?._id) === examIdStr);

                  if (resultFilterProgram && resultFilterProgram !== "*") {
                    examResults = examResults.filter((r) => {
                      const progId = extractId(r.student?.programId || r.student?.program?.id || r.student?.program?._id || r.programId);
                      return progId === resultFilterProgram;
                    });
                  }

                  if (resultFilterClass && resultFilterClass !== "*") {
                    examResults = examResults.filter((r) => {
                      const clsId = extractId(r.student?.classId || r.student?.class?.id || r.student?.class?._id || r.classId);
                      return clsId === resultFilterClass;
                    });
                  }
                  if (examResults.length === 0) return null;
                  return (
                    <Card key={examIdStr} className="mb-4">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{exam.examName}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {exam.program?.name} | {exam.session}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {canUpdate && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  generateResultsMutation.mutate({
                                    examId: examIdStr,
                                    classId: exam.classId ? extractId(exam.classId) : undefined,
                                  });
                                }}
                                disabled={generateResultsMutation.isPending}
                                className="gap-2"
                              >
                                {generateResultsMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Regenerating...
                                  </>
                                ) : (
                                  <>
                                    <Award className="w-4 h-4" />
                                    Regenerate Results
                                  </>
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => printResults(examIdStr)}
                              className="gap-2"
                            >
                              <Printer className="w-4 h-4" />
                              Print Results
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-2 px-3 text-sm">Position</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Student</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Reg. No</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Class</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Total Marks</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Obtained</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Percentage</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Grade</TableHead>
                              <TableHead className="py-2 px-3 text-sm">GPA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {examResults
                              .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
                              .map((result, idx) => {
                                const student = result.student;
                                return (
                                  <TableRow key={result.id || idx}>
                                    <TableCell className="text-sm px-3 py-2 font-bold">
                                      {result.position || idx + 1}
                                    </TableCell>
                                    <TableCell className="py-2 px-3 text-sm">
                                      {student ? getFullName(student) : "N/A"}
                                    </TableCell>
                                    <TableCell className="py-2 px-3 text-sm">
                                      {student?.rollNumber}
                                    </TableCell>
                                    <TableCell className="py-2 px-3 text-sm">
                                      {student?.class?.name || exam.class?.name || "N/A"}
                                    </TableCell>
                                    <TableCell className="py-2 px-3 text-sm">
                                      {result.totalMarks}
                                    </TableCell>
                                    <TableCell className="py-2 px-3 text-sm">
                                      {result.obtainedMarks}
                                    </TableCell>
                                    <TableCell className="py-2 px-3 text-sm">
                                      {(result.percentage || 0).toFixed(2)}%
                                    </TableCell>
                                    <TableCell className="py-2 px-3 text-sm">
                                      {result.grade}
                                    </TableCell>
                                    <TableCell className="py-2 px-3 text-sm">
                                      {(result.gpa || 0).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Student Results Tab */}
      <TabsContent value="student-results">
        <StudentResultsTab
          programs={programs}
          classesData={classesData}
          students={students}
          exams={exams}
          studentResultProgram={studentResultProgram}
          setStudentResultProgram={setStudentResultProgram}
          studentResultClass={studentResultClass}
          setStudentResultClass={setStudentResultClass}
          studentResultSection={studentResultSection}
          setStudentResultSection={setStudentResultSection}
          studentResultStudent={studentResultStudent}
          setStudentResultStudent={setStudentResultStudent}
          studentResultExam={studentResultExam}
          setStudentResultExam={setStudentResultExam}
          studentResultData={studentResultData}
          studentResultMutation={studentResultMutation}
          printStudentResult={printStudentResult}
          getFullName={getFullName}
        />
      </TabsContent>
    </Tabs>
  );
};

export default ResultsTab;
