import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Search,
  Percent,
  Tag,
  AlertCircle,
  GraduationCap,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getFeeChallans } from "@/services/api";
import { normalizeChallan, getTotalArrears } from "./feeFinancialUtils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

const getName = (val) => {
  if (!val) return "";
  if (typeof val === "object") {
    return val.name || val.programName || val.className || val.sectionName || val.title || "";
  }
  return String(val);
};

export const FeeDiscountReport = ({
  academicSessions = [],
  programs = [],
  classes = [],
  sections = [],
  onBack,
}) => {
  const { toast } = useToast();

  const currentMonthName = useMemo(() => {
    return MONTH_NAMES[new Date().getMonth()] || "October";
  }, []);

  const defaultSessionId = useMemo(() => {
    const active = academicSessions.find(s => s.isActive || s.status === "ACTIVE");
    return active ? extractId(active) : "all";
  }, [academicSessions]);

  // Filters
  const [selectedSession, setSelectedSession] = useState(defaultSessionId);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState("classSummary"); // "classSummary" | "itemized"

  // Available classes filtered by selected programs
  const availableClasses = useMemo(() => {
    if (selectedPrograms.length === 0) return classes;
    return classes.filter(c => selectedPrograms.includes(extractId(c.programId || c.program)));
  }, [classes, selectedPrograms]);

  const handleProgramsChange = (vals) => {
    setSelectedPrograms(vals);
    if (vals.length > 0) {
      const validClassIds = classes
        .filter(c => vals.includes(extractId(c.programId || c.program)))
        .map(c => extractId(c));
      setSelectedClasses(prev => prev.filter(id => validClassIds.includes(id)));
    }
  };

  const programParam = selectedPrograms.length > 0 ? selectedPrograms.join(',') : undefined;
  const classParam = selectedClasses.length > 0 ? selectedClasses.join(',') : undefined;

  // Query challans for month discount analysis
  const {
    data: challansResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      'feeDiscountReport',
      selectedSession,
      selectedMonth,
      programParam,
      classParam,
    ],
    queryFn: () => getFeeChallans({
      sessionId: selectedSession !== 'all' ? selectedSession : undefined,
      month: selectedMonth !== 'all' ? selectedMonth : undefined,
      programId: programParam,
      classId: classParam,
      report: 'true',
      limit: 50000,
    }),
  });

  // Calculate discount metrics and groupings
  const { itemizedRecords, classSummary, stats } = useMemo(() => {
    const rawList = Array.isArray(challansResponse)
      ? challansResponse
      : (Array.isArray(challansResponse?.data) ? challansResponse.data : []);

    const records = [];
    const classMap = new Map();

    let totalDiscount = 0;
    let totalGross = 0;
    let totalNet = 0;
    let totalPaid = 0;

    for (const raw of rawList) {
      const c = normalizeChallan(raw);
      if (!c) continue;
      if (['VOID', 'SUPERSEDED'].includes(c.status)) continue;

      const discount = Number(c.discountAmount || c.discount || 0);
      if (discount <= 0) continue; // Only students with discount

      const sName = c.studentName || `${raw.studentId?.fName || ''} ${raw.studentId?.lName || ''}`.trim() || 'N/A';
      const fName = c.fatherName || raw.studentId?.fatherOrguardian || '';
      const rollNo = c.rollNumber || raw.studentId?.rollNumber || '';
      const challanNo = c.challanNumber || c.challanNo || '';

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = sName.toLowerCase().includes(q);
        const matchesFather = fName.toLowerCase().includes(q);
        const matchesRoll = rollNo.toLowerCase().includes(q);
        const matchesChallan = challanNo.toLowerCase().includes(q);
        if (!matchesName && !matchesFather && !matchesRoll && !matchesChallan) {
          continue;
        }
      }

      const tuition = Number(c.basePayable || 0);
      const heads = Number(c.headsAmount || (Array.isArray(c.challanHeads) ? c.challanHeads.reduce((s, h) => s + (Number(h.amount) || 0), 0) : 0));
      const arrears = Number(c.arrearsAmount > 0 ? c.arrearsAmount : (getTotalArrears(c) || 0));
      const lateFee = Number(c.lateFeeAmount || c.snapshotLateFee || 0);

      const gross = tuition + heads + arrears + lateFee;
      const net = Math.max(0, gross - discount);
      const paid = Number(c.paidAmount || c.directPaidAmount || 0);
      const discountPercent = gross > 0 ? ((discount / gross) * 100).toFixed(1) : "0.0";

      const progName = getName(c.studentProgram || raw.studentId?.programId) || "Other Program";
      const clsName = getName(c.studentClass || raw.studentId?.classId) || "Other Class";
      const secName = getName(c.studentSection || raw.studentId?.sectionId) || "";
      const progClass = `${progName} - ${clsName}`;

      totalDiscount += discount;
      totalGross += gross;
      totalNet += net;
      totalPaid += paid;

      records.push({
        id: c.id || c._id,
        challanNo,
        studentName: sName,
        fatherName: fName,
        rollNumber: rollNo,
        programName: progName,
        className: clsName,
        sectionName: secName,
        progClassSec: secName ? `${progClass} (${secName})` : progClass,
        month: c.month || selectedMonth,
        installmentNumber: c.installmentNumber || 1,
        grossAmount: gross,
        discountAmount: discount,
        discountPercent,
        netPayable: net,
        paidAmount: paid,
        status: c.status || 'PENDING',
      });

      // Class-wise summary
      const classKey = `${progName}__${clsName}`;
      if (!classMap.has(classKey)) {
        classMap.set(classKey, {
          programName: progName,
          className: clsName,
          discountedStudentsCount: 0,
          grossAmount: 0,
          discountAmount: 0,
          netPayable: 0,
          paidAmount: 0,
        });
      }
      const clsObj = classMap.get(classKey);
      clsObj.discountedStudentsCount += 1;
      clsObj.grossAmount += gross;
      clsObj.discountAmount += discount;
      clsObj.netPayable += net;
      clsObj.paidAmount += paid;
    }

    const classSummaryList = Array.from(classMap.values())
      .map(item => ({
        ...item,
        avgDiscountPercent: item.grossAmount > 0 ? ((item.discountAmount / item.grossAmount) * 100).toFixed(1) : "0.0",
      }))
      .sort((a, b) => b.discountAmount - a.discountAmount);

    const overallDiscountRatio = totalGross > 0 ? ((totalDiscount / totalGross) * 100).toFixed(1) : "0.0";

    return {
      itemizedRecords: records,
      classSummary: classSummaryList,
      stats: {
        totalDiscount,
        totalGross,
        totalNet,
        totalPaid,
        discountedStudentsCount: records.length,
        overallDiscountRatio,
      },
    };
  }, [challansResponse, searchQuery, selectedMonth]);

  // Export to Excel
  const handleExportExcel = () => {
    if (itemizedRecords.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no student discounts recorded matching your filters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Program & Class Summary
      const summaryRows = classSummary.map((r, idx) => ({
        "S.No": idx + 1,
        "Program": r.programName,
        "Class": r.className,
        "Discounted Students": r.discountedStudentsCount,
        "Gross Fee (PKR)": r.grossAmount,
        "Total Discount Given (PKR)": r.discountAmount,
        "Net Payable (PKR)": r.netPayable,
        "Paid Amount (PKR)": r.paidAmount,
        "Avg Discount %": `${r.avgDiscountPercent}%`,
      }));

      summaryRows.push({
        "S.No": "TOTAL",
        "Program": "-",
        "Class": "-",
        "Discounted Students": stats.discountedStudentsCount,
        "Gross Fee (PKR)": stats.totalGross,
        "Total Discount Given (PKR)": stats.totalDiscount,
        "Net Payable (PKR)": stats.totalNet,
        "Paid Amount (PKR)": stats.totalPaid,
        "Avg Discount %": `${stats.overallDiscountRatio}%`,
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Program Class Discounts");

      // Sheet 2: Itemized Student Discounts
      const studentRows = itemizedRecords.map((r, idx) => ({
        "S.No": idx + 1,
        "Student Name": r.studentName,
        "Father Name": r.fatherName,
        "Roll Number": r.rollNumber,
        "Program & Class": r.progClassSec,
        "Challan No": r.challanNo,
        "Month": r.month,
        "Gross Fee (PKR)": r.grossAmount,
        "Discount Granted (PKR)": r.discountAmount,
        "Discount %": `${r.discountPercent}%`,
        "Net Payable (PKR)": r.netPayable,
        "Paid Amount (PKR)": r.paidAmount,
        "Status": r.status,
      }));

      const wsStudents = XLSX.utils.json_to_sheet(studentRows);
      XLSX.utils.book_append_sheet(wb, wsStudents, "Itemized Students");

      const fileName = `Fee_Discount_Report_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export Successful",
        description: `Exported ${itemizedRecords.length} student discount records to ${fileName}`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel file",
        variant: "destructive",
      });
    }
  };

  // Print / Save as PDF
  const handlePrint = async () => {
    if (itemizedRecords.length === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no student discounts recorded matching your filters.",
        variant: "destructive",
      });
      return;
    }

    // 1. Fetch brand logo as Data URL for standalone printing
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

    const sessionObj = academicSessions.find(s => extractId(s) === selectedSession);
    const sessionName = selectedSession === "all" ? "All Sessions" : (sessionObj?.name || sessionObj?.sessionName || selectedSession);
    const currentDateStr = format(new Date(), "dd MMM yyyy, hh:mm a");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Student Discount Report - ${selectedMonth}</title>
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
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 12px;
              font-size: 9.5px;
              line-height: 1.35;
            }
            .report-container {
              width: 100%;
              border: 1.5px solid #0f172a;
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
            .filters-bar {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 5px 12px;
              margin-bottom: 10px;
              display: flex;
              flex-wrap: wrap;
              gap: 16px;
              font-size: 9.5px;
            }
            .summary-cards-bar {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
              margin-bottom: 12px;
            }
            .stat-card {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 6px 8px;
              text-align: center;
            }
            .stat-label {
              font-size: 8.5px;
              font-weight: 700;
              text-transform: uppercase;
              color: #475569;
            }
            .stat-value {
              font-size: 13px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
            }
            thead th {
              background: #f1f5f9;
              color: #0f172a;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              padding: 5px 6px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }
            td {
              padding: 5px 6px;
              font-size: 9.5px;
              border: 1px solid #e2e8f0;
            }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .badge-discount {
              color: #0f766e;
              background: #f0fdfa;
              border: 1px solid #99f6e4;
              padding: 1px 5px;
              border-radius: 3px;
              font-weight: 700;
              font-size: 8.5px;
            }
            .bg-total { background: #f8fafc; font-weight: 800; }
            .footer-sign {
              margin-top: 24px;
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              border-top: 1px dashed #cbd5e1;
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
                </div>
              </div>
              <div class="meta-box">
                <div><strong>Printed Date:</strong> ${currentDateStr}</div>
                <div><strong>Beneficiaries:</strong> ${stats.discountedStudentsCount} Students</div>
              </div>
            </div>

            <!-- CENTERED CALLIGRAPHY TITLE FOR REPORT NAME -->
            <div class="center-calligraphy-title">
              Student Fee Discount &amp; Concession Report - ${selectedMonth}
            </div>

            <div class="filters-bar">
              <div><strong>Month:</strong> <span>${selectedMonth}</span></div>
              <div><strong>Academic Session:</strong> <span>${sessionName}</span></div>
              <div><strong>Total Discount Given:</strong> <span style="color: #0f766e; font-weight: 700;">PKR ${stats.totalDiscount.toLocaleString()}</span></div>
              <div><strong>Average Concession Ratio:</strong> <span>${stats.overallDiscountRatio}%</span></div>
            </div>

            <div class="summary-cards-bar">
              <div class="stat-card">
                <div class="stat-label">Total Discounts Given</div>
                <div class="stat-value" style="color: #0f766e;">PKR ${stats.totalDiscount.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Discounted Students</div>
                <div class="stat-value">${stats.discountedStudentsCount}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Gross Billed Fee</div>
                <div class="stat-value">PKR ${stats.totalGross.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Net Realized Payable</div>
                <div class="stat-value">PKR ${stats.totalNet.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Average Discount Rate</div>
                <div class="stat-value" style="color: #0f766e;">${stats.overallDiscountRatio}%</div>
              </div>
            </div>

            <h3 style="font-size: 11px; margin: 8px 0 4px 0; text-transform: uppercase;">1. Program &amp; Class Wise Discount Summary</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 25px;">#</th>
                  <th>Program</th>
                  <th>Class</th>
                  <th class="text-right">Students</th>
                  <th class="text-right">Gross Fee</th>
                  <th class="text-right">Discounts Granted</th>
                  <th class="text-right">Net Payable</th>
                  <th class="text-right">Inflow Paid</th>
                  <th class="text-right">Avg Discount %</th>
                </tr>
              </thead>
              <tbody>
                ${classSummary.map((r, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td class="font-bold">${r.programName}</td>
                    <td>${r.className}</td>
                    <td class="text-right">${r.discountedStudentsCount}</td>
                    <td class="text-right">PKR ${r.grossAmount.toLocaleString()}</td>
                    <td class="text-right font-bold" style="color: #0f766e;">PKR ${r.discountAmount.toLocaleString()}</td>
                    <td class="text-right">PKR ${r.netPayable.toLocaleString()}</td>
                    <td class="text-right" style="color: #15803d;">PKR ${r.paidAmount.toLocaleString()}</td>
                    <td class="text-right font-bold">${r.avgDiscountPercent}%</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="bg-total">
                  <td colspan="3" class="text-right font-bold">TOTAL:</td>
                  <td class="text-right font-bold">${stats.discountedStudentsCount}</td>
                  <td class="text-right font-bold">PKR ${stats.totalGross.toLocaleString()}</td>
                  <td class="text-right font-bold" style="color: #0f766e;">PKR ${stats.totalDiscount.toLocaleString()}</td>
                  <td class="text-right font-bold">PKR ${stats.totalNet.toLocaleString()}</td>
                  <td class="text-right font-bold" style="color: #15803d;">PKR ${stats.totalPaid.toLocaleString()}</td>
                  <td class="text-right font-bold">${stats.overallDiscountRatio}%</td>
                </tr>
              </tfoot>
            </table>

            <h3 style="font-size: 11px; margin: 12px 0 4px 0; text-transform: uppercase;">2. Itemized Beneficiary Students (${itemizedRecords.length} Students)</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 25px;">#</th>
                  <th>Student Name / Roll No</th>
                  <th>Program / Class</th>
                  <th>Challan #</th>
                  <th class="text-right">Gross Fee</th>
                  <th class="text-right">Discount Given</th>
                  <th class="text-right">Discount %</th>
                  <th class="text-right">Net Payable</th>
                  <th class="text-right">Paid Amount</th>
                  <th style="text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${itemizedRecords.map((r, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>
                      <div class="font-bold">${r.studentName}</div>
                      <div style="font-size: 8.5px; color: #64748b;">${r.rollNumber ? 'Roll: ' + r.rollNumber : ''} ${r.fatherName ? '• S/O ' + r.fatherName : ''}</div>
                    </td>
                    <td>${r.progClassSec}</td>
                    <td class="font-mono">#${r.challanNo}</td>
                    <td class="text-right">PKR ${r.grossAmount.toLocaleString()}</td>
                    <td class="text-right font-bold" style="color: #0f766e;">PKR ${r.discountAmount.toLocaleString()}</td>
                    <td class="text-right">${r.discountPercent}%</td>
                    <td class="text-right">PKR ${r.netPayable.toLocaleString()}</td>
                    <td class="text-right" style="color: #15803d;">PKR ${r.paidAmount.toLocaleString()}</td>
                    <td style="text-align: center; font-size: 8.5px; font-weight: 700;">${r.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer-sign no-break">
              <div><strong>Prepared By:</strong> _____________________</div>
              <div><strong>Accounts Officer:</strong> _____________________</div>
              <div><strong>Scholarship Committee:</strong> _____________________</div>
              <div><strong>Principal:</strong> _____________________</div>
            </div>
          </div>
        </body>
      </html>
    `;

    await openManagedPrintWindow({
      html,
      title: `Student Discount Report - ${selectedMonth}`,
      toast,
    });
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Top Bar with Back and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground -ml-1 h-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Reports
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {itemizedRecords.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-1.5 h-8 text-xs font-medium text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Export to Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 h-8 text-xs font-medium"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save as PDF
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedSession(defaultSessionId);
              setSelectedMonth(currentMonthName);
              setSelectedPrograms([]);
              setSelectedClasses([]);
              setSearchQuery("");
            }}
            className="h-8 px-2.5 text-xs text-muted-foreground gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main Card */}
      <Card className="border border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              
              <div>
                
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Tag className="w-5 h-5 text-teal-600" />
                  Student Discount Report (Month-Wise)
                </CardTitle>
                <CardDescription>
                  Program and class-wise breakdown of fee discounts and institutional concessions awarded to students for {selectedMonth}.
                </CardDescription>
              </div>
            </div>
            {isFetching && (
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1 animate-pulse">
                Refreshing...
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end bg-muted/20 p-3 rounded-lg border border-border/50">
            {/* Month Filter */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Month <span className="text-primary font-bold">*</span>
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 text-xs font-medium">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Academic Session */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Session
              </Label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {academicSessions.map(s => {
                    const val = extractId(s);
                    return (
                      <SelectItem key={val} value={val}>
                        {s.name || s.sessionName || "Session"} {s.isActive ? "(Active)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Program Multi-select */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Program
              </Label>
              <MultiSelectFilter
                options={programs.map(p => ({ value: extractId(p), label: p.name || p.programName || p.title }))}
                selected={selectedPrograms}
                onChange={handleProgramsChange}
                placeholder="Programs"
                allLabel="All Programs"
                defaultSelectedAll={false}
                triggerClassName="h-9 text-xs"
              />
            </div>

            {/* Class Multi-select */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Class
              </Label>
              <MultiSelectFilter
                options={availableClasses.map(c => ({ value: extractId(c), label: c.name || c.className }))}
                selected={selectedClasses}
                onChange={setSelectedClasses}
                placeholder="Classes"
                allLabel="All Classes"
                triggerClassName="h-9 text-xs"
              />
            </div>

            {/* Search Input */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Search Student
              </Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name, Roll #, Challan #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <Card className="p-3 border-teal-200 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20 shadow-none">
              <div className="text-[10px] font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wide">
                Total Discounts Granted
              </div>
              <div className="text-base font-bold text-teal-800 dark:text-teal-200 mt-1">
                PKR {stats.totalDiscount.toLocaleString()}
              </div>
              <div className="text-[10px] text-teal-700/80 dark:text-teal-400 mt-0.5">
                {stats.discountedStudentsCount} recipient students
              </div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Average Concession Rate
              </div>
              <div className="text-base font-bold text-foreground mt-1">
                {stats.overallDiscountRatio}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Of gross fees discounted</div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Gross Fee Before Discount
              </div>
              <div className="text-base font-bold text-foreground mt-1">
                PKR {stats.totalGross.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Full nominal fee billed</div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Net Realized Payable
              </div>
              <div className="text-base font-bold text-foreground mt-1">
                PKR {stats.totalNet.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">After concession deduction</div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Recovered / Paid
              </div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                PKR {stats.totalPaid.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Paid by discounted students</div>
            </Card>
          </div>

          {/* View Switcher Bar */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Button
                variant={activeView === "classSummary" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveView("classSummary")}
                className="text-xs h-7 gap-1.5"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Program &amp; Class Summary ({classSummary.length})
              </Button>
              <Button
                variant={activeView === "itemized" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveView("itemized")}
                className="text-xs h-7 gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                Itemized Students ({itemizedRecords.length})
              </Button>
            </div>
          </div>

          {/* Table or States */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Computing student fee discount analysis for {selectedMonth}...</p>
            </div>
          ) : itemizedRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <h3 className="font-semibold text-sm">No Student Discounts Found for {selectedMonth}</h3>
              <p className="text-xs text-muted-foreground">
                There are no challans with recorded fee discounts matching your selected filters.
              </p>
            </div>
          ) : activeView === "classSummary" ? (
            /* Program & Class Summary View */
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                    <TableRow className="bg-muted/50 border-b">
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground w-10">#</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Program</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Class</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Discounted Students</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Gross Fee</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Total Discount Given</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Net Payable</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Paid Amount</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Avg Discount %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classSummary.map((r, idx) => (
                      <TableRow key={`${r.programName}_${r.className}`} className="hover:bg-muted/30">
                        <TableCell className="py-2 px-3 text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="py-2 px-3 font-medium">{r.programName}</TableCell>
                        <TableCell className="py-2 px-3">{r.className}</TableCell>
                        <TableCell className="py-2 px-3 text-right font-medium">{r.discountedStudentsCount}</TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono">
                          PKR {r.grossAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                          PKR {r.discountAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-medium">
                          PKR {r.netPayable.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                          PKR {r.paidAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-semibold">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-teal-50 text-teal-800 border-teal-200">
                            {r.avgDiscountPercent}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow className="bg-muted/70 font-bold border-t-2">
                      <TableCell colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider text-xs">
                        TOTAL:
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right">{stats.discountedStudentsCount}</TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono">
                        PKR {stats.totalGross.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono text-teal-700 dark:text-teal-300">
                        PKR {stats.totalDiscount.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono">
                        PKR {stats.totalNet.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300">
                        PKR {stats.totalPaid.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono">
                        {stats.overallDiscountRatio}%
                      </TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            </div>
          ) : (
            /* Itemized Student View */
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                    <TableRow className="bg-muted/50 border-b">
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground w-10">#</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Student &amp; Roll No</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Program &amp; Class</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Challan #</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Gross Amount</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Discount Granted</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Discount %</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Net Payable</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Paid Amount</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemizedRecords.map((r, idx) => (
                      <TableRow key={r.id || idx} className="hover:bg-muted/30">
                        <TableCell className="py-2 px-3 text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="py-2 px-3">
                          <div className="font-semibold text-foreground">{r.studentName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.rollNumber ? `Roll: ${r.rollNumber}` : ""} {r.fatherName ? `• S/O ${r.fatherName}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground">
                          {r.progClassSec}
                        </TableCell>
                        <TableCell className="py-2 px-3 font-mono font-medium">
                          #{r.challanNo}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono">
                          PKR {r.grossAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                          PKR {r.discountAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-medium">
                          {r.discountPercent}%
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-medium">
                          PKR {r.netPayable.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                          PKR {r.paidAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 font-semibold ${
                              r.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : r.status === "PARTIAL"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow className="bg-muted/70 font-bold border-t-2">
                      <TableCell colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider text-xs">
                        TOTAL:
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono">
                        PKR {stats.totalGross.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono text-teal-700 dark:text-teal-300">
                        PKR {stats.totalDiscount.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono">
                        {stats.overallDiscountRatio}%
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono">
                        PKR {stats.totalNet.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300">
                        PKR {stats.totalPaid.toLocaleString()}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
