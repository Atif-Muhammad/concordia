import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ModernChartCard,
  ModernTooltip,
  MODERN_CHART_COLORS,
} from "@/components/ui/modern-charts";
import { Search, Loader2 } from "lucide-react";
import {
  getHostelRevenue,
  getHostelReportsAnalytics,
  getHostelExpenses,
  getRooms,
} from "@/services/api";

export const RevenueReportsTab = () => {
  const [revenueFromDate, setRevenueFromDate] = useState("");
  const [revenueToDate, setRevenueToDate] = useState("");
  const [revenueSearch, setRevenueSearch] = useState("");
  const [revenueSort, setRevenueSort] = useState({ col: 'name', dir: 'asc' });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['hostelRevenue', revenueFromDate, revenueToDate],
    queryFn: () => {
      if (!revenueFromDate && !revenueToDate) return getHostelRevenue();
      return getHostelRevenue({
        ...(revenueFromDate ? { startDate: revenueFromDate } : {}),
        ...(revenueToDate ? { endDate: revenueToDate } : {}),
      });
    },
    staleTime: 60000,
  });

  const { data: revenueAnalytics } = useQuery({
    queryKey: ['hostelRevenueAnalytics', revenueFromDate, revenueToDate],
    queryFn: () =>
      getHostelReportsAnalytics({
        ...(revenueFromDate ? { startDate: revenueFromDate } : {}),
        ...(revenueToDate ? { endDate: revenueToDate } : {}),
        groupBy: 'month',
      }),
    retry: 0,
  });

  const { data: reportExpenses = [] } = useQuery({
    queryKey: ['hostelReportExpenses', revenueFromDate, revenueToDate],
    queryFn: () => {
      if (!revenueFromDate && !revenueToDate) return getHostelExpenses();
      return getHostelExpenses({
        ...(revenueFromDate ? { startDate: revenueFromDate } : {}),
        ...(revenueToDate ? { endDate: revenueToDate } : {}),
      });
    },
    staleTime: 60000,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });

  const roomOccupancyData = useMemo(() => [
    {
      name: "Occupied",
      value: rooms.reduce((acc, room) => acc + (room.currentOccupancy || 0), 0),
    },
    {
      name: "Vacant",
      value: rooms.reduce((acc, room) => acc + (room.capacity - (room.currentOccupancy || 0)), 0),
    },
  ], [rooms]);

  const expensesOverTimeData = useMemo(() => {
    const data = {};
    reportExpenses.forEach((expense) => {
      const date = new Date(expense.date);
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      if (!data[monthYear]) data[monthYear] = 0;
      data[monthYear] += expense.amount;
    });
    return Object.entries(data).map(([name, amount]) => ({ name, amount }));
  }, [reportExpenses]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:ml-auto">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={revenueFromDate}
              onChange={(e) => setRevenueFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={revenueToDate}
              onChange={(e) => setRevenueToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {revenueLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Total Collected</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  PKR {Math.round(revenueData?.totalCollected ?? 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Total Outstanding</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">
                  PKR {Math.round(revenueData?.totalOutstanding ?? 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModernChartCard title="Room Occupancy (Seats)" subtitle="Live seat utilization">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={
                      revenueAnalytics?.occupancy
                        ? [
                            { name: "Occupied", value: revenueAnalytics.occupancy.occupied },
                            { name: "Vacant", value: revenueAnalytics.occupancy.vacant },
                          ]
                        : roomOccupancyData
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    dataKey="value"
                  >
                    <Cell fill={MODERN_CHART_COLORS.primary} />
                    <Cell fill={MODERN_CHART_COLORS.slate} />
                  </Pie>
                  <RechartsTooltip content={<ModernTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </ModernChartCard>
            <ModernChartCard title="Expenses Over Time" subtitle="Trend by selected range">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(revenueAnalytics?.expensesSeries || expensesOverTimeData).map((x) => ({ name: x.bucket || x.name, amount: x.amount }))}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<ModernTooltip valueFormatter={(v) => `PKR ${Number(v || 0).toLocaleString()}`} />} />
                  <Bar dataKey="amount" fill={MODERN_CHART_COLORS.warning} radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ModernChartCard>
          </div>

          <Card>
            <CardHeader><CardTitle>Monthly Collection</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const chartData = (revenueAnalytics?.collectionSeries || revenueData?.monthlyBreakdown || []).map((m) => ({
                  month: m.month,
                  collected: m.collected,
                }));

                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fontSize: 11 }} />
                      <RechartsTooltip content={<ModernTooltip valueFormatter={(v) => `PKR ${Number(v || 0).toLocaleString()}`} />} />
                      <Bar dataKey="collected" fill={MODERN_CHART_COLORS.success} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per-Student Breakdown</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or registration ID..."
                  value={revenueSearch}
                  onChange={(e) => setRevenueSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      {[
                        { col: 'name', label: 'Student Name' },
                        { col: 'registrationId', label: 'Registration ID' },
                        { col: 'totalBilled', label: 'Total Billed' },
                        { col: 'totalPaid', label: 'Total Paid' },
                        { col: 'outstanding', label: 'Outstanding' },
                      ].map(({ col, label }) => (
                        <TableHead
                          key={col}
                          className="py-2 px-3 text-xs font-semibold cursor-pointer select-none hover:bg-accent"
                          onClick={() => setRevenueSort((s) => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })}
                        >
                          {label} {revenueSort.col === col ? (revenueSort.dir === 'asc' ? '↑' : '↓') : ''}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const rows = (revenueData?.perStudent || [])
                        .filter((row) => {
                          if (!revenueSearch) return true;
                          const q = revenueSearch.toLowerCase();
                          return (row.name || '').toLowerCase().includes(q) || (row.registrationId || '').toLowerCase().includes(q);
                        })
                        .sort((a, b) => {
                          const { col, dir } = revenueSort;
                          let av = a[col] ?? '';
                          let bv = b[col] ?? '';
                          if (typeof av === 'string') av = av.toLowerCase();
                          if (typeof bv === 'string') bv = bv.toLowerCase();
                          if (av < bv) return dir === 'asc' ? -1 : 1;
                          if (av > bv) return dir === 'asc' ? 1 : -1;
                          return 0;
                        });
                      if (rows.length === 0) return (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No data available.</TableCell></TableRow>
                      );
                      return rows.map((row, idx) => {
                        const outstanding = Math.round(row.outstanding ?? 0);
                        return (
                          <TableRow key={row.registrationId} className={idx % 2 === 1 ? 'bg-muted/20' : ''}>
                            <TableCell className="py-2 px-3 text-sm font-medium">{row.name}</TableCell>
                            <TableCell className="py-2 px-3 text-sm font-mono text-xs">{row.registrationId}</TableCell>
                            <TableCell className="py-2 px-3 text-sm">PKR {Math.round(row.totalBilled ?? 0).toLocaleString()}</TableCell>
                            <TableCell className="py-2 px-3 text-sm text-green-600 font-semibold">PKR {Math.round(row.totalPaid ?? 0).toLocaleString()}</TableCell>
                            <TableCell className={`py-2 px-3 text-sm font-semibold ${outstanding > 0 ? "text-orange-600" : "text-green-600"}`}>
                              PKR {outstanding.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
