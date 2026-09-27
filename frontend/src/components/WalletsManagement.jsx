import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  Landmark,
  Smartphone,
  Banknote,
  ArrowRightLeft,
  ArrowDownToLine,
  Plus,
  Search,
  History,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  RefreshCw,
  CreditCard,
  Building,
  ShieldCheck,
  Layers,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Receipt,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import {
  getWallets,
  createWallet,
  updateWallet,
  deleteWallet,
  depositWalletFunds,
  transferWalletFunds,
  getWalletHistory,
  getPayrollDeductionLogs,
  getHostelFeeLogs,
  getTuitionFeeLogs,
  getWalletExpenseLogs,
} from "../../config/apis";
import { cn } from "@/lib/utils";
import usePermissions from "@/hooks/usePermissions";

// Source Categories for Direct Deposit (from Image 1)
const SOURCE_CATEGORIES = [
  "Owner / Partner Capital Injection",
  "Director / Partner Loan / Cash Advance",
  "Bank Loan / External Financing",
  "Other Income / Direct Receipts",
  "Customer Direct Advance / Unbilled Deposit",
  "Retained Earnings / Prior Adjustment",
  "Other Custom Capital Source",
];

const DIGITAL_PROVIDERS = [
  "Easypaisa",
  "JazzCash",
  "SadaPay",
  "NayaPay",
  "UPaisa",
  "Other",
];

