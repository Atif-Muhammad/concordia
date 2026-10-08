import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StudentAttendanceTab } from "../StudentAttendanceTab";
import {
  getAcademicSessions,
  getAttendanceReport,
  searchStudents,
} from "../../../config/apis";

export default function IndividualReportsTab() {
  const { toast } = useToast();

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
      selectedIndividualStudent?._id || selectedIndividualStudent?.id,
      individualReportSessionId,
    ],
    queryFn: async () => {
      if (!selectedIndividualStudent) return [];
      const studentId = selectedIndividualStudent._id || selectedIndividualStudent.id;
      const classParam =
        selectedIndividualStudent.classId?._id ||
        selectedIndividualStudent.class?.id ||
        selectedIndividualStudent.classId ||
        "";
      const sectionParam =
        selectedIndividualStudent.sectionId?._id ||
        selectedIndividualStudent.section?.id ||
        selectedIndividualStudent.sectionId ||
        "";
      const sessionParam =
        individualReportSessionId === "all" ? undefined : individualReportSessionId;
      const programParam =
        selectedIndividualStudent.programId?._id ||
        selectedIndividualStudent.program?.id ||
        selectedIndividualStudent.programId ||
        "";
      const allData = await getAttendanceReport(
        individualStartDate,
        individualEndDate,
        classParam,
        sectionParam,
        sessionParam,
        programParam,
        studentId
      );
      return allData || [];
    },
    enabled: false,
  });

  const handleIndividualStudentSearch = async (query) => {
    setIndividualStudentSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setIndividualSearchResults([]);
      return;
    }
    setIsIndividualSearching(true);
    try {
      const results = await searchStudents(query.trim());
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
      `${student.rollNumber || ''} - ${student.fName || ''} ${student.lName || ''}`.trim()
    );
    setIndividualSearchResults([]);
  };

  const handleClearIndividualStudent = () => {
    setSelectedIndividualStudent(null);
    setIndividualStudentSearchQuery("");
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
      <StudentAttendanceTab
        studentSearchQuery={individualStudentSearchQuery}
        setStudentSearchQuery={setIndividualStudentSearchQuery}
        searchResults={individualSearchResults}
        isSearching={isIndividualSearching}
        selectedStudent={selectedIndividualStudent}
        handleStudentSearch={handleIndividualStudentSearch}
        handleSelectStudent={handleSelectIndividualStudent}
        handleClearStudent={handleClearIndividualStudent}
        startDate={individualStartDate}
        setStartDate={setIndividualStartDate}
        endDate={individualEndDate}
        setEndDate={setIndividualEndDate}
        reportData={individualReportData}
        generateReport={handleGenerateIndividualReport}
        isFetchingReport={isFetchingIndividualReport}
        showFilters={true}
        sessionId={individualReportSessionId}
        setSessionId={setIndividualReportSessionId}
        academicSessions={academicSessions}
      />
    </div>
  );
}
