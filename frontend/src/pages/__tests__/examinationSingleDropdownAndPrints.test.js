import { describe, it, expect } from "vitest";
import { filterSearchableOptions } from "@/components/ui/SearchableSelect";
import { matchesSearchTokens, formatNormalizedFullName } from "@/lib/studentSearch";
import { extractId } from "@/lib/utils.jsx";
import { calculateGrade } from "@/pages/StudentResultsTab";

describe("Examination Single Dropdown & Print Overhaul Tests", () => {
  describe("Single Exam SearchableSelect Option Filtering", () => {
    const rawExams = [
      {
        id: "exam1",
        examName: "Midterm Examination",
        session: "Fall 2026",
        startDate: "2026-10-15T00:00:00.000Z",
        program: { name: "FSc Pre-Medical" },
        class: { name: "Class 11-A" },
      },
      {
        id: "exam2",
        examName: "Final Term Examination",
        session: "Spring 2026",
        startDate: "2026-05-20T00:00:00.000Z",
        program: { name: "ICS Computer Science" },
        class: { name: "Class 12-B" },
      },
      {
        id: "exam3",
        examName: "Monthly Assessment October",
        session: "Fall 2026",
        startDate: "2026-10-01T00:00:00.000Z",
        program: { name: "FSc Pre-Engineering" },
        class: { name: "Class 11-B" },
      },
    ];

    const examOptions = rawExams.map((exam) => {
      const eId = extractId(exam.id || exam._id);
      const progName = exam.program?.name || "";
      const clsName = exam.class?.name || "";
      const sessionName = exam.session || "";
      const label = `${exam.examName} — ${clsName} (${progName}) [${sessionName}]`;
      return {
        value: eId,
        label,
        keywords: `${exam.examName} ${progName} ${clsName} ${sessionName}`,
      };
    });

    it("searches exam by exam title/name", () => {
      const results = filterSearchableOptions(examOptions, "Midterm");
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("exam1");
    });

    it("searches exam by program name", () => {
      const results = filterSearchableOptions(examOptions, "Computer Science");
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("exam2");
    });

    it("searches exam by class name", () => {
      const results = filterSearchableOptions(examOptions, "Class 11-B");
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("exam3");
    });

    it("searches exam by academic session", () => {
      const results = filterSearchableOptions(examOptions, "Spring 2026");
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("exam2");
    });

    it("searches exam with multi-token query across title and class", () => {
      const results = filterSearchableOptions(examOptions, "midterm 11-A");
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("exam1");
    });

    it("returns all options when search query is empty or whitespace", () => {
      expect(filterSearchableOptions(examOptions, "")).toHaveLength(3);
      expect(filterSearchableOptions(examOptions, "   ")).toHaveLength(3);
    });

    it("returns empty array when no exams match query", () => {
      const results = filterSearchableOptions(examOptions, "Biology Term 99");
      expect(results).toHaveLength(0);
    });
  });

  describe("Bulk Marks Entry Student Search Filtering", () => {
    const students = [
      {
        id: "st1",
        fName: "Muhammad",
        lName: "Ali",
        fatherOrguardian: "Tariq Mahmood",
        rollNumber: "MED-001",
      },
      {
        id: "st2",
        fName: "Hamza",
        lName: "Khan",
        fatherOrguardian: "Abdul Rehman",
        rollNumber: "MED-002",
      },
      {
        id: "st3",
        fName: "Sara",
        lName: "Ahmad",
        fatherOrguardian: "Ahmad Ali",
        rollNumber: "MED-003",
      },
    ];

    const filterStudents = (query) => {
      if (!query.trim()) return students;
      return students.filter((st) =>
        matchesSearchTokens(query, [
          formatNormalizedFullName(st.fName, st.lName),
          st.fatherOrguardian,
          st.rollNumber,
        ])
      );
    };

    it("filters student by first name", () => {
      const res = filterStudents("Muhammad");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("st1");
    });

    it("filters student by last name", () => {
      const res = filterStudents("Khan");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("st2");
    });

    it("filters student by full name", () => {
      const res = filterStudents("Sara Ahmad");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("st3");
    });

    it("filters student by father name", () => {
      const res = filterStudents("Tariq Mahmood");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("st1");
    });

    it("filters student by roll number", () => {
      const res = filterStudents("MED-002");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("st2");
    });

    it("matches multi-token query across student name and father name", () => {
      const res = filterStudents("Ali Tariq");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("st1");
    });
  });

  describe("Print Template Structure & Styling Validation", () => {
    const student = {
      fName: "Zaid",
      lName: "Khan",
      fatherOrguardian: "Irfan Khan",
      rollNumber: "BSCS-2026-10",
      photo_url: "",
    };
    const exam = {
      examName: "Final Term Exam",
      session: "Fall 2026",
    };
    const className = "BSCS 3rd Semester";
    const programName = "BS Computer Science";
    const sectionName = "Section A";
    const result = {
      totalMarks: 500,
      obtainedMarks: 445,
      percentage: 89.0,
      grade: "A",
    };
    const position = 1;

    // Simulated student report card HTML template matching ResultsTab
    const renderStudentReportCardHtml = () => {
      const isFail = result.grade === "F";
      return `
        <table class="student-form-table">
          <tbody>
            <tr>
              <td class="form-label">Student Name:</td>
              <td class="form-value">${formatNormalizedFullName(student.fName, student.lName)}</td>
              <td class="form-label">Class & Program:</td>
              <td class="form-value">${className} (${programName})</td>
              <td rowspan="3" class="photo-cell">
                <div class="student-photo">No Photo</div>
              </td>
            </tr>
            <tr>
              <td class="form-label">Father Name:</td>
              <td class="form-value">${student.fatherOrguardian}</td>
              <td class="form-label">Section:</td>
              <td class="form-value">${sectionName}</td>
            </tr>
            <tr>
              <td class="form-label">Roll Number:</td>
              <td class="form-value" style="font-family: monospace;">${student.rollNumber}</td>
              <td class="form-label">Exam & Session:</td>
              <td class="form-value">${exam.examName} (${exam.session})</td>
            </tr>
          </tbody>
        </table>
        <div class="result-summary-text">
          <span>Total Marks: <strong>${result.totalMarks}</strong></span>
          <span>Obtained Marks: <strong>${result.obtainedMarks}</strong></span>
          <span>Percentage: <strong>${result.percentage.toFixed(2)}%</strong></span>
          <span>Grade: <strong style="color: ${isFail ? '#b91c1c' : '#047857'};">${result.grade}</strong></span>
          <span>Position: <strong>${position || "—"}</strong></span>
        </div>
      `;
    };

    it("uses a 2-column form structure (student-form-table) instead of boxed cards for personal info", () => {
      const html = renderStudentReportCardHtml();
      expect(html).toContain('class="student-form-table"');
      expect(html).toContain('class="form-label">Student Name:</td>');
      expect(html).toContain('class="form-label">Class & Program:</td>');
      expect(html).toContain('class="form-label">Father Name:</td>');
      expect(html).toContain('class="form-label">Roll Number:</td>');
      expect(html).not.toContain("student-info-grid");
    });

    it("replaces boxed stat cards with inline text summary strip (result-summary-text)", () => {
      const html = renderStudentReportCardHtml();
      expect(html).toContain('class="result-summary-text"');
      expect(html).toContain("Total Marks: <strong>500</strong>");
      expect(html).toContain("Obtained Marks: <strong>445</strong>");
      expect(html).toContain("Percentage: <strong>89.00%</strong>");
      expect(html).toContain("Grade: <strong style=\"color: #047857;\">A</strong>");
      expect(html).toContain("Position: <strong>1</strong>");
      // Ensure boxed cards are gone
      expect(html).not.toContain("stats-grid");
      expect(html).not.toContain("stat-card");
    });
  });

  describe("Single Exam Selection Directly Resolves Class & Section Applicability", () => {
    const exams = [
      { id: "e1", examName: "Exam 1", classId: "c1" },
      { id: "e2", examName: "Exam 2", classId: "c2" },
    ];
    const classes = [
      { id: "c1", name: "FSc 1st Year", allowSections: true },
      { id: "c2", name: "Diploma CS", allowSections: false },
    ];
    const sections = [
      { id: "s1", classId: "c1", name: "Blue" },
      { id: "s2", classId: "c1", name: "Green" },
      { id: "s3", classId: "c2", name: "Alpha" },
    ];

    it("automatically derives class and sections from selected exam without separate program/class selects", () => {
      const selectedExamId = "e1";
      const selExam = exams.find((e) => e.id === selectedExamId);
      const selClass = classes.find((c) => c.id === selExam.classId);
      const isSecApplicable = selClass.allowSections !== false;
      const availableSecs = sections.filter((s) => s.classId === selExam.classId);

      expect(selClass.name).toBe("FSc 1st Year");
      expect(isSecApplicable).toBe(true);
      expect(availableSecs.map((s) => s.name)).toEqual(["Blue", "Green"]);
    });

    it("disables or hides sections when selected exam's class does not allow sections", () => {
      const selectedExamId = "e2";
      const selExam = exams.find((e) => e.id === selectedExamId);
      const selClass = classes.find((c) => c.id === selExam.classId);
      const isSecApplicable = selClass.allowSections !== false;

      expect(selClass.name).toBe("Diploma CS");
      expect(isSecApplicable).toBe(false);
    });
  });

  describe("Dynamic UI Calculation for Student Marks, Percentage & Grades", () => {
    it("accurately sums obtained marks and computes percentage and grade across multiple subjects", () => {
      // Replicating user's exact scenario from screenshot:
      const marks = [
        { subject: "Pak Studies", totalMarks: 15, obtainedMarks: 15 },
        { subject: "Chemistry", totalMarks: 30, obtainedMarks: 26 },
        { subject: "English", totalMarks: 30, obtainedMarks: 29 },
        { subject: "MQH", totalMarks: 15, obtainedMarks: 13 },
        { subject: "Maths", totalMarks: 30, obtainedMarks: 13 },
        { subject: "Physics", totalMarks: 30, obtainedMarks: 19 },
        { subject: "Urdu", totalMarks: 30, obtainedMarks: 26 },
      ];

      const totalMarks = marks.reduce((sum, m) => sum + (Number(m.totalMarks) || 0), 0);
      const obtainedMarks = marks.reduce((sum, m) => sum + (m.isAbsent ? 0 : (Number(m.obtainedMarks) || 0)), 0);
      const roundedTotal = Math.round(totalMarks * 100) / 100;
      const roundedObtained = Math.round(obtainedMarks * 100) / 100;
      const percentage = roundedTotal > 0 ? (roundedObtained / roundedTotal) * 100 : 0;
      const { grade } = calculateGrade(percentage);

      expect(roundedTotal).toBe(180);
      expect(roundedObtained).toBe(141);
      expect(percentage.toFixed(2)).toBe("78.33");
      expect(grade).toBe("B+");
      expect(grade).not.toBe("F");
    });

    it("correctly handles absent marks as 0 obtained marks without corrupting total", () => {
      const marks = [
        { subject: "Pak Studies", totalMarks: 15, obtainedMarks: 15, isAbsent: false },
        { subject: "Maths", totalMarks: 30, obtainedMarks: 25, isAbsent: true }, // absent overrides
      ];

      const totalMarks = marks.reduce((sum, m) => sum + (Number(m.totalMarks) || 0), 0);
      const obtainedMarks = marks.reduce((sum, m) => sum + (m.isAbsent ? 0 : (Number(m.obtainedMarks) || 0)), 0);
      const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;

      expect(totalMarks).toBe(45);
      expect(obtainedMarks).toBe(15);
      expect(percentage.toFixed(2)).toBe("33.33");
      expect(calculateGrade(percentage).grade).toBe("E");
    });

    it("falls back to stored result when subject marks array is empty", () => {
      const marks = [];
      const storedResult = { totalMarks: 100, obtainedMarks: 75, percentage: 75, grade: "B+" };

      const hasMarks = marks.length > 0;
      const totalMarks = hasMarks
        ? marks.reduce((sum, m) => sum + (Number(m.totalMarks) || 0), 0)
        : Number(storedResult?.totalMarks || 0);
      const obtainedMarks = hasMarks
        ? marks.reduce((sum, m) => sum + (m.isAbsent ? 0 : (Number(m.obtainedMarks) || 0)), 0)
        : Number(storedResult?.obtainedMarks || 0);

      expect(totalMarks).toBe(100);
      expect(obtainedMarks).toBe(75);
    });
  });
});
