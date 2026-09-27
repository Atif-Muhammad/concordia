import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  ModernChartCard,
  ModernTooltip,
  MODERN_CHART_COLORS,
} from "@/components/ui/modern-charts";
import {
  getHrLeavesReport,
  getHrPayrollReport,
  getHrAdvanceReport,
  getHrStaffAttendanceReport,
  getHrDepartmentsReport,
  getHrReportsAnalytics,
  getAllStaff,
  getPayrollSheet,
  getDepartments,
} from "@/services/api";

const formatPayrollMonthLabel = (value) => {
  if (!value || typeof value !== "string") return "";
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return value;
  return format(new Date(y, m - 1, 1), "MMM yyyy");
};

const getPayrollAdjustedMeta = (advance) => {
  if (advance?.adjustedSource === "PAYROLL") {
    const events = Array.isArray(advance?.actionAudit) ? advance.actionAudit : [];
    const payrollEvent = [...events].reverse().find((e) => e?.action === "ADJUSTED_IN_PAYROLL");
    return {
      by: payrollEvent?.byName || "System",
      month: payrollEvent?.month || advance?.month,
      at: payrollEvent?.at ? new Date(payrollEvent.at).toLocaleString() : "",
    };
  }
  if (advance?.adjustedSource === "MANUAL") return null;
  const events = Array.isArray(advance?.actionAudit) ? advance.actionAudit : [];
  const payrollEvent = [...events].reverse().find((e) => e?.action === "ADJUSTED_IN_PAYROLL");
  if (!payrollEvent) return null;
  return {
    by: payrollEvent.byName || "System",
    month: payrollEvent.month || advance?.month,
    at: payrollEvent.at ? new Date(payrollEvent.at).toLocaleString() : "",
  };
};

