import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Printer, Receipt, History, AlertCircle, ArrowRight, Info, CheckCircle2, Loader2, User, Building, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { getDefaultFeeChallanTemplate, getChallanReceipts } from "@/services/api";
import {
  formatAmount,
  getStatusColor,
  generateChallanHtml,
  applyPaidChallanPrintTreatment,
  getRecursiveArrears,
  getSelectedHeadsTotal,
  getTotalArrears,
  calculateLateFee,
  getChallanGrossTotal,
  getChallanNetPayable,
  htmlIncludesChallanNumber,
  setCachedTemplate,
  getCachedTemplate,
  normalizeChallan,
  safeFormatDate,
  format12HourDateTime,
} from "./feeFinancialUtils";

export const ChallanDetailsDialog = ({
  open,
  onOpenChange,
  challan,
  feeHeads = [],
  feeChallans = [],
  classes = [],
  programs = [],
  academicSessions = [],
  lateFeeRatePerDay = 0,
}) => {
  const { toast } = useToast();
  const [printingChallanId, setPrintingChallanId] = useState(null);

  const isExtra = Boolean(
    challan?.isExtra ||
    challan?.challanType === 'FEE_HEADS_ONLY' ||
    challan?.type === 'EXTRA' ||
    (!challan?.installmentNumber && !challan?.installmentId && !challan?.installment && (Array.isArray(challan?.heads) || Array.isArray(challan?.challanHeads)))
  );
  const templateType = isExtra ? "EXTRA" : (challan?.isHostel ? "HOSTEL" : "INSTALLMENT");

  const effectiveChallan = useMemo(() => {
    if (!challan) return null;
    const base = isExtra ? { ...challan, isExtra: true, type: 'EXTRA', challanType: 'FEE_HEADS_ONLY' } : challan;
    return normalizeChallan(base);
  }, [challan, isExtra]);

  const { data: templateData, isLoading: isTemplateLoading } = useQuery({
    queryKey: ["feeChallanTemplate", templateType],
    queryFn: async () => {
      const t = await getDefaultFeeChallanTemplate(templateType);
      if (t?.htmlContent) setCachedTemplate(templateType, t.htmlContent);
      return t;
    },
    enabled: !!challan && open,
    staleTime: 5 * 60 * 1000,
  });

  const challanId = challan?.id || challan?._id;
  const { data: receiptsData = [], isLoading: isReceiptsLoading } = useQuery({
    queryKey: ["challanReceipts", challanId],
    queryFn: () => getChallanReceipts(challanId),
    enabled: !!challanId && open,
  });

  const currentChallan = effectiveChallan || challan;

  const transactions = useMemo(() => {
    if (!currentChallan) return [];

    if (Array.isArray(receiptsData) && receiptsData.length > 0) {
      return receiptsData.map((r, idx) => ({
        id: r._id || r.id || idx,
        receiptNo: r.receiptNo || '-',
        amount: Number(r.amountPaid ?? r.amount ?? 0),
        date: r.paidDate || r.createdAt || currentChallan?.paidDate,
        time: r.paidTime || currentChallan?.paidTime,
        receivedBy: r.recordedBy?.name || r.receivedByName || currentChallan?.receivedByName || currentChallan?.paidBy || 'Super Admin',
        paymentMode: r.paymentMode || currentChallan?.paymentMode || 'Cash',
        depositAccount: r.walletId?.name || r.walletName || currentChallan?.walletName || currentChallan?.walletId?.name || (r.walletId?.type ? `Account (${r.walletId.type})` : '-'),
        remarks: r.remarks || '-',
      }));
    }

    const hist = typeof currentChallan?.paymentHistory === 'string'
      ? JSON.parse(currentChallan.paymentHistory)
      : (currentChallan?.paymentHistory || []);

    if (Array.isArray(hist) && hist.length > 0) {
      return hist.map((entry, idx) => ({
        id: entry.id || idx,
        receiptNo: entry.receiptNo || `REC-${idx + 1}`,
        amount: Number(entry.amount || 0),
        date: entry.date || entry.paidDate || currentChallan?.paidDate,
        time: entry.paidTime || entry.time || currentChallan?.paidTime,
        receivedBy: entry.recordedBy?.name || entry.receivedBy || entry.recordedBy || entry.paidBy || currentChallan?.receivedByName || currentChallan?.paidBy || 'Super Admin',
        paymentMode: entry.method || entry.paymentMode || currentChallan?.paymentMode || 'Cash',
        depositAccount: entry.walletName || entry.depositAccount || currentChallan?.walletName || currentChallan?.walletId?.name || '-',
        remarks: entry.remarks || '-',
      }));
    }

    if (Number(currentChallan?.paidAmount || 0) > 0) {
      return [{
        id: currentChallan.id || currentChallan._id,
        receiptNo: currentChallan.challanNo ? `REC-${currentChallan.challanNo}` : '-',
        amount: Number(currentChallan.paidAmount),
        date: currentChallan.paidDate || currentChallan.updatedAt,
        time: currentChallan.paidTime,
        receivedBy: currentChallan.receivedByName || currentChallan.paidBy || 'Super Admin',
        paymentMode: currentChallan.paymentMode || currentChallan.paidBy || 'Cash',
        depositAccount: currentChallan.walletName || currentChallan.walletId?.name || '-',
        remarks: currentChallan.remarks || '-',
      }];
    }

    return [];
  }, [receiptsData, currentChallan]);

  if (!challan) return null;

  const student = currentChallan?.student || (currentChallan?.studentId && typeof currentChallan.studentId === 'object' ? currentChallan.studentId : null) || currentChallan?.installment?.student || {};
  const studentName = `${student.fName || ''} ${student.lName || ''}`.trim() || currentChallan?.studentName || "N/A";
  const rollNo = student.rollNumber || currentChallan?.rollNumber || "N/A";
  const fatherName = student.fatherOrguardian || student.fatherName || currentChallan?.fatherName || "N/A";

  const studentClass = currentChallan?.studentClass?.name || classes.find(c => c.id === (student.classId || currentChallan?.classId))?.name || student.class?.name || (typeof currentChallan?.studentClass === 'string' ? currentChallan?.studentClass : null) || "";
  const studentProgram = currentChallan?.studentProgram?.name || programs.find(p => p.id === (student.programId || currentChallan?.programId))?.name || student.program?.name || (typeof currentChallan?.studentProgram === 'string' ? currentChallan?.studentProgram : null) || "";
  const studentSection = currentChallan?.studentSection?.name || student.section?.name || student.sectionName || (typeof currentChallan?.studentSection === 'string' ? currentChallan?.studentSection : null) || "";

  const fullClassInfo = [studentProgram, studentClass, studentSection].filter(Boolean).join(" / ") || "N/A";
  const sessionName = currentChallan?.session || currentChallan?.installment?.session?.name || (typeof currentChallan?.sessionId === 'object' ? currentChallan?.sessionId?.name : null) || academicSessions.find(s => s.id === (student.sessionId || currentChallan?.sessionId))?.name || "";

  const handlePrint = async () => {
    const key = `${isExtra ? 'extra' : 'installment'}-${currentChallan.id}`;
    setPrintingChallanId(key);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print challans.", variant: "destructive" });
      setPrintingChallanId(null);
      return;
    }

    try {
      const challanWithRate = { ...currentChallan, lateFeeRatePerDay: currentChallan.lateFeeRatePerDay || lateFeeRatePerDay };
      const baseHtml = generateChallanHtml(
        challanWithRate,
        templateData?.htmlContent || getCachedTemplate(templateType),
        { feeHeads, feeChallans, classes, programs, academicSessions, lateFeeRatePerDay }
      );
      const finalHtml = applyPaidChallanPrintTreatment(baseHtml, currentChallan, feeChallans);

      if (!htmlIncludesChallanNumber(finalHtml, currentChallan.challanNumber)) {
        toast({
          title: "Print data mismatch",
          description: "The print view did not match the selected challan. Please refresh and try again.",
          variant: "destructive",
        });
        printWindow.close?.();
        return;
      }

      await openManagedPrintWindow({
        html: finalHtml,
        title: (isExtra ? "Extra Challan #" : "Challan #") + (currentChallan.challanNumber || ""),
        toast,
        printWindow
      });
    } catch (error) {
      console.error("Print failed:", error);
      toast({ title: "Print error", description: "Failed to generate print view.", variant: "destructive" });
      printWindow.close?.();
    } finally {
      setPrintingChallanId(null);
    }
  };

  const isVoid = currentChallan.status === "VOID";
  const isSettled = currentChallan.status === "SETTLED";
  const discountVal = Number(currentChallan.snapshotDiscount || currentChallan.discount || currentChallan.installment?.discount || 0);
  const hasAbsenteeInHeads = (currentChallan.challanHeads || currentChallan.heads || []).some(h => (h?.name || '').toLowerCase().includes('absent'));
  const absentiesFineVal = hasAbsenteeInHeads
    ? 0
    : Number(currentChallan.absenteeFineAmount ?? currentChallan.snapshotAbsentiesFine ?? currentChallan.installment?.absentiesFine ?? 0);
  const extraFineVal = Number(currentChallan.snapshotExtraFine ?? currentChallan.installment?.extraFine ?? 0);
  const appliedAdvance = Number(currentChallan.advanceApplied || currentChallan.advanceAmount || 0);

  const effectiveRate = Number(
    currentChallan.installment?.lateFeeRatePerDay ??
    currentChallan.lateFeeRatePerDay ??
    lateFeeRatePerDay ??
    0
  );
  const existingFine = Number(currentChallan.snapshotLateFee ?? currentChallan.lateFeeAmount ?? currentChallan.lateFeeFine ?? 0);
  const autoFine = (!isSettled && !isVoid && currentChallan.dueDate && effectiveRate > 0)
    ? calculateLateFee(currentChallan.dueDate, effectiveRate)
    : 0;
  const lateFeeFineVal = existingFine > 0 ? existingFine : autoFine;

  const baseAmount = Number(currentChallan.snapshotBaseAmount ?? currentChallan.basePayable ?? (currentChallan.amount || 0));
  const headsVal = Number(getSelectedHeadsTotal(currentChallan) || currentChallan.headsAmount || 0);
  const arrearsVal = Number(currentChallan.arrearsAmount != null
    ? currentChallan.arrearsAmount
    : (currentChallan.snapshotArrearsAmount != null
        ? currentChallan.snapshotArrearsAmount
        : (Array.isArray(currentChallan.arrearAllocations) && currentChallan.arrearAllocations.length > 0
            ? currentChallan.arrearAllocations.reduce((s, a) => s + (Number(a.amountCarriedForward ?? a.amountSettled ?? a.amount) || 0), 0)
            : getRecursiveArrears(currentChallan)
          )
      ));

  const grossBill = isExtra
    ? Math.max(0, (currentChallan.amount || 0) + lateFeeFineVal + extraFineVal)
    : Math.max(0, baseAmount + headsVal + arrearsVal + extraFineVal + absentiesFineVal + lateFeeFineVal - Math.abs(discountVal));

  const totalDue = isSettled
    ? Number(currentChallan.snapshotTotalDue || currentChallan.netPayable || currentChallan.totalAmount || grossBill)
    : Math.max(0, grossBill - appliedAdvance);

  const directPaid = Number(currentChallan.directPaidAmount ?? currentChallan.paidAmount ?? 0);
  let settledArrears = Number(currentChallan.settledViaArrearsAmount ?? currentChallan.settledAmount ?? 0);
  if (isSettled && settledArrears === 0 && directPaid < totalDue) {
    settledArrears = Math.max(0, totalDue - directPaid);
  }
  const totalEffectiveSettled = isSettled ? totalDue : (directPaid + settledArrears);
  const settledInChallanNo = currentChallan.settledByChallanNo || currentChallan.settledByChallanNumber || (currentChallan.supersededBy?.challanNumber || currentChallan.supersededBy?.challanNo || '');
  const remaining = isSettled ? 0 : Math.max(0, totalDue - directPaid - settledArrears);
  const fullySettled = isSettled || (totalEffectiveSettled >= totalDue - 0.01 && totalDue > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Challan Preview & Details</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!!printingChallanId}
              className="gap-2"
            >
              <Printer className="w-4 h-4" /> Print Challan
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Top Summary Cards: Student Profile & Challan Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Student Profile Card */}
            <div className="bg-slate-50/80 border rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Student Profile</span>
                </div>
                {rollNo !== "N/A" && (
                  <Badge variant="outline" className="font-mono text-xs bg-white text-slate-700">
                    Roll: {rollNo}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Student Name</p>
                  <p className="font-bold text-slate-800 text-sm truncate">{studentName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Father / Guardian</p>
                  <p className="font-medium text-slate-700 truncate">{fatherName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Class / Program</p>
                  <p className="font-medium text-slate-700 truncate">{fullClassInfo}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Academic Session</p>
                  <p className="font-medium text-slate-700 truncate">{sessionName || "Standard"}</p>
                </div>
              </div>
            </div>

            {/* Challan Profile Card */}
            <div className="bg-slate-50/80 border rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Challan Details</span>
                </div>
                <Badge
                  className="uppercase text-[10px] font-bold"
                  variant={
                    currentChallan.status === "PAID" ? "default" :
                    currentChallan.status === "OVERDUE" ? "destructive" :
                    currentChallan.status === "PARTIAL" ? "secondary" :
                    (currentChallan.status === "VOID" || currentChallan.status === "SUPERSEDED" || currentChallan.status === "SETTLED") ? "outline" : "secondary"
                  }
                >
                  {currentChallan.status === "VOID" ? "Voided" :
                   (currentChallan.status === "SUPERSEDED" && (currentChallan.settledAmount || 0) > 0) ? "Partially Settled" :
                   currentChallan.status === "SUPERSEDED" ? "Superseded" :
                   currentChallan.status === "SETTLED" ? "Settled" : currentChallan.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Challan No</p>
                  <p className="font-mono font-bold text-primary text-sm truncate">{currentChallan.challanNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Type / Month</p>
                  <p className="font-medium text-slate-700 truncate">
                    {isExtra
                      ? "Extra Fee"
                      : (currentChallan.installmentNumber > 0
                          ? `Inst #${currentChallan.installmentNumber}${currentChallan.month ? ` (${currentChallan.month})` : ''}`
                          : (currentChallan.month || 'Installment'))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Issue Date</p>
                  <p className="font-medium text-slate-700">{safeFormatDate(currentChallan.issueDate || currentChallan.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 text-destructive">Due Date</p>
                  <p className="font-semibold text-destructive">{safeFormatDate(currentChallan.dueDate)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* VOID Challan Transparency Note */}
          {currentChallan.status === "VOID" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 items-start">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm w-full">
                <p className="font-semibold text-amber-800">This challan was superseded</p>
                {currentChallan.supersededBy && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700">
                    <span className="font-medium">{currentChallan.installmentNumber > 0 ? `Inst #${currentChallan.installmentNumber}` : "Extra Challan"} (VOID)</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-bold">#{currentChallan.supersededBy.challanNumber || currentChallan.supersededBy.challanNo} ({currentChallan.supersededBy.status})</span>
                  </div>
                )}
                {/* Settlement breakdown */}
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white rounded p-1.5 border border-amber-200">
                    <p className="text-amber-600 font-semibold">Total Due</p>
                    <p className="font-bold">PKR {formatAmount(totalDue)}</p>
                  </div>
                  <div className="bg-white rounded p-1.5 border border-green-200">
                    <p className="text-green-600 font-semibold">Settled</p>
                    <p className="font-bold text-green-700">PKR {formatAmount(totalEffectiveSettled)}</p>
                  </div>
                  <div className={`bg-white rounded p-1.5 border ${fullySettled ? 'border-green-200' : 'border-amber-200'}`}>
                    <p className={`font-semibold ${fullySettled ? 'text-green-600' : 'text-amber-600'}`}>Remaining</p>
                    <p className={`font-bold ${fullySettled ? 'text-green-700' : 'text-amber-700'}`}>
                      {fullySettled ? '✓ Settled' : `PKR ${formatAmount(remaining)}`}
                    </p>
                  </div>
                </div>
                {(currentChallan.lateFeeFine || 0) > 0 && (
                  <p className="text-amber-700 text-xs">
                    Late fee of <span className="font-bold">PKR {formatAmount(currentChallan.lateFeeFine)}</span> is locked for audit trail.
                  </p>
                )}
                {currentChallan.remarks && (
                  <p className="text-[10px] text-amber-600 italic mt-1">{currentChallan.remarks}</p>
                )}
              </div>
            </div>
          )}

          {/* SETTLED Challan Settlement Transparency Note */}
          {currentChallan.status === "SETTLED" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex gap-3 items-start">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm w-full">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-semibold text-emerald-800">This challan is fully settled</p>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-white text-[10px]">
                    100% Cleared
                  </Badge>
                </div>
                {settledInChallanNo && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <span className="font-medium">Direct payment + remainder settled via arrears roll-forward in</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-bold">Challan #{settledInChallanNo}</span>
                  </div>
                )}
                {/* Settlement breakdown cards */}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-white rounded p-2 border border-emerald-200">
                    <p className="text-slate-500 font-medium">Total Bill Amount</p>
                    <p className="font-bold text-slate-800 text-sm">PKR {formatAmount(totalDue)}</p>
                  </div>
                  <div className="bg-white rounded p-2 border border-emerald-200">
                    <p className="text-emerald-700 font-medium">Direct Paid (Cash/Bank)</p>
                    <p className="font-bold text-emerald-700 text-sm">PKR {formatAmount(directPaid)}</p>
                  </div>
                  <div className="bg-white rounded p-2 border border-amber-200">
                    <p className="text-amber-800 font-medium">Settled via Arrears</p>
                    <p className="font-bold text-amber-700 text-sm">PKR {formatAmount(settledArrears)}</p>
                    {settledInChallanNo && (
                      <p className="text-[10px] text-amber-600 truncate mt-0.5">in Challan #{settledInChallanNo}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advance Payment Applied Transparency Banner */}
          {Number(currentChallan.advanceApplied || 0) > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex gap-3 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm w-full">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-semibold text-purple-900">Paid via Advance Payment</p>
                  <Badge variant="outline" className="border-purple-300 text-purple-800 bg-white text-[10px]">
                    Advance Credit Applied
                  </Badge>
                </div>
                <p className="text-xs text-purple-700">
                  This challan was settled using <span className="font-bold">PKR {formatAmount(currentChallan.advanceApplied)}</span> from advance payment
                  {currentChallan.advanceFromChallanNo ? ` (from ${currentChallan.advanceFromMonth ? `${currentChallan.advanceFromMonth} ` : ''}Challan #${currentChallan.advanceFromChallanNo})` : ''}.
                </p>
                {Array.isArray(currentChallan.advanceAllocations) && currentChallan.advanceAllocations.length > 0 && (
                  <div className="mt-1 space-y-1 text-xs text-purple-800">
                    {currentChallan.advanceAllocations.map((a, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-2 py-1 rounded border border-purple-200">
                        <span className="font-medium">Source: {a.sourceMonth ? `${a.sourceMonth} ` : ''}Challan #{a.sourceChallanNo}</span>
                        <span className="font-bold text-purple-700">PKR {formatAmount(a.amountApplied)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Overpayment / Credit Generated Transparency Banner */}
          {(Number(currentChallan.excessCreditGenerated || 0) > 0 || (Array.isArray(currentChallan.creditAdjustedTo) && currentChallan.creditAdjustedTo.length > 0) || (directPaid > totalDue && totalDue > 0)) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 items-start">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm w-full">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-semibold text-blue-900">Overpayment & Advance Credit Generated</p>
                  <Badge variant="outline" className="border-blue-300 text-blue-800 bg-white text-[10px]">
                    Advance Credit Ledger
                  </Badge>
                </div>
                <p className="text-xs text-blue-700">
                  Total payment received was <span className="font-bold">PKR {formatAmount(directPaid)}</span> for a bill of <span className="font-bold">PKR {formatAmount(totalDue)}</span>.
                  The excess <span className="font-bold text-blue-900">PKR {formatAmount(currentChallan.excessCreditGenerated || Math.max(0, directPaid - totalDue))}</span> was transferred to the student's Advance Credit Ledger.
                </p>
                {Array.isArray(currentChallan.creditAdjustedTo) && currentChallan.creditAdjustedTo.length > 0 && (
                  <div className="mt-1 space-y-1 text-xs">
                    <p className="font-semibold text-blue-800 text-[11px] uppercase tracking-wider">Adjusted toward installments:</p>
                    {currentChallan.creditAdjustedTo.map((adj, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-2 py-1 rounded border border-blue-200 text-blue-900">
                        <span className="font-medium">Adjusted to {adj.month ? `${adj.month} ` : ''}Challan #{adj.challanNo}</span>
                        <span className="font-bold text-emerald-700">PKR {formatAmount(adj.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {Number(currentChallan.creditRemaining || 0) > 0 && (
                  <p className="text-xs text-emerald-700 font-semibold mt-1">
                    ↳ PKR {formatAmount(currentChallan.creditRemaining)} remains available in credit to adjust future installments.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 shadow-sm border-slate-200">
              <CardHeader className="bg-slate-50/50 border-b py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  Itemized Bill Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/30">
                      <TableHead className="text-sm px-3 text-[10px] uppercase font-bold py-2">Description</TableHead>
                      <TableHead className="text-sm px-3 text-[10px] uppercase font-bold py-2 text-right">Amount (PKR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Tuition Component — hidden for extra challans */}
                    {(!isExtra && currentChallan.installmentNumber > 0 && currentChallan.challanType !== 'FEE_HEADS_ONLY') && (
                      <TableRow>
                        <TableCell className="text-sm px-3 py-2">
                          <span className="font-semibold text-slate-700">Base Payable</span>
                          <p className="text-[10px] text-muted-foreground italic">
                            {currentChallan.installmentNumber > 0 ? `Installment #${currentChallan.installmentNumber}` : 'Standard Charge'}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2">
                          {formatAmount(currentChallan.snapshotBaseAmount ?? (currentChallan.amount || 0))}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Arrears Component with Detailed Breakdown (hidden for extra challans) */}
                    {!isExtra && (() => {
                      const totalArr = Number(currentChallan.arrearsAmount != null
                        ? currentChallan.arrearsAmount
                        : (currentChallan.snapshotArrearsAmount != null
                            ? currentChallan.snapshotArrearsAmount
                            : (Array.isArray(currentChallan.arrearAllocations) && currentChallan.arrearAllocations.length > 0
                                ? currentChallan.arrearAllocations.reduce((s, a) => s + (Number(a.amountCarriedForward) || 0), 0)
                                : getRecursiveArrears(currentChallan)
                              )
                          ));
                      if (totalArr <= 0) return null;
                      return (
                        <>
                          <TableRow className="text-amber-700 bg-amber-50/20">
                            <TableCell className="text-sm px-3 py-2">
                              <div className="flex items-center gap-1.5 font-semibold">
                                <History className="w-3 h-3" />
                                Previous Arrears (Total)
                              </div>
                              <p className="text-[10px] opacity-70">Accumulated from previous unpaid installments</p>
                            </TableCell>
                            <TableCell className="text-sm px-3 text-right font-bold py-2">
                              {formatAmount(totalArr)}
                            </TableCell>
                          </TableRow>

                          {/* Traceable Arrear Allocations */}
                          {Array.isArray(currentChallan.arrearAllocations) && currentChallan.arrearAllocations.length > 0 && (
                            currentChallan.arrearAllocations.map((alloc, idx) => (
                              <TableRow key={`alloc-${idx}`} className="bg-amber-50/10">
                                <TableCell className="text-xs px-3 py-1.5 pl-6 text-muted-foreground">
                                  {alloc.sourceMonth || (alloc.sourceInstallmentNumber ? `Inst #${alloc.sourceInstallmentNumber}` : 'Prior Month')}
                                  {alloc.sourceChallanNo ? ` (Challan #${alloc.sourceChallanNo})` : ''}
                                </TableCell>
                                <TableCell className="text-xs px-3 text-right py-1.5 text-amber-600">
                                  {formatAmount(alloc.amountCarriedForward ?? alloc.amountSettled ?? alloc.amount)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          {/* Legacy chain breakdown if no modern arrearAllocations */}
                          {(!Array.isArray(currentChallan.arrearAllocations) || currentChallan.arrearAllocations.length === 0) && (() => {
                            try {
                              const arrearsNums = typeof currentChallan.installment?.arrearsInstallments === 'string'
                                ? JSON.parse(currentChallan.installment.arrearsInstallments)
                                : (currentChallan.installment?.arrearsInstallments || []);
                              
                              if (!Array.isArray(arrearsNums) || arrearsNums.length === 0) return null;
                              
                              const allInsts = currentChallan.installment?.student?.feeInstallments || [];
                              const prevChallans = Array.isArray(currentChallan.previousChallans) ? currentChallan.previousChallans : [];
                              const fallbackTotalArrears = Number(currentChallan.snapshotArrearsAmount || 0);
                              const fallbackPerRow = arrearsNums.length > 0 ? Math.round(fallbackTotalArrears / arrearsNums.length) : 0;
                              return arrearsNums.map((num, idx) => {
                                const match = allInsts.find(i => Number(i.installmentNumber) === Number(num));
                                if (!match) return null;
                                const prev = prevChallans.find((p) =>
                                  Number(p.installmentNo ?? p.installmentNumber ?? p.installment?.installmentNumber ?? -1) === Number(num)
                                );
                                const prevSettled = Number(prev?.settledAmount ?? 0);
                                const prevSnapshotDue = Number(prev?.snapshotTotalDue ?? 0);
                                const prevReceived = Number(prev?.amountReceived ?? prev?.paidAmount ?? 0);
                                const prevRemainingAtRoll = Math.max(0, prevSnapshotDue - prevReceived);

                                const snapArrears = Number(match.snapshotArrearsAmount ?? 0);
                                const settledContribution = Number(match.settledAmount ?? 0);
                                const outstandingPrincipal = Number(match.outstandingPrincipal ?? 0);
                                const matchTotal = Number(match.totalAmount ?? 0);
                                const matchPaid = Number(match.paidAmount ?? 0);
                                const fallbackRemaining = Math.max(0, matchTotal - matchPaid);
                                const amt = prevSettled > 0
                                  ? prevSettled
                                  : (prevRemainingAtRoll > 0
                                    ? prevRemainingAtRoll
                                    : (snapArrears > 0
                                      ? snapArrears
                                      : (settledContribution > 0
                                        ? settledContribution
                                        : (outstandingPrincipal > 0 ? outstandingPrincipal : fallbackRemaining))));
                                const finalAmt = Number(amt) > 0
                                  ? Number(amt)
                                  : (arrearsNums.length === 1 ? fallbackTotalArrears : fallbackPerRow);
                                const sessionLabel = (typeof match.session === 'object' ? match.session?.name : match.session) || match.sessionName || currentChallan.installment?.session?.name || "";
                                const monthLabel = match.month || `#${num}`;
                                const instLabel = `Installment ${match.installmentNumber || num}`;
                                const arrearsLabel = `${monthLabel} - ${instLabel}${sessionLabel ? ` / ${sessionLabel}` : ''}`;
                                return (
                                  <TableRow key={`arr-${idx}`} className="bg-amber-50/10">
                                    <TableCell className="text-xs px-3 py-1.5 text-amber-600 italic">
                                      {arrearsLabel}
                                    </TableCell>
                                    <TableCell className="text-xs px-3 text-right py-1.5 text-amber-600">
                                      {formatAmount(finalAmt)}
                                    </TableCell>
                                  </TableRow>
                                );
                              }).filter(Boolean);
                            } catch (e) { 
                              return null; 
                            }
                          })()}
                          {(!Array.isArray(currentChallan.arrearAllocations) || currentChallan.arrearAllocations.length === 0) && (
                            <TableRow className="bg-amber-50/10">
                              <TableCell className="text-xs px-3 py-1.5 text-amber-600 italic">
                                Previous Outstanding Balance (Arrears)
                              </TableCell>
                              <TableCell className="text-xs px-3 text-right py-1.5 text-amber-600">
                                {formatAmount(totalArr)}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })()}

                    {/* Dynamic Fee Heads */}
                    {(() => {
                      try {
                        const raw = (Array.isArray(currentChallan.challanHeads) && currentChallan.challanHeads.length > 0)
                          ? currentChallan.challanHeads
                          : ((Array.isArray(currentChallan.heads) && currentChallan.heads.length > 0)
                              ? currentChallan.heads
                              : (Array.isArray(currentChallan.installment?.heads) && currentChallan.installment.heads.length > 0
                                  ? currentChallan.installment.heads
                                  : ((currentChallan.selectedHeads && typeof currentChallan.selectedHeads === 'string')
                                      ? (() => { try { return JSON.parse(currentChallan.selectedHeads); } catch(e) { return []; } })()
                                      : (Array.isArray(currentChallan.selectedHeads) ? currentChallan.selectedHeads : [])
                                    )
                                )
                            );
                        
                        const activeHeads = Array.isArray(raw) ? raw.filter(h => 
                          (typeof h === 'object' && h !== null && (h.isSelected !== false) && (Number(h.amount) > 0 || Number(h.discountAmount) > 0)) || 
                          (typeof h === 'number') || (typeof h === 'string')
                        ) : [];

                        // If it is an extra challan and no individual head rows were matched, fallback to the challan amount
                        if (isExtra && activeHeads.length === 0) {
                          const fallbackAmt = Number(currentChallan.amount || currentChallan.headsAmount || totalDue || 0);
                          if (fallbackAmt > 0) {
                            return (
                              <TableRow>
                                <TableCell className="text-sm px-3 py-2 text-slate-700">
                                  <span className="font-semibold">{currentChallan.remarks || "Extra Fee / Miscellaneous Charge"}</span>
                                  <p className="text-[10px] text-muted-foreground italic">Extra fee charge</p>
                                </TableCell>
                                <TableCell className="text-sm px-3 text-right font-medium py-2">
                                  {formatAmount(fallbackAmt)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                          return null;
                        }

                        return activeHeads.map((item, idx) => {
                          let name = "Additional Head";
                          let amount = 0;
                          if (typeof item === 'object' && item !== null) {
                            if (item.id === -1) return null;
                            name = item.headName || item.name || (item.feeHead?.name) || "Fee Head";
                            amount = parseFloat(item.amount) || 0;
                          } else {
                            const head = (feeHeads || []).find(h => String(h.id || h._id) === String(item));
                            if (head) { name = head.name; amount = parseFloat(head.amount) || 0; }
                          }
                          if (!name || Number(amount) === 0) return null;
                          return (
                            <TableRow key={idx}>
                              <TableCell className="text-sm px-3 py-2 text-slate-600">{name}</TableCell>
                              <TableCell className="text-sm px-3 text-right font-medium py-2">
                                {Number(amount) < 0 ? `- ${formatAmount(Math.abs(amount))}` : formatAmount(amount)}
                              </TableCell>
                            </TableRow>
                          );
                        }).filter(Boolean);
                      } catch (e) { return null; }
                    })()}

                    {/* Fines & Late Fees */}
                    {lateFeeFineVal > 0 && (
                      <TableRow className="text-destructive bg-destructive/5 font-medium">
                        <TableCell className="text-sm px-3 py-2">
                          {currentChallan.status === "VOID"
                            ? <span className="flex items-center gap-1.5">
                                Late Fee Fine (Preserved)
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertCircle className="w-3 h-3 text-amber-500 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-xs">
                                    This late fee is preserved on the VOID challan for audit trail. The debt (including this late fee) has been rolled into the superseding challan.
                                  </TooltipContent>
                                </Tooltip>
                              </span>
                            : <span className="flex items-center gap-1.5">
                                Late Fee Fine (Overdue)
                                {effectiveRate > 0 && (
                                  <span className="text-[10px] text-red-500 font-normal">
                                    (Rs. {effectiveRate}/day)
                                  </span>
                                )}
                              </span>
                          }
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2">{formatAmount(lateFeeFineVal)}</TableCell>
                      </TableRow>
                    )}

                    {/* Extra Fine Fallback */}
                    {(Number(currentChallan.installment?.extraFine || currentChallan.extraFine || 0) > 0) && (
                      <TableRow className="text-destructive bg-destructive/5 font-medium border-t border-destructive/20">
                        <TableCell className="text-sm px-3 py-2 italic">Fine (Extra)</TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2">{formatAmount(currentChallan.installment?.extraFine || currentChallan.extraFine)}</TableCell>
                      </TableRow>
                    )}

                    {/* Absentees Fine */}
                    {(!hasAbsenteeInHeads && absentiesFineVal > 0) && (
                      <TableRow className="text-destructive bg-destructive/5 font-medium border-t border-destructive/20">
                        <TableCell className="text-sm px-3 py-2 italic">
                          Fine (Absentees)
                          {(Number(currentChallan.absenteeCount || currentChallan.snapshotTotalAbsenties || currentChallan.installment?.totalAbsenties || 0) > 0) && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({Number(currentChallan.absenteeCount || currentChallan.snapshotTotalAbsenties || currentChallan.installment?.totalAbsenties || 0)} subject absenties x {currentChallan.absenteeRate || 50})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2">
                          {formatAmount(absentiesFineVal)}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Discounts */}
                    {(() => {
                      const disc = Number(currentChallan.snapshotDiscount) || Number(currentChallan.discount) || Number(currentChallan.installment?.discount) || 0;
                      if (Math.abs(disc) === 0) return null;
                      return (
                        <TableRow className="text-green-600 bg-green-50/30">
                          <TableCell className="text-sm px-3 py-2 italic">Applied Discount</TableCell>
                          <TableCell className="text-sm px-3 text-right font-bold py-2">- {formatAmount(Math.abs(disc))}</TableCell>
                        </TableRow>
                      );
                    })()}

                    {/* Advance Payment Credited */}
                    {appliedAdvance > 0 && (
                      <TableRow className="text-purple-700 bg-purple-50/40 font-medium border-t border-purple-200/60">
                        <TableCell className="text-sm px-3 py-2 italic">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">Advance Payment Credited</span>
                            {currentChallan.advanceFromChallanNo && (
                              <span className="font-mono text-xs not-italic font-semibold text-purple-900">
                                ({currentChallan.advanceFromMonth ? `${currentChallan.advanceFromMonth} ` : ''}Challan #{currentChallan.advanceFromChallanNo})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2 text-purple-700">
                          - {formatAmount(appliedAdvance)}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Collection Summary */}
                    {appliedAdvance > 0 ? (
                      <>
                        <TableRow className="bg-slate-100/70 border-t-2 border-slate-300">
                          <TableCell className="text-sm px-3 py-2 font-bold text-slate-700">
                            Total Bill Amount (Gross)
                          </TableCell>
                          <TableCell className="text-sm px-3 text-right py-2 font-bold text-slate-800">
                            PKR {formatAmount(grossBill)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-purple-50/50">
                          <TableCell className="text-sm px-3 py-1.5 text-purple-700 font-medium">
                            Less: Advance Payment Credited
                          </TableCell>
                          <TableCell className="text-sm px-3 text-right py-1.5 font-bold text-purple-700">
                            - PKR {formatAmount(appliedAdvance)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-primary/5 border-t-2 border-primary/20">
                          <TableCell className="text-sm px-3 py-3">
                            <span className="text-base font-black text-primary uppercase tracking-tight">Total Payable Amount</span>
                          </TableCell>
                          <TableCell className="text-sm px-3 text-right py-3">
                            <span className="text-xl font-black text-primary">PKR {formatAmount(totalDue)}</span>
                          </TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow className="bg-primary/5 border-t-2 border-border">
                        <TableCell className="text-sm px-3 py-3">
                          <span className="text-base font-black text-primary uppercase tracking-tight">Total Payable Amount</span>
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right py-3">
                          <span className="text-xl font-black text-primary">PKR {formatAmount(totalDue)}</span>
                        </TableCell>
                      </TableRow>
                    )}

                    {totalEffectiveSettled > 0 && (
                      <>
                        <TableRow className="bg-success/5">
                          <TableCell className="text-sm px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-success">
                                {isSettled ? "Total Amount Settled" : "Amount Paid / Settled"}
                              </span>
                              {isSettled && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-300 text-emerald-700 bg-emerald-50">
                                  Settled
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm px-3 text-right font-bold py-2 text-success">
                            - PKR {formatAmount(totalEffectiveSettled)}
                          </TableCell>
                        </TableRow>
                        {settledArrears > 0 && (
                          <>
                            <TableRow className="bg-slate-50/50">
                              <TableCell className="text-xs px-3 py-1.5 pl-6 text-slate-500 font-medium">
                                ↳ Direct Payment (Cash/Bank)
                              </TableCell>
                              <TableCell className="text-xs px-3 text-right py-1.5 font-medium text-slate-700">
                                PKR {formatAmount(directPaid)}
                              </TableCell>
                            </TableRow>
                            <TableRow className="bg-amber-50/20">
                              <TableCell className="text-xs px-3 py-1.5 pl-6 text-amber-700 font-medium">
                                ↳ Settled via Arrears {settledInChallanNo ? `(in Challan #${settledInChallanNo})` : '(Rolled forward)'}
                              </TableCell>
                              <TableCell className="text-xs px-3 text-right py-1.5 font-medium text-amber-700">
                                PKR {formatAmount(settledArrears)}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </>
                    )}

                    {!isVoid && (
                      <TableRow className="bg-slate-100/50 border-t">
                        <TableCell className="text-sm px-3 py-2">
                          <span className="font-black text-slate-700 uppercase">Remaining Balance</span>
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right py-2">
                          <span className={cn("text-lg font-black", remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-blue-600" : "text-slate-800")}>
                            {remaining === 0 ? "PKR 0 (Fully Settled)" : `${remaining < 0 ? '-' : ''}PKR ${formatAmount(Math.abs(remaining))}`}
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Sidebar Info */}
            <div className="space-y-6">
              {/* Status & Quick Info */}
              <Card className="shadow-sm border-border">
                <CardHeader className="pb-2 bg-slate-50/50 border-b">
                   <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                     <Info className="w-4 h-4" />
                     Challan Information
                   </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Current Status:</span>
                    <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", getStatusColor(currentChallan.status))}>
                      {currentChallan.status}
                    </div>
                  </div>
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground italic">Issued Date:</span>
                      <span className="font-medium text-slate-700">
                        {safeFormatDate(currentChallan.issueDate || currentChallan.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground italic text-destructive">Due Date:</span>
                      <span className="font-bold text-destructive">
                        {safeFormatDate(currentChallan.dueDate)}
                      </span>
                    </div>
                    {currentChallan.paidDate && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground italic text-success">Paid Date:</span>
                        <span className="font-bold text-success">
                          {safeFormatDate(currentChallan.paidDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Session History (for regular installment challans) or Extra Scope Card (for extra challans) */}
              {isExtra ? (
                <Card className="shadow-sm border-border bg-slate-50/50">
                  <CardHeader className="pb-2 py-3 border-b bg-white">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                      <Receipt className="w-3.5 h-3.5" />
                      Extra Challan Scope
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-xs space-y-2">
                    <p className="text-slate-600 leading-relaxed">
                      This is an independent fee voucher issued for special fee heads or miscellaneous charges.
                    </p>
                    {currentChallan.remarks && (
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Remarks</span>
                        <span className="text-slate-700 italic">{currentChallan.remarks}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-sm border-border bg-slate-50/50">
                  <CardHeader className="pb-2 py-3 border-b bg-white">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                      <History className="w-3.5 h-3.5" />
                      Session Payment History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableBody>
                          {(() => {
                            const currentNum = currentChallan.installmentNo || currentChallan.installment?.installmentNumber || 0;
                            const history = (currentChallan.installment?.student?.feeInstallments || [])
                              .filter(i => i.installmentNumber < currentNum)
                              .sort((a,b) => a.installmentNumber - b.installmentNumber);
                            
                            if (history.length === 0) {
                              return (
                                <TableRow className="h-8 bg-white">
                                  <TableCell colSpan={2} className="text-[10px] italic text-slate-400 py-1 px-3 text-center">
                                    No previous installments in this session history.
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            return (
                              <>
                                <TableRow className="h-8 bg-white">
                                  <TableCell className="text-[10px] font-bold py-1 px-3 border-r bg-slate-50 w-24">Month</TableCell>
                                  {history.map((inst, idx) => (
                                    <TableCell key={idx} className="text-[10px] text-center py-1 px-2 border-r last:border-r-0 min-w-[60px]">
                                      {inst.month || `#${inst.installmentNumber}`}
                                    </TableCell>
                                  ))}
                                </TableRow>
                                <TableRow className="h-8 bg-white">
                                  <TableCell className="text-[10px] font-bold py-1 px-3 border-r bg-slate-50">Total</TableCell>
                                  {history.map((inst, idx) => (
                                    <TableCell key={idx} className="text-[10px] text-center py-1 px-2 border-r last:border-r-0 font-medium">
                                      {formatAmount(inst.totalAmount)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                                <TableRow className="h-8 bg-white">
                                  <TableCell className="text-[10px] font-bold py-1 px-3 border-r bg-slate-50">Paid</TableCell>
                                  {history.map((inst, idx) => (
                                    <TableCell key={idx} className="text-[10px] text-center py-1 px-2 border-r last:border-r-0 font-bold text-success">
                                      {formatAmount(inst.paidAmount)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              </>
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Payment Transactions Breakdown Section */}
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="pb-2.5 bg-slate-50/70 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Payment Transactions
              </CardTitle>
              {transactions.length > 0 && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                  {transactions.length} Transaction{transactions.length > 1 ? 's' : ''}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isReceiptsLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Loading payment transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground italic">
                  No payment transactions recorded for this challan yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="h-8">
                        <TableHead className="text-xs px-3 py-2 font-bold uppercase text-[10px]">Receipt #</TableHead>
                        <TableHead className="text-xs px-3 py-2 font-bold uppercase text-[10px]">Date & Time</TableHead>
                        <TableHead className="text-xs px-3 py-2 font-bold uppercase text-[10px] text-right">Amount Paid</TableHead>
                        <TableHead className="text-xs px-3 py-2 font-bold uppercase text-[10px]">Received By</TableHead>
                        <TableHead className="text-xs px-3 py-2 font-bold uppercase text-[10px]">Payment Mode</TableHead>
                        <TableHead className="text-xs px-3 py-2 font-bold uppercase text-[10px]">Deposit Account</TableHead>
                        <TableHead className="text-xs px-3 py-2 font-bold uppercase text-[10px]">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx, idx) => (
                        <TableRow key={tx.id || idx} className="h-9 hover:bg-muted/30">
                          <TableCell className="px-3 py-2 text-xs font-mono text-slate-600 font-medium whitespace-nowrap">
                            {tx.receiptNo}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                            {format12HourDateTime(tx.date, tx.time)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs font-bold font-mono text-emerald-700 text-right whitespace-nowrap">
                            PKR {formatAmount(tx.amount)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs font-medium text-slate-800 whitespace-nowrap">
                            {tx.receivedBy}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold bg-slate-50">
                              {tx.paymentMode}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-700 font-medium whitespace-nowrap">
                            {tx.depositAccount}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-[11px] italic text-muted-foreground max-w-[200px] truncate" title={tx.remarks !== '-' ? tx.remarks : ''}>
                            {tx.remarks}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Print Preview Divider */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-dashed border-muted-foreground/30"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 text-muted-foreground font-semibold tracking-widest">Official Print Preview</span>
            </div>
          </div>

          {/* HTML Preview */}
          {isTemplateLoading && !getCachedTemplate(templateType) ? (
            <div className="w-full border rounded-xl p-8 bg-white flex justify-center items-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              className="w-full border rounded-xl p-8 bg-white shadow-inner overflow-x-auto"
              dangerouslySetInnerHTML={{
                __html: generateChallanHtml(
                  { ...currentChallan, lateFeeRatePerDay: currentChallan.lateFeeRatePerDay || lateFeeRatePerDay },
                  templateData?.htmlContent || getCachedTemplate(templateType),
                  { feeHeads, feeChallans, classes, programs, academicSessions, lateFeeRatePerDay }
                )
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChallanDetailsDialog;
