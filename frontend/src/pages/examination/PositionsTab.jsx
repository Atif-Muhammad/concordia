import React, { useState } from "react";
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
import { Trophy, Printer, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getExams,
  getPositions,
  generatePositions,
  getStudents,
  getClasses,
  getAcademicSessions,
} from "@/services/api";
import { extractId } from "@/lib/utils.jsx";
import usePermissions from "@/hooks/usePermissions";

export const PositionsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = usePermissions("Examination", "results");

  const [positionsSessionFilter, setPositionsSessionFilter] = useState("");
  const [positionsFilterExam, setPositionsFilterExam] = useState("");
  const [positionsFilterClass, setPositionsFilterClass] = useState("");
  const [showPositionsFilters, setShowPositionsFilters] = useState(false);

  const { data: sessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
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

  const sessionName = sessions.find((s) => extractId(s.id || s._id) === positionsSessionFilter)?.name;
  const filteredExams = positionsSessionFilter
    ? exams.filter((e) => {
        const examSessionId = extractId(e.sessionId || e.session?.id || e.session?._id);
        return examSessionId === positionsSessionFilter || e.session === sessionName;
      })
    : exams;

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", positionsFilterExam, positionsFilterClass],
    queryFn: () =>
      getPositions(
        positionsFilterExam && positionsFilterExam !== "*" ? positionsFilterExam : undefined,
        positionsFilterClass && positionsFilterClass !== "*" ? positionsFilterClass : undefined
      ),
    enabled: !!(positionsFilterExam && positionsFilterExam !== "*"),
  });

  const generatePositionsMutation = useMutation({
    mutationFn: ({ examId, classId }) => generatePositions(examId, classId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      toast({
        title: "Positions generated successfully",
        description: `Generated ${data?.length || 0} positions`,
      });
    },
    onError: (err) => {
      console.error("Generate positions error:", err);
      toast({
        title: "Failed to generate positions",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const getFullName = (student) => {
    if (!student) return "N/A";
    return `${student.fName || ""} ${student.lName || ""}`.trim() || "N/A";
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

  const printPositions = () => {
    if (positions.length === 0) {
      toast({ title: "No positions to print", variant: "destructive" });
      return;
    }

    const groupedPositions = positions.reduce((acc, pos) => {
      const examKey = `${pos.exam?.examName || pos.examName || "Exam"} - ${pos.exam?.session || pos.session || ""}`;
      const classKey = pos.class?.name || pos.className || "All Classes";

      if (!acc[examKey]) acc[examKey] = {};
      if (!acc[examKey][classKey]) acc[examKey][classKey] = [];
      acc[examKey][classKey].push(pos);

      return acc;
    }, {});

    const printWin = window.open("", "_blank");
    printWin?.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student Rankings</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #000; padding: 10px; }
          h1, h2, h3 { margin: 10px 0; }
          .page-break { page-break-after: always; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Student Rankings</h1>
        ${Object.entries(groupedPositions)
          .map(
            ([examName, classes]) => `
          <div class="exam-section">
            <h2>${examName}</h2>
            ${Object.entries(classes)
              .map(
                ([className, classPositions]) => `
              <h3>Class: ${className}</h3>
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
                  ${classPositions
                    .map((pos) => {
                      const student = pos.student || students.find((s) => extractId(s.id || s._id) === extractId(pos.studentId));
                      return `
                    <tr>
                      <td>${pos.position} ${
                        pos.position === 1
                          ? "🥇"
                          : pos.position === 2
                          ? "🥈"
                          : pos.position === 3
                          ? "🥉"
                          : ""
                      }</td>
                      <td>${getFullName(student)}</td>
                      <td>${student?.rollNumber || "N/A"}</td>
                      <td>${pos.totalMarks}</td>
                      <td>${pos.obtainedMarks}</td>
                      <td>${(pos.percentage || 0).toFixed(2)}%</td>
                      <td>${pos.grade || "N/A"}</td>
                    </tr>
                  `;
                    })
                    .join("")}
                </tbody>
              </table>
            `
              )
              .join("")}
            <div class="page-break"></div>
          </div>
        `
          )
          .join("")}
      </body>
      </html>
    `);
    printWin?.document.close();
    printWin?.print();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Student Rankings & Positions
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowPositionsFilters((s) => !s)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {showPositionsFilters ? "Hide Filters" : "Filters"}
            </Button>
            {(canCreate || canUpdate) && (
              <Button
                onClick={() => {
                  if (!positionsFilterExam || positionsFilterExam === "") {
                    toast({ title: "Please select an exam", variant: "destructive" });
                    return;
                  }
                  generatePositionsMutation.mutate({
                    examId: positionsFilterExam,
                    classId:
                      positionsFilterClass && positionsFilterClass !== "*"
                        ? positionsFilterClass
                        : undefined,
                  });
                }}
                disabled={generatePositionsMutation.isPending}
              >
                <Trophy className="w-4 h-4 mr-2" />
                {generatePositionsMutation.isPending ? "Generating..." : "Generate Positions"}
              </Button>
            )}
            <Button onClick={printPositions} variant="outline" className="gap-2">
              <Printer className="w-4 h-4" />
              Print Positions
            </Button>
          </div>
        </div>
        <div
          className={`transition-all duration-300 ease-out overflow-hidden ${
            showPositionsFilters
              ? "max-h-[420px] opacity-100"
              : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Filter by Session</Label>
              <Select
                value={positionsSessionFilter || "__all__"}
                onValueChange={(v) => {
                  setPositionsSessionFilter(v === "__all__" ? "" : v);
                  setPositionsFilterExam("");
                  setPositionsFilterClass("");
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
                        {s.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Filter by Exam *</Label>
              <Select
                value={positionsFilterExam}
                onValueChange={(v) => {
                  setPositionsFilterExam(v);
                  const selExam = exams.find((e) => extractId(e.id || e._id) === v);
                  setPositionsFilterClass(selExam?.classId ? extractId(selExam.classId) : "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Exams</SelectItem>
                  {filteredExams?.map((exam) => {
                    const eId = extractId(exam.id || exam._id);
                    return (
                      <SelectItem key={eId} value={eId}>
                        {exam.examName} - {exam.session} ({formatDateDisplay(exam.startDate)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Filter by Class</Label>
              <Select
                value={positionsFilterClass}
                onValueChange={setPositionsFilterClass}
                disabled={!positionsFilterExam || positionsFilterExam === "*"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All Classes</SelectItem>
                  {(() => {
                    const selectedExam = exams?.find(
                      (e) => extractId(e.id || e._id) === positionsFilterExam
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
                    return classesData.map((cls) => {
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
        {!positionsFilterExam || positionsFilterExam === "" ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🏆</p>
            <p className="text-lg font-medium text-muted-foreground">
              Select an Exam to View Rankings
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Choose an exam from the filter above to see student positions
            </p>
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-lg font-medium text-muted-foreground">No Positions Found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Click "Generate Positions" to calculate rankings from results
            </p>
          </div>
        ) : (
          (() => {
            const groupedPositions = positions.reduce((acc, pos) => {
              const examKey = `${pos.exam?.examName || pos.examName || "Exam"} - ${pos.exam?.session || pos.session || ""}`;
              const classKey = pos.class?.name || pos.className || "All Classes";

              if (!acc[examKey]) acc[examKey] = {};
              if (!acc[examKey][classKey]) acc[examKey][classKey] = [];
              acc[examKey][classKey].push(pos);

              return acc;
            }, {});

            return Object.entries(groupedPositions).map(([examName, classes]) => (
              <div key={examName} className="mb-6">
                <h3 className="text-lg font-semibold mb-4">{examName}</h3>
                {Object.entries(classes).map(([className, classPositions]) => {
                  const sortedPositions = classPositions.sort((a, b) => a.position - b.position);
                  return (
                    <Card key={className} className="mb-4">
                      <CardHeader>
                        <CardTitle className="text-md">Class: {className}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-sm px-3 py-2 w-16">Position</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Student Name</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Roll No</TableHead>
                              <TableHead className="text-sm px-3 py-2 text-right">Total</TableHead>
                              <TableHead className="text-sm px-3 py-2 text-right">Obtained</TableHead>
                              <TableHead className="text-sm px-3 py-2 text-right">%</TableHead>
                              <TableHead className="py-2 px-3 text-sm">Grade</TableHead>
                              <TableHead className="text-sm px-3 py-2 text-right">GPA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedPositions.map((pos, idx) => {
                              const student = pos.student || students.find((s) => extractId(s.id || s._id) === extractId(pos.studentId));
                              return (
                                <TableRow key={pos.id || idx}>
                                  <TableCell className="text-sm px-3 py-2 font-bold">
                                    {pos.position === 1
                                      ? "🥇 1"
                                      : pos.position === 2
                                      ? "🥈 2"
                                      : pos.position === 3
                                      ? "🥉 3"
                                      : pos.position}
                                  </TableCell>
                                  <TableCell className="py-2 px-3 text-sm">
                                    {getFullName(student)}
                                  </TableCell>
                                  <TableCell className="py-2 px-3 text-sm">
                                    {student?.rollNumber || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-sm px-3 py-2 text-right">
                                    {pos.totalMarks}
                                  </TableCell>
                                  <TableCell className="text-sm px-3 py-2 text-right">
                                    {pos.obtainedMarks}
                                  </TableCell>
                                  <TableCell className="text-sm px-3 py-2 text-right">
                                    {(pos.percentage || 0).toFixed(2)}%
                                  </TableCell>
                                  <TableCell className="py-2 px-3 text-sm">{pos.grade || "N/A"}</TableCell>
                                  <TableCell className="text-sm px-3 py-2 text-right">
                                    {(pos.gpa || 0).toFixed(2)}
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
              </div>
            ));
          })()
        )}
      </CardContent>
    </Card>
  );
};

export default PositionsTab;
