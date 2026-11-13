import React, { useMemo, useState } from "react";
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
import { Trophy, Award, Printer, SlidersHorizontal, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  getExams,
  getPositions,
  generatePositions,
  getStudents,
  getClasses,
  getAcademicSessions,
} from "@/services/api";
import { extractId } from "@/lib/utils.jsx";
import { isStudentActive } from "@/lib/studentStatus";
import { formatNormalizedFullName, matchesSearchTokens } from "@/lib/studentSearch";
import usePermissions from "@/hooks/usePermissions";

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

export const PositionsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = usePermissions("Examination", "results");

  const [positionsSessionFilter, setPositionsSessionFilter] = useState("");
  const [positionsFilterExam, setPositionsFilterExam] = useState("");
  const [positionsStudentSearch, setPositionsStudentSearch] = useState("");
  const [showPositionsFilters, setShowPositionsFilters] = useState(false);

  const { data: sessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
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

  const sessionName = sessions.find((s) => extractId(s.id || s._id) === positionsSessionFilter)?.name;
  const filteredExams = positionsSessionFilter
    ? exams.filter((e) => {
        const examSessionId = extractId(e.sessionId || e.session?.id || e.session?._id);
        return examSessionId === positionsSessionFilter || e.session === sessionName;
      })
    : exams;

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", positionsFilterExam],
    queryFn: () =>
      getPositions(
        positionsFilterExam && positionsFilterExam !== "*" ? positionsFilterExam : undefined
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
    return formatNormalizedFullName(student.fName, student.lName) || "N/A";
  };

  const examOptions = useMemo(() => {
    return (filteredExams || []).map((exam) => {
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
  }, [filteredExams]);

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
        <meta charset="utf-8" />
        <title>Student Rankings & Positions</title>
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
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 14px;
            font-size: 11px;
          }
          .meta-label {
            font-size: 9px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
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
          .summary-strip {
            display: flex;
            justify-content: space-between;
            background: #f8fafc;
            border-top: 1.5px solid #0f172a;
            border-bottom: 1.5px solid #0f172a;
            padding: 8px 14px;
            margin-bottom: 24px;
            font-size: 11px;
          }
          .summary-strip span strong {
            color: #0f172a;
          }
          .page-break { page-break-after: always; }
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
            <div class="report-subtitle">Student Merit & Position Gazette</div>
          </div>
        </div>

        ${Object.entries(groupedPositions)
          .map(
            ([examName, classes]) => `
          <div class="exam-section">
            <div class="meta-strip">
              <div>
                <div class="meta-label">Examination</div>
                <div class="meta-val">${examName}</div>
              </div>
              <div>
                <div class="meta-label">Academic Session</div>
                <div class="meta-val">${positionsSessionFilter ? sessionName : "All Sessions"}</div>
              </div>
              <div>
                <div class="meta-label">Date Generated</div>
                <div class="meta-val">${new Date().toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</div>
              </div>
            </div>

            ${Object.entries(classes)
              .map(
                ([className, classPositions]) => `
              <h3 style="margin: 10px 0 6px 0; font-size: 13px; font-weight: 700; color: #0f172a;">Class: ${className}</h3>
              <table>
                <thead>
                  <tr>
                    <th class="text-center" style="width: 50px;">Pos</th>
                    <th>Student Name</th>
                    <th style="width: 90px;">Roll No</th>
                    <th class="text-center" style="width: 60px;">Total</th>
                    <th class="text-center" style="width: 60px;">Obtained</th>
                    <th class="text-center" style="width: 60px;">%</th>
                    <th class="text-center" style="width: 60px;">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  ${classPositions
                    .map((pos) => {
                      const student = pos.student || students.find((s) => extractId(s.id || s._id) === extractId(pos.studentId));
                      return `
                    <tr>
                      <td class="text-center" style="font-weight: 700;">${pos.position} ${
                        pos.position === 1
                          ? "🥇"
                          : pos.position === 2
                          ? "🥈"
                          : pos.position === 3
                          ? "🥉"
                          : ""
                      }</td>
                      <td style="font-weight: 600;">${getFullName(student)}</td>
                      <td style="font-family: monospace; font-weight: 600;">${student?.rollNumber || "N/A"}</td>
                      <td class="text-center">${pos.totalMarks}</td>
                      <td class="text-center" style="font-weight: 700;">${pos.obtainedMarks}</td>
                      <td class="text-center">${(pos.percentage || 0).toFixed(2)}%</td>
                      <td class="text-center" style="font-weight: 700;">${pos.grade || "N/A"}</td>
                    </tr>
                  `;
                    })
                    .join("")}
                </tbody>
              </table>

              <div class="summary-strip">
                <span>Total Candidates Ranked: <strong>${classPositions.length}</strong></span>
                <span>Top Position: <strong>${classPositions[0]?.student ? getFullName(classPositions[0].student) : classPositions[0]?.studentName || "N/A"} (${(classPositions[0]?.percentage || 0).toFixed(2)}%)</strong></span>
              </div>
            `
              )
              .join("")}

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
                  const selExam = exams.find((e) => extractId(e.id || e._id) === positionsFilterExam);
                  generatePositionsMutation.mutate({
                    examId: positionsFilterExam,
                    classId: selExam?.classId ? extractId(selExam.classId) : undefined,
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Filter by Session</Label>
              <Select
                value={positionsSessionFilter || "__all__"}
                onValueChange={(v) => {
                  setPositionsSessionFilter(v === "__all__" ? "" : v);
                  setPositionsFilterExam("");
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
              <SearchableSelect
                options={examOptions}
                value={positionsFilterExam}
                onChange={(v) => setPositionsFilterExam(v)}
                placeholder="Select exam"
                allLabel="All Exams"
                isLoading={isLoadingExams}
                searchPlaceholder="Search exam name, class, program..."
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!positionsFilterExam || positionsFilterExam === "" ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-lg font-medium text-muted-foreground">
              Select an Exam to View Rankings
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Choose an exam from the filter above to see student positions
            </p>
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-16">
            <Award className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-lg font-medium text-muted-foreground">No Positions Found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Click "Generate Positions" to calculate rankings from results
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search student by name, father name, or roll no..."
                value={positionsStudentSearch}
                onChange={(e) => setPositionsStudentSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {(() => {
              const visiblePositions = positionsStudentSearch.trim()
                ? positions.filter((pos) => {
                    const s =
                      pos.student ||
                      students.find(
                        (st) => extractId(st.id || st._id) === extractId(pos.studentId)
                      );
                    return matchesSearchTokens(positionsStudentSearch, [
                      s ? getFullName(s) : pos.studentName,
                      s?.fatherOrguardian,
                      s?.rollNumber || pos.rollNumber,
                    ]);
                  })
                : positions;

              if (visiblePositions.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    No students found matching "{positionsStudentSearch}".
                  </div>
                );
              }

              const groupedPositions = visiblePositions.reduce((acc, pos) => {
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
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PositionsTab;
