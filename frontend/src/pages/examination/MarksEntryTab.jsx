import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  SlidersHorizontal,
  LayoutGrid,
  Eye,
  Edit,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getExams,
  getClasses,
  getSections,
  getProgramNames,
  getMarks,
  getStudents,
  bulkCreateMarks,
  delMarks,
  getSubjects,
  getTeacherClasses,
  getAcademicSessions,
} from "@/services/api";
import { hasExplicitModuleAccess, isDualRoleStaff } from "@/lib/navigation.jsx";
import { extractId } from "@/lib/utils.jsx";
import { isStudentActive } from "@/lib/studentStatus";
import { formatNormalizedFullName, matchesSearchTokens } from "@/lib/studentSearch";
import usePermissions from "@/hooks/usePermissions";

export const MarksEntryTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [marksFilterProgram, setMarksFilterProgram] = useState("");
  const [marksFilterClass, setMarksFilterClass] = useState("");
  const [marksFilterExam, setMarksFilterExam] = useState("");
  const [marksFilterSection, setMarksFilterSection] = useState("");
  const [marksSessionFilter, setMarksSessionFilter] = useState("");
  const [marksStudentSearch, setMarksStudentSearch] = useState("");
  const [showMarksFilters, setShowMarksFilters] = useState(true);
  const sessionInitializedRef = React.useRef(false);

  // Bulk Marks Entry States
  const [bulkMarksDialog, setBulkMarksDialog] = useState(false);
  const [bulkMarksEditMode, setBulkMarksEditMode] = useState(false);
  const [viewMarksDetail, setViewMarksDetail] = useState(null);
  const [bulkExamId, setBulkExamId] = useState("");
  const [bulkSectionId, setBulkSectionId] = useState("");
  const [bulkMarksData, setBulkMarksData] = useState({});
  const [bulkAbsentees, setBulkAbsentees] = useState({});

  // Cascading filter resets
  useEffect(() => {
    setMarksFilterClass("");
    setMarksFilterExam("");
    setMarksFilterSection("");
  }, [marksFilterProgram]);

  useEffect(() => {
    setMarksFilterExam("");
    setMarksFilterSection("");
  }, [marksFilterClass]);

  useEffect(() => {
    setMarksFilterProgram("");
    setMarksFilterClass("");
    setMarksFilterSection("");
    setMarksFilterExam("");
  }, [marksSessionFilter]);

  // Auth / Roles
  const { canCreate, canUpdate, canDelete, isSuperAdmin, currentUser } = usePermissions("Examination", "marks");
  const isTeacherRole =
    currentUser?.role === "TEACHER" || currentUser?.role === "Teacher" || !!currentUser?.isTeaching;
  const dualRoleStaff = isDualRoleStaff(currentUser);
  const hasExaminationPermission = hasExplicitModuleAccess(currentUser, "Examination");
  const isTeacher = isTeacherRole && (!dualRoleStaff || !hasExaminationPermission);
  const canEnterMarks = isTeacher || isSuperAdmin || canCreate || canUpdate;
  const canEditMarks = isTeacher || isSuperAdmin || canUpdate;
  const canDeleteMarks = isSuperAdmin || canDelete;

  const teacherStaffId = currentUser?.refId || currentUser?.staffDbId || currentUser?.id;
  const { data: rawTeacherClassMappings = [] } = useQuery({
    queryKey: ["teacherClasses", teacherStaffId],
    queryFn: () => getTeacherClasses(teacherStaffId),
    enabled: isTeacher && !!teacherStaffId,
  });

  const teacherClassMappings = useMemo(() => {
    return Array.isArray(rawTeacherClassMappings)
      ? rawTeacherClassMappings
      : rawTeacherClassMappings?.data || [];
  }, [rawTeacherClassMappings]);

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: getProgramNames,
  });

  const { data: classesData = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: sectionsData = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: () => getExams(),
  });

  const { data: subjects = [] } = useQuery({
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
        setMarksSessionFilter(extractId(active.id || active._id));
      }
      sessionInitializedRef.current = true;
    }
  }, [sessions]);

  const marksSessionObj = sessions.find((s) => extractId(s.id || s._id) === marksSessionFilter);
  const marksSessionName = marksSessionObj?.name;
  const marksSessionFilteredExams = marksSessionFilter
    ? exams.filter((e) => {
        const examSessionId = extractId(e.sessionId || e.session?.id || e.session?._id);
        const examSessionName = typeof e.session === "string" ? e.session : e.session?.name;
        return (
          examSessionId === marksSessionFilter ||
          (marksSessionName && examSessionName && examSessionName.toLowerCase() === marksSessionName.toLowerCase())
        );
      })
    : exams;

  // Available programs for filter
  const availablePrograms = useMemo(() => {
    if (!isTeacher) return programs;
    const teacherProgMap = new Map();
    teacherClassMappings.forEach((m) => {
      const cls = m.class || m.classId;
      const prog = cls?.programId || cls?.program || m.programId || m.program;
      const pId = extractId(prog);
      if (pId) {
        teacherProgMap.set(
          pId,
          prog?.name ? prog : (programs.find((p) => extractId(p) === pId) || { _id: pId, id: pId, name: pId })
        );
      }
    });
    return Array.from(teacherProgMap.values());
  }, [programs, isTeacher, teacherClassMappings]);

  const availableClasses = useMemo(() => {
    if (isTeacher) {
      return teacherClassMappings
        .filter((m) => {
          if (!marksFilterProgram || marksFilterProgram === "*") return true;
          const cls = m.class || m.classId;
          const progId = extractId(cls?.programId || cls?.program || m.programId || m.program);
          return progId === marksFilterProgram;
        })
        .map((m) => m.class || m.classId)
        .filter(Boolean)
        .filter((c, idx, arr) => arr.findIndex((x) => extractId(x) === extractId(c)) === idx);
    }
    return marksFilterProgram && marksFilterProgram !== "*"
      ? classesData.filter((c) => extractId(c.programId || c.program) === marksFilterProgram)
      : classesData;
  }, [isTeacher, teacherClassMappings, marksFilterProgram, classesData]);

  const selectedClassObj =
    classesData.find((c) => extractId(c) === marksFilterClass) ||
    teacherClassMappings.find((m) => extractId(m.class || m.classId) === marksFilterClass)?.class;
  const isSectionApplicable = selectedClassObj ? selectedClassObj.allowSections !== false : true;

  const availableSections = useMemo(() => {
    if (!isSectionApplicable) return [];
    if (isTeacher) {
      const matching = teacherClassMappings.filter(
        (m) => extractId(m.class || m.classId) === marksFilterClass
      );
      const secs = matching.map((m) => m.section || m.sectionId).filter(Boolean);
      const uniqueSecs = secs.filter((s, idx, arr) => arr.findIndex((x) => extractId(x) === extractId(s)) === idx);
      if (uniqueSecs.length > 0) return uniqueSecs;
      if (matching.some((m) => !(m.sectionId || m.section)) && selectedClassObj?.sections?.length) {
        return selectedClassObj.sections;
      }
      return [];
    }
    return sectionsData.filter((s) => extractId(s.classId || s.class) === marksFilterClass);
  }, [isSectionApplicable, isTeacher, teacherClassMappings, marksFilterClass, selectedClassObj, sectionsData]);

  const teacherClassIds = useMemo(() => {
    if (!isTeacher) return null;
    return new Set(teacherClassMappings.map((m) => extractId(m.class || m.classId)).filter(Boolean));
  }, [isTeacher, teacherClassMappings]);

  const getTeacherAssignedSubjectsForClass = useCallback(
    (cId, sId) => {
      if (!isTeacher) return null;
      const matching = teacherClassMappings.filter((m) => {
        const classMatches = extractId(m.class || m.classId) === cId;
        if (!classMatches) return false;
        if (sId && sId !== "*" && (m.sectionId || m.section)) {
          return extractId(m.sectionId || m.section) === sId;
        }
        return true;
      });
      const subSet = new Set();
      matching.forEach((m) => {
        (m.subjects || []).forEach((s) => subSet.add(extractId(s?._id || s?.id || s)));
        (m.subjectIds || []).forEach((id) => subSet.add(extractId(id)));
        if (m.subject || m.subjectId) subSet.add(extractId(m.subject?._id || m.subject?.id || m.subjectId || m.subject));
      });
      return subSet;
    },
    [isTeacher, teacherClassMappings]
  );

  const availableExams = useMemo(() => {
    return marksSessionFilteredExams.filter((exam) => {
      const examClassId = extractId(exam.classId || exam.class);
      const examProgId = extractId(exam.programId || exam.program);

      if (isTeacher && teacherClassIds) {
        if (!teacherClassIds.has(examClassId)) return false;
        const assignedSubSet = getTeacherAssignedSubjectsForClass(examClassId);
        if (assignedSubSet && assignedSubSet.size > 0) {
          const schedules = exam.schedule || exam.schedules || [];
          if (schedules.length > 0) {
            const hasAssignedSubject = schedules.some((s) => {
              const sSubId = extractId(s.subjectId || s.subject || s.id || s._id);
              return (
                assignedSubSet.has(sSubId) ||
                subjects.some(
                  (sub) =>
                    assignedSubSet.has(extractId(sub.id || sub._id)) &&
                    (sub.name === s.name || sub.name === s.subjectName)
                )
              );
            });
            if (!hasAssignedSubject) return false;
          }
        }
      }

      if (marksFilterClass && marksFilterClass !== "*") {
        if (examClassId !== marksFilterClass) return false;
      }
      if (marksFilterProgram && marksFilterProgram !== "*") {
        if (examProgId !== marksFilterProgram) return false;
      }
      return true;
    });
  }, [
    marksSessionFilteredExams,
    isTeacher,
    teacherClassIds,
    getTeacherAssignedSubjectsForClass,
    subjects,
    marksFilterClass,
    marksFilterProgram,
  ]);

  const hasActiveMarksFilter = Boolean(
    (marksFilterExam && marksFilterExam !== "*") ||
    (marksFilterClass && marksFilterClass !== "*") ||
    (marksFilterProgram && marksFilterProgram !== "*")
  );

  const { data: marks = [], isLoading: isLoadingMarks } = useQuery({
    queryKey: ["marks", marksFilterExam, marksFilterSection, marksSessionFilter, marksFilterClass],
    queryFn: () =>
      getMarks(
        marksFilterExam && marksFilterExam !== "*" ? marksFilterExam : undefined,
        isSectionApplicable && marksFilterSection && marksFilterSection !== "*" ? marksFilterSection : undefined,
        marksSessionFilter || undefined,
        marksFilterClass && marksFilterClass !== "*" ? marksFilterClass : undefined
      ),
    enabled: hasActiveMarksFilter,
  });

  const filteredMarks = marks.filter((mark) => {
    if (marksFilterExam && marksFilterExam !== "*") {
      if (extractId(mark.examId || mark.exam) !== marksFilterExam) return false;
    }
    const clsId = extractId(
      mark.classId ||
      mark.student?.classId ||
      mark.student?.class?.id ||
      mark.student?.class?._id ||
      mark.student?.class ||
      mark.exam?.classId ||
      mark.exam?.class
    );
    if (marksFilterClass && marksFilterClass !== "*") {
      if (clsId && clsId !== marksFilterClass) return false;
    }
    if (isTeacher && teacherClassIds) {
      if (!teacherClassIds.has(clsId)) return false;
      const assignedSubSet = getTeacherAssignedSubjectsForClass(clsId);
      if (assignedSubSet && assignedSubSet.size > 0) {
        const markSubId = extractId(mark.subjectId || mark.subject);
        const isAssigned =
          assignedSubSet.has(markSubId) ||
          subjects.some(
            (s) =>
              assignedSubSet.has(extractId(s.id || s._id)) &&
              (s.name === mark.subject || s.name === mark.subjectName)
          );
        if (!isAssigned) return false;
      }
    }
    if (marksFilterProgram && marksFilterProgram !== "*") {
      const progId = extractId(
        mark.student?.programId ||
        mark.student?.program?.id ||
        mark.student?.program?._id ||
        mark.student?.program ||
        mark.exam?.programId ||
        mark.exam?.program
      );
      if (progId && progId !== marksFilterProgram) return false;
    }
    if (isSectionApplicable && marksFilterSection && marksFilterSection !== "*") {
      const secId = extractId(
        mark.sectionId ||
        mark.student?.sectionId ||
        mark.student?.section?.id ||
        mark.student?.section?._id ||
        mark.student?.section
      );
      if (secId && secId !== marksFilterSection) return false;
    }
    if (marksStudentSearch.trim()) {
      const mStudent = mark.student || (typeof mark.studentId === "object" ? mark.studentId : null);
      const matched = matchesSearchTokens(marksStudentSearch, [
        mStudent ? formatNormalizedFullName(mStudent.fName, mStudent.lName) : "",
        mStudent?.fatherOrguardian,
        mStudent?.rollNumber,
      ]);
      if (!matched) return false;
    }
    return true;
  });

  const selectedExamForMarks = exams.find(
    (e) => extractId(e) === (bulkExamId || marksFilterExam)
  );

  const examClassObj = classesData.find(c => extractId(c) === extractId(selectedExamForMarks?.classId || selectedExamForMarks?.class));
  const isBulkSectionApplicable = examClassObj ? examClassObj.allowSections !== false : true;

  const bulkAvailableSections = !isBulkSectionApplicable
    ? []
    : sectionsData.filter(s => extractId(s.classId || s.class) === extractId(selectedExamForMarks?.classId || selectedExamForMarks?.class));

  const { data: studentsForMarksEntry = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students", "marks-entry", extractId(selectedExamForMarks), bulkSectionId],
    queryFn: () =>
      getStudents({
        programId: extractId(selectedExamForMarks?.programId || selectedExamForMarks?.program),
        classId: extractId(selectedExamForMarks?.classId || selectedExamForMarks?.class),
        sectionId: isBulkSectionApplicable && bulkSectionId && bulkSectionId !== "*" ? bulkSectionId : undefined,
        status: "ACTIVE",
        page: 1,
        limit: 1000,
      }),
    enabled: bulkMarksDialog && !!selectedExamForMarks,
  });

  const { data: existingMarksForBulk = [], isLoading: isLoadingExistingMarks } = useQuery({
    queryKey: ["marks", "bulk-entry", bulkExamId, bulkSectionId],
    queryFn: () => getMarks(bulkExamId, isBulkSectionApplicable && bulkSectionId && bulkSectionId !== "*" ? bulkSectionId : undefined),
    enabled: bulkMarksDialog && !!bulkExamId,
  });

  useEffect(() => {
    if (bulkMarksDialog) {
      const marksData = {};
      const absenteesData = {};

      const studentsList = Array.isArray(studentsForMarksEntry)
        ? studentsForMarksEntry
        : studentsForMarksEntry?.students || [];
      const exam = exams.find((e) => extractId(e) === bulkExamId);
      const scheduleList = exam?.schedule || exam?.schedules || [];

      // 1. Initialize all active students and exam subjects with "0" as actual default
      studentsList.forEach((st) => {
        const sId = extractId(st.id || st._id || st);
        if (!sId || sId === "[object Object]") return;
        if (!marksData[sId]) marksData[sId] = {};
        if (!absenteesData[sId]) absenteesData[sId] = {};

        scheduleList.forEach((sc) => {
          const subId = extractId(sc.subjectId || sc.subject || sc.id || sc._id);
          if (subId) {
            marksData[sId][subId] = "0";
            absenteesData[sId][subId] = false;
          }
        });
      });

      // 2. Overwrite with any existing marks
      if (existingMarksForBulk.length > 0) {
        existingMarksForBulk.forEach((mark) => {
          const sId = extractId(mark.studentId || mark.student);
          if (!sId || sId === "[object Object]") return;

          let subId = extractId(mark.subjectId);
          if (!subId && mark.subject) {
            const matchedSub = subjects.find(
              (s) => s.name && s.name.toLowerCase() === mark.subject.toLowerCase()
            );
            if (matchedSub) subId = extractId(matchedSub.id || matchedSub._id);
          }
          const key = subId || mark.subject;
          if (!key) return;

          if (!marksData[sId]) marksData[sId] = {};
          if (!absenteesData[sId]) absenteesData[sId] = {};

          marksData[sId][key] = mark.obtainedMarks !== undefined && mark.obtainedMarks !== null ? mark.obtainedMarks.toString() : "0";
          absenteesData[sId][key] = !!mark.isAbsent;
        });
      }

      setBulkMarksData((prev) => {
        const updated = { ...marksData };
        Object.entries(prev || {}).forEach(([stId, subMap]) => {
          if (!updated[stId]) updated[stId] = {};
          Object.entries(subMap || {}).forEach(([subId, val]) => {
            if (val !== undefined && val !== "") {
              updated[stId][subId] = val;
            }
          });
        });
        return updated;
      });

      setBulkAbsentees((prev) => {
        const updated = { ...absenteesData };
        Object.entries(prev || {}).forEach(([stId, subMap]) => {
          if (!updated[stId]) updated[stId] = {};
          Object.entries(subMap || {}).forEach(([subId, val]) => {
            if (val !== undefined) {
              updated[stId][subId] = val;
            }
          });
        });
        return updated;
      });
    }
  }, [existingMarksForBulk, studentsForMarksEntry, bulkMarksDialog, bulkExamId, exams, subjects]);

  const bulkMarksMutation = useMutation({
    mutationFn: bulkCreateMarks,
    onSuccess: () => {
      queryClient.invalidateQueries(["marks"]);
      queryClient.invalidateQueries(["results"]);
      queryClient.invalidateQueries(["positions"]);
      toast({ title: "Marks updated successfully" });
      setBulkMarksDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error saving marks",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMarksMutation = useMutation({
    mutationFn: delMarks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marks"] });
      toast({ title: "Marks deleted successfully" });
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to delete marks", variant: "destructive" }),
  });

  const getFullName = (student) => {
    if (!student) return "";
    return formatNormalizedFullName(student.fName, student.lName);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center justify-between mb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Marks Entry
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowMarksFilters((s) => !s)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showMarksFilters ? "Hide Filters" : "Filters"}
          </Button>
        </div>
        <div
          className={`transition-all duration-300 ease-out overflow-hidden ${
            showMarksFilters
              ? "max-h-[520px] opacity-100"
              : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex-1">
              <Label>Session Filter</Label>
              <Select
                value={marksSessionFilter || "__all__"}
                onValueChange={(v) => setMarksSessionFilter(v === "__all__" ? "" : v)}
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
                value={marksFilterProgram}
                onValueChange={setMarksFilterProgram}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Programs</SelectItem>
                  {availablePrograms?.map((program) => (
                    <SelectItem key={extractId(program)} value={extractId(program)}>
                      {program.name}{" "}
                      {program.department?.name ? `— ${program.department.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Class</Label>
              <Select
                value={marksFilterClass}
                onValueChange={setMarksFilterClass}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Classes</SelectItem>
                  {availableClasses.map((cls) => (
                    <SelectItem key={extractId(cls)} value={extractId(cls)}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Section</Label>
              <Select
                value={!isSectionApplicable ? "" : marksFilterSection}
                onValueChange={setMarksFilterSection}
                disabled={!isSectionApplicable || !marksFilterClass || marksFilterClass === "*"}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !isSectionApplicable
                        ? "Not Applicable"
                        : marksFilterClass && marksFilterClass !== "*"
                        ? "All Sections"
                        : "Select class first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {!isSectionApplicable ? (
                    <SelectItem value="">Not Applicable</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="*">All Sections</SelectItem>
                      {availableSections.map((section) => (
                        <SelectItem key={extractId(section)} value={extractId(section)}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Exam</Label>
              <Select
                value={marksFilterExam}
                onValueChange={setMarksFilterExam}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Exams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Exams</SelectItem>
                  {availableExams.map((exam) => (
                    <SelectItem key={extractId(exam)} value={extractId(exam)}>
                      {exam.examName} - {exam.session} ({formatDateDisplay(exam.startDate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3 mt-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search student by name, father name, or roll no..."
              value={marksStudentSearch}
              onChange={(e) => setMarksStudentSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {canEnterMarks && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setBulkExamId(marksFilterExam !== "*" ? marksFilterExam : "");
                  setBulkSectionId(isSectionApplicable && marksFilterSection !== "*" ? marksFilterSection : (isSectionApplicable ? "*" : ""));
                  setBulkMarksData({});
                  setBulkAbsentees({});
                  setBulkMarksEditMode(false);
                  setBulkMarksDialog(true);
                }}
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Bulk Marks Entry
              </Button>
            )}
          </div>
        </div>

        <Dialog
          open={bulkMarksDialog}
          onOpenChange={(open) => {
            if (!bulkMarksMutation.isPending) {
              setBulkMarksDialog(open);
            }
          }}
        >
          <DialogContent
            className="max-w-7xl h-[100dvh] sm:h-[95vh] flex flex-col p-0"
            onPointerDownOutside={(e) => {
              if (bulkMarksMutation.isPending) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (bulkMarksMutation.isPending) e.preventDefault();
            }}
          >
            <DialogHeader className="p-3 sm:p-6 border-b shrink-0">
              <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                Bulk Marks Entry
              </DialogTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Select exam and class/section to enter marks for all students at once.
              </p>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {!bulkMarksEditMode && (
                <div className="p-3 sm:p-6 bg-muted/30 border-y grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 shrink-0">
                    <div className="space-y-2">
                      <Label>Select Exam</Label>
                      <Select
                        value={bulkExamId}
                        onValueChange={(v) => {
                          setBulkExamId(v);
                          setBulkSectionId("*");
                          setBulkMarksData({});
                          setBulkAbsentees({});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select examination" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableExams?.map((exam) => (
                            <SelectItem key={extractId(exam)} value={extractId(exam)}>
                              {exam.examName} - {exam.session} ({exam.program?.name || exam.programId?.name}
                              {(exam.program?.department?.name || exam.programId?.department?.name)
                                ? ` — ${exam.program?.department?.name || exam.programId?.department?.name}`
                                : ""}{" "}
                              - {exam.class?.name || exam.classId?.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Session</Label>
                      <span className="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
                        {exams.find((e) => extractId(e) === bulkExamId)?.session || "—"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <Label>Select Section</Label>
                      <Select
                        value={!isBulkSectionApplicable ? "" : bulkSectionId}
                        onValueChange={(v) => {
                          setBulkSectionId(v);
                          setBulkMarksData({});
                          setBulkAbsentees({});
                        }}
                        disabled={!isBulkSectionApplicable}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={!isBulkSectionApplicable ? "Not Applicable" : "Select section (optional)"} />
                        </SelectTrigger>
                        <SelectContent>
                          {!isBulkSectionApplicable ? (
                            <SelectItem value="">Not Applicable</SelectItem>
                          ) : (
                            <>
                              <SelectItem value="*">All Sections</SelectItem>
                              {bulkAvailableSections.map((s) => (
                                <SelectItem key={extractId(s)} value={extractId(s)}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {bulkMarksEditMode && (
                  <div className="px-6 py-3 bg-muted/30 border-b flex items-center gap-3 text-sm">
                    <span className="font-medium">
                      {exams.find((e) => e.id.toString() === bulkExamId)?.examName}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {exams.find((e) => e.id.toString() === bulkExamId)?.session}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-auto p-0 flex flex-col">
                  {isLoadingStudents || isLoadingExistingMarks ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2 py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        <p className="text-sm text-muted-foreground">
                          Fetching student list and marks...
                        </p>
                      </div>
                    </div>
                  ) : bulkExamId ? (
                    (() => {
                      const exam = exams.find((e) => extractId(e) === bulkExamId);
                      if (!exam) return null;

                      const studentsList = Array.isArray(studentsForMarksEntry)
                        ? studentsForMarksEntry
                        : studentsForMarksEntry?.students || [];
                      const sectionStudents = studentsList
                        .filter(isStudentActive)
                        .sort((a, b) => (a.rollNumber || "").localeCompare(b.rollNumber || ""));

                      const scheduleList = exam.schedule || exam.schedules || [];
                      let examSubjects = scheduleList
                        .filter((s) => s && (s.included === undefined || s.included === true))
                        .map((s) => {
                          const subId = extractId(s.subjectId || s.subject || s.id || s._id);
                          const sub =
                            subjects.find((sub) => extractId(sub.id || sub._id) === subId) ||
                            (typeof s.subjectId === "object" ? s.subjectId : null);
                          const resolvedName =
                            (sub?.name && !sub.name.startsWith("Subject #") ? sub.name : null) ||
                            (s.name && !s.name.startsWith("Subject #") ? s.name : null) ||
                            (s.subjectName && !s.subjectName.startsWith("Subject #") ? s.subjectName : null) ||
                            (sub?.subjectName && !sub.subjectName.startsWith("Subject #") ? sub.subjectName : null) ||
                            (sub?.title || "Subject");
                          return {
                            ...s,
                            id: subId,
                            subjectId: subId,
                            name: resolvedName,
                            totalMarks: s.totalMarks || 100,
                          };
                        });

                      if (examSubjects.length === 0 && subjects.length > 0) {
                        examSubjects = subjects.map((sub) => {
                          const subId = extractId(sub.id || sub._id);
                          return {
                            id: subId,
                            subjectId: subId,
                            name: sub.name || "Subject",
                            totalMarks: 100,
                          };
                        });
                      }

                      if (isTeacher) {
                        const assignedSubSet = getTeacherAssignedSubjectsForClass(
                          extractId(exam.classId || exam.class),
                          bulkSectionId
                        );
                        if (assignedSubSet && assignedSubSet.size > 0) {
                          examSubjects = examSubjects.filter((s) => {
                            return (
                              assignedSubSet.has(s.id) ||
                              subjects.some(
                                (sub) =>
                                  assignedSubSet.has(extractId(sub.id || sub._id)) &&
                                  (sub.name === s.name || sub.name === s.subjectName)
                              )
                            );
                          });
                        }
                      }

                      if (sectionStudents.length === 0) {
                        return (
                          <div className="p-12 text-center text-muted-foreground">
                            No students found for this class/section.
                          </div>
                        );
                      }

                      if (examSubjects.length === 0) {
                        return (
                          <div className="p-12 text-center text-muted-foreground">
                            No subjects defined in this exam's schedule.
                          </div>
                        );
                      }

                      return (
                        <Table className="border-collapse">
                          <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-sm px-3 py-2 w-[200px] border-r">
                                Student Name (Roll No)
                              </TableHead>
                              {examSubjects.map((s) => (
                                <TableHead
                                  key={s.id}
                                  className="text-center min-w-[120px] border-r bg-muted/5"
                                >
                                  <div className="font-bold text-orange-700">{s.name}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Total: {s.totalMarks || 100}
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sectionStudents.map((student) => {
                              const sId = extractId(student);
                              return (
                                <TableRow
                                  key={sId}
                                  className="hover:bg-orange-50/30 transition-colors"
                                >
                                  <TableCell className="text-sm px-3 py-2 font-medium border-r sticky left-0 bg-white z-[5]">
                                    <div className="text-sm">{getFullName(student)}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      {student.rollNumber}
                                    </div>
                                  </TableCell>
                                  {examSubjects.map((s) => {
                                    const subjectKey = `${sId}-${s.id}`;
                                    const enteredVal = bulkMarksData[sId]?.[s.id];
                                    const isAbsent =
                                      bulkAbsentees[sId]?.[s.id] ?? false;

                                    let marksValue = enteredVal;
                                    if (marksValue === undefined) {
                                      const existingMark = marks.find(
                                        (m) =>
                                          extractId(m.studentId || m.student) === sId &&
                                          extractId(m.examId || m.exam) === extractId(exam) &&
                                          (extractId(m.subjectId) === s.id || m.subject === s.name)
                                      );
                                      if (existingMark && existingMark.obtainedMarks !== undefined && existingMark.obtainedMarks !== null) {
                                        marksValue = existingMark.obtainedMarks.toString();
                                      } else {
                                        marksValue = "0";
                                      }
                                    }

                                    return (
                                      <TableCell
                                        key={s.id}
                                        className={`p-2 border-r text-center ${
                                          isAbsent ? "bg-red-50/50" : ""
                                        }`}
                                      >
                                        <div className="flex flex-col gap-2 items-center">
                                          <Input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            className={`h-8 w-20 text-center no-spinners font-medium ${
                                              isAbsent ? "opacity-30" : ""
                                            }`}
                                            value={marksValue ?? "0"}
                                            disabled={isAbsent}
                                            onFocus={(e) => {
                                              e.target.select();
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                                e.preventDefault();
                                              }
                                              if (["+", "-", "e", "E", ".", ","].includes(e.key)) {
                                                e.preventDefault();
                                              }
                                            }}
                                            onChange={(e) => {
                                              const maxMarks = Number(s.totalMarks) || 100;
                                              let val = e.target.value.replace(/\D/g, "");

                                              if (val !== "") {
                                                let num = parseInt(val, 10);
                                                if (isNaN(num) || num < 0) num = 0;
                                                if (num > maxMarks) num = maxMarks;
                                                val = num.toString();
                                              }

                                              setBulkMarksData((prev) => ({
                                                ...prev,
                                                [sId]: {
                                                  ...(prev[sId] || {}),
                                                  [s.id]: val,
                                                },
                                              }));
                                            }}
                                            onBlur={(e) => {
                                              const maxMarks = Number(s.totalMarks) || 100;
                                              let val = e.target.value.trim().replace(/\D/g, "");
                                              if (val === "" || isNaN(Number(val))) {
                                                val = "0";
                                              } else {
                                                let num = parseInt(val, 10);
                                                if (num < 0) num = 0;
                                                if (num > maxMarks) num = maxMarks;
                                                val = num.toString();
                                              }
                                              setBulkMarksData((prev) => ({
                                                ...prev,
                                                [sId]: {
                                                  ...(prev[sId] || {}),
                                                  [s.id]: val,
                                                },
                                              }));
                                            }}
                                          />
                                          <div className="flex items-center gap-1">
                                            <Checkbox
                                              id={`absent-${subjectKey}`}
                                              checked={isAbsent}
                                              className="h-3 w-3"
                                              onCheckedChange={(checked) => {
                                                setBulkAbsentees((prev) => ({
                                                  ...prev,
                                                  [sId]: {
                                                    ...(prev[sId] || {}),
                                                    [s.id]: !!checked,
                                                  },
                                                }));
                                                if (checked) {
                                                  setBulkMarksData((prev) => ({
                                                    ...prev,
                                                    [sId]: {
                                                      ...(prev[sId] || {}),
                                                      [s.id]: "0",
                                                    },
                                                  }));
                                                }
                                              }}
                                            />
                                            <label
                                              htmlFor={`absent-${subjectKey}`}
                                              className="text-[10px] text-muted-foreground cursor-pointer uppercase font-bold"
                                            >
                                              Abs
                                            </label>
                                          </div>
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      );
                    })()
                  ) : (
                    <div className="p-20 text-center text-muted-foreground flex flex-col items-center gap-4">
                      <LayoutGrid className="w-12 h-12 opacity-10" />
                      <p>Select an exam to load the marks entry grid.</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-background/95 backdrop-blur-xs sticky bottom-0 z-30 flex flex-row items-center justify-end gap-2 shrink-0">
                <Button
                  variant="outline"
                  disabled={bulkMarksMutation.isPending}
                  onClick={() => setBulkMarksDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!bulkExamId || bulkMarksMutation.isPending}
                  onClick={() => {
                    const exam = exams.find((e) => extractId(e) === bulkExamId);
                    const scheduleList = exam?.schedule || exam?.schedules || [];
                    const examSubjects = scheduleList.map((s) => {
                      const subId = extractId(s.subjectId || s.subject || s.id || s._id);
                      const sub =
                        subjects.find((sub) => extractId(sub.id || sub._id) === subId) ||
                        (typeof s.subjectId === "object" ? s.subjectId : null);
                      const resolvedName =
                        (sub?.name && !sub.name.startsWith("Subject #") ? sub.name : null) ||
                        (s.name && !s.name.startsWith("Subject #") ? s.name : null) ||
                        (s.subjectName && !s.subjectName.startsWith("Subject #") ? s.subjectName : null) ||
                        (sub?.subjectName && !sub.subjectName.startsWith("Subject #") ? sub.subjectName : null) ||
                        "Subject";
                      return {
                        id: subId,
                        subjectId: subId,
                        name: resolvedName,
                        totalMarks: s.totalMarks || 100,
                      };
                    });

                    let filteredExamSubjects = examSubjects;
                    if (isTeacher) {
                      const assignedSubSet = getTeacherAssignedSubjectsForClass(
                        extractId(exam?.classId || exam?.class),
                        bulkSectionId
                      );
                      if (assignedSubSet && assignedSubSet.size > 0) {
                        filteredExamSubjects = examSubjects.filter((s) => {
                          return (
                            assignedSubSet.has(s.id) ||
                            subjects.some(
                              (sub) =>
                                assignedSubSet.has(extractId(sub.id || sub._id)) &&
                                (sub.name === s.name || sub.name === s.subjectName)
                            )
                          );
                        });
                      }
                    }

                    const studentsList = Array.isArray(studentsForMarksEntry)
                      ? studentsForMarksEntry
                      : studentsForMarksEntry?.students || [];
                    const sectionStudents = studentsList
                      .filter(isStudentActive)
                      .sort((a, b) => (a.rollNumber || "").localeCompare(b.rollNumber || ""));
                    const activeStudentIds = new Set(
                      sectionStudents.map((s) => extractId(s.id || s._id || s))
                    );

                    const payload = [];
                    const processedPairs = new Set();

                    // Process all students and subjects in the active grid
                    sectionStudents.forEach((student) => {
                      const studentId = extractId(student.id || student._id || student);
                      if (!studentId || studentId === "[object Object]") return;

                      filteredExamSubjects.forEach((subj) => {
                        const cleanSubId = extractId(subj.subjectId || subj.id);
                        if (!cleanSubId) return;

                        const pairKey = `${studentId}-${cleanSubId}`;
                        if (processedPairs.has(pairKey)) return;
                        processedPairs.add(pairKey);

                        const isAbs = !!(
                          bulkAbsentees[studentId]?.[cleanSubId] ||
                          bulkAbsentees[studentId]?.[subj.name] ||
                          bulkAbsentees[studentId]?.[subj.id]
                        );

                        const enteredVal =
                          bulkMarksData[studentId]?.[cleanSubId] ??
                          bulkMarksData[studentId]?.[subj.name] ??
                          bulkMarksData[studentId]?.[subj.id];

                        let finalMarks = enteredVal;
                        if (finalMarks === undefined || finalMarks === "") {
                          const existingMark = marks.find(
                            (m) =>
                              extractId(m.studentId || m.student) === studentId &&
                              extractId(m.examId || m.exam) === extractId(exam) &&
                              (extractId(m.subjectId) === cleanSubId || m.subject === subj.name)
                          );
                          if (existingMark && existingMark.obtainedMarks !== undefined && existingMark.obtainedMarks !== null) {
                            finalMarks = existingMark.obtainedMarks;
                          } else {
                            finalMarks = 0;
                          }
                        }

                        const obtainedMarks = isAbs ? 0 : (Number(finalMarks) || 0);

                        payload.push({
                          examId: extractId(bulkExamId),
                          studentId: studentId,
                          subjectId: cleanSubId,
                          subject: subj.name,
                          classId: extractId(exam?.classId || exam?.class),
                          sectionId: isBulkSectionApplicable && bulkSectionId && bulkSectionId !== "*" ? extractId(bulkSectionId) : null,
                          totalMarks: Number(subj.totalMarks) || 100,
                          obtainedMarks,
                          isAbsent: isAbs,
                        });
                      });
                    });

                    // Include any other student marks stored in bulkMarksData
                    Object.entries(bulkMarksData).forEach(([rawStudentId, subjectMarks]) => {
                      const studentId = extractId(rawStudentId);
                      if (!studentId || studentId === "[object Object]" || !activeStudentIds.has(studentId)) return;

                      Object.entries(subjectMarks || {}).forEach(([subjId, mVal]) => {
                        const subj = filteredExamSubjects.find((es) => es.id === subjId || es.name === subjId);
                        if (!subj) return;

                        const cleanSubId = extractId(subj.subjectId || subj.id);
                        const pairKey = `${studentId}-${cleanSubId}`;
                        if (processedPairs.has(pairKey)) return;
                        processedPairs.add(pairKey);

                        const isAbs = !!(bulkAbsentees[rawStudentId]?.[subjId] || bulkAbsentees[studentId]?.[subjId]);
                        const finalVal = mVal !== undefined && mVal !== "" ? mVal : "0";
                        const obtainedMarks = isAbs ? 0 : (Number(finalVal) || 0);

                        payload.push({
                          examId: extractId(bulkExamId),
                          studentId: studentId,
                          subjectId: cleanSubId,
                          subject: subj.name,
                          classId: extractId(exam?.classId || exam?.class),
                          sectionId: isBulkSectionApplicable && bulkSectionId && bulkSectionId !== "*" ? extractId(bulkSectionId) : null,
                          totalMarks: Number(subj.totalMarks) || 100,
                          obtainedMarks,
                          isAbsent: isAbs,
                        });
                      });
                    });

                    // Include any other absentees
                    Object.entries(bulkAbsentees).forEach(([rawStudentId, subjectAbs]) => {
                      const studentId = extractId(rawStudentId);
                      if (!studentId || studentId === "[object Object]" || !activeStudentIds.has(studentId)) return;

                      Object.entries(subjectAbs || {}).forEach(([subjId, isAbsent]) => {
                        if (!isAbsent) return;
                        const subj = filteredExamSubjects.find((es) => es.id === subjId || es.name === subjId);
                        if (!subj) return;

                        const cleanSubId = extractId(subj.subjectId || subj.id);
                        const pairKey = `${studentId}-${cleanSubId}`;
                        if (processedPairs.has(pairKey)) return;
                        processedPairs.add(pairKey);

                        payload.push({
                          examId: extractId(bulkExamId),
                          studentId: studentId,
                          subjectId: cleanSubId,
                          subject: subj.name,
                          classId: extractId(exam?.classId || exam?.class),
                          sectionId: isBulkSectionApplicable && bulkSectionId && bulkSectionId !== "*" ? extractId(bulkSectionId) : null,
                          totalMarks: Number(subj.totalMarks) || 100,
                          obtainedMarks: 0,
                          isAbsent: true,
                        });
                      });
                    });

                    if (payload.length === 0) {
                      toast({ title: "No marks entered", variant: "destructive" });
                      return;
                    }

                    bulkMarksMutation.mutate({ records: payload });
                  }}
                >
                  {bulkMarksMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving Marks...
                    </>
                  ) : (
                    "Save All Marks"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

      <CardContent>
        {!hasActiveMarksFilter ? (
          <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-2">
            <SlidersHorizontal className="w-10 h-10 opacity-30 text-orange-600" />
            <p className="text-base font-medium">Select filters to view marks</p>
            <p className="text-sm">Please select a program, class, or exam above to display student marks.</p>
          </div>
        ) : isLoadingMarks ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            <p className="text-sm">Loading examination marks...</p>
          </div>
        ) : filteredMarks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-2">
            <FileText className="w-10 h-10 opacity-20" />
            <p className="text-base font-medium">No marks found</p>
            <p className="text-sm">Adjust your filters above or use Bulk Marks Entry to enter marks.</p>
          </div>
        ) : (
          (() => {
            const grouped = filteredMarks.reduce((acc, mark) => {
              const examId = extractId(mark.examId || mark.exam);
              const studentId = extractId(mark.studentId || mark.student);
              const key = `${examId}-${studentId}`;
              if (!acc[key]) {
                acc[key] = { examId, student: mark.student || mark.studentId, marks: [] };
              }
              acc[key].marks.push(mark);
              return acc;
            }, {});

            return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 px-3 text-sm">Exam</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Student</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Subjects</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Total</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Obtained</TableHead>
                    <TableHead className="py-2 px-3 text-sm">%</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(grouped).map((group) => {
                    const exam = exams.find((e) => extractId(e) === extractId(group.examId));
                    const totalMarks = group.marks.reduce((s, m) => s + (m.totalMarks || 0), 0);
                    const obtainedMarks = group.marks.reduce(
                      (s, m) => s + (m.isAbsent ? 0 : m.obtainedMarks || 0),
                      0
                    );
                    const percentage =
                      totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(1) : "0.0";
                    const subjectSummary = group.marks
                      .map((m) => {
                        const subId = extractId(m.subjectId || m.subject);
                        const subObj = subjects.find((s) => extractId(s.id || s._id) === subId);
                        const sName =
                          (m.subject && !m.subject.startsWith("Subject #") && !/^[0-9a-fA-F]{24}$/.test(m.subject))
                            ? m.subject
                            : (subObj?.name || "Subject");
                        return m.isAbsent ? `${sName}(Abs)` : sName;
                      })
                      .join(", ");
                    const key = `${extractId(group.examId)}-${extractId(group.student?.id || group.student?._id)}`;

                    return (
                      <TableRow key={key}>
                        <TableCell className="text-sm px-3 py-2 font-medium">
                          {exam?.examName || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          {group.student
                            ? `${getFullName(group.student)} (${group.student.rollNumber})`
                            : "Unknown"}
                        </TableCell>
                        <TableCell
                          className="px-3 py-2 text-sm text-muted-foreground max-w-[200px] truncate"
                          title={subjectSummary}
                        >
                          {subjectSummary}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">{totalMarks}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">{obtainedMarks}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">{percentage}%</TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          <div className="flex gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setViewMarksDetail({
                                      examId: group.examId,
                                      student: group.student,
                                      marks: group.marks,
                                    })
                                  }
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                            {canEditMarks && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setBulkExamId(extractId(group.examId));
                                      setBulkSectionId(group.student?.sectionId ? extractId(group.student.sectionId) : "*");
                                      setBulkMarksData({});
                                      setBulkAbsentees({});
                                      setBulkMarksEditMode(true);
                                      setBulkMarksDialog(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Marks</TooltipContent>
                              </Tooltip>
                            )}
                            {canDeleteMarks && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      group.marks.forEach((m) => deleteMarksMutation.mutate(extractId(m.id || m._id)));
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete All Marks</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            );
          })()
        )}
      </CardContent>

      {/* View Marks Detail Dialog */}
      <Dialog
        open={!!viewMarksDetail}
        onOpenChange={(open) => {
          if (!open) setViewMarksDetail(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Marks Detail
            </DialogTitle>
          </DialogHeader>
          {viewMarksDetail &&
            (() => {
              const exam = exams.find((e) => e.id === viewMarksDetail.examId);
              const student = viewMarksDetail.student;
              const totalMarks = viewMarksDetail.marks.reduce(
                (s, m) => s + (m.totalMarks || 0),
                0
              );
              const obtainedMarks = viewMarksDetail.marks.reduce(
                (s, m) => s + (m.isAbsent ? 0 : m.obtainedMarks || 0),
                0
              );
              const percentage =
                totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(2) : "0.00";
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-4">
                    <div>
                      <span className="text-muted-foreground">Exam:</span>{" "}
                      <span className="font-medium">{exam?.examName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Session:</span>{" "}
                      <span className="font-medium">{exam?.session}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Student:</span>{" "}
                      <span className="font-medium">{student ? getFullName(student) : "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Roll No:</span>{" "}
                      <span className="font-medium font-mono">{student?.rollNumber}</span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-2 px-3 text-sm">Subject</TableHead>
                        <TableHead className="text-sm px-3 py-2 text-right">Total</TableHead>
                        <TableHead className="text-sm px-3 py-2 text-right">Obtained</TableHead>
                        <TableHead className="text-sm px-3 py-2 text-right">%</TableHead>
                        <TableHead className="text-sm px-3 py-2 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewMarksDetail.marks.map((m) => {
                        const pct =
                          m.totalMarks > 0
                            ? ((m.obtainedMarks / m.totalMarks) * 100).toFixed(1)
                            : "0.0";
                        const subId = extractId(m.subjectId || m.subject);
                        const subObj = subjects.find((s) => extractId(s.id || s._id) === subId);
                        const sName =
                          (m.subject && !m.subject.startsWith("Subject #") && !/^[0-9a-fA-F]{24}$/.test(m.subject))
                            ? m.subject
                            : (subObj?.name || "Subject");
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm px-3 py-2 font-medium">
                              {sName}
                            </TableCell>
                            <TableCell className="text-sm px-3 py-2 text-right">
                              {m.totalMarks}
                            </TableCell>
                            <TableCell className="text-sm px-3 py-2 text-right">
                              {m.isAbsent ? "—" : m.obtainedMarks}
                            </TableCell>
                            <TableCell className="text-sm px-3 py-2 text-right">
                              {m.isAbsent ? "—" : `${pct}%`}
                            </TableCell>
                            <TableCell className="text-sm px-3 py-2 text-center">
                              {m.isAbsent ? (
                                <Badge variant="destructive" className="text-xs">
                                  Absent
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  Present
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center text-sm font-medium bg-muted/30 rounded-lg px-4 py-3">
                    <span>
                      Total: {obtainedMarks} / {totalMarks}
                    </span>
                    <span>Overall: {percentage}%</span>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MarksEntryTab;
