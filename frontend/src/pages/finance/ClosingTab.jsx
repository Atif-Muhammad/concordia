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

export default function ClosingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canClose } = usePermissions("Finance", "closing");

  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [closingRemarks, setClosingRemarks] = useState("");
  const [viewSnapshotData, setViewSnapshotData] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [selectedWalletDetail, setSelectedWalletDetail] = useState(null);
  const [closingDateFrom, setClosingDateFrom] = useState("");
  const [closingDateTo, setClosingDateTo] = useState("");

  // Fetch live holdings and changes since last closing
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
  } = useQuery({
    queryKey: ["financeClosingDashboard"],
    queryFn: getFinanceClosingDashboard,
  });

  // Fetch historical closing records
  const {
    data: closingsHistory = [],
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ["financeClosings", closingDateFrom, closingDateTo],
    queryFn: () =>
      getFinanceClosings({
        dateFrom: closingDateFrom || undefined,
        dateTo: closingDateTo || undefined,
      }),
  });

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

  const addClosingMutation = useMutation({
    mutationFn: createFinanceClosing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeClosingDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeClosings"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      toast({
        title: "Closing Checkpoint Created",
        description: "Treasury holdings checkpoint recorded and baseline advanced.",
      });
      setClosingModalOpen(false);
      setClosingRemarks("");
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
    addClosingMutation.mutate({
      remarks: closingRemarks,
      date: new Date().toISOString().split("T")[0],
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
          <Button
            onClick={() => setClosingModalOpen(true)}
            className="shadow-sm font-medium flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Perform Closing Checkpoint
          </Button>
        )}
      </div>

      {/* Last Closing Information Banner */}
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

      {/* Holdings & Changes Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              Treasury Holdings
            </CardTitle>
            <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xs sm:text-lg lg:text-2xl font-bold text-foreground truncate">
              PKR {Number(summary.totalCurrentHolding).toLocaleString()}
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 truncate">
              Live aggregate across {summary.activeWalletsCount} active accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              Inflows Since Closing
            </CardTitle>
            <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xs sm:text-lg lg:text-2xl font-bold text-emerald-600 truncate">
              + PKR {Number(summary.totalInflows).toLocaleString()}
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 truncate">
              Tuition, hostel fees, deposits & income
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              Outflows Since Closing
            </CardTitle>
            <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xs sm:text-lg lg:text-2xl font-bold text-rose-600 truncate">
              - PKR {Number(summary.totalOutflows).toLocaleString()}
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 truncate">
              Expenses, payrolls & inventory
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              Net Treasury Change
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
              Net treasury change after last closing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Live Accounts & Holdings Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Accounts & Wallets Live Holdings</CardTitle>
              <CardDescription>
                Detailed breakdown of each treasury account and its activities since the last closing date.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Live Holdings Snapshot
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
                    Balance at Last Closing
                  </TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm text-right text-emerald-600">
                    Inflows (+)
                  </TableHead>
                  <TableHead className="hidden sm:table-cell py-2.5 px-3 text-sm text-right text-rose-600">
                    Outflows (-)
                  </TableHead>
                  <TableHead className="hidden lg:table-cell py-2.5 px-3 text-sm text-right">
                    Net Change
                  </TableHead>
                  <TableHead className="py-2.5 px-3 text-xs sm:text-sm text-right font-bold">
                    Current Live Balance
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
              {(closingDateFrom || closingDateTo) && (
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  Filtered
                </Badge>
              )}
              <Badge variant="secondary">
                {closingsHistory.length} Checkpoints
              </Badge>
            </div>
          </div>

          {/* Date Filter Bar */}
          <div className="flex flex-wrap items-end gap-2.5 pt-3 border-t mt-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                From Date
              </Label>
              <Input
                type="date"
                className="h-8 text-xs w-[145px]"
                value={closingDateFrom}
                onChange={(e) => setClosingDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                To Date
              </Label>
              <Input
                type="date"
                className="h-8 text-xs w-[145px]"
                value={closingDateTo}
                onChange={(e) => setClosingDateTo(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={() => {
                  const now = new Date();
                  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
                  const today = now.toISOString().split("T")[0];
                  setClosingDateFrom(firstDay);
                  setClosingDateTo(today);
                }}
              >
                This Month
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={() => {
                  const now = new Date();
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setClosingDateFrom(d.toISOString().split("T")[0]);
                  setClosingDateTo(now.toISOString().split("T")[0]);
                }}
              >
                Last 30 Days
              </Button>

              {(closingDateFrom || closingDateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setClosingDateFrom("");
                    setClosingDateTo("");
                  }}
                  title="Clear date filters"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              )}
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
                          {closingDateFrom || closingDateTo
                            ? "No historical closings found matching the selected date range."
                            : "No historical closings recorded yet."}
                        </span>
                        {(closingDateFrom || closingDateTo) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs mt-1"
                            onClick={() => {
                              setClosingDateFrom("");
                              setClosingDateTo("");
                            }}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset Filters
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Perform Financial Closing Checkpoint
            </DialogTitle>
            <DialogDescription>
              This action will snapshot all current treasury account balances as the official closing baseline. Any subsequent income and expense records will be counted toward the next closing period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Closing Timestamp:</span>
                <span className="font-semibold text-foreground">
                  {formatDateTime(new Date())}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Accounts Count:</span>
                <span className="font-semibold text-foreground">
                  {summary.activeWalletsCount} Accounts
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-muted-foreground">Inflows Since Last Closing:</span>
                <span className="font-bold text-emerald-600 font-mono">
                  + PKR {Number(summary.totalInflows).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outflows Since Last Closing:</span>
                <span className="font-bold text-rose-600 font-mono">
                  - PKR {Number(summary.totalOutflows).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Period Change:</span>
                <span
                  className={`font-bold font-mono ${
                    summary.totalNetChange >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {summary.totalNetChange >= 0 ? "+" : "-"} PKR{" "}
                  {Math.abs(summary.totalNetChange).toLocaleString()}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-bold text-foreground">Total Live Holdings:</span>
                <span className="font-bold text-lg text-primary font-mono">
                  PKR {Number(summary.totalCurrentHolding).toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <Label>Closing Remarks / Reconciliation Notes</Label>
              <Textarea
                value={closingRemarks}
                onChange={(e) => setClosingRemarks(e.target.value)}
                placeholder="e.g. End of month reconciliation, cash in safe counted and verified..."
                rows={3}
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
              disabled={addClosingMutation.isPending}
            >
              {addClosingMutation.isPending ? "Recording Checkpoint..." : "Confirm & Record Closing"}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Closing Snapshot Breakdown
              </DialogTitle>
              <DialogDescription>
                Recorded on {formatDateTime(viewSnapshotData.closingDateTime || viewSnapshotData.createdAt || viewSnapshotData.date)} by{" "}
                {viewSnapshotData.closedByName || "Admin"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {viewSnapshotData.remarks && (
                <div className="text-xs bg-muted/60 p-2.5 rounded italic">
                  <strong>Notes:</strong> {viewSnapshotData.remarks}
                </div>
              )}

              <div className="overflow-x-auto max-h-[350px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs py-2 px-3">Account</TableHead>
                      <TableHead className="text-xs py-2 px-3">Type</TableHead>
                      <TableHead className="text-xs py-2 px-3 text-right">Inflows (+)</TableHead>
                      <TableHead className="text-xs py-2 px-3 text-right">Outflows (-)</TableHead>
                      <TableHead className="text-xs py-2 px-3 text-right">Balance At Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewSnapshotData.walletsSnapshot || []).map((w, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs py-2 px-3 font-medium">
                          {w.walletName}
                        </TableCell>
                        <TableCell className="text-xs py-2 px-3 text-muted-foreground uppercase">
                          {w.walletType}
                        </TableCell>
                        <TableCell className="text-xs py-2 px-3 text-right text-emerald-600 font-mono">
                          PKR {Number(w.inflowsSinceLastClosing || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs py-2 px-3 text-right text-rose-600 font-mono">
                          PKR {Number(w.outflowsSinceLastClosing || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs py-2 px-3 text-right font-bold text-foreground font-mono">
                          PKR {Number(w.balanceAtClosing || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center text-sm font-bold pt-2 border-t">
                <span>Total Snapshot Holdings:</span>
                <span className="text-primary font-mono text-base">
                  PKR {Number(viewSnapshotData.totalHolding || 0).toLocaleString()}
                </span>
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
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Account Holdings Details</DialogTitle>
          </DialogHeader>
          {selectedWalletDetail && (
            <div className="space-y-3 text-xs sm:text-sm pt-2">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Account Name:</span>
                <span className="font-semibold text-foreground">{selectedWalletDetail.walletName}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Account Type:</span>
                <Badge variant="outline" className="uppercase font-mono text-[10px]">
                  {selectedWalletDetail.walletType}
                </Badge>
              </div>
              {selectedWalletDetail.accountNumber && (
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Account Number:</span>
                  <span className="font-mono">#{selectedWalletDetail.accountNumber}</span>
                </div>
              )}
              {(selectedWalletDetail.bankName || selectedWalletDetail.provider || selectedWalletDetail.location) && (
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Provider / Details:</span>
                  <span>{selectedWalletDetail.bankName || selectedWalletDetail.provider || selectedWalletDetail.location}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Balance at Last Closing:</span>
                <span className="font-mono">PKR {Number(selectedWalletDetail.balanceAtLastClosing || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Inflows Since Closing:</span>
                <span className="font-bold text-emerald-600 font-mono">
                  + PKR {Number(selectedWalletDetail.inflowsSinceLastClosing || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Outflows Since Closing:</span>
                <span className="font-bold text-rose-600 font-mono">
                  - PKR {Number(selectedWalletDetail.outflowsSinceLastClosing || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Net Change:</span>
                <span className={`font-bold font-mono ${(selectedWalletDetail.netChange || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {(selectedWalletDetail.netChange || 0) >= 0 ? "+" : "-"} PKR {Math.abs(selectedWalletDetail.netChange || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 bg-muted/40 px-3 rounded-md border mt-2">
                <span className="font-semibold">Current Live Balance:</span>
                <span className="font-bold text-base text-primary font-mono">
                  PKR {Number(selectedWalletDetail.currentBalance || 0).toLocaleString()}
                </span>
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
