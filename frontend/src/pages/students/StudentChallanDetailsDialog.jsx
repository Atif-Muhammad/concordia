import React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Receipt,
  History,
  AlertCircle,
  ArrowRight,
  Printer,
  CheckCircle2,
  User,
  Clock,
} from "lucide-react";
import {
  getSelectedHeadsTotal,
  getRecursiveArrears,
  formatAmount,
  generateChallanHtml,
} from "./studentFinancialUtils";

export const StudentChallanDetailsDialog = ({
  open,
  onOpenChange,
  challan,
  feeHeads = [],
  classesData = [],
  programData = [],
  defaultChallanTemplate = null,
  onPrint,
  isPrinting = false,
  isLoading = false,
}) => {
  if (!challan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>
              Challan Preview &amp; Details
              {isLoading && (
                <span className="ml-2 text-xs font-normal text-muted-foreground animate-pulse">
                  Loading full details…
                </span>
              )}
            </span>
            {challan && onPrint && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPrint(challan)}
                className="gap-2 w-full sm:w-auto"
                disabled={isLoading || isPrinting}
              >
                <Printer className="w-4 h-4" /> {isPrinting ? "Preparing..." : "Print Challan"}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info: Dates & Status */}
          <div className="bg-slate-50 border rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Challan Number</p>
              <p className="text-sm font-mono font-bold text-primary">{challan.challanNumber}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Issue Date</p>
              <p className="text-sm font-semibold">{format(new Date(challan.issueDate || challan.createdAt), "dd MMM yyyy")}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Due Date</p>
              <p className="text-sm font-semibold text-destructive">{format(new Date(challan.dueDate), "dd MMM yyyy")}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Status</p>
              <Badge
                className="uppercase text-[10px]"
                variant={challan.status === "PAID" ? "default" : challan.status === "OVERDUE" ? "destructive" : challan.status === "PARTIAL" ? "secondary" : (challan.status === "VOID" || challan.status === "SUPERSEDED" || challan.status === "SETTLED") ? "outline" : "secondary"}
              >
                {challan.status === "VOID" ? "Voided" :
                  (challan.status === "SUPERSEDED" && (challan.settledAmount || 0) > 0) ? "Partially Settled" :
                    challan.status === "SUPERSEDED" ? "Superseded" :
                      challan.status === "SETTLED" ? "Settled" : challan.status}
              </Badge>
            </div>
          </div>

          {/* VOID Challan Transparency Note */}
          {challan.status === "VOID" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 items-start">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm w-full">
                <p className="font-semibold text-amber-800">This challan was superseded</p>
                {challan.supersededBy && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700">
                    <span className="font-medium">{challan.installmentNumber > 0 ? `Inst #${challan.installmentNumber}` : "Extra Challan"} (VOID)</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-bold">#{challan.supersededBy.challanNumber} ({challan.supersededBy.status})</span>
                  </div>
                )}
                {(() => {
                  const discountVal = Number(challan.snapshotDiscount || challan.discount || challan.installment?.discount || 0);
                  const absentiesFineVal = Number(challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine ?? 0);
                  const totalDue = (challan.snapshotBaseAmount != null ? Number(challan.snapshotBaseAmount) : (challan.amount || 0)) + (challan.snapshotExtraFine != null ? Number(challan.snapshotExtraFine) : (challan.fineAmount || 0)) + absentiesFineVal + (challan.snapshotLateFee != null ? Number(challan.snapshotLateFee) : (challan.lateFeeFine || 0)) - discountVal;
                  const settled = challan.settledAmount || 0;
                  const remaining = Math.max(0, totalDue - settled);
                  const fullySettled = settled >= totalDue - 0.01 && totalDue > 0;
                  return (
                    <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white rounded p-1.5 border border-amber-200">
                        <p className="text-amber-600 font-semibold">Total Due</p>
                        <p className="font-bold">PKR {formatAmount(totalDue)}</p>
                      </div>
                      <div className="bg-white rounded p-1.5 border border-green-200">
                        <p className="text-green-600 font-semibold">Settled</p>
                        <p className="font-bold text-green-700">PKR {formatAmount(settled)}</p>
                      </div>
                      <div className={`bg-white rounded p-1.5 border ${fullySettled ? 'border-green-200' : 'border-amber-200'}`}>
                        <p className={`font-semibold ${fullySettled ? 'text-green-600' : 'text-amber-600'}`}>Remaining</p>
                        <p className={`font-bold ${fullySettled ? 'text-green-700' : 'text-amber-700'}`}>
                          {fullySettled ? '✓ Settled' : `PKR ${formatAmount(remaining)}`}
                        </p>
                      </div>
                    </div>
                  );
                })()}
                {(challan.lateFeeFine || 0) > 0 && (
                  <p className="text-amber-700 text-xs">
                    Late fee of <span className="font-bold">PKR {formatAmount(challan.lateFeeFine)}</span> is locked for audit trail.
                  </p>
                )}
                {challan.remarks && (
                  <p className="text-[10px] text-amber-600 italic mt-1">{challan.remarks}</p>
                )}
              </div>
            </div>
          )}

          {/* Itemized Financial Breakdown */}
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
                    {(challan.installmentNumber > 0 && challan.challanType !== 'FEE_HEADS_ONLY' && !challan.isExtra) && (
                      <TableRow>
                        <TableCell className="text-sm px-3 py-2">
                          <span className="font-semibold text-slate-700">Base Payable</span>
                          <p className="text-[10px] text-muted-foreground italic">
                            {challan.installmentNumber > 0 ? `Installment #${challan.installmentNumber}` : 'Standard Charge'}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2">
                          {formatAmount(challan.snapshotBaseAmount ?? (challan.amount || 0))}
                        </TableCell>
                      </TableRow>
                    )}

                    {(challan.snapshotArrearsAmount != null
                      ? challan.snapshotArrearsAmount > 0
                      : getRecursiveArrears(challan) > 0) && (
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
                              {formatAmount(challan.snapshotArrearsAmount ?? getRecursiveArrears(challan))}
                            </TableCell>
                          </TableRow>

                          {(() => {
                            try {
                              const arrearsNums = typeof challan.installment?.arrearsInstallments === 'string'
                                ? JSON.parse(challan.installment.arrearsInstallments)
                                : (challan.installment?.arrearsInstallments || []);

                              if (!Array.isArray(arrearsNums) || arrearsNums.length === 0) return null;

                              const allInsts = challan.installment?.student?.feeInstallments || [];
                              const prevChallans = Array.isArray(challan.previousChallans) ? challan.previousChallans : [];
                              const fallbackTotalArrears = Number(challan.snapshotArrearsAmount || 0);
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
                                const sessionLabel = (typeof match.session === 'object' ? match.session?.name : match.session) || match.sessionName || challan.installment?.session?.name || "";
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
                        </>
                      )}

                    {(() => {
                      try {
                        const headsSnapshot = challan.challanHeads;
                        const rawHeads = headsSnapshot || null;
                        const raw = rawHeads || (
                          (challan.selectedHeads && typeof challan.selectedHeads === 'string')
                            ? JSON.parse(challan.selectedHeads)
                            : (challan.selectedHeads || [])
                        );

                        const activeHeads = Array.isArray(raw) ? raw.filter(h =>
                          (typeof h === 'object' && h !== null && (h.isSelected !== false) && (h.amount > 0 || h.discountAmount > 0)) ||
                          (typeof h === 'number' || typeof h === 'string')
                        ) : [];

                        return activeHeads.map((item, idx) => {
                          let name = "Additional Head";
                          let amount = 0;
                          if (typeof item === 'object' && item !== null) {
                            if (item.id === -1) return null;
                            name = item.headName || item.name || (item.feeHead?.name) || "Fee Head";
                            amount = parseFloat(item.amount) || 0;
                          } else {
                            const itemId = item?.toString();
                            const head = (feeHeads || []).find(h => (h.id || h._id)?.toString() === itemId);
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

                    {(challan.snapshotLateFee ?? challan.lateFeeFine) > 0 && (
                      <TableRow className="text-destructive bg-destructive/5 font-medium">
                        <TableCell className="text-sm px-3 py-2">
                          {challan.status === "VOID"
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
                            : "Late Fee Fine (Calculated Overdue)"
                          }
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2">{formatAmount(challan.snapshotLateFee ?? challan.lateFeeFine)}</TableCell>
                      </TableRow>
                    )}

                    {(Number(challan.installment?.extraFine || 0) > 0) && (
                      <TableRow className="text-destructive bg-destructive/5 font-medium border-t border-destructive/20">
                        <TableCell className="text-sm px-3 py-2 italic">Fine (Extra)</TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2">{formatAmount(challan.installment.extraFine)}</TableCell>
                      </TableRow>
                    )}

                    {(Number((challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine) || 0) > 0) && (
                      <TableRow className="text-destructive bg-destructive/5 font-medium border-t border-destructive/20">
                        <TableCell className="text-sm px-3 py-2 italic">
                          Fine (Absentees)
                          {(Number((challan.snapshotTotalAbsenties ?? challan.installment?.totalAbsenties) || 0) > 0) && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({Number((challan.snapshotTotalAbsenties ?? challan.installment?.totalAbsenties) || 0)} days x 50)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm px-3 text-right font-bold py-2">
                          {formatAmount(Number((challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine) || 0))}
                        </TableCell>
                      </TableRow>
                    )}

                    {(() => {
                      const disc = Number(challan.snapshotDiscount) || Number(challan.discount) || Number(challan.installment?.discount) || 0;
                      if (Math.abs(disc) === 0) return null;
                      return (
                        <TableRow className="text-green-600 bg-green-50/30">
                          <TableCell className="text-sm px-3 py-2 italic">Applied Discount</TableCell>
                          <TableCell className="text-sm px-3 text-right font-bold py-2">- {formatAmount(Math.abs(disc))}</TableCell>
                        </TableRow>
                      );
                    })()}

                    {(() => {
                      const isVoid = challan.status === 'VOID';
                      const discountVal = Number(challan.snapshotDiscount) || Number(challan.discount) || Number(challan.installment?.discount) || 0;
                      const absentiesFineVal = Number(challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine ?? 0);
                      const totalDue = (Number(challan.snapshotTotalDue) || 0) > 0
                        ? Number(challan.snapshotTotalDue)
                        : isVoid
                          ? Math.max(0, (challan.amount || 0) + (challan.fineAmount || 0) + absentiesFineVal + (challan.lateFeeFine || 0) - Math.abs(discountVal))
                          : Math.max(0, (challan.amount || 0) + getSelectedHeadsTotal(challan) + absentiesFineVal + (challan.lateFeeFine || 0) + getRecursiveArrears(challan) - Math.abs(discountVal));
                      const effectivePaid = isVoid
                        ? (challan.settledAmount || 0)
                        : (challan.paidAmount || 0);
                      const remaining = totalDue - effectivePaid;

                      return (
                        <>
                          <TableRow className="bg-primary/5 border-t-2 border-border">
                            <TableCell className="text-sm px-3 py-3">
                              <span className="text-base font-black text-primary uppercase tracking-tight">Total Payable Amount</span>
                            </TableCell>
                            <TableCell className="text-sm px-3 py-3 text-right">
                              <span className="text-xl font-black text-primary">PKR {formatAmount(totalDue)}</span>
                            </TableCell>
                          </TableRow>

                          {effectivePaid > 0 && (
                            <TableRow className="bg-success/5">
                              <TableCell className="text-sm px-3 py-2">
                                <span className="font-semibold text-success">Amount Paid / Settled</span>
                              </TableCell>
                              <TableCell className="text-sm px-3 text-right font-bold py-2 text-success">
                                - PKR {formatAmount(effectivePaid)}
                              </TableCell>
                            </TableRow>
                          )}

                          <TableRow className="bg-slate-100/50 border-t">
                            <TableCell className="text-sm px-3 py-2">
                              <span className="font-black text-slate-700 uppercase">Remaining Balance</span>
                            </TableCell>
                            <TableCell className="text-sm px-3 text-right py-2">
                              <span className={cn("text-lg font-black", remaining < 0 ? "text-blue-600" : "text-slate-800")}>{remaining < 0 ? '-' : ''}PKR {formatAmount(Math.abs(remaining))}</span>
                            </TableCell>
                          </TableRow>
                        </>
                      );
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Collection Summary Sidebar */}
            <div className="space-y-6">
              <Card className="shadow-sm border-border bg-success/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Collection Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const isVoid = challan.status === 'VOID';
                    const discountVal = Number(challan.snapshotDiscount) || Number(challan.discount) || Number(challan.installment?.discount) || 0;
                    const absentiesFineVal = Number(challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine ?? 0);
                    const totalDue = (Number(challan.snapshotTotalDue) || 0) > 0
                      ? Number(challan.snapshotTotalDue)
                      : isVoid
                        ? Math.max(0, (challan.amount || 0) + (challan.fineAmount || 0) + absentiesFineVal + (challan.lateFeeFine || 0) - Math.abs(discountVal))
                        : Math.max(0, (challan.amount || 0) + getSelectedHeadsTotal(challan) + absentiesFineVal + (challan.lateFeeFine || 0) + getRecursiveArrears(challan) - Math.abs(discountVal));
                    const effectivePaid = isVoid
                      ? (challan.settledAmount || 0)
                      : (challan.paidAmount || 0);
                    const remaining = totalDue - effectivePaid;
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Total Billed</span>
                          <span className="text-sm font-bold">PKR {formatAmount(totalDue)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">{isVoid ? "Settled via Superseding" : "Amount Paid"}</span>
                          <span className="text-sm font-bold text-success">PKR {formatAmount(effectivePaid)}</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-800">Remaining Balance</span>
                          <span className={cn("text-base font-black", remaining < 0 ? "text-blue-600" : remaining === 0 ? "text-success" : "text-destructive")}>
                            {remaining === 0 ? 'Fully Settled' : `${remaining < 0 ? '-' : ''}PKR ${formatAmount(Math.abs(remaining))}`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Metadata & Timeline */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2 bg-slate-50/50 border-b">
                  <CardTitle className="text-[10px] font-bold uppercase text-slate-500">Metadata &amp; Timeline</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><User className="w-4 h-4 text-slate-600" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Student</p>
                      <p className="text-xs font-bold">{challan.student?.fName} {challan.student?.lName}</p>
                      <p className="text-[10px] text-muted-foreground">{challan.student?.rollNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><Clock className="w-4 h-4 text-slate-600" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Timeline</p>
                      <div className="text-[10px] font-medium space-y-0.5">
                        <p>Issued: {challan.issueDate || challan.createdAt ? format(new Date(challan.issueDate || challan.createdAt), "dd MMM yyyy") : "N/A"}</p>
                        <p>Due: <span className="text-destructive font-bold">{challan.dueDate ? format(new Date(challan.dueDate), "dd MMM yyyy") : "N/A"}</span></p>
                        {challan.paidDate && <p>Paid: <span className="text-success font-bold">{format(new Date(challan.paidDate), "dd MMM yyyy")}</span></p>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Enhanced Payment Breakdown Section */}
          {(() => {
            let history = [];
            try {
              history = typeof challan.paymentHistory === 'string'
                ? JSON.parse(challan.paymentHistory)
                : (challan.paymentHistory || []);
            } catch (e) { history = []; }

            if (!Array.isArray(history) || history.length === 0) return null;

            return (
              <Card className="shadow-soft border-border overflow-hidden">
                <CardHeader className="pb-2 bg-primary/5">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <History className="w-3.5 h-3.5" />
                    Detailed Payment Breakdown (History)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="h-8">
                        <TableHead className="text-sm px-3 py-2 text-[10px] uppercase h-8">Date</TableHead>
                        <TableHead className="text-sm px-3 py-2 text-[10px] uppercase h-8">Amount</TableHead>
                        <TableHead className="text-sm px-3 py-2 text-[10px] uppercase h-8">Discount</TableHead>
                        <TableHead className="text-sm px-3 py-2 text-[10px] uppercase h-8">Method</TableHead>
                        <TableHead className="text-sm px-3 py-2 text-[10px] uppercase h-8">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((entry, idx) => (
                        <TableRow key={idx} className="h-9 hover:bg-muted/20">
                          <TableCell className="text-sm px-3 py-1 text-xs">{new Date(entry.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm px-3 py-1 text-xs font-bold text-success">PKR {Math.round(entry.amount).toLocaleString()}</TableCell>
                          <TableCell className="text-sm px-3 py-1 text-xs font-bold text-orange-600">PKR {Math.round(entry.discount || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-sm px-3 py-1 text-xs">{entry.method || 'Cash'}</TableCell>
                          <TableCell className="text-sm px-3 py-1 text-[10px] italic text-muted-foreground">{entry.remarks || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}

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
          <div
            className="w-full border rounded-xl p-8 bg-white shadow-inner overflow-x-auto"
            dangerouslySetInnerHTML={{
              __html: generateChallanHtml(challan, null, {
                classesData,
                programData,
                defaultChallanTemplate,
              }),
            }}
          />
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentChallanDetailsDialog;
