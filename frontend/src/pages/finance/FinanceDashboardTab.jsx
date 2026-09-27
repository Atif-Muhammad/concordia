import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from "recharts";
import {
  Info,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Wallet,
  Calendar,
  Layers,
} from "lucide-react";
import {
  getFinanceIncomes,
  getFinanceExpenses,
  getFinanceLedger,
  getWallets,
} from "../../../config/apis";

// Helper to format date as YYYY-MM-DD in local time
const toLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const incomeColors = {
  "Tuition Fee": "hsl(var(--primary))",
  "Extra Challan": "#22c55e",
  "Hostel Challan": "#06b6d4",
  Donation: "#10b981",
  Funding: "#3b82f6",
  Revenue: "#f59e0b",
  Investments: "#8b5cf6",
};

const expenseColors = {
  Bills: "#ef4444",
  Payroll: "#3b82f6",
  Operations: "#0ea5e9",
  Academic: "#22c55e",
  StudentWelfare: "#a855f7",
  Compliance: "#f59e0b",
  Miscellaneous: "#6b7280",
  Inventory: "#f97316",
  "Utility Bills": "#ef4444",
  Salaries: "#3b82f6",
  Hostel: "#8b5cf6",
  Maintenance: "#10b981",
  Supplies: "#f59e0b",
  Other: "#6b7280",
};

