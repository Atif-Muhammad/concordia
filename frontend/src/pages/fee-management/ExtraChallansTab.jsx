import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Layers,
  Plus,
  Edit,
  Trash2,
  Printer,
  Eye,
  Lock,
  Check,
  ChevronsUpDown,
  Calendar as CalendarIcon,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
import {
  getExtraChallansDedicated,
  updateExtraChallanDedicated,
  deleteExtraChallanDedicated,
  generateExtraChallan,
  bulkGenerateExtraChallans,
  getInstallmentPlans,
  searchStudents,
  getSections,
  getDefaultFeeChallanTemplate,
} from "@/services/api";
import {
  formatAmount,
  toWholePkrAmount,
  calculateLateFee,
  normalizeChallan,
  generateChallanHtml,
  applyPaidChallanPrintTreatment,
  htmlIncludesChallanNumber,
  setCachedTemplate,
  getCachedTemplate,
} from "./feeFinancialUtils";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { PaymentDialog } from "./PaymentDialog";
import { ChallanDetailsDialog } from "./ChallanDetailsDialog";
import usePermissions from "@/hooks/usePermissions";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

export const ExtraChallansTab = ({
  feeHeads = [],
  programs = [],
  classes = [],
  sections: sectionsProp,
  academicSessions = [],
  extraChallanLateFee = 0,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete, canPayFee } = usePermissions("Fee Management", "extra-challans");

  const { data: fetchedSections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: getSections,
    enabled: !sectionsProp || sectionsProp.length === 0,
  });
  const sections = (sectionsProp && sectionsProp.length > 0) ? sectionsProp : fetchedSections;

  // Extra Fee Challan Template Query
  const { data: extraTemplate } = useQuery({
    queryKey: ['feeChallanTemplate', 'EXTRA'],
    queryFn: async () => {
      const t = await getDefaultFeeChallanTemplate("EXTRA");
      if (t?.htmlContent) setCachedTemplate("EXTRA", t.htmlContent);
      return t;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Pagination & Filtering
  const [extraPage, setExtraPage] = useState(1);
  const [extraLimit] = useState(10);
  const [extraSearch, setExtraSearch] = useState("");
  const [extraStatusFilter, setExtraStatusFilter] = useState("all");

  // Dialog states
  const [createExtraChallanOpen, setCreateExtraChallanOpen] = useState(false);
  const [bulkExtraChallanOpen, setBulkExtraChallanOpen] = useState(false);
  const [editExtraChallanOpen, setEditExtraChallanOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Active items
  const [selectedChallanDetails, setSelectedChallanDetails] = useState(null);
  const [itemToPay, setItemToPay] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingChallan, setEditingChallan] = useState(null);
  const [printingChallanId, setPrintingChallanId] = useState(null);

  // Single Extra Challan Form State
  const [extraStudentSearchOpen, setExtraStudentSearchOpen] = useState(false);
  const [extraStudentResults, setExtraStudentResults] = useState([]);
  const [extraSelectedStudent, setExtraSelectedStudent] = useState(null);
  const [extraSelectedHeads, setExtraSelectedHeads] = useState([]);
  const [extraCustomHeads, setExtraCustomHeads] = useState([]);
  const [extraRemarks, setExtraRemarks] = useState("");
  const [extraDueDate, setExtraDueDate] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Bulk Extra Challan Form State
  const [bulkFilters, setBulkFilters] = useState({
    programId: "all",
    classId: "all",
    sectionId: "all",
  });
  const [bulkStudents, setBulkStudents] = useState([]);
  const [selectedBulkExtraStudents, setSelectedBulkExtraStudents] = useState([]);
  const [isFetchingBulkStudents, setIsFetchingBulkStudents] = useState(false);
  const [generateResults, setGenerateResults] = useState(null);

  // Edit Extra Challan Form State
  const [editForm, setEditForm] = useState({
    dueDate: null,
    remarks: "",
    selectedHeads: [],
    customHeads: [],
  });

  const searchTimeoutRef = useRef(null);

  const handleStudentSearch = (query, setResults) => {
    if (!query) {
      setResults([]);
      return;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchStudents(query);
        setResults(results);
      } catch (error) {
        console.error(error);
      }
    }, 300);
  };

  // Extra Challans Query
  const { data: extraChallansData = { data: [], meta: {} }, isLoading: isExtraLoading } = useQuery({
    queryKey: ['extraChallans', extraSearch, extraStatusFilter, extraPage, extraLimit],
    queryFn: () => {
      return getExtraChallansDedicated({
        search: extraSearch,
        status: extraStatusFilter,
        page: extraPage,
        limit: extraLimit,
      });
    },
    keepPreviousData: true,
  });

  const rawExtraList = Array.isArray(extraChallansData)
    ? extraChallansData
    : (Array.isArray(extraChallansData?.data) ? extraChallansData.data : []);
  const extraChallans = rawExtraList.map(item => normalizeChallan({ ...item, isExtra: true, type: 'EXTRA', challanType: 'FEE_HEADS_ONLY' }));
  const extraChallanMeta = extraChallansData?.meta || {
    total: rawExtraList.length,
    page: extraPage,
    limit: extraLimit,
    lastPage: Math.ceil(rawExtraList.length / extraLimit) || 1,
  };

  // Cascading Filter: Available Classes based on selected Program
  const availableClasses = classes.filter(c => {
    if (!bulkFilters.programId || bulkFilters.programId === "all") return true;
    return extractId(c.programId || c.program) === bulkFilters.programId;
  });

  // Selected Class details for section handling
  const selectedBulkClass = classes.find(c => extractId(c) === bulkFilters.classId);
  const isBulkClassSelected = bulkFilters.classId && bulkFilters.classId !== "all";
  const allowSectionsForBulkClass = isBulkClassSelected ? selectedBulkClass?.allowSections !== false : false;

  // Cascading Filter: Available Sections based on selected Class (only if class allows sections)
  const availableSections = (isBulkClassSelected && allowSectionsForBulkClass)
    ? sections.filter(s => extractId(s.classId || s.class) === bulkFilters.classId)
    : [];

  // Fetch Bulk Students
  useEffect(() => {
    if (!bulkExtraChallanOpen) return;
    setGenerateResults(null);

    const fetchStudents = async () => {
      setIsFetchingBulkStudents(true);
      try {
        const queryParams = {};
        if (bulkFilters.programId && bulkFilters.programId !== "all") {
          queryParams.programId = bulkFilters.programId;
        }
        if (bulkFilters.classId && bulkFilters.classId !== "all") {
          queryParams.classId = bulkFilters.classId;
        }
        if (bulkFilters.sectionId && bulkFilters.sectionId !== "all" && allowSectionsForBulkClass) {
          queryParams.sectionId = bulkFilters.sectionId;
        }

        const list = await getInstallmentPlans(queryParams);
        const mappedList = (list || []).map(s => {
          const sId = extractId(s);
          const progName = s.program?.name || (typeof s.programId === "object" && s.programId ? s.programId.name : "") || "";
          const clsName = s.class?.name || (typeof s.classId === "object" && s.classId ? s.classId.name : "") || "";
          const secName = s.section?.name || (typeof s.sectionId === "object" && s.sectionId ? s.sectionId.name : "") || "";
          return {
            ...s,
            id: sId,
            fName: s.fName || "",
            lName: s.lName || "",
            rollNumber: s.rollNumber || "",
            programName: progName,
            className: clsName,
            sectionName: secName,
          };
        });
        setBulkStudents(mappedList);
      } catch (err) {
        console.error("Failed to fetch bulk students:", err);
        setBulkStudents([]);
      } finally {
        setIsFetchingBulkStudents(false);
      }
    };

    fetchStudents();
  }, [bulkExtraChallanOpen, bulkFilters.programId, bulkFilters.classId, bulkFilters.sectionId, allowSectionsForBulkClass]);

  // Bulk Generate Mutation
  const bulkGenerateExtraChallansMutation = useMutation({
    mutationFn: bulkGenerateExtraChallans,
    onSuccess: (data) => {
      setIsGenerating(false);
      queryClient.invalidateQueries(['feeChallans']);
      queryClient.invalidateQueries(['extraChallans']);

      const results = Array.isArray(data) ? data : [];
      const createdCount = results.filter(r => r.status === 'CREATED').length;
      const failedCount = results.filter(r => r.status === 'FAILED').length;

      const mappedResults = results.map(r => ({
        id: r.id || r.challanId,
        studentId: r.studentId,
        studentName: r.studentName || `Student #${r.studentId}`,
        status: r.status,
        reason: r.error || '',
        challanNumber: r.challanNumber,
      }));

      setGenerateResults(mappedResults);

      if (failedCount > 0) {
        toast({
          title: `${createdCount} extra challan(s) generated`,
          description: `${failedCount} failed.`,
          variant: "destructive",
        });
      } else if (createdCount > 0) {
        toast({ title: `${createdCount} extra challan(s) generated successfully` });
      } else if (results.some(r => r.status === 'ALREADY_EXISTS')) {
        toast({ title: "Challans already exist", description: "Selected students already have these extra challans for the current month." });
      } else {
        toast({ title: "No new challans were generated" });
      }
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({ title: error.message || "Bulk generation failed", variant: "destructive" });
    },
  });

  // Delete Mutation
  const deleteExtraChallanMutation = useMutation({
    mutationFn: deleteExtraChallanDedicated,
    onSuccess: () => {
      queryClient.invalidateQueries(['extraChallans']);
      queryClient.invalidateQueries(['studentFeeHistory']);
      queryClient.invalidateQueries(['newFeeReportSummary']);
      queryClient.invalidateQueries(['feeCollectionSummary']);
      queryClient.invalidateQueries(['wallets']);
      queryClient.invalidateQueries(['walletHistory']);
      queryClient.invalidateQueries(['walletTuitionLogs']);
      toast({ title: "Extra Challan deleted successfully" });
      setDeleteDialogOpen(false);
    },
    onError: (error) => toast({ title: error.message || "Failed to delete challan", variant: "destructive" }),
  });

  // Update Mutation
  const updateExtraChallanMutation = useMutation({
    mutationFn: ({ id, data }) => updateExtraChallanDedicated(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['extraChallans']);
      queryClient.invalidateQueries(['studentFeeHistory']);
      toast({ title: "Extra Challan updated successfully" });
      setEditExtraChallanOpen(false);
      setEditingChallan(null);
    },
    onError: (error) => toast({ title: error.message || "Failed to update challan", variant: "destructive" }),
  });

  // Print helper
  const printExtraChallanById = async (challanId, fallbackChallan = null) => {
    const challan = fallbackChallan || extraChallans.find(c => c.id === challanId);
    if (!challan) return;

    setPrintingChallanId(`extra-${challanId}`);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print challans.", variant: "destructive" });
      setPrintingChallanId(null);
      return;
    }

    try {
      const tpl = extraTemplate || await getDefaultFeeChallanTemplate("EXTRA");
      const baseHtml = generateChallanHtml(
        { ...challan, isExtra: true, challanType: 'FEE_HEADS_ONLY' },
        tpl?.htmlContent || getCachedTemplate("EXTRA"),
        { extraChallanLateFee, classes, programs, feeHeads, academicSessions }
      );
      const resolvedHtml = applyPaidChallanPrintTreatment(baseHtml, challan);

      if (!htmlIncludesChallanNumber(resolvedHtml, challan.challanNumber)) {
        toast({
          title: "Print data mismatch",
          description: "The print view did not match the selected challan. Please refresh and try again.",
          variant: "destructive",
        });
        printWindow.close?.();
        return;
      }

      await openManagedPrintWindow({
        html: resolvedHtml,
        title: "Extra Challan #" + (challan.challanNumber || ""),
        toast,
        printWindow,
      });
    } catch (error) {
      console.error("Print failed:", error);
      toast({ title: "Print error", description: "Failed to generate print view.", variant: "destructive" });
      printWindow.close?.();
    } finally {
      setPrintingChallanId(null);
    }
  };

  // Open Edit Extra Challan Dialog
  const handleOpenEdit = (challan) => {
    setEditingChallan({ ...challan, isExtra: true });

    let rawHeads = [];
    if (Array.isArray(challan.heads)) {
      rawHeads = challan.heads;
    } else if (typeof challan.heads === 'string') {
      try { rawHeads = JSON.parse(challan.heads); } catch (e) { rawHeads = []; }
    } else if (Array.isArray(challan.challanHeads)) {
      rawHeads = challan.challanHeads;
    } else if (Array.isArray(challan.selectedHeads)) {
      rawHeads = challan.selectedHeads;
    }

    const nonTuitionFeeHeads = (feeHeads || []).filter(h => !h.isTuition);
    const selectedHeadIds = [];
    const customHeads = [];

    rawHeads.forEach(h => {
      if (!h) return;
      if (typeof h === 'string') {
        const trimmed = h.trim();
        const matched = nonTuitionFeeHeads.find(gh =>
          extractId(gh.id || gh._id) === trimmed ||
          (gh.name || '').trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (matched) {
          const catId = extractId(matched.id || matched._id);
          if (!selectedHeadIds.includes(catId)) selectedHeadIds.push(catId);
        } else {
          customHeads.push({ headName: trimmed, amount: "0" });
        }
        return;
      }

      const hHeadId = extractId(h.headId?._id || h.headId?.id || h.headId || (h.id !== -1 && h.id !== '-1' ? h.id : null));
      const hName = (h.headName || h.name || (typeof h.headId === 'object' && h.headId ? h.headId.name : '') || '').trim();
      const hNameLower = hName.toLowerCase();
      const isExplicitCustom = h.isCustom === true || h.id === -1 || h.id === '-1' || hNameLower === 'other';

      let matchedCat = null;
      if (hHeadId) {
        matchedCat = nonTuitionFeeHeads.find(gh => extractId(gh.id || gh._id) === hHeadId);
      }
      if (!matchedCat && hNameLower && !isExplicitCustom) {
        matchedCat = nonTuitionFeeHeads.find(gh => (gh.name || '').trim().toLowerCase() === hNameLower);
      }

      if (matchedCat) {
        const catId = extractId(matchedCat.id || matchedCat._id);
        if (!selectedHeadIds.includes(catId)) {
          selectedHeadIds.push(catId);
        }
      } else {
        customHeads.push({
          headName: h.headName || h.name || "Other",
          amount: Number(h.amount || 0).toString(),
        });
      }
    });

    setEditForm({
      dueDate: challan.dueDate ? new Date(challan.dueDate) : null,
      remarks: challan.remarks || "",
      selectedHeads: selectedHeadIds,
      customHeads,
    });
    setEditExtraChallanOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingChallan) return;

    const selectedIds = (editForm.selectedHeads || []).map(extractId);
    const allFeeHeadDetails = (feeHeads || [])
      .filter(h => selectedIds.includes(extractId(h.id || h._id)))
      .map(h => ({
        headId: extractId(h.id || h._id),
        name: h.name,
        headName: h.name,
        amount: Math.round(Number(h.amount) || 0),
      }));

    const extraCustomHeadDetails = (editForm.customHeads || [])
      .map(h => ({
        name: String(h.headName || '').trim(),
        headName: String(h.headName || '').trim(),
        amount: toWholePkrAmount(h.amount)
      }))
      .filter(h => h.name && h.amount > 0);

    const extraHeadsPayload = [
      ...allFeeHeadDetails,
      ...extraCustomHeadDetails,
    ];

    const totalAmount = extraHeadsPayload.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);

    updateExtraChallanMutation.mutate({
      id: editingChallan.id,
      data: {
        dueDate: editForm.dueDate ? format(editForm.dueDate, "yyyy-MM-dd") : undefined,
        remarks: editForm.remarks,
        heads: extraHeadsPayload,
        amount: totalAmount,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Extra / Fee-Head-Only Challans</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Generate challans for specific fee heads (exam fee, registration, lab, etc.) not tied to installments.
              </p>
            </div>
            {canCreate && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="border-orange-200 hover:bg-orange-50 gap-2"
                  onClick={() => {
                    setSelectedBulkExtraStudents([]);
                    setExtraSelectedHeads([]);
                    setExtraCustomHeads([]);
                    setExtraRemarks("");
                    setExtraDueDate(null);
                    setBulkExtraChallanOpen(true);
                    setGenerateResults(null);
                  }}
                >
                  <Layers className="w-4 h-4" /> Bulk Create
                </Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700 gap-2 text-white"
                  onClick={() => {
                    setExtraSelectedStudent(null);
                    setExtraSelectedHeads([]);
                    setExtraCustomHeads([]);
                    setExtraRemarks("");
                    setExtraDueDate(null);
                    setCreateExtraChallanOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> Create Extra Challan
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Existing Extra Challans</CardTitle>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Search</Label>
              <Input
                placeholder="Challan #, name, roll..."
                value={extraSearch}
                onChange={(e) => { setExtraSearch(e.target.value); setExtraPage(1); }}
                className="w-[200px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={extraStatusFilter} onValueChange={(v) => { setExtraStatusFilter(v); setExtraPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="void">Voided</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setExtraSearch(""); setExtraStatusFilter("all"); setExtraPage(1); }}
              className="h-9 px-2 text-muted-foreground"
            >
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Challan No</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Student</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Heads Amount</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Late Fee</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Discount</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-foreground bg-slate-100">Total</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-green-700 bg-green-50">Paid Amount</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Due Date</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs px-3 py-2 text-right font-semibold text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isExtraLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8">Loading extra challans...</TableCell></TableRow>
                ) : extraChallans.map((challan, idx) => (
                  <TableRow key={challan.id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                    <TableCell className="text-sm px-3 py-2 font-medium">{challan.challanNumber}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <div className="font-medium">{challan.student?.fName} {challan.student?.lName}</div>
                      <div className="text-xs text-muted-foreground">{challan.student?.rollNumber}</div>
                    </TableCell>
                    <TableCell className="text-sm px-3 py-2 font-medium text-blue-600">
                      PKR {formatAmount(challan.headsAmount ?? (Number(challan.totalAmount || 0) - Number(challan.lateFeeFine || 0) + Number(challan.discount || 0)))}
                    </TableCell>
                    <TableCell className="text-sm px-3 py-2 font-medium text-red-600">
                      {(() => {
                        const isSettledOrVoid = ['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(challan.status);
                        const existingFine = Number(challan.lateFeeFine || 0);
                        const autoFine = (!isSettledOrVoid && challan.dueDate)
                          ? calculateLateFee(challan.dueDate, extraChallanLateFee)
                          : 0;
                        const effectiveFine = existingFine > 0 ? existingFine : autoFine;
                        return (
                          <span>
                            PKR {formatAmount(effectiveFine)}
                            {autoFine > 0 && existingFine === 0 && (
                              <span className="ml-1 text-[10px] text-red-500 font-normal italic">(Overdue)</span>
                            )}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm px-3 py-2 font-medium text-green-600">PKR {formatAmount(challan.discount || 0)}</TableCell>
                    <TableCell className="text-sm px-3 py-2 font-bold bg-slate-50">
                      {(() => {
                        const isSettledOrVoid = ['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(challan.status);
                        const existingFine = Number(challan.lateFeeFine || 0);
                        const autoFine = (!isSettledOrVoid && challan.dueDate)
                          ? calculateLateFee(challan.dueDate, extraChallanLateFee)
                          : 0;
                        const baseTotal = Number(challan.totalAmount || 0);
                        const effectiveTotal = existingFine > 0 ? baseTotal : (baseTotal + autoFine);
                        return `PKR ${formatAmount(effectiveTotal)}`;
                      })()}
                    </TableCell>
                    <TableCell className="text-sm px-3 py-2 text-success font-medium bg-green-50/50">PKR {formatAmount(challan.paidAmount || 0)}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">{challan.dueDate ? new Date(challan.dueDate).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <Badge variant={challan.status === "PAID" ? "default" : challan.status === "OVERDUE" ? "destructive" : challan.status === "PARTIAL" ? "secondary" : (challan.status === "VOID" || challan.status === "SUPERSEDED" || challan.status === "SETTLED") ? "outline" : "secondary"}>
                        {challan.status === "VOID" ? "Voided" : 
                         (challan.status === "SUPERSEDED" && (challan.settledAmount || 0) > 0) ? "Partially Settled" :
                         challan.status === "SUPERSEDED" ? "Superseded" : 
                         challan.status === "SETTLED" ? "Settled" : challan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setSelectedChallanDetails({ ...challan, isExtra: true, challanType: 'FEE_HEADS_ONLY' });
                              setDetailsDialogOpen(true);
                            }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Details</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => printExtraChallanById(challan.id, challan)}
                              disabled={printingChallanId === `extra-${challan.id}`}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Print Challan</TooltipContent>
                        </Tooltip>
                        {canPayFee && challan.status !== "PAID" && challan.status !== "VOID" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-success border-success hover:bg-success hover:text-white h-8 px-2"
                                onClick={() => {
                                  setItemToPay({ ...challan, isExtra: true, challanType: 'FEE_HEADS_ONLY' });
                                  setPaymentDialogOpen(true);
                                }}
                              >
                                Pay
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Record Payment</TooltipContent>
                          </Tooltip>
                        )}
                        {canUpdate && ((challan.status !== "PAID" && challan.status !== "SETTLED") ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(challan)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Challan</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="p-2 text-muted-foreground/50 cursor-not-allowed">
                                <Lock className="w-4 h-4" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {challan.status === "PAID" ? "Paid challans cannot be edited" : "Fully settled challans cannot be edited"}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setItemToDelete({ 
                                    type: "extraChallan", 
                                    id: challan.id, 
                                    status: challan.status,
                                    number: challan.challanNumber 
                                  });
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Challan</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isExtraLoading && extraChallans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No extra challans found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {extraChallans.length} of {extraChallanMeta?.total || 0} challans
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExtraPage(p => Math.max(1, p - 1))}
                disabled={extraPage === 1 || isExtraLoading}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {extraPage} of {extraChallanMeta?.lastPage || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExtraPage(p => p + 1)}
                disabled={extraPage >= (extraChallanMeta?.lastPage || 1) || isExtraLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Extra Challan Dialog */}
      <Dialog open={createExtraChallanOpen} onOpenChange={(open) => {
        setCreateExtraChallanOpen(open);
        if (!open) {
          setExtraSelectedStudent(null);
          setExtraSelectedHeads([]);
          setExtraRemarks("");
          setExtraCustomHeads([]);
          setExtraDueDate(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-600" />
              Create Extra Challan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Search Student</Label>
                <Popover open={extraStudentSearchOpen} onOpenChange={setExtraStudentSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-sm">
                      {extraSelectedStudent ? `${extraSelectedStudent.fName} ${extraSelectedStudent.lName || ''} (${extraSelectedStudent.rollNumber})` : "Select Student..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search by name or roll..." onValueChange={v => handleStudentSearch(v, setExtraStudentResults)} />
                      <CommandList>
                        <CommandEmpty>No student found.</CommandEmpty>
                        <CommandGroup>
                          {extraStudentResults.map(student => (
                            <CommandItem
                              key={student.id}
                              value={student.id.toString()}
                              onSelect={() => {
                                setExtraSelectedStudent(student);
                                setExtraStudentSearchOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", extraSelectedStudent?.id === student.id ? "opacity-100" : "opacity-0")} />
                              {student.rollNumber} ({student.fName} {student.lName || ''})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-9 text-sm justify-start text-left font-normal", !extraDueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {extraDueDate ? format(extraDueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={extraDueDate} onSelect={setExtraDueDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {extraSelectedStudent && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/10">
                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Select Fee Heads</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {feeHeads.filter(h => !h.isTuition).map(head => {
                      const hId = extractId(head.id || head._id);
                      return (
                        <div key={hId} className="flex items-center space-x-2 p-2 border rounded hover:bg-orange-50 transition-colors">
                          <input
                            type="checkbox"
                            id={`dlg-extra-head-${hId}`}
                            className="accent-orange-600 h-4 w-4"
                            checked={extraSelectedHeads.includes(hId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExtraSelectedHeads([...extraSelectedHeads, hId]);
                              } else {
                                setExtraSelectedHeads(extraSelectedHeads.filter(id => id !== hId));
                              }
                            }}
                          />
                          <label htmlFor={`dlg-extra-head-${hId}`} className="text-sm cursor-pointer flex-1 flex justify-between">
                            <span>{head.name}</span>
                            <span className="text-muted-foreground italic">PKR {Number(head.amount || 0).toLocaleString()}</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom Fee Heads Section */}
                  <div className="mt-4 pt-3 border-t border-orange-100">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-bold text-orange-700 uppercase">Custom Fee Heads</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-bold"
                        onClick={() => setExtraCustomHeads([...extraCustomHeads, { headName: "", amount: "" }])}
                      >
                        <PlusCircle className="w-3 h-3 mr-1" /> Add Head
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {extraCustomHeads.map((ch, idx) => (
                        <div key={idx} className="flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                          <Input
                            placeholder="Head Name (e.g. Library Fine)"
                            value={ch.headName}
                            onChange={(e) => {
                              const newHeads = [...extraCustomHeads];
                              newHeads[idx].headName = e.target.value;
                              setExtraCustomHeads(newHeads);
                            }}
                            className="h-8 text-xs flex-1"
                          />
                          <div className="relative w-28">
                            <span className="absolute left-1.5 top-2 text-[10px] text-muted-foreground">Rs.</span>
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={ch.amount}
                              onChange={(e) => {
                                const newHeads = [...extraCustomHeads];
                                newHeads[idx].amount = e.target.value;
                                setExtraCustomHeads(newHeads);
                              }}
                              className="h-8 text-xs pl-6"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setExtraCustomHeads(extraCustomHeads.filter((_, i) => i !== idx))}
                          >
                            <MinusCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}

                      {extraCustomHeads.length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic text-center py-2 bg-slate-50 rounded border border-dashed">
                          No custom heads added yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Remarks</Label>
                  <Textarea value={extraRemarks} onChange={e => setExtraRemarks(e.target.value)} placeholder="Optional notes..." className="text-sm min-h-[60px]" />
                </div>

                {(extraSelectedHeads.length > 0 || extraCustomHeads.some(h => h.headName && parseFloat(h.amount) > 0)) && (() => {
                  const charges = feeHeads.filter(h => extraSelectedHeads.includes(extractId(h.id || h._id))).reduce((s, h) => s + (Number(h.amount) || 0), 0);
                  const customCharges = extraCustomHeads.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
                  const finalCharges = charges + customCharges;
                  const autoLateFee = calculateLateFee(extraDueDate, extraChallanLateFee);
                  const grandTotal = finalCharges + autoLateFee;

                  return (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Base Charges:</span><span>PKR {finalCharges.toLocaleString()}</span>
                      </div>
                      {autoLateFee > 0 && (
                        <div className="flex justify-between text-xs text-red-600 font-medium">
                          <span>Late Fee Fine:</span><span>+ PKR {autoLateFee.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold border-t border-orange-300 mt-1 pt-1 text-orange-800">
                        <span>Grand Total:</span><span>PKR {grandTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setCreateExtraChallanOpen(false)}>Cancel</Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={(() => {
                  const charges = feeHeads.filter(h => extraSelectedHeads.includes(extractId(h.id || h._id))).reduce((s, h) => s + (Number(h.amount) || 0), 0);
                  const customCharges = extraCustomHeads.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
                  const finalCharges = charges + customCharges;
                  return !extraSelectedStudent || finalCharges <= 0 || !extraDueDate || isGenerating;
                })()}
                onClick={async () => {
                   setIsGenerating(true);
                   try {
                     const headsPayload = feeHeads
                       .filter(h => extraSelectedHeads.includes(extractId(h.id || h._id)))
                       .map(h => ({ headId: extractId(h.id || h._id), headName: h.name, name: h.name, amount: Math.round(Number(h.amount) || 0) }));

                     extraCustomHeads.forEach(ch => {
                       if (ch.headName && parseFloat(ch.amount) > 0) {
                         headsPayload.push({ headName: ch.headName.trim(), name: ch.headName.trim(), amount: toWholePkrAmount(ch.amount) });
                       }
                     });

                     const result = await generateExtraChallan({
                       studentId: extractId(extraSelectedStudent),
                       heads: headsPayload,
                       dueDate: format(extraDueDate, "yyyy-MM-dd"),
                       remarks: extraRemarks || "Extra fee head challan",
                     });

                     if (result) {
                       toast({ title: "Extra challan created successfully" });
                       queryClient.invalidateQueries(['feeChallans']);
                       queryClient.invalidateQueries(['extraChallans']);
                       setCreateExtraChallanOpen(false);
                     } else {
                       toast({ title: "Could not create challan.", variant: "destructive" });
                     }
                   } catch (err) {
                     toast({ title: err.message || "Failed to create extra challan", variant: "destructive" });
                   } finally {
                     setIsGenerating(false);
                   }
                }}
              >
                {isGenerating ? "Creating..." : "Create Extra Challan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Extra Challan Dialog */}
      <Dialog open={bulkExtraChallanOpen} onOpenChange={(open) => {
        setBulkExtraChallanOpen(open);
        if (!open) {
          setSelectedBulkExtraStudents([]);
          setExtraSelectedHeads([]);
          setExtraCustomHeads([]);
          setExtraRemarks("");
          setExtraDueDate(null);
          setGenerateResults(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-600" />
              Bulk Generate Extra Challans
            </DialogTitle>
          </DialogHeader>

          {generateResults ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Generation Results</h3>
                <Button variant="outline" size="sm" onClick={() => setGenerateResults(null)}>Back to Selection</Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Challan #</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generateResults.map((res, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{res.studentName}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] h-5", res.status === 'CREATED' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                            {res.status}
                          </Badge>
                          {res.reason && <p className="text-[9px] text-red-500 italic mt-0.5">{res.reason}</p>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{res.challanNumber || '-'}</TableCell>
                        <TableCell className="text-right">
                          {res.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => printExtraChallanById(res.id, res)}
                              disabled={printingChallanId === `extra-${res.id}`}
                            >
                              <Printer className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setBulkExtraChallanOpen(false)}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              {/* Step 1: Student Selection Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/20 rounded-xl border border-dashed">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Program</Label>
                  <Select
                    value={bulkFilters.programId}
                    onValueChange={(v) => {
                      setBulkFilters(prev => ({ ...prev, programId: v, classId: "all", sectionId: "all" }));
                      setSelectedBulkExtraStudents([]);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Programs" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {programs.map(p => <SelectItem key={extractId(p)} value={extractId(p)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Class</Label>
                  <Select
                    value={bulkFilters.classId}
                    onValueChange={(v) => {
                      setBulkFilters(prev => ({ ...prev, classId: v, sectionId: "all" }));
                      setSelectedBulkExtraStudents([]);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {availableClasses.map(c => (
                        <SelectItem key={extractId(c)} value={extractId(c)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Section</Label>
                    {isBulkClassSelected && !allowSectionsForBulkClass && (
                      <span className="text-[9px] text-amber-600 font-medium">N/A for class</span>
                    )}
                  </div>
                  <Select
                    value={bulkFilters.sectionId}
                    disabled={!isBulkClassSelected || !allowSectionsForBulkClass}
                    onValueChange={(v) => {
                      setBulkFilters(prev => ({ ...prev, sectionId: v }));
                      setSelectedBulkExtraStudents([]);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                      <SelectValue
                        placeholder={
                          !isBulkClassSelected
                            ? "Select class first"
                            : !allowSectionsForBulkClass
                            ? "Sections Not Applicable"
                            : "All Sections"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {availableSections.map(s => (
                        <SelectItem key={extractId(s)} value={extractId(s)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Step 2: Student List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">
                    Select Students ({selectedBulkExtraStudents.length} of {bulkStudents.length})
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => setSelectedBulkExtraStudents(bulkStudents.map(s => extractId(s)))}
                      disabled={bulkStudents.length === 0}
                    >
                      Select All Visible
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-red-500 hover:text-red-600"
                      onClick={() => setSelectedBulkExtraStudents([])}
                      disabled={selectedBulkExtraStudents.length === 0}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  <Table>
                    <TableBody>
                      {isFetchingBulkStudents ? (
                        <TableRow><TableCell className="text-center py-6 text-xs text-muted-foreground animate-pulse">Fetching students...</TableCell></TableRow>
                      ) : bulkStudents.length === 0 ? (
                        <TableRow><TableCell className="text-center py-6 text-xs text-muted-foreground italic">No students match the filters.</TableCell></TableRow>
                      ) : (
                        bulkStudents.map(student => {
                          const studentId = extractId(student);
                          const isSelected = selectedBulkExtraStudents.includes(studentId);
                          return (
                            <TableRow key={studentId} className={cn("h-9 cursor-pointer hover:bg-orange-50/50", isSelected && "bg-orange-50/30")}>
                              <TableCell className="w-10 text-center p-0">
                                <input
                                  type="checkbox"
                                  className="accent-orange-600 h-3.5 w-3.5 cursor-pointer"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedBulkExtraStudents(prev => [...prev, studentId]);
                                    else setSelectedBulkExtraStudents(prev => prev.filter(id => id !== studentId));
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-xs font-medium py-1 px-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span>{student.fName} {student.lName || ""}</span>
                                    <span className="text-[10px] text-muted-foreground ml-2 font-mono uppercase">({student.rollNumber || "No Roll"})</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {student.className || ""}
                                    {student.sectionName ? ` - ${student.sectionName}` : ""}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Step 3: Fee Heads & Config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-orange-50/30 rounded-xl border border-orange-100">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold uppercase text-orange-700">Fee Heads</Label>
                    <div className="grid grid-cols-1 gap-1.5 mt-2">
                      {feeHeads.filter(h => !h.isTuition).map(head => {
                        const hId = extractId(head.id || head._id);
                        return (
                          <label key={hId} className="flex items-center gap-2 p-1.5 border rounded-lg bg-white cursor-pointer hover:border-orange-300 transition-colors">
                            <input
                              type="checkbox"
                              className="accent-orange-600 h-3.5 w-3.5"
                              checked={extraSelectedHeads.includes(hId)}
                              onChange={(e) => {
                                if (e.target.checked) setExtraSelectedHeads([...extraSelectedHeads, hId]);
                                else setExtraSelectedHeads(extraSelectedHeads.filter(id => id !== hId));
                              }}
                            />
                            <span className="text-[11px] font-medium flex-1">{head.name}</span>
                            <span className="text-[10px] text-muted-foreground">PKR {Number(head.amount || 0).toLocaleString()}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-orange-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-[10px] font-bold text-orange-700 uppercase">Custom Heads</Label>
                        <Button variant="ghost" size="sm" className="h-5 text-[9px] font-bold" onClick={() => setExtraCustomHeads([...extraCustomHeads, { headName: "", amount: "" }])}>+ Add</Button>
                      </div>
                      <div className="space-y-1.5">
                        {extraCustomHeads.map((ch, idx) => (
                          <div key={idx} className="flex gap-1.5 items-center">
                            <Input placeholder="Name" value={ch.headName} onChange={e => { const n = [...extraCustomHeads]; n[idx].headName = e.target.value; setExtraCustomHeads(n); }} className="h-7 text-[10px] flex-1" />
                            <Input placeholder="Amt" type="number" value={ch.amount} onChange={e => { const n = [...extraCustomHeads]; n[idx].amount = e.target.value; setExtraCustomHeads(n); }} className="h-7 text-[10px] w-20" />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => setExtraCustomHeads(extraCustomHeads.filter((_, i) => i !== idx))}><MinusCircle className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-orange-700">Common Config</Label>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full h-8 text-xs justify-start text-left font-normal", !extraDueDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {extraDueDate ? format(extraDueDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={extraDueDate} onSelect={setExtraDueDate} initialFocus /></PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Common Remarks</Label>
                      <Textarea value={extraRemarks} onChange={e => setExtraRemarks(e.target.value)} placeholder="e.g. Annual Sports Fee" className="text-xs min-h-[60px]" />
                    </div>
                  </div>

                  <div className="p-3 bg-orange-600 rounded-xl text-white shadow-lg shadow-orange-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] uppercase font-bold opacity-80">Students</span>
                      <span className="font-black text-sm">{selectedBulkExtraStudents.length}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] uppercase font-bold opacity-80">Per Student</span>
                      <div className="flex flex-col items-end">
                        <span className="font-black text-sm">
                          {(() => {
                            const predefinedCharges = feeHeads
                              .filter(h => extraSelectedHeads.includes(extractId(h.id || h._id)))
                              .reduce((s, h) => s + (Number(h.amount) || 0), 0);
                            const customCharges = extraCustomHeads.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
                            const autoFine = calculateLateFee(extraDueDate, extraChallanLateFee);
                            return `PKR ${(predefinedCharges + customCharges + autoFine).toLocaleString()}`;
                          })()}
                        </span>
                        {calculateLateFee(extraDueDate, extraChallanLateFee) > 0 && (
                          <span className="text-[8px] font-bold opacity-70">
                            Incl. PKR {calculateLateFee(extraDueDate, extraChallanLateFee).toLocaleString()} Late Fee
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-3 pt-2 border-t border-orange-500/50">
                      <span className="text-[10px] uppercase font-bold opacity-80">Total Est.</span>
                      <span className="font-black text-base">
                        {(() => {
                          const predefinedCharges = feeHeads
                            .filter(h => extraSelectedHeads.includes(extractId(h.id || h._id)))
                            .reduce((s, h) => s + (Number(h.amount) || 0), 0);
                          const customCharges = extraCustomHeads.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
                          const autoFine = calculateLateFee(extraDueDate, extraChallanLateFee);
                          return `PKR ${((predefinedCharges + customCharges + autoFine) * selectedBulkExtraStudents.length).toLocaleString()}`;
                        })()}
                      </span>
                    </div>
                    <Button
                      className="w-full bg-white text-orange-700 hover:bg-orange-50 font-bold h-9 mt-1"
                      disabled={(() => {
                        const predefinedCharges = feeHeads
                          .filter(h => extraSelectedHeads.includes(extractId(h.id || h._id)))
                          .reduce((s, h) => s + (Number(h.amount) || 0), 0);
                        const customCharges = extraCustomHeads.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
                        const finalCharges = predefinedCharges + customCharges;
                        return selectedBulkExtraStudents.length === 0 || finalCharges <= 0 || !extraDueDate || isGenerating;
                      })()}
                      onClick={async () => {
                        setIsGenerating(true);
                        const selectedFeeHeadDetails = feeHeads
                          .filter(h => extraSelectedHeads.includes(extractId(h.id || h._id)))
                          .map(h => ({
                            headId: extractId(h.id || h._id),
                            name: h.name,
                            headName: h.name,
                            amount: Math.round(Number(h.amount) || 0),
                          }));

                        const customHeadDetails = extraCustomHeads
                          .filter(ch => ch.headName && parseFloat(ch.amount) > 0)
                          .map(ch => ({
                            name: ch.headName.trim(),
                            headName: ch.headName.trim(),
                            amount: toWholePkrAmount(ch.amount),
                          }));

                        const combinedHeads = [...selectedFeeHeadDetails, ...customHeadDetails];
                        const totalAmount = combinedHeads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);

                        bulkGenerateExtraChallansMutation.mutate({
                          studentIds: selectedBulkExtraStudents,
                          feeHeadIds: extraSelectedHeads,
                          heads: combinedHeads,
                          amount: totalAmount,
                          dueDate: format(extraDueDate, "yyyy-MM-dd"),
                          remarks: extraRemarks || "Bulk extra challan generation",
                        });
                      }}
                    >
                      {isGenerating ? "Generating..." : "Generate Bulk"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Extra Challan Dialog */}
      <Dialog open={editExtraChallanOpen} onOpenChange={setEditExtraChallanOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-orange-600" />
              Edit Extra Challan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2 border rounded-lg p-2 bg-muted/15">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase italic px-1">STUDENT</Label>
                <Input
                  value={editingChallan?.student ? `${editingChallan.student.fName} ${editingChallan.student.lName} (${editingChallan.student.rollNumber})` : ""}
                  disabled
                  className="bg-muted/50 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase italic px-1">DUE DATE</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full h-8 text-xs justify-start text-left font-normal", !editForm.dueDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.dueDate ? format(editForm.dueDate, "PPP") : "Pick due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editForm.dueDate} onSelect={(d) => setEditForm({ ...editForm, dueDate: d })} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-3 border rounded-lg p-3 bg-muted/10">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Select Standard Fee Heads</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {feeHeads.filter(h => !h.isTuition).map(head => {
                  const hIdStr = extractId(head.id || head._id);
                  const isChecked = (editForm.selectedHeads || []).some(id => extractId(id) === hIdStr);
                  return (
                    <div key={hIdStr} className="flex items-center space-x-2 p-2 border rounded hover:bg-orange-50 bg-white transition-colors">
                      <input
                        type="checkbox"
                        id={`edit-extra-head-${hIdStr}`}
                        className="accent-orange-600 h-4 w-4"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentIds = (editForm.selectedHeads || []).map(extractId);
                          if (e.target.checked) {
                            setEditForm({ ...editForm, selectedHeads: [...currentIds, hIdStr] });
                          } else {
                            setEditForm({ ...editForm, selectedHeads: currentIds.filter(id => id !== hIdStr) });
                          }
                        }}
                      />
                      <label htmlFor={`edit-extra-head-${hIdStr}`} className="text-xs cursor-pointer flex-1 flex justify-between">
                        <span>{head.name}</span>
                        <span className="text-muted-foreground font-semibold">PKR {Number(head.amount || 0).toLocaleString()}</span>
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* Custom heads */}
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-bold text-orange-700 uppercase">Custom Fee Heads</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-orange-600 hover:text-orange-700 font-bold"
                    onClick={() => setEditForm({ ...editForm, customHeads: [...editForm.customHeads, { headName: "", amount: "" }] })}
                  >
                    <PlusCircle className="w-3 h-3 mr-1" /> Add Head
                  </Button>
                </div>
                <div className="space-y-2">
                  {editForm.customHeads.map((ch, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Head Name"
                        value={ch.headName}
                        onChange={(e) => {
                          const updated = [...editForm.customHeads];
                          updated[idx].headName = e.target.value;
                          setEditForm({ ...editForm, customHeads: updated });
                        }}
                        className="h-8 text-xs flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={ch.amount}
                        onChange={(e) => {
                          const updated = [...editForm.customHeads];
                          updated[idx].amount = e.target.value;
                          setEditForm({ ...editForm, customHeads: updated });
                        }}
                        className="h-8 text-xs w-28"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setEditForm({ ...editForm, customHeads: editForm.customHeads.filter((_, i) => i !== idx) })}
                      >
                        <MinusCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Remarks</Label>
                <Textarea
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="Optional remarks..."
                  className="text-xs min-h-[50px]"
                />
              </div>

              {/* Total preview */}
              {(() => {
                const selectedIds = (editForm.selectedHeads || []).map(extractId);
                const stdCharges = feeHeads
                  .filter(h => selectedIds.includes(extractId(h.id || h._id)))
                  .reduce((s, h) => s + (Number(h.amount) || 0), 0);
                const cstCharges = editForm.customHeads.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
                const total = stdCharges + cstCharges;
                const autoLateFee = calculateLateFee(editForm.dueDate, extraChallanLateFee);

                return (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Base Charges:</span><span>PKR {total.toLocaleString()}</span>
                    </div>
                    {autoLateFee > 0 && (
                      <div className="flex justify-between text-xs text-red-600 font-medium">
                        <span>Late Fee Fine:</span><span>+ PKR {autoLateFee.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t border-orange-300 mt-1 pt-1 text-orange-800">
                      <span>Total Due:</span><span>PKR {(total + autoLateFee).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setEditExtraChallanOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                onClick={handleSaveEdit}
                disabled={updateExtraChallanMutation.isPending}
              >
                {updateExtraChallanMutation.isPending ? "Saving..." : "Update Challan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-sm">Are you sure you want to delete extra challan #{itemToDelete?.number}? This action will:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Remove the extra challan record permanently.</li>
                </ul>
                <p className="font-bold text-destructive text-sm mt-2">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (itemToDelete?.id) {
                  deleteExtraChallanMutation.mutate(itemToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteExtraChallanMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        challan={itemToPay}
        feeHeads={feeHeads}
        extraChallanLateFee={extraChallanLateFee}
        onPaymentSuccess={() => {
          queryClient.invalidateQueries(['extraChallans']);
          queryClient.invalidateQueries(['feeChallans']);
        }}
      />

      {/* Challan Details Dialog */}
      <ChallanDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        challan={selectedChallanDetails}
        feeHeads={feeHeads}
        feeChallans={extraChallans}
        classes={classes}
        programs={programs}
        academicSessions={academicSessions}
        lateFeeRatePerDay={extraChallanLateFee}
      />
    </div>
  );
};

export default ExtraChallansTab;
