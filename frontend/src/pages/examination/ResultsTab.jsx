import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Award, PlusCircle, Printer, SlidersHorizontal, Loader2, Search, PenSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StudentResultsTab } from "../StudentResultsTab";
import { CheckboxMultiSelect } from "@/components/ui/CheckboxMultiSelect";
import {
  getExams,
  getClasses,
  getSections,
  getProgramNames,
  getResults,
  getMarks,
  getStudents,
  generateResults,
  getStudentResult,
  getDefaultReportCardTemplate,
  getTeacherClasses,
  getAcademicSessions,
  getSubjects,
} from "@/services/api";
import { extractId } from "@/lib/utils.jsx";
import { isStudentActive } from "@/lib/studentStatus";
import { formatNormalizedFullName, matchesSearchTokens } from "@/lib/studentSearch";
import { hasExplicitModuleAccess, isDualRoleStaff } from "@/lib/navigation.jsx";
import usePermissions from "@/hooks/usePermissions";
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

export const ResultsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canUpdate } = usePermissions("Examination", "results");

  const [resultDialog, setResultDialog] = useState(false);
  const [resultsExamId, setResultsExamId] = useState("");
  const [resultsSectionId, setResultsSectionId] = useState("");
  const [selectedProgramIds, setSelectedProgramIds] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [resultsSessionFilter, setResultsSessionFilter] = useState("");
  const [resultsStudentSearch, setResultsStudentSearch] = useState("");
  const [showResultsFilters, setShowResultsFilters] = useState(true);
  const sessionInitializedRef = React.useRef(false);

  // Student Results filters
  const [studentResultProgramIds, setStudentResultProgramIds] = useState([]);
  const [studentResultClassIds, setStudentResultClassIds] = useState([]);
  const [studentResultSectionIds, setStudentResultSectionIds] = useState([]);
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

  // Cascading filter resets for Examination Results
  const handleProgramsChange = (newProgramIds) => {
    setSelectedProgramIds(newProgramIds);
    setSelectedClassIds((prev) =>
      prev.filter((cId) => {
        const cls = classesData.find((c) => extractId(c.id || c._id) === cId);
        const pId = extractId(cls?.programId || cls?.program);
        return newProgramIds.includes(pId);
      })
    );
  };

  const handleClassesChange = (newClassIds) => {
    setSelectedClassIds(newClassIds);
    setSelectedSectionIds((prev) =>
      prev.filter((sId) => {
        const sec = sectionsData.find((s) => extractId(s.id || s._id) === sId);
        const cId = extractId(sec?.classId || sec?.class);
        return newClassIds.includes(cId);
      })
    );
    setSelectedExamIds((prev) =>
      prev.filter((eId) => {
        const exam = exams.find((e) => extractId(e.id || e._id) === eId);
        const cId = extractId(exam?.classId || exam?.class);
        return newClassIds.includes(cId);
      })
    );
  };

  const handleSessionChange = (v) => {
    setResultsSessionFilter(v === "__all__" ? "" : v);
    setSelectedProgramIds([]);
    setSelectedClassIds([]);
    setSelectedSectionIds([]);
    setSelectedExamIds([]);
  };

  // Student Results cascading resets
  const handleStudentProgramsChange = (newProgIds) => {
    setStudentResultProgramIds(newProgIds);
    setStudentResultClassIds((prev) =>
      prev.filter((cId) => {
        const cls = classesData.find((c) => extractId(c.id || c._id) === cId);
        const pId = extractId(cls?.programId || cls?.program);
        return newProgIds.includes(pId);
      })
    );
    setStudentResultStudent("");
    setStudentResultExam("");
    setStudentResultData(null);
  };

  const handleStudentClassesChange = (newClassIds) => {
    setStudentResultClassIds(newClassIds);
    setStudentResultSectionIds((prev) =>
      prev.filter((sId) => {
        const sec = sectionsData.find((s) => extractId(s.id || s._id) === sId);
        const cId = extractId(sec?.classId || sec?.class);
        return newClassIds.includes(cId);
      })
    );
    setStudentResultStudent("");
    setStudentResultExam("");
    setStudentResultData(null);
  };

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

  const { data: exams = [], isLoading: isLoadingExams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => getExams(),
  });

  const { data: rawStudents = [] } = useQuery({
    queryKey: ["students", "ACTIVE"],
    queryFn: () => getStudents({ status: "ACTIVE", limit: 1000 }),
  });

  const students = useMemo(() => {
    const list = Array.isArray(rawStudents) ? rawStudents : (rawStudents?.students || []);
    return list.filter(isStudentActive);
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

  const selectedExamObj = useMemo(() => {
    return exams.find((e) => extractId(e.id || e._id) === resultsExamId);
  }, [exams, resultsExamId]);

  const examClassId = extractId(selectedExamObj?.classId || selectedExamObj?.class);
  const selectedClassObj = classesData.find((c) => extractId(c.id || c._id) === examClassId) || selectedExamObj?.class;
  const allowSections = selectedClassObj ? selectedClassObj.allowSections !== false : true;

  const availableSections = useMemo(() => {
    if (!allowSections || !examClassId) return [];
    if (isTeacher) {
      const matching = teacherClassMappings.filter(
        (m) => extractId(m.classId || m.class) === examClassId
      );
      const secs = matching.map((m) => m.section || m.sectionId).filter(Boolean);
      return secs.filter((s, idx, arr) => arr.findIndex((x) => extractId(x) === extractId(s)) === idx);
    }
    return sectionsData.filter((s) => extractId(s.classId || s.class) === examClassId);
  }, [examClassId, allowSections, isTeacher, teacherClassMappings, sectionsData]);

  const sectionOptions = useMemo(() => {
    return availableSections.map((sec) => ({
      value: extractId(sec.id || sec._id || sec),
      label: sec.name || sec.sectionName || "Section",
    }));
  }, [availableSections]);

  const effectiveExamId = (resultsExamId && resultsExamId !== "*")
    ? resultsExamId
    : (selectedExamIds.length > 0 ? selectedExamIds.join(",") : undefined);
  const effectiveSectionId = (resultsSectionId && resultsSectionId !== "*")
    ? resultsSectionId
    : (selectedSectionIds.length > 0 ? selectedSectionIds.join(",") : undefined);
  const effectiveClassId = examClassId || (selectedClassIds.length > 0 ? selectedClassIds.join(",") : undefined);

  const { data: results = [], isLoading: isLoadingResults } = useQuery({
    queryKey: [
      "results",
      resultsSessionFilter,
      selectedProgramIds.join(","),
      effectiveClassId || "",
      effectiveSectionId || "",
      effectiveExamId || "",
    ],
    queryFn: () =>
      getResults({
        sessionId: resultsSessionFilter || undefined,
        programId: selectedProgramIds.length > 0 ? selectedProgramIds.join(",") : undefined,
        classId: effectiveClassId,
        sectionId: effectiveSectionId,
        examId: effectiveExamId,
      }),
  });

  const { data: examMarks = [] } = useQuery({
    queryKey: ["examMarksResults", effectiveExamId],
    queryFn: () => getMarks(effectiveExamId),
    enabled: !!effectiveExamId && effectiveExamId !== "*",
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

  const availableFilterExams = useMemo(() => {
    return resultsSessionFilteredExams.filter((exam) => {
      const eClassId = extractId(exam.classId || exam.class);
      if (isTeacher) {
        if (!teacherClassMappings.some((m) => extractId(m.classId || m.class) === eClassId)) return false;
      }
      return true;
    });
  }, [resultsSessionFilteredExams, isTeacher, teacherClassMappings]);

  const examOptions = useMemo(() => {
    return availableFilterExams.map((exam) => {
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
  }, [availableFilterExams]);

  const getFullName = (student) => {
    return formatNormalizedFullName(student?.fName, student?.lName) || student?.name || "Student";
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

  const marksByStudentId = useMemo(() => {
    const map = new Map();
    if (Array.isArray(examMarks)) {
      examMarks.forEach((m) => {
        const sId = extractId(m.studentId || m.student);
        if (sId) {
          if (!map.has(sId)) map.set(sId, []);
          map.get(sId).push(m);
        }
      });
    }
    return map;
  }, [examMarks]);

  const computeStudentResult = useCallback((r) => {
    const sId = extractId(r.student?.id || r.student?._id || r.studentId);
    const studentMarks = sId ? (marksByStudentId.get(sId) || []) : [];
    if (studentMarks.length > 0) {
      const totalMarks = studentMarks.reduce((sum, m) => sum + (Number(m.totalMarks) || 0), 0);
      const obtainedMarks = studentMarks.reduce((sum, m) => sum + (m.isAbsent ? 0 : (Number(m.obtainedMarks) || 0)), 0);
      const roundedTotal = Math.round(totalMarks * 100) / 100;
      const roundedObtained = Math.round(obtainedMarks * 100) / 100;
      const percentage = roundedTotal > 0 ? (roundedObtained / roundedTotal) * 100 : 0;
      const grade = calculateGrade(percentage).grade;
      return {
        ...r,
        totalMarks: roundedTotal,
        obtainedMarks: roundedObtained,
        percentage,
        grade,
      };
    }
    return r;
  }, [marksByStudentId]);

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

    if (selectedProgramIds.length > 0) {
      filtered = filtered.filter((r) => {
        const progId = extractId(r.student?.programId || r.student?.program?.id || r.student?.program?._id || r.programId);
        return selectedProgramIds.includes(progId);
      });
    }

    if (selectedClassIds.length > 0) {
      filtered = filtered.filter((r) => {
        const clsId = extractId(r.student?.classId || r.student?.class?.id || r.student?.class?._id || r.classId);
        return selectedClassIds.includes(clsId);
      });
    }

    if (allowSections && resultsSectionId && resultsSectionId !== "*") {
      filtered = filtered.filter((r) => {
        const secId = extractId(r.student?.sectionId || r.student?.section?.id || r.student?.section?._id || r.sectionId);
        return secId === resultsSectionId;
      });
    } else if (allowSections && selectedSectionIds.length > 0) {
      filtered = filtered.filter((r) => {
        const secId = extractId(r.student?.sectionId || r.student?.section?.id || r.student?.section?._id || r.sectionId);
        return selectedSectionIds.includes(secId);
      });
    }

    filtered = filtered.map(computeStudentResult);
    filtered.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

    const totalStudents = filtered.length;
    const passedStudents = filtered.filter((r) => r.grade !== "F").length;
    const failedStudents = totalStudents - passedStudents;
    const passPercentage = totalStudents > 0 ? ((passedStudents / totalStudents) * 100).toFixed(1) : "0";

    const progName = exam.program?.name || "";
    const className = exam.class?.name || (selectedClassIds.length === 1 && classesData.find(c => extractId(c) === selectedClassIds[0])?.name) || "All Classes";
    const sectionName = (resultsSectionId && resultsSectionId !== "*")
      ? (sectionsData.find(s => extractId(s) === resultsSectionId)?.name || "")
      : (selectedSectionIds.length === 1)
      ? (sectionsData.find(s => extractId(s) === selectedSectionIds[0])?.name || "")
      : selectedSectionIds.length > 1
      ? `${selectedSectionIds.length} Sections`
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

      const hasSubjects = subjectsData.length > 0;
      const totalMarks = hasSubjects
        ? subjectsData.reduce((acc, s) => acc + (Number(s.totalMarks) || 0), 0)
        : Number(result?.totalMarks || 0);
      const obtainedMarks = hasSubjects
        ? subjectsData.reduce((acc, s) => acc + (Number(s.obtainedMarks) || 0), 0)
        : Number(result?.obtainedMarks || 0);
      const roundedTotal = Math.round(totalMarks * 100) / 100;
      const roundedObtained = Math.round(obtainedMarks * 100) / 100;
      const percentage = roundedTotal > 0 ? (roundedObtained / roundedTotal) * 100 : 0;
      const overallGrade = calculateGrade(percentage).grade;
      const isFail = overallGrade === "F";
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
            .student-form-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            .student-form-table td {
              border: none;
              border-bottom: 1px solid #cbd5e1;
              padding: 5px 8px;
              font-size: 11px;
              vertical-align: middle;
            }
            .student-form-table .form-label {
              width: 110px;
              font-weight: 600;
              color: #64748b;
              white-space: nowrap;
            }
            .student-form-table .form-value {
              font-weight: 600;
              color: #0f172a;
            }
            .student-form-table .photo-cell {
              width: 75px;
              padding: 0 0 0 10px;
              border-bottom: none !important;
              text-align: right;
              vertical-align: top;
            }
            .student-photo {
              width: 70px;
              height: 80px;
              border: 1px solid #cbd5e1;
              border-radius: 2px;
              overflow: hidden;
              background: #f8fafc;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              color: #94a3b8;
              margin-left: auto;
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
            .result-summary-text {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 14px;
              border-top: 1.5px solid #0f172a;
              border-bottom: 1.5px solid #0f172a;
              font-size: 11px;
              margin-top: 6px;
              margin-bottom: 24px;
              background: #f8fafc;
            }
            .result-summary-text span {
              color: #475569;
            }
            .result-summary-text span strong {
              color: #0f172a;
              margin-left: 4px;
              font-size: 12px;
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

          <table class="student-form-table">
            <tbody>
              <tr>
                <td class="form-label">Student Name:</td>
                <td class="form-value">${getFullName(student)}</td>
                <td class="form-label">Class & Program:</td>
                <td class="form-value">${className}${programName ? ` (${programName})` : ""}</td>
                <td rowspan="3" class="photo-cell">
                  <div class="student-photo">
                    ${student.photo_url ? `<img src="${student.photo_url}" alt="Photo" />` : 'No Photo'}
                  </div>
                </td>
              </tr>
              <tr>
                <td class="form-label">Father Name:</td>
                <td class="form-value">${student.fatherOrguardian || student.fatherName || "—"}</td>
                <td class="form-label">Section:</td>
                <td class="form-value">${sectionName || "N/A"}</td>
              </tr>
              <tr>
                <td class="form-label">Roll Number:</td>
                <td class="form-value" style="font-family: monospace;">${student.rollNumber || "—"}</td>
                <td class="form-label">Exam & Session:</td>
                <td class="form-value">${exam.examName || "—"} (${exam.session || "—"})</td>
              </tr>
            </tbody>
          </table>

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

          <div class="result-summary-text">
            <span>Total Marks: <strong>${roundedTotal}</strong></span>
            <span>Obtained Marks: <strong>${roundedObtained}</strong></span>
            <span>Percentage: <strong>${percentage.toFixed(2)}%</strong></span>
            <span>Grade: <strong style="color: ${isFail ? '#b91c1c' : '#047857'};">${overallGrade}</strong></span>
            <span>Position: <strong>${position || result?.position || "—"}</strong></span>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex-1">
                  <Label>Session Filter</Label>
                  <Select
                    value={resultsSessionFilter || "__all__"}
                    onValueChange={(v) => {
                      setResultsSessionFilter(v === "__all__" ? "" : v);
                      setResultsExamId("");
                      setResultsSectionId("");
                    }}
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
                  <Label>Filter by Exam</Label>
                  <SearchableSelect
                    options={examOptions}
                    value={resultsExamId}
                    onChange={(v) => {
                      setResultsExamId(v);
                      setResultsSectionId("");
                    }}
                    placeholder="All Exams"
                    allLabel="All Exams"
                    isLoading={isLoadingExams}
                    searchPlaceholder="Search exam name, class, program..."
                  />
                </div>
                <div className="flex-1">
                  <Label>Filter by Section</Label>
                  <Select
                    value={!allowSections ? "" : resultsSectionId}
                    onValueChange={setResultsSectionId}
                    disabled={!allowSections || !resultsExamId || resultsExamId === "*"}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !resultsExamId || resultsExamId === "*"
                            ? "Select exam first"
                            : !allowSections
                            ? "Not Applicable"
                            : "All Sections"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {!allowSections ? (
                        <SelectItem value="">Not Applicable</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="*">All Sections</SelectItem>
                          {availableSections.map((section) => (
                            <SelectItem key={extractId(section)} value={extractId(section)}>
                              {section.name || section.sectionName}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 max-w-sm">
                <Label>Search Student</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search student by name, father name, or roll no..."
                    value={resultsStudentSearch}
                    onChange={(e) => setResultsStudentSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
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
            ) : !resultsExamId && !resultsSessionFilter ? (
              <div className="text-center py-16">
                <Award className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
                <p className="text-lg font-medium text-muted-foreground">
                  Select an Exam or Session to View Results
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Choose an exam from the filter above to see examination results
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
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
                    if (resultsExamId && resultsExamId !== "*") {
                      if (examIdStr !== resultsExamId) return false;
                    }
                    if (selectedProgramIds.length > 0) {
                      const examProgId = extractId(exam.programId || exam.program);
                      if (examProgId && !selectedProgramIds.includes(examProgId)) return false;
                    }
                    if (selectedClassIds.length > 0) {
                      const examClassId = extractId(exam.classId || exam.class);
                      if (examClassId && !selectedClassIds.includes(examClassId)) return false;
                    }
                    return true;
                  })
                  .map((exam) => {
                  const examIdStr = extractId(exam.id || exam._id);
                  let examResults = results.filter((r) => extractId(r.examId || r.exam?.id || r.exam?._id) === examIdStr);

                  if (allowSections && resultsSectionId && resultsSectionId !== "*") {
                    examResults = examResults.filter((r) => {
                      const secId = extractId(r.student?.sectionId || r.student?.section?.id || r.student?.section?._id || r.sectionId);
                      return secId === resultsSectionId;
                    });
                  } else if (allowSections && selectedSectionIds.length > 0) {
                    examResults = examResults.filter((r) => {
                      const secId = extractId(r.student?.sectionId || r.student?.section?.id || r.student?.section?._id || r.sectionId);
                      return selectedSectionIds.includes(secId);
                    });
                  }
                  if (resultsStudentSearch.trim()) {
                    examResults = examResults.filter((r) =>
                      matchesSearchTokens(resultsStudentSearch, [
                        r.student ? getFullName(r.student) : "",
                        r.student?.fatherOrguardian,
                        r.student?.rollNumber,
                      ])
                    );
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
                              .map(computeStudentResult)
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
          isLoadingExams={isLoadingExams}
          studentResultProgramIds={studentResultProgramIds}
          setStudentResultProgramIds={handleStudentProgramsChange}
          studentResultClassIds={studentResultClassIds}
          setStudentResultClassIds={handleStudentClassesChange}
          studentResultSectionIds={studentResultSectionIds}
          setStudentResultSectionIds={setStudentResultSectionIds}
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
