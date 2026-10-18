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
  Layers,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
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

export const FeeSummaryReport = ({
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
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [expandHeads, setExpandHeads] = useState(true);

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

  // Query challans for month summary
  const programParam = selectedPrograms.length > 0 ? selectedPrograms.join(',') : undefined;
  const classParam = selectedClasses.length > 0 ? selectedClasses.join(',') : undefined;

  const {
    data: challansResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      'feeSummaryReport',
      selectedSession,
      selectedMonth,
      programParam,
      classParam,
      selectedStatus,
    ],
    queryFn: () => getFeeChallans({
      sessionId: selectedSession !== 'all' ? selectedSession : undefined,
      month: selectedMonth !== 'all' ? selectedMonth : undefined,
      programId: programParam,
      classId: classParam,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      report: 'true',
      limit: 50000,
    }),
  });

  // Financial aggregates calculation
  const summaryData = useMemo(() => {
    const rawList = Array.isArray(challansResponse)
      ? challansResponse
      : (Array.isArray(challansResponse?.data) ? challansResponse.data : []);

    let totalChallans = 0;
    let totalTuition = 0;
    let totalArrears = 0;
    let totalLateFee = 0;
    let totalDiscount = 0;
    let totalGross = 0;
    let totalNet = 0;
    let totalCollected = 0;
    let totalPending = 0;

    // Unified Heads map: headName -> { name, billedAmount, collectedAmount, count }
    const headsMap = new Map();
    let totalHeadsBilled = 0;

    // Class / Program breakdown map: key -> { programName, className, challanCount, tuition, heads, arrears, lateFee, discount, gross, net, collected, pending }
    const classBreakdownMap = new Map();

    for (const raw of rawList) {
      const c = normalizeChallan(raw);
      if (!c) continue;
      if (['VOID', 'SUPERSEDED'].includes(c.status)) continue;

      totalChallans += 1;

      const tuition = Number(c.basePayable || 0);
      const arrears = Number(c.arrearsAmount > 0 ? c.arrearsAmount : (getTotalArrears(c) || 0));
      const lateFee = Number(c.lateFeeAmount || c.snapshotLateFee || c.fineAmount || 0);
      const discount = Number(c.discountAmount || c.discount || 0);
      const paid = Number(c.paidAmount || c.directPaidAmount || 0);

      // Process unified fee heads (both predefined & custom heads)
      const headsList = Array.isArray(c.challanHeads) && c.challanHeads.length > 0
        ? c.challanHeads
        : (Array.isArray(c.heads) ? c.heads : []);

      let challanHeadsTotal = 0;
      if (headsList.length > 0) {
        for (const h of headsList) {
          const hName = h.name || h.title || "Other Charges";
          const hAmount = Number(h.amount || 0);
          if (hAmount <= 0) continue;

          challanHeadsTotal += hAmount;

          const existing = headsMap.get(hName) || { name: hName, amount: 0, count: 0 };
          existing.amount += hAmount;
          existing.count += 1;
          headsMap.set(hName, existing);
        }
      } else if (Number(c.headsAmount || 0) > 0) {
        challanHeadsTotal = Number(c.headsAmount || 0);
        const existing = headsMap.get("General Fee Heads") || { name: "General Fee Heads", amount: 0, count: 0 };
        existing.amount += challanHeadsTotal;
        existing.count += 1;
        headsMap.set("General Fee Heads", existing);
      }

      totalHeadsBilled += challanHeadsTotal;
      totalTuition += tuition;
      totalArrears += arrears;
      totalLateFee += lateFee;
      totalDiscount += discount;

      const challanGross = tuition + challanHeadsTotal + arrears + lateFee;
      const challanNet = Math.max(0, challanGross - discount);
      const challanPending = Math.max(0, challanNet - paid);

      totalGross += challanGross;
      totalNet += challanNet;
      totalCollected += paid;
      totalPending += challanPending;

      // Class / Program grouping
      const progName = getName(c.studentProgram || c.studentId?.programId) || "Other Program";
      const clsName = getName(c.studentClass || c.studentId?.classId) || "Other Class";
      const classKey = `${progName}__${clsName}`;

      if (!classBreakdownMap.has(classKey)) {
        classBreakdownMap.set(classKey, {
          programName: progName,
          className: clsName,
          challanCount: 0,
          tuition: 0,
          heads: 0,
          arrears: 0,
          lateFee: 0,
          discount: 0,
          gross: 0,
          net: 0,
          collected: 0,
          pending: 0,
        });
      }

      const clsGroup = classBreakdownMap.get(classKey);
      clsGroup.challanCount += 1;
      clsGroup.tuition += tuition;
      clsGroup.heads += challanHeadsTotal;
      clsGroup.arrears += arrears;
      clsGroup.lateFee += lateFee;
      clsGroup.discount += discount;
      clsGroup.gross += challanGross;
      clsGroup.net += challanNet;
      clsGroup.collected += paid;
      clsGroup.pending += challanPending;
    }

    const headsBreakdown = Array.from(headsMap.values()).sort((a, b) => b.amount - a.amount);
    const classBreakdown = Array.from(classBreakdownMap.values()).sort((a, b) =>
      a.programName.localeCompare(b.programName) || a.className.localeCompare(b.className)
    );

    const collectionRate = totalNet > 0 ? ((totalCollected / totalNet) * 100).toFixed(1) : "0.0";

    return {
      totalChallans,
      totalTuition,
      totalHeadsBilled,
      headsBreakdown,
      totalArrears,
      totalLateFee,
      totalDiscount,
      totalGross,
      totalNet,
      totalCollected,
      totalPending,
      collectionRate,
      classBreakdown,
    };
  }, [challansResponse]);

  // Export to Excel
  const handleExportExcel = () => {
    if (summaryData.totalChallans === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no fee records matching the selected month and filters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Category Summary
      const categoryRows = [
        { "Category / Fee Component": "1. Tuition Fee", "Billed (PKR)": summaryData.totalTuition, "Notes": "Standard class base tuition" },
        { "Category / Fee Component": "2. Fee Heads (Combined Predefined & Custom)", "Billed (PKR)": summaryData.totalHeadsBilled, "Notes": `${summaryData.headsBreakdown.length} active fee head items` },
        ...summaryData.headsBreakdown.map(h => ({
          "Category / Fee Component": `   • ${h.name}`,
          "Billed (PKR)": h.amount,
          "Notes": `Applied across ${h.count} challans`,
        })),
        { "Category / Fee Component": "3. Arrears Amount", "Billed (PKR)": summaryData.totalArrears, "Notes": "Prior months unpaid rollover" },
        { "Category / Fee Component": "4. Late Fee Fine", "Billed (PKR)": summaryData.totalLateFee, "Notes": "Accumulated overdue late fines" },
        { "Category / Fee Component": "5. Less: Student Discounts", "Billed (PKR)": -summaryData.totalDiscount, "Notes": "Institutional / Merit fee reductions" },
        { "Category / Fee Component": "GROSS TOTAL BILLED", "Billed (PKR)": summaryData.totalGross, "Notes": "Tuition + Heads + Arrears + Fines" },
        { "Category / Fee Component": "NET PAYABLE BILLED", "Billed (PKR)": summaryData.totalNet, "Notes": "Gross Billed minus Discounts" },
        { "Category / Fee Component": "TOTAL INFLOW COLLECTED", "Billed (PKR)": summaryData.totalCollected, "Notes": `Recovery Rate: ${summaryData.collectionRate}%` },
        { "Category / Fee Component": "TOTAL OUTSTANDING BALANCE", "Billed (PKR)": summaryData.totalPending, "Notes": "Pending / Unpaid balance" },
      ];

      const wsCategory = XLSX.utils.json_to_sheet(categoryRows);
      XLSX.utils.book_append_sheet(wb, wsCategory, "Fee Summary");

      // Sheet 2: Class Breakdown
      const classRows = summaryData.classBreakdown.map((row, idx) => ({
        "S.No": idx + 1,
        "Program": row.programName,
        "Class": row.className,
        "Challans Count": row.challanCount,
        "Tuition Fee (PKR)": row.tuition,
        "Fee Heads (PKR)": row.heads,
        "Arrears (PKR)": row.arrears,
        "Late Fee (PKR)": row.lateFee,
        "Discounts (PKR)": row.discount,
        "Net Billed (PKR)": row.net,
        "Collected (PKR)": row.collected,
        "Outstanding (PKR)": row.pending,
        "Recovery Rate (%)": row.net > 0 ? ((row.collected / row.net) * 100).toFixed(1) + "%" : "0.0%",
      }));

      classRows.push({
        "S.No": "TOTAL",
        "Program": "-",
        "Class": "-",
        "Challans Count": summaryData.totalChallans,
        "Tuition Fee (PKR)": summaryData.totalTuition,
        "Fee Heads (PKR)": summaryData.totalHeadsBilled,
        "Arrears (PKR)": summaryData.totalArrears,
        "Late Fee (PKR)": summaryData.totalLateFee,
        "Discounts (PKR)": summaryData.totalDiscount,
        "Net Billed (PKR)": summaryData.totalNet,
        "Collected (PKR)": summaryData.totalCollected,
        "Outstanding (PKR)": summaryData.totalPending,
        "Recovery Rate (%)": summaryData.collectionRate + "%",
      });

      const wsClass = XLSX.utils.json_to_sheet(classRows);
      XLSX.utils.book_append_sheet(wb, wsClass, "Program Class Breakdown");

      const fileName = `Fee_Summary_Report_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export Successful",
        description: `Exported ${fileName} successfully.`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel file",
        variant: "destructive",
      });
    }
  };

  // Print / Save PDF
  const handlePrint = async () => {
    if (summaryData.totalChallans === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no fee records matching the selected month and filters.",
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
          <title>Fee Summary Report - ${selectedMonth}</title>
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
              font-size: 10px;
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
              font-size: 10px;
            }
            .summary-cards-bar {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
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
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              padding: 6px 8px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }
            td {
              padding: 5px 8px;
              font-size: 10px;
              border: 1px solid #e2e8f0;
            }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .bg-total { background: #f8fafc; font-weight: 800; }
            .head-indent { padding-left: 18px; color: #475569; font-size: 9.5px; }
            .footer-sign {
              margin-top: 24px;
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 10px;
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
                  <div class="tagline">A Project of Beaconhouse</div>
                </div>
              </div>
              <div class="meta-box">
                <div><strong>Printed Date:</strong> ${currentDateStr}</div>
                <div><strong>Challans Audited:</strong> ${summaryData.totalChallans}</div>
              </div>
            </div>

            <!-- CENTERED CALLIGRAPHY TITLE FOR REPORT NAME -->
            <div class="center-calligraphy-title">
              Monthly Fee Summary Report - ${selectedMonth}
            </div>

            <div class="filters-bar">
              <div><strong>Month:</strong> <span>${selectedMonth}</span></div>
              <div><strong>Academic Session:</strong> <span>${sessionName}</span></div>
              <div><strong>Status Filter:</strong> <span>${selectedStatus.toUpperCase()}</span></div>
              <div><strong>Recovery Rate:</strong> <span>${summaryData.collectionRate}%</span></div>
            </div>

            <div class="summary-cards-bar">
              <div class="stat-card">
                <div class="stat-label">Tuition Fee</div>
                <div class="stat-value">PKR ${summaryData.totalTuition.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Fee Heads</div>
                <div class="stat-value">PKR ${summaryData.totalHeadsBilled.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Discounts</div>
                <div class="stat-value" style="color: #059669;">PKR ${summaryData.totalDiscount.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Net Billed</div>
                <div class="stat-value">PKR ${summaryData.totalNet.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Inflow</div>
                <div class="stat-value" style="color: #1d4ed8;">PKR ${summaryData.totalCollected.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Pending Dues</div>
                <div class="stat-value" style="color: #b91c1c;">PKR ${summaryData.totalPending.toLocaleString()}</div>
              </div>
            </div>

            <h3 style="font-size: 11px; margin: 8px 0 4px 0; text-transform: uppercase;">1. Fee Category Collection Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 35%;">Category / Component</th>
                  <th class="text-right">Billed Amount (PKR)</th>
                  <th class="text-right">Collected Inflow (PKR)</th>
                  <th class="text-right">Balance Due (PKR)</th>
                  <th style="width: 25%;">Notes / Context</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="font-bold">Tuition Fee</td>
                  <td class="text-right">PKR ${summaryData.totalTuition.toLocaleString()}</td>
                  <td class="text-right">-</td>
                  <td class="text-right">-</td>
                  <td>Base monthly tuition</td>
                </tr>
                <tr style="background: #f8fafc;">
                  <td class="font-bold">Fee Heads (Combined Predefined & Custom)</td>
                  <td class="text-right font-bold">PKR ${summaryData.totalHeadsBilled.toLocaleString()}</td>
                  <td class="text-right">-</td>
                  <td class="text-right">-</td>
                  <td>${summaryData.headsBreakdown.length} unique fee heads active</td>
                </tr>
                ${summaryData.headsBreakdown.map(h => `
                  <tr>
                    <td class="head-indent">• ${h.name}</td>
                    <td class="text-right" style="color: #475569;">PKR ${h.amount.toLocaleString()}</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td style="color: #64748b; font-size: 9px;">Applied in ${h.count} challans</td>
                  </tr>
                `).join('')}
                <tr>
                  <td class="font-bold">Arrears Amount</td>
                  <td class="text-right">PKR ${summaryData.totalArrears.toLocaleString()}</td>
                  <td class="text-right">-</td>
                  <td class="text-right">-</td>
                  <td>Prior uncollected balance</td>
                </tr>
                <tr>
                  <td class="font-bold">Late Fee Fine</td>
                  <td class="text-right">PKR ${summaryData.totalLateFee.toLocaleString()}</td>
                  <td class="text-right">-</td>
                  <td class="text-right">-</td>
                  <td>Late payment fine adjustments</td>
                </tr>
                <tr style="color: #059669;">
                  <td class="font-bold">Less: Discounts Granted</td>
                  <td class="text-right font-bold">- PKR ${summaryData.totalDiscount.toLocaleString()}</td>
                  <td class="text-right">-</td>
                  <td class="text-right">-</td>
                  <td>Institutional fee reductions</td>
                </tr>
                <tr class="bg-total">
                  <td>NET TOTAL FOR ${selectedMonth.toUpperCase()}</td>
                  <td class="text-right">PKR ${summaryData.totalNet.toLocaleString()}</td>
                  <td class="text-right" style="color: #1d4ed8;">PKR ${summaryData.totalCollected.toLocaleString()}</td>
                  <td class="text-right" style="color: #b91c1c;">PKR ${summaryData.totalPending.toLocaleString()}</td>
                  <td>Recovery: ${summaryData.collectionRate}%</td>
                </tr>
              </tbody>
            </table>

            <h3 style="font-size: 11px; margin: 12px 0 4px 0; text-transform: uppercase;">2. Program & Class Wise Fee Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 30px;">#</th>
                  <th>Program</th>
                  <th>Class</th>
                  <th class="text-right">Challans</th>
                  <th class="text-right">Tuition</th>
                  <th class="text-right">Heads</th>
                  <th class="text-right">Discounts</th>
                  <th class="text-right">Net Billed</th>
                  <th class="text-right">Inflow Paid</th>
                  <th class="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${summaryData.classBreakdown.map((r, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td class="font-bold">${r.programName}</td>
                    <td>${r.className}</td>
                    <td class="text-right">${r.challanCount}</td>
                    <td class="text-right">PKR ${r.tuition.toLocaleString()}</td>
                    <td class="text-right">PKR ${r.heads.toLocaleString()}</td>
                    <td class="text-right" style="color: #059669;">PKR ${r.discount.toLocaleString()}</td>
                    <td class="text-right font-bold">PKR ${r.net.toLocaleString()}</td>
                    <td class="text-right" style="color: #1d4ed8;">PKR ${r.collected.toLocaleString()}</td>
                    <td class="text-right" style="color: #b91c1c;">PKR ${r.pending.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="bg-total">
                  <td colspan="3" class="text-right font-bold">TOTAL:</td>
                  <td class="text-right font-bold">${summaryData.totalChallans}</td>
                  <td class="text-right font-bold">PKR ${summaryData.totalTuition.toLocaleString()}</td>
                  <td class="text-right font-bold">PKR ${summaryData.totalHeadsBilled.toLocaleString()}</td>
                  <td class="text-right font-bold" style="color: #059669;">PKR ${summaryData.totalDiscount.toLocaleString()}</td>
                  <td class="text-right font-bold">PKR ${summaryData.totalNet.toLocaleString()}</td>
                  <td class="text-right font-bold" style="color: #1d4ed8;">PKR ${summaryData.totalCollected.toLocaleString()}</td>
                  <td class="text-right font-bold" style="color: #b91c1c;">PKR ${summaryData.totalPending.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            <div class="footer-sign no-break">
              <div><strong>Prepared By:</strong> _____________________</div>
              <div><strong>Accounts Officer:</strong> _____________________</div>
              <div><strong>Audited By:</strong> _____________________</div>
              <div><strong>Principal / Director:</strong> _____________________</div>
            </div>
          </div>
        </body>
      </html>
    `;

    await openManagedPrintWindow({
      html,
      title: `Fee Summary Report - ${selectedMonth}`,
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
          {summaryData.totalChallans > 0 && (
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
              setSelectedStatus("all");
            }}
            className="h-8 px-2.5 text-xs text-muted-foreground gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main Report Card */}
      <Card className="border border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  Fee Summary Report (Month-Wise)
                </CardTitle>
                <CardDescription>
                  Audited monthly fee breakdown by category (Tuition, unified Fee Heads, Arrears, Late Fines, and Discounts) versus actual collections.
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
          {/* Filter Bar */}
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

            {/* Status Filter */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Challan Status
              </Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PAID">Paid Only</SelectItem>
                  <SelectItem value="PARTIAL">Partial Paid</SelectItem>
                  <SelectItem value="PENDING">Pending / Unpaid</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Tuition Fee
              </div>
              <div className="text-base font-bold text-foreground mt-1">
                PKR {summaryData.totalTuition.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Base tuition billed</div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Unified Fee Heads
              </div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                PKR {summaryData.totalHeadsBilled.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {summaryData.headsBreakdown.length} active head components
              </div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Arrears &amp; Fines
              </div>
              <div className="text-base font-bold text-amber-700 dark:text-amber-400 mt-1">
                PKR {(summaryData.totalArrears + summaryData.totalLateFee).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Arr: {summaryData.totalArrears.toLocaleString()} | Fine: {summaryData.totalLateFee.toLocaleString()}
              </div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Discounts Given
              </div>
              <div className="text-base font-bold text-teal-700 dark:text-teal-400 mt-1">
                PKR {summaryData.totalDiscount.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Fee concessions</div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Net Billed
              </div>
              <div className="text-base font-bold text-foreground mt-1">
                PKR {summaryData.totalNet.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {summaryData.totalChallans} challans
              </div>
            </Card>

            <Card className="p-3 border-border/60 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 shadow-none">
              <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center justify-between">
                <span>Total Inflow</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 border-emerald-300">
                  {summaryData.collectionRate}%
                </Badge>
              </div>
              <div className="text-base font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                PKR {summaryData.totalCollected.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                Pending: PKR {summaryData.totalPending.toLocaleString()}
              </div>
            </Card>
          </div>

          {/* Loading or Empty State */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Computing month fee category summary...</p>
            </div>
          ) : summaryData.totalChallans === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <h3 className="font-semibold text-sm">No Challans Found for {selectedMonth}</h3>
              <p className="text-xs text-muted-foreground">
                No fee records match the selected month and filter combination.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category Breakdown Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-primary" />
                    1. Fee Category Collection Summary
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandHeads(!expandHeads)}
                    className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    {expandHeads ? "Collapse Head Details" : "Expand Head Details"}
                  </Button>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Category / Component</TableHead>
                        <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Billed Amount</TableHead>
                        <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Component Details / Active Heads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Tuition Fee */}
                      <TableRow className="hover:bg-muted/30">
                        <TableCell className="py-2.5 px-3 font-semibold">Tuition Fee</TableCell>
                        <TableCell className="py-2.5 px-3 text-right font-medium">
                          PKR {summaryData.totalTuition.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-muted-foreground">
                          Base monthly program tuition charges
                        </TableCell>
                      </TableRow>

                      {/* Fee Heads Header */}
                      <TableRow
                        className="hover:bg-muted/30 cursor-pointer bg-muted/10"
                        onClick={() => setExpandHeads(!expandHeads)}
                      >
                        <TableCell className="py-2.5 px-3 font-semibold flex items-center gap-1.5">
                          {expandHeads ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          Fee Heads (Combined Predefined &amp; Custom)
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                          PKR {summaryData.totalHeadsBilled.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-muted-foreground">
                          {summaryData.headsBreakdown.length} unique fee heads applied
                        </TableCell>
                      </TableRow>

                      {/* Expanded Fee Heads */}
                      {expandHeads && summaryData.headsBreakdown.map(h => (
                        <TableRow key={h.name} className="hover:bg-muted/20 bg-muted/5">
                          <TableCell className="py-1.5 px-3 pl-8 text-xs text-muted-foreground">
                            • {h.name}
                          </TableCell>
                          <TableCell className="py-1.5 px-3 text-right text-xs font-mono text-muted-foreground">
                            PKR {h.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-1.5 px-3 text-[11px] text-muted-foreground/80">
                            Applied across {h.count} challans
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Arrears */}
                      <TableRow className="hover:bg-muted/30">
                        <TableCell className="py-2.5 px-3 font-semibold">Arrears Amount</TableCell>
                        <TableCell className="py-2.5 px-3 text-right font-medium text-amber-700 dark:text-amber-400">
                          PKR {summaryData.totalArrears.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-muted-foreground">
                          Rollover dues from prior uncollected months
                        </TableCell>
                      </TableRow>

                      {/* Late Fee */}
                      <TableRow className="hover:bg-muted/30">
                        <TableCell className="py-2.5 px-3 font-semibold">Late Fee Fine</TableCell>
                        <TableCell className="py-2.5 px-3 text-right font-medium text-amber-700 dark:text-amber-400">
                          PKR {summaryData.totalLateFee.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-muted-foreground">
                          Overdue late fee adjustments
                        </TableCell>
                      </TableRow>

                      {/* Discounts */}
                      <TableRow className="hover:bg-muted/30 text-teal-700 dark:text-teal-400">
                        <TableCell className="py-2.5 px-3 font-semibold">Less: Student Discounts</TableCell>
                        <TableCell className="py-2.5 px-3 text-right font-semibold">
                          - PKR {summaryData.totalDiscount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-xs">
                          Institutional concessions deducted from payable
                        </TableCell>
                      </TableRow>

                      {/* Net Totals */}
                      <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
                        <TableCell className="py-3 px-3 uppercase tracking-wider text-xs">
                          Total Net Billed ({selectedMonth})
                        </TableCell>
                        <TableCell className="py-3 px-3 text-right text-sm">
                          PKR {summaryData.totalNet.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-700 dark:text-emerald-400">
                              Collected: <strong>PKR {summaryData.totalCollected.toLocaleString()}</strong> ({summaryData.collectionRate}%)
                            </span>
                            <span className="text-destructive">
                              Balance: <strong>PKR {summaryData.totalPending.toLocaleString()}</strong>
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Program & Class Breakdown Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  2. Program &amp; Class Breakdown ({summaryData.classBreakdown.length} Classes)
                </h4>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                    <Table className="text-xs">
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                        <TableRow className="bg-muted/50 border-b">
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground w-10">#</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Program</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Class</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Challans</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Tuition</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Fee Heads</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Discounts</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Net Billed</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Collected Inflow</TableHead>
                          <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryData.classBreakdown.map((row, idx) => (
                          <TableRow key={`${row.programName}_${row.className}`} className="hover:bg-muted/30">
                            <TableCell className="py-2 px-3 text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="py-2 px-3 font-medium">{row.programName}</TableCell>
                            <TableCell className="py-2 px-3">{row.className}</TableCell>
                            <TableCell className="py-2 px-3 text-right">{row.challanCount}</TableCell>
                            <TableCell className="py-2 px-3 text-right font-mono">
                              PKR {row.tuition.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                              PKR {row.heads.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-right font-mono text-teal-700 dark:text-teal-400">
                              PKR {row.discount.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-right font-mono font-semibold">
                              PKR {row.net.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300 font-medium">
                              PKR {row.collected.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-right font-mono text-destructive font-medium">
                              PKR {row.pending.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <tfoot>
                        <TableRow className="bg-muted/70 font-bold border-t-2">
                          <TableCell colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider text-xs">
                            TOTAL:
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-right">{summaryData.totalChallans}</TableCell>
                          <TableCell className="py-2.5 px-3 text-right font-mono">
                            PKR {summaryData.totalTuition.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                            PKR {summaryData.totalHeadsBilled.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-right font-mono text-teal-700 dark:text-teal-400">
                            PKR {summaryData.totalDiscount.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-right font-mono">
                            PKR {summaryData.totalNet.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300">
                            PKR {summaryData.totalCollected.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-right font-mono text-destructive">
                            PKR {summaryData.totalPending.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </tfoot>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
