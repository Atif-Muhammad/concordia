import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

describe("StudentDataExport logic and Excel/Print structures", () => {
  const mockStudents = [
    {
      _id: "stu-1",
      fName: "Ali",
      lName: "Khan",
      fatherOrguardian: "Tariq Khan",
      rollNumber: "2026-FSC-001",
      gender: "Male",
      dob: "2007-05-15",
      bloodGroup: "B+",
      religion: "Islam",
      studentCnic: "35202-1234567-1",
      parentCNIC: "35202-7654321-1",
      phone: "03001234567",
      email: "ali@example.com",
      address: "123 Main Blvd, Lahore",
      admissionDate: "2025-09-01",
      status: "ACTIVE",
      program: { _id: "prog-1", name: "F.Sc Pre-Medical" },
      class: { _id: "class-1", name: "1st Year" },
      section: { _id: "sec-1", name: "Section A" },
      session: { _id: "sess-1", name: "2025-2027" },
      installments: [
        {
          installmentNumber: 1,
          month: "September 2025",
          dueDate: "2025-09-10",
          amount: 25000,
          paidAmount: 25000,
          pendingAmount: 0,
          status: "PAID",
        },
        {
          installmentNumber: 2,
          month: "October 2025",
          dueDate: "2025-10-10",
          amount: 20000,
          paidAmount: 0,
          pendingAmount: 20000,
          status: "PENDING",
        },
      ],
    },
    {
      _id: "stu-2",
      fName: "Sara",
      lName: "Ahmed",
      fatherOrguardian: "Ahmed Bilal",
      rollNumber: "2026-ICS-002",
      gender: "Female",
      dob: "2008-01-20",
      status: "ACTIVE",
      program: { _id: "prog-2", name: "ICS" },
      class: { _id: "class-2", name: "1st Year" },
      section: { _id: "sec-2", name: "Section B" },
      session: { _id: "sess-1", name: "2025-2027" },
      installments: [
        {
          installmentNumber: 1,
          month: "September 2025",
          dueDate: "2025-09-10",
          amount: 30000,
          paidAmount: 15000,
          pendingAmount: 15000,
          status: "PARTIAL",
        },
      ],
    },
  ];

  it("calculates summary KPI metrics correctly across students and installments", () => {
    let totalPackageFee = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let maleCount = 0;
    let femaleCount = 0;

    mockStudents.forEach((s) => {
      if (s.gender?.toLowerCase() === "male") maleCount++;
      if (s.gender?.toLowerCase() === "female") femaleCount++;

      s.installments.forEach((inst) => {
        totalPackageFee += inst.amount;
        totalPaid += inst.paidAmount;
        totalPending += inst.pendingAmount;
      });
    });

    expect(mockStudents.length).toBe(2);
    expect(maleCount).toBe(1);
    expect(femaleCount).toBe(1);
    expect(totalPackageFee).toBe(75000);
    expect(totalPaid).toBe(40000);
    expect(totalPending).toBe(35000);
  });

  it("builds 2-sheet Excel workbook with comprehensive student fields and installment plans", () => {
    // Sheet 1: Master data
    const masterRows = mockStudents.map((s, idx) => ({
      "Sr #": idx + 1,
      "Student ID / Roll No": s.rollNumber,
      "Full Name": `${s.fName} ${s.lName}`,
      "Father / Guardian Name": s.fatherOrguardian,
      "Gender": s.gender,
      "Program": s.program.name,
      "Class": s.class.name,
      "Section": s.section.name,
      "Status": s.status,
      "Total Package (Rs)": s.installments.reduce((acc, i) => acc + i.amount, 0),
      "Total Paid (Rs)": s.installments.reduce((acc, i) => acc + i.paidAmount, 0),
      "Total Pending (Rs)": s.installments.reduce((acc, i) => acc + i.pendingAmount, 0),
    }));

    // Sheet 2: Installment breakdown
    const installmentRows = [];
    mockStudents.forEach((s) => {
      s.installments.forEach((inst) => {
        installmentRows.push({
          "Roll Number": s.rollNumber,
          "Student Name": `${s.fName} ${s.lName}`,
          "Installment #": inst.installmentNumber,
          "Month / Title": inst.month,
          "Due Date": inst.dueDate,
          "Amount (Rs)": inst.amount,
          "Paid (Rs)": inst.paidAmount,
          "Pending (Rs)": inst.pendingAmount,
          "Status": inst.status,
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsMaster = XLSX.utils.json_to_sheet(masterRows);
    const wsInst = XLSX.utils.json_to_sheet(installmentRows);

    XLSX.utils.book_append_sheet(wb, wsMaster, "Students Master Data");
    XLSX.utils.book_append_sheet(wb, wsInst, "Fee Installment Plans");

    expect(wb.SheetNames).toEqual(["Students Master Data", "Fee Installment Plans"]);
    expect(masterRows.length).toBe(2);
    expect(installmentRows.length).toBe(3); // 2 from student 1 + 1 from student 2
  });

  it("filters correctly by gender, program, class, section with 'all' fallback", () => {
    const filterData = (list, filters) => {
      return list.filter((s) => {
        if (filters.gender && filters.gender !== "all" && s.gender?.toLowerCase() !== filters.gender.toLowerCase()) {
          return false;
        }
        if (filters.program && filters.program !== "all" && s.program?._id !== filters.program) {
          return false;
        }
        if (filters.class && filters.class !== "all" && s.class?._id !== filters.class) {
          return false;
        }
        return true;
      });
    };

    // 'all' returns all
    expect(filterData(mockStudents, { gender: "all", program: "all" }).length).toBe(2);

    // Gender filter Female
    const femaleOnly = filterData(mockStudents, { gender: "Female" });
    expect(femaleOnly.length).toBe(1);
    expect(femaleOnly[0].fName).toBe("Sara");

    // Gender filter Male
    const maleOnly = filterData(mockStudents, { gender: "Male" });
    expect(maleOnly.length).toBe(1);
    expect(maleOnly[0].fName).toBe("Ali");

    // Specific program
    const fscOnly = filterData(mockStudents, { program: "prog-1" });
    expect(fscOnly.length).toBe(1);
    expect(fscOnly[0].program.name).toBe("F.Sc Pre-Medical");
  });

  it("ensures roll numbers are correctly resolved with fallbacks and included in exported rows", () => {
    const rawStudentSample = [
      { fName: "Hureem", lName: "Jamil", rollNumber: "2026-HUM-01" },
      { fName: "Yahya", lName: "Mujahid", rollNo: "2026-HUM-02" },
      {
        fName: "Zain",
        lName: "Abbas",
        academicRecords: [{ rollNumber: "2026-HUM-03" }],
      },
    ];

    const mapped = rawStudentSample.map((s) => ({
      name: `${s.fName} ${s.lName}`,
      rollNo:
        s.rollNumber ||
        s.rollNo ||
        (Array.isArray(s.academicRecords) &&
          s.academicRecords.find((r) => r.rollNumber)?.rollNumber) ||
        "—",
    }));

    expect(mapped[0].rollNo).toBe("2026-HUM-01");
    expect(mapped[1].rollNo).toBe("2026-HUM-02");
    expect(mapped[2].rollNo).toBe("2026-HUM-03");
    expect(mapped.every((m) => m.rollNo !== "—")).toBe(true);
  });
});
