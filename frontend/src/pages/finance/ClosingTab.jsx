import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Clock,
  Eye,
  Trash2,
  Calendar,
  CheckCircle2,
  History,
  Lock,
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getFinanceClosingDashboard,
  getFinanceClosings,
  createFinanceClosing,
  deleteFinanceClosing,
} from "../../../config/apis";
import usePermissions from "@/hooks/usePermissions";

const formatDateTime = (dateValue) => {
  if (!dateValue) return "N/A";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (dateValue) => {
  if (!dateValue) return "N/A";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Detailed view of all inflows and outflows for a wallet
 * Shows exact origins (where did amount come from?) and destinations (where did amount go?)
 */
function WalletTransactionsDetailView({ inflows = [], outflows = [] }) {
  const [activeTab, setActiveTab] = useState("all");
  const totalInflows = inflows.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalOutflows = outflows.reduce((s, t) => s + Number(t.amount || 0), 0);

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-md text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({inflows.length + outflows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inflows")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === "inflows"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownRight className="w-3 h-3 text-emerald-600" />
            Inflows ({inflows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("outflows")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === "outflows"
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUpRight className="w-3 h-3 text-rose-600" />
            Outflows ({outflows.length})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-600 font-semibold">+ PKR {totalInflows.toLocaleString()}</span>
          <span className="text-rose-600 font-semibold">- PKR {totalOutflows.toLocaleString()}</span>
        </div>
      </div>

      {(activeTab === "all" || activeTab === "inflows") && (
        <div className="space-y-2">
          {activeTab === "all" && (
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
              Where Did Amount Come From? (Inflows Breakdown)
            </div>
          )}
          {inflows.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2.5 text-center border rounded-md bg-muted/10 italic">
              No inflow transactions recorded for this account during this period.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
              {inflows.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-md border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/10 gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase font-mono bg-emerald-100/60 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                      >
                        {tx.category || tx.transactionType || "INFLOW"}
                      </Badge>
                      <span className="font-semibold text-foreground">
                        {tx.from || "External Source"}
                      </span>
                    </div>
                    {(tx.description || tx.referenceNo) && (
                      <div className="text-muted-foreground text-[11px] flex items-center gap-2 flex-wrap">
                        {tx.description && <span>{tx.description}</span>}
                        {tx.referenceNo && (
                          <span className="font-mono bg-muted/60 px-1 py-0.2 rounded text-[10px]">
                            Ref: #{tx.referenceNo}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <span>{formatDateTime(tx.createdAt || tx.date)}</span>
                      {tx.performedByName && <span>• By: {tx.performedByName}</span>}
                    </div>
                  </div>
                  <div className="text-right sm:self-center shrink-0">
                    <span className="font-mono font-bold text-emerald-600 text-xs sm:text-sm">
                      + PKR {Number(tx.amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(activeTab === "all" || activeTab === "outflows") && (
        <div className="space-y-2 mt-3">
          {activeTab === "all" && (
            <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
              Where Did Amount Go? (Outflows Breakdown)
            </div>
          )}
          {outflows.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2.5 text-center border rounded-md bg-muted/10 italic">
              No outflow transactions recorded for this account during this period.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
              {outflows.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-md border border-rose-100 dark:border-rose-950/60 bg-rose-50/40 dark:bg-rose-950/10 gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase font-mono bg-rose-100/60 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300"
                      >
                        {tx.category || tx.transactionType || "OUTFLOW"}
                      </Badge>
                      <span className="font-semibold text-foreground">
                        {tx.to || "Expense / Destination"}
                      </span>
                    </div>
                    {(tx.description || tx.referenceNo || tx.staffCount > 0) && (
                      <div className="text-muted-foreground text-[11px] flex items-center gap-2 flex-wrap">
                        {tx.description && <span>{tx.description}</span>}
                        {tx.staffCount > 0 && <span>({tx.staffCount} Staff Members)</span>}
                        {tx.referenceNo && (
                          <span className="font-mono bg-muted/60 px-1 py-0.2 rounded text-[10px]">
                            Ref: #{tx.referenceNo}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <span>{formatDateTime(tx.createdAt || tx.date)}</span>
                      {tx.performedByName && <span>• By: {tx.performedByName}</span>}
                    </div>
                  </div>
                  <div className="text-right sm:self-center shrink-0">
                    <span className="font-mono font-bold text-rose-600 text-xs sm:text-sm">
                      - PKR {Number(tx.amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClosingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canClose } = usePermissions("Finance", "closing");

  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [closingRemarks, setClosingRemarks] = useState("");
  const [closingTargetDate, setClosingTargetDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [viewSnapshotData, setViewSnapshotData] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [selectedWalletDetail, setSelectedWalletDetail] = useState(null);
  const [closingDate, setClosingDate] = useState("");
  const [expandedModalWallets, setExpandedModalWallets] = useState({});
  const [expandedHistoryWallets, setExpandedHistoryWallets] = useState({});

  const toggleModalWalletExpand = (id) => {
    setExpandedModalWallets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleHistoryWalletExpand = (id) => {
    setExpandedHistoryWallets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Fetch holdings and changes (live or exact matched closing date)
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
  } = useQuery({
    queryKey: ["financeClosingDashboard", closingDate],
    queryFn: () =>
      getFinanceClosingDashboard({
        date: closingDate || undefined,
      }),
  });

  // Fetch historical closing records (filtered to exact closing date if selected)
  const {
    data: closingsHistory = [],
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ["financeClosings", closingDate],
    queryFn: () =>
      getFinanceClosings({
        date: closingDate || undefined,
      }),
  });

  // Fetch all historical closing records (unfiltered) to prevent duplicate closings for the same date
  const {
    data: allClosings = [],
  } = useQuery({
    queryKey: ["financeClosingsAll"],
    queryFn: () => getFinanceClosings(),
  });

  const closedDatesSet = new Set((allClosings || []).map((c) => c.date));
  const isTargetDateAlreadyClosed = closedDatesSet.has(closingTargetDate);
  const existingClosingForTargetDate = (allClosings || []).find((c) => c.date === closingTargetDate);
  const isTodayAlreadyClosed = closedDatesSet.has(new Date().toISOString().split("T")[0]);

  const isFiltered = Boolean(closingDate);
  const isExactCheckpoint = Boolean(dashboardData?.isExactCheckpoint);
  const lastClosing = dashboardData?.lastClosing || null;
  const summary = dashboardData?.summary || {
    totalCurrentHolding: 0,
    totalInflows: 0,
    totalOutflows: 0,
    totalNetChange: 0,
    totalLastClosingHolding: 0,
    activeWalletsCount: 0,
  };
  const wallets = dashboardData?.wallets || [];
  const categoryBreakdown = dashboardData?.categoryBreakdown || { inflows: [], outflows: [] };

  const addClosingMutation = useMutation({
    mutationFn: createFinanceClosing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosings"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingsAll"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      toast({
        title: "Closing Checkpoint Created",
        description: "Treasury holdings checkpoint recorded and baseline advanced.",
      });
      setClosingModalOpen(false);
      setClosingRemarks("");
      setExpandedModalWallets({});
    },
    onError: (error) => {
      toast({
        title: error.message || "Failed to record closing",
        variant: "destructive",
      });
    },
  });

  const deleteClosingMutation = useMutation({
    mutationFn: deleteFinanceClosing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosings"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosingsAll"] });
      toast({ title: "Closing checkpoint deleted" });
      setDeleteConfirm({ open: false, id: null });
    },
    onError: (error) => {
      toast({
        title: error.message || "Failed to delete closing checkpoint",
        variant: "destructive",
      });
    },
  });

  const handlePerformClosing = () => {
    if (closedDatesSet.has(closingTargetDate)) {
      toast({
        title: "Duplicate Closing Date",
        description: `A closing checkpoint for ${closingTargetDate} already exists. Closing cannot be performed for the same date twice.`,
        variant: "destructive",
      });
      return;
    }
    addClosingMutation.mutate({
      remarks: closingRemarks,
      date: closingTargetDate,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Treasury Holdings & Financial Closing
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor real-time wallet holdings, track net changes since the last closing checkpoint, and record formal closings.
          </p>
        </div>
        {canClose && (
          <div className="flex items-center gap-2">
            {isTodayAlreadyClosed && (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 border-emerald-300 py-1">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 inline" />
                Today Closed
              </Badge>
            )}
            <Button
              onClick={() => {
                setClosingTargetDate(new Date().toISOString().split("T")[0]);
                setClosingModalOpen(true);
              }}
              className="shadow-sm font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Perform Closing Checkpoint
            </Button>
          </div>
        )}
      </div>

      {/* Top Exact Closing Date Picker Bar */}
      <Card className="border shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Closing Date
                </Label>
                <Input
                  type="date"
                  className="h-8 text-xs w-[160px]"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                <Button
                  variant={!closingDate ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs px-2.5"
                  onClick={() => setClosingDate("")}
                >
                  Live / Latest Checkpoint
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-2.5"
                  onClick={() => {
                    const today = new Date().toISOString().split("T")[0];
                    setClosingDate(today);
                  }}
                >
                  Today
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-2.5"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setClosingDate(d.toISOString().split("T")[0]);
                  }}
                >
                  Yesterday
                </Button>

                {closingDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setClosingDate("")}
                    title="Reset date filter"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {closingDate ? (
                isExactCheckpoint ? (
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 py-1 px-2.5">
                    Checkpoint Matched: {closingDate}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 py-1 px-2.5">
                    Date Filtered: {closingDate}
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 py-1 px-2.5">
                  Live View (Since Latest Checkpoint)
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information Banner (Context-aware: Matched Closing Date vs Live Latest Checkpoint) */}
      {closingDate ? (
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-primary/10 rounded-full text-primary mt-0.5">
                  {isExactCheckpoint ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Calendar className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    {isExactCheckpoint ? "Closing Checkpoint Record" : "Financial Date Breakdown"}
                  </div>
                  <div className="mt-1">
                    <div className="text-base font-semibold text-foreground">
                      {formatDateOnly(closingDate)}
                      {lastClosing?.closingDateTime && isExactCheckpoint && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          at {new Date(lastClosing.closingDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {isExactCheckpoint ? (
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3">
                        <span>
                          Closed by: <strong className="text-foreground">{lastClosing.closedByName || "Admin"}</strong>
                        </span>
                        {lastClosing.remarks && (
                          <span>
                            Notes: <span className="italic text-foreground">"{lastClosing.remarks}"</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Showing recorded inflows, outflows, and wallet balances for this exact date.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 md:border-l pl-0 md:pl-4">
                <div>
                  <div className="text-xs text-muted-foreground">Opening Holdings</div>
                  <div className="text-base font-bold text-muted-foreground font-mono">
                    PKR {Number(summary.totalLastClosingHolding || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {isExactCheckpoint ? "Holdings At Closing" : "Ending Holdings on Date"}
                  </div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    PKR {Number(summary.totalCurrentHolding || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-primary/10 rounded-full text-primary mt-0.5">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    Last Closing Checkpoint
                  </div>
                  {lastClosing ? (
                    <div className="mt-1">
                      <div className="text-base font-semibold text-foreground">
                        {formatDateOnly(lastClosing.closingDateTime || lastClosing.date)}
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          at {new Date(lastClosing.closingDateTime || lastClosing.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3">
                        <span>
                          Closed by: <strong className="text-foreground">{lastClosing.closedByName || "Admin"}</strong>
                        </span>
                        {lastClosing.remarks && (
                          <span>
                            Notes: <span className="italic text-foreground">"{lastClosing.remarks}"</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="text-sm font-medium text-foreground">
                        No previous closing recorded yet
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Baseline is established from initial account balances. Showing cumulative financial changes up to now.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {lastClosing && (
                <div className="flex items-center gap-3 md:border-l pl-0 md:pl-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Holdings At Last Closing</div>
                    <div className="text-lg font-bold text-foreground">
                      PKR {Number(lastClosing.totalHolding || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings & Changes Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {closingDate ? "Holdings on Date" : "Treasury Holdings"}
            </CardTitle>
            <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xs sm:text-lg lg:text-2xl font-bold text-foreground truncate">
              PKR {Number(summary.totalCurrentHolding).toLocaleString()}
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 truncate">
              {closingDate ? "Total holdings at closing of selected date" : `Live aggregate across ${summary.activeWalletsCount} active accounts`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {closingDate ? "Inflows on Date" : "Inflows Since Closing"}
            </CardTitle>
            <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xs sm:text-lg lg:text-2xl font-bold text-emerald-600 truncate">
              + PKR {Number(summary.totalInflows).toLocaleString()}
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 truncate">
              {closingDate ? "Tuition, hostel fees, deposits & income on date" : "Tuition, hostel fees, deposits & income"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {closingDate ? "Outflows on Date" : "Outflows Since Closing"}
            </CardTitle>
            <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xs sm:text-lg lg:text-2xl font-bold text-rose-600 truncate">
              - PKR {Number(summary.totalOutflows).toLocaleString()}
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 truncate">
              {closingDate ? "Expenses, payrolls & inventory on date" : "Expenses, payrolls & inventory"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {closingDate ? "Net Change on Date" : "Net Treasury Change"}
            </CardTitle>
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0 sm:pt-0">
            <div
              className={`text-xs sm:text-lg lg:text-2xl font-bold truncate ${
                summary.totalNetChange >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {summary.totalNetChange >= 0 ? "+" : "-"} PKR{" "}
              {Math.abs(summary.totalNetChange).toLocaleString()}
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 truncate">
              {closingDate ? "Net cashflow on selected date" : "Net treasury change after last closing"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown (Inflows vs Outflows) */}
      {(categoryBreakdown.inflows.length > 0 || categoryBreakdown.outflows.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="p-3.5 sm:p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-emerald-700">
                <span className="flex items-center gap-1.5">
                  <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                  Inflows Breakdown {closingDate ? "(Selected Date)" : "(Since Last Closing)"}
                </span>
                <span className="font-mono text-xs font-bold">
                  + PKR {Number(summary.totalInflows).toLocaleString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-4 pt-1">
              <div className="space-y-1.5">
                {categoryBreakdown.inflows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">No inflows recorded for this date</p>
                ) : (
                  categoryBreakdown.inflows.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b last:border-0">
                      <span className="text-muted-foreground font-medium">{item.category}</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        + PKR {Number(item.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3.5 sm:p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-rose-700">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  Outflows Breakdown {closingDate ? "(Selected Date)" : "(Since Last Closing)"}
                </span>
                <span className="font-mono text-xs font-bold">
                  - PKR {Number(summary.totalOutflows).toLocaleString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-4 pt-1">
              <div className="space-y-1.5">
                {categoryBreakdown.outflows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">No outflows recorded for this date</p>
                ) : (
                  categoryBreakdown.outflows.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b last:border-0">
                      <span className="text-muted-foreground font-medium">{item.category}</span>
                      <span className="font-mono font-semibold text-rose-600">
                        - PKR {Number(item.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Accounts & Wallets Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">
                {closingDate ? "Accounts & Wallets Breakdown" : "Accounts & Wallets Live Holdings"}
              </CardTitle>
              <CardDescription>
                {closingDate
                  ? "Detailed balance progression and inflows/outflows for each treasury account on the selected date."
                  : "Detailed breakdown of each treasury account and its activities since the last closing date."}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {closingDate ? (isExactCheckpoint ? "Checkpoint Snapshot" : "Date Snapshot") : "Live Holdings Snapshot"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm">Account / Wallet</TableHead>
                  <TableHead className="hidden md:table-cell py-2.5 px-3 text-sm">Type / Details</TableHead>
                  <TableHead className="hidden lg:table-cell py-2.5 px-3 text-sm text-right">
                    {closingDate ? "Opening Balance" : "Balance at Last Closing"}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm text-right text-emerald-600">
                    {closingDate ? "Inflows (+)" : "Inflows (+)"}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm text-right text-rose-600">
                    {closingDate ? "Outflows (-)" : "Outflows (-)"}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell py-2.5 px-3 text-sm text-right">
                    Net Change
                  </TableHead>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm text-right font-bold">
                    {closingDate ? "Ending Balance" : "Current Live Balance"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isDashboardLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading treasury holdings data...
                    </TableCell>
                  </TableRow>
                ) : wallets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No active accounts or wallets found in Configuration.
                    </TableCell>
                  </TableRow>
                ) : (
                  wallets.map((w) => (
                    <TableRow
                      key={w.walletId}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedWalletDetail(w)}
                    >
                      <TableCell className="py-2.5 px-3 text-xs sm:text-sm font-medium">
                        <div className="font-semibold text-foreground">{w.walletName}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground sm:hidden mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase font-mono">
                            {w.walletType}
                          </Badge>
                          <span>
                            {w.accountNumber ? `#${w.accountNumber}` : w.bankName || w.provider || w.location || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2.5 px-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {w.walletType}
                          </Badge>
                          <span>
                            {w.accountNumber ? `#${w.accountNumber}` : w.bankName || w.provider || w.location || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-2.5 px-3 text-sm text-right text-muted-foreground font-mono">
                        PKR {Number(w.balanceAtLastClosing || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2.5 px-3 text-sm text-right text-emerald-600 font-semibold font-mono">
                        {w.inflowsSinceLastClosing > 0
                          ? `+ PKR ${Number(w.inflowsSinceLastClosing).toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2.5 px-3 text-sm text-right text-rose-600 font-semibold font-mono">
                        {w.outflowsSinceLastClosing > 0
                          ? `- PKR ${Number(w.outflowsSinceLastClosing).toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell
                        className={`hidden lg:table-cell py-2.5 px-3 text-sm text-right font-medium font-mono ${
                          w.netChange > 0
                            ? "text-emerald-600"
                            : w.netChange < 0
                            ? "text-rose-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {w.netChange > 0 ? "+" : w.netChange < 0 ? "-" : ""}
                        PKR {Math.abs(w.netChange || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-xs sm:text-sm text-right font-bold text-foreground font-mono bg-muted/20">
                        PKR {Number(w.currentBalance || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Historical Closings Checkpoints */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Closing Checkpoints History
              </CardTitle>
              <CardDescription>
                Permanent records of all historical closings and snapshot reconciliations.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isFiltered && (
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  Filtered
                </Badge>
              )}
              <Badge variant="secondary">
                {closingsHistory.length} Checkpoints
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm">Closing Date & Time</TableHead>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm text-right">Total Holding</TableHead>
                  <TableHead className="hidden md:table-cell py-2.5 px-3 text-sm text-emerald-600">Inflows</TableHead>
                  <TableHead className="hidden md:table-cell py-2.5 px-3 text-sm text-rose-600">Outflows</TableHead>
                  <TableHead className="hidden lg:table-cell py-2.5 px-3 text-sm">Net Change</TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm">Closed By</TableHead>
                  <TableHead className="hidden xl:table-cell py-2.5 px-3 text-sm">Remarks</TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHistoryLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-10 text-muted-foreground"
                    >
                      Loading closing history...
                    </TableCell>
                  </TableRow>
                ) : closingsHistory.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-10 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-6 h-6 text-muted-foreground/60" />
                        <span>
                          {closingDate
                            ? `No historical closings recorded on ${closingDate}.`
                            : "No historical closings recorded yet."}
                        </span>
                        {closingDate && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs mt-1"
                            onClick={() => setClosingDate("")}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Show All Checkpoints
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  closingsHistory.map((item) => (
                    <TableRow
                      key={item.id || item._id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setViewSnapshotData(item)}
                    >
                      <TableCell className="py-2.5 px-3 text-xs sm:text-sm font-medium">
                        <div className="font-semibold text-foreground">
                          {formatDateTime(item.closingDateTime || item.createdAt || item.date)}
                        </div>
                        <div className="text-[11px] text-muted-foreground sm:hidden mt-0.5">
                          By: {item.closedByName || item.closedBy?.name || "Admin"}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-xs sm:text-sm font-bold text-foreground font-mono text-right">
                        PKR {Number(item.totalHolding || item.netBalance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2.5 px-3 text-sm text-emerald-600 font-mono">
                        + PKR {Number(item.totalInflows || item.totalIncome || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2.5 px-3 text-sm text-rose-600 font-mono">
                        - PKR {Number(item.totalOutflows || item.totalExpense || 0).toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`hidden lg:table-cell py-2.5 px-3 text-sm font-medium font-mono ${
                          (item.netChange || item.netBalance || 0) >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        PKR {Number(item.netChange || item.netBalance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2.5 px-3 text-xs text-muted-foreground">
                        {item.closedByName || item.closedBy?.name || "Admin"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell py-2.5 px-3 text-xs text-muted-foreground max-w-[200px] truncate">
                        {item.remarks || "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2.5 px-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.walletsSnapshot && item.walletsSnapshot.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewSnapshotData(item);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  View
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View wallet holdings at closing</TooltipContent>
                            </Tooltip>
                          )}
                          {canClose && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirm({
                                      open: true,
                                      id: item.id || item._id,
                                    });
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete record</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Perform Closing Modal */}
      <Dialog open={closingModalOpen} onOpenChange={setClosingModalOpen}>
        <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Perform Financial Closing Checkpoint
            </DialogTitle>
            <DialogDescription>
              Snapshot current treasury account balances as the official closing baseline. Any subsequent transactions will count toward the next closing period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Closing Date Selection & Duplicate Check */}
            <div className="p-3 bg-muted/40 border rounded-lg space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Closing Checkpoint Date
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Specify the date of closing. A date can only be closed once.
                  </p>
                </div>
                <Input
                  type="date"
                  className="h-8.5 text-xs w-[170px]"
                  value={closingTargetDate}
                  onChange={(e) => setClosingTargetDate(e.target.value)}
                />
              </div>

              {isTargetDateAlreadyClosed && (
                <div className="flex items-start gap-2.5 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Checkpoint already recorded for {closingTargetDate}:</span>
                    <p className="mt-0.5 text-destructive/90">
                      A financial closing checkpoint for {closingTargetDate} has already been recorded{" "}
                      {existingClosingForTargetDate
                        ? `on ${formatDateTime(existingClosingForTargetDate.closingDateTime || existingClosingForTargetDate.createdAt)} by ${existingClosingForTargetDate.closedByName || "Admin"}`
                        : ""}
                      . Performing closing for the same date twice is not allowed.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* High-level Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-muted/40 rounded-lg border">
                <span className="text-[11px] text-muted-foreground block">Active Accounts</span>
                <span className="font-bold text-sm text-foreground">
                  {summary.activeWalletsCount} Accounts
                </span>
              </div>
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-950/40">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">Period Inflows (+)</span>
                <span className="font-bold font-mono text-sm text-emerald-600">
                  + PKR {Number(summary.totalInflows).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-950/40">
                <span className="text-[11px] text-rose-700 dark:text-rose-400 block font-medium">Period Outflows (-)</span>
                <span className="font-bold font-mono text-sm text-rose-600">
                  - PKR {Number(summary.totalOutflows).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <span className="text-[11px] text-primary block font-medium">Total Live Holdings</span>
                <span className="font-bold font-mono text-sm text-primary">
                  PKR {Number(summary.totalCurrentHolding).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Wallets & Accounts Breakdown with Inflows/Outflows detail */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Accounts Breakdown & Transaction Details ({wallets.length})
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Inspect where money came from and where it went for each account before recording closing.
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {wallets.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border rounded-md">
                    No active accounts or wallets found.
                  </div>
                ) : (
                  wallets.map((w) => {
                    const key = w.walletId;
                    const isExpanded = expandedModalWallets[key];
                    const txCount = (w.inflows?.length || 0) + (w.outflows?.length || 0);

                    return (
                      <div key={key} className="border rounded-lg overflow-hidden bg-card transition-all">
                        <div
                          className="p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          onClick={() => toggleModalWalletExpand(key)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-md bg-background border text-primary">
                              <Landmark className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                                {w.walletName}
                                <Badge variant="outline" className="text-[9px] uppercase font-mono">
                                  {w.walletType}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {w.accountNumber ? `#${w.accountNumber}` : w.bankName || w.provider || w.location || "General Treasury"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                            <div className="flex items-center gap-2 sm:gap-3 text-right">
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Inflows</span>
                                <span className="font-mono font-semibold text-emerald-600 text-[11px] sm:text-xs">
                                  +{Number(w.inflowsSinceLastClosing || 0).toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Outflows</span>
                                <span className="font-mono font-semibold text-rose-600 text-[11px] sm:text-xs">
                                  -{Number(w.outflowsSinceLastClosing || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="border-l pl-2 sm:pl-3">
                                <span className="text-[10px] text-muted-foreground block">Live Balance</span>
                                <span className="font-mono font-bold text-foreground text-xs sm:text-sm">
                                  PKR {Number(w.currentBalance || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs flex items-center gap-1 text-primary hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleModalWalletExpand(key);
                              }}
                            >
                              <span className="text-[11px]">{txCount} Txns</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 border-t bg-background">
                            <WalletTransactionsDetailView
                              inflows={w.inflows || []}
                              outflows={w.outflows || []}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <Label>Closing Remarks / Reconciliation Notes</Label>
              <Textarea
                value={closingRemarks}
                onChange={(e) => setClosingRemarks(e.target.value)}
                placeholder="e.g. End of month reconciliation, cash in safe counted and verified..."
                rows={2}
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClosingModalOpen(false)}
              disabled={addClosingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePerformClosing}
              disabled={isTargetDateAlreadyClosed || addClosingMutation.isPending || !closingTargetDate}
            >
              {addClosingMutation.isPending
                ? "Recording Checkpoint..."
                : isTargetDateAlreadyClosed
                ? "Date Already Closed"
                : "Confirm & Record Closing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Historical Snapshot Breakdown Modal */}
      {viewSnapshotData && (
        <Dialog
          open={!!viewSnapshotData}
          onOpenChange={(open) => !open && setViewSnapshotData(null)}
        >
          <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Closing Snapshot Breakdown
              </DialogTitle>
              <DialogDescription>
                Recorded for {formatDateOnly(viewSnapshotData.date)} at{" "}
                {formatDateTime(viewSnapshotData.closingDateTime || viewSnapshotData.createdAt || viewSnapshotData.date)}{" "}
                by {viewSnapshotData.closedByName || "Admin"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {viewSnapshotData.remarks && (
                <div className="text-xs bg-muted/60 p-2.5 rounded italic">
                  <strong>Notes:</strong> {viewSnapshotData.remarks}
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-muted/40 rounded-lg border">
                  <span className="text-[11px] text-muted-foreground block">Accounts Snapshot</span>
                  <span className="font-bold text-sm text-foreground">
                    {viewSnapshotData.walletsSnapshot?.length || 0} Accounts
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-950/40">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">Inflows (+)</span>
                  <span className="font-bold font-mono text-sm text-emerald-600">
                    + PKR {Number(viewSnapshotData.totalInflows || viewSnapshotData.totalIncome || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-950/40">
                  <span className="text-[11px] text-rose-700 dark:text-rose-400 block font-medium">Outflows (-)</span>
                  <span className="font-bold font-mono text-sm text-rose-600">
                    - PKR {Number(viewSnapshotData.totalOutflows || viewSnapshotData.totalExpense || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="text-[11px] text-primary block font-medium">Total Holdings At Closing</span>
                  <span className="font-bold font-mono text-sm text-primary">
                    PKR {Number(viewSnapshotData.totalHolding || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Wallets & Accounts Breakdown with Inflows/Outflows detail */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Accounts & Wallets Snapshot Details ({viewSnapshotData.walletsSnapshot?.length || 0})
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Click any account to see all transaction origins and destinations recorded for this closing period.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {(viewSnapshotData.walletsSnapshot || []).map((w, idx) => {
                    const key = w.walletId || idx;
                    const isExpanded = expandedHistoryWallets[key];
                    const txCount = (w.inflows?.length || 0) + (w.outflows?.length || 0);

                    return (
                      <div key={key} className="border rounded-lg overflow-hidden bg-card transition-all">
                        <div
                          className="p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          onClick={() => toggleHistoryWalletExpand(key)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-md bg-background border text-primary">
                              <Landmark className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                                {w.walletName}
                                <Badge variant="outline" className="text-[9px] uppercase font-mono">
                                  {w.walletType}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {w.accountNumber ? `#${w.accountNumber}` : w.bankName || "Treasury Account"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                            <div className="flex items-center gap-2 sm:gap-3 text-right">
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Inflows</span>
                                <span className="font-mono font-semibold text-emerald-600 text-[11px] sm:text-xs">
                                  +{Number(w.inflowsSinceLastClosing || 0).toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Outflows</span>
                                <span className="font-mono font-semibold text-rose-600 text-[11px] sm:text-xs">
                                  -{Number(w.outflowsSinceLastClosing || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="border-l pl-2 sm:pl-3">
                                <span className="text-[10px] text-muted-foreground block">Closing Balance</span>
                                <span className="font-mono font-bold text-foreground text-xs sm:text-sm">
                                  PKR {Number(w.balanceAtClosing || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs flex items-center gap-1 text-primary hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHistoryWalletExpand(key);
                              }}
                            >
                              <span className="text-[11px]">{txCount} Txns</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 border-t bg-background">
                            <WalletTransactionsDetailView
                              inflows={w.inflows || []}
                              outflows={w.outflows || []}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewSnapshotData(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Live Account Details Dialog */}
      <Dialog open={!!selectedWalletDetail} onOpenChange={(open) => !open && setSelectedWalletDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Landmark className="w-4 h-4 text-primary" />
              Account Holdings & Transaction Activity
            </DialogTitle>
          </DialogHeader>
          {selectedWalletDetail && (
            <div className="space-y-3 text-xs sm:text-sm pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg border">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Account Name:</span>
                  <span className="font-semibold text-foreground">{selectedWalletDetail.walletName}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Account Type:</span>
                  <Badge variant="outline" className="uppercase font-mono text-[10px]">
                    {selectedWalletDetail.walletType}
                  </Badge>
                </div>
                {selectedWalletDetail.accountNumber && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Account Number:</span>
                    <span className="font-mono">#{selectedWalletDetail.accountNumber}</span>
                  </div>
                )}
                {(selectedWalletDetail.bankName || selectedWalletDetail.provider || selectedWalletDetail.location) && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Provider / Details:</span>
                    <span>{selectedWalletDetail.bankName || selectedWalletDetail.provider || selectedWalletDetail.location}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">{closingDate ? "Opening Balance:" : "Balance at Last Closing:"}</span>
                  <span className="font-mono">PKR {Number(selectedWalletDetail.balanceAtLastClosing || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">{closingDate ? "Ending Balance on Date:" : "Current Live Balance:"}</span>
                  <span className="font-bold text-primary font-mono">
                    PKR {Number(selectedWalletDetail.currentBalance || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Transactions details */}
              <div className="border-t pt-2">
                <Label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
                  Transaction Activity: Inflow Sources & Outflow Destinations
                </Label>
                <WalletTransactionsDetailView
                  inflows={selectedWalletDetail.inflows || []}
                  outflows={selectedWalletDetail.outflows || []}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedWalletDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Closing Checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this historical closing checkpoint from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteClosingMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