export default function WalletsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Configuration", "wallets");

  // Active sub-tab inside Wallets: 'accounts' | 'history'
  const [activeTab, setActiveTab] = useState("accounts");
  const [walletTypeFilter, setWalletTypeFilter] = useState("ALL");

  // History filters
  const [historyWalletFilter, setHistoryWalletFilter] = useState("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");

  // Dialog states
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState(null);

  // Form states
  const [editingWallet, setEditingWallet] = useState(null);
  const [walletForm, setWalletForm] = useState({
    name: "",
    type: "BANK",
    bankName: "",
    accountNumber: "",
    accountTitle: "",
    branchCode: "",
    iban: "",
    provider: "Easypaisa",
    location: "",
    custodian: "",
    openingDebit: 0,
    openingCredit: 0,
    status: "ACTIVE",
  });

  // Direct Deposit Form (Image 1 replica)
  const [depositForm, setDepositForm] = useState({
    destinationTreasuryAccount: "",
    depositAmount: "",
    depositDate: new Date().toISOString().split("T")[0],
    sourceClassification: "Owner / Partner Capital Injection",
    referenceNo: "",
    description: "",
  });

  // Contra Account Transfer Form (Image 2 replica)
  const [transferForm, setTransferForm] = useState({
    transferDate: new Date().toISOString().split("T")[0],
    fromAccount: "",
    toAccount: "",
    transferAmount: "",
    referenceNo: "",
    description: "",
  });

  // Fetch Wallets & Stats
  const { data: walletData, isLoading: isWalletsLoading } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
  });

  const wallets = walletData?.wallets || [];
  const stats = walletData?.stats || {
    totalBalance: 0,
    bankBalance: 0,
    digitalWalletBalance: 0,
    cashBalance: 0,
    totalWallets: 0,
    activeWallets: 0,
  };

  // Fetch Transfer History
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["walletHistory", historyWalletFilter, historyTypeFilter, historySearch],
    queryFn: () =>
      getWalletHistory({
        walletId: historyWalletFilter,
        transactionType: historyTypeFilter,
        search: historySearch,
      }),
  });

  const transactions = historyData?.transactions || [];

  // Wallet Details & History Dialog State
  const [walletDetailOpen, setWalletDetailOpen] = useState(false);
  const [selectedWalletForDetail, setSelectedWalletForDetail] = useState(null);
  const [walletDetailTab, setWalletDetailTab] = useState("payrolls"); // 'payrolls' | 'transfers' | 'fee' | 'expenses'
  const [selectedPayrollBreakdown, setSelectedPayrollBreakdown] = useState(null);

  // Fetch Payroll Deduction Logs strictly for the selected wallet only
  const {
    data: walletPayrollLogsData,
    isLoading: isWalletPayrollLogsLoading,
    refetch: refetchWalletPayrollLogs,
  } = useQuery({
    queryKey: ["walletPayrollLogs", selectedWalletForDetail?.id || selectedWalletForDetail?._id],
    queryFn: () =>
      getPayrollDeductionLogs({
        walletId: selectedWalletForDetail?.id || selectedWalletForDetail?._id,
      }),
    enabled: walletDetailOpen && !!selectedWalletForDetail,
  });

  const walletPayrollLogs = walletPayrollLogsData?.logs || [];

  // Fetch Hostel Fee Collection Logs strictly for the selected wallet only
  const {
    data: walletHostelLogsData,
    isLoading: isWalletHostelLogsLoading,
    refetch: refetchWalletHostelLogs,
  } = useQuery({
    queryKey: ["walletHostelLogs", selectedWalletForDetail?.id || selectedWalletForDetail?._id],
    queryFn: () =>
      getHostelFeeLogs({
        walletId: selectedWalletForDetail?.id || selectedWalletForDetail?._id,
      }),
    enabled: walletDetailOpen && !!selectedWalletForDetail,
  });

  const walletHostelLogs = walletHostelLogsData?.logs || [];

  // Fetch Expense Deduction Logs strictly for the selected wallet only
  const {
    data: walletExpenseLogsData,
    isLoading: isWalletExpenseLogsLoading,
    refetch: refetchWalletExpenseLogs,
  } = useQuery({
    queryKey: ["walletExpenseLogs", selectedWalletForDetail?.id || selectedWalletForDetail?._id],
    queryFn: () =>
      getWalletExpenseLogs({
        walletId: selectedWalletForDetail?.id || selectedWalletForDetail?._id,
      }),
    enabled: walletDetailOpen && !!selectedWalletForDetail,
  });

  const walletExpenseLogs = walletExpenseLogsData?.logs || [];

  // Fetch Tuition Fee Collection Logs strictly for the selected wallet only
  const {
    data: walletTuitionLogsData,
    isLoading: isWalletTuitionLogsLoading,
    refetch: refetchWalletTuitionLogs,
  } = useQuery({
    queryKey: ["walletTuitionLogs", selectedWalletForDetail?.id || selectedWalletForDetail?._id],
    queryFn: () =>
      getTuitionFeeLogs({
        walletId: selectedWalletForDetail?.id || selectedWalletForDetail?._id,
      }),
    enabled: walletDetailOpen && !!selectedWalletForDetail,
  });

  const walletTuitionLogs = walletTuitionLogsData?.logs || [];

  // Filter transfers specifically involving the selected wallet
  const walletTransfers = useMemo(() => {
    if (!selectedWalletForDetail) return [];
    const wId = selectedWalletForDetail.id || selectedWalletForDetail._id;
    return transactions.filter(
      (tx) =>
        tx.sourceWallet?.id === wId ||
        tx.sourceWallet?._id === wId ||
        tx.sourceWallet === wId ||
        tx.destinationWallet?.id === wId ||
        tx.destinationWallet?._id === wId ||
        tx.destinationWallet === wId
    );
  }, [transactions, selectedWalletForDetail]);

  const handleOpenWalletDetail = (wallet) => {
    setSelectedWalletForDetail(wallet);
    setWalletDetailTab("payrolls");
    setWalletDetailOpen(true);
  };

  // Mutations
  const createWalletMutation = useMutation({
    mutationFn: createWallet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      toast({ title: "Success", description: "Account / Wallet created successfully." });
      setWalletDialogOpen(false);
      resetWalletForm();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to create wallet",
        variant: "destructive",
      });
    },
  });

  const updateWalletMutation = useMutation({
    mutationFn: ({ id, data }) => updateWallet(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      toast({ title: "Success", description: "Account / Wallet updated successfully." });
      setWalletDialogOpen(false);
      resetWalletForm();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update wallet",
        variant: "destructive",
      });
    },
  });

  const deleteWalletMutation = useMutation({
    mutationFn: deleteWallet,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      toast({ title: "Success", description: res.message || "Wallet deleted successfully." });
      setDeleteDialogOpen(false);
      setWalletToDelete(null);
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to delete wallet",
        variant: "destructive",
      });
    },
  });

  const depositMutation = useMutation({
    mutationFn: depositWalletFunds,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      toast({ title: "Success", description: "Funds deposited successfully." });
      setDepositDialogOpen(false);
      resetDepositForm();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to deposit funds",
        variant: "destructive",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: transferWalletFunds,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      toast({ title: "Success", description: "Contra transfer posted successfully." });
      setTransferDialogOpen(false);
      resetTransferForm();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to complete transfer",
        variant: "destructive",
      });
    },
  });

  // Helpers
  const resetWalletForm = () => {
    setEditingWallet(null);
    setWalletForm({
      name: "",
      type: "BANK",
      bankName: "",
      accountNumber: "",
      accountTitle: "",
      branchCode: "",
      iban: "",
      provider: "Easypaisa",
      location: "",
      custodian: "",
      openingDebit: 0,
      openingCredit: 0,
      status: "ACTIVE",
    });
  };

  const resetDepositForm = () => {
    setDepositForm({
      destinationTreasuryAccount: wallets[0]?.id || "",
      depositAmount: "",
      depositDate: new Date().toISOString().split("T")[0],
      sourceClassification: "Owner / Partner Capital Injection",
      referenceNo: "",
      description: "",
    });
  };

  const resetTransferForm = () => {
    setTransferForm({
      transferDate: new Date().toISOString().split("T")[0],
      fromAccount: "",
      toAccount: "",
      transferAmount: "",
      referenceNo: "",
      description: "",
    });
  };

  const handleOpenEdit = (w) => {
    setEditingWallet(w);
    setWalletForm({
      name: w.name || "",
      type: w.type || "BANK",
      bankName: w.bankName || "",
      accountNumber: w.accountNumber || "",
      accountTitle: w.accountTitle || "",
      branchCode: w.branchCode || "",
      iban: w.iban || "",
      provider: w.provider || "Easypaisa",
      location: w.location || "",
      custodian: w.custodian || "",
      openingDebit: w.openingDebit || 0,
      openingCredit: w.openingCredit || 0,
      status: w.status || "ACTIVE",
    });
    setWalletDialogOpen(true);
  };

  const handleOpenDeposit = (targetWalletId = null) => {
    setDepositForm({
      destinationTreasuryAccount: targetWalletId || wallets[0]?.id || "",
      depositAmount: "",
      depositDate: new Date().toISOString().split("T")[0],
      sourceClassification: "Owner / Partner Capital Injection",
      referenceNo: "",
      description: "",
    });
    setDepositDialogOpen(true);
  };

  const handleOpenTransfer = (sourceWalletId = null) => {
    const defaultTo = wallets.find((w) => w.id !== sourceWalletId)?.id || "";
    setTransferForm({
      transferDate: new Date().toISOString().split("T")[0],
      fromAccount: sourceWalletId || wallets[0]?.id || "",
      toAccount: defaultTo,
      transferAmount: "",
      referenceNo: "",
      description: "",
    });
    setTransferDialogOpen(true);
  };

  const handleSaveWallet = (e) => {
    e.preventDefault();
    if (!walletForm.name.trim()) {
      toast({ title: "Error", description: "Account name is required.", variant: "destructive" });
      return;
    }
    if (editingWallet) {
      updateWalletMutation.mutate({ id: editingWallet.id, data: walletForm });
    } else {
      createWalletMutation.mutate(walletForm);
    }
  };

  const handleSaveDeposit = (e) => {
    e.preventDefault();
    if (!depositForm.destinationTreasuryAccount) {
      toast({ title: "Error", description: "Destination account is required.", variant: "destructive" });
      return;
    }
    if (!depositForm.depositAmount || Number(depositForm.depositAmount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid deposit amount.", variant: "destructive" });
      return;
    }
    depositMutation.mutate(depositForm);
  };

  const handleSaveTransfer = (e) => {
    e.preventDefault();
    if (!transferForm.fromAccount || !transferForm.toAccount) {
      toast({ title: "Error", description: "Source and destination accounts are required.", variant: "destructive" });
      return;
    }
    if (transferForm.fromAccount === transferForm.toAccount) {
      toast({ title: "Error", description: "Source and destination accounts must be different.", variant: "destructive" });
      return;
    }
    if (!transferForm.transferAmount || Number(transferForm.transferAmount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid transfer amount.", variant: "destructive" });
      return;
    }

    const sourceWallet = wallets.find((w) => w.id === transferForm.fromAccount);
    if (sourceWallet && Number(sourceWallet.currentBalance) < Number(transferForm.transferAmount)) {
      toast({
        title: "Insufficient Balance",
        description: `Source account only has PKR ${(sourceWallet.currentBalance || 0).toLocaleString()}.`,
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate(transferForm);
  };

  const filteredWallets = useMemo(() => {
    if (walletTypeFilter === "ALL") return wallets;
    return wallets.filter((w) => w.type === walletTypeFilter);
  }, [wallets, walletTypeFilter]);

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    if (num < 0) {
      return `-PKR ${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `PKR ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            Treasury Wallets & Accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage institutional bank accounts, digital mobile wallets, cash safes, direct deposits, and transfers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(canCreate || canUpdate) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenDeposit()}
              className="text-xs gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Deposit Funds
            </Button>
          )}

          {(canCreate || canUpdate) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenTransfer()}
              className="text-xs gap-1.5 border-blue-600/30 text-blue-700 dark:text-blue-400 hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer Funds
            </Button>
          )}

          {canCreate && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                resetWalletForm();
                setWalletDialogOpen(true);
              }}
              className="text-xs gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Account / Wallet
            </Button>
          )}
        </div>
      </div>

      {/* Liquidity Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Treasury Balance
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(stats.totalBalance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Across {stats.activeWallets} active treasury {stats.activeWallets === 1 ? "account" : "accounts"}
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Bank Accounts
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <Landmark className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(stats.bankBalance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Commercial banks & operational accounts
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Digital Wallets
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
              <Smartphone className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(stats.digitalWalletBalance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Easypaisa, JazzCash, SadaPay & mobile money
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cash Safes / In Hand
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Banknote className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(stats.cashBalance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Office safes, home safe & counter cash
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs: Accounts List vs Transfer History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("accounts")}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeTab === "accounts"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Accounts & Wallets ({wallets.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeTab === "history"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span>Transfer & Deposit History</span>
            </button>
          </div>

          {activeTab === "accounts" && (
            <div className="flex items-center gap-1.5">
              {["ALL", "BANK", "DIGITAL_WALLET", "CASH"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setWalletTypeFilter(t)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors",
                    walletTypeFilter === t
                      ? "bg-muted font-semibold text-foreground border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "ALL" && "All"}
                  {t === "BANK" && "Banks"}
                  {t === "DIGITAL_WALLET" && "Digital"}
                  {t === "CASH" && "Cash Safes"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TAB 1: ACCOUNTS & WALLETS GRID */}
        {activeTab === "accounts" && (
          <div>
            {isWalletsLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading accounts...</div>
            ) : filteredWallets.length === 0 ? (
              <div className="p-12 text-center border rounded-2xl bg-card">
                <Wallet className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
                <h3 className="text-base font-semibold text-foreground">No accounts found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Click "Add Account / Wallet" above to create your first bank account, digital wallet, or physical cash safe.
                </p>
                {canCreate && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      resetWalletForm();
                      setWalletDialogOpen(true);
                    }}
                    className="mt-4 text-xs gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Account
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWallets.map((w) => {
                  const isBank = w.type === "BANK";
                  const isDigital = w.type === "DIGITAL_WALLET";
                  const isCash = w.type === "CASH";
                  const bal = Number(w.currentBalance) || 0;

                  return (
                    <Card key={w.id} className="border shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between">
                      <div>
                        <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={cn(
                                "p-2.5 rounded-xl shrink-0",
                                isBank && "bg-blue-500/10 text-blue-600",
                                isDigital && "bg-purple-500/10 text-purple-600",
                                isCash && "bg-amber-500/10 text-amber-600"
                              )}
                            >
                              {isBank && <Landmark className="w-5 h-5" />}
                              {isDigital && <Smartphone className="w-5 h-5" />}
                              {isCash && <Banknote className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-base text-foreground truncate" title={w.name}>
                                {w.name}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                  {isBank && (w.bankName || "Bank Account")}
                                  {isDigital && (w.provider || "Digital Wallet")}
                                  {isCash && (w.location || "Cash in Hand")}
                                </Badge>
                                {w.status === "INACTIVE" && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenWalletDetail(w)}>
                                <History className="w-3.5 h-3.5 mr-2 text-primary" />
                                View Details & History
                              </DropdownMenuItem>
                              {(canCreate || canUpdate) && (
                                <DropdownMenuItem onClick={() => handleOpenDeposit(w.id)}>
                                  <ArrowDownToLine className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                                  Deposit Funds
                                </DropdownMenuItem>
                              )}
                              {(canCreate || canUpdate) && (
                                <DropdownMenuItem onClick={() => handleOpenTransfer(w.id)}>
                                  <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-blue-600" />
                                  Transfer from this Account
                                </DropdownMenuItem>
                              )}
                              {canUpdate && (
                                <DropdownMenuItem onClick={() => handleOpenEdit(w)}>
                                  <Edit className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                  Edit Account
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setWalletToDelete(w);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete Account
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardHeader>

                        <CardContent className="pb-3 space-y-3">
                          {/* Account specifics */}
                          <div className="bg-muted/40 rounded-lg p-2.5 text-xs space-y-1">
                            {isBank && (
                              <>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Account No:</span>
                                  <span className="font-mono text-foreground font-medium">{w.accountNumber || "—"}</span>
                                </div>
                                {w.accountTitle && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Title:</span>
                                    <span className="text-foreground">{w.accountTitle}</span>
                                  </div>
                                )}
                                {w.branchCode && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Branch Code:</span>
                                    <span className="text-foreground">{w.branchCode}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {isDigital && (
                              <>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Mobile / A/C:</span>
                                  <span className="font-mono text-foreground font-medium">{w.accountNumber || "—"}</span>
                                </div>
                                {w.accountTitle && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Title:</span>
                                    <span className="text-foreground">{w.accountTitle}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {isCash && (
                              <>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Safe / Location:</span>
                                  <span className="text-foreground font-medium">{w.location || "Office Safe"}</span>
                                </div>
                                {w.custodian && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Custodian:</span>
                                    <span className="text-foreground">{w.custodian}</span>
                                  </div>
                                )}
                              </>
                            )}

                            <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 text-[11px]">
                              <span>Opening (Dr - Cr):</span>
                              <span>
                                {Number(w.openingDebit || 0) - Number(w.openingCredit || 0) >= 0 ? "+" : ""}
                                {(Number(w.openingDebit || 0) - Number(w.openingCredit || 0)).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Live Balance */}
                          <div className="flex items-baseline justify-between pt-1">
                            <span className="text-xs text-muted-foreground font-medium">Current Balance</span>
                            <span
                              className={cn(
                                "text-lg font-bold tracking-tight",
                                bal >= 0 ? "text-foreground" : "text-destructive"
                              )}
                            >
                              {formatCurrency(bal)}
                            </span>
                          </div>
                        </CardContent>
                      </div>

                      {/* Card Footer Quick Actions */}
                      <div className="p-3 border-t bg-muted/20 flex items-center justify-between gap-2">
                        {(canCreate || canUpdate) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeposit(w.id)}
                            className="h-7 text-xs flex-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />
                            Deposit
                          </Button>
                        )}
                        {(canCreate || canUpdate) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenTransfer(w.id)}
                            className="h-7 text-xs flex-1 text-blue-700 dark:text-blue-400 hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                            Transfer
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenWalletDetail(w)}
                          className="h-7 text-xs flex-1 text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <History className="w-3.5 h-3.5 mr-1" />
                          History
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRANSFER & AUDIT HISTORY */}
        {activeTab === "history" && (
          <Card className="border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Treasury Transfer & Transaction Audit History
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comprehensive log of all account creations, opening adjustments, direct deposits, and contra transfers.
                  </CardDescription>
                </div>
              </div>

              {/* Filters toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Filter by Account</Label>
                  <Select value={historyWalletFilter} onValueChange={setHistoryWalletFilter}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="All Accounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts & Safes</SelectItem>
                      {wallets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Transaction Type</Label>
                  <Select value={historyTypeFilter} onValueChange={setHistoryTypeFilter}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Transaction Types</SelectItem>
                      <SelectItem value="DEPOSIT">Direct Deposit</SelectItem>
                      <SelectItem value="CONTRA_TRANSFER">Contra Transfer</SelectItem>
                      <SelectItem value="HOSTEL_FEE">Hostel Fee Collection</SelectItem>
                      <SelectItem value="FEE">Tuition Fee Collection</SelectItem>
                      <SelectItem value="OPENING_BALANCE">Opening Balance</SelectItem>
                      <SelectItem value="WALLET_UPDATED">Opening Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Search Reference / Notes</Label>
                  <div className="relative mt-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. TRF-8812, safe, cheque..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isHistoryLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading history...</div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No transaction records found matching the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px] bg-muted/30">
                        <TableHead className="w-[110px]">Date</TableHead>
                        <TableHead className="w-[140px]">Type</TableHead>
                        <TableHead>From (Credit)</TableHead>
                        <TableHead>To (Debit)</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Category / Classification</TableHead>
                        <TableHead>Reference #</TableHead>
                        <TableHead>Description / Notes</TableHead>
                        <TableHead>Performed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => {
                        const isReversal =
                          tx.isReversal ||
                          Number(tx.amount || 0) < 0 ||
                          tx.transactionType?.includes("REVERSAL") ||
                          tx.category?.includes("REVERSAL") ||
                          tx.sourceCategory?.includes("REVERSAL") ||
                          tx.description?.toLowerCase().includes("reversal");
                        const isDeposit = tx.transactionType === "DEPOSIT";
                        const isTransfer = tx.transactionType === "CONTRA_TRANSFER";
                        const isOpening = tx.transactionType === "OPENING_BALANCE";
                        const isUpdate = tx.transactionType === "WALLET_UPDATED";
                        const isHostelFee = tx.transactionType === "HOSTEL_FEE" || tx.category === "HOSTEL_FEE";
                        const isTuitionFee = tx.transactionType === "FEE" || tx.category === "FEE";
                        const isExpense =
                          tx.transactionType === "EXPENSE" ||
                          tx.category === "EXPENSE" ||
                          [
                            "HOSTEL_EXPENSE",
                            "HOSTEL_INVENTORY_EXPENSE",
                            "INVENTORY_ITEM_EXPENSE",
                            "INVENTORY_MANUAL_EXPENSE",
                            "INVENTORY_EXPENSE",
                          ].includes(tx.category);
                        const isPayroll = tx.transactionType === "PAYROLL" || tx.category === "PAYROLL";

                        return (
                          <TableRow key={tx.id} className="text-xs">
                            <TableCell className="font-mono text-muted-foreground py-2.5">
                              {tx.date || "—"}
                            </TableCell>

                            <TableCell className="py-2.5">
                              {isReversal ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/30 text-destructive bg-destructive/5 font-semibold">
                                  Reversal / Refund
                                </Badge>
                              ) : isDeposit ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-600/30 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                                  Direct Deposit
                                </Badge>
                              ) : isTransfer ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-600/30 text-blue-700 bg-blue-50 dark:bg-blue-950/30">
                                  Contra Transfer
                                </Badge>
                              ) : isHostelFee ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-600/30 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                                  Hostel Fee
                                </Badge>
                              ) : isTuitionFee ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5">
                                  Tuition Fee
                                </Badge>
                              ) : isExpense ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-600/30 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
                                  Expense
                                </Badge>
                              ) : isPayroll ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-600/30 text-purple-700 bg-purple-50 dark:bg-purple-950/30">
                                  Payroll
                                </Badge>
                              ) : isOpening ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-600/30 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
                                  Opening Balance
                                </Badge>
                              ) : isUpdate ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-600/30 text-purple-700 bg-purple-50 dark:bg-purple-950/30">
                                  Balance Adj.
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {tx.transactionType || "Transaction"}
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="py-2.5 font-medium">
                              {tx.sourceWallet?.name ? (
                                <span className="text-foreground">{tx.sourceWallet.name}</span>
                              ) : isDeposit ? (
                                <span className="text-muted-foreground italic">{tx.sourceCategory || "External Capital"}</span>
                              ) : isHostelFee ? (
                                <span className="text-foreground font-medium">{tx.studentName ? `${tx.studentName}` : "Boarder Student"}</span>
                              ) : isTuitionFee ? (
                                <span className="text-foreground font-medium">{tx.studentName ? `${tx.studentName}${tx.rollNumber ? ` (${tx.rollNumber})` : ''}` : "Student"}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            <TableCell className="py-2.5 font-medium">
                              {tx.destinationWallet?.name ? (
                                <span className="text-foreground font-semibold">{tx.destinationWallet.name}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            <TableCell className="py-2.5 text-right font-mono font-bold">
                              <span
                                className={cn(
                                  isReversal && "text-destructive",
                                  !isReversal && (isDeposit || isHostelFee || isTuitionFee) && "text-emerald-600",
                                  !isReversal && isTransfer && "text-blue-600",
                                  !isReversal && (isExpense || isPayroll) && "text-destructive",
                                  !isReversal && (isOpening || isUpdate) && "text-foreground"
                                )}
                              >
                                {isReversal
                                  ? `-PKR ${Math.abs(Number(tx.amount || 0)).toLocaleString()}`
                                  : (isDeposit || isHostelFee || isTuitionFee)
                                  ? `+PKR ${Math.abs(Number(tx.amount || 0)).toLocaleString()}`
                                  : (isExpense || isPayroll)
                                  ? `-PKR ${Math.abs(Number(tx.amount || 0)).toLocaleString()}`
                                  : formatCurrency(tx.amount)}
                              </span>
                            </TableCell>

                            <TableCell className="py-2.5 text-muted-foreground">
                              {isTuitionFee ? "Tuition Fee" : (tx.sourceCategory || "—")}
                            </TableCell>

                            <TableCell className="py-2.5 font-mono text-[11px] text-muted-foreground">
                              {tx.referenceNo || "—"}
                            </TableCell>

                            <TableCell className="py-2.5 text-muted-foreground max-w-[200px] truncate" title={tx.description}>
                              {tx.description || "—"}
                            </TableCell>

                            <TableCell className="py-2.5 text-muted-foreground text-[11px]">
                              {tx.performedByName || tx.performedBy?.name || "System"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ======================================================== */}
      {/* DIALOG 1: CREATE / EDIT WALLET FORM                     */}
      {/* ======================================================== */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              {editingWallet ? "Edit Treasury Account / Wallet" : "Add New Account / Wallet"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure treasury bank accounts, digital mobile wallets, or physical cash safes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveWallet} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Account / Wallet Name *</Label>
                <Input
                  required
                  placeholder="e.g. Meezan Main Operations, Office Safe, Easypaisa"
                  value={walletForm.name}
                  onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Account Type *</Label>
                <Select
                  value={walletForm.type}
                  onValueChange={(val) => setWalletForm({ ...walletForm, type: val })}
                >
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">Bank Account</SelectItem>
                    <SelectItem value="DIGITAL_WALLET">Digital Wallet</SelectItem>
                    <SelectItem value="CASH">Cash in Hand / Safe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={walletForm.status}
                  onValueChange={(val) => setWalletForm({ ...walletForm, status: val })}
                >
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic fields based on Type */}
              {walletForm.type === "BANK" && (
                <>
                  <div>
                    <Label className="text-xs">Bank Name</Label>
                    <Input
                      placeholder="e.g. Meezan Bank, HBL, Bank of Khyber"
                      value={walletForm.bankName}
                      onChange={(e) => setWalletForm({ ...walletForm, bankName: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Account Title</Label>
                    <Input
                      placeholder="e.g. Concordia College Peshawar"
                      value={walletForm.accountTitle}
                      onChange={(e) => setWalletForm({ ...walletForm, accountTitle: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Account Number</Label>
                    <Input
                      placeholder="e.g. 0102-0103445566"
                      value={walletForm.accountNumber}
                      onChange={(e) => setWalletForm({ ...walletForm, accountNumber: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Branch Code / IBAN</Label>
                    <Input
                      placeholder="e.g. 0102 / PK36MEZN..."
                      value={walletForm.branchCode}
                      onChange={(e) => setWalletForm({ ...walletForm, branchCode: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </>
              )}

              {walletForm.type === "DIGITAL_WALLET" && (
                <>
                  <div>
                    <Label className="text-xs">Wallet Provider</Label>
                    <Select
                      value={walletForm.provider}
                      onValueChange={(val) => setWalletForm({ ...walletForm, provider: val })}
                    >
                      <SelectTrigger className="h-9 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIGITAL_PROVIDERS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Mobile / Account Number</Label>
                    <Input
                      placeholder="e.g. 0333-1234567"
                      value={walletForm.accountNumber}
                      onChange={(e) => setWalletForm({ ...walletForm, accountNumber: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs">Account Title / Merchant Name</Label>
                    <Input
                      placeholder="e.g. Concordia College Principal"
                      value={walletForm.accountTitle}
                      onChange={(e) => setWalletForm({ ...walletForm, accountTitle: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </>
              )}

              {walletForm.type === "CASH" && (
                <>
                  <div>
                    <Label className="text-xs">Safe / Cash Location</Label>
                    <Input
                      placeholder="e.g. Main Office Safe, Home Safe, Counter"
                      value={walletForm.location}
                      onChange={(e) => setWalletForm({ ...walletForm, location: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Custodian / Handled By</Label>
                    <Input
                      placeholder="e.g. Principal / Accountant"
                      value={walletForm.custodian}
                      onChange={(e) => setWalletForm({ ...walletForm, custodian: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </>
              )}

              {/* Opening Balances */}
              <div className="sm:col-span-2 pt-2 border-t mt-1">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">
                  Opening Balances (Initial setup or baseline adjustment)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Opening Debit Balance (Positive Funds)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={walletForm.openingDebit}
                      onChange={(e) => setWalletForm({ ...walletForm, openingDebit: e.target.value })}
                      className="h-9 text-xs mt-1 font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Asset in hand / bank</p>
                  </div>

                  <div>
                    <Label className="text-xs">Opening Credit Balance (Overdraft/Liability)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={walletForm.openingCredit}
                      onChange={(e) => setWalletForm({ ...walletForm, openingCredit: e.target.value })}
                      className="h-9 text-xs mt-1 font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Credit / overdraft amount</p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setWalletDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createWalletMutation.isPending || updateWalletMutation.isPending}>
                {editingWallet ? "Save Changes" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG 2: DIRECT DEPOSIT / ADD FUNDS (EXACT IMAGE 1)     */}
      {/* ======================================================== */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Direct Deposit / Add Funds
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Put funds into treasury accounts with tracked source of origin
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveDeposit} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Destination Treasury Account *
              </Label>
              <Select
                value={depositForm.destinationTreasuryAccount}
                onValueChange={(val) => setDepositForm({ ...depositForm, destinationTreasuryAccount: val })}
              >
                <SelectTrigger className="h-10 text-xs mt-1 font-medium">
                  <SelectValue placeholder="-- Select Destination Account --" />
                </SelectTrigger>
                <SelectContent>
                  {wallets
                    .filter((w) => w.status === "ACTIVE")
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.type}) — Current: {formatCurrency(w.currentBalance)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Deposit Amount (PKR) *
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={depositForm.depositAmount}
                  onChange={(e) => setDepositForm({ ...depositForm, depositAmount: e.target.value })}
                  className="h-10 text-sm mt-1 font-mono font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Deposit Date *
                </Label>
                <Input
                  type="date"
                  required
                  value={depositForm.depositDate}
                  onChange={(e) => setDepositForm({ ...depositForm, depositDate: e.target.value })}
                  className="h-10 text-xs mt-1"
                />
              </div>
            </div>

            {/* Origin of Funds Card Banner */}
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Origin of Funds (Where Did The Money Come From?)
                </span>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  GL: 3010 (Owner Equity)
                </span>
              </div>

              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Source Classification / Category
                </Label>
                <Select
                  value={depositForm.sourceClassification}
                  onValueChange={(val) => setDepositForm({ ...depositForm, sourceClassification: val })}
                >
                  <SelectTrigger className="h-10 text-xs mt-1 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reference / Cheque / Slip No.
                </Label>
                <Input
                  placeholder="e.g. CHQ-9912 / Slip-012"
                  value={depositForm.referenceNo}
                  onChange={(e) => setDepositForm({ ...depositForm, referenceNo: e.target.value })}
                  className="h-9 text-xs mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description / Purpose
                </Label>
                <Input
                  placeholder="e.g. Injected working capital"
                  value={depositForm.description}
                  onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setDepositDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={depositMutation.isPending}
              >
                Deposit Funds
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG 3: CONTRA ACCOUNT TRANSFER (EXACT IMAGE 2)        */}
      {/* ======================================================== */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  New Contra Account Transfer
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Double-entry transfer between Bank, Cash & Card accounts
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveTransfer} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transfer Date *
              </Label>
              <Input
                type="date"
                required
                value={transferForm.transferDate}
                onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                className="h-10 text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  From Account (Credit) *
                </Label>
                <Select
                  value={transferForm.fromAccount}
                  onValueChange={(val) => setTransferForm({ ...transferForm, fromAccount: val })}
                >
                  <SelectTrigger className="h-10 text-xs mt-1">
                    <SelectValue placeholder="-- Select Source --" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets
                      .filter((w) => w.status === "ACTIVE")
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.type}) — Bal: {formatCurrency(w.currentBalance)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  To Account (Debit) *
                </Label>
                <Select
                  value={transferForm.toAccount}
                  onValueChange={(val) => setTransferForm({ ...transferForm, toAccount: val })}
                >
                  <SelectTrigger className="h-10 text-xs mt-1">
                    <SelectValue placeholder="-- Select Destination --" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets
                      .filter((w) => w.status === "ACTIVE" && w.id !== transferForm.fromAccount)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.type}) — Bal: {formatCurrency(w.currentBalance)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transfer Amount (PKR) *
              </Label>
              <Input
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="0.00"
                value={transferForm.transferAmount}
                onChange={(e) => setTransferForm({ ...transferForm, transferAmount: e.target.value })}
                className="h-10 text-sm mt-1 font-mono font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reference / Cheque No.
                </Label>
                <Input
                  placeholder="e.g. TRF-8812 / CHQ-0041"
                  value={transferForm.referenceNo}
                  onChange={(e) => setTransferForm({ ...transferForm, referenceNo: e.target.value })}
                  className="h-9 text-xs mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </Label>
                <Input
                  placeholder="e.g. Replenish main office safe"
                  value={transferForm.description}
                  onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setTransferDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                disabled={transferMutation.isPending}
              >
                Post Contra Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION DIALOG                               */}
      {/* ======================================================== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete / Deactivate Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{walletToDelete?.name}</strong>? If this account has historical deposits or transfers, it will be safely deactivated to preserve accounting records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (walletToDelete) deleteWalletMutation.mutate(walletToDelete.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ======================================================== */}
      {/* WALLET DETAILS & MULTI-TAB HISTORY DIALOG                 */}
      {/* ======================================================== */}
      <Dialog open={walletDetailOpen} onOpenChange={setWalletDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2.5 rounded-xl shrink-0",
                    selectedWalletForDetail?.type === "BANK" && "bg-blue-500/10 text-blue-600",
                    selectedWalletForDetail?.type === "DIGITAL_WALLET" && "bg-purple-500/10 text-purple-600",
                    selectedWalletForDetail?.type === "CASH" && "bg-amber-500/10 text-amber-600"
                  )}
                >
                  {selectedWalletForDetail?.type === "BANK" && <Landmark className="w-5 h-5" />}
                  {selectedWalletForDetail?.type === "DIGITAL_WALLET" && <Smartphone className="w-5 h-5" />}
                  {selectedWalletForDetail?.type === "CASH" && <Banknote className="w-5 h-5" />}
                </div>
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    {selectedWalletForDetail?.name}
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {selectedWalletForDetail?.type}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {selectedWalletForDetail?.type === "BANK" && `Bank: ${selectedWalletForDetail.bankName || "—"} | A/C: ${selectedWalletForDetail.accountNumber || "—"}`}
                    {selectedWalletForDetail?.type === "DIGITAL_WALLET" && `Provider: ${selectedWalletForDetail.provider || "—"} | Mobile: ${selectedWalletForDetail.accountNumber || "—"}`}
                    {selectedWalletForDetail?.type === "CASH" && `Location: ${selectedWalletForDetail.location || "Safe"} | Custodian: ${selectedWalletForDetail.custodian || "—"}`}
                  </DialogDescription>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Current Balance</div>
                <div
                  className={cn(
                    "text-lg font-bold font-mono",
                    Number(selectedWalletForDetail?.currentBalance || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  )}
                >
                  {formatCurrency(Number(selectedWalletForDetail?.currentBalance || 0))}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Sub-tabs Navigation */}
          <div className="flex items-center gap-1.5 border-b pb-2 pt-2 bg-muted/20 px-2 rounded-md">
            <button
              type="button"
              onClick={() => setWalletDetailTab("payrolls")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors",
                walletDetailTab === "payrolls"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Payrolls</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {walletPayrollLogs.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWalletDetailTab("transfers")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors",
                walletDetailTab === "transfers"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transfers & Deposits</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {walletTransfers.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWalletDetailTab("hostelFee")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors",
                walletDetailTab === "hostelFee"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Hostel Fee</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {walletHostelLogs.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWalletDetailTab("fee")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors",
                walletDetailTab === "fee"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Tuition Fee</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {walletTuitionLogs.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWalletDetailTab("expenses")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors",
                walletDetailTab === "expenses"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Expenses</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {walletExpenseLogs.length}
              </Badge>
            </button>
          </div>

          {/* Sub-tab 1: Payrolls (Strictly filtered to this wallet) */}
          {walletDetailTab === "payrolls" && (
            <div className="flex-1 flex flex-col min-h-0 py-2">
              <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
                <span>Deductions originating strictly from <strong>{selectedWalletForDetail?.name}</strong></span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => refetchWalletPayrollLogs()}
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
              </div>

              <div className="flex-1 overflow-auto border rounded-md">
                {isWalletPayrollLogsLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : walletPayrollLogs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-xs">
                    No payroll deductions have been made from this account yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs">Payroll Month</TableHead>
                        <TableHead className="text-xs">Disbursed Date</TableHead>
                        <TableHead className="text-xs text-right">Amount Deducted</TableHead>
                        <TableHead className="text-xs text-center">Staff Count</TableHead>
                        <TableHead className="text-xs text-right">Balance After</TableHead>
                        <TableHead className="text-xs">Disbursed By</TableHead>
                        <TableHead className="text-xs text-center">Breakdown</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletPayrollLogs.map((log) => {
                        const monthDisplay = log.payrollMonth
                          ? new Date(`${log.payrollMonth}-01`).toLocaleString("default", { month: "short", year: "numeric" })
                          : "—";
                        const dateDisplay = log.date
                          ? new Date(log.date).toLocaleDateString()
                          : "—";

                        return (
                          <TableRow key={log._id || log.id}>
                            <TableCell className="font-semibold text-xs">
                              {monthDisplay}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {dateDisplay}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-right text-foreground">
                              PKR {Number(log.amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              <Badge variant="secondary" className="text-[11px] px-2 py-0">
                                {log.staffCount || log.staffDetails?.length || 1} staff
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              <span className={Number(log.balanceAfter || 0) < 0 ? "text-destructive font-bold" : "text-muted-foreground"}>
                                PKR {Number(log.balanceAfter || 0).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.performedBy?.name || "System"}
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-primary hover:bg-primary/10"
                                onClick={() => setSelectedPayrollBreakdown(log)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab 2: Transfers & Deposits */}
          {walletDetailTab === "transfers" && (
            <div className="flex-1 flex flex-col min-h-0 py-2">
              <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
                <span>Contra transfers & direct deposits involving <strong>{selectedWalletForDetail?.name}</strong></span>
              </div>

              <div className="flex-1 overflow-auto border rounded-md">
                {walletTransfers.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-xs">
                    No transfers or deposits recorded for this account.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Flow / Type</TableHead>
                        <TableHead className="text-xs">Counterparty / Classification</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Reference #</TableHead>
                        <TableHead className="text-xs">Disbursed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTransfers.map((tx) => {
                        const wId = selectedWalletForDetail.id || selectedWalletForDetail._id;
                        const isOutgoing = (tx.sourceWallet?.id === wId || tx.sourceWallet?._id === wId || tx.sourceWallet === wId) && tx.transactionType === "CONTRA_TRANSFER";
                        const isIncoming = (tx.destinationWallet?.id === wId || tx.destinationWallet?._id === wId || tx.destinationWallet === wId) && tx.transactionType === "CONTRA_TRANSFER";
                        const isDeposit = tx.transactionType === "DEPOSIT";

                        return (
                          <TableRow key={tx._id || tx.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(tx.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs">
                              {isDeposit && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                                  Direct Deposit
                                </Badge>
                              )}
                              {isIncoming && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[10px]">
                                  Transfer In
                                </Badge>
                              )}
                              {isOutgoing && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                                  Transfer Out
                                </Badge>
                              )}
                              {!isDeposit && !isIncoming && !isOutgoing && (
                                <Badge variant="outline" className="text-[10px]">
                                  {tx.transactionType}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {isDeposit && (tx.category || tx.description || "Capital Deposit")}
                              {isIncoming && `From: ${tx.sourceWallet?.name || "Other Account"}`}
                              {isOutgoing && `To: ${tx.destinationWallet?.name || "Other Account"}`}
                            </TableCell>
                            <TableCell className={cn("text-xs font-semibold text-right font-mono", isOutgoing ? "text-destructive" : "text-emerald-600")}>
                              {isOutgoing ? "-" : "+"}PKR {Number(tx.amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {tx.referenceNo || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {tx.performedBy?.name || "Admin"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab: Hostel Fee Collections */}
          {walletDetailTab === "hostelFee" && (
            <div className="flex-1 flex flex-col min-h-0 py-2">
              <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
                <span>Hostel fee collections deposited directly into <strong>{selectedWalletForDetail?.name}</strong></span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => refetchWalletHostelLogs()}
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
              </div>

              <div className="flex-1 overflow-auto border rounded-md">
                {isWalletHostelLogsLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : walletHostelLogs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-xs">
                    No hostel fee payments have been deposited into this account yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Challan #</TableHead>
                        <TableHead className="text-xs">Boarder / Student</TableHead>
                        <TableHead className="text-xs">Month</TableHead>
                        <TableHead className="text-xs text-right">Amount Deposited</TableHead>
                        <TableHead className="text-xs text-right">Balance After</TableHead>
                        <TableHead className="text-xs">Method</TableHead>
                        <TableHead className="text-xs">Logged By</TableHead>
                        <TableHead className="text-xs">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletHostelLogs.map((log) => {
                        const isReversal =
                          log.isReversal ||
                          Number(log.amount || 0) < 0 ||
                          log.transactionType?.includes('REVERSAL') ||
                          log.category?.includes('REVERSAL') ||
                          log.sourceCategory?.includes('REVERSAL') ||
                          log.description?.toLowerCase().includes('reversal');

                        return (
                          <TableRow key={log._id || log.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.date ? new Date(log.date).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-semibold font-mono">
                              <Badge variant="outline" className={cn("text-[10px]", isReversal && "border-destructive/30 text-destructive bg-destructive/5")}>
                                {log.challanNumber || log.referenceNo || '—'}
                                {isReversal && " (Reversed)"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium text-foreground">{log.studentName || '—'}</div>
                              {log.rollNumber && <div className="text-[10px] text-muted-foreground">{log.rollNumber}</div>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.month || '—'}
                            </TableCell>
                            <TableCell className={cn("text-xs font-bold text-right font-mono", isReversal ? "text-destructive" : "text-emerald-600")}>
                              {isReversal
                                ? `-PKR ${Math.abs(Number(log.amount || 0)).toLocaleString()}`
                                : `+PKR ${Number(log.amount || 0).toLocaleString()}`}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono text-muted-foreground">
                              {log.balanceAfterDestination !== null && log.balanceAfterDestination !== undefined
                                ? `PKR ${Number(log.balanceAfterDestination).toLocaleString()}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="secondary" className="text-[10px]">
                                {log.paymentMode || 'Cash'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.performedByName || log.performedBy?.name || 'System'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {log.description || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab 3: Tuition Fee Collections */}
          {walletDetailTab === "fee" && (
            <div className="flex-1 flex flex-col min-h-0 py-2">
              <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Tuition fee collections deposited directly into <strong>{selectedWalletForDetail?.name}</strong></span>
                  {walletTuitionLogs.length > 0 && (
                    <Badge variant="outline" className="text-[10px] border-emerald-600/30 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                      Total: PKR {walletTuitionLogs.reduce((sum, l) => sum + Number(l.amount || 0), 0).toLocaleString()}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => refetchWalletTuitionLogs()}
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
              </div>

              <div className="flex-1 overflow-auto border rounded-md">
                {isWalletTuitionLogsLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : walletTuitionLogs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-xs">
                    No tuition fee payments have been deposited into this account yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Challan #</TableHead>
                        <TableHead className="text-xs">Student</TableHead>
                        <TableHead className="text-xs">Month / Term</TableHead>
                        <TableHead className="text-xs text-right">Amount Deposited</TableHead>
                        <TableHead className="text-xs text-right">Balance After</TableHead>
                        <TableHead className="text-xs">Method</TableHead>
                        <TableHead className="text-xs">Logged By</TableHead>
                        <TableHead className="text-xs">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTuitionLogs.map((log) => {
                        const isReversal =
                          log.isReversal ||
                          Number(log.amount || 0) < 0 ||
                          log.transactionType?.includes('REVERSAL') ||
                          log.category?.includes('REVERSAL') ||
                          log.sourceCategory?.includes('REVERSAL') ||
                          log.description?.toLowerCase().includes('reversal');

                        return (
                          <TableRow key={log._id || log.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.date ? new Date(log.date).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-semibold font-mono">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  isReversal
                                    ? "border-destructive/30 text-destructive bg-destructive/5"
                                    : "border-primary/30 text-primary bg-primary/5"
                                )}
                              >
                                {log.challanNumber || log.referenceNo || '—'}
                                {isReversal && " (Reversed)"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium text-foreground">{log.studentName || '—'}</div>
                              {log.rollNumber && <div className="text-[10px] text-muted-foreground">{log.rollNumber}</div>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.month || '—'}
                            </TableCell>
                            <TableCell className={cn("text-xs font-bold text-right font-mono", isReversal ? "text-destructive" : "text-emerald-600")}>
                              {isReversal
                                ? `-PKR ${Math.abs(Number(log.amount || 0)).toLocaleString()}`
                                : `+PKR ${Number(log.amount || 0).toLocaleString()}`}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono text-muted-foreground">
                              {log.balanceAfterDestination !== null && log.balanceAfterDestination !== undefined
                                ? `PKR ${Number(log.balanceAfterDestination).toLocaleString()}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="secondary" className="text-[10px]">
                                {log.paymentMode || 'Cash'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.performedByName || log.performedBy?.name || 'System'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]" title={log.description}>
                              {log.description || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab 4: Expense Deductions */}
          {walletDetailTab === "expenses" && (
            <div className="flex-1 flex flex-col min-h-0 py-2">
              <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
                <span>Expense deductions disbursed strictly from <strong>{selectedWalletForDetail?.name}</strong></span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => refetchWalletExpenseLogs()}
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
              </div>

              <div className="flex-1 overflow-auto border rounded-md">
                {isWalletExpenseLogsLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : walletExpenseLogs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-xs">
                    No expense deductions have been recorded for this account yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Expense / Item Title</TableHead>
                        <TableHead className="text-xs">Source Module</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs text-right">Amount Deducted</TableHead>
                        <TableHead className="text-xs text-right">Balance After</TableHead>
                        <TableHead className="text-xs">Logged By</TableHead>
                        <TableHead className="text-xs">Description / Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletExpenseLogs.map((log) => {
                        const isReversal =
                          log.isReversal ||
                          Number(log.amount || 0) < 0 ||
                          log.transactionType?.includes('REVERSAL') ||
                          log.category?.includes('REVERSAL') ||
                          log.sourceCategory?.includes('REVERSAL') ||
                          log.description?.toLowerCase().includes('reversal');

                        return (
                          <TableRow key={log._id || log.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.date ? new Date(log.date).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-foreground">
                              <div className="flex items-center gap-1.5">
                                <span>{log.description?.replace(/^(Hostel Expense: |Hostel Inventory: |Inventory Item: |Inventory Expense: |Finance Expense: |Reversal: )/, '') || log.metadata?.expenseTitle || log.metadata?.itemName || 'Expense'}</span>
                                {isReversal && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-600/30 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                                    Refund / Reversal
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  (log.sourceCategory === 'HOSTEL_INVENTORY_EXPENSE' || log.category === 'HOSTEL_INVENTORY_EXPENSE' || log.sourceCategory === 'HOSTEL_INVENTORY_EXPENSE_REVERSAL')
                                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300"
                                    : (log.sourceCategory === 'INVENTORY_ITEM_EXPENSE' || log.category === 'INVENTORY_ITEM_EXPENSE' || log.sourceCategory === 'INVENTORY_ITEM_EXPENSE_REVERSAL')
                                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                                    : (log.sourceCategory === 'INVENTORY_MANUAL_EXPENSE' || log.category === 'INVENTORY_MANUAL_EXPENSE' || log.sourceCategory === 'INVENTORY_EXPENSE_REVERSAL')
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300"
                                    : (log.sourceCategory === 'FINANCE_EXPENSE' || log.category === 'FINANCE_EXPENSE' || log.sourceCategory === 'FINANCE_EXPENSE_REVERSAL')
                                    ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300"
                                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
                                )}
                              >
                                {log.sourceModule || (
                                  (log.sourceCategory === 'HOSTEL_INVENTORY_EXPENSE' || log.category === 'HOSTEL_INVENTORY_EXPENSE' || log.sourceCategory === 'HOSTEL_INVENTORY_EXPENSE_REVERSAL')
                                    ? "Hostel Inventory"
                                    : (log.sourceCategory === 'INVENTORY_ITEM_EXPENSE' || log.category === 'INVENTORY_ITEM_EXPENSE' || log.sourceCategory === 'INVENTORY_ITEM_EXPENSE_REVERSAL')
                                    ? "School Inventory"
                                    : (log.sourceCategory === 'INVENTORY_MANUAL_EXPENSE' || log.category === 'INVENTORY_MANUAL_EXPENSE' || log.sourceCategory === 'INVENTORY_EXPENSE_REVERSAL')
                                    ? "Inventory Expense"
                                    : (log.sourceCategory === 'FINANCE_EXPENSE' || log.category === 'FINANCE_EXPENSE' || log.sourceCategory === 'FINANCE_EXPENSE_REVERSAL')
                                    ? "Finance Expense"
                                    : "Hostel Expense"
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.category || log.sourceCategory || 'Expense'}
                            </TableCell>
                            <TableCell className={cn("text-xs font-bold text-right font-mono", isReversal ? "text-emerald-600" : "text-destructive")}>
                              {isReversal
                                ? `+PKR ${Math.abs(Number(log.amount || 0)).toLocaleString()}`
                                : `-PKR ${Math.abs(Number(log.amount || 0)).toLocaleString()}`}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono text-muted-foreground">
                              {log.balanceAfterSource !== null && log.balanceAfterSource !== undefined
                                ? `PKR ${Number(log.balanceAfterSource).toLocaleString()}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.performedByName || log.performedBy?.name || 'System'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {log.description || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button size="sm" variant="outline" onClick={() => setWalletDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Breakdown Modal for Selected Wallet Payroll Log */}
      <Dialog open={!!selectedPayrollBreakdown} onOpenChange={() => setSelectedPayrollBreakdown(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disbursement Staff Breakdown</DialogTitle>
            <DialogDescription>
              {selectedPayrollBreakdown && (
                <>
                  Month: {selectedPayrollBreakdown.payrollMonth} | Account: {selectedWalletForDetail?.name} | Total: PKR {Number(selectedPayrollBreakdown.amount || 0).toLocaleString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPayrollBreakdown && (
            <div className="space-y-3 py-2">
              <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursed Date:</span>
                  <span className="font-medium">{new Date(selectedPayrollBreakdown.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursed By:</span>
                  <span className="font-medium">{selectedPayrollBreakdown.performedBy?.name || "Admin"}</span>
                </div>
                {selectedPayrollBreakdown.referenceNo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference / Cheque:</span>
                    <span className="font-mono">{selectedPayrollBreakdown.referenceNo}</span>
                  </div>
                )}
                {selectedPayrollBreakdown.remarks && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remarks:</span>
                    <span>{selectedPayrollBreakdown.remarks}</span>
                  </div>
                )}
              </div>

              <div className="max-h-60 overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Staff Name</TableHead>
                      <TableHead className="text-xs">Designation</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedPayrollBreakdown.staffDetails || []).map((s, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{s.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.designation || "—"}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">
                          PKR {Number(s.amount || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setSelectedPayrollBreakdown(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
