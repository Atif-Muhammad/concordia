import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users, Search, GraduationCap, School, Layers, BookOpen } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { userWho, refreshTokens, getTeacherClasses, getStudents } from '../../../config/apis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function TeacherStudents() {
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentModal, setSelectedStudentModal] = useState(null);

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

  const teacherClassMappings = useMemo(() => {
    return Array.isArray(classesData) ? classesData : classesData?.data || [];
  }, [classesData]);

  // Extract distinct programs from teacher mappings
  const programsList = useMemo(() => {
    const map = new Map();
    teacherClassMappings.forEach((m) => {
      const prog = m.programId || m.program || m.classId?.programId;
      if (prog) {
        const id = (prog._id || prog.id || prog).toString();
        const name = prog.name || 'General Program';
        if (!map.has(id)) {
          map.set(id, { id, name });
        }
      }
    });
    return Array.from(map.values());
  }, [teacherClassMappings]);

  // Auto-select first program if none selected
  useEffect(() => {
    if (!selectedProgramId && programsList.length > 0) {
      setSelectedProgramId(programsList[0].id);
    }
  }, [programsList, selectedProgramId]);

  // Extract distinct classes for the selected program
  const classesForProgram = useMemo(() => {
    if (!selectedProgramId) return [];
    const map = new Map();
    teacherClassMappings.forEach((m) => {
      const prog = m.programId || m.program || m.classId?.programId;
      const progId = prog ? (prog._id || prog.id || prog).toString() : '';
      if (progId === selectedProgramId) {
        const cls = m.classId || m.class;
        if (cls) {
          const cId = (cls._id || cls.id || cls).toString();
          if (!map.has(cId)) {
            map.set(cId, {
              id: cId,
              name: cls.name || 'Class',
              allowSections: cls.allowSections !== false,
            });
          }
        }
      }
    });
    return Array.from(map.values());
  }, [teacherClassMappings, selectedProgramId]);

  // Auto-select first class when program changes or first loads
  useEffect(() => {
    if (classesForProgram.length > 0) {
      const exists = classesForProgram.some((c) => c.id === selectedClassId);
      if (!exists) {
        setSelectedClassId(classesForProgram[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [classesForProgram, selectedClassId]);

  // Selected class object
  const currentClassObj = useMemo(() => {
    return classesForProgram.find((c) => c.id === selectedClassId) || null;
  }, [classesForProgram, selectedClassId]);

  // Extract sections for the selected class
  const sectionsForClass = useMemo(() => {
    if (!selectedClassId) return [];
    const map = new Map();
    teacherClassMappings.forEach((m) => {
      const cls = m.classId || m.class;
      const cId = cls ? (cls._id || cls.id || cls).toString() : '';
      if (cId === selectedClassId && (m.sectionId || m.section)) {
        const sec = m.sectionId || m.section;
        const sId = (sec._id || sec.id || sec).toString();
        if (!map.has(sId)) {
          map.set(sId, { id: sId, name: sec.name || 'Section' });
        }
      }
    });
    return Array.from(map.values());
  }, [teacherClassMappings, selectedClassId]);

  // Auto-select section when class changes
  useEffect(() => {
    if (sectionsForClass.length > 0) {
      const exists = sectionsForClass.some((s) => s.id === selectedSectionId);
      if (!exists) {
        setSelectedSectionId(sectionsForClass[0].id);
      }
    } else {
      setSelectedSectionId('*');
    }
  }, [sectionsForClass, selectedSectionId]);

  // Subjects taught by teacher in the selected class & section
  const currentAssignedSubjects = useMemo(() => {
    if (!selectedClassId) return [];
    const map = new Map();
    teacherClassMappings.forEach((m) => {
      const cls = m.classId || m.class;
      const cId = cls ? (cls._id || cls.id || cls).toString() : '';
      if (cId === selectedClassId) {
        const sec = m.sectionId || m.section;
        const sId = sec ? (sec._id || sec.id || sec).toString() : '';
        if (
          !selectedSectionId ||
          selectedSectionId === '*' ||
          !sId ||
          sId === selectedSectionId
        ) {
          (m.subjects || []).forEach((sub) => {
            const subId = (sub?._id || sub?.id || sub).toString();
            if (!map.has(subId)) {
              map.set(subId, sub);
            }
          });
          if (m.subjectId || m.subject) {
            const sub = m.subjectId || m.subject;
            const subId = (sub?._id || sub?.id || sub).toString();
            if (!map.has(subId)) {
              map.set(subId, sub);
            }
          }
        }
      }
    });
    return Array.from(map.values());
  }, [teacherClassMappings, selectedClassId, selectedSectionId]);

  // Fetch students for the selected class & section
  const sectionParam =
    currentClassObj?.allowSections && selectedSectionId && selectedSectionId !== '*'
      ? selectedSectionId
      : '';

  const { data: studentsResponse, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['classStudents', selectedProgramId, selectedClassId, sectionParam],
    queryFn: () =>
      getStudents(
        selectedProgramId,
        selectedClassId,
        sectionParam,
        '',
        'ACTIVE',
        '',
        '',
        1,
        1000
      ),
    enabled: !!selectedClassId,
  });

  const students = useMemo(() => {
    if (!studentsResponse) return [];
    if (Array.isArray(studentsResponse)) return studentsResponse;
    if (Array.isArray(studentsResponse?.students)) return studentsResponse.students;
    if (Array.isArray(studentsResponse?.data)) return studentsResponse.data;
    return [];
  }, [studentsResponse]);

  // Filter students by local search
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter((s) => {
      const name = (s.name || `${s.fName || s.firstName || ''} ${s.lName || s.lastName || ''}`).toLowerCase();
      const roll = (s.rollNumber || s.rollNo || '').toLowerCase();
      const father = (s.fatherOrguardian || s.fatherName || s.guardianName || '').toLowerCase();
      return name.includes(term) || roll.includes(term) || father.includes(term);
    });
  }, [students, searchTerm]);

  // Gender counts
  const maleCount = useMemo(() => {
    return students.filter((s) => (s.gender || '').toLowerCase() === 'male').length;
  }, [students]);

  const femaleCount = useMemo(() => {
    return students.filter((s) => (s.gender || '').toLowerCase() === 'female').length;
  }, [students]);

  if (isUserLoading || isClassesLoading) {
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
              <Users className="w-6 h-6 text-primary" />
              My Students
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Browse students enrolled in your assigned programs, classes, and sections
            </p>
          </div>
        </div>

        {/* Cascading Selectors Card */}
        <Card className="border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Cascading Class Selectors
            </CardTitle>
            <CardDescription className="text-xs">
              Select Program &rarr; Class &rarr; Section to view students
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Program Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Program</Label>
                <Select
                  value={selectedProgramId}
                  onValueChange={(val) => {
                    setSelectedProgramId(val);
                    setSearchTerm('');
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programsList.map((prog) => (
                      <SelectItem key={prog.id} value={prog.id}>
                        {prog.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Class Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Class</Label>
                <Select
                  value={selectedClassId}
                  onValueChange={(val) => {
                    setSelectedClassId(val);
                    setSearchTerm('');
                  }}
                  disabled={classesForProgram.length === 0}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={classesForProgram.length === 0 ? "No Classes" : "Select Class"} />
                  </SelectTrigger>
                  <SelectContent>
                    {classesForProgram.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Section Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Section</Label>
                <Select
                  value={selectedSectionId}
                  onValueChange={(val) => {
                    setSelectedSectionId(val);
                    setSearchTerm('');
                  }}
                  disabled={!currentClassObj?.allowSections || sectionsForClass.length === 0}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="*">All Sections</SelectItem>
                    {sectionsForClass.map((sec) => (
                      <SelectItem key={sec.id} value={sec.id}>
                        {sec.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assigned subjects badge strip */}
            {currentAssignedSubjects.length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  Your Subjects in this Class:
                </span>
                {currentAssignedSubjects.map((sub, sIdx) => (
                  <Badge
                    key={sub?._id || sub?.id || sIdx}
                    className="bg-primary/10 text-primary border-primary/20 text-xs font-medium"
                  >
                    {sub?.name || 'Subject'}
                    {sub?.code ? ` (${sub.code})` : ''}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Strip */}
        {selectedClassId && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <Card className="border shadow-2xs">
              <CardContent className="p-2.5 sm:p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Total Students</p>
                  <p className="text-base sm:text-xl font-bold text-foreground mt-0.5">{students.length}</p>
                </div>
                <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-2xs">
              <CardContent className="p-2.5 sm:p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Male</p>
                  <p className="text-base sm:text-xl font-bold text-foreground mt-0.5">{maleCount}</p>
                </div>
                <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-2xs col-span-2 sm:col-span-1">
              <CardContent className="p-2.5 sm:p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Female</p>
                  <p className="text-base sm:text-xl font-bold text-foreground mt-0.5">{femaleCount}</p>
                </div>
                <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-600">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Students Table Card */}
        {selectedClassId && (
          <Card className="border shadow-2xs">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm sm:text-base font-semibold">Student Roster</CardTitle>
                <CardDescription className="text-xs">
                  Showing {filteredStudents.length} of {students.length} enrolled students
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-xs sm:text-sm h-8 sm:h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isStudentsLoading ? (
                <div className="flex justify-center items-center p-12">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {students.length === 0
                      ? "No students enrolled in this class/section."
                      : "No students matching your search."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[36px] sm:w-[40px] text-xs font-semibold py-2 px-2 sm:px-3">#</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3">Student</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 hidden sm:table-cell">Roll No.</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 hidden md:table-cell">Father / Guardian</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 hidden sm:table-cell">Gender</TableHead>
                        <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 text-right sm:text-left">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student, index) => {
                        const fullName =
                          student.name ||
                          `${student.fName || student.firstName || ''} ${student.lName || student.lastName || ''}`.trim() ||
                          'N/A';
                        const roll = student.rollNumber || student.rollNo || 'N/A';
                        const fatherName =
                          student.fatherOrguardian ||
                          student.fatherName ||
                          student.guardianName ||
                          student.emergencyContactName ||
                          'N/A';
                        const gender = student.gender || 'N/A';
                        const status = student.status || (student.isActive ? 'ACTIVE' : 'INACTIVE');

                        return (
                          <TableRow
                            key={student._id || student.id || index}
                            className="hover:bg-muted/40 transition-colors cursor-pointer active:bg-muted/70"
                            onClick={() => setSelectedStudentModal(student)}
                          >
                            <TableCell className="text-xs text-muted-foreground py-2 px-2 sm:px-3">{index + 1}</TableCell>
                            <TableCell className="py-2 px-2 sm:px-3">
                              <div className="font-semibold text-xs sm:text-sm text-foreground">{fullName}</div>
                              <div className="sm:hidden text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono font-medium bg-muted px-1 rounded">{roll}</span>
                                {fatherName !== 'N/A' && <span>• {fatherName}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-medium text-foreground py-2 px-2 sm:px-3 hidden sm:table-cell">
                              {roll}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm text-muted-foreground py-2 px-2 sm:px-3 hidden md:table-cell">
                              {fatherName}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm capitalize text-muted-foreground py-2 px-2 sm:px-3 hidden sm:table-cell">
                              {gender}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:px-3 text-right sm:text-left">
                              <Badge
                                variant="outline"
                                className={
                                  String(status).toUpperCase() === 'ACTIVE'
                                    ? 'bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs font-medium'
                                    : 'bg-muted text-muted-foreground text-[10px] sm:text-xs'
                                }
                              >
                                {status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Student Detail Modal */}
        <Dialog open={!!selectedStudentModal} onOpenChange={(open) => !open && setSelectedStudentModal(null)}>
          <DialogContent className="max-w-md p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Student Details
              </DialogTitle>
            </DialogHeader>
            {selectedStudentModal && (
              <div className="space-y-3 pt-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Full Name:</span>
                  <span className="font-semibold text-foreground">
                    {selectedStudentModal.name || `${selectedStudentModal.fName || ''} ${selectedStudentModal.lName || ''}`.trim() || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Roll Number:</span>
                  <span className="font-mono font-medium">{selectedStudentModal.rollNumber || selectedStudentModal.rollNo || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Father / Guardian:</span>
                  <span>{selectedStudentModal.fatherOrguardian || selectedStudentModal.fatherName || selectedStudentModal.guardianName || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Gender:</span>
                  <span className="capitalize">{selectedStudentModal.gender || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Contact Phone:</span>
                  <span>{selectedStudentModal.phone || selectedStudentModal.contactNumber || selectedStudentModal.emergencyContact || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedStudentModal.status || (selectedStudentModal.isActive ? 'ACTIVE' : 'INACTIVE')}
                  </Badge>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
