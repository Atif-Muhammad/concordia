import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StudentAttendanceTab } from "../StudentAttendanceTab";
import {
  getAcademicSessions,
  getAttendanceReport,
  searchStudents,
} from "../../../config/apis";

export default function IndividualReportsTab() {
  const { toast } = useToast();

  const [showIndividualFilters, setShowIndividualFilters] = useState(true);
  const [individualReportSessionId, setIndividualReportSessionId] = useState("all");
  const [individualStudentSearchQuery, setIndividualStudentSearchQuery] = useState("");
  const [individualSearchResults, setIndividualSearchResults] = useState([]);
  const [isIndividualSearching, setIsIndividualSearching] = useState(false);
  const [selectedIndividualStudent, setSelectedIndividualStudent] = useState(null);
  const [individualStartDate, setIndividualStartDate] = useState(
    new Date(new Date().setDate(1)).toISOString().split("T")[0]
  );
  const [individualEndDate, setIndividualEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  const {
    data: individualReportData = [],
    refetch: refetchIndividualReport,
    isFetching: isFetchingIndividualReport,
  } = useQuery({
    queryKey: [
      "individualAttendanceReport",
      individualStartDate,
      individualEndDate,
      selectedIndividualStudent?.class?.id,
      selectedIndividualStudent?.section?.id,
      selectedIndividualStudent?.id,
      individualReportSessionId,
    ],
    queryFn: async () => {
      if (!selectedIndividualStudent) return [];
      const classParam = selectedIndividualStudent.class?.id || "";
      const sectionParam = selectedIndividualStudent.section?.id || "";
      const sessionParam = individualReportSessionId === "all" ? undefined : individualReportSessionId;
      const allData = await getAttendanceReport(
        individualStartDate,
        individualEndDate,
        classParam,
        sectionParam,
        sessionParam
      );
      return (allData || []).filter((student) => student.id === selectedIndividualStudent.id);
    },
    enabled: false,
  });

  const handleIndividualStudentSearch = async (query) => {
    setIndividualStudentSearchQuery(query);
    if (query.length < 2) {
      setIndividualSearchResults([]);
      return;
    }
    setIsIndividualSearching(true);
    try {
      const results = await searchStudents(query);
      setIndividualSearchResults(results || []);
    } catch (error) {
      console.error("Search error:", error);
      setIndividualSearchResults([]);
    } finally {
      setIsIndividualSearching(false);
    }
  };

  const handleSelectIndividualStudent = (student) => {
    setSelectedIndividualStudent(student);
    setIndividualStudentSearchQuery(
      `${student.rollNumber} - ${student.fName} ${student.lName}`
    );
    setIndividualSearchResults([]);
  };

  const handleGenerateIndividualReport = () => {
    if (!selectedIndividualStudent || !individualStartDate || !individualEndDate) {
      toast({
        title: "Please select a student and date range",
        variant: "destructive",
      });
      return;
    }
    refetchIndividualReport();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowIndividualFilters((s) => !s)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {showIndividualFilters ? "Hide Filters" : "Filters"}
        </Button>
      </div>
      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          showIndividualFilters
            ? "max-h-[220px] opacity-100"
            : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label>Session</Label>
            <Select
              value={individualReportSessionId}
              onValueChange={setIndividualReportSessionId}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {academicSessions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <StudentAttendanceTab
        studentSearchQuery={individualStudentSearchQuery}
        setStudentSearchQuery={setIndividualStudentSearchQuery}
        searchResults={individualSearchResults}
        isSearching={isIndividualSearching}
        selectedStudent={selectedIndividualStudent}
        handleStudentSearch={handleIndividualStudentSearch}
        handleSelectStudent={handleSelectIndividualStudent}
        startDate={individualStartDate}
        setStartDate={setIndividualStartDate}
        endDate={individualEndDate}
        setEndDate={setIndividualEndDate}
        reportData={individualReportData}
        generateReport={handleGenerateIndividualReport}
        isFetchingReport={isFetchingIndividualReport}
        showFilters={showIndividualFilters}
      />
    </div>
  );
}
