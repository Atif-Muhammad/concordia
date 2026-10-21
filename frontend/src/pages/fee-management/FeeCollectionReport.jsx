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
  CheckCircle,
  Clock,
  Wallet,
  Building,
  CreditCard,
  AlertCircle,
  Coins,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getFeeChallans } from "@/services/api";
import { normalizeChallan, format12HourDateTime, safeFormatDate, getTotalArrears } from "./feeFinancialUtils";

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

export const FeeCollectionReport = ({
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
  const [selectedPaymentMode, setSelectedPaymentMode] = useState("all");
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Query challans for month collection
  const {
    data: challansResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      'feeCollectionReport',
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

  // Filter and compute collection transactions
  const { collectionRecords, stats } = useMemo(() => {
    const rawList = Array.isArray(challansResponse)
      ? challansResponse
      : (Array.isArray(challansResponse?.data) ? challansResponse.data : []);

    const records = [];
    let totalInflow = 0;
    let cashInflow = 0;
    let bankInflow = 0;
    let otherInflow = 0;
    let fullyPaidCount = 0;
    let partialPaidCount = 0;

    for (const raw of rawList) {
      const c = normalizeChallan(raw);
      if (!c) continue;
      if (['VOID', 'SUPERSEDED'].includes(c.status)) continue;

      const paid = Number(c.paidAmount || c.directPaidAmount || 0);
      // Include any challan that received inflow in our system for that month
      if (paid <= 0 && !['PAID', 'PARTIAL', 'SETTLED'].includes(c.status)) {
        continue;
      }

      const mode = (c.paymentMode || raw.paymentMode || "Cash").trim();

      // Filter by payment mode if selected
      if (selectedPaymentMode !== "all") {
        if (mode.toLowerCase() !== selectedPaymentMode.toLowerCase()) {
          continue;
        }
      }

      // Filter by search query (challanNo, student name, roll number)
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
      const lateFee = Number(c.lateFeeAmount || c.snapshotLateFee || c.fineAmount || 0);
      const discount = Number(c.discountAmount || c.discount || 0);
      const calculatedGross = tuition + heads + arrears + lateFee;
      const calculatedNet = Math.max(0, calculatedGross - discount);
      const billed = Number(c.netPayable || c.totalAmount || calculatedNet);
      const balance = Math.max(0, billed - paid);

      const progName = getName(c.studentProgram || raw.studentId?.programId) || "N/A";
      const clsName = getName(c.studentClass || raw.studentId?.classId) || "N/A";
      const secName = getName(c.studentSection || raw.studentId?.sectionId) || "";
      const programClassSec = secName ? `${progName} - ${clsName} (${secName})` : `${progName} - ${clsName}`;

      // Date / Time formatting
      const rawPaidDate = c.paidDate || raw.paidDate || raw.paidAt || raw.updatedAt;
      const rawPaidTime = c.paidTime || raw.paidTime;
      const formattedDateTime = format12HourDateTime(rawPaidDate, rawPaidTime);

      const status = (c.status === 'SETTLED' ? 'PAID' : c.status) || (balance <= 0 ? 'PAID' : 'PARTIAL');

      if (status === 'PAID') fullyPaidCount += 1;
      else partialPaidCount += 1;

      totalInflow += paid;
      if (mode.toLowerCase().includes('cash')) {
        cashInflow += paid;
      } else if (mode.toLowerCase().includes('bank') || mode.toLowerCase().includes('online') || mode.toLowerCase().includes('transfer')) {
        bankInflow += paid;
      } else {
        otherInflow += paid;
      }

      records.push({
        id: c.id || c._id,
        challanNo,
        studentName: sName,
        fatherName: fName,
        rollNumber: rollNo,
        programClassSec,
        month: c.month || selectedMonth,
        installmentNumber: c.installmentNumber || 1,
        billedAmount: billed,
        paidAmount: paid,
        balanceDue: balance,
        paidDateTime: formattedDateTime,
        rawPaidDate,
        paymentMode: mode,
        walletName: c.walletName || raw.walletName || raw.walletId?.walletName || "-",
        receivedByName: c.receivedByName || raw.receivedByName || raw.paidBy || "Accounts Office",
        status,
      });
    }

    return {
      collectionRecords: records,
      stats: {
        totalInflow,
        cashInflow,
        bankInflow,
        otherInflow,
        totalTransactions: records.length,
        fullyPaidCount,
        partialPaidCount,
      },
    };
  }, [challansResponse, selectedPaymentMode, searchQuery, selectedMonth]);

  // Export to Excel
  const handleExportExcel = () => {
    if (collectionRecords.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no payment inflow records matching your filters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      const rows = collectionRecords.map((r, idx) => ({
        "S.No": idx + 1,
        "Challan No": r.challanNo,
        "Student Name": r.studentName,
        "Father Name": r.fatherName,
        "Roll Number": r.rollNumber,
        "Program & Class": r.programClassSec,
        "Month": r.month,
        "Billed (PKR)": r.billedAmount,
        "Inflow Collected (PKR)": r.paidAmount,
        "Balance (PKR)": r.balanceDue,
        "Payment Date & Time": r.paidDateTime,
        "Payment Mode": r.paymentMode,
        "Wallet / Account": r.walletName,
        "Received By": r.receivedByName,
        "Status": r.status,
      }));

      rows.push({
        "S.No": "TOTAL",
        "Challan No": "-",
        "Student Name": "-",
        "Father Name": "-",
        "Roll Number": "-",
        "Program & Class": "-",
        "Month": selectedMonth,
        "Billed (PKR)": collectionRecords.reduce((s, r) => s + r.billedAmount, 0),
        "Inflow Collected (PKR)": stats.totalInflow,
        "Balance (PKR)": collectionRecords.reduce((s, r) => s + r.balanceDue, 0),
        "Payment Date & Time": "-",
        "Payment Mode": "-",
        "Wallet / Account": "-",
        "Received By": "-",
        "Status": `${stats.totalTransactions} Transactions`,
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Fee Inflow Audit");

      const fileName = `Fee_Collection_Report_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export Successful",
        description: `Exported ${collectionRecords.length} collection records to ${fileName}`,
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
    if (collectionRecords.length === 0) {
      toast({
        title: "No Data to Print",
        description: "There are no payment inflow records matching your filters.",
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
          <title>Fee Collection Inflow Report - ${selectedMonth}</title>
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
            .badge-paid {
              color: #166534;
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              padding: 1px 5px;
              border-radius: 3px;
              font-weight: 700;
              font-size: 8.5px;
              display: inline-block;
            }
            .badge-partial {
              color: #854d0e;
              background: #fefce8;
              border: 1px solid #fef08a;
              padding: 1px 5px;
              border-radius: 3px;
              font-weight: 700;
              font-size: 8.5px;
              display: inline-block;
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
                <div><strong>Total Inflow Entries:</strong> ${collectionRecords.length}</div>
              </div>
            </div>

            <!-- CENTERED CALLIGRAPHY TITLE FOR REPORT NAME -->
            <div class="center-calligraphy-title">
              Monthly Fee Collection &amp; Inflow Report - ${selectedMonth}
            </div>

            <div class="filters-bar">
              <div><strong>Month:</strong> <span>${selectedMonth}</span></div>
              <div><strong>Session:</strong> <span>${sessionName}</span></div>
              <div><strong>Payment Mode:</strong> <span>${selectedPaymentMode.toUpperCase()}</span></div>
              <div><strong>Transactions:</strong> <span>${stats.totalTransactions} (Paid: ${stats.fullyPaidCount}, Partial: ${stats.partialPaidCount})</span></div>
            </div>

            <div class="summary-cards-bar">
              <div class="stat-card">
                <div class="stat-label">Total Inflow Collected</div>
                <div class="stat-value" style="color: #15803d;">PKR ${stats.totalInflow.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Cash Collections</div>
                <div class="stat-value">PKR ${stats.cashInflow.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Bank / Digital Inflow</div>
                <div class="stat-value">PKR ${stats.bankInflow.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Paid Challans</div>
                <div class="stat-value">${stats.fullyPaidCount}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Partial Paid Challans</div>
                <div class="stat-value">${stats.partialPaidCount}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 25px;">#</th>
                  <th>Challan #</th>
                  <th>Student Name / Roll No</th>
                  <th>Program / Class</th>
                  <th class="text-right">Billed</th>
                  <th class="text-right">Inflow Paid</th>
                  <th class="text-right">Balance</th>
                  <th>Paid Date &amp; Time</th>
                  <th>Mode</th>
                  <th>Received By</th>
                  <th style="text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${collectionRecords.map((r, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td class="font-bold">#${r.challanNo}</td>
                    <td>
                      <div class="font-bold">${r.studentName}</div>
                      <div style="font-size: 8.5px; color: #64748b;">${r.rollNumber ? 'Roll: ' + r.rollNumber : ''} ${r.fatherName ? '• S/O ' + r.fatherName : ''}</div>
                    </td>
                    <td>${r.programClassSec}</td>
                    <td class="text-right">PKR ${r.billedAmount.toLocaleString()}</td>
                    <td class="text-right font-bold" style="color: #15803d;">PKR ${r.paidAmount.toLocaleString()}</td>
                    <td class="text-right" style="color: ${r.balanceDue > 0 ? '#b91c1c' : '#64748b'};">
                      PKR ${r.balanceDue.toLocaleString()}
                    </td>
                    <td style="font-size: 8.5px;">${r.paidDateTime}</td>
                    <td>${r.paymentMode}</td>
                    <td style="font-size: 8.5px;">${r.receivedByName}</td>
                    <td style="text-align: center;">
                      <span class="${r.status === 'PAID' ? 'badge-paid' : 'badge-partial'}">
                        ${r.status}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="bg-total">
                  <td colspan="4" class="text-right font-bold">TOTAL (${collectionRecords.length} Challans):</td>
                  <td class="text-right font-bold">PKR ${collectionRecords.reduce((s, r) => s + r.billedAmount, 0).toLocaleString()}</td>
                  <td class="text-right font-bold" style="color: #15803d;">PKR ${stats.totalInflow.toLocaleString()}</td>
                  <td class="text-right font-bold" style="color: #b91c1c;">PKR ${collectionRecords.reduce((s, r) => s + r.balanceDue, 0).toLocaleString()}</td>
                  <td colspan="4"></td>
                </tr>
              </tfoot>
            </table>

            <div class="footer-sign no-break">
              <div><strong>Cashier / Officer:</strong> _____________________</div>
              <div><strong>Accounts Officer:</strong> _____________________</div>
              <div><strong>Audited By:</strong> _____________________</div>
              <div><strong>Principal:</strong> _____________________</div>
            </div>
          </div>
        </body>
      </html>
    `;

    await openManagedPrintWindow({
      html,
      title: `Fee Collection Report - ${selectedMonth}`,
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
          {collectionRecords.length > 0 && (
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
              setSelectedPaymentMode("all");
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
                  <Coins className="w-5 h-5 text-emerald-600" />
                  Fee Collection Inflow Report (Month-Wise)
                </CardTitle>
                <CardDescription>
                  Detailed audit showing which challan received what payment amount in the institutional system for {selectedMonth}.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end bg-muted/20 p-3 rounded-lg border border-border/50">
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

            {/* Payment Mode */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Payment Mode
              </Label>
              <Select value={selectedPaymentMode} onValueChange={setSelectedPaymentMode}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank">Bank Deposit</SelectItem>
                  <SelectItem value="Online">Online / Digital</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
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
                Search
              </Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Challan #, Name, Roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <Card className="p-3 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-none">
              <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                Total Inflow Collected
              </div>
              <div className="text-base font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                PKR {stats.totalInflow.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                {stats.totalTransactions} paid transactions
              </div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Cash Collections
              </div>
              <div className="text-base font-bold text-foreground mt-1">
                PKR {stats.cashInflow.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Physical cash intake</div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Bank / Digital Inflow
              </div>
              <div className="text-base font-bold text-foreground mt-1">
                PKR {stats.bankInflow.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Bank deposit / online transfer</div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Fully Paid Challans
              </div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {stats.fullyPaidCount}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Cleared balances</div>
            </Card>

            <Card className="p-3 border-border/60 bg-card/60 shadow-none">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Partial Inflow Challans
              </div>
              <div className="text-base font-bold text-amber-700 dark:text-amber-400 mt-1">
                {stats.partialPaidCount}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Remaining balance active</div>
            </Card>
          </div>

          {/* Table or States */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading fee inflow transactions for {selectedMonth}...</p>
            </div>
          ) : collectionRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed rounded-lg bg-muted/10 my-4 space-y-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <h3 className="font-semibold text-sm">No Collection Inflows Found for {selectedMonth}</h3>
              <p className="text-xs text-muted-foreground">
                No fee challans recorded payment inflow matching the selected filters.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                    <TableRow className="bg-muted/50 border-b">
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground w-10">#</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Challan #</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Student &amp; Roll No</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Program &amp; Class</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Billed Amount</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Inflow Paid</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-right">Balance</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Payment Date &amp; Time</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Mode / Account</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground">Received By</TableHead>
                      <TableHead className="py-2.5 px-3 font-semibold text-muted-foreground text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionRecords.map((r, idx) => (
                      <TableRow key={r.id || idx} className="hover:bg-muted/30">
                        <TableCell className="py-2 px-3 text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="py-2 px-3 font-mono font-semibold text-foreground">
                          #{r.challanNo}
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div className="font-semibold text-foreground">{r.studentName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.rollNumber ? `Roll: ${r.rollNumber}` : ""} {r.fatherName ? `• S/O ${r.fatherName}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground">
                          {r.programClassSec}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono">
                          PKR {r.billedAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          PKR {r.paidAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono text-muted-foreground">
                          {r.balanceDue > 0 ? (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              PKR {r.balanceDue.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-emerald-600">0</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                          {r.paidDateTime}
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                              {r.paymentMode}
                            </Badge>
                            {r.walletName && r.walletName !== "-" && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={r.walletName}>
                                {r.walletName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-[11px] text-muted-foreground">
                          {r.receivedByName}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 font-semibold ${
                              r.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
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
                        TOTAL ({collectionRecords.length} Transactions):
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono">
                        PKR {collectionRecords.reduce((s, r) => s + r.billedAmount, 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300">
                        PKR {stats.totalInflow.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-mono text-amber-700 dark:text-amber-400">
                        PKR {collectionRecords.reduce((s, r) => s + r.balanceDue, 0).toLocaleString()}
                      </TableCell>
                      <TableCell colSpan={4}></TableCell>
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
