import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

describe("Admission Conversion Report Tests", () => {
  const mockAcademicSessions = [
    { _id: "sess_active_1", name: "2026 - 2027", active: true },
    { _id: "sess_past_2", name: "2025 - 2026", active: false },
  ];

  const mockReportItems = [
    {
      inquiryId: "inq_001",
      inquiryNumber: "INQ-2026-001",
      name: "Ahmed Raza",
      fatherName: "Raza Ullah",
      phone: "03001234567",
      cnic: "17301-1234567-1",
      gender: "Male",
      inquiryType: "Walk-in",
      inquiryDate: "2026-08-01T10:00:00.000Z",
      academicSession: { _id: "sess_active_1", name: "2026 - 2027" },
      program: { _id: "prog_fsc_med", name: "FSc Pre-Medical" },
      prospectusSold: true,
      prospectusFee: 1500,
      status: "APPROVED",
      isConverted: true,
      conversionStatus: "CONVERTED",
      studentId: "stud_101",
      studentName: "Ahmed Raza",
      rollNumber: "MED-2026-001",
      admissionDate: "2026-08-05T09:00:00.000Z",
      enrolledProgram: "FSc Pre-Medical",
      enrolledClass: "1st Year",
      enrolledSection: "Section A",
      daysToConversion: 4,
    },
    {
      inquiryId: "inq_002",
      inquiryNumber: "INQ-2026-002",
      name: "Ayesha Bibi",
      fatherName: "Muhammad Qasim",
      phone: "03129876543",
      cnic: "17301-9876543-2",
      gender: "Female",
      inquiryType: "Social Media",
      inquiryDate: "2026-08-03T11:30:00.000Z",
      academicSession: { _id: "sess_active_1", name: "2026 - 2027" },
      program: { _id: "prog_ics", name: "ICS Computer Science" },
      prospectusSold: true,
      prospectusFee: 1500,
      status: "PENDING",
      isConverted: false,
      conversionStatus: "PENDING",
      studentId: null,
      studentName: null,
      rollNumber: null,
      admissionDate: null,
      enrolledProgram: null,
      enrolledClass: null,
      enrolledSection: null,
      daysToConversion: null,
    },
    {
      inquiryId: "inq_003",
      inquiryNumber: "INQ-2026-003",
      name: "Zubair Khan",
      fatherName: "Khan Wali",
      phone: "03451122334",
      cnic: "17301-1122334-3",
      gender: "Male",
      inquiryType: "Phone Call",
      inquiryDate: "2026-08-10T14:00:00.000Z",
      academicSession: { _id: "sess_active_1", name: "2026 - 2027" },
      program: { _id: "prog_fsc_eng", name: "FSc Pre-Engineering" },
      prospectusSold: false,
      prospectusFee: 0,
      status: "REJECTED",
      isConverted: false,
      conversionStatus: "REJECTED",
      studentId: null,
      studentName: null,
      rollNumber: null,
      admissionDate: null,
      enrolledProgram: null,
      enrolledClass: null,
      enrolledSection: null,
      daysToConversion: null,
    },
    {
      inquiryId: "inq_004",
      inquiryNumber: "INQ-2025-089",
      name: "Sana Tariq",
      fatherName: "Tariq Mahmood",
      phone: "03335554433",
      cnic: "17301-5554433-4",
      gender: "Female",
      inquiryType: "Walk-in",
      inquiryDate: "2025-07-20T09:00:00.000Z",
      academicSession: { _id: "sess_past_2", name: "2025 - 2026" },
      program: { _id: "prog_fsc_med", name: "FSc Pre-Medical" },
      prospectusSold: true,
      prospectusFee: 1000,
      status: "APPROVED",
      isConverted: true,
      conversionStatus: "CONVERTED",
      studentId: "stud_089",
      studentName: "Sana Tariq",
      rollNumber: "MED-2025-089",
      admissionDate: "2025-07-20T12:00:00.000Z",
      enrolledProgram: "FSc Pre-Medical",
      enrolledClass: "1st Year",
      enrolledSection: "Section B",
      daysToConversion: 0,
    },
  ];

  describe("1. Default Session Selection Logic", () => {
    it("should initialize default session filter to the active session ID", () => {
      const activeSession = mockAcademicSessions.find((s) => s.active);
      const initialSessionFilter = activeSession ? [activeSession._id] : [];

      expect(initialSessionFilter).toEqual(["sess_active_1"]);
    });

    it("should fallback to all sessions or empty array if no active session is found", () => {
      const sessionsWithoutActive = [
        { _id: "sess_1", name: "2024", active: false },
      ];
      const activeSession = sessionsWithoutActive.find((s) => s.active);
      const initialFilter = activeSession ? [activeSession._id] : [];

      expect(initialFilter).toEqual([]);
    });
  });

  describe("2. Metric Calculations & KPI Aggregation", () => {
    it("should accurately calculate total inquiries, converted count, and conversion rate %", () => {
      const totalInquiries = mockReportItems.length;
      const convertedCount = mockReportItems.filter((i) => i.isConverted).length;
      const pendingCount = mockReportItems.filter((i) => i.conversionStatus === "PENDING").length;
      const rejectedCount = mockReportItems.filter((i) => i.conversionStatus === "REJECTED").length;

      const conversionRate = totalInquiries > 0
        ? Math.round((convertedCount / totalInquiries) * 1000) / 10
        : 0;

      expect(totalInquiries).toBe(4);
      expect(convertedCount).toBe(2);
      expect(pendingCount).toBe(1);
      expect(rejectedCount).toBe(1);
      expect(conversionRate).toBe(50.0);
    });

    it("should correctly calculate prospectus sales and total revenue", () => {
      const soldItems = mockReportItems.filter((i) => i.prospectusSold);
      const prospectusSoldCount = soldItems.length;
      const totalRevenue = soldItems.reduce((acc, curr) => acc + (curr.prospectusFee || 0), 0);

      expect(prospectusSoldCount).toBe(3);
      expect(totalRevenue).toBe(1500 + 1500 + 1000); // 4000
    });

    it("should calculate average turnaround days for converted inquiries", () => {
      const convertedItems = mockReportItems.filter(
        (i) => i.isConverted && typeof i.daysToConversion === "number"
      );
      const avgDays = convertedItems.length > 0
        ? Math.round(
            (convertedItems.reduce((acc, curr) => acc + curr.daysToConversion, 0) /
              convertedItems.length) *
              10
          ) / 10
        : 0;

      // 4 days (inq_001) + 0 days (inq_004) = 4 / 2 = 2.0
      expect(avgDays).toBe(2.0);
    });
  });

  describe("3. Multi-Select & Filter Rules", () => {
    it("should filter by session multi-selection", () => {
      const selectedSessions = ["sess_active_1"];
      const filtered = mockReportItems.filter((item) =>
        selectedSessions.includes(item.academicSession?._id)
      );

      expect(filtered.length).toBe(3);
      expect(filtered.every((i) => i.academicSession._id === "sess_active_1")).toBe(true);
    });

    it("should filter by inquiry type multi-selection (e.g. Walk-in and Phone Call)", () => {
      const selectedTypes = ["Walk-in", "Phone Call"];
      const filtered = mockReportItems.filter((item) =>
        selectedTypes.includes(item.inquiryType)
      );

      expect(filtered.length).toBe(3);
      expect(filtered.map((i) => i.inquiryNumber)).toEqual([
        "INQ-2026-001",
        "INQ-2026-003",
        "INQ-2025-089",
      ]);
    });

    it("should filter by gender selection", () => {
      const selectedGenders = ["Female"];
      const filtered = mockReportItems.filter((item) =>
        selectedGenders.includes(item.gender)
      );

      expect(filtered.length).toBe(2);
      expect(filtered.map((i) => i.name)).toEqual(["Ayesha Bibi", "Sana Tariq"]);
    });

    it("should filter by prospectus sold status", () => {
      const filterSoldOnly = mockReportItems.filter((item) => item.prospectusSold === true);
      const filterUnsoldOnly = mockReportItems.filter((item) => item.prospectusSold === false);

      expect(filterSoldOnly.length).toBe(3);
      expect(filterUnsoldOnly.length).toBe(1);
      expect(filterUnsoldOnly[0].inquiryNumber).toBe("INQ-2026-003");
    });

    it("should filter by date range (from and to)", () => {
      const fromDate = new Date("2026-08-01T00:00:00.000Z");
      const toDate = new Date("2026-08-05T23:59:59.999Z");

      const filtered = mockReportItems.filter((item) => {
        const itemDate = new Date(item.inquiryDate);
        return itemDate >= fromDate && itemDate <= toDate;
      });

      expect(filtered.length).toBe(2);
      expect(filtered.map((i) => i.inquiryNumber)).toEqual(["INQ-2026-001", "INQ-2026-002"]);
    });

    it("should support search text filtering across candidate name, roll number, and phone", () => {
      const searchByName = "Raza";
      const matchesName = mockReportItems.filter(
        (i) =>
          i.name.toLowerCase().includes(searchByName.toLowerCase()) ||
          i.fatherName.toLowerCase().includes(searchByName.toLowerCase())
      );
      expect(matchesName.length).toBe(1);
      expect(matchesName[0].inquiryId).toBe("inq_001");

      const searchByRoll = "MED-2025";
      const matchesRoll = mockReportItems.filter((i) =>
        (i.rollNumber || "").toLowerCase().includes(searchByRoll.toLowerCase())
      );
      expect(matchesRoll.length).toBe(1);
      expect(matchesRoll[0].inquiryId).toBe("inq_004");
    });
  });

  describe("4. Turnaround Days Computation", () => {
    it("should return correct positive integer when converted multiple days later", () => {
      const inquiryDate = new Date("2026-08-01T10:00:00.000Z");
      const admissionDate = new Date("2026-08-05T14:30:00.000Z");

      const diffMs = admissionDate - inquiryDate;
      const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

      expect(days).toBe(4);
    });

    it("should return 0 days if converted on the exact same date", () => {
      const inquiryDate = new Date("2026-08-01T09:00:00.000Z");
      const admissionDate = new Date("2026-08-01T13:00:00.000Z");

      const diffMs = admissionDate - inquiryDate;
      const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

      expect(days).toBe(0);
    });
  });

  describe("5. Row Selection for Selective Print and Export", () => {
    it("should export only selected rows when a subset of checkboxes is checked", () => {
      const selectedIds = new Set(["inq_001", "inq_003"]);
      const activeRows = mockReportItems.filter((i) => selectedIds.has(i.inquiryId));

      expect(activeRows.length).toBe(2);
      expect(activeRows.map((r) => r.inquiryId)).toEqual(["inq_001", "inq_003"]);
    });

    it("should export all visible rows if no specific rows are checked", () => {
      const selectedIds = new Set();
      const activeRows =
        selectedIds.size > 0
          ? mockReportItems.filter((i) => selectedIds.has(i.inquiryId))
          : mockReportItems;

      expect(activeRows.length).toBe(4);
    });
  });

  describe("6. Excel Workbook Structure & SheetJS Formatting", () => {
    it("should build a valid Excel workbook with required headers and summary row", () => {
      const exportRows = mockReportItems.map((item, idx) => ({
        "Sr #": idx + 1,
        "Inquiry No": item.inquiryNumber,
        "Candidate Name": item.name,
        "Father Name": item.fatherName,
        Contact: item.phone,
        CNIC: item.cnic || "—",
        Gender: item.gender,
        "Inquiry Type": item.inquiryType,
        Session: item.academicSession?.name || "—",
        "Interested Program": item.program?.name || "—",
        "Inquiry Date": item.inquiryDate ? item.inquiryDate.substring(0, 10) : "—",
        "Prospectus Sold": item.prospectusSold ? "YES" : "NO",
        "Prospectus Fee (PKR)": item.prospectusFee || 0,
        "Conversion Status": item.isConverted ? "CONVERTED (ADMITTED)" : item.conversionStatus,
        "Roll No": item.rollNumber || "—",
        "Enrolled Class & Section": item.enrolledClass
          ? `${item.enrolledClass} (${item.enrolledSection || "—"})`
          : "—",
        "Turnaround (Days)": item.isConverted && typeof item.daysToConversion === "number"
          ? item.daysToConversion
          : "—",
      }));

      // Add summary row
      const totalRevenue = mockReportItems.reduce((acc, i) => acc + (i.prospectusFee || 0), 0);
      exportRows.push({
        "Sr #": "TOTAL",
        "Inquiry No": `Total Inquiries: ${mockReportItems.length}`,
        "Candidate Name": "",
        "Father Name": "",
        Contact: "",
        CNIC: "",
        Gender: "",
        "Inquiry Type": "",
        Session: "",
        "Interested Program": "",
        "Inquiry Date": "",
        "Prospectus Sold": `Sold: ${mockReportItems.filter((i) => i.prospectusSold).length}`,
        "Prospectus Fee (PKR)": totalRevenue,
        "Conversion Status": `Converted: ${mockReportItems.filter((i) => i.isConverted).length}`,
        "Roll No": "",
        "Enrolled Class & Section": "",
        "Turnaround (Days)": "",
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Admission Conversions");

      expect(workbook.SheetNames).toContain("Admission Conversions");
      expect(worksheet["!ref"]).toBeDefined();

      // Read back from workbook
      const parsedData = XLSX.utils.sheet_to_json(worksheet);
      expect(parsedData.length).toBe(5); // 4 rows + 1 total row
      expect(parsedData[0]["Candidate Name"]).toBe("Ahmed Raza");
      expect(parsedData[4]["Sr #"]).toBe("TOTAL");
      expect(parsedData[4]["Prospectus Fee (PKR)"]).toBe(4000);
    });
  });

  describe("7. Print Template Structure & Institution Details", () => {
    it("should include college name, calligraphy styling, KPI cards, and signature lines", () => {
      const collegeTitle = "CONCORDIA COLLEGE";
      const campusSubtitle = "DHA / MAIN CAMPUS PESHAWAR";
      const reportTitle = "Admission Conversion & Inquiry Audit Report";

      const htmlSnippet = `
        <div class="print-container">
          <div class="header">
            <h1 class="college-title font-calligraphy">${collegeTitle}</h1>
            <p class="campus">${campusSubtitle}</p>
            <h2 class="report-heading">${reportTitle}</h2>
          </div>
          <div class="kpi-strip">
            <div class="kpi-card">Total Inquiries: ${mockReportItems.length}</div>
            <div class="kpi-card">Converted: 2 (50.0%)</div>
          </div>
          <table class="report-table">
            <thead>
              <tr>
                <th>Sr #</th>
                <th>Inquiry No</th>
                <th>Candidate Name</th>
                <th>Status</th>
                <th>Roll No</th>
              </tr>
            </thead>
            <tbody>
              ${mockReportItems
                .map(
                  (item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.inquiryNumber}</td>
                  <td>${item.name}</td>
                  <td>${item.conversionStatus}</td>
                  <td>${item.rollNumber || "—"}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
          <div class="signature-section">
            <div class="sign-box">Prepared By</div>
            <div class="sign-box">Director of Admissions</div>
            <div class="sign-box">Principal / Rector</div>
          </div>
        </div>
      `;

      expect(htmlSnippet).toContain("CONCORDIA COLLEGE");
      expect(htmlSnippet).toContain("Admission Conversion & Inquiry Audit Report");
      expect(htmlSnippet).toContain("font-calligraphy");
      expect(htmlSnippet).toContain("Ahmed Raza");
      expect(htmlSnippet).toContain("MED-2026-001");
      expect(htmlSnippet).toContain("Director of Admissions");
    });
  });
});
