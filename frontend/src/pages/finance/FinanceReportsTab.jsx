import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ModernChartCard,
  ModernTooltip,
  ChartLegendPills,
  MODERN_CHART_COLORS,
} from "@/components/ui/modern-charts";
import {
  getFinanceIncomes,
  getFinanceExpenses,
  getFinanceReportsAnalytics,
} from "../../../config/apis";

export default function FinanceReportsTab() {
  const [reportsDateFrom, setReportsDateFrom] = useState("");
  const [reportsDateTo, setReportsDateTo] = useState("");
  const [appliedReportsFilter, setAppliedReportsFilter] = useState({
    dateFrom: "",
    dateTo: "",
  });

  const { data: reportsIncomeData = [] } = useQuery({
    queryKey: ["reportsIncome", appliedReportsFilter.dateFrom, appliedReportsFilter.dateTo],
    queryFn: () =>
      getFinanceIncomes({
        dateFrom: appliedReportsFilter.dateFrom,
        dateTo: appliedReportsFilter.dateTo,
      }),
  });

  const { data: reportsExpenseData = [] } = useQuery({
    queryKey: ["reportsExpense", appliedReportsFilter.dateFrom, appliedReportsFilter.dateTo],
    queryFn: () =>
      getFinanceExpenses({
        dateFrom: appliedReportsFilter.dateFrom,
        dateTo: appliedReportsFilter.dateTo,
      }),
  });

  const { data: reportsAnalytics } = useQuery({
    queryKey: [
      "financeReportsAnalytics",
      appliedReportsFilter.dateFrom,
      appliedReportsFilter.dateTo,
    ],
    queryFn: () =>
      getFinanceReportsAnalytics({
        dateFrom: appliedReportsFilter.dateFrom || undefined,
        dateTo: appliedReportsFilter.dateTo || undefined,
        groupBy: "month",
      }),
    retry: 0,
  });

  const reportsTotalIncome = useMemo(
    () => reportsIncomeData.reduce((sum, item) => sum + Number(item.amount), 0),
    [reportsIncomeData]
  );
  const reportsTotalExpense = useMemo(
    () => reportsExpenseData.reduce((sum, item) => sum + Number(item.amount), 0),
    [reportsExpenseData]
  );
  const reportsNetBalance = reportsTotalIncome - reportsTotalExpense;

  const reportsCategoryIncomeData = [
    {
      name: "Tuition Fee",
      amount: reportsIncomeData
        .filter((i) => i.category === "Tuition Fee" || i.category === "Fee")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    },
    {
      name: "Extra Challan",
      amount: reportsIncomeData
        .filter((i) => i.category === "Extra Challan" || i.category === "Extra Fee")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    },
    {
      name: "Hostel Challan",
      amount: reportsIncomeData
        .filter((i) => i.category === "Hostel Challan" || i.category === "Hostel Fee")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    },
    {
      name: "Donation",
      amount: reportsIncomeData
        .filter((i) => i.category === "Donation")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    },
    {
      name: "Funding",
      amount: reportsIncomeData
        .filter((i) => i.category === "Funding")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    },
    {
      name: "Revenue",
      amount: reportsIncomeData
        .filter((i) => i.category === "Revenue")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    },
    {
      name: "Investments",
      amount: reportsIncomeData
        .filter((i) => i.category === "Investments")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    },
  ];

  const reportsCategoryExpenseData = useMemo(() => {
    const grouped = reportsExpenseData.reduce((acc, item) => {
      const category = item?.category || "Other";
      const subCategory = item?.subCategory || "General";
      const key = `${category} > ${subCategory}`;
      acc[key] = (acc[key] || 0) + Number(item?.amount || 0);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [reportsExpenseData]);

  const reportsTrendData = useMemo(() => {
    if (reportsAnalytics?.timeseries?.length) {
      return reportsAnalytics.timeseries.map((row) => ({
        name: row.bucket,
        income: Number(row.income || 0),
        expense: Number(row.expense || 0),
        net: Number(row.net || 0),
      }));
    }
    const map = {};
    [...reportsIncomeData, ...reportsExpenseData].forEach((row) => {
      const d = new Date(row.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { name: key, income: 0, expense: 0, net: 0 };
      if (reportsIncomeData.includes(row)) map[key].income += Number(row.amount || 0);
      else map[key].expense += Number(row.amount || 0);
      map[key].net = map[key].income - map[key].expense;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [reportsAnalytics, reportsIncomeData, reportsExpenseData]);

  const reportsIncomePieData = useMemo(
    () =>
      (
        reportsAnalytics?.incomeByCategory ||
        reportsCategoryIncomeData.map((x) => ({ name: x.name, value: x.amount }))
      )
        .filter((x) => Number(x.value || x.amount || 0) > 0)
        .map((x) => ({ name: x.name, value: Number(x.value ?? x.amount ?? 0) })),
    [reportsAnalytics, reportsCategoryIncomeData]
  );

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <CardTitle className="text-base sm:text-lg">Financial Reports</CardTitle>
          <div className="flex flex-wrap gap-2 items-end w-full md:w-auto">
            <div className="flex-1 sm:flex-initial">
              <Label className="text-xs whitespace-nowrap">From</Label>
              <Input
                type="date"
                value={reportsDateFrom}
                onChange={(e) => setReportsDateFrom(e.target.value)}
                className="h-8 text-xs w-full sm:w-[140px]"
              />
            </div>
            <div className="flex-1 sm:flex-initial">
              <Label className="text-xs whitespace-nowrap">To</Label>
              <Input
                type="date"
                value={reportsDateTo}
                onChange={(e) => setReportsDateTo(e.target.value)}
                className="h-8 text-xs w-full sm:w-[140px]"
              />
            </div>
            <Button
              size="sm"
              className="h-8 text-xs px-3 w-full sm:w-auto"
              onClick={() =>
                setAppliedReportsFilter({
                  dateFrom: reportsDateFrom,
                  dateTo: reportsDateTo,
                })
              }
            >
              Apply Filter
            </Button>
            {(appliedReportsFilter.dateFrom || appliedReportsFilter.dateTo) && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs px-3 w-full sm:w-auto"
                onClick={() => {
                  setReportsDateFrom("");
                  setReportsDateTo("");
                  setAppliedReportsFilter({ dateFrom: "", dateTo: "" });
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ModernChartCard
            title="Income vs Expense Trend"
            subtitle="Filtered reporting period"
            empty={!reportsTrendData.length}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reportsTrendData}>
                  <defs>
                    <linearGradient id="finIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={MODERN_CHART_COLORS.success}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor={MODERN_CHART_COLORS.success}
                        stopOpacity={0.04}
                      />
                    </linearGradient>
                    <linearGradient id="finExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={MODERN_CHART_COLORS.danger}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor={MODERN_CHART_COLORS.danger}
                        stopOpacity={0.04}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    strokeOpacity={0.15}
                    vertical={false}
                  />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    content={
                      <ModernTooltip
                        valueFormatter={(v) => `PKR ${Number(v || 0).toLocaleString()}`}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke={MODERN_CHART_COLORS.success}
                    fill="url(#finIncomeGrad)"
                    strokeWidth={2.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke={MODERN_CHART_COLORS.danger}
                    fill="url(#finExpenseGrad)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ModernChartCard>
          <ModernChartCard
            title="Income Mix"
            subtitle="Category contribution"
            empty={!reportsIncomePieData.length}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportsIncomePieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={68}
                    outerRadius={98}
                    paddingAngle={3}
                  >
                    {reportsIncomePieData.map((item, index) => (
                      <Cell
                        key={`${item.name}-${index}`}
                        fill={
                          [
                            MODERN_CHART_COLORS.primary,
                            MODERN_CHART_COLORS.secondary,
                            MODERN_CHART_COLORS.success,
                            MODERN_CHART_COLORS.warning,
                            MODERN_CHART_COLORS.sky,
                            MODERN_CHART_COLORS.pink,
                          ][index % 6]
                        }
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    content={
                      <ModernTooltip
                        valueFormatter={(v) => `PKR ${Number(v || 0).toLocaleString()}`}
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ChartLegendPills
              items={reportsIncomePieData.slice(0, 6).map((x, i) => ({
                label: x.name,
                color: [
                  MODERN_CHART_COLORS.primary,
                  MODERN_CHART_COLORS.secondary,
                  MODERN_CHART_COLORS.success,
                  MODERN_CHART_COLORS.warning,
                  MODERN_CHART_COLORS.sky,
                  MODERN_CHART_COLORS.pink,
                ][i % 6],
              }))}
            />
          </ModernChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-4">Income Summary</h3>
            <div className="space-y-2">
              {reportsCategoryIncomeData.map((cat) => (
                <div key={cat.name} className="flex justify-between">
                  <span>{cat.name}:</span>
                  <span className="font-bold">
                    PKR {cat.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Income:</span>
                  <span className="text-success">
                    PKR {reportsTotalIncome.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-4">Expense Summary</h3>
            <div className="space-y-2">
              {reportsCategoryExpenseData.map((cat) => (
                <div key={cat.name} className="flex justify-between">
                  <span>{cat.name}:</span>
                  <span className="font-bold">
                    PKR {cat.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Expense:</span>
                  <span className="text-destructive">
                    PKR {reportsTotalExpense.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-muted">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-xl">Net Balance</h3>
            <span
              className={`font-bold text-2xl ${
                reportsNetBalance >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              PKR {reportsNetBalance.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
