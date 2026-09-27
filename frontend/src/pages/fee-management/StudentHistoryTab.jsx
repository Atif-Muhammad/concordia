import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  searchStudents,
  getAcademicSessions,
  getStudentInstallments,
  getPrograms,
  getClasses,
} from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatAmount } from "./feeFinancialUtils";
import {
  History,
  ChevronsUpDown,
  Check,
  Clock,
  Lock,
  SlidersHorizontal,
  X,
  Receipt,
  FileText,
  AlertCircle,
  Calendar,
} from "lucide-react";

export const StudentHistoryTab = () => {
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [historySessionFilter, setHistorySessionFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  const searchTimeoutRef = useRef(null);

  const { data: academicSessions = [] } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: getAcademicSessions,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: getPrograms,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const { data: studentInstallments = [], isLoading: isInstallmentsLoading } = useQuery({
    queryKey: ['studentInstallments', selectedStudent?.id],
    queryFn: () => getStudentInstallments(selectedStudent?.id),
    enabled: !!selectedStudent?.id,
  });

  const handleStudentSearch = (query) => {
    if (!query) {
      setStudentSearchResults([]);
      return;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchStudents(query);
        setStudentSearchResults(results || []);
      } catch (error) {
        console.error(error);
      }
    }, 300);
  };

  const getAcademicPath = (student = {}) => {
    const classObj =
      student.class ||
      student.studentClass ||
      classes.find((c) => Number(c.id) === Number(student.classId));
    const program =
      student.program ||
      student.studentProgram ||
      classObj?.program ||
      programs.find((p) => Number(p.id) === Number(student.programId));
    const section =
      student.section ||
      student.studentSection ||
      classObj?.sections?.find((s) => Number(s.id) === Number(student.sectionId));
    const parts = [
      program?.name || student.programName,
      classObj?.name || student.className,
      section?.name || student.sectionName,
    ].filter(Boolean);
    return parts.length ? parts.join(" / ") : "-";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString();
    } catch {
      return String(dateStr);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return String(dateStr);
    }
  };

  const getInstallmentHeaderBg = (status) => {
    switch (status) {
      case 'PAID':
      case 'SETTLED':
        return 'bg-emerald-50/70 border-emerald-200 text-emerald-950';
      case 'PARTIAL':
        return 'bg-amber-50/70 border-amber-200 text-amber-950';
      default:
        return 'bg-muted/30 border-b text-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Student Fee History
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Search for a student to view their complete fee installment history.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Search Student</Label>
              <Popover open={studentSearchOpen} onOpenChange={setStudentSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-sm">
                    {selectedStudent
                      ? `${selectedStudent.fName} ${selectedStudent.lName || ''} (${selectedStudent.rollNumber})`
                      : "Search by name or roll number..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type name or roll number..."
                      onValueChange={handleStudentSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No students found.</CommandEmpty>
                      <CommandGroup>
                        {studentSearchResults.map((student) => (
                          <CommandItem
                            key={student.id}
                            value={student.id.toString()}
                            onSelect={() => {
                              setSelectedStudent(student);
                              setStudentSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedStudent?.id === student.id ? "opacity-100" : "opacity-0")} />
                            {student.rollNumber} — {student.fName} {student.lName || ''}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {selectedStudent && (
              <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)}>
                Clear
              </Button>
            )}
          </div>

          {selectedStudent && (
            <div className="mt-4 p-3 rounded-lg bg-muted/40 border text-sm flex flex-wrap gap-4">
              <span><span className="font-medium">Name:</span> {selectedStudent.fName} {selectedStudent.lName || ''}</span>
              <span><span className="font-medium">Roll No:</span> {selectedStudent.rollNumber}</span>
              <span><span className="font-medium">Program / Class / Section:</span> {getAcademicPath(selectedStudent)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base">Fee Installments</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-8 gap-1.5 text-xs ${
                        historySessionFilter !== "all" || historyStatusFilter !== "all"
                          ? "border-primary text-primary"
                          : ""
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Filters
                      {(historySessionFilter !== "all" || historyStatusFilter !== "all") && (
                        <span className="ml-0.5 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                          {[historySessionFilter !== "all" ? 1 : 0, historyStatusFilter !== "all" ? 1 : 0].reduce((a, b) => a + b, 0)}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-4 max-h-[80vh] overflow-y-auto" align="end" side="bottom" sideOffset={4}>
                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Filters</p>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Session</Label>
                        <Select value={historySessionFilter} onValueChange={setHistorySessionFilter}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="All Sessions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sessions</SelectItem>
                            {(academicSessions || []).map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            { value: "PENDING", label: "Pending" },
                            { value: "PARTIAL", label: "Partial" },
                            { value: "PAID", label: "Paid" },
                            { value: "OVERDUE", label: "Overdue" },
                            { value: "VOID", label: "Void" },
                            { value: "SUPERSEDED", label: "Superseded" },
                            { value: "SETTLED", label: "Settled" },
                          ].map(({ value, label }) => (
                            <label key={value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                              <input
                                type="radio"
                                name="historyStatus"
                                className="h-3.5 w-3.5 accent-primary"
                                checked={historyStatusFilter === value}
                                onChange={() => setHistoryStatusFilter(value)}
                              />
                              {label}
                            </label>
                          ))}
                          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm col-span-2">
                            <input
                              type="radio"
                              name="historyStatus"
                              className="h-3.5 w-3.5 accent-primary"
                              checked={historyStatusFilter === "all"}
                              onChange={() => setHistoryStatusFilter("all")}
                            />
                            All Statuses
                          </label>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-muted-foreground text-xs"
                        onClick={() => {
                          setHistorySessionFilter("all");
                          setHistoryStatusFilter("all");
                        }}
                      >
                        <X className="w-3 h-3 mr-1" /> Reset filters
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {historySessionFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                    {academicSessions.find(s => String(s.id) === historySessionFilter)?.name || "Session"}
                    <button onClick={() => setHistorySessionFilter("all")}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {historyStatusFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                    {historyStatusFilter.charAt(0) + historyStatusFilter.slice(1).toLowerCase()}
                    <button onClick={() => setHistoryStatusFilter("all")}><X className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isInstallmentsLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Loading installments...
              </div>
            ) : (() => {
              const installmentsList = Array.isArray(studentInstallments)
                ? studentInstallments
                : (studentInstallments?.data || []);

              const filtered = installmentsList.filter((inst) => {
                const sessionMatch = historySessionFilter === "all" || String(inst.sessionId) === historySessionFilter;
                const statusMatch = historyStatusFilter === "all" || inst.status === historyStatusFilter;
                return sessionMatch && statusMatch;
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No installments found{historySessionFilter !== "all" || historyStatusFilter !== "all" ? " for the selected filters" : ""}.
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {filtered.map((inst, instIdx) => (
                    <div key={inst.id || instIdx} className="border rounded-lg overflow-hidden shadow-xs bg-white">
                      {/* LEVEL 1: Installment Header Bar */}
                      <div className={cn("px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 items-center text-sm border-b", getInstallmentHeaderBg(inst.status))}>
                        <span className="font-bold text-base">
                          {typeof inst.installmentNumber === 'number' ? `Installment #${inst.installmentNumber}` : inst.installmentNumber}
                        </span>
                        {inst.month && (
                          <span className="font-medium text-slate-600 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 opacity-70" />
                            {inst.month}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-semibold",
                            inst.status === "PAID" && "bg-green-100 text-green-800 border-green-300",
                            inst.status === "SETTLED" && "bg-blue-100 text-blue-800 border-blue-300",
                            inst.status === "PARTIAL" && "bg-amber-100 text-amber-800 border-amber-300",
                            inst.status === "PENDING" && "bg-orange-50 text-orange-700 border-orange-300",
                            inst.status === "OVERDUE" && "bg-red-50 text-red-700 border-red-300",
                            inst.status === "VOID" && "bg-slate-100 text-slate-600 border-slate-300",
                            inst.status === "SUPERSEDED" && "bg-slate-100 text-slate-600 border-slate-300"
                          )}
                        >
                          {inst.status}
                        </Badge>
                        {inst.challanGenerated && (
                          <Badge variant="secondary" className="text-xs bg-white/80 border text-slate-700">
                            Challan Generated
                          </Badge>
                        )}
                        {inst.isLocked && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                        {inst.dueDate && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            Due Date: {formatDate(inst.dueDate)}
                          </span>
                        )}
                      </div>

                      {/* LEVEL 1: Installment Financial Summary Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50 border-b text-slate-700">
                              <th className="text-left px-4 py-2 font-semibold">Base Payable</th>
                              <th className="text-left px-4 py-2 font-semibold">Arrears</th>
                              <th className="text-left px-4 py-2 font-semibold">Late Fee Fine</th>
                              <th className="text-left px-4 py-2 font-semibold">Discount</th>
                              <th className="text-left px-4 py-2 font-semibold bg-slate-100 text-slate-900">Total Amount</th>
                              <th className="text-left px-4 py-2 font-semibold bg-green-50 text-green-800">Paid Amount</th>
                              <th className="text-left px-4 py-2 font-semibold bg-orange-50 text-orange-800">Pending Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b last:border-0">
                              <td className="px-4 py-2.5 font-medium">{formatAmount(inst.basePayable)}</td>
                              <td className="px-4 py-2.5">
                                {Number(inst.arrears) > 0 ? (
                                  <span className="text-orange-600 font-semibold">{formatAmount(inst.arrears)}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {Number(inst.lateFeeFine) > 0 ? (
                                  <span className="text-red-600 font-semibold">{formatAmount(inst.lateFeeFine)}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {Number(inst.discount) !== 0 ? (
                                  <span className="text-blue-600 font-semibold">{formatAmount(inst.discount)}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-900 bg-slate-50">{formatAmount(inst.totalAmount)}</td>
                              <td className="px-4 py-2.5 font-bold text-green-700 bg-green-50/50">
                                <div>{formatAmount(inst.paidAmount)}</div>
                                {Number(inst.settledViaArrearsAmount) > 0 && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                      Settled via Arrears: {formatAmount(inst.settledViaArrearsAmount)}
                                      {inst.settledByChallanNo ? ` (via ${inst.settledByChallanNo})` : ''}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className={cn("px-4 py-2.5 font-bold bg-orange-50/40", Number(inst.pendingAmount) > 0 ? "text-orange-600" : "text-green-600")}>
                                {formatAmount(inst.pendingAmount)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* LEVEL 2 & 3: Linked Challans and their Payment Transactions */}
                      {Array.isArray(inst.challans) && inst.challans.length > 0 ? (
                        <div className="border-t bg-slate-50/20">
                          <div className="px-4 py-2 bg-slate-100/80 border-b flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              Linked Challans &amp; Payment Transactions ({inst.challans.length})
                            </p>
                          </div>

                          <div className="p-3 space-y-4">
                            {inst.challans.map((challan, ci) => (
                              <div key={challan.id || ci} className="border rounded-md overflow-hidden bg-white shadow-xs">
                                {/* LEVEL 2: Challan Table */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-slate-100/90 border-b text-slate-700">
                                        <th className="text-left px-3 py-2 font-bold uppercase tracking-wider text-[11px]">Challan #</th>
                                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Generated Date</th>
                                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Due Date</th>
                                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Base</th>
                                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Arrears</th>
                                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Late Fee</th>
                                        <th className="text-left px-3 py-2 font-semibold text-foreground bg-slate-200/50">Total Due</th>
                                        <th className="text-left px-3 py-2 font-semibold text-green-700 bg-green-100/50">Received / Settled</th>
                                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="border-b">
                                        <td className="px-3 py-2.5 font-mono font-bold text-primary flex items-center gap-1.5">
                                          <FileText className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                          {challan.challanNumber || challan.challanNo}
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground">
                                          {formatDate(challan.generatedDate || challan.createdAt)}
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground">
                                          {formatDate(challan.dueDate)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          {formatAmount(challan.snapshotBaseAmount ?? challan.basePayable ?? 0)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          {Number(challan.snapshotArrearsAmount ?? challan.arrearsAmount) > 0 ? (
                                            <span className="text-orange-600 font-medium">
                                              {formatAmount(challan.snapshotArrearsAmount ?? challan.arrearsAmount)}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">0</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          {Number(challan.snapshotLateFee ?? challan.lateFeeAmount) > 0 ? (
                                            <span className="text-red-500 font-medium">
                                              {formatAmount(challan.snapshotLateFee ?? challan.lateFeeAmount)}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">0</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5 font-bold bg-slate-100/50">
                                          {formatAmount(challan.snapshotTotalDue ?? challan.totalAmount ?? 0)}
                                        </td>
                                        <td className="px-3 py-2.5 font-bold text-green-700 bg-green-50/50">
                                          <div>{formatAmount(challan.amountReceived ?? challan.paidAmount ?? 0)}</div>
                                          {Number(challan.settledViaArrearsAmount) > 0 && (
                                            <div className="mt-1">
                                              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                                Settled via Arrears: {formatAmount(challan.settledViaArrearsAmount)}
                                              </span>
                                            </div>
                                          )}
                                          {Number(challan.advanceApplied) > 0 && (
                                            <div className="mt-1">
                                              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                Adv Credit: {formatAmount(challan.advanceApplied)}
                                              </span>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex flex-col gap-1 items-start">
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "text-[11px] font-semibold",
                                                challan.status === "PAID" && "bg-green-50 border-green-400 text-green-700",
                                                challan.status === "PARTIAL" && "bg-yellow-50 border-yellow-400 text-yellow-700",
                                                challan.status === "PENDING" && "bg-orange-50 border-orange-400 text-orange-600",
                                                challan.status === "OVERDUE" && "bg-red-50 border-red-500 text-red-600",
                                                challan.status === "VOID" && "bg-slate-100 border-slate-300 text-slate-500",
                                                challan.status === "SUPERSEDED" && "bg-slate-100 border-slate-300 text-slate-500",
                                                challan.status === "SETTLED" && "bg-blue-50 border-blue-400 text-blue-600"
                                              )}
                                            >
                                              {challan.status}
                                            </Badge>
                                            {challan.settledByChallanNo && (
                                              <span className="text-[10px] text-purple-700 font-medium whitespace-nowrap">
                                                via {challan.settledByChallanNo}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>

                                {/* LEVEL 3: Fee Payment Transactions Table for this Challan */}
                                <div className="bg-slate-50/70 border-t p-2.5">
                                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Payment Transactions for Challan {challan.challanNumber || challan.challanNo}</span>
                                    <span className="text-[11px] font-normal text-muted-foreground">
                                      ({challan.transactions?.length || 0} recorded)
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto border rounded bg-white">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-muted/40 border-b text-[11px] text-muted-foreground">
                                          <th className="text-left px-3 py-2 font-semibold">Receipt #</th>
                                          <th className="text-left px-3 py-2 font-semibold">Date &amp; Time</th>
                                          <th className="text-left px-3 py-2 font-semibold">Payment Mode</th>
                                          <th className="text-left px-3 py-2 font-semibold">Account / Wallet</th>
                                          <th className="text-left px-3 py-2 font-semibold text-emerald-700">Amount Paid</th>
                                          <th className="text-left px-3 py-2 font-semibold">Itemized Allocation</th>
                                          <th className="text-left px-3 py-2 font-semibold">Recorded By</th>
                                          <th className="text-left px-3 py-2 font-semibold">Remarks</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Array.isArray(challan.transactions) && challan.transactions.length > 0 ? (
                                          challan.transactions.map((tx, ti) => (
                                            <tr key={tx.id || ti} className="border-b last:border-0 hover:bg-slate-50/50">
                                              <td className="px-3 py-2 font-mono font-medium text-slate-900">
                                                {tx.receiptNo || "—"}
                                              </td>
                                              <td className="px-3 py-2 text-muted-foreground">
                                                {formatDateTime(tx.paidDate)}
                                              </td>
                                              <td className="px-3 py-2">
                                                <Badge
                                                  variant="outline"
                                                  className={cn(
                                                    "text-[10px] py-0 font-normal",
                                                    tx.isArrearsSettlement && "bg-purple-50 text-purple-700 border-purple-200 font-medium"
                                                  )}
                                                >
                                                  {tx.paymentMode || "Cash"}
                                                </Badge>
                                              </td>
                                              <td className="px-3 py-2 text-slate-700">
                                                {tx.walletName || "—"}
                                              </td>
                                              <td className="px-3 py-2 font-bold text-emerald-600">
                                                PKR {formatAmount(tx.amountPaid)}
                                              </td>
                                              <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                  {Number(tx.allocatedToTuition) > 0 && (
                                                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                                      Tuition: {formatAmount(tx.allocatedToTuition)}
                                                    </span>
                                                  )}
                                                  {Number(tx.allocatedToArrears) > 0 && (
                                                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                      Arrears: {formatAmount(tx.allocatedToArrears)}
                                                    </span>
                                                  )}
                                                  {Number(tx.allocatedToLateFee) > 0 && (
                                                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                                      Late Fee: {formatAmount(tx.allocatedToLateFee)}
                                                    </span>
                                                  )}
                                                  {Number(tx.allocatedToHeads) > 0 && (
                                                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                                      Heads: {formatAmount(tx.allocatedToHeads)}
                                                    </span>
                                                  )}
                                                  {Number(tx.advanceCreditUsed) > 0 && (
                                                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                      Adv Credit: {formatAmount(tx.advanceCreditUsed)}
                                                    </span>
                                                  )}
                                                  {(Number(tx.settledViaArrears) > 0 || tx.isArrearsSettlement) && (
                                                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                                                      Settled via Arrears: {formatAmount(tx.settledViaArrears || tx.amountPaid)}
                                                      {tx.settledByChallanNo ? ` (via ${tx.settledByChallanNo})` : ""}
                                                    </span>
                                                  )}
                                                  {Number(tx.excessCredited) > 0 && (
                                                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                      Excess: {formatAmount(tx.excessCredited)}
                                                    </span>
                                                  )}
                                                  {!Number(tx.allocatedToTuition) &&
                                                    !Number(tx.allocatedToArrears) &&
                                                    !Number(tx.allocatedToLateFee) &&
                                                    !Number(tx.allocatedToHeads) &&
                                                    !Number(tx.advanceCreditUsed) &&
                                                    !Number(tx.excessCredited) &&
                                                    !Number(tx.settledViaArrears) &&
                                                    !tx.isArrearsSettlement && (
                                                      <span className="text-muted-foreground text-[11px] italic">Payment applied</span>
                                                    )}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 text-muted-foreground text-[11px]">
                                                {typeof tx.recordedBy === 'object' && tx.recordedBy?.name
                                                  ? `${tx.recordedBy.name}${tx.recordedBy.role ? ` (${tx.recordedBy.role})` : ''}`
                                                  : (tx.recordedBy || "System")}
                                              </td>
                                              <td className="px-3 py-2 text-muted-foreground text-[11px] max-w-[150px] truncate" title={tx.remarks}>
                                                {tx.remarks || "—"}
                                              </td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={8} className="px-4 py-3 text-center text-xs text-muted-foreground italic bg-slate-50/40">
                                              {challan.status === "SETTLED" || Number(challan.settledViaArrearsAmount) > 0
                                                ? `This challan was settled via arrears${challan.settledByChallanNo ? ` in Challan ${challan.settledByChallanNo}` : ''} (${formatAmount(challan.settledViaArrearsAmount)}).`
                                                : `No payment transactions recorded for this challan (Status: ${challan.status}).`}
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-muted/15 border-t text-xs text-muted-foreground italic flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/70" />
                          No challan has been generated yet for this installment.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
