import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  Search,
  Plus,
  Eye,
  Printer,
  Edit,
  Trash2,
  Loader2,
  ArrowRight,
  X,
  Wallet,
  AlertCircle,
  ExternalLink,
  Receipt,
  Building,
  CheckCircle2,
} from "lucide-react";
import {
  getHostelRegistrations,
  getHostelRegistrationById,
  getHostelChallansDedicated,
  createHostelChallanDedicated,
  updateHostelChallanDedicated,
  deleteHostelChallanDedicated,
  recordHostelPayment,
  getFeeHeads,
  getInstituteSettings,
  getWallets,
} from "@/services/api";
import { Textarea } from "@/components/ui/textarea";
import { MonthPicker } from "@/components/ui/month-picker";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import {
  getChallanTotalEffective,
  getChallanBalanceEffective,
  generateHostelChallanHtml,
  checkHostelTemplateExists,
  monthValueToLabel,
  calculateHostelLateFee,
  getEffectiveLateFee,
  getChallanTotal,
  getChallanBalance,
  getHostelBaseFee,
  toHostelAmount,
  parseYearMonth,
  yearMonthToLabel,
  validateChallanEligibility,
} from "./hostelFinancialUtils";

export const FeesTab = ({ hostelRegistrations = [] }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete, canPayFee } = usePermissions("Boarding", "fees");

  const [allChallansSearch, setAllChallansSearch] = useState("");
  const [allChallansStatus, setAllChallansStatus] = useState("all");
  const [allChallansPage, setAllChallansPage] = useState(1);
  const [selectedChallanReg, setSelectedChallanReg] = useState(null);
  const [challanRegSearch, setChallanRegSearch] = useState("");
  const [challanRegResults, setChallanRegResults] = useState([]);

  const [generateChallanOpen, setGenerateChallanOpen] = useState(false);
  const [generateChallanForm, setGenerateChallanForm] = useState({
    monthValue: new Date().toISOString().slice(0, 7),
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    selectedFeeHeadIds: [],
    customHeads: [{ headName: "", amount: "" }],
    remarks: "",
  });
  const [bulkGenSelected, setBulkGenSelected] = useState([]);
  const [bulkGenSearch, setBulkGenSearch] = useState("");
  const [bulkGenTypeFilter, setBulkGenTypeFilter] = useState("all");
  const [bulkChallanMap, setBulkChallanMap] = useState({});
  const [bulkGenCreating, setBulkGenCreating] = useState(false);

  const [payHostelChallanOpen, setPayHostelChallanOpen] = useState(false);
  const [payingChallan, setPayingChallan] = useState(null);
  const [payHostelAmount, setPayHostelAmount] = useState("");
  const [payHostelDate, setPayHostelDate] = useState(new Date().toISOString().split("T")[0]);
  const [payHostelWalletId, setPayHostelWalletId] = useState("");
  const [payHostelPaymentMode, setPayHostelPaymentMode] = useState("Cash");
  const [payHostelRemarks, setPayHostelRemarks] = useState("");
  const [payHostelLoading, setPayHostelLoading] = useState(false);

  // View Details Modal States
  const [viewingChallan, setViewingChallan] = useState(null);
  const [viewingChallanReg, setViewingChallanReg] = useState(null);
  const [hasTemplateInConfig, setHasTemplateInConfig] = useState(true);
  const [viewDetailLoading, setViewDetailLoading] = useState(false);

  const [challanPreviewOpen, setChallanPreviewOpen] = useState(false);
  const [challanPreviewHtml, setChallanPreviewHtml] = useState("");
  const [hostelPreviewPrinting, setHostelPreviewPrinting] = useState(false);
  const [hostelPrintingId, setHostelPrintingId] = useState(null);

  const [editingHostelChallan, setEditingHostelChallan] = useState(null);
  const [editHostelChallanForm, setEditHostelChallanForm] = useState({
    dueDate: "",
    discount: "",
    remarks: "",
    heads: [],
    hostelFee: "",
    arrearsAmount: 0,
  });

  const [challanDeleteConfirmOpen, setChallanDeleteConfirmOpen] = useState(false);
  const [challanToDelete, setChallanToDelete] = useState(null);

  const {
    data: allRegistrationsData,
    isLoading: isBoardingsLoading,
    refetch: refetchBoardings,
  } = useQuery({
    queryKey: ['hostelRegistrationsAllList'],
    queryFn: () => getHostelRegistrations({ limit: 1000 }),
  });
  const allBoardings = allRegistrationsData?.data || (Array.isArray(hostelRegistrations) && hostelRegistrations.length > 0 ? hostelRegistrations : []);

  const editingRegId = editingHostelChallan?.registrationId || editingHostelChallan?.hostelRegistrationId;
  const { data: editingBoarderReg, isLoading: isEditingBoarderLoading } = useQuery({
    queryKey: ['hostelRegistrationSingle', editingRegId],
    queryFn: () => getHostelRegistrationById(editingRegId),
    enabled: !!editingRegId,
  });

  const { data: instituteSettings } = useQuery({
    queryKey: ['instituteSettings'],
    queryFn: getInstituteSettings,
    staleTime: 5 * 60 * 1000,
  });
  const hostelLateFee = instituteSettings?.hostelLateFee ?? 0;

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['feeHeads'],
    queryFn: getFeeHeads,
  });

  const { data: walletsData } = useQuery({
    queryKey: ['wallets'],
    queryFn: getWallets,
  });
  const activeWallets = (walletsData?.wallets || []).filter((w) => w.status === 'ACTIVE');

  const { data: allChallansResponse, isLoading: allChallansLoading } = useQuery({
    queryKey: ['hostelChallansAll', allChallansPage, allChallansStatus, allChallansSearch],
    queryFn: () => getHostelChallansDedicated({
      page: allChallansPage,
      limit: 25,
      status: allChallansStatus !== 'all' ? allChallansStatus : undefined,
      search: allChallansSearch || undefined,
    }),
    enabled: !selectedChallanReg,
  });
  const allChallans = Array.isArray(allChallansResponse)
    ? allChallansResponse
    : Array.isArray(allChallansResponse?.data)
    ? allChallansResponse.data
    : [];
  const allChallansMeta = allChallansResponse?.meta || { total: 0, lastPage: 1 };

  const { data: singleRegChallansResponse } = useQuery({
    queryKey: ['hostelChallans', selectedChallanReg?.id],
    queryFn: () => getHostelChallansDedicated({ registrationId: selectedChallanReg.id }),
    enabled: !!selectedChallanReg,
  });
  const hostelChallans = Array.isArray(singleRegChallansResponse)
    ? singleRegChallansResponse
    : Array.isArray(singleRegChallansResponse?.data)
    ? singleRegChallansResponse.data
    : [];

  const invalidateAllChallanQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['hostelChallans'] });
    queryClient.invalidateQueries({ queryKey: ['hostelChallansAll'] });
    queryClient.invalidateQueries({ queryKey: ['hostelRegistrationsAllList'] });
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
    queryClient.invalidateQueries({ queryKey: ['walletHistory'] });
    queryClient.invalidateQueries({ queryKey: ['walletHostelLogs'] });
  };

  const createChallanMutation = useMutation({
    mutationFn: createHostelChallanDedicated,
    onSuccess: () => {
      invalidateAllChallanQueries();
      toast({ title: "Challan generated" });
      setGenerateChallanOpen(false);
    },
    onError: (e) => toast({ title: e.message || "Failed to generate", variant: "destructive" }),
  });

  const updateChallanMutation = useMutation({
    mutationFn: ({ id, data, dto }) => updateHostelChallanDedicated(id, data || dto),
    onSuccess: () => {
      invalidateAllChallanQueries();
      toast({ title: "Challan updated" });
      setEditingHostelChallan(null);
    },
    onError: (e) => toast({ title: e.message || "Failed to update", variant: "destructive" }),
  });

  const deleteChallanMutation = useMutation({
    mutationFn: deleteHostelChallanDedicated,
    onSuccess: () => {
      invalidateAllChallanQueries();
      toast({ title: "Challan deleted" });
    },
    onError: (e) => toast({ title: e.message || "Failed to delete", variant: "destructive" }),
  });

  const previewHostelChallan = async (challan, reg) => {
    setViewDetailLoading(true);
    setViewingChallan(challan);
    setViewingChallanReg(reg);
    try {
      const templateExists = await checkHostelTemplateExists();
      setHasTemplateInConfig(templateExists);
      const html = await generateHostelChallanHtml(challan, reg, hostelLateFee);
      setChallanPreviewHtml(html);
      setChallanPreviewOpen(true);
    } catch (e) {
      toast({ title: "Error", description: e.message || "Could not generate details", variant: "destructive" });
    } finally {
      setViewDetailLoading(false);
    }
  };

  const printHostelChallan = async (challan, reg) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print challans.", variant: "destructive" });
      return;
    }
    const trackingId = `hostel-${challan.id || challan.challanNumber}`;
    setHostelPrintingId(trackingId);
    try {
      const html = await generateHostelChallanHtml(challan, reg, hostelLateFee);
      await openManagedPrintWindow({ html, title: `Challan #${challan.challanNumber || ""}`, toast, printWindow });
    } catch (e) {
      toast({ title: "Print error", description: e.message || "Failed to print", variant: "destructive" });
      printWindow?.close?.();
    } finally {
      setHostelPrintingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search challan #, student name, roll..."
              value={allChallansSearch}
              onChange={(e) => {
                setAllChallansSearch(e.target.value);
                setAllChallansPage(1);
                setSelectedChallanReg(null);
                setChallanRegSearch("");
              }}
              className="pl-9 h-9"
            />
          </div>
          <Select
            value={allChallansStatus}
            onValueChange={(v) => {
              setAllChallansStatus(v);
              setAllChallansPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="SUPERSEDED">Superseded</SelectItem>
              <SelectItem value="SETTLED">Settled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canCreate && (
          <Button
            onClick={async () => {
              setBulkGenSearch("");
              setBulkGenTypeFilter("all");
              setGenerateChallanOpen(true);
              const fresh = await refetchBoardings();
              const boardings = fresh?.data?.data || allBoardings;

              const map = {};
              await Promise.all(
                boardings.map(async (reg) => {
                  try {
                    const response = await getHostelChallansDedicated({ registrationId: reg.id });
                    map[reg.id] = Array.isArray(response)
                      ? response
                      : Array.isArray(response?.data)
                      ? response.data
                      : [];
                  } catch {
                    map[reg.id] = [];
                  }
                })
              );
              setBulkChallanMap(map);

              const targetYm = parseYearMonth(generateChallanForm.monthValue);
              const eligibleIds = boardings
                .filter((r) => validateChallanEligibility(r, targetYm, map[r.id] || []).eligible)
                .map((r) => r.id);
              setBulkGenSelected(eligibleIds);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Generate Challans
          </Button>
        )}
      </div>

      {selectedChallanReg && (() => {
        const reg = selectedChallanReg;
        const name = reg.student ? `${reg.student.fName} ${reg.student.lName || ''}`.trim() : reg.externalName;
        return (
          <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <span className="font-semibold">{name}</span>
            <span className="text-muted-foreground">{reg.student ? `Roll: ${reg.student.rollNumber}` : `Reg: ${reg.id}`}</span>
            <span className="text-muted-foreground">· PKR {Number(reg.decidedFeePerMonth || 0).toLocaleString()}/mo</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs ml-auto" onClick={() => setSelectedChallanReg(null)}>
              <X className="mr-1 h-3 w-3" /> Clear filter
            </Button>
          </div>
        );
      })()}

      <Card>
        <CardContent className="pt-4">
          {(selectedChallanReg ? false : allChallansLoading) ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Challan No</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Student</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Month</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Heads</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-foreground bg-slate-100">Total</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-green-700 bg-green-50">Paid</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-orange-700 bg-orange-50">Balance</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Due Date</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Status</TableHead>
                      <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const rows = selectedChallanReg ? hostelChallans : allChallans;
                      const reg = selectedChallanReg;
                      if (rows.length === 0) return (
                        <TableRow>
                          <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                            {selectedChallanReg ? "No challans for this student yet." : "No challans found."}
                          </TableCell>
                        </TableRow>
                      );
                      return rows.map((c, idx) => {
                        const total = getChallanTotalEffective(c, hostelLateFee);
                        const directPaid = Number(c.paidAmount || 0);
                        const settledArrears = Number(c.settledViaArrearsAmount || 0);
                        const isSettled = c.status === 'SETTLED' || (c.supersededBy && (c.supersededBy.status === 'PAID' || c.supersededBy.paidAmount > 0));
                        const effectiveSettledArrears = settledArrears > 0 ? settledArrears : (isSettled ? Math.max(0, total - directPaid) : 0);
                        const totalSettledOrPaid = directPaid + effectiveSettledArrears;
                        const balance = isSettled ? 0 : Math.max(0, total - totalSettledOrPaid);
                        const settledChallanNo = c.settledByChallanNo || (c.supersededBy?.challanNumber || c.supersededBy?.challanNo);
                        const settledMonth = c.settledByMonth || c.supersededBy?.month;
                        const studentName = c.student
                          ? `${c.student.fName} ${c.student.lName || ''}`.trim()
                          : c.hostelRegistration?.externalName || c.hostelRegNumber;
                        const rollNo = c.student?.rollNumber || '';
                        const challanReg = reg || {
                          id: c.hostelRegNumber,
                          student: c.student,
                          externalName: c.hostelRegistration?.externalName,
                          decidedFeePerMonth: c.hostelRegistration?.decidedFeePerMonth,
                        };

                        return (
                          <TableRow key={c.id} className={`${idx % 2 === 1 ? 'bg-muted/20' : ''} ${c.status === 'VOID' || (c.status === 'SUPERSEDED' && !isSettled) ? 'opacity-50' : ''}`}>
                            <TableCell className="py-2 px-3 text-sm font-medium">{c.challanNumber}</TableCell>
                            <TableCell className="py-2 px-3 text-sm">
                              <div className="font-medium text-sm">{studentName}</div>
                              {rollNo && <div className="text-xs text-muted-foreground">{rollNo}</div>}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-sm">{c.month}</TableCell>
                            <TableCell className="py-2 px-3 text-sm">
                              <div className="flex flex-col gap-0.5 max-w-[150px]">
                                {toHostelAmount(c.hostelFee) > 0 && (
                                  <div className="flex justify-between text-[11px] font-medium text-foreground gap-2">
                                    <span>Boarding Fee</span>
                                    <span>{toHostelAmount(c.hostelFee).toLocaleString()}</span>
                                  </div>
                                )}
                                {c.heads?.map((h, i) => (
                                  <div key={i} className="flex justify-between text-[10px] text-muted-foreground gap-2">
                                    <span className="truncate">{h.headName}</span>
                                    <span>{Number(h.amount).toLocaleString()}</span>
                                  </div>
                                ))}
                                {toHostelAmount(c.arrearsAmount) > 0 && (
                                  <div className="flex justify-between text-[10px] text-amber-600 font-semibold gap-2">
                                    <span>Arrears</span>
                                    <span>{toHostelAmount(c.arrearsAmount).toLocaleString()}</span>
                                  </div>
                                )}
                                {toHostelAmount(c.discount) > 0 && (
                                  <div className="flex justify-between text-[10px] text-green-600 gap-2">
                                    <span>Discount</span>
                                    <span>-{toHostelAmount(c.discount).toLocaleString()}</span>
                                  </div>
                                )}
                                {toHostelAmount(c.advanceApplied) > 0 && (
                                  <div className="flex flex-col text-[10px] text-sky-700 font-semibold bg-sky-50 px-1 py-0.5 rounded border border-sky-200 mt-0.5">
                                    <div className="flex justify-between gap-2">
                                      <span>Advance Deduction</span>
                                      <span>-{toHostelAmount(c.advanceApplied).toLocaleString()}</span>
                                    </div>
                                    {c.advanceFromChallanNo && (
                                      <span className="text-[9px] text-sky-600 font-normal">via #{c.advanceFromChallanNo}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 px-3 text-sm font-bold bg-slate-50">PKR {total.toLocaleString()}</TableCell>
                            <TableCell className="py-2 px-3 text-sm text-green-600 font-semibold bg-green-50/50">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>PKR {totalSettledOrPaid.toLocaleString()}</span>
                                  {isSettled && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-400 text-emerald-700 bg-emerald-50 font-normal">
                                      Settled
                                    </Badge>
                                  )}
                                </div>
                                {effectiveSettledArrears > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="text-[10px] text-emerald-700 font-normal cursor-help truncate max-w-[140px]">
                                        Settled: PKR {effectiveSettledArrears.toLocaleString()} via #{settledChallanNo || ''}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      {directPaid > 0 && <div>Direct Payment: PKR {directPaid.toLocaleString()}</div>}
                                      <div>Settled via Arrears in Challan #{settledChallanNo || ''} {settledMonth ? `(${settledMonth})` : ''}: PKR {effectiveSettledArrears.toLocaleString()}</div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              {toHostelAmount(c.excessCreditGenerated) > 0 && (
                                <div className="mt-1 text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 leading-tight">
                                  <div className="font-semibold">+ PKR {toHostelAmount(c.excessCreditGenerated).toLocaleString()} in Advance Credit</div>
                                  {toHostelAmount(c.creditRemaining) > 0 ? (
                                    <div className="text-[9px] text-emerald-600 font-normal">PKR {toHostelAmount(c.creditRemaining).toLocaleString()} remaining</div>
                                  ) : (
                                    Array.isArray(c.creditAdjustedTo) && c.creditAdjustedTo.length > 0 && (
                                      <div className="text-[9px] text-emerald-600 font-normal truncate max-w-[140px]">
                                        Adjusted to #{c.creditAdjustedTo.map((a) => a.targetChallanNo).join(', #')}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                              {(() => {
                                const walletsList = [];
                                if (Array.isArray(c.payments) && c.payments.length > 0) {
                                  c.payments.forEach((p) => {
                                    if (p.walletName && !walletsList.includes(p.walletName)) {
                                      walletsList.push(p.walletName);
                                    }
                                  });
                                }
                                if (walletsList.length === 0 && c.walletName) {
                                  walletsList.push(c.walletName);
                                }
                                if (walletsList.length > 0) {
                                  return (
                                    <div
                                      className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5"
                                      title={`Deposited into: ${walletsList.join(', ')}`}
                                    >
                                      <Wallet className="w-2.5 h-2.5 shrink-0" />
                                      <span className="truncate max-w-[120px]">{walletsList.join(', ')}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </TableCell>
                            <TableCell className={`py-2 px-3 text-sm font-semibold bg-orange-50/50 ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              PKR {balance.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-sm">{c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '—'}</TableCell>
                            <TableCell className="py-2 px-3 text-sm">
                              <div className="flex flex-col gap-0.5">
                                {isSettled || c.status === 'SETTLED' ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-medium cursor-help">
                                        SETTLED
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      Settled via arrears clearance in Challan #{settledChallanNo || ''} {settledMonth ? `(${settledMonth})` : ''}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : c.status === 'PAID' && toHostelAmount(c.advanceApplied) > 0 && Number(c.paidAmount || 0) === 0 ? (
                                  <Badge className="bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-100 font-medium">
                                    Paid via Advance
                                  </Badge>
                                ) : (
                                  <Badge variant={c.status === 'PAID' ? 'default' : (c.status === 'VOID' || c.status === 'SUPERSEDED') ? 'outline' : c.status === 'PARTIAL' ? 'warning' : 'secondary'}>
                                    {c.status}
                                  </Badge>
                                )}
                                {(c.status === 'SUPERSEDED' || isSettled || c.status === 'SETTLED') && (c.supersededBy || settledChallanNo) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={`flex items-center gap-0.5 text-[9px] cursor-help ${isSettled || c.status === 'SETTLED' ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                                        <ArrowRight className="w-2.5 h-2.5" />
                                        <span>#{settledChallanNo || c.supersededBy?.challanNumber}</span>
                                        {(isSettled || c.status === 'SETTLED') && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 inline ml-0.5" />}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      {isSettled || c.status === 'SETTLED'
                                        ? `Absorbed & settled by Challan #${settledChallanNo || c.supersededBy?.challanNumber} ${settledMonth ? `(${settledMonth})` : ''}`
                                        : `Absorbed into Challan #${settledChallanNo || c.supersededBy?.challanNumber}`}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 px-3 text-sm">
                              <div className="flex gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="outline" onClick={() => previewHostelChallan(c, challanReg)}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View Details</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="outline" onClick={() => printHostelChallan(c, challanReg)} disabled={hostelPrintingId === `hostel-${c.id || c.challanNumber}`}>
                                      {hostelPrintingId === `hostel-${c.id || c.challanNumber}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Print</TooltipContent>
                                </Tooltip>
                                {c.status !== 'PAID' && c.status !== 'VOID' && c.status !== 'SUPERSEDED' && c.status !== 'SETTLED' && !isSettled && (canPayFee || canUpdate) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-green-600 border-green-300 hover:bg-green-50"
                                        onClick={() => {
                                          setPayingChallan(c);
                                          setPayHostelAmount(String(balance));
                                          setPayHostelDate(new Date().toISOString().split('T')[0]);
                                          const defaultW = activeWallets[0];
                                          setPayHostelWalletId(defaultW?.id || "");
                                          setPayHostelPaymentMode(defaultW?.type === 'BANK' ? 'Bank Transfer' : 'Cash');
                                          setPayHostelRemarks("");
                                          setPayHostelChallanOpen(true);
                                        }}
                                      >
                                        Pay
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Record Payment</TooltipContent>
                                  </Tooltip>
                                )}
                                {c.status !== 'PAID' && c.status !== 'SUPERSEDED' && c.status !== 'SETTLED' && !isSettled && canUpdate && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingHostelChallan(c);
                                          const existingHeads = c.heads || [];
                                          const loadedCustomHeads = existingHeads
                                            .filter((h) => !h.feeHeadId && h.headName !== 'Hostel Fee' && h.headName !== 'Arrears')
                                            .map((h) => ({ headName: h.headName, amount: String(h.amount) }));
                                          setEditHostelChallanForm({
                                            hostelFee: String(c.hostelFee || ""),
                                            arrearsAmount: Number(c.arrearsAmount || 0),
                                            fineAmount: String(c.fineAmount || ""),
                                            discount: String(c.discount || ""),
                                            remarks: c.remarks || "",
                                            dueDate: c.dueDate ? new Date(c.dueDate).toISOString().split('T')[0] : "",
                                            heads: loadedCustomHeads.length > 0 ? loadedCustomHeads : [{ headName: "", amount: "" }],
                                          });
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit</TooltipContent>
                                  </Tooltip>
                                )}
                                {canDelete && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="destructive" onClick={() => { setChallanToDelete(c); setChallanDeleteConfirmOpen(true); }}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>

              {!selectedChallanReg && allChallansMeta.lastPage > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {allChallansMeta.total} total · page {allChallansPage} of {allChallansMeta.lastPage}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={allChallansPage <= 1} onClick={() => setAllChallansPage((p) => p - 1)}>
                      ← Prev
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={allChallansPage >= allChallansMeta.lastPage} onClick={() => setAllChallansPage((p) => p + 1)}>
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Generate Challans Dialog */}
      <Dialog
        open={generateChallanOpen}
        onOpenChange={(open) => {
          setGenerateChallanOpen(open);
          if (!open) setBulkGenSearch("");
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Generate Boarding Fee Challans</DialogTitle>
          </DialogHeader>

          {(() => {
            const targetYm = parseYearMonth(generateChallanForm.monthValue) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
            const monthLabel = yearMonthToLabel(targetYm.year, targetYm.month);

            const predefinedHeads = feeHeads
              .filter((h) => generateChallanForm.selectedFeeHeadIds.includes(h.id))
              .map((h) => ({ feeHeadId: h.id, headName: h.name, amount: Number(h.amount) || 0 }));
            const validCustom = generateChallanForm.customHeads
              .filter((h) => h.headName && h.amount)
              .map((h) => ({ headName: h.headName, amount: Number(h.amount) || 0 }));
            const combinedHeads = [...predefinedHeads, ...validCustom];
            const activeHeadsTotal = combinedHeads.reduce((sum, h) => sum + h.amount, 0);

            const filteredRegistrations = allBoardings.filter((reg) => {
              const isInternal = reg.registrationType === "internal" || (!reg.registrationType && !!reg.studentId);
              if (bulkGenTypeFilter === "internal" && !isInternal) return false;
              if (bulkGenTypeFilter === "external" && isInternal) return false;

              if (!bulkGenSearch.trim()) return true;
              const q = bulkGenSearch.toLowerCase();
              const name = reg.student
                ? `${reg.student.fName || ''} ${reg.student.lName || ''}`.toLowerCase()
                : (reg.externalName || '').toLowerCase();
              const roll = (reg.student?.rollNumber || '').toLowerCase();
              const inst = (reg.externalInstitute || '').toLowerCase();
              const roomName = (reg.room?.name || reg.room?.roomNumber || '').toLowerCase();
              return name.includes(q) || roll.includes(q) || inst.includes(q) || roomName.includes(q);
            });

            return (
              <>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Month <span className="text-destructive">*</span></Label>
                      <MonthPicker
                        value={generateChallanForm.monthValue}
                        onChange={(val) => {
                          setGenerateChallanForm((f) => ({ ...f, monthValue: val }));
                          const newTargetYm = parseYearMonth(val);
                          const eligibleIds = allBoardings
                            .filter((r) => validateChallanEligibility(r, newTargetYm, bulkChallanMap[r.id] || []).eligible)
                            .map((r) => r.id);
                          setBulkGenSelected(eligibleIds);
                        }}
                      />
                      <p className="text-xs text-muted-foreground truncate">{monthLabel}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Due Date <span className="text-destructive">*</span></Label>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        value={generateChallanForm.dueDate}
                        onChange={(e) => setGenerateChallanForm((f) => ({ ...f, dueDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Predefined Fee Heads</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5 border rounded-lg p-2.5 max-h-32 overflow-y-auto bg-slate-50/50">
                      {feeHeads.map((head) => (
                        <label key={head.id} className="flex items-center gap-2 text-xs cursor-pointer select-none hover:text-primary">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                            checked={generateChallanForm.selectedFeeHeadIds.includes(head.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...generateChallanForm.selectedFeeHeadIds, head.id]
                                : generateChallanForm.selectedFeeHeadIds.filter((id) => id !== head.id);
                              setGenerateChallanForm({ ...generateChallanForm, selectedFeeHeadIds: ids });
                            }}
                          />
                          <span className="truncate">{head.name} (PKR {Number(head.amount).toLocaleString()})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Custom / Ad-hoc Heads</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setGenerateChallanForm({ ...generateChallanForm, customHeads: [...generateChallanForm.customHeads, { headName: "", amount: "" }] })}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Head
                      </Button>
                    </div>
                    <div className="space-y-2 mt-1 max-h-32 overflow-y-auto pr-1">
                      {generateChallanForm.customHeads.map((ch, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            placeholder="Head Name"
                            className="h-8 text-xs flex-1"
                            value={ch.headName}
                            onChange={(e) => {
                              const newHeads = [...generateChallanForm.customHeads];
                              newHeads[idx].headName = e.target.value;
                              setGenerateChallanForm({ ...generateChallanForm, customHeads: newHeads });
                            }}
                          />
                          <Input
                            placeholder="Amount"
                            type="number"
                            className="h-8 text-xs w-28"
                            value={ch.amount}
                            onChange={(e) => {
                              const newHeads = [...generateChallanForm.customHeads];
                              newHeads[idx].amount = e.target.value;
                              setGenerateChallanForm({ ...generateChallanForm, customHeads: newHeads });
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive shrink-0"
                            onClick={() => {
                              const newHeads = generateChallanForm.customHeads.filter((_, i) => i !== idx);
                              setGenerateChallanForm({ ...generateChallanForm, customHeads: newHeads });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Remarks</Label>
                    <Textarea
                      placeholder="Optional remarks..."
                      className="h-16 text-xs mt-1"
                      value={generateChallanForm.remarks}
                      onChange={(e) => setGenerateChallanForm((f) => ({ ...f, remarks: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Filter by name, roll, institute, room..."
                          value={bulkGenSearch}
                          onChange={(e) => setBulkGenSearch(e.target.value)}
                          className="pl-8 h-8 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant={bulkGenTypeFilter === "all" ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => setBulkGenTypeFilter("all")}
                        >
                          All ({allBoardings.length})
                        </Button>
                        <Button
                          type="button"
                          variant={bulkGenTypeFilter === "internal" ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => setBulkGenTypeFilter("internal")}
                        >
                          Internal ({allBoardings.filter((r) => r.registrationType === 'internal' || (!r.registrationType && !!r.studentId)).length})
                        </Button>
                        <Button
                          type="button"
                          variant={bulkGenTypeFilter === "external" ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => setBulkGenTypeFilter("external")}
                        >
                          External ({allBoardings.filter((r) => r.registrationType === 'external' || (!r.studentId && !!r.externalName)).length})
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          className="text-primary hover:underline font-medium"
                          onClick={() => {
                            const validIds = filteredRegistrations
                              .filter((r) => validateChallanEligibility(r, targetYm, bulkChallanMap[r.id] || [], nMonths).eligible)
                              .map((r) => r.id);
                            setBulkGenSelected((prev) => Array.from(new Set([...prev, ...validIds])));
                          }}
                        >
                          Select eligible
                        </button>
                        <span className="text-muted-foreground">|</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:underline"
                          onClick={() => {
                            const idsToClear = new Set(filteredRegistrations.map((r) => r.id));
                            setBulkGenSelected((prev) => prev.filter((id) => !idsToClear.has(id)));
                          }}
                        >
                          None
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {isBoardingsLoading ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredRegistrations.map((reg) => {
                        const regChallans = bulkChallanMap[reg.id] || [];
                        const eligibility = validateChallanEligibility(reg, targetYm, regChallans);
                        const decidedFee = Number(reg.decidedFeePerMonth || 0);
                        const grossTotal = decidedFee + activeHeadsTotal + (eligibility.arrearsAmount || 0);
                        const availableAdv = Number(reg.availableAdvanceCredit || 0);
                        const advanceDeducted = Math.min(grossTotal, availableAdv);
                        const netPayable = Math.max(0, grossTotal - availableAdv);
                        const isSelected = bulkGenSelected.includes(reg.id);

                        const isInternal = reg.registrationType === "internal" || (!reg.registrationType && !!reg.studentId);
                        const name = reg.student
                          ? `${reg.student.fName || ''} ${reg.student.lName || ''}`.trim()
                          : reg.externalName;
                        const subInfo = isInternal
                          ? `Roll: ${reg.student?.rollNumber || 'N/A'}`
                          : `Institute: ${reg.externalInstitute || 'External'}`;
                        const roomLabel = reg.room?.name || reg.room?.roomNumber ? `Room: ${reg.room?.name || reg.room?.roomNumber}` : '';

                        return (
                          <div
                            key={reg.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                              !eligibility.eligible
                                ? 'bg-slate-50/60 border-slate-200 opacity-75'
                                : isSelected
                                ? 'bg-primary/5 border-primary/30'
                                : 'hover:bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                disabled={!eligibility.eligible}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setBulkGenSelected((prev) => [...prev, reg.id]);
                                  } else {
                                    setBulkGenSelected((prev) => prev.filter((id) => id !== reg.id));
                                  }
                                }}
                                className="mt-1 rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 disabled:opacity-40 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs text-foreground truncate">{name}</span>
                                  <Badge variant={isInternal ? "secondary" : "outline"} className="text-[9px] h-4 py-0 px-1.5 font-normal">
                                    {isInternal ? "Internal" : "External"}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {subInfo} {roomLabel ? `· ${roomLabel}` : ''} · PKR {decidedFee.toLocaleString()}/mo
                                </div>
                                <div className="text-[11px] mt-0.5">
                                  {eligibility.code === 'ALREADY_EXISTS' && (
                                    <span className="text-blue-600 font-medium">{eligibility.reason}</span>
                                  )}
                                  {eligibility.code === 'BEFORE_REGISTRATION' && (
                                    <span className="text-destructive font-medium">{eligibility.reason}</span>
                                  )}
                                  {eligibility.code === 'MISSING_PREVIOUS' && (
                                    <span className="text-amber-600 font-medium">{eligibility.reason}</span>
                                  )}
                                  {eligibility.code === 'READY' && eligibility.arrearsAmount > 0 && (
                                    <span className="text-amber-600 font-semibold">{eligibility.reason}</span>
                                  )}
                                  {eligibility.code === 'READY' && eligibility.arrearsAmount === 0 && (
                                    <span className="text-muted-foreground italic">{eligibility.reason}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right pl-3 shrink-0">
                              <div className="text-xs font-bold text-foreground">
                                PKR {netPayable.toLocaleString()}
                              </div>
                              {advanceDeducted > 0 && (
                                <div className="text-[10px] text-emerald-600 font-semibold">
                                  Adv: -PKR {advanceDeducted.toLocaleString()}
                                </div>
                              )}
                              {eligibility.arrearsAmount > 0 && (
                                <div className="text-[10px] text-amber-600 font-medium">
                                  incl. PKR {eligibility.arrearsAmount.toLocaleString()} arrears
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {!isBoardingsLoading && filteredRegistrations.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No registrations found.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t mt-2">
                  <span className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{bulkGenSelected.length}</strong> boarder(s) selected
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setGenerateChallanOpen(false)}>Cancel</Button>
                    <Button
                      disabled={bulkGenCreating || bulkGenSelected.length === 0}
                      onClick={async () => {
                        setBulkGenCreating(true);
                        try {
                          let successCount = 0;
                          const errors = [];

                          for (const regId of bulkGenSelected) {
                            const reg = allBoardings.find((r) => r.id === regId);
                            if (!reg) continue;
                            const regChallans = bulkChallanMap[reg.id] || [];
                            const eligibility = validateChallanEligibility(reg, targetYm, regChallans);

                            if (!eligibility.eligible) {
                              const bName = reg.student ? `${reg.student.fName || ''} ${reg.student.lName || ''}`.trim() : reg.externalName;
                              errors.push(`${bName}: ${eligibility.reason}`);
                              continue;
                            }

                            const decidedFee = Number(reg.decidedFeePerMonth || 0);

                            try {
                              await createHostelChallanDedicated({
                                hostelRegistrationId: regId,
                                month: monthLabel,
                                dueDate: generateChallanForm.dueDate,
                                hostelFee: decidedFee,
                                heads: combinedHeads,
                                arrearsAmount: eligibility.arrearsAmount || 0,
                                remarks: generateChallanForm.remarks || "",
                              });
                              successCount++;
                            } catch (err) {
                              const bName = reg.student ? `${reg.student.fName || ''} ${reg.student.lName || ''}`.trim() : reg.externalName;
                              errors.push(`${bName}: ${err.message || 'Failed'}`);
                            }
                          }

                          invalidateAllChallanQueries();
                          setGenerateChallanOpen(false);

                          if (successCount > 0) {
                            toast({
                              title: `${successCount} Challan(s) generated successfully for ${monthLabel}`,
                            });
                          }
                          if (errors.length > 0) {
                            toast({
                              title: "Some challans could not be generated",
                              description: errors.slice(0, 3).join("; "),
                              variant: "destructive",
                            });
                          }
                        } catch (e) {
                          toast({ title: e.message || "Failed to generate challans", variant: "destructive" });
                        } finally {
                          setBulkGenCreating(false);
                        }
                      }}
                    >
                      {bulkGenCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Generate ({bulkGenSelected.length})
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={payHostelChallanOpen} onOpenChange={setPayHostelChallanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Record Challan Payment
            </DialogTitle>
          </DialogHeader>
          {payingChallan && (() => {
            const effectiveLF = getEffectiveLateFee(payingChallan, hostelLateFee);
            const effectiveTotal = getChallanTotalEffective(payingChallan, hostelLateFee);
            const effectiveBalance = getChallanBalanceEffective(payingChallan, hostelLateFee);
            const studentName = payingChallan.student
              ? `${payingChallan.student.fName} ${payingChallan.student.lName || ''}`.trim()
              : (payingChallan.hostelRegistration?.externalName || payingChallan.hostelRegNumber);
            const enteredAmount = Number(payHostelAmount || 0);
            const isExcess = enteredAmount > effectiveBalance;
            const excessAmount = isExcess ? enteredAmount - effectiveBalance : 0;

            return (
              <div className="space-y-2">
                <div className="bg-muted/40 p-3 rounded-lg border text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Challan:</span>
                    <span className="font-semibold font-mono">{payingChallan.challanNumber} ({payingChallan.month})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Boarder:</span>
                    <span className="font-medium text-foreground">{studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Payable:</span>
                    <span>PKR {effectiveTotal.toLocaleString()}</span>
                  </div>
                  {(payingChallan.advanceApplied || 0) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Advance Deducted:</span>
                      <span>-PKR {Number(payingChallan.advanceApplied).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Paid:</span>
                    <span className="text-green-600 font-medium">PKR {(payingChallan.paidAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t font-semibold">
                    <span>Remaining Balance:</span>
                    <span className="text-orange-600">PKR {effectiveBalance.toLocaleString()}</span>
                  </div>
                  {effectiveLF > (payingChallan.lateFeeFine || 0) && (
                    <div className="text-[11px] text-amber-600 pt-0.5">Includes overdue late fee: PKR {effectiveLF.toLocaleString()}</div>
                  )}
                </div>

                {isExcess && (
                  <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Advance Payment Detected</div>
                      <div>
                        This challan will be marked fully paid. The excess <strong>PKR {excessAmount.toLocaleString()}</strong> will be recorded as Advance Credit in the boarder's ledger and automatically deducted from upcoming hostel challan(s).
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Amount Received (PKR) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={1}
                required
                placeholder="Enter amount received"
                value={payHostelAmount}
                onChange={(e) => setPayHostelAmount(e.target.value)}
                className="font-mono font-bold text-base mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Deposit To Account / Wallet <span className="text-destructive">*</span></Label>
              <Select value={payHostelWalletId} onValueChange={(val) => {
                setPayHostelWalletId(val);
                const chosen = activeWallets.find((w) => w.id === val);
                if (chosen?.type === 'BANK') setPayHostelPaymentMode('Bank Transfer');
                else if (chosen?.type === 'DIGITAL_WALLET') setPayHostelPaymentMode('Online');
                else setPayHostelPaymentMode('Cash');
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="-- Select Account / Wallet --" />
                </SelectTrigger>
                <SelectContent>
                  {activeWallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.type === 'DIGITAL_WALLET' ? (w.provider || 'Digital Wallet') : w.type})
                      {w.accountNumber ? ` · ${w.accountNumber}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Payment Mode</Label>
                <Select value={payHostelPaymentMode} onValueChange={setPayHostelPaymentMode}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Online">Online / Mobile</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Payment Date</Label>
                <Input
                  type="date"
                  value={payHostelDate}
                  onChange={(e) => setPayHostelDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Remarks / Notes</Label>
              <Input
                placeholder="e.g. Received by hostel warden"
                value={payHostelRemarks}
                onChange={(e) => setPayHostelRemarks(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setPayHostelChallanOpen(false)} disabled={payHostelLoading}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={payHostelLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={async () => {
                const amt = Number(payHostelAmount);
                if (!amt || amt <= 0) {
                  toast({ title: "Valid amount is required", variant: "destructive" });
                  return;
                }
                if (!payHostelWalletId) {
                  toast({ title: "Account / Wallet required", description: "Please select an account or wallet to deposit the payment into.", variant: "destructive" });
                  return;
                }
                setPayHostelLoading(true);
                try {
                  await recordHostelPayment(payingChallan.id, {
                    amount: amt,
                    paymentMode: payHostelPaymentMode,
                    paidDate: payHostelDate,
                    walletId: payHostelWalletId,
                    remarks: payHostelRemarks,
                  });
                  const effBal = payingChallan ? getChallanBalanceEffective(payingChallan, hostelLateFee) : 0;
                  const isExcessPayment = amt > effBal;
                  invalidateAllChallanQueries();
                  queryClient.invalidateQueries({ queryKey: ["wallets"] });
                  queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
                  queryClient.invalidateQueries({ queryKey: ["walletHostelLogs"] });
                  setPayHostelChallanOpen(false);
                  setPayingChallan(null);
                  toast({
                    title: "Payment Recorded",
                    description: isExcessPayment
                      ? `PKR ${amt.toLocaleString()} recorded. PKR ${(amt - effBal).toLocaleString()} added to advance credit ledger.`
                      : `PKR ${amt.toLocaleString()} recorded and credited to account.`
                  });
                } catch (e) {
                  toast({ title: e.message || "Failed to record payment", variant: "destructive" });
                } finally {
                  setPayHostelLoading(false);
                }
              }}
            >
              {payHostelLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
              {payHostelLoading ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details & Challan Preview Dialog */}
      <Dialog open={challanPreviewOpen} onOpenChange={setChallanPreviewOpen}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <DialogTitle className="text-lg">Challan Details & Preview</DialogTitle>
              </div>
              {viewingChallan && (() => {
                const isSettledChallan = viewingChallan.status === 'SETTLED' || (viewingChallan.supersededBy && (viewingChallan.supersededBy.status === 'PAID' || viewingChallan.supersededBy.paidAmount > 0));
                return (
                  <div className="flex items-center gap-2">
                    {isSettledChallan ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-medium">
                        SETTLED
                      </Badge>
                    ) : (
                      <Badge variant={viewingChallan.status === 'PAID' ? 'default' : (viewingChallan.status === 'VOID' || viewingChallan.status === 'SUPERSEDED') ? 'outline' : viewingChallan.status === 'PARTIAL' ? 'warning' : 'secondary'}>
                        {viewingChallan.status}
                      </Badge>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">#{viewingChallan.challanNumber}</span>
                  </div>
                );
              })()}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
            {viewingChallan && (() => {
              const reg = viewingChallanReg || viewingChallan.hostelRegistration;
              const student = reg?.student || viewingChallan.student;
              const boarderName = student
                ? `${student.fName || ''} ${student.lName || ''}`.trim()
                : (reg?.externalName || viewingChallan.hostelRegNumber || 'Boarder');
              const rollNo = student?.rollNumber || reg?.id || '';
              const roomName = reg?.room?.name || reg?.room?.roomNumber || reg?.roomNumber || '—';
              const effectiveLF = getEffectiveLateFee(viewingChallan, hostelLateFee);
              const total = getChallanTotalEffective(viewingChallan, hostelLateFee);
              const directPaid = Number(viewingChallan.paidAmount || 0);
              const settledArrears = Number(viewingChallan.settledViaArrearsAmount || 0);
              const isSettled = viewingChallan.status === 'SETTLED' || (viewingChallan.supersededBy && (viewingChallan.supersededBy.status === 'PAID' || viewingChallan.supersededBy.paidAmount > 0));
              const effectiveSettledArrears = settledArrears > 0 ? settledArrears : (isSettled ? Math.max(0, total - directPaid) : 0);
              const totalSettledOrPaid = directPaid + effectiveSettledArrears;
              const balance = isSettled ? 0 : Math.max(0, total - totalSettledOrPaid);
              const settledChallanNo = viewingChallan.settledByChallanNo || viewingChallan.supersededBy?.challanNumber || viewingChallan.supersededBy?.challanNo;
              const settledMonth = viewingChallan.settledByMonth || viewingChallan.supersededBy?.month;
              const payments = viewingChallan.payments || [];

              return (
                <>
                  {/* Top Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Boarder Info Card */}
                    <Card className="shadow-none border bg-muted/20">
                      <CardContent className="p-3 text-xs space-y-1.5">
                        <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 pb-1 border-b">
                          <Building className="w-3.5 h-3.5 text-primary" />
                          <span>Boarder Profile</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium text-foreground">{boarderName}</span>
                        </div>
                        {rollNo && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Roll / Reg #:</span>
                            <span className="font-mono">{rollNo}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Room:</span>
                          <span>{roomName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Billing Month:</span>
                          <span className="font-semibold">{viewingChallan.month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Due Date:</span>
                          <span>{viewingChallan.dueDate ? new Date(viewingChallan.dueDate).toLocaleDateString() : '—'}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Financial Summary Card */}
                    <Card className="shadow-none border bg-muted/20">
                      <CardContent className="p-3 text-xs space-y-1.5">
                        <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 pb-1 border-b">
                          <Receipt className="w-3.5 h-3.5 text-primary" />
                          <span>Financial Summary</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base Boarding Fee:</span>
                          <span>PKR {toHostelAmount(viewingChallan.hostelFee).toLocaleString()}</span>
                        </div>
                        {(viewingChallan.heads || []).map((h, i) => (
                          <div key={i} className="flex justify-between text-muted-foreground">
                            <span>+ {h.headName}:</span>
                            <span>PKR {Number(h.amount).toLocaleString()}</span>
                          </div>
                        ))}
                        {toHostelAmount(viewingChallan.arrearsAmount) > 0 && (
                          <div className="flex justify-between text-amber-600 font-semibold">
                            <span>+ Arrears:</span>
                            <span>PKR {toHostelAmount(viewingChallan.arrearsAmount).toLocaleString()}</span>
                          </div>
                        )}
                        {effectiveLF > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>+ Late Fee:</span>
                            <span>PKR {effectiveLF.toLocaleString()}</span>
                          </div>
                        )}
                        {toHostelAmount(viewingChallan.discount) > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>- Discount:</span>
                            <span>- PKR {toHostelAmount(viewingChallan.discount).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t font-bold text-foreground">
                          <span>Total Payable:</span>
                          <span>PKR {total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-green-600">
                          <span>Amount Paid / Settled:</span>
                          <span>PKR {totalSettledOrPaid.toLocaleString()}</span>
                        </div>
                        {effectiveSettledArrears > 0 && (
                          <div className="flex justify-between text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <span>Settled via Challan #{settledChallanNo || ''} {settledMonth ? `(${settledMonth})` : ''}:</span>
                            <span>PKR {effectiveSettledArrears.toLocaleString()}</span>
                          </div>
                        )}
                        <div className={`flex justify-between font-bold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          <span>Remaining Balance:</span>
                          <span>PKR {balance.toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payment History & Account Tracking Table */}
                  <div className="border rounded-md p-3 bg-muted/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                        Recorded Payments & Deposited Accounts
                      </span>
                      {totalSettledOrPaid > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                          PKR {totalSettledOrPaid.toLocaleString()} {isSettled ? 'Settled' : 'Received'}
                        </Badge>
                      )}
                    </div>

                    {effectiveSettledArrears > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2.5 text-xs text-emerald-800 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Settled via Arrears Clearance in Leading Challan</span>
                        </div>
                        <p className="text-[11px] text-emerald-700">
                          The balance of this challan (PKR {effectiveSettledArrears.toLocaleString()}) was carried forward as arrears into leading Challan #{settledChallanNo || ''} {settledMonth ? `(${settledMonth})` : ''} and has been cleared in full.
                        </p>
                      </div>
                    )}

                    {payments.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic py-1">
                        No payments have been recorded for this challan yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border rounded-md">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow className="h-8">
                              <TableHead className="text-[11px] py-1">Receipt #</TableHead>
                              <TableHead className="text-[11px] py-1">Date</TableHead>
                              <TableHead className="text-[11px] py-1 text-right">Amount Paid</TableHead>
                              <TableHead className="text-[11px] py-1">Deposited Account / Wallet</TableHead>
                              <TableHead className="text-[11px] py-1">Payment Method</TableHead>
                              <TableHead className="text-[11px] py-1">Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payments.map((p, idx) => (
                              <TableRow key={p._id || idx} className="h-8 text-xs">
                                <TableCell className="py-1 font-mono text-[11px] font-semibold text-primary">
                                  {p.receiptNo || (p.referenceNo ? `#${p.referenceNo}` : '—')}
                                </TableCell>
                                <TableCell className="py-1 text-muted-foreground">
                                  {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '—'}
                                </TableCell>
                                <TableCell className="py-1 text-right font-semibold font-mono text-emerald-600">
                                  PKR {Number(p.amount || 0).toLocaleString()}
                                </TableCell>
                                <TableCell className="py-1">
                                  {p.walletName ? (
                                    <div className="flex items-center gap-1 font-medium text-foreground">
                                      <Wallet className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span>{p.walletName}</span>
                                      {p.walletType && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                                          {p.walletType}
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {p.paymentMethod || p.paidBy || 'Cash'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-1 text-muted-foreground truncate max-w-[140px]">
                                  {p.remarks || '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Notice if template does not exist in Configuration */}
                  {!hasTemplateInConfig && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold">Challan template does not exist in Configuration</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          No default template of type <code>HOSTEL</code> was found in System Configuration. Using standard built-in format for preview and printing. You can configure and style a custom template under Configuration &gt; Templates.
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950 shrink-0"
                        onClick={() => window.open('/configuration', '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Configuration
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Printable Voucher Preview */}
            <div className="space-y-1 pt-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Printable Voucher Preview</div>
              <div
                className="border rounded-md overflow-hidden bg-white dark:bg-zinc-950"
                dangerouslySetInnerHTML={{ __html: challanPreviewHtml }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 pb-5 flex-shrink-0 border-t pt-3">
            <Button variant="outline" onClick={() => setChallanPreviewOpen(false)}>Close</Button>
            <Button
              onClick={async () => {
                const w = window.open('', '_blank');
                if (!w) {
                  toast({ title: "Pop-up blocked", variant: "destructive" });
                  return;
                }
                setHostelPreviewPrinting(true);
                try {
                  await openManagedPrintWindow({ html: challanPreviewHtml, title: `Challan #${viewingChallan?.challanNumber || ""}`, toast, printWindow: w });
                } finally {
                  setHostelPreviewPrinting(false);
                }
              }}
              disabled={hostelPreviewPrinting}
            >
              {hostelPreviewPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              {hostelPreviewPrinting ? "Preparing..." : "Print Challan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Hostel Challan Dialog */}
      <Dialog open={!!editingHostelChallan} onOpenChange={(open) => { if (!open) setEditingHostelChallan(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Boarding Challan</DialogTitle>
          </DialogHeader>
          {editingHostelChallan && (() => {
            const student = editingBoarderReg?.student || editingHostelChallan.student;
            const isInternal = editingBoarderReg?.registrationType === 'internal' || (editingBoarderReg && !editingBoarderReg.registrationType && !!editingBoarderReg.studentId) || !!editingHostelChallan.student;
            const boarderName = student
              ? `${student.fName || ''} ${student.lName || ''}`.trim()
              : (editingBoarderReg?.externalName || editingHostelChallan.hostelRegistration?.externalName || "Boarder");
            const rollNo = student?.rollNumber || "";
            const institute = editingBoarderReg?.externalInstitute || "";
            const roomName = editingBoarderReg?.room?.name || editingBoarderReg?.room?.roomNumber || "";
            const decidedFee = Number(editingBoarderReg?.decidedFeePerMonth || editingHostelChallan.hostelFee || 0);

            const validHeads = (editHostelChallanForm.heads || [])
              .filter((h) => h.headName && h.amount)
              .map((h) => ({ headName: h.headName, amount: Number(h.amount) || 0 }));
            const editHeadsTotal = validHeads.reduce((sum, h) => sum + h.amount, 0);

            const baseFee = Number(editHostelChallanForm.hostelFee !== "" ? editHostelChallanForm.hostelFee : (editingHostelChallan.hostelFee || 0));
            const arrears = Number(editHostelChallanForm.arrearsAmount || editingHostelChallan.arrearsAmount || 0);
            const discount = Number(editHostelChallanForm.discount || 0);
            const fine = Number(editingHostelChallan.fineAmount || 0);
            const newLateFee = editHostelChallanForm.dueDate ? calculateHostelLateFee(editHostelChallanForm.dueDate, hostelLateFee) : (editingHostelChallan.lateFeeFine || 0);

            const computedTotal = Math.max(0, baseFee + editHeadsTotal + arrears + fine + newLateFee - discount);
            const paid = Number(editingHostelChallan.paidAmount || 0);
            const balance = Math.max(0, computedTotal - paid);

            return (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-50 border text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{boarderName}</span>
                      <Badge variant={isInternal ? "secondary" : "outline"} className="text-[10px] h-4 py-0 px-1.5 font-normal">
                        {isInternal ? "Internal Boarder" : "External Boarder"}
                      </Badge>
                      {isEditingBoarderLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    </div>
                    <Badge variant={editingHostelChallan.status === 'PAID' ? 'default' : editingHostelChallan.status === 'PARTIAL' ? 'warning' : 'secondary'}>
                      {editingHostelChallan.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-muted-foreground pt-1 border-t border-slate-200">
                    <div>
                      <span className="font-medium text-foreground">{isInternal ? "Roll No: " : "Institute: "}</span>
                      <span>{isInternal ? (rollNo || "N/A") : (institute || "N/A")}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Room: </span>
                      <span>{roomName || "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Challan #: </span>
                      <span className="font-mono">{editingHostelChallan.challanNumber || editingHostelChallan.challanNo}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Month: </span>
                      <span>{editingHostelChallan.month}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Decided Fee: </span>
                      <span>PKR {decidedFee.toLocaleString()}/mo</span>
                    </div>
                    {!isInternal && editingBoarderReg?.externalGuardianName && (
                      <div>
                        <span className="font-medium text-foreground">Guardian: </span>
                        <span>{editingBoarderReg.externalGuardianName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-primary/5 space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base Boarding Fee:</span>
                    <span className="font-medium text-foreground">PKR {baseFee.toLocaleString()}</span>
                  </div>
                  {editHeadsTotal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Additional Heads:</span>
                      <span className="font-medium text-foreground">+ PKR {editHeadsTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {arrears > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Arrears (Previous Balance):</span>
                      <span>+ PKR {arrears.toLocaleString()}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Discount:</span>
                      <span>- PKR {discount.toLocaleString()}</span>
                    </div>
                  )}
                  {newLateFee > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Late Fee (Overdue):</span>
                      <span>+ PKR {newLateFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t pt-1 flex justify-between font-bold text-sm text-foreground">
                    <span>Total Amount:</span>
                    <span>PKR {computedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Paid Amount:</span>
                    <span className="text-green-600 font-medium">PKR {paid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs">
                    <span>Remaining Balance:</span>
                    <span className={balance > 0 ? "text-orange-600" : "text-green-600"}>PKR {balance.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Base Boarding Fee (PKR)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs mt-1"
                        value={editHostelChallanForm.hostelFee}
                        onChange={(e) => setEditHostelChallanForm((f) => ({ ...f, hostelFee: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Arrears Amount (PKR)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs mt-1"
                        value={editHostelChallanForm.arrearsAmount}
                        onChange={(e) => setEditHostelChallanForm((f) => ({ ...f, arrearsAmount: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Due Date</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs mt-1"
                        value={editHostelChallanForm.dueDate}
                        onChange={(e) => setEditHostelChallanForm((f) => ({ ...f, dueDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Discount (PKR)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        className="h-8 text-xs mt-1"
                        value={editHostelChallanForm.discount}
                        onChange={(e) => setEditHostelChallanForm((f) => ({ ...f, discount: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs font-semibold">Additional Heads</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setEditHostelChallanForm((f) => ({ ...f, heads: [...(f.heads || []), { headName: "", amount: "" }] }))}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Head
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {(editHostelChallanForm.heads || []).map((h, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            placeholder="Head Name"
                            className="h-8 text-xs flex-1"
                            value={h.headName}
                            onChange={(e) => {
                              const updated = [...editHostelChallanForm.heads];
                              updated[idx] = { ...updated[idx], headName: e.target.value };
                              setEditHostelChallanForm((f) => ({ ...f, heads: updated }));
                            }}
                          />
                          <Input
                            placeholder="Amount"
                            type="number"
                            className="h-8 text-xs w-28"
                            value={h.amount}
                            onChange={(e) => {
                              const updated = [...editHostelChallanForm.heads];
                              updated[idx] = { ...updated[idx], amount: e.target.value };
                              setEditHostelChallanForm((f) => ({ ...f, heads: updated }));
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive shrink-0"
                            onClick={() => setEditHostelChallanForm((f) => ({ ...f, heads: f.heads.filter((_, i) => i !== idx) }))}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Remarks</Label>
                    <Input
                      placeholder="Optional remarks"
                      className="h-8 text-xs mt-1"
                      value={editHostelChallanForm.remarks}
                      onChange={(e) => setEditHostelChallanForm((f) => ({ ...f, remarks: e.target.value }))}
                    />
                  </div>

                  {newLateFee > 0 && (
                    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                      Late fee fine calculated: PKR {newLateFee.toLocaleString()} ({hostelLateFee}/day overdue)
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button variant="outline" onClick={() => setEditingHostelChallan(null)}>Cancel</Button>
                  <Button
                    disabled={updateChallanMutation.isPending}
                    onClick={() => {
                      const challanId = editingHostelChallan.id || editingHostelChallan._id;
                      const validHeadsToSave = (editHostelChallanForm.heads || [])
                        .filter((h) => h.headName && h.amount)
                        .map((h) => ({ headName: h.headName, amount: Number(h.amount) }));
                      const payload = {
                        dueDate: editHostelChallanForm.dueDate || undefined,
                        discount: editHostelChallanForm.discount !== "" ? Number(editHostelChallanForm.discount) : undefined,
                        remarks: editHostelChallanForm.remarks || undefined,
                        hostelFee: editHostelChallanForm.hostelFee !== "" ? Number(editHostelChallanForm.hostelFee) : undefined,
                        arrearsAmount: editHostelChallanForm.arrearsAmount !== "" ? Number(editHostelChallanForm.arrearsAmount) : undefined,
                        ...(newLateFee > 0 ? { lateFeeFine: newLateFee } : {}),
                        heads: validHeadsToSave,
                      };

                      updateChallanMutation.mutate({
                        id: challanId,
                        data: payload,
                        dto: payload,
                      });
                    }}
                  >
                    {updateChallanMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Boarding Challan Confirmation */}
      <AlertDialog open={challanDeleteConfirmOpen} onOpenChange={setChallanDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Challan?</AlertDialogTitle>
            <AlertDialogDescription>
              {challanToDelete && (
                <>Challan <strong>{challanToDelete.challanNumber}</strong> ({challanToDelete.month}) will be permanently deleted. This cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setChallanDeleteConfirmOpen(false); setChallanToDelete(null); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (challanToDelete) deleteChallanMutation.mutate(challanToDelete.id);
                setChallanDeleteConfirmOpen(false);
                setChallanToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
