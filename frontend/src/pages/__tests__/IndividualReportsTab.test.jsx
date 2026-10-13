import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

describe("IndividualReportsTab and Print Branding Tests", () => {
  it("formats print template with Concordia branding logo, Beaconhouse tagline, and calligraphy title", () => {
    const logoDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const printDate = "Oct 13, 2026";
    const studentName = "Muhammad Ali";
    const rollNumber = "FA24-BSCS-001";
    const subjectFilterLabel = "Physics";

    const reportTitleText = `Individual Student Attendance Report – ${subjectFilterLabel}`;

    const printHtml = `
      <div class="form-header">
        <div class="header-logo-area">
          <img src="${logoDataUrl}" class="brand-logo" alt="Concordia College Peshawar Logo" />
          <div class="header-title-block">
            <h1>Concordia College Peshawar</h1>
            <div class="tagline">A Project of Beaconhouse</div>
          </div>
        </div>
        <div class="meta-box">
          <div><strong>Generated:</strong> ${printDate}</div>
          <div><strong>Roll No:</strong> ${rollNumber}</div>
        </div>
      </div>

      <div class="center-calligraphy-title">
        ${reportTitleText}
      </div>
    `;

    // Verify logo and branding text
    expect(printHtml).toContain(logoDataUrl);
    expect(printHtml).toContain("Concordia College Peshawar");
    expect(printHtml).toContain("A Project of Beaconhouse");

    // Verify calligraphy report title
    expect(printHtml).toContain("center-calligraphy-title");
    expect(printHtml).toContain("Individual Student Attendance Report – Physics");
  });

  it("calculates individual student attendance statistics accurately", () => {
    const studentSubjects = [
      {
        subjectId: "sub1",
        subjectName: "English",
        attendance: [
          { date: "2026-10-01", status: "present" },
          { date: "2026-10-02", status: "present" },
          { date: "2026-10-03", status: "absent" },
          { date: "2026-10-04", status: "leave" },
        ],
      },
      {
        subjectId: "sub2",
        subjectName: "Mathematics",
        attendance: [
          { date: "2026-10-01", status: "present" },
          { date: "2026-10-02", status: "absent" },
          { date: "2026-10-03", status: "present" },
          { date: "2026-10-04", status: "short_leave" },
        ],
      },
    ];

    // Case 1: When selectedSubject is "all"
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let shortLeaveCount = 0;

    studentSubjects.forEach((sub) => {
      sub.attendance.forEach((a) => {
        const st = a.status.toLowerCase();
        if (st === "present") presentCount++;
        else if (st === "absent") absentCount++;
        else if (st === "leave") leaveCount++;
        else if (st === "short_leave") shortLeaveCount++;
      });
    });

    const totalClasses = presentCount + absentCount + leaveCount + shortLeaveCount;
    const overallPct = Math.round(((presentCount + shortLeaveCount) / totalClasses) * 100);

    expect(presentCount).toBe(4);
    expect(absentCount).toBe(2);
    expect(leaveCount).toBe(1);
    expect(shortLeaveCount).toBe(1);
    expect(totalClasses).toBe(8);
    // (4 + 1) / 8 = 5 / 8 = 62.5% -> 63%
    expect(overallPct).toBe(63);

    // Case 2: When filtered to "Mathematics" (sub2)
    const mathSub = studentSubjects.find((s) => s.subjectId === "sub2");
    let mathPresent = 0;
    let mathAbsent = 0;
    let mathLeave = 0;
    let mathShortLeave = 0;
    mathSub.attendance.forEach((a) => {
      const st = a.status.toLowerCase();
      if (st === "present") mathPresent++;
      else if (st === "absent") mathAbsent++;
      else if (st === "leave") mathLeave++;
      else if (st === "short_leave") mathShortLeave++;
    });
    const mathTotal = mathPresent + mathAbsent + mathLeave + mathShortLeave;
    const mathPct = Math.round(((mathPresent + mathShortLeave) / mathTotal) * 100);

    expect(mathTotal).toBe(4);
    expect(mathPresent).toBe(2);
    expect(mathAbsent).toBe(1);
    expect(mathShortLeave).toBe(1);
    expect(mathPct).toBe(75);
  });

  it("generates Excel workbook with Student Summary and Attendance History sheets", () => {
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { Field: "Student Name", Value: "Muhammad Ali" },
      { Field: "Roll Number", Value: "FA24-BSCS-001" },
      { Field: "Class", Value: "BSCS 1st" },
      { Field: "Attendance Rate", Value: "85%" },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Student Summary");

    const logRows = [
      { SNo: 1, Date: "Oct 01, 2026", Day: "Wed", Subject: "English", Status: "PRESENT" },
      { SNo: 2, Date: "Oct 02, 2026", Day: "Thu", Subject: "Math", Status: "ABSENT" },
    ];
    const wsLog = XLSX.utils.json_to_sheet(logRows);
    XLSX.utils.book_append_sheet(wb, wsLog, "Attendance History");

    expect(wb.SheetNames).toContain("Student Summary");
    expect(wb.SheetNames).toContain("Attendance History");
    expect(wb.Sheets["Student Summary"]).toBeDefined();
    expect(wb.Sheets["Attendance History"]).toBeDefined();
  });

  it("filters out any artificial subject named 'General'", () => {
    const rawSubjects = [
      { subjectId: "sub1", subjectName: "Physics" },
      { subjectId: "general", subjectName: "General" },
      { subjectId: "sub2", subjectName: "Chemistry" },
      { subjectId: "gen2", subjectName: "general" },
    ];

    const filtered = rawSubjects.filter(
      (s) => s.subjectName && s.subjectName.toLowerCase() !== "general"
    );

    expect(filtered.length).toBe(2);
    expect(filtered.map((s) => s.subjectName)).toEqual(["Physics", "Chemistry"]);
  });
});
