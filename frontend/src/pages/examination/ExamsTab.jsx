import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  BookOpen,
  PlusCircle,
  Edit,
  Trash2,
  Printer,
  Eye,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createExam as createExamApi,
  updateExam,
  delExam,
  getExams,
  getClasses,
  getProgramNames,
  getSubjects,
  getSubjectClassMappings,
  getSubjectsForClassWithAssignments,
  getAcademicSessions,
  getTeacherClasses,
} from "../../../config/apis";
import { hasExplicitModuleAccess, isDualRoleStaff } from "@/lib/navigation.jsx";
import { extractId } from "@/lib/utils.jsx";
import usePermissions from "@/hooks/usePermissions";

export function ExamsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Examination", "exams");

  const [examSearch, setExamSearch] = useState("");
  const [examProgramFilter, setExamProgramFilter] = useState("");
  const [examClassFilter, setExamClassFilter] = useState("");
  const [examDateFilter, setExamDateFilter] = useState("");
  const [examSessionFilter, setExamSessionFilter] = useState("");
  const [showExamsFilters, setShowExamsFilters] = useState(true);
  const [showAllSubjectsInSchedule, setShowAllSubjectsInSchedule] = useState(false);
  const sessionInitializedRef = React.useRef(false);

  const [examDialog, setExamDialog] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [viewingExam, setViewingExam] = useState(null);
  const [viewExamDialog, setViewExamDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [examForm, setExamForm] = useState({
    examName: "",
    program: "",
    classId: "",
    session: "",
    sessionId: "",
    startDate: "",
    endDate: "",
    type: "",
    description: "",
    schedule: [],
  });

  const currentUser = queryClient.getQueryData(["currentUser"]);
  const isTeacherRole =
    currentUser?.role === "TEACHER" || currentUser?.role === "Teacher";
  const dualRoleStaff = isDualRoleStaff(currentUser);
  const hasExaminationPermission = hasExplicitModuleAccess(
    currentUser,
    "Examination"
  );
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

  const { data: allSubjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjects,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  React.useEffect(() => {
    if (!sessionInitializedRef.current && sessions && sessions.length > 0) {
      const active = sessions.find((s) => s.isActive) || sessions[0];
      if (active) {
        setExamSessionFilter(extractId(active));
      }
      sessionInitializedRef.current = true;
    }
  }, [sessions]);

  const { data: classAssignedSubjects = [], isLoading: isLoadingClassSubjects } = useQuery({
    queryKey: ["classAssignedSubjects", examForm.classId, examForm.sessionId],
    queryFn: () =>
      getSubjectsForClassWithAssignments(
        examForm.classId,
        examForm.sessionId || undefined
      ),
    enabled: !!examForm.classId,
  });

  const examFormClassSubjects = React.useMemo(() => {
    const allSubjectsMap = new Map();
    (allSubjects || []).forEach((s) => {
      const sId = extractId(s.id || s._id);
      if (sId) {
        allSubjectsMap.set(sId, s);
      }
    });

    const resolveSubjectName = (sub, sId) => {
      if (sub?.name && typeof sub.name === "string" && !sub.name.trim().startsWith("Subject #")) {
        return sub.name.trim();
      }
      if (sub?.subjectName && typeof sub.subjectName === "string" && !sub.subjectName.trim().startsWith("Subject #")) {
        return sub.subjectName.trim();
      }
      const found = allSubjectsMap.get(sId);
      if (found?.name) {
        return found.name;
      }
      if (typeof sub?.subjectId === "object" && sub.subjectId?.name) {
        return sub.subjectId.name;
      }
      return `Subject #${sId}`;
    };

    const resolveSubjectCode = (sub, sId) => {
      if (sub?.code) return sub.code;
      const found = allSubjectsMap.get(sId);
      return found?.code || "";
    };

    const classList = [];
    if (Array.isArray(classAssignedSubjects) && classAssignedSubjects.length > 0) {
      classAssignedSubjects.forEach((sub) => {
        const sId = extractId(sub.id || sub._id || sub.subjectId || sub.subject);
        if (sId) {
          classList.push({
            id: sId,
            name: resolveSubjectName(sub, sId),
            code: resolveSubjectCode(sub, sId),
            ...sub,
          });
        }
      });
    }

    const baseList =
      classList.length > 0 && !showAllSubjectsInSchedule
        ? classList
        : (allSubjects || []).map((s) => {
            const sId = extractId(s.id || s._id);
            return {
              id: sId,
              name: s.name || `Subject #${sId}`,
              code: s.code || "",
              ...s,
            };
          });

    const result = [...baseList];
    (examForm.schedule || []).forEach((sched) => {
      const schedSubId = extractId(sched.subjectId);
      if (schedSubId && !result.some((r) => extractId(r.id || r._id) === schedSubId)) {
        const found = allSubjectsMap.get(schedSubId);
        result.push({
          id: schedSubId,
          name: resolveSubjectName(sched, schedSubId),
          code: resolveSubjectCode(sched, schedSubId),
          ...(found || {}),
        });
      }
    });

    return result;
  }, [classAssignedSubjects, allSubjects, examForm.classId, showAllSubjectsInSchedule, examForm.schedule]);

  const availableClasses = isTeacher
    ? teacherClassMappings
        .filter((m) => extractId(m.class?.programId || m.class?.program) === examForm.program)
        .map((m) => m.class)
        .filter((c, idx, arr) => arr.findIndex((x) => extractId(x) === extractId(c)) === idx)
    : classesData.filter((c) => extractId(c.programId || c.program) === examForm.program);

  const filterAvailableClasses = isTeacher
    ? teacherClassMappings
        .filter((m) => !examProgramFilter || extractId(m.class?.programId || m.class?.program) === examProgramFilter)
        .map((m) => m.class)
        .filter((c, idx, arr) => arr.findIndex((x) => extractId(x) === extractId(c)) === idx)
    : examProgramFilter
    ? classesData.filter((c) => extractId(c.programId || c.program) === examProgramFilter)
    : classesData;

  const createExamMutation = useMutation({
    mutationFn: createExamApi,
    onSuccess: () => {
      toast({ title: "Exam created successfully" });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      setExamForm({
        examName: "",
        program: "",
        classId: "",
        session: "",
        sessionId: "",
        startDate: "",
        endDate: "",
        type: "Midterm",
        description: "",
        schedule: [],
      });
      setExamDialog(false);
      setEditingExam(null);
    },
    onError: (err) =>
      toast({
        title: "Failed to create exam",
        description: err.message || "An unexpected error occurred while creating the exam.",
        variant: "destructive",
      }),
  });

  const updateExamMutation = useMutation({
    mutationFn: ({ id, payload }) => updateExam(id, payload),
    onSuccess: () => {
      toast({ title: "Exam updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      setExamDialog(false);
      setEditingExam(null);
    },
    onError: (err) =>
      toast({
        title: "Failed to update exam",
        description: err.message || "An unexpected error occurred while updating the exam.",
        variant: "destructive",
      }),
  });

  const isSubmitting = createExamMutation?.isPending || updateExamMutation?.isPending;

  const deleteExamMutation = useMutation({
    mutationFn: delExam,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exams"] }),
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteExamMutation.mutate(deleteTarget.id);
    toast({ title: "Exam deleted" });
    setDeleteDialog(false);
    setDeleteTarget(null);
  };

  const handleExamSubmit = () => {
    if (!examForm.examName?.trim() || !examForm.program || !examForm.classId || !examForm.session) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill exam name, program, class, and session.",
        variant: "destructive",
      });
      return;
    }

    if (!examForm.startDate || !examForm.endDate) {
      toast({
        title: "Missing Dates",
        description: "Please specify both Start Date and End Date for the exam.",
        variant: "destructive",
      });
      return;
    }

    const checkedSubjects = (examForm.schedule || []).filter((s) => s.included);
    const incompleteSubject = checkedSubjects.find((s) => !s.date || !s.startTime || !s.endTime);
    if (incompleteSubject) {
      toast({
        title: "Incomplete Schedule",
        description: "Please specify date, start time, and end time for all included subjects, or uncheck them.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      examName: examForm.examName.trim(),
      programId: extractId(examForm.program),
      classId: extractId(examForm.classId),
      session: examForm.session,
      sessionId: extractId(examForm.sessionId) || undefined,
      startDate: examForm.startDate ? examForm.startDate.split("T")[0] : "",
      endDate: examForm.endDate ? examForm.endDate.split("T")[0] : "",
      type: examForm.type || "Final",
      description: examForm.description || "",
      schedule: checkedSubjects.map((s) => ({
        subjectId: extractId(s.subjectId),
        date: s.date ? s.date.split("T")[0] : "",
        startTime: s.startTime,
        endTime: s.endTime,
        totalMarks: Number(s.totalMarks) || 100,
      })),
    };

    if (editingExam) {
      const examId = extractId(editingExam.id || editingExam._id || editingExam);
      if (!examId) {
        toast({
          title: "Exam ID Missing",
          description: "Cannot identify the exam to update. Please refresh and try again.",
          variant: "destructive",
        });
        return;
      }
      updateExamMutation.mutate({ id: examId, payload });
    } else {
      createExamMutation.mutate(payload);
    }
  };

  const handlePrintDateSheet = (exam) => {
    const printWindow = window.open("", "_blank");
    const programName = exam.program?.name || exam.programId?.name || "N/A";
    const className = exam.class?.name || exam.classId?.name || "N/A";

    const scheduleList = exam.schedule || exam.schedules || [];
    const scheduleRows = scheduleList
      .map((s) => {
        const sId = extractId(s.subjectId);
        const subject = allSubjects.find((sub) => extractId(sub) === sId) || (typeof s.subjectId === "object" ? s.subjectId : null);
        const subjectName = subject?.name || s.subjectName || (typeof s.subjectId === "string" ? s.subjectId : "Unknown");
        return `
        <tr>
          <td style="padding: 12px; border: 1px solid #ccc; font-weight: bold; color: #ed7d31;">${
            subjectName
          }</td>
          <td style="padding: 12px; border: 1px solid #ccc;">${
            s.date
              ? new Date(s.date + (s.date.includes("T") ? "" : "T00:00:00")).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "N/A"
          }</td>
          <td style="padding: 12px; border: 1px solid #ccc; text-align: center;">${
            s.startTime
          }</td>
          <td style="padding: 12px; border: 1px solid #ccc; text-align: center;">${
            s.endTime
          }</td>
          <td style="padding: 12px; border: 1px solid #ccc; text-align: center;">${
            s.totalMarks || 100
          }</td>
        </tr>
      `;
      })
      .join("");

    printWindow?.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Date Sheet - ${exam.examName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
          body { font-family: 'Roboto', sans-serif; margin: 0; padding: 40px; -webkit-print-color-adjust: exact; color: #333; }
          .header { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 30px; border-bottom: 2px solid #ed7d31; padding-bottom: 20px; }
          .institute-info { text-align: center; }
          .institute-info h1 { margin: 0; font-size: 28px; font-weight: bold; color: #000; text-transform: uppercase; }
          .institute-info p { margin: 5px 0; font-size: 14px; color: #555; font-weight: 500; }
          .title-bar { background-color: #ed7d31; color: white; text-align: center; padding: 12px; font-weight: bold; font-size: 18px; margin-bottom: 30px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
          .details-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; background: #fffaf7; padding: 20px; border: 1px solid #ffe8d9; border-radius: 8px; }
          .detail-item { display: flex; border-bottom: 1px solid #eee; padding: 8px 0; }
          .detail-label { font-weight: bold; width: 140px; color: #ed7d31; font-size: 13px; text-transform: uppercase; }
          .detail-value { font-size: 14px; color: #000; font-weight: 500; }
          .schedule-table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #ccc; }
          .schedule-table th { background-color: #ed7d31; color: white; padding: 12px 15px; text-align: left; font-size: 13px; font-weight: bold; text-transform: uppercase; border: 1px solid #ed7d31; }
          .schedule-table td { padding: 12px 15px; border: 1px solid #ccc; font-size: 14px; color: #333; }
          .schedule-table tr:nth-child(even) { background-color: #f9f9f9; }
          .signatures { display: flex; justify-content: space-between; margin-top: 80px; }
          .sig-box { text-align: center; width: 220px; }
          .sig-line { border-top: 2px solid #000; margin-bottom: 10px; }
          .sig-label { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #555; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="institute-info">
            <h1>Concordia College</h1>
            <p>Official Examination Schedule & Date Sheet</p>
          </div>
        </div>
        <div class="title-bar">${exam.examName}</div>
        <div class="details-container">
          <div class="detail-item"><span class="detail-label">Program:</span><span class="detail-value">${programName}</span></div>
          <div class="detail-item"><span class="detail-label">Class:</span><span class="detail-value">${className}</span></div>
          <div class="detail-item"><span class="detail-label">Session:</span><span class="detail-value">${exam.session || "N/A"}</span></div>
          <div class="detail-item"><span class="detail-label">Exam Type:</span><span class="detail-value">${exam.type}</span></div>
        </div>
        <table class="schedule-table">
          <thead>
            <tr><th>Subject</th><th>Date</th><th style="text-align:center;">Start Time</th><th style="text-align:center;">End Time</th><th style="text-align:center;">Total Marks</th></tr>
          </thead>
          <tbody>${scheduleRows}</tbody>
        </table>
        <div class="signatures">
          <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Controller of Examinations</div></div>
          <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Principal</div></div>
        </div>
      </body>
      </html>
    `);
    printWindow?.document.close();
    printWindow?.print();
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    return dateString.split("T")[0];
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return "N/A";
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

  const filteredExams = exams.filter((exam) => {
    if (examSessionFilter) {
      const selectedSession = sessions.find((s) => extractId(s) === examSessionFilter);
      const sessionName = selectedSession?.name?.toLowerCase().trim();
      const examSessionName = exam.session?.toLowerCase().trim();
      const matchSession =
        extractId(exam.sessionId) === examSessionFilter ||
        (sessionName && examSessionName && examSessionName === sessionName) ||
        (sessionName && examSessionName && examSessionName.includes(sessionName)) ||
        (sessionName && examSessionName && sessionName.includes(examSessionName));
      if (!matchSession) return false;
    }
    if (examProgramFilter) {
      if (extractId(exam.programId || exam.program) !== examProgramFilter) return false;
    }
    if (examClassFilter) {
      if (extractId(exam.classId || exam.class) !== examClassFilter) return false;
    }
    if (examDateFilter) {
      const startMatches = exam.startDate && exam.startDate.startsWith(examDateFilter);
      const scheduleMatches = (exam.schedule || exam.schedules || []).some(
        (s) => s.date === examDateFilter
      );
      if (!startMatches && !scheduleMatches) return false;
    }
    if (examSearch.trim()) {
      const q = examSearch.toLowerCase();
      const nameMatches = exam.examName?.toLowerCase().includes(q);
      const progMatches = (exam.program?.name || exam.programId?.name || "").toLowerCase().includes(q);
      const classMatches = (exam.class?.name || exam.classId?.name || "").toLowerCase().includes(q);
      if (!nameMatches && !progMatches && !classMatches) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Exam Management
        </CardTitle>
        <Dialog
          open={examDialog}
          onOpenChange={(open) => {
            if (!isSubmitting) setExamDialog(open);
          }}
        >
          {canCreate && (
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  const activeSession = sessions.find((s) => s.isActive) || sessions[0];
                  setEditingExam(null);
                  setExamForm({
                    examName: "",
                    program: "",
                    classId: "",
                    session: activeSession?.name || "",
                    sessionId: activeSession ? extractId(activeSession) : "",
                    startDate: "",
                    endDate: "",
                    type: "Midterm",
                    description: "",
                    schedule: [],
                  });
                }}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Exam
              </Button>
            </DialogTrigger>
          )}
          <DialogContent
            className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto"
            onPointerDownOutside={(e) => {
              if (isSubmitting) e.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingExam ? "Edit Exam" : "Create New Exam"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-4 p-2">
              <div className="space-y-2">
                <Label>Exam Name</Label>
                <Input
                  value={examForm.examName}
                  onChange={(e) =>
                    setExamForm({ ...examForm, examName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Program *</Label>
                <Select
                  value={examForm.program}
                  onValueChange={(value) => {
                    setExamForm({ ...examForm, program: value, classId: "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs?.map((program) => (
                      <SelectItem
                        key={extractId(program)}
                        value={extractId(program)}
                      >
                        {program?.name} — {program?.department?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Class *</Label>
                <Select
                  value={examForm.classId}
                  onValueChange={(value) => {
                    setExamForm({ ...examForm, classId: value });
                  }}
                  disabled={!examForm.program}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses?.map((c) => (
                      <SelectItem key={extractId(c)} value={extractId(c)}>
                        {c?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Session *</Label>
                <Select
                  value={examForm.sessionId || ""}
                  onValueChange={(value) => {
                    const sel = sessions.find((s) => extractId(s) === value);
                    setExamForm({
                      ...examForm,
                      sessionId: value,
                      session: sel?.name || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={extractId(s)} value={extractId(s)}>
                        {s.name}
                        {s.isActive && " (Active)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formatDateForInput(examForm.startDate)}
                  onChange={(e) =>
                    setExamForm({ ...examForm, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formatDateForInput(examForm.endDate)}
                  onChange={(e) =>
                    setExamForm({ ...examForm, endDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Exam Type</Label>
                <Select
                  value={examForm.type}
                  onValueChange={(value) =>
                    setExamForm({ ...examForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Midterm">Midterm</SelectItem>
                    <SelectItem value="Final">Final</SelectItem>
                    <SelectItem value="Quiz">Quiz</SelectItem>
                    <SelectItem value="Class Test">Class Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-4">
                <Label>Description</Label>
                <Input
                  value={examForm.description}
                  onChange={(e) =>
                    setExamForm({ ...examForm, description: e.target.value })
                  }
                />
              </div>

              {/* Schedule Section */}
              <div className="col-span-4 border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">Exam Schedule</h4>
                    <p className="text-xs text-muted-foreground">
                      Select subjects to include in this exam and set their dates and times.
                    </p>
                  </div>
                  {examForm.classId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-primary h-7"
                      onClick={() => setShowAllSubjectsInSchedule((prev) => !prev)}
                    >
                      {showAllSubjectsInSchedule
                        ? "Show Class Subjects Only"
                        : "Show All Institute Subjects"}
                    </Button>
                  )}
                </div>

                {!examForm.classId ? (
                  <div className="p-6 text-center border rounded-md bg-muted/20 text-muted-foreground text-sm">
                    Please select a Class above to configure the exam schedule.
                  </div>
                ) : isLoadingClassSubjects ? (
                  <div className="p-6 text-center border rounded-md text-muted-foreground text-sm">
                    Loading class subjects...
                  </div>
                ) : examFormClassSubjects.length === 0 ? (
                  <div className="p-6 text-center border rounded-md text-muted-foreground text-sm">
                    No subjects found for this class. You can switch to show all institute subjects using the toggle above.
                  </div>
                ) : (
                  <div className="border rounded-md max-h-[350px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Include</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead>Total Marks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examFormClassSubjects.map((subject) => {
                          const scheduleEntry = examForm.schedule?.find(
                            (s) => extractId(s.subjectId) === subject.id
                          ) || {
                            subjectId: subject.id,
                            date: "",
                            startTime: "",
                            endTime: "",
                            included: false,
                            totalMarks: 100,
                          };

                          return (
                            <TableRow key={subject.id}>
                              <TableCell>
                                <Checkbox
                                  checked={!!scheduleEntry.included}
                                  onCheckedChange={(checked) => {
                                    const newSchedule = [
                                      ...(examForm.schedule || []),
                                    ];
                                    const index = newSchedule.findIndex(
                                      (s) => extractId(s.subjectId) === subject.id
                                    );
                                    if (index > -1) {
                                      newSchedule[index] = {
                                        ...newSchedule[index],
                                        included: !!checked,
                                      };
                                    } else {
                                      newSchedule.push({
                                        subjectId: subject.id,
                                        date: "",
                                        startTime: "",
                                        endTime: "",
                                        included: !!checked,
                                        totalMarks: 100,
                                      });
                                    }
                                    setExamForm({
                                      ...examForm,
                                      schedule: newSchedule,
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {subject.name}
                                {subject.code ? ` (${subject.code})` : ""}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={scheduleEntry.date || ""}
                                  disabled={!scheduleEntry.included}
                                  onChange={(e) => {
                                    const newSchedule = [
                                      ...(examForm.schedule || []),
                                    ];
                                    const index = newSchedule.findIndex(
                                      (s) => extractId(s.subjectId) === subject.id
                                    );
                                    if (index > -1) {
                                      newSchedule[index] = {
                                        ...newSchedule[index],
                                        date: e.target.value,
                                      };
                                    } else {
                                      newSchedule.push({
                                        subjectId: subject.id,
                                        date: e.target.value,
                                        startTime: "",
                                        endTime: "",
                                        included: true,
                                        totalMarks: 100,
                                      });
                                    }
                                    setExamForm({
                                      ...examForm,
                                      schedule: newSchedule,
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="time"
                                  value={scheduleEntry.startTime || ""}
                                  disabled={!scheduleEntry.included}
                                  onChange={(e) => {
                                    const newSchedule = [
                                      ...(examForm.schedule || []),
                                    ];
                                    const index = newSchedule.findIndex(
                                      (s) => extractId(s.subjectId) === subject.id
                                    );
                                    if (index > -1) {
                                      newSchedule[index] = {
                                        ...newSchedule[index],
                                        startTime: e.target.value,
                                      };
                                    } else {
                                      newSchedule.push({
                                        subjectId: subject.id,
                                        date: "",
                                        startTime: e.target.value,
                                        endTime: "",
                                        included: true,
                                        totalMarks: 100,
                                      });
                                    }
                                    setExamForm({
                                      ...examForm,
                                      schedule: newSchedule,
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="time"
                                  value={scheduleEntry.endTime || ""}
                                  disabled={!scheduleEntry.included}
                                  onChange={(e) => {
                                    const newSchedule = [
                                      ...(examForm.schedule || []),
                                    ];
                                    const index = newSchedule.findIndex(
                                      (s) => extractId(s.subjectId) === subject.id
                                    );
                                    if (index > -1) {
                                      newSchedule[index] = {
                                        ...newSchedule[index],
                                        endTime: e.target.value,
                                      };
                                    } else {
                                      newSchedule.push({
                                        subjectId: subject.id,
                                        date: "",
                                        startTime: "",
                                        endTime: e.target.value,
                                        included: true,
                                        totalMarks: 100,
                                      });
                                    }
                                    setExamForm({
                                      ...examForm,
                                      schedule: newSchedule,
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={scheduleEntry.totalMarks ?? 100}
                                  disabled={!scheduleEntry.included}
                                  onChange={(e) => {
                                    const newSchedule = [
                                      ...(examForm.schedule || []),
                                    ];
                                    const index = newSchedule.findIndex(
                                      (s) => extractId(s.subjectId) === subject.id
                                    );
                                    if (index > -1) {
                                      newSchedule[index] = {
                                        ...newSchedule[index],
                                        totalMarks: Number(e.target.value),
                                      };
                                    } else {
                                      newSchedule.push({
                                        subjectId: subject.id,
                                        date: "",
                                        startTime: "",
                                        endTime: "",
                                        included: true,
                                        totalMarks: Number(e.target.value),
                                      });
                                    }
                                    setExamForm({
                                      ...examForm,
                                      schedule: newSchedule,
                                    });
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="col-span-4">
                <Button
                  onClick={handleExamSubmit}
                  disabled={isSubmitting}
                  className="w-full font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingExam ? "Updating Exam..." : "Creating Exam..."}
                    </>
                  ) : (
                    editingExam ? "Update Exam" : "Create Exam"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Exam Details Dialog */}
        <Dialog open={viewExamDialog} onOpenChange={setViewExamDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex justify-between items-center w-full">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  Exam Details
                </DialogTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-primary border-border hover:bg-primary/5"
                  onClick={() => handlePrintDateSheet(viewingExam)}
                >
                  <Printer className="w-4 h-4" />
                  Print Date Sheet
                </Button>
              </div>
            </DialogHeader>

            {viewingExam && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 overflow-hidden h-full">
                <div className="md:col-span-1 border-r p-6 space-y-6 overflow-y-auto bg-muted/5">
                  <div className="space-y-4">
                    <div>
                      <Badge
                        variant="outline"
                        className="mb-2 text-primary border-border bg-primary/5"
                      >
                        {viewingExam.type}
                      </Badge>
                      <h3 className="text-2xl font-bold text-primary">
                        {viewingExam.examName}
                      </h3>
                      <p className="text-sm font-medium text-muted-foreground">
                        {viewingExam.session} Session
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Program
                        </p>
                        <p className="font-medium">
                          {viewingExam.program?.name || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Class
                        </p>
                        <p className="font-medium">
                          {viewingExam.class?.name || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Duration
                        </p>
                        <div className="flex flex-col text-sm">
                          <span>
                            Starts:{" "}
                            {formatDateDisplay(viewingExam.startDate)}
                          </span>
                          <span>
                            Ends:{" "}
                            {formatDateDisplay(viewingExam.endDate)}
                          </span>
                        </div>
                      </div>
                      {viewingExam.description && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Description
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {viewingExam.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 p-6 overflow-y-auto space-y-6">
                  <div>
                    <h4 className="font-semibold text-lg mb-4">
                      Schedule & Date Sheet
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Total Marks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(viewingExam.schedule || viewingExam.schedules || []).map((s) => {
                          const sId = extractId(s.subjectId);
                          const subject = allSubjects.find(
                            (sub) => extractId(sub) === sId
                          ) || (typeof s.subjectId === "object" ? s.subjectId : null);
                          return (
                            <TableRow key={sId || extractId(s)}>
                              <TableCell className="font-medium">
                                {subject?.name || s.subjectName || "Unknown"}
                              </TableCell>
                              <TableCell>
                                {formatDateDisplay(s.date)}
                              </TableCell>
                              <TableCell>
                                {s.startTime} - {s.endTime}
                              </TableCell>
                              <TableCell>{s.totalMarks || 100}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search exams..."
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowExamsFilters((s) => !s)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {showExamsFilters ? "Hide Filters" : "Filters"}
            </Button>
          </div>

          <div
            className={`transition-all duration-300 ease-out overflow-hidden ${
              showExamsFilters
                ? "max-h-[520px] opacity-100"
                : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div>
                <Label>Session Filter</Label>
                <Select
                  value={examSessionFilter || "__all__"}
                  onValueChange={(v) =>
                    setExamSessionFilter(v === "__all__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Sessions</SelectItem>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                        {s.isActive && " (Active)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Program Filter</Label>
                <Select
                  value={examProgramFilter || "__all__"}
                  onValueChange={(v) => {
                    setExamProgramFilter(v === "__all__" ? "" : v);
                    setExamClassFilter("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Programs</SelectItem>
                    {programs.map((p) => (
                      <SelectItem key={extractId(p)} value={extractId(p)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class Filter</Label>
                <Select
                  value={examClassFilter || "__all__"}
                  onValueChange={(v) => setExamClassFilter(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Classes</SelectItem>
                    {filterAvailableClasses.map((c) => (
                      <SelectItem key={extractId(c)} value={extractId(c)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={examDateFilter}
                  onChange={(e) => setExamDateFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams
                  ?.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">
                        {exam.examName}
                      </TableCell>
                      <TableCell>{exam.program?.name || exam.programId?.name || "N/A"}</TableCell>
                      <TableCell>{exam.class?.name || exam.classId?.name || "N/A"}</TableCell>
                      <TableCell>{exam.session || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{exam.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatDateDisplay(exam.startDate)}
                      </TableCell>
                      <TableCell>
                        {formatDateDisplay(exam.endDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setViewingExam(exam);
                                  setViewExamDialog(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Details</TooltipContent>
                          </Tooltip>
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingExam(exam);
                                    setExamForm({
                                      examName: exam.examName,
                                      program: extractId(exam.programId || exam.program),
                                      classId: extractId(exam.classId || exam.class),
                                      session: exam.session || "",
                                      sessionId: extractId(exam.sessionId),
                                      startDate: exam.startDate ? exam.startDate.split("T")[0] : "",
                                      endDate: exam.endDate ? exam.endDate.split("T")[0] : "",
                                      type: exam.type,
                                      description: exam.description || "",
                                      schedule: (exam.schedule || exam.schedules || []).map((s) => ({
                                        subjectId: extractId(s.subjectId),
                                        subjectName: s.subjectName || (typeof s.subjectId === "object" ? s.subjectId?.name : ""),
                                        date: s.date ? s.date.split("T")[0] : "",
                                        startTime: s.startTime,
                                        endTime: s.endTime,
                                        totalMarks: s.totalMarks || 100,
                                        included: true,
                                      })),
                                    });
                                    setExamDialog(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Exam</TooltipContent>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setDeleteTarget({ type: "exam", id: exam.id });
                                    setDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Exam</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                {filteredExams?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      No exams found. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this exam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default ExamsTab;
