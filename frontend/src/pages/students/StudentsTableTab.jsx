import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { resolveFileUrl } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandInput } from "@/components/ui/command";
import {
  Users,
  UserPlus,
  TrendingUp,
  SlidersHorizontal,
  Eye,
  Edit,
  Trash2,
  RotateCcw,
  IdCard,
} from "lucide-react";
import { getStudents, getPassedOutStudents } from "@/services/api";
import usePermissions from "@/hooks/usePermissions";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

export const StudentsTableTab = ({
  status = "ACTIVE",
  onStatusChange,
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  hostelStudentIds = new Set(),
  onViewStudent,
  onEditStudent,
  onDeleteStudent,
  onRejoinStudent,
  onIdCard,
  onPromote,
  onAddStudent,
}) => {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = usePermissions("Students");
  const [showFilters, setShowFilters] = useState(false);

  const activeSessionId = useMemo(() => {
    const active = academicSessions.find((s) => s.isActive) || academicSessions[0];
    return active ? extractId(active) : "all";
  }, [academicSessions]);

  const [filterProgram, setFilterProgram] = useState(null);
  const [filterClass, setFilterClass] = useState(null);
  const [filterSection, setFilterSection] = useState(null);
  const [filterSessionId, setFilterSessionId] = useState(() => (status === "ACTIVE" ? activeSessionId : "all"));
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef(null);

  // Pre-select the active session when academicSessions loads if in ACTIVE tab
  useEffect(() => {
    if (status === "ACTIVE" && activeSessionId && activeSessionId !== "all" && (!filterSessionId || filterSessionId === "all")) {
      setFilterSessionId(activeSessionId);
    }
  }, [activeSessionId, status]);

  // When status changes, adjust session filter default appropriately
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      if (status !== "ACTIVE" && filterSessionId === activeSessionId) {
        setFilterSessionId("all");
      } else if (status === "ACTIVE" && (filterSessionId === "all" || !filterSessionId) && activeSessionId && activeSessionId !== "all") {
        setFilterSessionId(activeSessionId);
      }
      prevStatusRef.current = status;
    }
  }, [status, activeSessionId, filterSessionId]);

  const handleStudentSearch = (value) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 400);
  };

  const clearFilters = () => {
    setFilterProgram(null);
    setFilterClass(null);
    setFilterSection(null);
    setFilterSessionId(status === "ACTIVE" ? (activeSessionId || "all") : "all");
    setSearchQuery("");
  };

  const handleStatusChange = (value) => {
    if (value !== "ACTIVE" && status === "ACTIVE") {
      setFilterSessionId("all");
    } else if (value === "ACTIVE" && status !== "ACTIVE" && activeSessionId && activeSessionId !== "all") {
      setFilterSessionId(activeSessionId);
    }
    if (onStatusChange) {
      onStatusChange(value);
      return;
    }
    const pathMap = {
      ACTIVE: "/students/active",
      GRADUATED: "/students/graduated",
      EXPELLED: "/students/expelled",
      STRUCK_OFF: "/students/struck-off",
    };
    navigate(pathMap[value] || "/students");
  };

  const getClassesForProgram = (progId) => {
    if (!progId || progId === "all") return [];
    const cleanId = extractId(progId);
    return classesData.filter((c) => extractId(c.programId || c.program) === cleanId);
  };

  const getSectionsForClass = (clsId) => {
    if (!clsId || clsId === "all") return [];
    const cleanId = extractId(clsId);
    const cls = classesData.find((c) => extractId(c) === cleanId);
    if (cls?.sections?.length) return cls.sections;
    return sectionsData.filter((s) => extractId(s.classId || s.class) === cleanId);
  };

  const getStudentAcademicPath = (student) => {
    if (!student) return "-";
    const program =
      student.program ||
      (typeof student.programId === "object" ? student.programId : null) ||
      programData.find((p) => extractId(p) === extractId(student.programId)) ||
      classesData.find((c) => extractId(c) === extractId(student.classId))?.program;
    const classObj =
      student.class ||
      (typeof student.classId === "object" ? student.classId : null) ||
      classesData.find((c) => extractId(c) === extractId(student.classId));
    const section =
      student.section ||
      (typeof student.sectionId === "object" ? student.sectionId : null) ||
      classObj?.sections?.find((s) => extractId(s) === extractId(student.sectionId)) ||
      sectionsData.find((s) => extractId(s) === extractId(student.sectionId));
    const parts = [
      program?.name || student.programName,
      classObj?.name || student.className,
      section?.name || student.sectionName,
    ].filter(Boolean);
    return parts.length ? parts.join(" / ") : "-";
  };

  const {
    data: rawStudentsData,
    isLoading: loadingStudents,
  } = useQuery({
    queryKey: ["students", filterProgram, filterClass, filterSection, searchQuery, status, filterSessionId],
    queryFn: () => {
      const cleanSessionId = filterSessionId === "all" ? "" : filterSessionId;
      if (status === "ACTIVE") {
        return getStudents(
          filterProgram || "",
          filterClass || "",
          filterSection || "",
          searchQuery,
          "ACTIVE",
          "",
          1,
          0,
          "",
          "",
          cleanSessionId
        );
      } else {
        return getPassedOutStudents(
          filterProgram || "",
          filterClass || "",
          filterSection || "",
          searchQuery,
          status,
          "",
          1,
          0,
          cleanSessionId
        );
      }
    },
  });

  const studentsData = useMemo(() => {
    if (Array.isArray(rawStudentsData)) return rawStudentsData;
    return rawStudentsData?.students || [];
  }, [rawStudentsData]);

  const totalStudentsCount = useMemo(() => {
    if (typeof rawStudentsData?.count === "number") return rawStudentsData.count;
    if (typeof rawStudentsData?.total === "number") return rawStudentsData.total;
    return studentsData?.length || 0;
  }, [rawStudentsData, studentsData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-8 h-8 text-primary" />
              {status === "ACTIVE" ? "Active Students" : `${status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')} Students`}
            </h1>
            <p className="text-muted-foreground mt-1">
              Total Students: {totalStudentsCount}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
            {[
              { id: "ACTIVE", label: "Active" },
              { id: "GRADUATED", label: "Graduated" },
              { id: "EXPELLED", label: "Expelled" },
              { id: "STRUCK_OFF", label: "Struck Off" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleStatusChange(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  status === tab.id
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters((s) => !s)}
            className="gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? "Hide Filters" : "Filters"}
          </Button>
          {status === "ACTIVE" && canUpdate && onPromote && (
            <Button size="sm" onClick={onPromote} variant="outline" className="gap-2">
              <TrendingUp className="w-4 h-4" /> Promote
            </Button>
          )}
          {status === "ACTIVE" && canCreate && onAddStudent && (
            <Button size="sm" onClick={onAddStudent} className="gap-2">
              <UserPlus className="w-4 h-4" /> Add Student
            </Button>
          )}
        </div>
      </div>

      <div className={`transition-all duration-300 ease-out overflow-hidden ${showFilters ? "max-h-[900px] opacity-100 mt-0" : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"}`}>
        <Card className="shadow-soft w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filter Students</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-row-2 grid-cols-1 gap-2 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 w-full">
              <div>
                <Label>Program</Label>
                <Select
                  value={filterProgram || ""}
                  onValueChange={(value) => {
                    setFilterProgram(value === "all" ? null : (value || null));
                    setFilterClass(null);
                    setFilterSection(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {programData.map((p) => {
                      const pId = extractId(p);
                      return (
                        <SelectItem key={pId} value={pId}>
                          {p.name}{p.department?.name ? ` (${p.department.name})` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Class</Label>
                <Select
                  value={filterClass || ""}
                  onValueChange={(value) => {
                    setFilterClass(value === "all" ? null : (value || null));
                    setFilterSection(null);
                  }}
                  disabled={!filterProgram}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={filterProgram ? "All Classes" : "Select Program First"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {getClassesForProgram(filterProgram).map((c) => {
                      const cId = extractId(c);
                      return (
                        <SelectItem key={cId} value={cId}>
                          {c.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Section</Label>
                <Select
                  value={filterSection || ""}
                  onValueChange={(value) => {
                    setFilterSection(value === "all" ? null : (value || null));
                  }}
                  disabled={!filterClass}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={filterClass ? "All Sections" : "Select Class First"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {getSectionsForClass(filterClass).map((s) => {
                      const sId = extractId(s);
                      return (
                        <SelectItem key={sId} value={sId}>
                          {s.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="GRADUATED">Graduated</SelectItem>
                    <SelectItem value="EXPELLED">Expelled</SelectItem>
                    <SelectItem value="STRUCK_OFF">Struck Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Session</Label>
                <Select
                  value={filterSessionId}
                  onValueChange={(value) => setFilterSessionId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {academicSessions.map((s) => {
                      const sId = extractId(s);
                      return (
                        <SelectItem key={sId} value={sId}>
                          {s.name} {s.isActive ? "(Current)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={clearFilters} variant="outline" className="w-full md:w-auto">
                  Clear
                </Button>
              </div>
            </div>
            <Command shouldFilter={false}>
              <CommandInput placeholder="Search by name or roll no..." onValueChange={(v) => handleStudentSearch(v)} />
            </Command>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>
              {status === "ACTIVE" ? "Active Students" : `${status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')} Students`}
              {loadingStudents && " (Loading...)"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm">Photo</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Roll No</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Name</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Admission Date</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Program / Class / Section</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Status</TableHead>
                  {status !== "GRADUATED" && <TableHead className="py-2 px-3 text-sm">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={status !== "GRADUATED" ? 7 : 6} className="py-8 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p className="text-muted-foreground">
                          {status === "ACTIVE"
                            ? "No students found. Try adjusting your filters or add a new student."
                            : `No ${status.toLowerCase().replace('_', ' ')} students found`}
                        </p>
                        {(filterProgram || filterClass || filterSection) && (
                          <Button variant="outline" size="sm" onClick={clearFilters}>
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  studentsData.map((student) => {
                    const studentId = student.id || student._id;
                    const academicPath = getStudentAcademicPath(student);
                    return (
                      <TableRow key={studentId}>
                        <TableCell className="py-2 px-3 text-sm">
                          <Avatar>
                            <AvatarImage src={resolveFileUrl(student.photo_url)} />
                            <AvatarFallback>{student.fName?.[0] || "S"}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            {student.rollNumber}
                            {(hostelStudentIds.has(studentId) || hostelStudentIds.has(student.id) || hostelStudentIds.has(student._id)) && (
                              <span title="Boarding Student" className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] font-normal text-muted-foreground leading-snug">
                            {academicPath}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          <div className="flex items-center gap-1.5">
                            {student.fName} {student.lName}
                            {(hostelStudentIds.has(studentId) || hostelStudentIds.has(student.id) || hostelStudentIds.has(student._id)) && (
                              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 leading-none">
                                Boarding
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          {(student.admissionDate || student.createdAt) ? format(new Date(student.admissionDate || student.createdAt), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          <Badge variant="outline" className="whitespace-normal text-left leading-snug">
                            {academicPath}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          <Badge variant={
                            student.status === "ACTIVE" ? "default" :
                              student.status === "GRADUATED" ? "secondary" :
                                "destructive"
                          }>
                            {student.status || "ACTIVE"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          <div className="flex gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => onViewStudent(student)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Profile</TooltipContent>
                            </Tooltip>

                            {status === "ACTIVE" && canUpdate && onEditStudent && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" onClick={() => onEditStudent(student)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Student</TooltipContent>
                              </Tooltip>
                            )}

                            {(status === "EXPELLED" || status === "STRUCK_OFF") && canUpdate && onRejoinStudent && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                    onClick={() => onRejoinStudent(student)}
                                  >
                                    <RotateCcw className="w-4 h-4 mr-1" /> Re-join
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Re-join Student</TooltipContent>
                              </Tooltip>
                            )}

                            {status === "ACTIVE" && canDelete && onDeleteStudent && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" onClick={() => onDeleteStudent(studentId)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Student</TooltipContent>
                              </Tooltip>
                            )}

                            {onIdCard && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" onClick={() => onIdCard(student)}>
                                    <IdCard className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Generate ID Card</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {studentsData.length} students</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
