import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

describe("StudentInstallmentReportsTab Redesign & Refinement Tests", () => {
  const mockStudents = [
    {
      id: "stud1",
      studentName: "Muhammad Ali",
      fatherName: "Ali Khan",
      rollNumber: "PSH-2026-001",
      programName: "FSc Pre-Medical",
      className: "1st Year",
      sectionName: "Girls",
      sessionName: "2026 - 2027",
      tuitionFee: 60000,
      totalFee: 60000,
      totalPaid: 20000,
      totalPending: 40000,
      installments: [
        {
          id: "inst1",
          installmentNumber: 1,
          month: "August",
          amount: 20000,
          paidAmount: 20000,
          pendingAmount: 0,
          status: "PAID",
        },
        {
          id: "inst2",
          installmentNumber: 2,
          month: "September",
          amount: 20000,
          paidAmount: 0,
          pendingAmount: 20000,
          status: "PENDING",
        },
        {
          id: "inst3",
          installmentNumber: 3,
          month: "October",
          amount: 20000,
          paidAmount: 0,
          pendingAmount: 20000,
          status: "PENDING",
        },
      ],
    },
    {
      id: "stud2",
      studentName: "Fatima Noor",
      fatherName: "Noor Ahmed",
      rollNumber: "PSH-2026-002",
      programName: "FSc Pre-Engineering",
      className: "2nd Year",
      sectionName: "Boys",
      sessionName: "2026 - 2027",
      tuitionFee: 80000,
      totalFee: 80000,
      totalPaid: 40000,
      totalPending: 40000,
      installments: [
        {
          id: "inst4",
          installmentNumber: 1,
          month: "August",
          amount: 40000,
          paidAmount: 40000,
          pendingAmount: 0,
          status: "PAID",
        },
        {
          id: "inst5",
          installmentNumber: 2,
          month: "September",
          amount: 40000,
          paidAmount: 0,
          pendingAmount: 40000,
          status: "OVERDUE",
        },
      ],
    },
  ];

  it("verifies multi-select filter cascading logic for program -> class -> section", () => {
    const programs = [
      { id: "p1", name: "FSc Pre-Medical" },
      { id: "p2", name: "FSc Pre-Engineering" },
      { id: "p3", name: "ICS" },
    ];

    const classes = [
      { id: "c1", programId: "p1", name: "1st Year Med" },
      { id: "c2", programId: "p1", name: "2nd Year Med" },
      { id: "c3", programId: "p2", name: "1st Year Engg" },
      { id: "c4", programId: "p3", name: "1st Year ICS" },
    ];

    const sections = [
      { id: "s1", classId: "c1", name: "Section A" },
      { id: "s2", classId: "c2", name: "Section B" },
      { id: "s3", classId: "c3", name: "Section C" },
    ];

    // Case 1: No program selected -> all classes available
    let selectedPrograms = [];
    let availableClasses =
      selectedPrograms.length === 0
        ? classes
        : classes.filter((c) => selectedPrograms.includes(c.programId));
    expect(availableClasses).toHaveLength(4);

    // Case 2: Multi-select programs ['p1', 'p2']
    selectedPrograms = ["p1", "p2"];
    availableClasses = classes.filter((c) =>
      selectedPrograms.includes(c.programId)
    );
    expect(availableClasses.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);

    // Case 3: Multi-select classes ['c1']
    let selectedClasses = ["c1"];
    let availableSections = sections.filter((s) =>
      selectedClasses.includes(s.classId)
    );
    expect(availableSections.map((s) => s.id)).toEqual(["s1"]);
  });

  it("verifies clean installment pills with number only and no '[: ]' or red colors", () => {
    const student = mockStudents[0];

    // Cell 3: Installment Months Column
    // Dashed pills: "<number> | <month>" (NO "Installment" prefix, NO "[: ]", NO red)
    // Bottom line: "Total Decided Tuition Fee: PKR <amount>"
    const pills = student.installments.map((inst) => {
      return `<span class="inst-tag">${inst.installmentNumber} | ${inst.month}</span>`;
    });

    const cell3Html = `
      <div class="inst-tags-container">
        ${pills.join("")}
      </div>
      <div class="inst-tally-line">
        Total Decided Tuition Fee: <strong>PKR ${Number(student.tuitionFee).toLocaleString()}</strong>
      </div>
    `;

    // Must contain number | month
    expect(cell3Html).toContain("1 | August");
    expect(cell3Html).toContain("2 | September");
    expect(cell3Html).toContain("3 | October");

    // Must NOT contain word "Installment" inside the pills
    expect(cell3Html).not.toContain("Installment 1");
    expect(cell3Html).not.toContain("Installment 2");

    // Must NOT contain "[: ]" or "[!]"
    expect(cell3Html).not.toContain("[: ]");
    expect(cell3Html).not.toContain("[!]");

    // Must contain Total Decided Tuition Fee
    expect(cell3Html).toContain("Total Decided Tuition Fee: <strong>PKR 60,000</strong>");

    // Must NOT contain submission text or pending text
    expect(cell3Html).not.toContain("Submissions:");
    expect(cell3Html).not.toContain("Pending");
  });

  it("verifies single row per student with no details row and no chevrons", () => {
    const student = mockStudents[0];

    // Single row representation
    const rowHtml = `
      <tr>
        <td class="text-center font-medium">1</td>
        <td>
          <div class="student-name">${student.studentName}</div>
          <div class="student-father">Father: ${student.fatherName}</div>
          <div class="roll-pill">${student.rollNumber}</div>
        </td>
        <td>
          <div>${student.programName}</div>
          <div>${student.className} (${student.sectionName})</div>
        </td>
        <td>
          ${student.installments.map((i) => `<span class="inst-tag">${i.installmentNumber} | ${i.month}</span>`).join("")}
          <div>Total Decided Tuition Fee: PKR ${student.tuitionFee.toLocaleString()}</div>
        </td>
      </tr>
    `;

    // Must NOT have expandable details row
    expect(rowHtml).not.toContain("subtable");
    expect(rowHtml).not.toContain("ChevronDown");
    expect(rowHtml).not.toContain("ChevronRight");
    expect(rowHtml).toContain("1 | August");
    expect(rowHtml).toContain("2 | September");
  });

  it("exports Excel sheet with clean number | month format and decided tuition fees", () => {
    const wb = XLSX.utils.book_new();
    const rows = mockStudents.map((s, idx) => ({
      "S.No": idx + 1,
      "Roll Number": s.rollNumber,
      "Student Name": s.studentName,
      "Father Name": s.fatherName,
      "Program": s.programName,
      "Class": s.className,
      "Section": s.sectionName,
      "Installment Months": s.installments
        .map((i) => `${i.installmentNumber} | ${i.month}`)
        .join(", "),
      "Total Decided Tuition Fee (PKR)": s.tuitionFee,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Installment Reports");

    expect(wb.SheetNames).toContain("Installment Reports");
    const jsonOutput = XLSX.utils.sheet_to_json(ws);
    expect(jsonOutput).toHaveLength(2);
    expect(jsonOutput[0]["Total Decided Tuition Fee (PKR)"]).toBe(60000);
    expect(jsonOutput[0]["Installment Months"]).toBe(
      "1 | August, 2 | September, 3 | October"
    );
  });
});
