import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAcademicSessions,
  getRevenueOverTime,
  getClassCollectionStats,
  getNewRevenueOverTime,
  getNewClassStats,
  getNewFeeReportsAnalytics,
} from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { ModernTooltip } from "@/components/ui/modern-charts";
import { SlidersHorizontal, X } from "lucide-react";

export const FeeReportsTab = () => {
  const [reportFilter, setReportFilter] = useState('month');
  const [reportSessionFilter, setReportSessionFilter] = useState('all');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');

  const { data: academicSessions = [] } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: getAcademicSessions,
  });

  const { data: revenueData = [] } = useQuery({
    queryKey: ['revenueOverTime', reportFilter],
    queryFn: () => getRevenueOverTime({ period: reportFilter }),
  });

  const { data: classCollectionData = [] } = useQuery({
    queryKey: ['classCollectionStats', reportFilter],
    queryFn: () => getClassCollectionStats({ period: reportFilter }),
  });

  const { data: newRevenueOverTime = [] } = useQuery({
    queryKey: ['newRevenueOverTime', reportSessionFilter],
    queryFn: () => getNewRevenueOverTime(reportSessionFilter),
  });

  const { data: newClassStats = [] } = useQuery({
    queryKey: ['newClassStats', reportSessionFilter],
    queryFn: () => getNewClassStats(reportSessionFilter),
  });

  const { data: newFeeAnalytics } = useQuery({
    queryKey: ['newFeeAnalytics', reportSessionFilter, reportTypeFilter, reportDateFrom, reportDateTo, reportFilter],
    queryFn: () =>
      getNewFeeReportsAnalytics({
        sessionId: reportSessionFilter,
        type: reportTypeFilter,
        dateFrom: reportDateFrom || undefined,
        dateTo: reportDateTo || undefined,
        groupBy: reportFilter === 'daily' ? 'day' : reportFilter === 'weekly' ? 'week' : reportFilter === 'year' ? 'year' : 'month',
      }),
    retry: 0,
  });

  const sessionList = Array.isArray(academicSessions)
    ? academicSessions
    : Array.isArray(academicSessions?.data)
    ? academicSessions.data
    : [];

  const getClassChartLabel = (row = {}) => {
    const parts = [row.programName, row.className || row.name].filter(Boolean);
    return parts.length ? parts.join(" / ") : row.name || row.className || "-";
  };

  const rawTimeline = Array.isArray(newFeeAnalytics?.timeline) && newFeeAnalytics.timeline.length > 0
    ? newFeeAnalytics.timeline
    : Array.isArray(newRevenueOverTime) && newRevenueOverTime.length > 0
    ? newRevenueOverTime
    : Array.isArray(revenueData) && revenueData.length > 0
    ? revenueData
    : [];
  const timelineData = rawTimeline;

  const rawChartData = Array.isArray(newFeeAnalytics?.classComparison) && newFeeAnalytics.classComparison.length > 0
    ? newFeeAnalytics.classComparison
    : Array.isArray(newClassStats) && newClassStats.length > 0
    ? newClassStats
    : Array.isArray(classCollectionData) && classCollectionData.length > 0
    ? classCollectionData
    : [];
  const chartData = rawChartData.map((row) => ({
    ...row,
    name: getClassChartLabel(row),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 text-xs ${
                reportSessionFilter !== "all" || reportFilter !== "month" || reportTypeFilter !== "all" || reportDateFrom || reportDateTo
                  ? "border-primary text-primary"
                  : ""
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {(reportSessionFilter !== "all" || reportFilter !== "month" || reportTypeFilter !== "all" || reportDateFrom || reportDateTo) && (
                <span className="ml-0.5 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                  {[reportSessionFilter !== "all" ? 1 : 0, reportFilter !== "month" ? 1 : 0, reportTypeFilter !== "all" ? 1 : 0, (reportDateFrom || reportDateTo) ? 1 : 0].reduce((a, b) => a + b, 0)}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-4 max-h-[80vh] overflow-y-auto" align="end" side="bottom" sideOffset={4}>
            <div className="space-y-4">
              <p className="text-sm font-semibold">Report Filters</p>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">From</Label>
                    <Input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">To</Label>
                    <Input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Session</Label>
                <Select value={reportSessionFilter} onValueChange={setReportSessionFilter}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All Sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {sessionList.map(s => {
                      const val = (s.id || s._id || '').toString();
                      return (
                        <SelectItem key={val || Math.random()} value={val}>{s.name || s.sessionName}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Period</Label>
                <Select value={reportFilter} onValueChange={setReportFilter}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (Last 30 Days)</SelectItem>
                    <SelectItem value="weekly">Weekly (Last 12 Weeks)</SelectItem>
                    <SelectItem value="month">Monthly (Last 12 Months)</SelectItem>
                    <SelectItem value="year">Yearly (Last 5 Years)</SelectItem>
                    <SelectItem value="overall">Overall</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fee Type</Label>
                <div className="space-y-1">
                  {[
                    { value: "all", label: "All (Installment + Extra)" },
                    { value: "installment", label: "Installment Fee Only" },
                    { value: "extra", label: "Extra Challans Only" },
                  ].map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="reportType"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={reportTypeFilter === value}
                        onChange={() => setReportTypeFilter(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-muted-foreground text-xs"
                onClick={() => { setReportSessionFilter("all"); setReportFilter("month"); setReportTypeFilter("all"); setReportDateFrom(""); setReportDateTo(""); }}
              >
                <X className="w-3 h-3 mr-1" /> Reset filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {reportSessionFilter !== "all" && (
          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
            {sessionList.find(s => (s.id || s._id)?.toString() === reportSessionFilter)?.name || "Session"}
            <button onClick={() => setReportSessionFilter("all")}><X className="w-3 h-3" /></button>
          </span>
        )}
        {reportFilter !== "month" && (
          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
            {reportFilter.charAt(0).toUpperCase() + reportFilter.slice(1)}
            <button onClick={() => setReportFilter("month")}><X className="w-3 h-3" /></button>
          </span>
        )}
        {reportTypeFilter !== "all" && (
          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
            {reportTypeFilter === "installment" ? "Installment Fee" : "Extra Challans"}
            <button onClick={() => setReportTypeFilter("all")}><X className="w-3 h-3" /></button>
          </span>
        )}
        {(reportDateFrom || reportDateTo) && (
          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
            {reportDateFrom && reportDateTo ? `${reportDateFrom} → ${reportDateTo}` : reportDateFrom ? `From ${reportDateFrom}` : `To ${reportDateTo}`}
            <button onClick={() => { setReportDateFrom(""); setReportDateTo(""); }}><X className="w-3 h-3" /></button>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Revenue Over Time */}
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Over Time</CardTitle>
            <p className="text-xs text-muted-foreground">Last 24 months — installment fee vs extra challans</p>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                >
                  <defs>
                    <linearGradient id="colorInst" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExtra" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    tickFormatter={(v) => {
                      if (!v || typeof v !== 'string' || !v.includes('-')) return v || '';
                      const [yr, mo] = v.split('-');
                      const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo, 10) - 1];
                      return monthShort ? `${monthShort} ${yr.slice(2)}` : v;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                    width={45}
                  />
                  <RechartsTooltip content={<ModernTooltip valueFormatter={(v) => `PKR ${Number(v || 0).toLocaleString()}`} />} />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    formatter={(v) => v === 'installment' ? 'Installment Fee' : v === 'extra' ? 'Extra Challans' : 'Total'}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  {(timelineData[0]?.installment !== undefined) ? (
                    <>
                      <Area type="monotone" dataKey="installment" name="installment" stroke="#6366f1" strokeWidth={2} fill="url(#colorInst)" dot={false} activeDot={{ r: 4 }} />
                      <Area type="monotone" dataKey="extra" name="extra" stroke="#f59e0b" strokeWidth={2} fill="url(#colorExtra)" dot={false} activeDot={{ r: 4 }} />
                    </>
                  ) : (
                    <Area type="monotone" dataKey="value" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#colorInst)" dot={false} activeDot={{ r: 4 }} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Collection vs Outstanding Per Class */}
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Collection vs Outstanding (Per Class)</CardTitle>
            <p className="text-xs text-muted-foreground">Collected amount vs pending outstanding per class</p>
          </CardHeader>
          <CardContent>
            {(() => {
              if (!chartData || chartData.length === 0) {
                return (
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                    No class data available
                  </div>
                );
              }
              const barH = Math.max(28, Math.min(40, 320 / chartData.length));
              const chartH = Math.max(320, chartData.length * (barH + 12) + 60);
              return (
                <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
                  <div style={{ height: chartH }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={120}
                          tick={{ fontSize: 11 }}
                          interval={0}
                        />
                        <RechartsTooltip
                          formatter={(value, name) => [`PKR ${Number(value).toLocaleString()}`, name === 'collected' ? 'Collected' : 'Outstanding']}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={28}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                        <Bar dataKey="collected" name="Collected" fill="#4ade80" radius={[0, 4, 4, 0]} barSize={barH * 0.45} />
                        <Bar dataKey="outstanding" name="Outstanding" fill="#fb923c" radius={[0, 4, 4, 0]} barSize={barH * 0.45} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