export const ReportsTab = () => {
  const [reportsMonth, setReportsMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportsDate, setReportsDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: reportsLeaves = [], isFetching: reportsLeavesLoading } = useQuery({
    queryKey: ["hrReportsLeaves", reportsMonth],
    queryFn: () => getHrLeavesReport(reportsMonth),
  });

  const { data: reportsPayroll = [], isFetching: reportsPayrollLoading } = useQuery({
    queryKey: ["hrReportsPayroll", reportsMonth],
    queryFn: () => getHrPayrollReport(reportsMonth),
  });

  const { data: reportsAdvance = [], isFetching: reportsAdvanceLoading } = useQuery({
    queryKey: ["hrReportsAdvance", reportsMonth],
    queryFn: () => getHrAdvanceReport(reportsMonth),
  });

  const { data: reportsStaffAttendance = [], isFetching: reportsStaffAttendanceLoading } = useQuery({
    queryKey: ["hrReportsStaffAttendance", reportsDate],
    queryFn: () => getHrStaffAttendanceReport(reportsDate),
  });

  const { data: reportsDepartments = [], isFetching: reportsDepartmentsLoading } = useQuery({
    queryKey: ["hrReportsDepartments"],
    queryFn: getHrDepartmentsReport,
  });

  const { data: reportsAnalytics } = useQuery({
    queryKey: ["hrReportsAnalytics", reportsMonth, reportsDate],
    queryFn: () => getHrReportsAnalytics(reportsMonth, reportsDate),
    retry: 0,
  });

  const { data: allStaffData = [] } = useQuery({
    queryKey: ["allStaffStats"],
    queryFn: () => getAllStaff({ status: "ACTIVE" }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const { data: payrollSummaryData = [] } = useQuery({
    queryKey: ["payrollSummary", reportsMonth],
    queryFn: () => getPayrollSheet(reportsMonth, "all"),
  });

  const staffStats = useMemo(() => {
    const total = allStaffData.length;
    const teaching = allStaffData.filter((s) => s.isTeaching && !s.isNonTeaching).length;
    const nonTeaching = allStaffData.filter((s) => !s.isTeaching && s.isNonTeaching).length;
    const dual = allStaffData.filter((s) => s.isTeaching && s.isNonTeaching).length;
    return { total, teaching, nonTeaching, dual };
  }, [allStaffData]);

  const payrollSummary = useMemo(() => {
    const total = payrollSummaryData.reduce((s, p) => s + (p.netSalary || 0), 0);
    const paid = payrollSummaryData.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.netSalary || 0), 0);
    const unpaid = total - paid;
    const totalDeductions = payrollSummaryData.reduce((s, p) => s + (p.totalDeductions || 0), 0);
    const totalAllowances = payrollSummaryData.reduce((s, p) => s + (p.totalAllowances || 0), 0);
    const totalBasic = payrollSummaryData.reduce((s, p) => s + (p.basicSalary || 0), 0);
    return { total, paid, unpaid, totalDeductions, totalAllowances, totalBasic };
  }, [payrollSummaryData]);

  const reportsSummary = useMemo(() => {
    const leavesPending = reportsLeaves.filter((l) => l.status === "PENDING").length;
    const payrollPaid = reportsPayroll.filter((p) => p.status === "PAID").length;
    const payrollTotal = reportsPayroll.length;
    const advancePending = reportsAdvance.filter((a) => !a.adjusted).length;
    const attendanceMarked = reportsStaffAttendance.filter((s) => !!s.attendance?.[0]?.markedAt).length;
    return { leavesPending, payrollPaid, payrollTotal, advancePending, attendanceMarked };
  }, [reportsLeaves, reportsPayroll, reportsAdvance, reportsStaffAttendance]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>HR Reports</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Unified reports for leaves, payroll, advance salary, attendance, and departments.
              </p>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="space-y-1">
                <Label>Report Month</Label>
                <Input
                  type="month"
                  className="w-[160px]"
                  value={reportsMonth}
                  onChange={(e) => setReportsMonth(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Attendance Date</Label>
                <Input
                  type="date"
                  className="w-[160px]"
                  value={reportsDate}
                  onChange={(e) => setReportsDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ModernChartCard title="Leave Status" subtitle="Monthly distribution" empty={!reportsAnalytics?.leaveStatus?.length}>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reportsAnalytics?.leaveStatus || []} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78}>
                      {(reportsAnalytics?.leaveStatus || []).map((item, i) => (
                        <Cell key={`${item.name}-${i}`} fill={[MODERN_CHART_COLORS.warning, MODERN_CHART_COLORS.success, MODERN_CHART_COLORS.danger][i % 3]} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<ModernTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ModernChartCard>
            <ModernChartCard title="Payroll Settlement" subtitle="Paid vs unpaid" empty={!reportsAnalytics?.payrollStatus?.length}>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportsAnalytics?.payrollStatus || []}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip content={<ModernTooltip />} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {(reportsAnalytics?.payrollStatus || []).map((item, i) => (
                        <Cell key={`${item.name}-${i}`} fill={item.name === "PAID" ? MODERN_CHART_COLORS.success : MODERN_CHART_COLORS.warning} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ModernChartCard>
            <ModernChartCard title="Department Staff Mix" subtitle="Active staff count by department" empty={!reportsAnalytics?.departmentDistribution?.length}>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportsAnalytics?.departmentDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={52} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip content={<ModernTooltip />} />
                    <Bar dataKey="value" fill={MODERN_CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ModernChartCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pending Leaves</p><p className="text-2xl font-bold">{reportsSummary.leavesPending}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Payroll Paid</p><p className="text-2xl font-bold">{reportsSummary.payrollPaid}/{reportsSummary.payrollTotal}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pending Advances</p><p className="text-2xl font-bold">{reportsSummary.advancePending}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Attendance Marked</p><p className="text-2xl font-bold">{reportsSummary.attendanceMarked}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Departments</p><p className="text-2xl font-bold">{reportsDepartments.length}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Leaves Report</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Type</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {reportsLeavesLoading ? <TableRow><TableCell colSpan={4} className="text-center py-6">Loading...</TableCell></TableRow> : reportsLeaves.slice(0, 8).map((row, idx) => (
                        <TableRow key={`${row.leaveId ?? row.id}-${idx}`}>
                          <TableCell className="text-sm">{row.name}</TableCell>
                          <TableCell className="text-sm">{row.leaveType || "-"}</TableCell>
                          <TableCell className="text-sm">{row.days ?? "-"}</TableCell>
                          <TableCell className="text-sm"><Badge variant={row.status === "APPROVED" ? "default" : row.status === "REJECTED" ? "destructive" : "secondary"}>{row.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {!reportsLeavesLoading && reportsLeaves.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No leave records for selected month</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Payroll Report</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Monthly Payroll</p><p className="text-lg font-semibold">PKR {Math.round(payrollSummary.total).toLocaleString()}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Basic</p><p className="text-lg font-semibold">PKR {Math.round(payrollSummary.totalBasic).toLocaleString()}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Allowances</p><p className="text-lg font-semibold text-green-600">PKR {Math.round(payrollSummary.totalAllowances).toLocaleString()}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Deductions</p><p className="text-lg font-semibold text-red-600">PKR {Math.round(payrollSummary.totalDeductions).toLocaleString()}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Paid / Unpaid</p><p className="text-lg font-semibold">{Math.round(payrollSummary.paid).toLocaleString()} / {Math.round(payrollSummary.unpaid).toLocaleString()}</p></CardContent></Card>
                </div>
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Net Salary</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {reportsPayrollLoading ? <TableRow><TableCell colSpan={3} className="text-center py-6">Loading...</TableCell></TableRow> : reportsPayroll.slice(0, 8).map((row, idx) => (
                        <TableRow key={`${row.id}-${idx}`}>
                          <TableCell className="text-sm">{row.name || row.staffName || "N/A"}</TableCell>
                          <TableCell className="text-sm font-medium">PKR {Number(row.netSalary || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-sm"><Badge variant={row.status === "PAID" ? "default" : "outline"}>{row.status || "UNPAID"}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {!reportsPayrollLoading && reportsPayroll.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No payroll records for selected month</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Advance Salary Report</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Amount</TableHead><TableHead>Adjusted</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {reportsAdvanceLoading ? <TableRow><TableCell colSpan={3} className="text-center py-6">Loading...</TableCell></TableRow> : reportsAdvance.slice(0, 8).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm">{row.staff?.name || "N/A"}</TableCell>
                          <TableCell className="text-sm font-medium">PKR {Number(row.amount || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-sm">
                            {row.adjusted ? (
                              <div className="space-y-1">
                                <Badge variant="default">Adjusted</Badge>
                                {getPayrollAdjustedMeta(row) && (
                                  <Badge variant="outline">Via payroll ({formatPayrollMonthLabel(getPayrollAdjustedMeta(row).month)})</Badge>
                                )}
                              </div>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!reportsAdvanceLoading && reportsAdvance.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No advance records for selected month</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Staff Attendance Report</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Staff</p><p className="text-xl font-semibold">{staffStats.total}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Teaching</p><p className="text-xl font-semibold">{staffStats.teaching}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Non-Teaching</p><p className="text-xl font-semibold">{staffStats.nonTeaching}</p></CardContent></Card>
                </div>
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Status</TableHead><TableHead>Marked At</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {reportsStaffAttendanceLoading ? <TableRow><TableCell colSpan={3} className="text-center py-6">Loading...</TableCell></TableRow> : reportsStaffAttendance.slice(0, 8).map((row) => {
                        const att = row.attendance?.[0];
                        const status = att?.status?.toLowerCase();
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="text-sm">{row.name}</TableCell>
                            <TableCell className="text-sm">
                              {status ? <Badge variant={status === "present" ? "default" : status === "absent" ? "destructive" : "secondary"}>{status.toUpperCase()}</Badge> : <span className="text-muted-foreground">Not Marked</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{att?.markedAt ? new Date(att.markedAt).toLocaleString() : "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                      {!reportsStaffAttendanceLoading && reportsStaffAttendance.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No staff records for selected date</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Departments Report</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Departments</p><p className="text-xl font-semibold">{departments.length}</p></CardContent></Card>
              </div>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>Department</TableHead><TableHead>Head</TableHead><TableHead>Staff Count</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reportsDepartmentsLoading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6">Loading...</TableCell></TableRow>
                    ) : reportsDepartments.map((dept) => (
                      <TableRow key={dept.id}>
                        <TableCell className="text-sm font-medium">{dept.name}</TableCell>
                        <TableCell className="text-sm">{dept.hodName}</TableCell>
                        <TableCell className="text-sm">{dept.staffCount}</TableCell>
                      </TableRow>
                    ))}
                    {!reportsDepartmentsLoading && reportsDepartments.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No departments found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};
