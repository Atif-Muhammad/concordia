import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  recordFeePayment,
  recordExtraFeePayment,
  updateFeeChallan,
  getWallets,
  getStudentCreditBalance,
} from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Layers, AlertCircle, DollarSign, Wallet, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  buildPaidTimestamp,
  getCurrentPaidTime,
  getTotalArrears,
  getSelectedHeadsTotal,
  calculateLateFee,
} from "./feeFinancialUtils";

export const PaymentDialog = ({
  open,
  onOpenChange,
  challan,
  feeHeads = [],
  lateFeeRatePerDay = 0,
  extraChallanLateFee = 0,
  onPaymentSuccess,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch wallets for deposit selection
  const { data: walletsData } = useQuery({
    queryKey: ['wallets'],
    queryFn: getWallets,
  });

  const wallets = useMemo(() => {
    if (Array.isArray(walletsData?.wallets)) return walletsData.wallets;
    if (Array.isArray(walletsData)) return walletsData;
    return [];
  }, [walletsData]);

  const activeWallets = useMemo(() => {
    return wallets.filter(w => w.status === 'ACTIVE' || !w.status);
  }, [wallets]);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [challanForm, setChallanForm] = useState({
    paidDate: format(new Date(), "yyyy-MM-dd"),
    paidTime: getCurrentPaidTime(),
    paidBy: "Cash",
    remarks: "",
  });

  const studentId = challan?.studentId?._id || challan?.studentId || challan?.student?.id || challan?.student?._id;
  const { data: studentCreditData } = useQuery({
    queryKey: ['studentCredit', studentId],
    queryFn: () => getStudentCreditBalance(studentId),
    enabled: !!studentId && open,
  });

  const availableCredit = Number(studentCreditData?.availableCredit || 0);
  const [useCredit, setUseCredit] = useState(false);
  const [creditToApply, setCreditToApply] = useState(0);

  useEffect(() => {
    if (challan && open) {
      setUseCredit(false);
      setCreditToApply(0);

      const isExtra = challan.isExtra === true || challan.challanType === 'FEE_HEADS_ONLY';
      const isClosed = ['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(challan.status);
      const rate = isExtra
        ? Number(extraChallanLateFee || 0)
        : Number(lateFeeRatePerDay || challan.installment?.lateFeeRatePerDay || 0);

      const autoFee = (!isClosed && challan.dueDate && rate > 0)
        ? calculateLateFee(challan.dueDate, rate)
        : 0;

      const storedFee = isExtra
        ? Number(challan.lateFeeFine || 0)
        : Number(challan.lateFeeAmount ?? challan.snapshotLateFee ?? challan.lateFeeFine ?? 0);

      const addFee = storedFee > 0 ? 0 : autoFee;

      const baseTotal = isExtra
        ? Number(challan.totalAmount ?? 0)
        : Number(challan.snapshotTotalDue != null
            ? Number(challan.snapshotTotalDue)
            : ((challan.netPayable != null && Number(challan.netPayable) > 0)
                ? Number(challan.netPayable)
                : ((challan.amount || 0) + getTotalArrears(challan) + getSelectedHeadsTotal(challan) + (challan.lateFeeFine || 0) - (challan.discount || 0))
              )
          );

      const effectiveTotal = baseTotal + addFee;
      const alreadyPaid = Number(challan.paidAmount || 0);
      const outstanding = Math.max(0, effectiveTotal - alreadyPaid);

      setPaymentAmount(outstanding.toString());
      setChallanForm({
        paidDate: format(new Date(), "yyyy-MM-dd"),
        paidTime: getCurrentPaidTime(),
        paidBy: "Cash",
        remarks: challan.remarks || "",
      });
    }
  }, [challan, open, lateFeeRatePerDay, extraChallanLateFee]);

  // Default wallet selection based on payment mode or United Bank Limited / main account
  useEffect(() => {
    if (activeWallets.length === 0) return;
    if (!selectedWalletId) {
      const ubl = activeWallets.find(w => /United Bank Limited/i.test(w.name));
      if (challanForm.paidBy === "Cash") {
        const cashWallet = activeWallets.find(w => w.type === "CASH");
        setSelectedWalletId(cashWallet ? (cashWallet._id || cashWallet.id).toString() : (ubl ? (ubl._id || ubl.id).toString() : (activeWallets[0]._id || activeWallets[0].id).toString()));
      } else if (challanForm.paidBy === "Bank Account") {
        const bankWallet = ubl || activeWallets.find(w => w.type === "BANK");
        setSelectedWalletId(bankWallet ? (bankWallet._id || bankWallet.id).toString() : (activeWallets[0]._id || activeWallets[0].id).toString());
      } else {
        setSelectedWalletId(ubl ? (ubl._id || ubl.id).toString() : (activeWallets[0]._id || activeWallets[0].id).toString());
      }
    }
  }, [activeWallets, challanForm.paidBy, selectedWalletId]);

  if (!challan) return null;

  const isExtraC = challan.isExtra === true || challan.challanType === 'FEE_HEADS_ONLY';
  const isClosed = ['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(challan.status);
  const rate = isExtraC
    ? Number(extraChallanLateFee || 0)
    : Number(lateFeeRatePerDay || challan.installment?.lateFeeRatePerDay || 0);

  const autoLateFee = (!isClosed && challan.dueDate && rate > 0)
    ? calculateLateFee(challan.dueDate, rate)
    : 0;

  const storedLateFee = isExtraC
    ? Number(challan.lateFeeFine || 0)
    : Number(challan.lateFeeAmount ?? challan.snapshotLateFee ?? challan.lateFeeFine ?? 0);

  const lateFee = storedLateFee > 0 ? storedLateFee : autoLateFee;
  const additionalLateFee = storedLateFee > 0 ? 0 : autoLateFee;

  const base = isExtraC
    ? (Number(challan.totalAmount ?? 0) - Number(challan.lateFeeFine ?? 0) + Number(challan.discount ?? 0))
    : Number(challan.basePayable ?? challan.snapshotBaseAmount ?? challan.amount ?? 0);
  const arrears = isExtraC ? 0 : Number(challan.arrearsAmount ?? challan.snapshotArrearsAmount ?? 0);

  const baseTotalDue = isExtraC
    ? Number(challan.totalAmount ?? 0)
    : Number(challan.snapshotTotalDue != null
        ? Number(challan.snapshotTotalDue)
        : ((challan.netPayable != null && Number(challan.netPayable) > 0)
            ? Number(challan.netPayable)
            : (base + arrears + storedLateFee)
          )
      );

  const totalDue = baseTotalDue + additionalLateFee;
  const alreadyPaid = Number(challan.paidAmount || 0);
  const receiving = parseFloat(paymentAmount) || 0;
  const appliedCreditNum = useCredit ? (parseFloat(creditToApply) || 0) : 0;
  const remaining = totalDue - alreadyPaid - receiving - appliedCreditNum;
  const student = challan.student;
  const studentClass = challan.studentClass?.name || student?.class?.name || 'N/A';
  const selectedWallet = activeWallets.find(w => (w._id || w.id).toString() === selectedWalletId);

  const confirmPayment = async () => {
    if (!challan) return;
    if (receiving <= 0 && appliedCreditNum <= 0) {
      toast({ title: "Please enter receiving amount or apply credit", variant: "destructive" });
      return;
    }

    const submissionDate = buildPaidTimestamp(challanForm.paidDate, challanForm.paidTime);

    if (isExtraC) {
      setIsPaymentLoading(true);
      try {
        await recordExtraFeePayment({
          id: challan.id,
          challanId: challan.id,
          data: {
            amount: receiving,
            paymentMode: challanForm.paidBy || 'Cash',
            paidBy: challanForm.paidBy || 'Cash',
            paymentDate: submissionDate,
            paidDate: submissionDate,
            remarks: challanForm.remarks || undefined,
            walletId: selectedWalletId || undefined,
          }
        });
        queryClient.invalidateQueries(['feeChallans']);
        queryClient.invalidateQueries(['extraChallans']);
        queryClient.invalidateQueries(['studentFeeHistory']);
        queryClient.invalidateQueries(['wallets']);
        queryClient.invalidateQueries(['walletHistory']);
        queryClient.invalidateQueries(['walletTuitionLogs']);
        queryClient.invalidateQueries(['walletStats']);
        toast({ title: "Payment recorded successfully" });
        onOpenChange(false);
        onPaymentSuccess?.();
      } catch (err) {
        toast({ title: err.message || "Failed to record payment", variant: "destructive" });
      } finally {
        setIsPaymentLoading(false);
      }
      return;
    }

    // Regular installment challan payment
    setIsPaymentLoading(true);
    try {
      await recordFeePayment({
        challanId: challan.id,
        amount: receiving,
        useAdvanceCredit: appliedCreditNum,
        paymentMode: challanForm.paidBy || 'Cash',
        paidBy: challanForm.paidBy || 'Cash',
        paidDate: submissionDate,
        remarks: challanForm.remarks || undefined,
        walletId: selectedWalletId || undefined,
      });
      queryClient.invalidateQueries(['feeChallans']);
      queryClient.invalidateQueries(['extraChallans']);
      queryClient.invalidateQueries(['studentFeeHistory']);
      queryClient.invalidateQueries(['studentCredit']);
      queryClient.invalidateQueries(['wallets']);
      queryClient.invalidateQueries(['walletHistory']);
      queryClient.invalidateQueries(['walletTuitionLogs']);
      queryClient.invalidateQueries(['walletStats']);
      toast({ title: "Payment recorded successfully" });
      onOpenChange(false);
      onPaymentSuccess?.();
    } catch (err) {
      toast({ title: err.message || "Failed to record payment", variant: "destructive" });
    } finally {
      setIsPaymentLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-none" bodyClassName="p-0 gap-0">
        <DialogHeader className="px-4 sm:px-5 py-3 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              {challan?.challanType === 'FEE_HEADS_ONLY' ? 'Pay Extra Challan' : 'Pay Student Fee'}
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-mono font-semibold text-primary border-primary/30 bg-primary/5">
              #{challan.challanNumber || challan.challanNo}
            </Badge>
          </div>
        </DialogHeader>

        <div className="w-full p-4 sm:p-5 space-y-4">
          {challan.status === 'VOID' && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-2.5 rounded-md flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <div>
                This challan has been <span className="font-bold underline uppercase">Superseded</span>. Payment is disabled on this record.
              </div>
            </div>
          )}

          {/* Student Advance Credit Available Banner */}
          {availableCredit > 0 && !isExtraC && (
            <div className="p-2.5 rounded-md border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-100 font-bold text-[10px]">
                  Credit Available
                </Badge>
                <span className="text-emerald-900 dark:text-emerald-200 font-medium">
                  Student has <strong>PKR {availableCredit.toLocaleString()}</strong> in advance credit balance.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="apply-advance-credit-toggle" className="flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-800 dark:text-emerald-300">
                  <input
                    type="checkbox"
                    id="apply-advance-credit-toggle"
                    className="accent-emerald-600 h-4 w-4 rounded"
                    checked={useCredit}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setUseCredit(isChecked);
                      const fullDue = Math.max(0, totalDue - alreadyPaid);
                      if (isChecked) {
                        const maxApply = Math.min(availableCredit, fullDue);
                        setCreditToApply(maxApply);
                        setPaymentAmount(Math.max(0, fullDue - maxApply).toString());
                      } else {
                        setCreditToApply(0);
                        setPaymentAmount(fullDue.toString());
                      }
                    }}
                  />
                  <span>Apply Credit</span>
                </label>
                {useCredit && (
                  <Input
                    type="number"
                    className="h-6 w-24 text-xs font-bold text-center bg-white border-emerald-400"
                    value={creditToApply}
                    max={availableCredit}
                    onChange={(e) => {
                      const val = Math.min(availableCredit, Math.max(0, parseFloat(e.target.value) || 0));
                      setCreditToApply(val);
                      const fullDue = Math.max(0, totalDue - alreadyPaid);
                      setPaymentAmount(Math.max(0, fullDue - val).toString());
                    }}
                  />
                )}
              </div>
            </div>
          )}

          <div className="w-full border border-border/80 rounded-lg overflow-x-auto shadow-xs bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground text-[11px] font-semibold text-center border-b border-border">
                  <th className="border-r border-border/50 py-1.5 px-2">Roll No</th>
                  <th className="border-r border-border/50 py-1.5 px-2">Student</th>
                  <th className="border-r border-border/50 py-1.5 px-2">Class</th>
                  <th className="border-r border-border/50 py-1.5 px-2">{challan.challanType === 'FEE_HEADS_ONLY' ? 'Type' : 'Month'}</th>
                  <th className="border-r border-border/50 py-1.5 px-2 min-w-[75px]">{challan.challanType === 'FEE_HEADS_ONLY' ? 'Total' : 'Base Fee'}</th>
                  <th className="border-r border-border/50 py-1.5 px-2 min-w-[70px]">Arrears</th>
                  <th className="border-r border-border/50 py-1.5 px-2 min-w-[70px]">Late Fee</th>
                  <th className="border-r border-border/50 py-1.5 px-2 min-w-[80px]">Total Due</th>
                  <th className="border-r border-border/50 py-1.5 px-2 min-w-[65px]">Paid</th>
                  <th className="border-r border-border/50 py-1.5 px-2 min-w-[110px]">
                    <div className="flex items-center justify-center gap-1">
                      <span>Receiving</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-4 px-1.5 text-[9px] text-primary border-primary/30 hover:bg-primary/10 font-bold"
                        onClick={() => {
                          const full = Math.max(0, totalDue - alreadyPaid - appliedCreditNum);
                          setPaymentAmount(full.toString());
                        }}
                      >
                        Fill All
                      </Button>
                    </div>
                  </th>
                  <th className="py-1.5 px-2 min-w-[80px]">Remaining</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-xs text-center bg-card hover:bg-muted/20 transition-colors">
                  <td className="border-r border-border/50 py-2 px-2 font-mono text-[11px]">{student?.rollNumber || '—'}</td>
                  <td className="border-r border-border/50 py-2 px-2.5 text-left">
                    <div className="font-semibold text-foreground text-xs">{student?.fName} {student?.lName}</div>
                    <div className="text-[10px] text-muted-foreground">{student?.fatherOrguardian || ''}</div>
                  </td>
                  <td className="border-r border-border/50 py-2 px-2 text-xs">{studentClass}</td>
                  <td className="border-r border-border/50 py-2 px-2 font-semibold text-foreground">
                    {challan.challanType === 'FEE_HEADS_ONLY' ? (
                      <Badge variant="outline" className="text-[10px] border-purple-400 text-purple-700 bg-purple-50">EXTRA CHALLAN</Badge>
                    ) : (
                      challan.month || (challan.installmentNo ? `Inst #${challan.installmentNo}` : 'N/A')
                    )}
                  </td>
                  <td className="border-r border-border/50 py-2 px-2 font-medium">{base.toLocaleString()}</td>
                  <td className="border-r border-border/50 py-2 px-2 text-orange-600 font-semibold">
                    {arrears > 0 ? (
                      <div>
                        <div>{arrears.toLocaleString()}</div>
                        {Array.isArray(challan.arrearAllocations) && challan.arrearAllocations.length > 0 && (
                          <div className="text-[9px] text-muted-foreground font-normal">
                            {challan.arrearAllocations.map(a => a.sourceMonth ? a.sourceMonth.slice(0, 3) : `Inst #${a.sourceInstallmentNumber}`).join(', ')}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-muted-foreground/60">0</span>}
                  </td>
                  <td className="border-r border-border/50 py-2 px-2 text-red-600 font-semibold">
                    {lateFee > 0 ? (
                      <div>
                        <div>{lateFee.toLocaleString()}</div>
                        {autoLateFee > 0 && storedLateFee === 0 && (
                          <div className="text-[9px] text-red-500 font-normal italic">Auto accrued</div>
                        )}
                      </div>
                    ) : <span className="text-muted-foreground/60">0</span>}
                  </td>
                  <td className="border-r border-border/50 py-2 px-2 font-bold text-foreground">{totalDue.toLocaleString()}</td>
                  <td className="border-r border-border/50 py-2 px-2 text-emerald-600 font-semibold">{alreadyPaid.toLocaleString()}</td>
                  <td className="border-r border-border/50 py-1.5 px-2">
                    <Input
                      type="number"
                      autoFocus
                      className="h-7 text-center text-xs font-bold border-primary/50 focus-visible:ring-primary text-foreground"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-2">
                    {remaining < 0 ? (
                      <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[11px] py-1 px-1.5 rounded text-center">
                        {Math.abs(remaining).toLocaleString()} Advance
                        <div className="text-[8px] font-normal opacity-80">Credit Ledger</div>
                      </div>
                    ) : remaining === 0 ? (
                      <div className="text-emerald-600 font-bold text-xs">0 (Settled)</div>
                    ) : (
                      <div className="text-red-600 font-bold text-xs">{remaining.toLocaleString()}</div>
                    )}
                  </td>
                </tr>

                {/* Grand Total Row */}
                <tr className="bg-primary/5 text-foreground font-bold text-xs text-center border-t-2 border-primary/25">
                  <td colSpan={4} className="text-left px-3 py-1.5 border-r border-border/50 uppercase tracking-wider text-[11px] text-primary">
                    Grand Total {appliedCreditNum > 0 && <span className="text-emerald-600 text-[10px] normal-case">(incl. PKR {appliedCreditNum.toLocaleString()} credit)</span>}
                  </td>
                  <td className="border-r border-border/50 py-1.5 px-1">{base.toLocaleString()}</td>
                  <td className="border-r border-border/50 py-1.5 px-1 text-orange-600">{arrears.toLocaleString()}</td>
                  <td className="border-r border-border/50 py-1.5 px-1 text-red-600">{lateFee.toLocaleString()}</td>
                  <td className="border-r border-border/50 py-1.5 px-1 text-foreground font-extrabold">{totalDue.toLocaleString()}</td>
                  <td className="border-r border-border/50 py-1.5 px-1 text-emerald-600">{alreadyPaid.toLocaleString()}</td>
                  <td className="border-r border-border/50 py-1.5 px-1 text-primary font-black">
                    {(parseFloat(paymentAmount) || 0).toLocaleString()}
                  </td>
                  <td className="py-1.5 px-1 font-bold">
                    {remaining < 0 ? (
                      <span className="text-blue-600 text-[11px]">{Math.abs(remaining).toLocaleString()} (Adv)</span>
                    ) : remaining === 0 ? (
                      <span className="text-emerald-600 text-xs">0</span>
                    ) : (
                      <span className="text-red-600 text-xs">{remaining.toLocaleString()}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {challan?.challanType === 'FEE_HEADS_ONLY' && (challan?.heads?.length ?? 0) > 0 && (
            <div className="border border-purple-200 dark:border-purple-900/50 rounded-lg overflow-hidden">
              <div className="bg-purple-50/70 dark:bg-purple-950/30 px-3 py-1.5 border-b border-purple-200 dark:border-purple-900/50 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">Fee Heads Breakdown</span>
              </div>
              <div className="divide-y divide-purple-100 dark:divide-purple-900/30">
                {challan.heads.map((h, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-1.5 text-xs">
                    <span className="text-foreground">{h.headName}</span>
                    <span className="font-medium text-foreground">PKR {Number(h.amount).toLocaleString()}</span>
                  </div>
                ))}
                {Number(challan.lateFeeFine ?? 0) > 0 && (
                  <div className="flex justify-between items-center px-3 py-1.5 text-xs text-red-600">
                    <span>Late Fee Fine</span>
                    <span className="font-medium">PKR {Number(challan.lateFeeFine).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center px-3 py-1.5 text-xs font-bold bg-purple-50/40 dark:bg-purple-950/20">
                  <span className="text-purple-900 dark:text-purple-200">Total Due</span>
                  <span className="text-purple-900 dark:text-purple-200">PKR {Number(challan.totalAmount ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Paid Date</Label>
                <Input
                  type="date"
                  value={challanForm.paidDate}
                  onChange={(e) => setChallanForm({ ...challanForm, paidDate: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Paid Time</Label>
                <Input
                  type="time"
                  value={challanForm.paidTime}
                  onChange={(e) => setChallanForm({ ...challanForm, paidTime: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Paid By</Label>
                <Select
                  value={challanForm.paidBy}
                  onValueChange={(val) => {
                    setChallanForm({ ...challanForm, paidBy: val });
                    if (val === "Cash") {
                      const cashWallet = activeWallets.find(w => w.type === "CASH");
                      if (cashWallet) setSelectedWalletId((cashWallet._id || cashWallet.id).toString());
                    } else if (val === "Bank Account") {
                      const bankWallet = activeWallets.find(w => /United Bank Limited/i.test(w.name)) || activeWallets.find(w => w.type === "BANK");
                      if (bankWallet) setSelectedWalletId((bankWallet._id || bankWallet.id).toString());
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Account">Bank Account</SelectItem>
                    <SelectItem value="JazzCash">JazzCash</SelectItem>
                    <SelectItem value="Easypaisa">Easypaisa</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-primary" />
                  Deposit to Wallet
                </Label>
                <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={activeWallets.length === 0 ? "No active wallets" : "Select wallet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeWallets.map(w => (
                      <SelectItem key={w._id || w.id} value={(w._id || w.id).toString()} className="text-xs">
                        {w.name} ({w.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Remarks</Label>
              <Textarea
                value={challanForm.remarks}
                onChange={(e) => setChallanForm({ ...challanForm, remarks: e.target.value })}
                rows={2}
                className="min-h-[46px] text-xs resize-none"
                placeholder="Optional payment remarks..."
              />
            </div>

            <div className="flex justify-end items-center gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 px-5 text-xs"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={confirmPayment}
                disabled={isPaymentLoading || challan.status === 'VOID'}
                className="h-8 px-6 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              >
                {isPaymentLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Processing...
                  </>
                ) : challan.status === 'VOID' ? (
                  "Superseded"
                ) : (
                  "Pay Fee"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
