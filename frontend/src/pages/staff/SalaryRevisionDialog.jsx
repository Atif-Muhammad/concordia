import React, { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    TrendingUp,
    TrendingDown,
    Calendar,
    Loader2,
    History,
    ArrowUpRight,
    ArrowDownRight,
    Coins,
    User,
    CheckCircle2,
    DollarSign,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import { getStaffSalaryHistoryAPI, reviseStaffSalaryAPI } from "../../../config/apis";

export default function SalaryRevisionDialog({ open, onOpenChange, staff }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { canUpdate } = usePermissions("Staff", "directory");

    const [revisionType, setRevisionType] = useState("INCREMENT");
    const [percentage, setPercentage] = useState("");
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
    const [remarks, setRemarks] = useState("");

    const staffId = staff?.id || staff?._id;

    const {
        data: historyData,
        isLoading: historyLoading,
        refetch: refetchHistory,
    } = useQuery({
        queryKey: ["staffSalaryHistory", staffId],
        queryFn: () => getStaffSalaryHistoryAPI(staffId),
        enabled: open && !!staffId,
    });

    const baseSalary = historyData?.baseSalary ?? staff?.baseSalary ?? staff?.basicPay ?? 0;
    const currentSalary = historyData?.currentSalary ?? staff?.basicPay ?? 0;
    const currentAbsentDeduction = historyData?.absentDeduction ?? staff?.absentDeduction ?? (currentSalary > 0 ? Math.round(currentSalary / 30) : 0);

    const percentageNum = parseFloat(percentage) || 0;
    const isPercentageValid = percentage !== "" && !isNaN(percentageNum) && percentageNum >= 0 && percentageNum <= 100;

    const preview = useMemo(() => {
        if (!isPercentageValid || percentageNum === 0) {
            return {
                changeAmount: 0,
                newSalary: currentSalary,
                newAbsentDeduction: currentSalary > 0 ? Math.round(currentSalary / 30) : 0,
            };
        }
        const change = Math.round((currentSalary * percentageNum) / 100);
        let updatedSalary = currentSalary;
        if (revisionType === "INCREMENT") {
            updatedSalary = currentSalary + change;
        } else {
            updatedSalary = Math.max(0, currentSalary - change);
        }
        return {
            changeAmount: change,
            newSalary: updatedSalary,
            newAbsentDeduction: updatedSalary > 0 ? Math.round(updatedSalary / 30) : 0,
        };
    }, [currentSalary, percentageNum, isPercentageValid, revisionType]);

    const revisionMutation = useMutation({
        mutationFn: (payload) => reviseStaffSalaryAPI(staffId, payload),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ["staff"] });
            queryClient.invalidateQueries({ queryKey: ["teachers"] });
            queryClient.invalidateQueries({ queryKey: ["staffSalaryHistory", staffId] });
            toast({
                title: "Salary Revision Applied",
                description: res?.message || `Salary successfully updated to PKR ${preview.newSalary.toLocaleString()}`,
            });
            setPercentage("");
            setRemarks("");
            refetchHistory();
        },
        onError: (err) => {
            toast({
                title: "Failed to Apply Salary Revision",
                description: err?.message || "An unexpected error occurred",
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!isPercentageValid || percentageNum <= 0) {
            toast({
                title: "Invalid Percentage",
                description: "Please enter a valid percentage between 0 and 100.",
                variant: "destructive",
            });
            return;
        }

        revisionMutation.mutate({
            type: revisionType,
            percentage: percentageNum,
            effectiveDate,
            remarks: remarks.trim(),
        });
    };

    const formatDate = (d) => {
        if (!d) return "-";
        try {
            return new Date(d).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
            });
        } catch {
            return String(d).slice(0, 10);
        }
    };

    const historyList = historyData?.salaryHistory || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Coins className="w-5 h-5 text-emerald-600" />
                        Salary Revision (Increment / Decrement)
                    </DialogTitle>
                    <DialogDescription>
                        Manage salary increments or decrements for <span className="font-semibold text-foreground">{staff?.name}</span> ({staff?.staffId || "No Staff ID"}). Absent deductions are auto-calculated at <span className="font-semibold text-foreground">New Salary / 30</span>.
                    </DialogDescription>
                </DialogHeader>

                {/* Staff Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
                    <div className="p-3 rounded-lg border bg-muted/30">
                        <span className="text-xs text-muted-foreground block">Join Date</span>
                        <span className="text-sm font-semibold flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            {formatDate(staff?.joinDate || historyData?.joinDate)}
                        </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/30">
                        <span className="text-xs text-muted-foreground block">Base Salary</span>
                        <span className="text-sm font-semibold text-foreground block mt-0.5">
                            PKR {Number(baseSalary).toLocaleString()}
                        </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/30">
                        <span className="text-xs text-muted-foreground block">Current Salary</span>
                        <span className="text-sm font-bold text-primary block mt-0.5">
                            PKR {Number(currentSalary).toLocaleString()}
                        </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/30">
                        <span className="text-xs text-muted-foreground block">Current Absent Fine</span>
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 block mt-0.5">
                            PKR {Number(currentAbsentDeduction).toLocaleString()} / day
                        </span>
                    </div>
                </div>

                {/* Revision Form */}
                {canUpdate && (
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <Card className="border border-border/80 shadow-sm">
                            <CardContent className="pt-4 space-y-4">
                                <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                                    <DollarSign className="w-4 h-4 text-emerald-600" />
                                    Apply New Revision
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <Label className="text-xs">Action Type</Label>
                                        <Select value={revisionType} onValueChange={setRevisionType}>
                                            <SelectTrigger className="mt-1 h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INCREMENT">
                                                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                                        <TrendingUp className="w-4 h-4" />
                                                        Increment (+)
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="DECREMENT">
                                                    <div className="flex items-center gap-1.5 text-rose-600 font-medium">
                                                        <TrendingDown className="w-4 h-4" />
                                                        Decrement (-)
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label className="text-xs">Percentage (0 - 100%)</Label>
                                        <div className="relative mt-1">
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                placeholder="e.g. 10"
                                                value={percentage}
                                                onChange={(e) => setPercentage(e.target.value)}
                                                className="h-9 pr-8"
                                                required
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                                                %
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-xs">Effective Date</Label>
                                        <Input
                                            type="date"
                                            value={effectiveDate}
                                            onChange={(e) => setEffectiveDate(e.target.value)}
                                            className="mt-1 h-9"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs">Reason / Remarks (Optional)</Label>
                                    <Input
                                        type="text"
                                        placeholder="e.g. Annual performance review, promotion increment..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        className="mt-1 h-9"
                                    />
                                </div>

                                {/* Live Calculation Preview Callout */}
                                <div className={`p-3 rounded-lg border transition-all ${
                                    revisionType === "INCREMENT"
                                        ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                                        : "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800"
                                }`}>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            {revisionType === "INCREMENT" ? (
                                                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                                            ) : (
                                                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                                            )}
                                            Live Calculation Preview
                                        </span>
                                        {isPercentageValid && percentageNum > 0 && (
                                            <Badge variant="outline" className={
                                                revisionType === "INCREMENT"
                                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200"
                                                    : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/60 dark:text-rose-200"
                                            }>
                                                {revisionType === "INCREMENT" ? `+${percentageNum}%` : `-${percentageNum}%`}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-muted-foreground block">Previous Salary</span>
                                            <span className="font-semibold text-sm">PKR {currentSalary.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">
                                                {revisionType === "INCREMENT" ? "Increment Amount" : "Decrement Amount"}
                                            </span>
                                            <span className={`font-semibold text-sm ${revisionType === "INCREMENT" ? "text-emerald-600" : "text-rose-600"}`}>
                                                {revisionType === "INCREMENT" ? "+" : "-"}PKR {preview.changeAmount.toLocaleString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">Projected New Salary</span>
                                            <span className="font-bold text-sm text-primary">PKR {preview.newSalary.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">New Absent Fine / Day</span>
                                            <span className="font-semibold text-sm text-amber-600 dark:text-amber-400">
                                                PKR {preview.newAbsentDeduction.toLocaleString()}
                                                <span className="text-[10px] text-muted-foreground font-normal ml-1">(/30)</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="submit"
                                        disabled={revisionMutation.isPending || !isPercentageValid || percentageNum <= 0}
                                        className={
                                            revisionType === "INCREMENT"
                                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                : "bg-rose-600 hover:bg-rose-700 text-white"
                                        }
                                    >
                                        {revisionMutation.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Applying {revisionType === "INCREMENT" ? "Increment" : "Decrement"}...
                                            </>
                                        ) : (
                                            <>
                                                {revisionType === "INCREMENT" ? (
                                                    <TrendingUp className="w-4 h-4 mr-1.5" />
                                                ) : (
                                                    <TrendingDown className="w-4 h-4 mr-1.5" />
                                                )}
                                                Apply {revisionType === "INCREMENT" ? "Increment" : "Decrement"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>
                )}

                {/* Salary Revision History */}
                <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                            <History className="w-4 h-4 text-primary" />
                            Salary Revision History
                        </h4>
                        <span className="text-xs text-muted-foreground">
                            {historyList.length} revision{historyList.length === 1 ? "" : "s"} recorded
                        </span>
                    </div>

                    {historyLoading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : historyList.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg bg-muted/10 text-muted-foreground text-xs">
                            <Coins className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="font-medium">No salary revisions recorded yet.</p>
                            <p className="text-[11px] mt-1">First revision will use the base salary of PKR {Number(baseSalary).toLocaleString()}.</p>
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 text-xs">
                                        <TableHead className="py-2 px-3 text-xs">Date</TableHead>
                                        <TableHead className="py-2 px-3 text-xs">Type</TableHead>
                                        <TableHead className="py-2 px-3 text-xs text-right">Prev Salary</TableHead>
                                        <TableHead className="py-2 px-3 text-xs text-right">%</TableHead>
                                        <TableHead className="py-2 px-3 text-xs text-right">Change</TableHead>
                                        <TableHead className="py-2 px-3 text-xs text-right">New Salary</TableHead>
                                        <TableHead className="py-2 px-3 text-xs text-right">Absent Fine</TableHead>
                                        <TableHead className="py-2 px-3 text-xs">Remarks</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historyList.map((entry, idx) => {
                                        const isInc = entry.type === "INCREMENT";
                                        return (
                                            <TableRow key={entry._id || idx} className="text-xs">
                                                <TableCell className="py-2 px-3 font-medium whitespace-nowrap">
                                                    {formatDate(entry.effectiveDate || entry.createdAt)}
                                                </TableCell>
                                                <TableCell className="py-2 px-3">
                                                    <Badge
                                                        className={
                                                            isInc
                                                                ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                                                                : "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300"
                                                        }
                                                    >
                                                        {isInc ? (
                                                            <ArrowUpRight className="w-3 h-3 mr-0.5 inline" />
                                                        ) : (
                                                            <ArrowDownRight className="w-3 h-3 mr-0.5 inline" />
                                                        )}
                                                        {entry.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-right">
                                                    PKR {Number(entry.previousSalary || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-right font-semibold">
                                                    {entry.percentage}%
                                                </TableCell>
                                                <TableCell className={`py-2 px-3 text-right font-medium ${isInc ? "text-emerald-600" : "text-rose-600"}`}>
                                                    {isInc ? "+" : "-"}PKR {Math.abs(Number(entry.amountChanged || 0)).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-right font-bold text-primary">
                                                    PKR {Number(entry.newSalary || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-right text-amber-600 dark:text-amber-400 font-medium">
                                                    PKR {Number(entry.dailyAbsentDeduction || Math.round(Number(entry.newSalary || 0) / 30)).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 px-3 text-muted-foreground max-w-[150px] truncate" title={entry.remarks || ""}>
                                                    {entry.remarks || "-"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