export default function FinanceDashboardTab() {
  const [dashboardPeriod, setDashboardPeriod] = useState("monthly");
  const [dashboardDateFrom, setDashboardDateFrom] = useState("");
  const [dashboardDateTo, setDashboardDateTo] = useState("");
  const [appliedDashboardFilter, setAppliedDashboardFilter] = useState({
    dateFrom: "",
    dateTo: "",
  });

  // Filters for detailed in-between financial changes ledger
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("all");
  const [ledgerWalletFilter, setLedgerWalletFilter] = useState("all");
  const [ledgerSearch, setLedgerSearch] = useState("");

  const getDashboardDateRange = () => {
    if (appliedDashboardFilter.dateFrom || appliedDashboardFilter.dateTo) {
      return {
        dateFrom: appliedDashboardFilter.dateFrom || "",
        dateTo: appliedDashboardFilter.dateTo || "",
      };
    }
    const now = new Date();
    let dateFrom, dateTo;

    if (dashboardPeriod === "weekly") {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateTo = now;
    } else if (dashboardPeriod === "monthly") {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (dashboardPeriod === "yearly") {
      dateFrom = new Date(now.getFullYear(), 0, 1);
      dateTo = new Date(now.getFullYear(), 11, 31);
    } else {
      dateFrom = new Date(now.getFullYear() - 4, 0, 1);
      dateTo = new Date(now.getFullYear(), 11, 31);
    }

    return {
      dateFrom: toLocalDateString(dateFrom),
      dateTo: toLocalDateString(dateTo),
    };
  };

  const dashboardDateRange = getDashboardDateRange();

  // Fetch wallets for filter dropdowns
  const { data: walletsResponse } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
  });
  const activeWallets = (
    walletsResponse?.wallets ||
    walletsResponse?.data ||
    (Array.isArray(walletsResponse) ? walletsResponse : [])
  ).filter((w) => w.status === "ACTIVE");

  // Fetch income data
  const { data: dashboardIncomeData = [] } = useQuery({
    queryKey: [
      "dashboardIncome",
      dashboardDateRange.dateFrom,
      dashboardDateRange.dateTo,
      dashboardPeriod,
    ],
    queryFn: () =>
      getFinanceIncomes({
        dateFrom: dashboardDateRange.dateFrom,
        dateTo: dashboardDateRange.dateTo,
      }),
  });

  // Fetch expense data
  const { data: dashboardExpenseData = [] } = useQuery({
    queryKey: [
      "dashboardExpense",
      dashboardDateRange.dateFrom,
      dashboardDateRange.dateTo,
      dashboardPeriod,
    ],
    queryFn: () =>
      getFinanceExpenses({
        dateFrom: dashboardDateRange.dateFrom,
        dateTo: dashboardDateRange.dateTo,
      }),
  });

  // Fetch combined in-between financial changes ledger
  const { data: ledgerResponse, isLoading: isLedgerLoading } = useQuery({
    queryKey: [
      "financeLedger",
      dashboardDateRange.dateFrom,
      dashboardDateRange.dateTo,
      ledgerWalletFilter,
      ledgerTypeFilter,
    ],
    queryFn: () =>
      getFinanceLedger({
        dateFrom: dashboardDateRange.dateFrom,
        dateTo: dashboardDateRange.dateTo,
        walletId: ledgerWalletFilter,
        type: ledgerTypeFilter,
      }),
  });

  const rawLedger = ledgerResponse?.ledger || [];
  const ledgerStats = ledgerResponse?.stats || {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    totalRecords: 0,
  };

  const filteredLedger = useMemo(() => {
    if (!ledgerSearch.trim()) return rawLedger;
    const term = ledgerSearch.toLowerCase();
    return rawLedger.filter(
      (item) =>
        (item.description && item.description.toLowerCase().includes(term)) ||
        (item.category && item.category.toLowerCase().includes(term)) ||
        (item.subCategory && item.subCategory.toLowerCase().includes(term)) ||
        (item.walletName && item.walletName.toLowerCase().includes(term))
    );
  }, [rawLedger, ledgerSearch]);

  const totalIncome = useMemo(
    () => dashboardIncomeData.reduce((sum, item) => sum + Number(item.amount), 0),
    [dashboardIncomeData]
  );
  const totalExpense = useMemo(
    () => dashboardExpenseData.reduce((sum, item) => sum + Number(item.amount), 0),
    [dashboardExpenseData]
  );
  const netBalance = totalIncome - totalExpense;

  const getDateOnly = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return toLocalDateString(d);
  };

  const monthlyData = useMemo(() => {
    const rangeStart = dashboardDateRange.dateFrom ? new Date(dashboardDateRange.dateFrom) : null;
    const rangeEnd = dashboardDateRange.dateTo ? new Date(dashboardDateRange.dateTo) : null;
    const now = new Date();

    if (dashboardPeriod === "weekly") {
      const days = [];
      const end = rangeEnd || now;
      for (let i = 6; i >= 0; i--) {
        const date = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = toLocalDateString(date);
        const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });

        const dayIncome = dashboardIncomeData
          .filter((item) => getDateOnly(item.date) === dateStr)
          .reduce((sum, item) => sum + Number(item.amount), 0);
        const dayExpense = dashboardExpenseData
          .filter((item) => getDateOnly(item.date) === dateStr)
          .reduce((sum, item) => sum + Number(item.amount), 0);

        days.push({
          month: dayLabel,
          income: dayIncome,
          expense: dayExpense,
          balance: dayIncome - dayExpense,
        });
      }
      return days;
    } else if (dashboardPeriod === "overall") {
      const years = [];
      const currentYear = (rangeEnd || now).getFullYear();
      for (let i = 4; i >= 0; i--) {
        const year = currentYear - i;
        const yearIncome = dashboardIncomeData
          .filter((item) => getDateOnly(item.date).startsWith(`${year}-`))
          .reduce((sum, item) => sum + Number(item.amount), 0);
        const yearExpense = dashboardExpenseData
          .filter((item) => getDateOnly(item.date).startsWith(`${year}-`))
          .reduce((sum, item) => sum + Number(item.amount), 0);

        years.push({
          month: year.toString(),
          income: yearIncome,
          expense: yearExpense,
          balance: yearIncome - yearExpense,
        });
      }
      return years;
    } else if (dashboardPeriod === "monthly") {
      const days = [];
      const start = rangeStart || new Date(now.getFullYear(), now.getMonth(), 1);
      const end = rangeEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const cursor = new Date(start);
      while (cursor <= end) {
        const dateStr = toLocalDateString(cursor);
        const dayLabel = String(cursor.getDate());

        const dayIncome = dashboardIncomeData
          .filter((item) => getDateOnly(item.date) === dateStr)
          .reduce((sum, item) => sum + Number(item.amount), 0);
        const dayExpense = dashboardExpenseData
          .filter((item) => getDateOnly(item.date) === dateStr)
          .reduce((sum, item) => sum + Number(item.amount), 0);

        days.push({
          month: dayLabel,
          income: dayIncome,
          expense: dayExpense,
          balance: dayIncome - dayExpense,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    } else {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentYear = (rangeStart || now).getFullYear();
      return months.map((month, index) => {
        const monthNum = String(index + 1).padStart(2, "0");
        const monthPrefix = `${currentYear}-${monthNum}`;
        const monthIncome = dashboardIncomeData
          .filter((item) => getDateOnly(item.date).startsWith(monthPrefix))
          .reduce((sum, item) => sum + Number(item.amount), 0);
        const monthExpense = dashboardExpenseData
          .filter((item) => getDateOnly(item.date).startsWith(monthPrefix))
          .reduce((sum, item) => sum + Number(item.amount), 0);

        return {
          month,
          income: monthIncome,
          expense: monthExpense,
          balance: monthIncome - monthExpense,
        };
      });
    }
  }, [
    dashboardIncomeData,
    dashboardExpenseData,
    dashboardPeriod,
    dashboardDateRange.dateFrom,
    dashboardDateRange.dateTo,
  ]);

  const stackedChartData = useMemo(() => {
    const getDateKey = (date, period) => {
      const d = new Date(date);
      if (period === "weekly" || period === "monthly") return toLocalDateString(d);
      if (period === "yearly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return d.getFullYear().toString();
    };

    const getLabel = (dateStr, period) => {
      if (period === "weekly" || period === "monthly") {
        const d = new Date(dateStr);
        if (period === "weekly") return d.toLocaleDateString("en-US", { weekday: "short" });
        return d.getDate().toString();
      }
      if (period === "yearly") {
        const [, m] = dateStr.split("-");
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[parseInt(m) - 1];
      }
      return dateStr;
    };

    let periods = [];
    const now = new Date();
    const rangeStart = dashboardDateRange.dateFrom ? new Date(dashboardDateRange.dateFrom) : null;
    const rangeEnd = dashboardDateRange.dateTo ? new Date(dashboardDateRange.dateTo) : null;

    if (dashboardPeriod === "weekly") {
      const end = rangeEnd || now;
      for (let i = 6; i >= 0; i--) {
        const d = new Date(end.getTime() - i * 86400000);
        periods.push(getDateKey(d, "weekly"));
      }
    } else if (dashboardPeriod === "monthly") {
      const start = rangeStart || new Date(now.getFullYear(), now.getMonth(), 1);
      const end = rangeEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const cursor = new Date(start);
      while (cursor <= end) {
        periods.push(toLocalDateString(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (dashboardPeriod === "yearly") {
      const baseYear = (rangeStart || now).getFullYear();
      for (let i = 0; i < 12; i++) {
        periods.push(`${baseYear}-${String(i + 1).padStart(2, "0")}`);
      }
    } else {
      const currentYear = (rangeEnd || now).getFullYear();
      for (let i = 4; i >= 0; i--) {
        periods.push((currentYear - i).toString());
      }
    }

    const data = periods.map((p) => ({
      name: getLabel(p, dashboardPeriod),
      "Tuition Fee": 0,
      "Extra Challan": 0,
      "Hostel Challan": 0,
      Donation: 0,
      Funding: 0,
      Revenue: 0,
      Investments: 0,
      Bills: 0,
      Payroll: 0,
      Operations: 0,
      Maintenance: 0,
      Academic: 0,
      StudentWelfare: 0,
      Hostel: 0,
      Compliance: 0,
      Miscellaneous: 0,
      Inventory: 0,
      Salaries: 0,
      "Utility Bills": 0,
      Supplies: 0,
      Other: 0,
    }));

    const fillData = (sourceData) => {
      sourceData.forEach((item) => {
        let itemKey;
        try {
          if (dashboardPeriod === "weekly" || dashboardPeriod === "monthly") {
            itemKey = getDateOnly(item.date);
          } else if (dashboardPeriod === "yearly") {
            itemKey = getDateOnly(item.date).slice(0, 7);
          } else {
            itemKey = getDateOnly(item.date).slice(0, 4);
          }
        } catch {
          return;
        }

        const periodIndex = periods.indexOf(itemKey);
        if (periodIndex !== -1) {
          if (data[periodIndex][item.category] !== undefined) {
            data[periodIndex][item.category] += Number(item.amount);
          }
        }
      });
    };

    fillData(dashboardIncomeData);
    fillData(dashboardExpenseData);

    return data;
  }, [
    dashboardIncomeData,
    dashboardExpenseData,
    dashboardPeriod,
    dashboardDateRange.dateFrom,
    dashboardDateRange.dateTo,
  ]);

  return (
    <div className="space-y-6">
      {/* Date Filter & Period Selector Card */}
      <Card className="bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                Period:
              </span>
              <Button
                variant={dashboardPeriod === "weekly" && !appliedDashboardFilter.dateFrom ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDashboardPeriod("weekly");
                  setDashboardDateFrom("");
                  setDashboardDateTo("");
                  setAppliedDashboardFilter({ dateFrom: "", dateTo: "" });
                }}
              >
                7 Days
              </Button>
              <Button
                variant={dashboardPeriod === "monthly" && !appliedDashboardFilter.dateFrom ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDashboardPeriod("monthly");
                  setDashboardDateFrom("");
                  setDashboardDateTo("");
                  setAppliedDashboardFilter({ dateFrom: "", dateTo: "" });
                }}
              >
                This Month
              </Button>
              <Button
                variant={dashboardPeriod === "yearly" && !appliedDashboardFilter.dateFrom ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDashboardPeriod("yearly");
                  setDashboardDateFrom("");
                  setDashboardDateTo("");
                  setAppliedDashboardFilter({ dateFrom: "", dateTo: "" });
                }}
              >
                This Year
              </Button>
              <Button
                variant={dashboardPeriod === "overall" && !appliedDashboardFilter.dateFrom ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDashboardPeriod("overall");
                  setDashboardDateFrom("");
                  setDashboardDateTo("");
                  setAppliedDashboardFilter({ dateFrom: "", dateTo: "" });
                }}
              >
                Overall (5 Yrs)
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
              <div className="w-36">
                <Label className="text-xs text-muted-foreground">From Date</Label>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={dashboardDateFrom}
                  onChange={(e) => setDashboardDateFrom(e.target.value)}
                />
              </div>
              <div className="w-36">
                <Label className="text-xs text-muted-foreground">To Date</Label>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={dashboardDateTo}
                  onChange={(e) => setDashboardDateTo(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={() =>
                  setAppliedDashboardFilter({
                    dateFrom: dashboardDateFrom,
                    dateTo: dashboardDateTo,
                  })
                }
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDashboardDateFrom("");
                  setDashboardDateTo("");
                  setAppliedDashboardFilter({ dateFrom: "", dateTo: "" });
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Inflow (Income)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              PKR {totalIncome.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Between {dashboardDateRange.dateFrom || "all time"} and {dashboardDateRange.dateTo || "now"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Outflow (Expense)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              PKR {totalExpense.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Between {dashboardDateRange.dateFrom || "all time"} and {dashboardDateRange.dateTo || "now"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Financial Balance
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                netBalance >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              PKR {netBalance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Net Profit/Loss for the selected range
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* IN-BETWEEN FINANCIAL CHANGES DETAILED LEDGER TABLE           */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                In-Between Financial Changes Ledger
              </CardTitle>
              <CardDescription>
                Detailed chronological activity of all incomes and expenses recorded between{" "}
                <strong className="text-foreground">{dashboardDateRange.dateFrom || "Beginning"}</strong> and{" "}
                <strong className="text-foreground">{dashboardDateRange.dateTo || "Current"}</strong>.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {filteredLedger.length} Activities
              </Badge>
            </div>
          </div>

          {/* Table Filters: Search, Type, Wallet */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search description, category..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            <div>
              <Select value={ledgerTypeFilter} onValueChange={setLedgerTypeFilter}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All In-Between Types</SelectItem>
                  <SelectItem value="INCOME">Incomes Only (+)</SelectItem>
                  <SelectItem value="EXPENSE">Expenses Only (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={ledgerWalletFilter} onValueChange={setLedgerWalletFilter}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Filter by account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts / Wallets</SelectItem>
                  {activeWallets.map((w) => (
                    <SelectItem key={w.id || w._id} value={w.id || w._id}>
                      {w.accountName || w.name}{" "}
                      {w.accountNumber ? `(${w.accountNumber})` : `(${w.type})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3 text-sm">Date</TableHead>
                  <TableHead className="py-2.5 px-3 text-sm">Type</TableHead>
                  <TableHead className="py-2.5 px-3 text-sm">Category</TableHead>
                  <TableHead className="py-2.5 px-3 text-sm">Account / Wallet</TableHead>
                  <TableHead className="py-2.5 px-3 text-sm">Description</TableHead>
                  <TableHead className="py-2.5 px-3 text-sm text-right">Inflow (+)</TableHead>
                  <TableHead className="py-2.5 px-3 text-sm text-right">Outflow (-)</TableHead>
                  <TableHead className="py-2.5 px-3 text-sm">Audit / Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLedgerLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading financial changes ledger...
                    </TableCell>
                  </TableRow>
                ) : filteredLedger.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No financial changes found between {dashboardDateRange.dateFrom} and {dashboardDateRange.dateTo}.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLedger.map((item) => {
                    const isIncome = item.type === "INCOME";
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/40">
                        <TableCell className="py-2 px-3 text-sm whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          <Badge
                            variant={isIncome ? "default" : "destructive"}
                            className="font-semibold text-[11px]"
                          >
                            {isIncome ? "INCOME" : "EXPENSE"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm font-medium">
                          {item.category}
                          {item.subCategory && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({item.subCategory})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          {item.walletName ? (
                            <Badge variant="outline" className="font-normal bg-muted/40 text-xs">
                              {item.walletName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Unspecified</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm max-w-[280px] truncate" title={item.description}>
                          {item.description}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm text-right font-bold text-emerald-600 font-mono">
                          {isIncome ? `+ PKR ${Number(item.amount).toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm text-right font-bold text-rose-600 font-mono">
                          {!isIncome ? `- PKR ${Number(item.amount).toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {item.auditText || item.status || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Ledger Totals Footer */}
          <div className="mt-4 p-4 rounded-lg bg-muted/40 border grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Inflows In Range:</span>
              <span className="font-bold text-emerald-600 font-mono">
                + PKR {Number(ledgerStats.totalIncome).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center sm:border-l sm:pl-4">
              <span className="text-muted-foreground">Outflows In Range:</span>
              <span className="font-bold text-rose-600 font-mono">
                - PKR {Number(ledgerStats.totalExpense).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center sm:border-l sm:pl-4">
              <span className="text-muted-foreground font-semibold">Net In-Between Balance:</span>
              <span
                className={`font-bold font-mono text-base ${
                  ledgerStats.netBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                PKR {Number(ledgerStats.netBalance).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expense Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => value.toLocaleString()} />
                <RechartsTooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="hsl(var(--success))"
                  name="Income"
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke="hsl(var(--destructive))"
                  name="Expense"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Balance Trend
              <div className="group relative inline-block">
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 rounded-md bg-popover p-3 text-sm text-popover-foreground shadow-md border">
                  <p className="font-semibold mb-1">Net Profit/Loss Over Time</p>
                  <p className="text-xs">
                    Shows your financial health by calculating <strong>Income - Expenses</strong> for each period. Positive values (green) indicate profit, negative values indicate loss.
                  </p>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => value.toLocaleString()} />
                <RechartsTooltip />
                <Bar dataKey="balance" name="Balance">
                  {monthlyData?.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.balance >= 0
                          ? "hsl(var(--success))"
                          : "hsl(var(--destructive))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stackedChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => value.toLocaleString()} />
                <RechartsTooltip />
                <Legend />
                {Object.keys(incomeColors).map((key) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={incomeColors[key]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stackedChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => value.toLocaleString()} />
                <RechartsTooltip />
                <Legend />
                {Object.keys(expenseColors).map((key) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={expenseColors[key]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
