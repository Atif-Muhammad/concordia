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
  getSections,
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
  const [resultFilterSection, setResultFilterSection] = useState("");
  const [resultFilterExam, setResultFilterExam] = useState("");
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
    setResultFilterSection("");
    setResultFilterExam("");
  }, [resultFilterProgram]);

  useEffect(() => {
    setResultFilterSection("");
    setResultFilterExam("");
  }, [resultFilterClass]);

  useEffect(() => {
    setResultFilterProgram("");
    setResultFilterClass("");
    setResultFilterSection("");
    setResultFilterExam("");
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

  const { data: sectionsData = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

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

  const selectedResultClassObj = classesData.find(
    (c) => extractId(c.id || c._id) === resultFilterClass
  );
  const allowSections = selectedResultClassObj ? selectedResultClassObj.allowSections !== false : true;

  const availableSections = useMemo(() => {
    if (!resultFilterClass || !allowSections) return [];
    if (isTeacher) {
      const matching = teacherClassMappings.filter(
        (m) => extractId(m.classId || m.class) === resultFilterClass
      );
      const secs = matching.map((m) => m.section || m.sectionId).filter(Boolean);
      const unique = secs.filter((s, idx, arr) => arr.findIndex((x) => extractId(x) === extractId(s)) === idx);
      if (unique.length > 0) return unique;
      if (matching.some((m) => !(m.sectionId || m.section)) && selectedResultClassObj?.sections?.length) {
        return selectedResultClassObj.sections;
      }
      return [];
    }
    return sectionsData.filter((s) => extractId(s.classId || s.class) === resultFilterClass);
  }, [allowSections, isTeacher, teacherClassMappings, resultFilterClass, selectedResultClassObj, sectionsData]);

  const availableFilterExams = useMemo(() => {
    return resultsSessionFilteredExams.filter((exam) => {
      const examClassId = extractId(exam.classId || exam.class);
      const examProgId = extractId(exam.programId || exam.program);

      if (isTeacher) {
        if (!teacherClassMappings.some((m) => extractId(m.classId || m.class) === examClassId)) return false;
      }

      if (resultFilterProgram && resultFilterProgram !== "*") {
        if (examProgId && examProgId !== resultFilterProgram) return false;
      }
      if (resultFilterClass && resultFilterClass !== "*") {
        if (examClassId && examClassId !== resultFilterClass) return false;
      }
      return true;
    });
  }, [resultsSessionFilteredExams, isTeacher, teacherClassMappings, resultFilterProgram, resultFilterClass]);

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
    return `${student?.fName || ""} ${student?.lName || ""}`.trim() || student?.name || "Student";
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
    let filtered = results
      .filter((r) => extractId(r.examId || r.exam?.id || r.exam?._id) === extractId(examId));

    if (resultFilterProgram && resultFilterProgram !== "*") {
      filtered = filtered.filter((r) => {
        const progId = extractId(r.student?.programId || r.student?.program?.id || r.student?.program?._id || r.programId);
        return progId === resultFilterProgram;
      });
    }

    if (resultFilterClass && resultFilterClass !== "*") {
      filtered = filtered.filter((r) => {
        const clsId = extractId(r.student?.classId || r.student?.class?.id || r.student?.class?._id || r.classId);
        return clsId === resultFilterClass;
      });
    }

    if (allowSections && resultFilterSection && resultFilterSection !== "*") {
      filtered = filtered.filter((r) => {
        const secId = extractId(r.student?.sectionId || r.student?.section?.id || r.student?.section?._id || r.sectionId);
        return secId === resultFilterSection;
      });
    }

    filtered.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

    const totalStudents = filtered.length;
    const passedStudents = filtered.filter((r) => r.grade !== "F").length;
    const failedStudents = totalStudents - passedStudents;
    const passPercentage = totalStudents > 0 ? ((passedStudents / totalStudents) * 100).toFixed(1) : "0";

    const progName = exam.program?.name || "";
    const className = exam.class?.name || (resultFilterClass && classesData.find(c => extractId(c) === resultFilterClass)?.name) || "All Classes";
    const sectionName = (resultFilterSection && resultFilterSection !== "*")
      ? (sectionsData.find(s => extractId(s) === resultFilterSection)?.name || "")
      : "";

    const printWin = window.open("", "_blank");
    printWin?.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${exam.examName} - Result Gazette</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 10px;
            color: #0f172a;
            background: #fff;
            font-size: 11px;
            line-height: 1.4;
          }
          .header-container {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 16px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .logo-box {
            width: 72px;
            height: 72px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo-box img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .header-text {
            text-align: left;
          }
          .college-title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.8px;
            color: #0f172a;
            text-transform: uppercase;
            margin: 0;
            line-height: 1.2;
          }
          .report-subtitle {
            font-family: 'Alex Brush', cursive;
            font-size: 30px;
            color: #334155;
            margin: 2px 0 0 0;
            line-height: 1.1;
            font-weight: normal;
          }
          .meta-strip {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 14px;
            font-size: 11px;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
          }
          .meta-label {
            font-size: 9px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-val {
            font-size: 11px;
            font-weight: 600;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
            font-size: 11px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }
          th {
            background-color: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.3px;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .text-center { text-align: center; }
          .badge-pass {
            color: #047857;
            font-weight: 700;
          }
          .badge-fail {
            color: #b91c1c;
            font-weight: 700;
          }
          .summary-strip {
            display: flex;
            justify-content: space-between;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px 14px;
            margin-bottom: 24px;
            font-size: 11px;
          }
          .summary-strip span strong {
            color: #0f172a;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 36px;
            padding-top: 10px;
          }
          .sign-col {
            text-align: center;
            width: 180px;
          }
          .sign-line {
            border-top: 1px dashed #64748b;
            margin-bottom: 6px;
          }
          .sign-title {
            font-size: 10px;
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="logo-box">
            <img src="/logo.png" alt="Concordia College Peshawar" onerror="this.style.display='none'" />
          </div>
          <div class="header-text">
            <div class="college-title">Concordia College Peshawar</div>
            <div class="report-subtitle">Examination Result Gazette</div>
          </div>
        </div>

        <div class="meta-strip">
          <div class="meta-item">
            <span class="meta-label">Examination</span>
            <span class="meta-val">${exam.examName || "N/A"}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Academic Session</span>
            <span class="meta-val">${exam.session || "N/A"}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Program & Class</span>
            <span class="meta-val">${progName ? `${progName} - ` : ""}${className}${sectionName ? ` (${sectionName})` : ""}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Date Generated</span>
            <span class="meta-val">${new Date().toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 40px;">Pos</th>
              <th style="width: 80px;">Roll No</th>
              <th>Student Name</th>
              <th>Father Name</th>
              <th>Class</th>
              <th class="text-center" style="width: 60px;">Total</th>
              <th class="text-center" style="width: 60px;">Obt.</th>
              <th class="text-center" style="width: 60px;">%</th>
              <th class="text-center" style="width: 50px;">Grade</th>
              <th class="text-center" style="width: 60px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="10" class="text-center" style="padding: 20px; color: #64748b;">No results found for the selected criteria</td>
              </tr>
            ` : filtered
              .map((r, i) => {
                const s = r.student;
                const isFail = r.grade === "F";
                return `
                <tr>
                  <td class="text-center" style="font-weight: 700;">${r.position || i + 1}</td>
                  <td style="font-family: monospace; font-weight: 600;">${s?.rollNumber || "—"}</td>
                  <td style="font-weight: 600;">${getFullName(s) || "N/A"}</td>
                  <td style="color: #475569;">${s?.fatherOrguardian || s?.fatherName || "—"}</td>
                  <td>${s?.class?.name || exam.class?.name || className}</td>
                  <td class="text-center">${r.totalMarks}</td>
                  <td class="text-center" style="font-weight: 700;">${r.obtainedMarks}</td>
                  <td class="text-center">${(r.percentage || 0).toFixed(2)}%</td>
                  <td class="text-center" style="font-weight: 700; color: ${isFail ? '#b91c1c' : '#0f172a'};">${r.grade}</td>
                  <td class="text-center ${isFail ? 'badge-fail' : 'badge-pass'}">${isFail ? 'FAIL' : 'PASS'}</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>

        <div class="summary-strip">
          <span>Total Candidates: <strong>${totalStudents}</strong></span>
          <span>Passed: <strong style="color: #047857;">${passedStudents}</strong></span>
          <span>Failed: <strong style="color: #b91c1c;">${failedStudents}</strong></span>
          <span>Pass Percentage: <strong>${passPercentage}%</strong></span>
        </div>

        <div class="signatures">
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Prepared By</div>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Controller of Examinations</div>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Principal</div>
          </div>
        </div>
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
      const subjectsData = marks.map((mark) => {
        const subId = extractId(mark.subjectId || mark.subject);
        const foundSub = allSubjects.find((s) => extractId(s.id || s._id) === subId);
        const sName =
          (mark.subject && !mark.subject.startsWith("Subject #") && !/^[0-9a-fA-F]{24}$/.test(mark.subject))
            ? mark.subject
            : (foundSub?.name || "Subject");
        const tot = mark.totalMarks || 100;
        const obt = mark.isAbsent ? 0 : (mark.obtainedMarks ?? 0);
        const pct = tot > 0 ? ((obt / tot) * 100).toFixed(2) : "0.00";
        return {
          name: sName,
          totalMarks: tot,
          obtainedMarks: obt,
          percentage: pct,
          grade: mark.isAbsent ? "F" : calculateGrade(Number(pct)).grade,
          isAbsent: mark.isAbsent || false,
        };
      });

      const marksRowsHtml = subjectsData
        .map(
          (subject, index) => `
          <tr style="${subject.isAbsent ? 'background-color: #fef2f2;' : (index % 2 === 1 ? 'background-color: #f8fafc;' : '')}">
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px;">${index + 1}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 500;">${subject.name}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px;">${subject.totalMarks}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 700; ${subject.isAbsent ? 'color: #dc2626;' : ''}">
              ${subject.isAbsent ? "ABSENT" : subject.obtainedMarks}
            </td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px;">${subject.percentage}%</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 700; ${subject.grade === 'F' ? 'color: #dc2626;' : ''}">
              ${subject.grade}
            </td>
          </tr>`
        )
        .join("");

      const isFail = result.grade === "F";
      const className = exam?.class?.name || student?.class?.name || "Class";
      const programName = exam?.program?.name || student?.program?.name || "";
      const sectionName = student?.section?.name || "";

      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${getFullName(student)} - Report Card</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 10px;
              color: #0f172a;
              background: #fff;
              font-size: 11px;
              line-height: 1.4;
            }
            .header-container {
              display: flex;
              align-items: center;
              justify-content: flex-start;
              gap: 16px;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .logo-box {
              width: 72px;
              height: 72px;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .logo-box img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
            .header-text {
              text-align: left;
            }
            .college-title {
              font-size: 20px;
              font-weight: 800;
              letter-spacing: 0.8px;
              color: #0f172a;
              text-transform: uppercase;
              margin: 0;
              line-height: 1.2;
            }
            .report-subtitle {
              font-family: 'Alex Brush', cursive;
              font-size: 32px;
              color: #334155;
              margin: 2px 0 0 0;
              line-height: 1.1;
              font-weight: normal;
            }
            .student-info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr auto;
              gap: 12px;
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 10px 14px;
              margin-bottom: 14px;
            }
            .info-item {
              margin-bottom: 4px;
              font-size: 11px;
            }
            .info-label {
              font-weight: 600;
              color: #64748b;
              display: inline-block;
              width: 100px;
            }
            .info-value {
              font-weight: 600;
              color: #0f172a;
            }
            .student-photo {
              width: 70px;
              height: 80px;
              border: 1px solid #cbd5e1;
              border-radius: 3px;
              overflow: hidden;
              background: #e2e8f0;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              color: #94a3b8;
            }
            .student-photo img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
              font-size: 11px;
            }
            th {
              background-color: #f1f5f9;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.3px;
              border: 1px solid #cbd5e1;
              padding: 6px 8px;
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 6px 8px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
              margin-bottom: 24px;
            }
            .stat-card {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 8px 10px;
              text-align: center;
            }
            .stat-title {
              font-size: 9px;
              text-transform: uppercase;
              font-weight: 600;
              color: #64748b;
              margin-bottom: 2px;
            }
            .stat-value {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 36px;
              padding-top: 10px;
            }
            .sign-col {
              text-align: center;
              width: 180px;
            }
            .sign-line {
              border-top: 1px dashed #64748b;
              margin-bottom: 6px;
            }
            .sign-title {
              font-size: 10px;
              font-weight: 600;
              color: #475569;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="logo-box">
              <img src="/logo.png" alt="Concordia College Peshawar" onerror="this.style.display='none'" />
            </div>
            <div class="header-text">
              <div class="college-title">Concordia College Peshawar</div>
              <div class="report-subtitle">Student Examination Report Card</div>
            </div>
          </div>

          <div class="student-info-grid">
            <div>
              <div class="info-item"><span class="info-label">Student Name:</span> <span class="info-value">${getFullName(student)}</span></div>
              <div class="info-item"><span class="info-label">Father Name:</span> <span class="info-value">${student.fatherOrguardian || student.fatherName || "—"}</span></div>
              <div class="info-item"><span class="info-label">Roll Number:</span> <span class="info-value" style="font-family: monospace;">${student.rollNumber || "—"}</span></div>
            </div>
            <div>
              <div class="info-item"><span class="info-label">Class & Program:</span> <span class="info-value">${className}${programName ? ` (${programName})` : ""}</span></div>
              <div class="info-item"><span class="info-label">Section:</span> <span class="info-value">${sectionName || "N/A"}</span></div>
              <div class="info-item"><span class="info-label">Exam & Session:</span> <span class="info-value">${exam.examName || "—"} (${exam.session || "—"})</span></div>
            </div>
            <div>
              <div class="student-photo">
                ${student.photo_url ? `<img src="${student.photo_url}" alt="Photo" />` : 'No Photo'}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="text-align: left;">Subject</th>
                <th style="width: 80px; text-align: center;">Total Marks</th>
                <th style="width: 90px; text-align: center;">Obtained Marks</th>
                <th style="width: 80px; text-align: center;">Percentage</th>
                <th style="width: 70px; text-align: center;">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${marksRowsHtml}
            </tbody>
          </table>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-title">Total Marks</div>
              <div class="stat-value">${result.totalMarks}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Obtained Marks</div>
              <div class="stat-value" style="color: #2563eb;">${result.obtainedMarks}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Percentage</div>
              <div class="stat-value">${(result.percentage || 0).toFixed(2)}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Grade</div>
              <div class="stat-value" style="color: ${isFail ? '#dc2626' : '#059669'};">${result.grade}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Position</div>
              <div class="stat-value">${position || "—"}</div>
            </div>
          </div>

          <div class="signatures">
            <div class="sign-col">
              <div class="sign-line"></div>
              <div class="sign-title">Class Incharge</div>
            </div>
            <div class="sign-col">
              <div class="sign-line"></div>
              <div class="sign-title">Controller of Examinations</div>
            </div>
            <div class="sign-col">
              <div class="sign-line"></div>
              <div class="sign-title">Principal</div>
            </div>
          </div>
        </body>
        </html>
      `;

      const printWin = window.open("", "_blank");
      printWin?.document.write(reportHtml);
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Examination Results by Class
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                <div className="flex-1">
                  <Label>Filter by Section</Label>
                  <Select
                    value={!allowSections ? "" : resultFilterSection}
                    onValueChange={setResultFilterSection}
                    disabled={!allowSections || !resultFilterClass || resultFilterClass === "*"}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !allowSections
                            ? "Not Applicable"
                            : resultFilterClass && resultFilterClass !== "*"
                            ? "All Sections"
                            : "Select class first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {!allowSections ? (
                        <SelectItem value="">Not Applicable</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="*">All Sections</SelectItem>
                          {availableSections.map((section) => {
                            const secId = extractId(section.id || section._id || section);
                            return (
                              <SelectItem key={secId} value={secId}>
                                {section.name || section.sectionName || "Section"}
                              </SelectItem>
                            );
                          })}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Filter by Exam</Label>
                  <Select
                    value={resultFilterExam}
                    onValueChange={setResultFilterExam}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Exams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="*">All Exams</SelectItem>
                      {availableFilterExams.map((exam) => {
                        const eId = extractId(exam.id || exam._id);
                        return (
                          <SelectItem key={eId} value={eId}>
                            {exam.examName} - {exam.session} {exam.startDate ? `(${formatDateDisplay(exam.startDate)})` : ""}
                          </SelectItem>
                        );
                      })}
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
                {resultsSessionFilteredExams
                  ?.filter((exam) => {
                    const examIdStr = extractId(exam.id || exam._id);
                    if (resultFilterExam && resultFilterExam !== "*") {
                      if (examIdStr !== resultFilterExam) return false;
                    }
                    return true;
                  })
                  .map((exam) => {
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

                  if (allowSections && resultFilterSection && resultFilterSection !== "*") {
                    examResults = examResults.filter((r) => {
                      const secId = extractId(r.student?.sectionId || r.student?.section?.id || r.student?.section?._id || r.sectionId);
                      return secId === resultFilterSection;
                    });
                  }
                  if (examResults.length === 0) return null;
                  return (
                    <Card key={examIdStr} className="mb-4">
                      <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <CardTitle>{exam.examName}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {exam.program?.name} | {exam.session}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
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
                                    <TableCell className="py-2 px-3 text-sm font-semibold">
                                      {result.grade}
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
