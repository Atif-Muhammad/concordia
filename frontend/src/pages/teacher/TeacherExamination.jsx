import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  GraduationCap,
  BookOpen,
  Search,
  Filter,
  Layers,
  School,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  X,
  Users
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  userWho,
  refreshTokens,
  getTeacherClasses,
  getTeacherSubjects,
  getExams,
  getMarks,
  bulkCreateMarks,
  getStudents
} from '../../../config/apis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function TeacherExamination() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  // Marks Entry Dialog State
  const [marksDialogOpen, setMarksDialogOpen] = useState(false);
  const [activeSubjectForMarks, setActiveSubjectForMarks] = useState(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [totalMarksInput, setTotalMarksInput] = useState(100);
  const [marksState, setMarksState] = useState({}); // { [studentId]: { obtainedMarks: number|string, isAbsent: boolean } }

  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const res = await userWho();
        return res;
      } catch (error) {
        if (error.response?.status === 401) {
          await refreshTokens();
          return userWho();
        }
        throw error;
      }
    },
  });

  const teacherStaffId = currentUser?.refId || currentUser?.staffDbId || currentUser?.id;

  const { data: classesData, isLoading: isClassesLoading } = useQuery({
    queryKey: ['teacherClasses', teacherStaffId],
    queryFn: () => getTeacherClasses(teacherStaffId),
    enabled: !!teacherStaffId,
  });

  const { data: subjectsData, isLoading: isSubjectsLoading } = useQuery({
    queryKey: ['teacherSubjects', teacherStaffId],
    queryFn: () => getTeacherSubjects(teacherStaffId),
    enabled: !!teacherStaffId,
  });

  const { data: examsData = [], isLoading: isExamsLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => getExams(),
  });

  const allExams = useMemo(() => {
    return Array.isArray(examsData) ? examsData : examsData?.data || [];
  }, [examsData]);

  const classesList = useMemo(() => {
    return Array.isArray(classesData) ? classesData : classesData?.data || [];
  }, [classesData]);

  const rawSubjects = useMemo(() => {
    return Array.isArray(subjectsData) ? subjectsData : subjectsData?.data || [];
  }, [subjectsData]);

  // Aggregate unified exam subjects list strictly for this teacher
  const examinationList = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. From subjectsData
    rawSubjects.forEach((subMapping) => {
      const sub = subMapping.subjectId || subMapping.subject;
      const cls = subMapping.classId || subMapping.class;
      const sec = subMapping.sectionId || subMapping.section;
      const prog = subMapping.program || cls?.programId;

      if (sub && cls) {
        const subId = (sub._id || sub.id || sub).toString();
        const clsId = (cls._id || cls.id || cls).toString();
        const secId = sec ? (sec._id || sec.id || sec).toString() : 'all';
        const key = `${clsId}__${secId}__${subId}`;

        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            id: key,
            subjectId: subId,
            subjectName: sub.name || 'Subject',
            subjectCode: sub.code || '',
            creditHours: sub.creditHours || null,
            classId: clsId,
            className: cls.name || 'Class',
            sectionId: secId,
            sectionName: sec?.name || null,
            programId: prog ? (prog._id || prog.id || prog).toString() : '',
            programName: prog?.name || cls.program || 'General Program',
          });
        }
      }
    });

    // 2. From classesList
    classesList.forEach((clsMapping) => {
      const cls = clsMapping.classId || clsMapping.class;
      const sec = clsMapping.sectionId || clsMapping.section;
      const prog = clsMapping.programId || clsMapping.program || cls?.programId;
      const subjects = clsMapping.subjects || (clsMapping.subject ? [clsMapping.subject] : []);

      if (cls && subjects.length > 0) {
        const clsId = (cls._id || cls.id || cls).toString();
        const secId = sec ? (sec._id || sec.id || sec).toString() : 'all';

        subjects.forEach((sub) => {
          const subId = (sub._id || sub.id || sub).toString();
          const key = `${clsId}__${secId}__${subId}`;

          if (!seen.has(key)) {
            seen.add(key);
            list.push({
              id: key,
              subjectId: subId,
              subjectName: sub.name || 'Subject',
              subjectCode: sub.code || '',
              creditHours: sub.creditHours || null,
              classId: clsId,
              className: cls.name || 'Class',
              sectionId: secId,
              sectionName: sec?.name || null,
              programId: prog ? (prog._id || prog.id || prog).toString() : '',
              programName: prog?.name || cls.program || 'General Program',
            });
          }
        });
      }
    });

    return list;
  }, [rawSubjects, classesList]);

  // Extract distinct programs for filter
  const programsFilterList = useMemo(() => {
    const map = new Map();
    examinationList.forEach((item) => {
      if (item.programId && !map.has(item.programId)) {
        map.set(item.programId, { id: item.programId, name: item.programName });
      }
    });
    return Array.from(map.values());
  }, [examinationList]);

  // Extract distinct classes for filter
  const classesFilterList = useMemo(() => {
    const map = new Map();
    examinationList.forEach((item) => {
      if (
        selectedProgramFilter === 'all' ||
        item.programId === selectedProgramFilter
      ) {
        if (!map.has(item.classId)) {
          map.set(item.classId, { id: item.classId, name: item.className });
        }
      }
    });
    return Array.from(map.values());
  }, [examinationList, selectedProgramFilter]);

  // Filter examination subjects
  const filteredExamSubjects = useMemo(() => {
    return examinationList.filter((item) => {
      if (
        selectedProgramFilter !== 'all' &&
        item.programId !== selectedProgramFilter
      ) {
        return false;
      }
      if (selectedClassFilter !== 'all' && item.classId !== selectedClassFilter) {
        return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.subjectName.toLowerCase().includes(term) ||
        item.subjectCode.toLowerCase().includes(term) ||
        item.className.toLowerCase().includes(term) ||
        (item.sectionName && item.sectionName.toLowerCase().includes(term)) ||
        item.programName.toLowerCase().includes(term)
      );
    });
  }, [examinationList, selectedProgramFilter, selectedClassFilter, searchTerm]);

  // Exams available for the active subject's class
  const availableExamsForSubject = useMemo(() => {
    if (!activeSubjectForMarks) return allExams;
    const targetClassId = activeSubjectForMarks.classId;
    const matching = allExams.filter((e) => {
      const eClassId = (e.classId?._id || e.classId?.id || e.classId || '').toString();
      return !eClassId || eClassId === targetClassId;
    });
    return matching.length > 0 ? matching : allExams;
  }, [activeSubjectForMarks, allExams]);

  // Auto-select first exam when opening modal
  useEffect(() => {
    if (marksDialogOpen && availableExamsForSubject.length > 0 && !selectedExamId) {
      const firstId = (availableExamsForSubject[0]._id || availableExamsForSubject[0].id).toString();
      setSelectedExamId(firstId);
    }
  }, [marksDialogOpen, availableExamsForSubject, selectedExamId]);

  // Fetch students for the active class & section
  const sectionQueryParam =
    activeSubjectForMarks && activeSubjectForMarks.sectionId !== 'all'
      ? activeSubjectForMarks.sectionId
      : '';

  const { data: studentsResponse, isLoading: isClassStudentsLoading } = useQuery({
    queryKey: [
      'examStudents',
      activeSubjectForMarks?.programId,
      activeSubjectForMarks?.classId,
      sectionQueryParam,
    ],
    queryFn: () =>
      getStudents({
        programId: activeSubjectForMarks.programId,
        classId: activeSubjectForMarks.classId,
        sectionId: sectionQueryParam || undefined,
        status: 'ACTIVE',
        page: 1,
        limit: 1000,
      }),
    enabled: !!activeSubjectForMarks && marksDialogOpen,
  });

  const studentsList = useMemo(() => {
    if (!studentsResponse) return [];
    if (Array.isArray(studentsResponse)) return studentsResponse;
    if (Array.isArray(studentsResponse?.students)) return studentsResponse.students;
    if (Array.isArray(studentsResponse?.data)) return studentsResponse.data;
    return [];
  }, [studentsResponse]);

  // Fetch existing marks for this exam and section
  const { data: existingMarksData = [], isLoading: isExistingMarksLoading } = useQuery({
    queryKey: ['existingMarks', selectedExamId, sectionQueryParam],
    queryFn: () => getMarks(selectedExamId, sectionQueryParam || undefined),
    enabled: !!selectedExamId && marksDialogOpen,
  });

  // When exam selection changes in the modal, re-populate total marks from exam schedule if available
  useEffect(() => {
    if (!selectedExamId || !activeSubjectForMarks) return;
    const exam = allExams.find((e) => (e._id || e.id)?.toString() === selectedExamId);
    if (exam?.schedule && Array.isArray(exam.schedule)) {
      const currentSubId = activeSubjectForMarks.subjectId;
      const curSubName = (activeSubjectForMarks.subjectName || '').trim().toLowerCase();
      const sched = exam.schedule.find((s) => {
        const sSubId = (s.subjectId?._id || s.subjectId?.id || s.subjectId || s.subject)?.toString();
        const sSubName = (s.subject?.name || (typeof s.subject === 'string' ? s.subject : '') || '').trim().toLowerCase();
        return sSubId === currentSubId || (curSubName && sSubName && curSubName === sSubName);
      });
      if (sched?.totalMarks) {
        setTotalMarksInput(Number(sched.totalMarks) || 100);
      }
    }
  }, [selectedExamId, activeSubjectForMarks, allExams]);

  // Pre-fill marks state when students or existing marks load
  useEffect(() => {
    if (!marksDialogOpen || !activeSubjectForMarks || studentsList.length === 0) return;

    const rawMarks = Array.isArray(existingMarksData)
      ? existingMarksData
      : existingMarksData?.data || [];

    const currentSubId = activeSubjectForMarks.subjectId;
    const curSubName = (activeSubjectForMarks.subjectName || '').trim().toLowerCase();
    const initial = {};
    let foundTotalMarks = null;

    studentsList.forEach((student) => {
      const sId = (student._id || student.id).toString();
      const sRoll = (student.rollNumber || student.rollNo || '').trim().toLowerCase();

      const existing = rawMarks.find((m) => {
        const mStudentId = (
          m.studentId?._id ||
          m.studentId?.id ||
          m.studentId ||
          m.student?._id ||
          m.student?.id ||
          m.student
        )?.toString();
        const mStudentRoll = (m.studentId?.rollNumber || m.student?.rollNumber || '').trim().toLowerCase();

        const isStudentMatch = mStudentId === sId || (sRoll && mStudentRoll && mStudentRoll === sRoll);
        if (!isStudentMatch) return false;

        const mSubId = (
          m.subjectId?._id ||
          m.subjectId?.id ||
          m.subjectId ||
          m.subject?._id ||
          m.subject
        )?.toString();
        const mSubName = (
          m.subject?.name ||
          (typeof m.subject === 'string' ? m.subject : '') ||
          m.subjectId?.name ||
          ''
        ).trim().toLowerCase();

        const isSubjectMatch = mSubId === currentSubId || (curSubName && mSubName && curSubName === mSubName);
        return isSubjectMatch;
      });

      if (existing) {
        initial[sId] = {
          obtainedMarks: existing.isAbsent ? 0 : (existing.obtainedMarks !== undefined && existing.obtainedMarks !== null ? existing.obtainedMarks : ''),
          isAbsent: !!existing.isAbsent,
        };
        if (existing.totalMarks && !foundTotalMarks) {
          foundTotalMarks = existing.totalMarks;
        }
      } else {
        initial[sId] = {
          obtainedMarks: '',
          isAbsent: false,
        };
      }
    });

    setMarksState(initial);
    if (foundTotalMarks) {
      setTotalMarksInput(foundTotalMarks);
    }
  }, [marksDialogOpen, activeSubjectForMarks, studentsList, existingMarksData, selectedExamId]);

  // Handle open marks dialog
  const handleOpenMarksDialog = (subjectItem) => {
    setActiveSubjectForMarks(subjectItem);
    setSelectedExamId('');
    setTotalMarksInput(100);
    setMarksState({});
    setMarksDialogOpen(true);
  };

  // Mutation to save marks in bulk
  const saveMarksMutation = useMutation({
    mutationFn: (payload) => bulkCreateMarks(payload),
    onSuccess: () => {
      toast({
        title: 'Marks Saved Successfully',
        description: `Examination marks for ${activeSubjectForMarks?.subjectName} have been recorded.`,
      });
      queryClient.invalidateQueries({ queryKey: ['existingMarks'] });
      queryClient.invalidateQueries({ queryKey: ['marks'] });
      setMarksDialogOpen(false);
    },
    onError: (err) => {
      toast({
        title: 'Error Saving Marks',
        description: err?.message || 'Failed to save examination marks. Please check input values.',
        variant: 'destructive',
      });
    },
  });

  const handleMarksSubmit = () => {
    if (!selectedExamId) {
      toast({
        title: 'Validation Error',
        description: 'Please select an examination first.',
        variant: 'destructive',
      });
      return;
    }

    const totalNum = Number(totalMarksInput) || 100;
    const records = [];

    for (const student of studentsList) {
      const sId = (student._id || student.id).toString();
      const sState = marksState[sId] || { obtainedMarks: '', isAbsent: false };

      if (sState.isAbsent) {
        records.push({
          studentId: sId,
          examId: selectedExamId,
          subjectId: activeSubjectForMarks.subjectId,
          subject: activeSubjectForMarks.subjectName,
          classId: activeSubjectForMarks.classId,
          sectionId: activeSubjectForMarks.sectionId !== 'all' ? activeSubjectForMarks.sectionId : undefined,
          obtainedMarks: 0,
          totalMarks: totalNum,
          isAbsent: true,
        });
      } else if (sState.obtainedMarks !== '' && sState.obtainedMarks !== null) {
        const obtainedNum = Number(sState.obtainedMarks);
        if (obtainedNum < 0 || obtainedNum > totalNum) {
          toast({
            title: 'Invalid Marks Entered',
            description: `Obtained marks for student ${student.rollNumber || ''} must be between 0 and ${totalNum}.`,
            variant: 'destructive',
          });
          return;
        }

        records.push({
          studentId: sId,
          examId: selectedExamId,
          subjectId: activeSubjectForMarks.subjectId,
          subject: activeSubjectForMarks.subjectName,
          classId: activeSubjectForMarks.classId,
          sectionId: activeSubjectForMarks.sectionId !== 'all' ? activeSubjectForMarks.sectionId : undefined,
          obtainedMarks: obtainedNum,
          totalMarks: totalNum,
          isAbsent: false,
        });
      }
    }

    if (records.length === 0) {
      toast({
        title: 'No Marks Entered',
        description: 'Please enter obtained marks or mark students absent before saving.',
        variant: 'destructive',
      });
      return;
    }

    saveMarksMutation.mutate(records);
  };

  if (isUserLoading || isClassesLoading || isSubjectsLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-4 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-primary" />
              Examinations & Marks Entry
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enter and manage student exam marks strictly for your assigned subjects
            </p>
          </div>
        </div>

        {/* Notice Banner */}
        <Alert className="border-primary/20 bg-primary/5 text-foreground">
          <GraduationCap className="h-4 w-4 text-primary" />
          <AlertTitle className="text-sm font-semibold text-primary">Teacher Subject Grading Portal</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            You are authorized to enter exam marks for your assigned subjects only. Click &quot;Enter Marks&quot; on any subject row below to open the marks entry sheet.
          </AlertDescription>
        </Alert>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Programs</p>
                <p className="text-2xl font-bold text-foreground mt-1">{programsFilterList.length}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Classes</p>
                <p className="text-2xl font-bold text-foreground mt-1">{classesFilterList.length}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <School className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">My Assigned Subjects</p>
                <p className="text-2xl font-bold text-foreground mt-1">{examinationList.length}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls */}
        <Card className="border shadow-2xs">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search your subjects, classes, or codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm h-9"
                />
              </div>

              {/* Program Filter */}
              {programsFilterList.length > 0 && (
                <div className="w-full sm:w-[200px]">
                  <Select
                    value={selectedProgramFilter}
                    onValueChange={(val) => {
                      setSelectedProgramFilter(val);
                      setSelectedClassFilter('all');
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <div className="flex items-center gap-2 truncate">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <SelectValue placeholder="All Programs" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {programsFilterList.map((prog) => (
                        <SelectItem key={prog.id} value={prog.id}>
                          {prog.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Class Filter */}
              {classesFilterList.length > 0 && (
                <div className="w-full sm:w-[180px]">
                  <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classesFilterList.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Examination Subjects Table */}
        <Card className="border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">My Authorized Examination Subjects</CardTitle>
            <CardDescription className="text-xs">
              Showing {filteredExamSubjects.length} of {examinationList.length} subjects assigned to you
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredExamSubjects.length === 0 ? (
              <div className="text-center py-12 px-4">
                <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  {examinationList.length === 0
                    ? 'No examination subjects assigned.'
                    : 'No matching subjects found.'}
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  {examinationList.length === 0
                    ? 'Subjects mapped to you in Teacher Class Mapping will appear here automatically.'
                    : 'Try adjusting your filters or search keywords.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[40px] text-xs font-semibold">#</TableHead>
                      <TableHead className="text-xs font-semibold">Program</TableHead>
                      <TableHead className="text-xs font-semibold">Class</TableHead>
                      <TableHead className="text-xs font-semibold">Section</TableHead>
                      <TableHead className="text-xs font-semibold">Subject</TableHead>
                      <TableHead className="text-xs font-semibold">Subject Code</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExamSubjects.map((item, index) => (
                      <TableRow key={item.id || index} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium text-xs bg-muted/30">
                            {item.programName}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-foreground">
                          {item.className}
                        </TableCell>
                        <TableCell>
                          {item.sectionName ? (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                              {item.sectionName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">All Sections</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-foreground">
                          {item.subjectName}
                        </TableCell>
                        <TableCell>
                          {item.subjectCode ? (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {item.subjectCode}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
                            onClick={() => handleOpenMarksDialog(item)}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Enter Marks
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enter Marks Dialog */}
        <Dialog open={marksDialogOpen} onOpenChange={setMarksDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
            <DialogHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-primary" />
                    Enter Marks: {activeSubjectForMarks?.subjectName}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1">
                    {activeSubjectForMarks?.programName} • {activeSubjectForMarks?.className}
                    {activeSubjectForMarks?.sectionName ? ` (${activeSubjectForMarks.sectionName})` : ' (All Sections)'}
                  </DialogDescription>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold px-2.5 py-1">
                  Teacher Authorized
                </Badge>
              </div>
            </DialogHeader>

            {/* Exam & Total Marks Selector Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3 bg-muted/20 p-3 rounded-lg border">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Select Examination *</Label>
                {allExams.length === 0 ? (
                  <p className="text-xs text-destructive">No examinations created by admin yet.</p>
                ) : (
                  <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableExamsForSubject.map((exam) => (
                        <SelectItem key={exam._id || exam.id} value={(exam._id || exam.id).toString()}>
                          {exam.examName} {exam.session ? `- ${exam.session}` : ''} ({exam.type || 'Exam'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Total / Maximum Marks</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={totalMarksInput}
                  onChange={(e) => setTotalMarksInput(Number(e.target.value) || 100)}
                  className="h-9 text-sm"
                  placeholder="100"
                />
              </div>
            </div>

            {/* Student Marks Entry Table */}
            <div className="flex-1 overflow-y-auto min-h-[260px] border rounded-lg">
              {isClassStudentsLoading || isExistingMarksLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : studentsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground p-4">
                  <Users className="w-8 h-8 opacity-40 mb-2" />
                  <p className="text-sm font-medium">No active students enrolled in this class/section.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-xs z-10">
                    <TableRow>
                      <TableHead className="w-[50px] text-xs font-semibold">#</TableHead>
                      <TableHead className="text-xs font-semibold">Roll Number</TableHead>
                      <TableHead className="text-xs font-semibold">Student Name</TableHead>
                      <TableHead className="w-[90px] text-xs font-semibold text-center">Absent?</TableHead>
                      <TableHead className="w-[140px] text-xs font-semibold">Obtained Marks</TableHead>
                      <TableHead className="w-[90px] text-xs font-semibold text-center">Percentage</TableHead>
                      <TableHead className="w-[90px] text-xs font-semibold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsList.map((student, idx) => {
                      const sId = (student._id || student.id).toString();
                      const fullName =
                        student.name ||
                        `${student.fName || student.firstName || ''} ${student.lName || student.lastName || ''}`.trim() ||
                        'Student';
                      const roll = student.rollNumber || student.rollNo || 'N/A';
                      const rowState = marksState[sId] || { obtainedMarks: '', isAbsent: false };
                      const totalNum = Number(totalMarksInput) || 100;
                      const obtainedNum = Number(rowState.obtainedMarks);
                      const hasMark = rowState.obtainedMarks !== '' && rowState.obtainedMarks !== null;
                      const pct = hasMark && !rowState.isAbsent ? Math.round((obtainedNum / totalNum) * 100) : null;
                      const isPassing = pct !== null && pct >= 40;

                      return (
                        <TableRow key={sId || idx} className={rowState.isAbsent ? 'bg-muted/30 opacity-70' : ''}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs font-medium text-foreground">{roll}</TableCell>
                          <TableCell className="font-semibold text-sm text-foreground">{fullName}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={rowState.isAbsent}
                              onCheckedChange={(checked) => {
                                setMarksState((prev) => ({
                                  ...prev,
                                  [sId]: {
                                    ...prev[sId],
                                    isAbsent: !!checked,
                                    obtainedMarks: checked ? 0 : prev[sId]?.obtainedMarks || '',
                                  },
                                }));
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={totalNum}
                              disabled={rowState.isAbsent}
                              value={rowState.isAbsent ? '0' : rowState.obtainedMarks}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMarksState((prev) => ({
                                  ...prev,
                                  [sId]: {
                                    ...prev[sId],
                                    obtainedMarks: val === '' ? '' : Math.min(totalNum, Math.max(0, Number(val))),
                                  },
                                }));
                              }}
                              className="h-8 text-sm w-[110px]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono font-medium">
                            {rowState.isAbsent ? '-' : pct !== null ? `${pct}%` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {rowState.isAbsent ? (
                              <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                                Absent
                              </Badge>
                            ) : pct !== null ? (
                              <Badge
                                className={
                                  isPassing
                                    ? 'bg-primary/10 text-primary border-primary/20 text-xs'
                                    : 'bg-red-500/10 text-red-600 border-red-200 text-xs'
                                }
                              >
                                {isPassing ? 'Pass' : 'Fail'}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Total Students: <span className="font-semibold text-foreground">{studentsList.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMarksDialogOpen(false)}
                  disabled={saveMarksMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleMarksSubmit}
                  disabled={saveMarksMutation.isPending || studentsList.length === 0}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
                >
                  {saveMarksMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Marks
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
