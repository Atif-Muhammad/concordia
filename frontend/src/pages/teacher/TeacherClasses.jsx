import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, School, BookOpen, Layers, Search, Filter } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { userWho, refreshTokens, getTeacherClasses } from '../../../config/apis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TeacherClasses() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');

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

  const classes = useMemo(() => {
    return Array.isArray(classesData) ? classesData : classesData?.data || [];
  }, [classesData]);

  // Extract unique programs for filter
  const programsList = useMemo(() => {
    const map = new Map();
    classes.forEach((cls) => {
      const prog = cls.programId || cls.program || cls.classId?.programId;
      if (prog) {
        const id = prog._id || prog.id || prog;
        const name = prog.name || 'General';
        if (!map.has(id.toString())) {
          map.set(id.toString(), { id: id.toString(), name });
        }
      }
    });
    return Array.from(map.values());
  }, [classes]);

  // Filter classes based on program & search
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      const prog = cls.programId || cls.program || cls.classId?.programId;
      const progId = prog ? (prog._id || prog.id || prog).toString() : '';
      if (selectedProgramFilter !== 'all' && progId !== selectedProgramFilter) {
        return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const className = (cls.classId?.name || cls.class?.name || '').toLowerCase();
      const sectionName = (cls.sectionId?.name || cls.section?.name || '').toLowerCase();
      const progName = (prog?.name || '').toLowerCase();
      const subjectNames = (cls.subjects || [])
        .map((s) => (s?.name || '').toLowerCase())
        .join(' ');

      return (
        className.includes(term) ||
        sectionName.includes(term) ||
        progName.includes(term) ||
        subjectNames.includes(term)
      );
    });
  }, [classes, selectedProgramFilter, searchTerm]);

  // Overall stats
  const totalSubjectsCount = useMemo(() => {
    const subjectIdSet = new Set();
    classes.forEach((cls) => {
      (cls.subjects || []).forEach((sub) => {
        const sid = sub?._id || sub?.id || sub;
        if (sid) subjectIdSet.add(sid.toString());
      });
      if (cls.subjectId || cls.subject) {
        const s = cls.subjectId || cls.subject;
        const sid = s?._id || s?.id || s;
        if (sid) subjectIdSet.add(sid.toString());
      }
    });
    return subjectIdSet.size;
  }, [classes]);

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
              <School className="w-6 h-6 text-primary" />
              My Assigned Classes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Programs, classes, sections, and subjects linked to your teaching profile
            </p>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <Card className="border shadow-2xs">
            <CardContent className="p-2.5 sm:p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Programs Taught</p>
                <p className="text-base sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">{programsList.length}</p>
              </div>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-2xs">
            <CardContent className="p-2.5 sm:p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Classes / Sections</p>
                <p className="text-base sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">{classes.length}</p>
              </div>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <School className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-2xs col-span-2 sm:col-span-1">
            <CardContent className="p-2.5 sm:p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Total Subjects</p>
                <p className="text-base sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">{totalSubjectsCount}</p>
              </div>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <Card className="border shadow-2xs">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by class, program, section, or subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm h-9"
                />
              </div>
              {programsList.length > 0 && (
                <div className="w-full sm:w-[220px]">
                  <Select value={selectedProgramFilter} onValueChange={setSelectedProgramFilter}>
                    <SelectTrigger className="h-9 text-sm">
                      <div className="flex items-center gap-2 truncate">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <SelectValue placeholder="All Programs" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {programsList.map((prog) => (
                        <SelectItem key={prog.id} value={prog.id}>
                          {prog.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Classes Table */}
        <Card className="border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">Class & Subject Assignments</CardTitle>
            <CardDescription className="text-xs">
              Showing {filteredClasses.length} of {classes.length} assigned class mappings
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredClasses.length === 0 ? (
              <div className="text-center py-12 px-4">
                <School className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  {classes.length === 0 ? "No classes assigned yet." : "No matching classes found."}
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  {classes.length === 0
                    ? "Your assignments will appear here once an administrator maps you to classes and subjects."
                    : "Try adjusting your search query or program filter."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[40px] text-xs font-semibold py-2 px-2 sm:px-3 hidden sm:table-cell">#</TableHead>
                      <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 hidden md:table-cell">Program</TableHead>
                      <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3">Class & Section</TableHead>
                      <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3 hidden sm:table-cell">Section</TableHead>
                      <TableHead className="text-xs font-semibold py-2 px-2 sm:px-3">Assigned Subjects</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((cls, index) => {
                      const programName =
                        cls.programId?.name ||
                        cls.program?.name ||
                        cls.classId?.programId?.name ||
                        cls.class?.programId?.name ||
                        'N/A';
                      const className = cls.classId?.name || cls.class?.name || 'N/A';
                      const sectionName = cls.sectionId?.name || cls.section?.name;
                      const subjectsList = cls.subjects?.length > 0
                        ? cls.subjects
                        : cls.subject
                        ? [cls.subject]
                        : [];

                      return (
                        <TableRow key={cls.id || index} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground py-2 px-2 sm:px-3 hidden sm:table-cell">{index + 1}</TableCell>
                          <TableCell className="py-2 px-2 sm:px-3 hidden md:table-cell">
                            <Badge variant="outline" className="font-medium text-xs bg-muted/30">
                              {programName}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 px-2 sm:px-3">
                            <div className="font-semibold text-xs sm:text-sm text-foreground">
                              {className}
                              {sectionName && <span className="sm:hidden font-normal text-muted-foreground ml-1">({sectionName})</span>}
                            </div>
                            <div className="md:hidden text-[10px] text-muted-foreground mt-0.5">
                              {programName}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-2 sm:px-3 hidden sm:table-cell">
                            {sectionName ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                                {sectionName}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">All Sections</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-2 sm:px-3">
                            {subjectsList.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">
                                General Class Teacher
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1 py-0.5">
                                {subjectsList.map((sub, sIdx) => (
                                  <Badge
                                    key={sub?._id || sub?.id || sIdx}
                                    variant="secondary"
                                    className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 text-xs font-medium"
                                  >
                                    {sub?.name || 'Subject'}
                                    {sub?.code ? ` (${sub.code})` : ''}
                                  </Badge>
                                ))}
                              </div>
                            )}
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
      </div>
    </DashboardLayout>
  );
}
