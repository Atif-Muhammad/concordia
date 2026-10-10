import React, { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileSpreadsheet,
  Printer,
  SlidersHorizontal,
  Search,
  RotateCcw,
  Loader2,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getStudents } from "../../../config/apis";
import { extractId, formatDateSafe, formatAmountSafe } from "./StudentProfilePrintTemplate";

const STUDENT_EXPORT_FIELDS = [
  '_id', 'fName', 'lName', 'rollNumber', 'fatherOrguardian', 'motherName', 'gender', 'dob',
  'bloodGroup', 'religion', 'studentCnic', 'parentCNIC', 'parentOrGuardianPhone',
  'contactNumber', 'emergencyContact', 'parentOrGuardianEmail', 'email', 'address',
  'presentAddress', 'admissionDate', 'admissionFormNumber', 'sessionId', 'session',
  'programId', 'classId', 'sectionId', 'status', 'previousBoardName',
  'previousBoardRollNumber', 'obtainedMarks', 'totalMarks', 'tuitionFee',
  'numberOfInstallments', 'lateFeeFine', 'installments'
].join(' ');

export const StudentDataExportDialog = ({
  open,
  onOpenChange,
  initialFilters = {},
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  status = "ACTIVE",
}) => {
  const { toast } = useToast();

  // Dialog filters state
  const [filterPrograms, setFilterPrograms] = useState([]);
  const [filterClasses, setFilterClasses] = useState([]);
  const [filterSections, setFilterSections] = useState([]);
  const [filterGender, setFilterGender] = useState("all");
  const [filterSessionId, setFilterSessionId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPrint, setIsExportingPrint] = useState(false);

  // Sync initial filters when opened
  useEffect(() => {
    if (open) {
      setFilterPrograms(initialFilters.filterProgram && initialFilters.filterProgram !== "all" ? [initialFilters.filterProgram] : []);
      setFilterClasses(initialFilters.filterClass && initialFilters.filterClass !== "all" ? [initialFilters.filterClass] : []);
      setFilterSections(initialFilters.filterSection && initialFilters.filterSection !== "all" ? [initialFilters.filterSection] : []);
      setFilterGender(initialFilters.gender || "all");
      setFilterSessionId(initialFilters.filterSessionId || "all");
      setFilterStatus(initialFilters.status || status || "all");
      setSearchQuery(initialFilters.searchQuery || "");
    }
  }, [open, initialFilters, status]);

  // Dependent dropdowns
  const availableClasses = useMemo(() => {
    if (filterPrograms.length === 0) return classesData;
    return classesData.filter((c) => filterPrograms.includes(extractId(c.programId || c.program)));
  }, [classesData, filterPrograms]);

  const availableSections = useMemo(() => {
    if (filterClasses.length === 0) return sectionsData;
    return sectionsData.filter((s) => filterClasses.includes(extractId(s.classId || s.class)));
  }, [sectionsData, filterClasses]);

  // Auto-prune classes when programs change
  const handleProgramsChange = (vals) => {
    setFilterPrograms(vals);
    // Prune classes that no longer belong to selected programs
    if (vals.length > 0) {
      const validClassIds = classesData
        .filter((c) => vals.includes(extractId(c.programId || c.program)))
        .map((c) => extractId(c));
      setFilterClasses((prev) => prev.filter((id) => validClassIds.includes(id)));
    }
  };

  // Auto-prune sections when classes change
  const handleClassesChange = (vals) => {
    setFilterClasses(vals);
    if (vals.length > 0) {
      const validSectionIds = sectionsData
        .filter((s) => vals.includes(extractId(s.classId || s.class)))
        .map((s) => extractId(s));
      setFilterSections((prev) => prev.filter((id) => validSectionIds.includes(id)));
    }
  };

  const handleResetFilters = () => {
    setFilterPrograms([]);
    setFilterClasses([]);
    setFilterSections([]);
    setFilterGender("all");
    setFilterSessionId("all");
    setFilterStatus("all");
    setSearchQuery("");
  };

  // Query comprehensive student data with trimmed fields and multi-program backend filtering
  const programParam = filterPrograms.length > 0 ? filterPrograms.join(",") : "";
  const classParam = filterClasses.length > 0 ? filterClasses.join(",") : "";
  const sectionParam = filterSections.length > 0 ? filterSections.join(",") : "";

  const {
    data: studentsResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "studentDataExportFull",
      [...filterPrograms].sort().join(","),
      [...filterClasses].sort().join(","),
      [...filterSections].sort().join(","),
      filterGender,
      filterSessionId,
      filterStatus,
      searchQuery,
    ],
    queryFn: () =>
      getStudents(
        programParam,
        classParam,
        sectionParam,
        searchQuery.trim(),
        filterStatus === "all" ? "" : filterStatus,
        "", // session
        1, // page
        10000, // limit: fetch all matching
        "", // startDate
        "", // endDate
        filterSessionId === "all" ? "" : filterSessionId,
        false, // summary = false to load complete records with installments!
        filterGender === "all" ? "" : filterGender,
        STUDENT_EXPORT_FIELDS
      ),
    enabled: open,
    staleTime: 30 * 1000,
  });

  const studentsList = useMemo(() => {
    const raw = Array.isArray(studentsResponse?.students)
      ? studentsResponse.students
      : Array.isArray(studentsResponse)
      ? studentsResponse
      : [];

    const mapped = raw.map((student, idx) => {
      const studentId = extractId(student.id || student._id);
      const fullName = `${student.fName || ""} ${student.lName || ""}`.trim() || "Student";
      const fatherName = student.fatherOrguardian || student.fatherName || "—";
      const rollNo =
        student.rollNumber ||
        student.rollNo ||
        (Array.isArray(student.academicRecords) && student.academicRecords.find((r) => r.rollNumber)?.rollNumber) ||
        "—";
      const gender = student.gender || "—";

      // Academic names
      const progId = extractId(student.programId || student.program);
      const clsId = extractId(student.classId || student.class);
      const secId = extractId(student.sectionId || student.section);
      const sessId = extractId(student.sessionId || student.session);

      const programName =
        (typeof student.program === "object" ? student.program?.name : null) ||
        (typeof student.programId === "object" ? student.programId?.name : null) ||
        programData.find((p) => extractId(p) === progId)?.name ||
        (typeof student.program === "string" ? student.program : "—");

      const clsName =
        (typeof student.class === "object" ? student.class?.name : null) ||
        (typeof student.classId === "object" ? student.classId?.name : null) ||
        classesData.find((c) => extractId(c) === clsId)?.name ||
        (typeof student.class === "string" ? student.class : "—");

      const secName =
        (typeof student.section === "object" ? student.section?.name : null) ||
        (typeof student.sectionId === "object" ? student.sectionId?.name : null) ||
        sectionsData.find((s) => extractId(s) === secId)?.name ||
        (typeof student.section === "string" ? student.section : "—");

      const sessName =
        (typeof student.session === "object" ? student.session?.name : null) ||
        (typeof student.sessionId === "object" ? student.sessionId?.name : null) ||
        academicSessions.find((s) => extractId(s) === sessId)?.name ||
        student.session ||
        "—";

      // Fee Installment Plan resolution
      const rawInst = student.installments || student.feeInstallments || [];
      const installments = (Array.isArray(rawInst) ? rawInst : []).map((inst, instIdx) => {
        const amount = Number(inst.amount ?? inst.basePayable ?? 0);
        const paid = Number(inst.paidAmount ?? 0);
        const pending = Number(inst.pendingAmount != null ? inst.pendingAmount : Math.max(0, amount - paid));
        const instStatus = inst.status || (paid >= amount && amount > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING");
        return {
          installmentNumber: inst.installmentNumber || instIdx + 1,
          month: inst.month || `Inst #${inst.installmentNumber || instIdx + 1}`,
          dueDate: inst.dueDate ? formatDateSafe(inst.dueDate) : "—",
          amount,
          paidAmount: paid,
          pendingAmount: pending,
          status: instStatus,
        };
      });

      const totalTuition =
        installments.length > 0
          ? installments.reduce((sum, i) => sum + i.amount, 0)
          : Number(student.tuitionFee || 0);
      const totalPaid = installments.reduce((sum, i) => sum + i.paidAmount, 0);
      const totalPending =
        installments.length > 0
          ? installments.reduce((sum, i) => sum + i.pendingAmount, 0)
          : Math.max(0, totalTuition - totalPaid);

      return {
        ...student,
        resolvedId: studentId,
        fullName,
        fatherName,
        rollNo,
        gender,
        programName,
        className: clsName,
        sectionName: secName,
        sessionName: sessName,
        programClassSection: [programName, clsName, secName].filter((v) => v && v !== "—").join(" / ") || "—",
        installments,
        installmentCount: installments.length,
        totalTuition,
        totalPaid,
        totalPending,
        feePlanStatus:
          totalPending <= 0 && totalTuition > 0
            ? "Fully Paid"
            : totalPaid > 0
            ? "Partially Paid"
            : totalTuition > 0
            ? "Pending"
            : "No Plan Set",
      };
    });

    // Client-side multi-select filtering (when >1 selected, API fetches all)
    return mapped.filter((s) => {
      if (filterPrograms.length > 1) {
        const progId = extractId(s.programId || s.program);
        if (!filterPrograms.includes(progId)) return false;
      }
      if (filterClasses.length > 1) {
        const clsId = extractId(s.classId || s.class);
        if (!filterClasses.includes(clsId)) return false;
      }
      if (filterSections.length > 1) {
        const secId = extractId(s.sectionId || s.section);
        if (!filterSections.includes(secId)) return false;
      }
      return true;
    });
  }, [studentsResponse, programData, classesData, sectionsData, academicSessions, filterPrograms, filterClasses, filterSections]);

  // Overall statistics for preview and report
  const metrics = useMemo(() => {
    const total = studentsList.length;
    const male = studentsList.filter((s) => String(s.gender).toLowerCase() === "male").length;
    const female = studentsList.filter((s) => String(s.gender).toLowerCase() === "female").length;
    const other = total - male - female;
    const totalTuition = studentsList.reduce((sum, s) => sum + s.totalTuition, 0);
    const totalPaid = studentsList.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalPending = studentsList.reduce((sum, s) => sum + s.totalPending, 0);
    const totalInstallments = studentsList.reduce((sum, s) => sum + s.installmentCount, 0);

    return {
      total,
      male,
      female,
      other,
      totalTuition,
      totalPaid,
      totalPending,
      totalInstallments,
    };
  }, [studentsList]);

  // Group students by program for partitioned display
  const groupedStudents = useMemo(() => {
    if (filterPrograms.length <= 1 && filterClasses.length === 0) {
      // No partitioning needed — single group
      return [{ groupLabel: null, students: studentsList }];
    }
    const groups = {};
    for (const s of studentsList) {
      const key = s.programName || "Unknown Program";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, students]) => ({ groupLabel: label, students }));
  }, [studentsList, filterPrograms, filterClasses]);

  // Export to Excel handler
  const handleExportToExcel = () => {
    if (!studentsList || studentsList.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no student records matching the selected filters.",
        variant: "destructive",
      });
      return;
    }

    setIsExportingExcel(true);
    try {
      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Students Comprehensive Master Data ──
      const studentRows = studentsList.map((s, idx) => ({
        "S.No": idx + 1,
        "Roll Number": s.rollNo,
        "Admission Form #": s.admissionFormNumber || "—",
        "Full Name": s.fullName,
        "Father / Guardian Name": s.fatherName,
        "Mother Name": s.motherName || "—",
        "Gender": s.gender,
        "Date of Birth": s.dob ? formatDateSafe(s.dob) : "—",
        "Blood Group": s.bloodGroup || "—",
        "Religion": s.religion || "—",
        "Student CNIC / B-Form": s.studentCnic || s.cnic_bForm || "—",
        "Parent / Guardian CNIC": s.parentCNIC || "—",
        "Parent Phone / Contact": s.parentOrGuardianPhone || s.contactNumber || "—",
        "Emergency Contact": s.emergencyContact || "—",
        "Email": s.parentOrGuardianEmail || s.email || "—",
        "Address": s.address || s.presentAddress || "—",
        "Admission Date": s.admissionDate ? formatDateSafe(s.admissionDate) : "—",
        "Academic Session": s.sessionName,
        "Program": s.programName,
        "Class": s.className,
        "Section": s.sectionName,
        "Status": s.status || "ACTIVE",
        "Previous Board / School": s.previousBoardName || "—",
        "Previous Roll #": s.previousBoardRollNumber || "—",
        "Marks Obtained": s.obtainedMarks != null ? s.obtainedMarks : "—",
        "Total Marks": s.totalMarks != null ? s.totalMarks : "—",
        "Total Package Fee (PKR)": s.totalTuition,
        "Installments Count": s.installmentCount,
        "Total Paid (PKR)": s.totalPaid,
        "Total Pending (PKR)": s.totalPending,
        "Fee Plan Status": s.feePlanStatus,
      }));

      // Append Summary row
      studentRows.push({
        "S.No": "TOTAL",
        "Roll Number": `${metrics.total} Students`,
        "Admission Form #": "",
        "Full Name": "",
        "Father / Guardian Name": "",
        "Mother Name": "",
        "Gender": `M: ${metrics.male} | F: ${metrics.female}`,
        "Date of Birth": "",
        "Blood Group": "",
        "Religion": "",
        "Student CNIC / B-Form": "",
        "Parent / Guardian CNIC": "",
        "Parent Phone / Contact": "",
        "Emergency Contact": "",
        "Email": "",
        "Address": "",
        "Admission Date": "",
        "Academic Session": "",
        "Program": "",
        "Class": "",
        "Section": "",
        "Status": "",
        "Previous Board / School": "",
        "Previous Roll #": "",
        "Marks Obtained": "",
        "Total Marks": "",
        "Total Package Fee (PKR)": metrics.totalTuition,
        "Installments Count": metrics.totalInstallments,
        "Total Paid (PKR)": metrics.totalPaid,
        "Total Pending (PKR)": metrics.totalPending,
        "Fee Plan Status": "",
      });

      const wsStudents = XLSX.utils.json_to_sheet(studentRows);
      wsStudents["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 14 }, // Roll Number
        { wch: 18 }, // Admission Form #
        { wch: 22 }, // Full Name
        { wch: 22 }, // Father Name
        { wch: 18 }, // Mother Name
        { wch: 10 }, // Gender
        { wch: 14 }, // DOB
        { wch: 12 }, // Blood Group
        { wch: 12 }, // Religion
        { wch: 18 }, // Student CNIC
        { wch: 18 }, // Parent CNIC
        { wch: 16 }, // Contact Phone
        { wch: 16 }, // Emergency Contact
        { wch: 22 }, // Email
        { wch: 30 }, // Address
        { wch: 14 }, // Admission Date
        { wch: 14 }, // Session
        { wch: 18 }, // Program
        { wch: 16 }, // Class
        { wch: 12 }, // Section
        { wch: 12 }, // Status
        { wch: 22 }, // Previous Board
        { wch: 16 }, // Previous Roll #
        { wch: 14 }, // Obtained Marks
        { wch: 14 }, // Total Marks
        { wch: 22 }, // Total Package Fee
        { wch: 18 }, // Installments Count
        { wch: 18 }, // Total Paid
        { wch: 18 }, // Total Pending
        { wch: 16 }, // Fee Plan Status
      ];
      XLSX.utils.book_append_sheet(wb, wsStudents, "Students Master Data");

      // ── Sheet 2: Fee Installment Plans ──
      const installmentRows = [];
      let instRowIdx = 1;

      for (const s of studentsList) {
        if (s.installments && s.installments.length > 0) {
          for (const inst of s.installments) {
            installmentRows.push({
              "S.No": instRowIdx++,
              "Roll Number": s.rollNo,
              "Student Name": s.fullName,
              "Father Name": s.fatherName,
              "Program": s.programName,
              "Class": s.className,
              "Section": s.sectionName,
              "Installment #": inst.installmentNumber,
              "Month / Term": inst.month,
              "Due Date": inst.dueDate,
              "Installment Amount (PKR)": inst.amount,
              "Paid Amount (PKR)": inst.paidAmount,
              "Pending Amount (PKR)": inst.pendingAmount,
              "Status": inst.status,
            });
          }
        } else {
          installmentRows.push({
            "S.No": instRowIdx++,
            "Roll Number": s.rollNo,
            "Student Name": s.fullName,
            "Father Name": s.fatherName,
            "Program": s.programName,
            "Class": s.className,
            "Section": s.sectionName,
            "Installment #": "—",
            "Month / Term": "No Plan Configured",
            "Due Date": "—",
            "Installment Amount (PKR)": s.totalTuition,
            "Paid Amount (PKR)": s.totalPaid,
            "Pending Amount (PKR)": s.totalPending,
            "Status": s.feePlanStatus,
          });
        }
      }

      if (installmentRows.length > 0) {
        installmentRows.push({
          "S.No": "TOTAL",
          "Roll Number": `${metrics.total} Students`,
          "Student Name": "",
          "Father Name": "",
          "Program": "",
          "Class": "",
          "Section": "",
          "Installment #": `${installmentRows.length - 1} Installment Records`,
          "Month / Term": "",
          "Due Date": "",
          "Installment Amount (PKR)": metrics.totalTuition,
          "Paid Amount (PKR)": metrics.totalPaid,
          "Pending Amount (PKR)": metrics.totalPending,
          "Status": "",
        });

        const wsInstallments = XLSX.utils.json_to_sheet(installmentRows);
        wsInstallments["!cols"] = [
          { wch: 8 },  // S.No
          { wch: 14 }, // Roll Number
          { wch: 22 }, // Student Name
          { wch: 20 }, // Father Name
          { wch: 18 }, // Program
          { wch: 16 }, // Class
          { wch: 12 }, // Section
          { wch: 14 }, // Installment #
          { wch: 16 }, // Month
          { wch: 14 }, // Due Date
          { wch: 24 }, // Installment Amount
          { wch: 18 }, // Paid Amount
          { wch: 20 }, // Pending Amount
          { wch: 14 }, // Status
        ];
        XLSX.utils.book_append_sheet(wb, wsInstallments, "Fee Installment Plans");
      }

      const dateStr = format(new Date(), "yyyy-MM-dd");
      XLSX.writeFile(wb, `Student_Data_Export_${dateStr}.xlsx`);

      toast({
        title: "Export Successful 🎉",
        description: `Exported ${studentsList.length} student records and fee plans to Excel.`,
      });
    } catch (err) {
      console.error("Excel export error:", err);
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel file.",
        variant: "destructive",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export as PDF / Print handler
  const handleExportAsPrint = async () => {
    if (!studentsList || studentsList.length === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no student records matching the selected filters.",
        variant: "destructive",
      });
      return;
    }

    setIsExportingPrint(true);
    try {
      // 1. Fetch brand logo as Data URL for robust standalone printing
      let logoDataUrl = "/logo.png";
      try {
        const res = await fetch("/logo.png");
        if (res.ok) {
          const blob = await res.blob();
          logoDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(`${window.location.origin}/logo.png`);
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        logoDataUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/logo.png";
      }

      const progName = filterPrograms.length === 0
        ? "All Programs"
        : filterPrograms.map(id => programData.find(p => extractId(p) === id)?.name || id).join(", ");
      const clsName = filterClasses.length === 0
        ? "All Classes"
        : filterClasses.map(id => classesData.find(c => extractId(c) === id)?.name || id).join(", ");
      const secName = filterSections.length === 0
        ? "All Sections"
        : filterSections.map(id => sectionsData.find(s => extractId(s) === id)?.name || id).join(", ");
      const sessName =
        filterSessionId === "all"
          ? "All Sessions"
          : academicSessions.find((s) => extractId(s) === filterSessionId)?.name || "Selected Session";
      const genderName = filterGender === "all" ? "All Genders" : filterGender;
      const statusName = filterStatus === "all" ? "All Statuses" : filterStatus;
      const exportDate = format(new Date(), "dd MMMM yyyy, hh:mm a");

      let globalRowIdx = 0;
      const studentTableRows = groupedStudents.map(group => {
        const groupHeaderHtml = group.groupLabel ? `
          <tr style="background: #f1f5f9; break-inside: avoid;">
            <td colspan="7" style="padding: 8px 10px; font-weight: 700; font-size: 11px; color: #0f172a; border-bottom: 2px solid #cbd5e1;">
              ${group.groupLabel}
              <span style="font-weight: 400; font-size: 9px; color: #64748b; margin-left: 8px;">(${group.students.length} students)</span>
            </td>
          </tr>` : '';

        const rows = group.students.map((s, idx) => {
          globalRowIdx++;
          const installmentCells =
            s.installments && s.installments.length > 0
              ? s.installments
                  .map(
                    (inst) => `
                <div style="display: inline-block; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; margin: 2px 3px 2px 0; font-size: 9px; line-height: 1.2;">
                  <span style="font-weight: 700; color: #1e293b;">#${inst.installmentNumber} (${inst.month}):</span>
                  <span style="color: #334155;">PKR ${formatAmountSafe(inst.amount)}</span> |
                  <span style="color: ${inst.status === "PAID" ? "#16a34a" : "#dc2626"}; font-weight: 600;">${inst.status}</span>
                </div>
              `
                  )
                  .join("")
              : `<span style="font-size: 10px; color: #94a3b8; font-style: italic;">No installment plan generated</span>`;

          return `
            <tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#fffaf5"}; break-inside: avoid; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; font-size: 10px; text-align: center; border-right: 1px solid #e2e8f0;">${globalRowIdx}</td>
              <td style="padding: 6px 8px; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">${s.rollNo}</td>
              <td style="padding: 6px 8px; font-size: 10px; border-right: 1px solid #e2e8f0;">
                <div style="font-weight: 700; color: #0f172a;">${s.fullName}</div>
                <div style="font-size: 9px; color: #64748b;">S/D/O: ${s.fatherName}</div>
              </td>
              <td style="padding: 6px 8px; font-size: 10px; text-align: center; border-right: 1px solid #e2e8f0;">
                <span style="padding: 2px 6px; border-radius: 12px; font-size: 9px; font-weight: 600; background: ${s.gender === "Male" ? "#eff6ff" : s.gender === "Female" ? "#fdf2f8" : "#f1f5f9"}; color: ${s.gender === "Male" ? "#1d4ed8" : s.gender === "Female" ? "#be185d" : "#475569"};">
                  ${s.gender}
                </span>
              </td>
              <td style="padding: 6px 8px; font-size: 10px; color: #334155; border-right: 1px solid #e2e8f0;">${s.programClassSection}</td>
              <td style="padding: 6px 8px; font-size: 10px; color: #334155; border-right: 1px solid #e2e8f0;">
                <div>${s.parentOrGuardianPhone || s.contactNumber || "—"}</div>
                <div style="font-size: 9px; color: #64748b;">${s.studentCnic || s.parentCNIC || "—"}</div>
              </td>
              <td style="padding: 6px 8px; font-size: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 9.5px;">
                  <span><strong>Total:</strong> PKR ${formatAmountSafe(s.totalTuition)}</span>
                  <span><strong>Paid:</strong> <span style="color: #16a34a;">PKR ${formatAmountSafe(s.totalPaid)}</span></span>
                  <span><strong>Pending:</strong> <span style="color: #dc2626;">PKR ${formatAmountSafe(s.totalPending)}</span></span>
                </div>
                <div>${installmentCells}</div>
              </td>
            </tr>
          `;
        }).join("");

        return groupHeaderHtml + rows;
      }).join("");

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Student Data Export & Fee Installment Report</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet">
            <style>
              @media print {
                @page { size: A4 landscape; margin: 8mm 10mm; }
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .no-break { page-break-inside: avoid; }
              }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: #1e293b;
                background: #ffffff;
                margin: 0;
                padding: 10px;
                font-size: 10.5px;
                line-height: 1.35;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .report-container {
                width: 100%;
                margin: 0 auto;
                background: #ffffff;
                border: 1.5px solid #0f172a;
                border-top: 3px solid #0f172a;
                padding: 12px 14px;
              }
              .form-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 8px;
                margin-bottom: 6px;
                gap: 12px;
              }
              .header-logo-area {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
              }
              .brand-logo {
                height: 52px;
                width: auto;
                max-width: 120px;
                object-fit: contain;
                display: block;
              }
              .header-title-block h1 {
                font-size: 18px;
                font-weight: 700;
                margin: 0;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                color: #0f172a;
              }
              .header-title-block .tagline {
                font-size: 9.5px;
                font-weight: 600;
                text-transform: uppercase;
                color: #475569;
                letter-spacing: 0.5px;
                margin-top: 2px;
              }
              .meta-box {
                font-size: 10px;
                color: #64748b;
                line-height: 1.4;
                text-align: right;
              }
              .meta-box strong {
                color: #0f172a;
              }
              /* CENTERED CALLIGRAPHY TITLE FOR REPORT NAME */
              .center-calligraphy-title {
                text-align: center;
                font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Brush Script MT', 'Lucida Calligraphy', 'Segoe Script', cursive, serif;
                font-size: 26px;
                font-weight: 500;
                color: #0f172a;
                margin: 4px 0 8px 0;
                padding: 2px 0 6px 0;
                border-bottom: 1px dashed #cbd5e1;
                letter-spacing: 0.5px;
              }
              .filter-badges {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 5px 12px;
                margin-bottom: 10px;
                display: flex;
                flex-wrap: wrap;
                gap: 14px;
                font-size: 10px;
              }
              .filter-item strong {
                color: #334155;
              }
              .filter-item span {
                color: #0f172a;
                font-weight: 600;
              }
              .table-summary-bar {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-bottom: none;
                border-radius: 4px 4px 0 0;
                padding: 6px 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
                font-size: 10.5px;
                color: #334155;
              }
              .table-summary-bar .summary-item strong {
                color: #0f172a;
                font-weight: 700;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
              }
              thead th {
                background: #f1f5f9;
                color: #0f172a;
                font-size: 9.5px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                padding: 7px 8px;
                text-align: left;
                border: 1px solid #cbd5e1;
              }
              thead th.text-center { text-align: center; }
              tfoot tr.grand-total-row {
                background: #f1f5f9;
                border-top: 2px solid #0f172a;
                border-bottom: 2px solid #0f172a;
                font-weight: 700;
              }
              tfoot td {
                padding: 7px 8px;
                font-size: 10.5px;
                border: 1px solid #cbd5e1;
                color: #0f172a;
              }
              .footer-sign {
                display: flex;
                justify-content: space-between;
                margin-top: 25px;
                padding-top: 15px;
                border-top: 1.5px solid #0f172a;
                font-size: 10px;
                color: #475569;
              }
            </style>
          </head>
          <body>
            <div class="report-container">
              <!-- BRAND HEADER -->
              <div class="form-header">
                <div class="header-logo-area">
                  <img src="${logoDataUrl}" class="brand-logo" alt="Concordia College Peshawar Logo" />
                  <div class="header-title-block">
                    <h1>Concordia College Peshawar</h1>
                    <div class="tagline">A Project of Beaconhouse</div>
                  </div>
                </div>
                <div class="meta-box">
                  <div><strong>Generated At:</strong> ${exportDate}</div>
                  <div><strong>System:</strong> Concordia ERP Student Information System</div>
                </div>
              </div>

              <!-- CENTERED CALLIGRAPHY REPORT TITLE -->
              <div class="center-calligraphy-title">
                Student Data Export &amp; Fee Installment Report
              </div>

              <div class="filter-badges">
                <div class="filter-item"><strong>Program:</strong> <span>${progName}</span></div>
                <div class="filter-item"><strong>Class:</strong> <span>${clsName}</span></div>
                <div class="filter-item"><strong>Section:</strong> <span>${secName}</span></div>
                <div class="filter-item"><strong>Gender:</strong> <span>${genderName}</span></div>
                <div class="filter-item"><strong>Session:</strong> <span>${sessName}</span></div>
                <div class="filter-item"><strong>Status:</strong> <span>${statusName}</span></div>
                ${searchQuery ? `<div class="filter-item"><strong>Search:</strong> <span>"${searchQuery}"</span></div>` : ""}
              </div>

              <!-- TOP TABLE SUMMARY ROW (INTEGRATED METRICS BAR) -->
              <div class="table-summary-bar">
                <div class="summary-item">Total Students: <strong>${metrics.total}</strong> (Male: <strong>${metrics.male}</strong>, Female: <strong>${metrics.female}</strong>)</div>
                <div class="summary-item">Total Package Fee: <strong>PKR ${formatAmountSafe(metrics.totalTuition)}</strong></div>
                <div class="summary-item">Total Fee Paid: <strong>PKR ${formatAmountSafe(metrics.totalPaid)}</strong></div>
                <div class="summary-item">Total Fee Pending: <strong>PKR ${formatAmountSafe(metrics.totalPending)}</strong></div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 3%;" class="text-center">#</th>
                    <th style="width: 10%;">Roll No</th>
                    <th style="width: 18%;">Student &amp; Father Name</th>
                    <th style="width: 6%;" class="text-center">Gender</th>
                    <th style="width: 13%;">Class / Section</th>
                    <th style="width: 13%;">Contact &amp; CNIC</th>
                    <th style="width: 37%;">Fee Package &amp; Installment Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  ${studentTableRows}
                </tbody>
                <tfoot>
                  <tr class="grand-total-row no-break">
                    <td colspan="6" style="text-align: right; font-weight: 700; padding: 7px 10px;">
                      TOTAL (${metrics.total} Students &bull; Male: ${metrics.male} | Female: ${metrics.female}):
                    </td>
                    <td style="padding: 7px 8px;">
                      <div style="display: flex; justify-content: space-between; font-size: 9.5px; font-weight: 700;">
                        <span>Total: PKR ${formatAmountSafe(metrics.totalTuition)}</span>
                        <span>Paid: PKR ${formatAmountSafe(metrics.totalPaid)}</span>
                        <span style="color: #991b1b;">Pending: PKR ${formatAmountSafe(metrics.totalPending)}</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div class="footer-sign no-break">
                <div><strong>Prepared By:</strong> _____________________</div>
                <div><strong>Checked By:</strong> _____________________</div>
                <div><strong>Accounts Officer:</strong> _____________________</div>
                <div><strong>Principal / Director:</strong> _____________________</div>
              </div>
            </div>
          </body>
        </html>
      `;

      await openManagedPrintWindow({
        html,
        title: "Student Data Export Report",
        toast,
      });
    } catch (err) {
      console.error("Print export error:", err);
      toast({
        title: "Print Error",
        description: err.message || "Failed to generate print view.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPrint(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 flex flex-col overflow-hidden w-full sm:w-[94vw] lg:w-[90vw]"
        bodyClassName="p-3 sm:p-4 flex-1 flex flex-col gap-2.5 min-h-0 overflow-hidden"
      >
        <DialogHeader className="px-4 py-2.5 border-b border-border/80 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                Student Data Export
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Export comprehensive student records, personal information, and fee installment plans to Excel or PDF/Print.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportToExcel}
                disabled={isExportingExcel || isLoading || studentsList.length === 0}
                className="gap-1.5 h-8 text-xs font-semibold text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 flex-1 sm:flex-initial"
              >
                {isExportingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                )}
                Export to Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAsPrint}
                disabled={isExportingPrint || isLoading || studentsList.length === 0}
                className="gap-1.5 h-8 text-xs font-semibold flex-1 sm:flex-initial"
              >
                {isExportingPrint ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5 text-primary" />
                )}
                Export as PDF / Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filters Section */}
        <div className="p-2.5 bg-muted/30 rounded-lg border border-border/60 flex-shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {/* Program */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Program</Label>
              <MultiSelectFilter
                options={programData.map((p) => ({ value: extractId(p), label: p.name || p.programName }))}
                selected={filterPrograms}
                onChange={handleProgramsChange}
                placeholder="Programs"
                allLabel="All Programs"
                triggerClassName="h-8 text-xs bg-background"
              />
            </div>

            {/* Class */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Class</Label>
              <MultiSelectFilter
                options={availableClasses.map((c) => ({ value: extractId(c), label: c.name || c.className }))}
                selected={filterClasses}
                onChange={handleClassesChange}
                placeholder="Classes"
                allLabel="All Classes"
                triggerClassName="h-8 text-xs bg-background"
              />
            </div>

            {/* Section */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Section</Label>
              <MultiSelectFilter
                options={availableSections.map((s) => ({ value: extractId(s), label: s.name || s.sectionName }))}
                selected={filterSections}
                onChange={setFilterSections}
                placeholder="Sections"
                allLabel="All Sections"
                triggerClassName="h-8 text-xs bg-background"
              />
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Gender</Label>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Academic Session */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Session</Label>
              <Select value={filterSessionId} onValueChange={setFilterSessionId}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">All Sessions</SelectItem>
                  {academicSessions.map((s) => (
                    <SelectItem key={s.id || s._id} value={extractId(s)} className="text-xs">
                      {s.name || s.sessionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="GRADUATED">Graduated</SelectItem>
                  <SelectItem value="EXPELLED">Expelled</SelectItem>
                  <SelectItem value="STRUCK_OFF">Struck Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by student name, roll number, father name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>
            {(filterPrograms.length > 0 ||
              filterClasses.length > 0 ||
              filterSections.length > 0 ||
              filterGender !== "all" ||
              filterSessionId !== "all" ||
              filterStatus !== "all" ||
              searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 px-2.5 text-xs text-muted-foreground gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* KPI Summary Header */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 flex-shrink-0">
          <Card className="bg-primary/5 border-primary/20 p-1.5 text-center shadow-none">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Students</div>
            <div className="text-sm font-extrabold text-primary flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {metrics.total}
            </div>
          </Card>
          <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 p-1.5 text-center shadow-none">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Male</div>
            <div className="text-sm font-extrabold text-blue-700 dark:text-blue-400">{metrics.male}</div>
          </Card>
          <Card className="bg-pink-50/50 border-pink-200 dark:bg-pink-950/20 dark:border-pink-900 p-1.5 text-center shadow-none">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Female</div>
            <div className="text-sm font-extrabold text-pink-700 dark:text-pink-400">{metrics.female}</div>
          </Card>
          <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-1.5 text-center shadow-none">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Fee</div>
            <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
              PKR {formatAmountSafe(metrics.totalTuition)}
            </div>
          </Card>
          <Card className="bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 p-1.5 text-center shadow-none">
            <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Total Paid</div>
            <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              PKR {formatAmountSafe(metrics.totalPaid)}
            </div>
          </Card>
          <Card className="bg-rose-50/60 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 p-1.5 text-center shadow-none">
            <div className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 tracking-wider">Total Pending</div>
            <div className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
              PKR {formatAmountSafe(metrics.totalPending)}
            </div>
          </Card>
        </div>

        {/* Preview Table */}
        <div className="flex-1 overflow-auto rounded-md border border-border min-h-0">
          {isLoading || isFetching ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs">Loading complete student profiles and installment plans...</p>
            </div>
          ) : studentsList.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertCircle className="w-8 h-8 text-amber-500" />
              <p className="text-sm font-semibold">No students found</p>
              <p className="text-xs text-muted-foreground">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-12 text-center text-xs font-bold">#</TableHead>
                  <TableHead className="w-24 text-xs font-bold">Roll #</TableHead>
                  <TableHead className="w-48 text-xs font-bold">Student Name</TableHead>
                  <TableHead className="w-20 text-center text-xs font-bold">Gender</TableHead>
                  <TableHead className="w-40 text-xs font-bold">Class / Section</TableHead>
                  <TableHead className="w-40 text-xs font-bold">Contact / Phone</TableHead>
                  <TableHead className="min-w-[260px] text-xs font-bold">Fee Installment Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedStudents.map((group, gIdx) => (
                  <React.Fragment key={group.groupLabel || gIdx}>
                    {group.groupLabel && (
                      <TableRow className="bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-100/90 border-y border-border">
                        <TableCell colSpan={7} className="py-2 px-3 text-left">
                          <span className="text-xs font-bold text-foreground tracking-wide">
                            {group.groupLabel}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-2 font-normal">
                            ({group.students.length} {group.students.length === 1 ? "student" : "students"})
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    {group.students.map((student, idx) => (
                      <TableRow key={student.resolvedId || idx} className="hover:bg-muted/30">
                        <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-foreground">{student.rollNo}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-semibold text-foreground">{student.fullName}</div>
                          <div className="text-[11px] text-muted-foreground">Father: {student.fatherName}</div>
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          <Badge
                            variant="outline"
                            className={
                              student.gender === "Male"
                                ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                                : student.gender === "Female"
                                ? "bg-pink-50 text-pink-700 border-pink-200 text-[10px]"
                                : "text-[10px]"
                            }
                          >
                            {student.gender}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{student.programClassSection}</div>
                          <div className="text-[10px] text-slate-400">{student.sessionName}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{student.parentOrGuardianPhone || student.contactNumber || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {student.studentCnic || student.parentCNIC || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-semibold text-foreground">
                              PKR {formatAmountSafe(student.totalTuition)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              ({student.installmentCount} {student.installmentCount === 1 ? "Installment" : "Installments"})
                            </span>
                            {student.totalPending <= 0 && student.totalTuition > 0 ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[9px] h-4">
                                Paid
                              </Badge>
                            ) : student.totalPaid > 0 ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[9px] h-4">
                                Partial
                              </Badge>
                            ) : null}
                          </div>

                          {/* Mini pills of installments */}
                          {student.installments && student.installments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {student.installments.map((inst, iIdx) => (
                                <span
                                  key={iIdx}
                                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                                    inst.status === "PAID"
                                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                                      : inst.status === "PARTIAL"
                                      ? "bg-amber-50/80 border-amber-200 text-amber-800"
                                      : "bg-slate-50 border-slate-200 text-slate-700"
                                  }`}
                                >
                                  <span className="font-semibold">#{inst.installmentNumber}:</span>
                                  <span>PKR {formatAmountSafe(inst.amount)}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">No installments</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-4 py-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 flex-shrink-0 text-xs text-muted-foreground mt-0">
          <div>
            Showing <strong className="text-foreground">{studentsList.length}</strong> matching students
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 px-3 text-xs flex-1 sm:flex-initial">
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleExportToExcel}
              disabled={isExportingExcel || isLoading || studentsList.length === 0}
              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 flex-1 sm:flex-initial"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Download Excel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentDataExportDialog;
