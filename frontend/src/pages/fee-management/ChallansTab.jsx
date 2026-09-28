import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { MonthPicker } from "@/components/ui/month-picker";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  SlidersHorizontal,
  X,
  Plus,
  Eye,
  Edit,
  Lock,
  Printer,
  History,
  Trash2,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Calendar as CalendarIcon,
  Minus,
  Layers,
  MoreVertical,
  DollarSign,
} from "lucide-react";
import {
  getFeeChallans,
  getBulkChallans,
  updateFeeChallan,
  deleteFeeChallan,
  getInstallmentPlans,
  bulkGenerateChallans,
  getNewFeeReportSummary,
  getDefaultFeeChallanTemplate,
  getSections,
} from "@/services/api";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};
import {
  formatAmount,
  toWholePkrAmount,
  calculateLateFee,
  normalizeChallan,
  getSelectedHeadsTotal,
  getTotalArrears,
  getRecursiveArrears,
  getChallanTotal,
  getChallanGrossTotal,
  getChallanNetPayable,
  generateChallanHtml,
  applyPaidChallanPrintTreatment,
  htmlIncludesChallanNumber,
  setCachedTemplate,
  getCachedTemplate,
} from "./feeFinancialUtils";
import { openManagedPrintWindow, renderAndPrintChallans } from "@/lib/managedPrint";
import { PaymentDialog } from "./PaymentDialog";
import { ChallanDetailsDialog } from "./ChallanDetailsDialog";
import usePermissions from "@/hooks/usePermissions";

export const ChallansTab = ({
  feeHeads = [],
  programs = [],
  classes = [],
  departments = [],
  academicSessions = [],
  activeSessionId = "all",
  feeStructures = [],
  lateFeeFine = 0,
  lateFeeRatePerDay = 0,
  defaultDueDays = 10,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete, canPayFee } = usePermissions("Fee Management", "challans");

  // Search & Filters
  const [challanSearch, setChallanSearch] = useState("");
  const [challanFilter, setChallanFilter] = useState([]);
  const [challanSessionFilter, setChallanSessionFilter] = useState(activeSessionId);
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedInstallment, setSelectedInstallment] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [challanMeta, setChallanMeta] = useState(null);

  // Sync session filter with activeSessionId when loaded
  const sessionInitRef = useRef(false);
  useEffect(() => {
    if (!sessionInitRef.current && activeSessionId !== "all") {
      setChallanSessionFilter(activeSessionId);
      sessionInitRef.current = true;
    }
  }, [activeSessionId]);

  // Dialog states
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [challanOpen, setChallanOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);

  // Active items
  const [selectedChallanDetails, setSelectedChallanDetails] = useState(null);
  const [selectedChallanForHistory, setSelectedChallanForHistory] = useState(null);
  const [itemToPay, setItemToPay] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingChallan, setEditingChallan] = useState(null);
  const [printingChallanId, setPrintingChallanId] = useState(null);

  // Summary query
  const { data: installmentSummary = {} } = useQuery({
    queryKey: ['installmentSummary', challanSessionFilter],
    queryFn: () => getNewFeeReportSummary(challanSessionFilter, 'installment'),
  });
  const totalReceived = installmentSummary.totalRevenue ?? installmentSummary.totalCollected ?? 0;
  const totalPending = installmentSummary.totalOutstanding ?? installmentSummary.totalPending ?? 0;

  // Main Challans Query
  const { data: feeChallansData = { data: [], meta: {} }, isLoading: isChallansLoading } = useQuery({
    queryKey: ['feeChallans', challanSearch, challanFilter, challanSessionFilter, selectedInstallment, selectedMonth, selectedProgram, selectedClass, selectedSection, page, limit],
    queryFn: () => {
      let monthName = "";
      let yr = "";
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        monthName = monthNames[parseInt(month) - 1];
        yr = year;
      }

      return getFeeChallans({
        search: challanSearch,
        status: challanFilter.length > 0 ? challanFilter.join(',') : undefined,
        sessionId: challanSessionFilter !== "all" ? challanSessionFilter : undefined,
        programId: selectedProgram !== "all" ? selectedProgram : undefined,
        classId: selectedClass !== "all" ? selectedClass : undefined,
        sectionId: selectedSection !== "all" ? selectedSection : undefined,
        installmentNumber: selectedInstallment !== "all" ? selectedInstallment : undefined,
        month: monthName || undefined,
        year: yr || undefined,
        page,
        limit,
        type: 'INSTALLMENT',
      });
    },
    keepPreviousData: true,
  });

  const rawChallansList = Array.isArray(feeChallansData)
    ? feeChallansData
    : (Array.isArray(feeChallansData?.data) ? feeChallansData.data : []);
  const feeChallans = rawChallansList.map(normalizeChallan);

  useEffect(() => {
    if (feeChallansData?.meta) setChallanMeta(feeChallansData.meta);
  }, [feeChallansData]);

  // Generate Challans Dialog State
  const [generateForm, setGenerateForm] = useState({
    programId: "all",
    classId: "all",
    sectionId: "all",
    sessionId: activeSessionId,
    month: format(new Date(), "yyyy-MM"),
  });
  const [bulkDueDate, setBulkDueDate] = useState(null);
  const [bulkStudents, setBulkStudents] = useState([]);
  const [selectedBulkStudents, setSelectedBulkStudents] = useState([]);
  const [isFetchingBulkStudents, setIsFetchingBulkStudents] = useState(false);
  const [generationErrors, setGenerationErrors] = useState({});
  const [generateResults, setGenerateResults] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrintingKey, setGeneratedPrintingKey] = useState("");
  const sessionManuallySet = useRef(false);

  // Sections Query for Class->Section cascading
  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: getSections,
  });

  // Standard Installment Template Query
  const { data: installmentTemplate } = useQuery({
    queryKey: ['feeChallanTemplate', 'INSTALLMENT'],
    queryFn: async () => {
      const t = await getDefaultFeeChallanTemplate("INSTALLMENT");
      if (t?.htmlContent) setCachedTemplate("INSTALLMENT", t.htmlContent);
      return t;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filtered classes based on selected program
  const availableClasses = classes.filter(c => {
    if (!generateForm.programId || generateForm.programId === "all") return true;
    return extractId(c.programId || c.program) === generateForm.programId;
  });

  // Selected class object for Generate Challans dialog
  const selectedGenClass = classes.find(c => extractId(c) === generateForm.classId);
  const isGenClassSelected = generateForm.classId && generateForm.classId !== "all";
  const allowSectionsForGenClass = isGenClassSelected ? selectedGenClass?.allowSections !== false : false;

  // Filtered sections based on selected class
  const availableSections = (isGenClassSelected && allowSectionsForGenClass)
    ? sections.filter(s => extractId(s.classId || s.class) === generateForm.classId)
    : [];

  // Filtered classes based on selected program for table filter
  const filterAvailableClasses = classes.filter(c => {
    if (!selectedProgram || selectedProgram === "all") return true;
    return extractId(c.programId || c.program) === selectedProgram;
  });

  // Selected class object for table filter
  const selectedTableClass = classes.find(c => extractId(c) === selectedClass);
  const isTableClassSelected = selectedClass && selectedClass !== "all";
  const allowSectionsForTableClass = isTableClassSelected ? selectedTableClass?.allowSections !== false : false;

  // Filtered sections based on selected class for table filter
  const filterAvailableSections = (isTableClassSelected && allowSectionsForTableClass)
    ? sections.filter(s => extractId(s.classId || s.class) === selectedClass)
    : [];

  // Set default due date to 10th of chosen month
  useEffect(() => {
    if (generateForm.month) {
      const [year, month] = generateForm.month.split('-').map(Number);
      const defaultDate = new Date(year, month - 1, 10);
      setBulkDueDate(defaultDate);
    }
  }, [generateForm.month]);

  useEffect(() => {
    if (activeSessionId !== "all" && !sessionManuallySet.current) {
      setGenerateForm(prev => ({ ...prev, sessionId: activeSessionId }));
      sessionManuallySet.current = true;
    }
  }, [generateDialogOpen, activeSessionId]);

  // Bulk Student Fetcher for Monthly Generation
  useEffect(() => {
    const fetchBulkStudentsData = async () => {
      if (!generateDialogOpen) return;
      setGenerationErrors({});
      setGenerateResults(null);

      setIsFetchingBulkStudents(true);
      try {
        const studentList = await getInstallmentPlans({
          ...(generateForm.programId && generateForm.programId !== "all" ? { programId: generateForm.programId } : {}),
          ...(generateForm.classId && generateForm.classId !== "all" ? { classId: generateForm.classId } : {}),
          ...(generateForm.sectionId && generateForm.sectionId !== "all" ? { sectionId: generateForm.sectionId } : {}),
          ...(generateForm.sessionId && generateForm.sessionId !== "all" ? { sessionId: generateForm.sessionId } : {}),
          ...(generateForm.month ? { month: generateForm.month } : {}),
        });

        const [selY, sm] = (generateForm.month || '').split('-').map(Number);
        const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const mName = sm ? (monthNames[sm - 1] || '').toLowerCase() : '';
        const selectedSessionName = generateForm.sessionId && generateForm.sessionId !== 'all'
          ? (academicSessions.find(s => extractId(s) === generateForm.sessionId)?.name || '')
          : '';

        // Filter students who are strictly eligible for monthly challan generation:
        // 1. Must have a decided installment in their plan for the selected month/session (Bug 1: don't load if no plan exists for this month)
        // 2. Must NOT already have an active/generated challan for this installment/month (Bug 2: block regenerating the same installment/month)
        const eligibleStudents = (studentList || []).filter(s => {
          const installments = s.feeInstallments || [];
          if (installments.length === 0) return false;

          const matchingInst = installments.find(inst => {
            const nameMatch = (inst.month || '').trim().toLowerCase() === mName;
            const yearMatch = inst.dueDate ? new Date(inst.dueDate).getFullYear() === selY : true;
            if (generateForm.sessionId && generateForm.sessionId !== 'all') {
              const byId = inst.sessionId?.toString() === generateForm.sessionId;
              const byName = selectedSessionName && (inst.session || '') === selectedSessionName;
              return nameMatch && yearMatch && (byId || byName);
            }
            return nameMatch && yearMatch;
          });

          // Bug 1: If no matching installment decided for this month in the student's plan, do not load student
          if (!matchingInst) return false;

          // Check if an active non-void challan already exists for this installment/month
          const hasActiveChallan = (Array.isArray(matchingInst.challans) && matchingInst.challans.some(c => c.status !== 'VOID')) ||
            (Array.isArray(s.challans) && s.challans.some(c =>
              c.status !== 'VOID' &&
              ((c.month || '').trim().toLowerCase() === mName || (matchingInst.installmentNumber && c.installmentNumber === matchingInst.installmentNumber))
            ));

          // If an active challan exists, block regenerating the same installment/month
          if (hasActiveChallan) return false;

          return true;
        });

        setBulkStudents(eligibleStudents);
        setSelectedBulkStudents(eligibleStudents.map(s => s.id));

        if (filtered.length > 0 && generateForm.month) {
          const [selYear, selMonth] = generateForm.month.split('-').map(Number);
          const mNameMatch = new Date(selYear, selMonth - 1, 1).toLocaleString('default', { month: 'long' });
          const mSession = (selMonth >= 4) ? `${selYear}-${selYear + 1}` : `${selYear - 1}-${selYear}`;

          const firstWithInst = filtered.find(s => 
            (s.feeInstallments || []).some(inst => 
              (inst.month === mNameMatch && (inst.session === mSession || !inst.session) && (inst.dueDate ? new Date(inst.dueDate).getFullYear() === selYear : true)) || inst.month === generateForm.month
            )
          );

          if (firstWithInst) {
            const matchingInst = firstWithInst.feeInstallments.find(inst =>
              (inst.month === mNameMatch && (inst.session === mSession || !inst.session) && (inst.dueDate ? new Date(inst.dueDate).getFullYear() === selYear : true)) || inst.month === generateForm.month
            );
            if (matchingInst?.dueDate) {
              setBulkDueDate(new Date(matchingInst.dueDate));
            } else {
              const d = new Date();
              d.setDate(d.getDate() + (Number(defaultDueDays) || 10));
              setBulkDueDate(d);
            }
          } else {
            const d = new Date();
            d.setDate(d.getDate() + (Number(defaultDueDays) || 10));
            setBulkDueDate(d);
          }
        }
      } catch (error) {
        console.error("Failed to fetch bulk students:", error);
      } finally {
        setIsFetchingBulkStudents(false);
      }
    };

    fetchBulkStudentsData();
  }, [generateDialogOpen, generateForm.month, generateForm.sessionId, generateForm.programId, generateForm.classId, generateForm.sectionId]);

  // Bulk Generate Challans Mutation
  const bulkGenerateChallansMutation = useMutation({
    mutationFn: bulkGenerateChallans,
    onSuccess: (data) => {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['feeChallans'] });
      queryClient.invalidateQueries({ queryKey: ['extraChallans'] });
      queryClient.invalidateQueries({ queryKey: ['installmentPlans'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['installmentSummary'] });

      const results = Array.isArray(data) ? data : (data?.results || []);
      const createdCount = results.filter(r => r.status === 'CREATED').length;
      const blockedCount = results.filter(r => r.status === 'BLOCKED').length;
      const existsCount = results.filter(r => r.status === 'ALREADY_EXISTS').length;

      const mappedResults = results.map(r => {
        const studentInfo = bulkStudents.find(s => String(s.id || s._id) === String(r.studentId));
        const rawChallan = r.challan || {};
        const challanId = rawChallan.id || rawChallan._id;
        const challanNumber = r.challanNumber || rawChallan.challanNo || rawChallan.challanNumber || '';
        const studentObj = studentInfo || rawChallan.student || (rawChallan.studentId && typeof rawChallan.studentId === 'object' ? rawChallan.studentId : null);
        const studentFullName = r.studentName || (studentInfo ? `${studentInfo.fName || ''} ${studentInfo.lName || ''}`.trim() : rawChallan.studentName) || `Student #${r.studentId}`;
        const fatherFullName = studentInfo?.fatherOrguardian || studentInfo?.fatherName || rawChallan.fatherName || '';
        const rollNum = studentInfo?.rollNumber || studentInfo?.admissionNo || rawChallan.rollNumber || '';
        const studentClass = studentInfo?.classId || studentInfo?.class || rawChallan.studentClass || rawChallan.classId;
        const studentProgram = studentInfo?.programId || studentInfo?.program || rawChallan.studentProgram || rawChallan.programId;
        const studentSection = studentInfo?.sectionId || studentInfo?.section || rawChallan.studentSection || rawChallan.sectionId;

        const challanObj = {
          ...rawChallan,
          id: challanId,
          _id: challanId,
          challanNumber,
          challanNo: challanNumber,
          student: studentObj,
          studentId: studentObj,
          studentName: studentFullName,
          fatherName: fatherFullName,
          rollNumber: rollNum,
          rollNo: rollNum,
          studentClass,
          studentProgram,
          studentSection,
        };

        return {
          studentId: r.studentId,
          studentName: studentFullName,
          status: r.status,
          reason: r.reason || r.error || r.message || '',
          challanNumber,
          challan: challanObj,
        };
      });

      setGenerateResults(mappedResults);

      if (blockedCount > 0) {
        toast({
          title: `${createdCount} challan(s) generated`,
          description: `${blockedCount} blocked/failed. See details below.`,
          variant: "destructive",
        });
      } else if (existsCount > 0 && createdCount === 0) {
        toast({ title: "Challans already generated", description: "Selected installments already have challans." });
      } else if (createdCount > 0) {
        toast({ title: `${createdCount} challan(s) generated successfully` });
      } else {
        toast({ title: "No new challans were generated" });
      }
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({ title: error.message || "Generation failed", variant: "destructive" });
    },
  });

  // Edit Challan Form State
  const [challanForm, setChallanForm] = useState({
    studentId: "",
    amount: "",
    dueDate: null,
    fineAmount: 0,
    remarks: "",
    installmentNumber: "",
    selectedHeads: [],
    isArrearsPayment: false,
    arrearsInstallments: 1,
    arrearsAmount: "",
    arrearsSelections: [],
    isOtherEnabled: false,
    otherAmount: "0",
    customHeads: [],
    discount: 0,
  });
  const [genStudentPlan, setGenStudentPlan] = useState([]);

  // Update Challan Mutation
  const updateChallanMutation = useMutation({
    mutationFn: ({ id, data }) => updateFeeChallan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeChallans'] });
      queryClient.invalidateQueries({ queryKey: ['extraChallans'] });
      queryClient.invalidateQueries({ queryKey: ['installmentPlans'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: "Challan updated successfully" });
      setChallanOpen(false);
      setEditingChallan(null);
    },
    onError: (error) => toast({ title: error.message || "Failed to update challan", variant: "destructive" }),
  });

  // Delete Challan Mutation
  const deleteChallanMutation = useMutation({
    mutationFn: deleteFeeChallan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeChallans'] });
      queryClient.invalidateQueries({ queryKey: ['extraChallans'] });
      queryClient.invalidateQueries({ queryKey: ['studentFeeHistory'] });
      queryClient.invalidateQueries({ queryKey: ['installmentSummary'] });
      queryClient.invalidateQueries({ queryKey: ['newFeeReportSummary'] });
      queryClient.invalidateQueries({ queryKey: ['feeCollectionSummary'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] });
      queryClient.invalidateQueries({ queryKey: ['walletTuitionLogs'] });
      queryClient.invalidateQueries({ queryKey: ['installmentPlans'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: "Challan deleted successfully" });
      setDeleteDialogOpen(false);
    },
    onError: (error) => toast({ title: error.message || "Failed to delete challan", variant: "destructive" }),
  });

  // Print Single Installment Challan
  const printInstallmentChallan = async (challanId, fallbackChallan = null) => {
    let challan = fallbackChallan || feeChallans.find(c => c.id === challanId);
    if (!challan) return;
    challan = { ...challan, lateFeeRatePerDay: challan.lateFeeRatePerDay || challan.installment?.lateFeeRatePerDay || lateFeeRatePerDay };

    setPrintingChallanId(`installment-${challanId}`);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print challans.", variant: "destructive" });
      setPrintingChallanId(null);
      return;
    }

    try {
      const tpl = installmentTemplate || await getDefaultFeeChallanTemplate("INSTALLMENT");
      const baseHtml = generateChallanHtml(
        challan,
        tpl?.htmlContent || getCachedTemplate("INSTALLMENT"),
        { lateFeeRatePerDay, classes, programs, feeHeads, feeChallans, academicSessions }
      );
      const resolvedHtml = applyPaidChallanPrintTreatment(baseHtml, challan, feeChallans);

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
        title: "Challan #" + (challan.challanNumber || ""),
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

  // Print Generated Challan
  const printGeneratedChallan = async (result) => {
    const challanId = result?.challan?.id || result?.challan?._id || result?.challanNumber;
    if (!challanId) return;
    const key = result.challan?.id || result.challan?._id || result.studentId;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print challans.", variant: "destructive" });
      return;
    }

    setGeneratedPrintingKey(key);
    try {
      const studentInfo = bulkStudents.find(s => String(s.id || s._id) === String(result.studentId));
      const challanWithStudent = {
        ...result.challan,
        id: challanId,
        _id: challanId,
        student: result.challan?.student || studentInfo,
        studentName: result.challan?.studentName || result.studentName || (studentInfo ? `${studentInfo.fName || ''} ${studentInfo.lName || ''}`.trim() : ''),
        fatherName: result.challan?.fatherName || studentInfo?.fatherOrguardian || '',
        rollNumber: result.challan?.rollNumber || studentInfo?.rollNumber || studentInfo?.admissionNo || '',
        studentClass: result.challan?.studentClass || studentInfo?.classId || studentInfo?.class,
        studentProgram: result.challan?.studentProgram || studentInfo?.programId || studentInfo?.program,
        studentSection: result.challan?.studentSection || studentInfo?.sectionId || studentInfo?.section,
        lateFeeRatePerDay: result.challan?.lateFeeRatePerDay || lateFeeRatePerDay,
      };
      const normalized = normalizeChallan(challanWithStudent);
      const tpl = installmentTemplate || await getDefaultFeeChallanTemplate("INSTALLMENT");
      const baseHtml = generateChallanHtml(
        normalized,
        tpl?.htmlContent || getCachedTemplate("INSTALLMENT"),
        { lateFeeRatePerDay, classes, programs, feeHeads, feeChallans, academicSessions }
      );
      const html = applyPaidChallanPrintTreatment(baseHtml, normalized);
      await openManagedPrintWindow({ html, title: "Challan #" + (result.challanNumber || result.challan?.challanNumber || result.challan?.challanNo || ""), toast, printWindow });
    } catch (error) {
      toast({ title: "Print error", description: "Failed to generate print view.", variant: "destructive" });
      printWindow.close?.();
    } finally {
      setGeneratedPrintingKey("");
    }
  };

  const printGeneratedChallans = async (created = []) => {
    const printable = created.filter(r => r?.challan && (r.challan.id || r.challan._id || r.challanNumber));
    if (printable.length === 0) return;

    setGeneratedPrintingKey("all");
    try {
      const tpl = installmentTemplate || await getDefaultFeeChallanTemplate("INSTALLMENT");
      const tplHtml = tpl?.htmlContent || getCachedTemplate("INSTALLMENT");
      await renderAndPrintChallans({
        title: "Generated Challans",
        toast,
        renderers: printable.map(r => () => {
          const studentInfo = bulkStudents.find(s => String(s.id || s._id) === String(r.studentId));
          const challanId = r.challan.id || r.challan._id || r.challanNumber;
          const challanWithStudent = {
            ...r.challan,
            id: challanId,
            _id: challanId,
            student: r.challan?.student || studentInfo,
            studentName: r.challan?.studentName || r.studentName || (studentInfo ? `${studentInfo.fName || ''} ${studentInfo.lName || ''}`.trim() : ''),
            fatherName: r.challan?.fatherName || studentInfo?.fatherOrguardian || '',
            rollNumber: r.challan?.rollNumber || studentInfo?.rollNumber || studentInfo?.admissionNo || '',
            studentClass: r.challan?.studentClass || studentInfo?.classId || studentInfo?.class,
            studentProgram: r.challan?.studentProgram || studentInfo?.programId || studentInfo?.program,
            studentSection: r.challan?.studentSection || studentInfo?.sectionId || studentInfo?.section,
            lateFeeRatePerDay: r.challan?.lateFeeRatePerDay || lateFeeRatePerDay,
          };
          const normalized = normalizeChallan(challanWithStudent);
          const baseHtml = generateChallanHtml(
            normalized,
            tplHtml,
            { lateFeeRatePerDay, classes, programs, feeHeads, feeChallans, academicSessions }
          );
          return applyPaidChallanPrintTreatment(baseHtml, normalized);
        }),
      });
    } catch (error) {
      toast({ title: "Print error", description: "Failed to generate print view.", variant: "destructive" });
    } finally {
      setGeneratedPrintingKey("");
    }
  };

  // Bulk Print Dialog State
  const [bulkPrintFilters, setBulkPrintFilters] = useState({
    programId: "all",
    classId: "all",
    sectionId: "all",
    sessionId: activeSessionId,
    month: format(new Date(), "yyyy-MM"),
  });
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [bulkPreviewPrinting, setBulkPreviewPrinting] = useState(false);
  const [bulkChallansList, setBulkChallansList] = useState([]);
  const [bulkPreviewContent, setBulkPreviewContent] = useState("");

  const handleBulkPrint = async () => {
    try {
      setBulkPrinting(true);
      const [year, month] = bulkPrintFilters.month.split('-');
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const targetMonth = monthNames[parseInt(month) - 1];

      const response = await getBulkChallans({
        programId: bulkPrintFilters.programId === "all" ? "" : bulkPrintFilters.programId,
        classId: bulkPrintFilters.classId === "all" ? "" : bulkPrintFilters.classId,
        sectionId: bulkPrintFilters.sectionId === "all" ? "" : bulkPrintFilters.sectionId,
        month: targetMonth,
        year: year,
      });

      const challans = response || [];
      if (challans.length === 0) {
        toast({ title: "No challans found", description: "No challans match the selected filters for this month.", variant: "destructive" });
        return;
      }

      const hasNewSchema = challans.some(c => c.snapshotTotalDue != null || c.installmentId != null);

      if (hasNewSchema) {
        const normalizedChallans = challans.map(normalizeChallan);
        await renderAndPrintChallans({
          title: "Monthly Challans",
          toast,
          renderers: normalizedChallans.map(challan => () => {
            const html = generateChallanHtml(challan, null, { lateFeeRatePerDay, classes, programs, feeHeads, feeChallans, academicSessions });
            return applyPaidChallanPrintTreatment(html, challan);
          }),
        });
        setBulkPrintOpen(false);
        return;
      }

      const template = await getDefaultFeeChallanTemplate("INSTALLMENT");
      if (!template || !template.htmlContent) {
        toast({ title: "Template Missing", description: "No default challan template found.", variant: "destructive" });
        return;
      }

      let previewHtml = "";
      const previewLimit = 5;
      const previewChallans = challans.slice(0, previewLimit);

      previewChallans.forEach((challan) => {
        const challanHtml = generateChallanHtml(challan, template.htmlContent, { lateFeeRatePerDay, classes, programs, feeHeads, feeChallans, academicSessions });
        previewHtml += `
          <div class="bulk-challan-item" style="margin-bottom: 40px; border-bottom: 2px dashed #e2e8f0; padding-bottom: 40px;">
            ${challanHtml}
          </div>
        `;
      });

      setBulkChallansList(challans);
      setBulkPreviewContent(previewHtml);
      setBulkPrintOpen(false);
      setBulkPreviewOpen(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to process bulk print request.", variant: "destructive" });
    } finally {
      setBulkPrinting(false);
    }
  };

  const finalizeBulkPrint = async () => {
    try {
      setBulkPreviewPrinting(true);
      const template = await getDefaultFeeChallanTemplate("INSTALLMENT");
      if (!template || !template.htmlContent) {
        toast({ title: "Template Missing", description: "No default challan template found.", variant: "destructive" });
        return;
      }

      await renderAndPrintChallans({
        title: "All Challans",
        toast,
        renderers: bulkChallansList.map((challan) => () => {
          const html = generateChallanHtml(challan, template.htmlContent, { lateFeeRatePerDay, classes, programs, feeHeads, feeChallans, academicSessions });
          return applyPaidChallanPrintTreatment(html, challan);
        }),
      });

      setBulkPreviewOpen(false);
    } catch (error) {
      console.error(error);
      toast({ title: "Print Failed", description: "Could not generate full print document.", variant: "destructive" });
    } finally {
      setBulkPreviewPrinting(false);
    }
  };

  const handleEditChallan = async (challan) => {
    setEditingChallan(challan);
    let fetchedPlan = [];
    const effectiveStudentId = extractId(challan.studentId || challan.student?._id || challan.student);
    try {
      if (effectiveStudentId) {
        const results = await getInstallmentPlans({ studentId: effectiveStudentId });
        fetchedPlan = results[0]?.feeInstallments || [];
        setGenStudentPlan(fetchedPlan);
      }
    } catch (error) { console.error("Failed to fetch plan for edit:", error); }

    const rawCandidateHeads = [];
    const addCandidateHeads = (arr) => {
      if (!arr) return;
      let parsed = arr;
      if (typeof arr === "string") {
        try { parsed = JSON.parse(arr); } catch (e) { parsed = []; }
      }
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (item) rawCandidateHeads.push(item);
        });
      }
    };

    addCandidateHeads(challan.challanHeads);
    addCandidateHeads(challan.selectedHeads);
    addCandidateHeads(challan.heads);
    addCandidateHeads(challan.installment?.challanHeads);
    addCandidateHeads(challan.installment?.heads);
    addCandidateHeads(challan.installment?.selectedHeads);

    if (rawCandidateHeads.length === 0 && Array.isArray(fetchedPlan)) {
      const matchingInst = fetchedPlan.find(inst =>
        (challan.installmentId && extractId(inst._id || inst.id) === extractId(challan.installmentId)) ||
        (challan.installmentNumber && Number(inst.installmentNumber) === Number(challan.installmentNumber)) ||
        (challan.month && inst.month && String(challan.month).trim().toLowerCase() === String(inst.month).trim().toLowerCase())
      );
      if (matchingInst) {
        addCandidateHeads(matchingInst.challanHeads);
        addCandidateHeads(matchingInst.heads);
        addCandidateHeads(matchingInst.selectedHeads);
      }
    }

    const nonTuitionCatalogHeads = (feeHeads || []).filter(h => !h.isTuition);
    const matchedHeadIds = new Set();
    const customHeadsList = [];

    rawCandidateHeads.forEach(item => {
      if (!item) return;
      const itemId = typeof item === 'object' ? extractId(item.id || item._id || item.headId) : extractId(item);
      const itemName = typeof item === 'object' ? (item.headName || item.name) : null;
      const catalogMatch = nonTuitionCatalogHeads.find(h =>
        (itemId && extractId(h.id || h._id) === itemId) ||
        (itemName && String(h.name).trim().toLowerCase() === String(itemName).trim().toLowerCase())
      );

      if (catalogMatch) {
        matchedHeadIds.add(extractId(catalogMatch.id || catalogMatch._id));
      } else if (typeof item === 'object' && item.name && item.amount) {
        customHeadsList.push({ name: item.name, amount: Number(item.amount) || 0 });
      }
    });

    let foundOtherHead = null;
    if (customHeadsList.length === 1) {
      foundOtherHead = {
        name: customHeadsList[0].name || 'Other',
        amount: customHeadsList[0].amount || 0
      };
    } else if (customHeadsList.length > 1) {
      const totalCustom = customHeadsList.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
      const names = customHeadsList.map(h => h.name).filter(Boolean).join(', ');
      foundOtherHead = {
        name: names || 'Other',
        amount: totalCustom
      };
    }

    const selectedHeadIds = Array.from(matchedHeadIds);

    setChallanForm({
      studentId: effectiveStudentId,
      amount: (challan.basePayable || challan.snapshotBaseAmount || challan.amount || 0).toString(),
      dueDate: challan.dueDate ? new Date(challan.dueDate) : null,
      remarks: challan.remarks || "",
      installmentNumber: (challan.installmentNumber || 0).toString(),
      arrearsAmount: (challan.arrearsAmount || challan.snapshotArrearsAmount || 0).toString(),
      arrearsSelections: [],
      isOtherEnabled: !!foundOtherHead,
      otherName: foundOtherHead?.name || "Other",
      otherAmount: foundOtherHead ? String(foundOtherHead.amount || 0) : "0",
      selectedHeads: selectedHeadIds,
      fineAmount: (challan.lateFeeAmount || challan.snapshotLateFee || challan.lateFeeFine || challan.fineAmount || 0).toString(),
      discount: Math.abs(challan.discountAmount || challan.discount || 0),
    });
    setChallanOpen(true);
  };

  const handleSubmitChallan = () => {
    if (!challanForm.studentId || !challanForm.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    const tuitionToStore = Math.round(parseFloat(challanForm.amount) || 0);
    const additionalToStore = Math.round(Number(challanForm.fineAmount) || 0);
    const discountToStore = Math.round(parseFloat(challanForm.discount) || 0);
    const selectedHeadIds = (challanForm.selectedHeads || []).map(extractId);

    const allFeeHeadDetails = (feeHeads || [])
      .filter(h => selectedHeadIds.includes(extractId(h.id || h._id)))
      .map(h => ({
        id: extractId(h.id || h._id),
        headId: extractId(h.id || h._id),
        name: h.name,
        amount: Math.round(Number(h.amount) || 0),
        category: h.type || 'monthly',
        type: h.isTuition ? 'tuition' : 'additional',
        isCustom: false,
        isSelected: true,
      }));

    if (challanForm.isOtherEnabled && parseFloat(challanForm.otherAmount) > 0) {
      allFeeHeadDetails.push({
        id: -1,
        name: challanForm.otherName?.trim() || 'Other',
        amount: Math.round(parseFloat(challanForm.otherAmount)),
        category: 'custom',
        type: 'additional',
        isCustom: true,
        isSelected: true,
      });
    }

    if (editingChallan) {
      updateChallanMutation.mutate({
        id: editingChallan.id,
        data: {
          dueDate: challanForm.dueDate ? format(challanForm.dueDate, "yyyy-MM-dd") : undefined,
          amount: tuitionToStore,
          fineAmount: additionalToStore,
          discount: discountToStore,
          remarks: challanForm.remarks,
          selectedHeads: allFeeHeadDetails,
          challanHeads: allFeeHeadDetails,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fee Challans</CardTitle>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* Search */}
            <Input
              placeholder="Challan #, name, roll..."
              value={challanSearch}
              onChange={(e) => { setChallanSearch(e.target.value); setPage(1); }}
              className="w-[180px] h-9 text-xs"
            />

            {/* Program Filter */}
            <Select
              value={selectedProgram}
              onValueChange={(v) => {
                setSelectedProgram(v);
                setSelectedClass("all");
                setSelectedSection("all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={extractId(p)} value={extractId(p)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Class Filter */}
            <Select
              value={selectedClass}
              onValueChange={(v) => {
                setSelectedClass(v);
                setSelectedSection("all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {filterAvailableClasses.map((c) => (
                  <SelectItem key={extractId(c)} value={extractId(c)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Section Filter (if applicable by allowSections in class) */}
            <Select
              value={selectedSection}
              disabled={!isTableClassSelected || !allowSectionsForTableClass}
              onValueChange={(v) => {
                setSelectedSection(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px] h-9 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                <SelectValue
                  placeholder={
                    !isTableClassSelected
                      ? "All Sections"
                      : !allowSectionsForTableClass
                      ? "N/A for class"
                      : "All Sections"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {filterAvailableSections.map((s) => (
                  <SelectItem key={extractId(s)} value={extractId(s)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filter icon popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 gap-1.5 ${
                    (challanFilter.length > 0 || challanSessionFilter !== activeSessionId || selectedProgram !== "all" || selectedClass !== "all" || selectedSection !== "all" || selectedInstallment !== "all" || selectedMonth)
                      ? "border-primary text-primary"
                      : ""
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {(challanFilter.length > 0 || challanSessionFilter !== activeSessionId || selectedProgram !== "all" || selectedClass !== "all" || selectedSection !== "all" || selectedInstallment !== "all" || selectedMonth) && (
                    <span className="ml-0.5 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                      {[
                        challanFilter.length > 0 ? 1 : 0,
                        challanSessionFilter !== activeSessionId ? 1 : 0,
                        selectedProgram !== "all" ? 1 : 0,
                        selectedClass !== "all" ? 1 : 0,
                        selectedSection !== "all" ? 1 : 0,
                        selectedInstallment !== "all" ? 1 : 0,
                        selectedMonth ? 1 : 0,
                      ].reduce((a, b) => a + b, 0)}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-4 max-h-[80vh] overflow-y-auto" align="start" side="bottom" sideOffset={4}>
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground">Filters</p>

                  {/* Program */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Program</Label>
                    <Select
                      value={selectedProgram}
                      onValueChange={(v) => {
                        setSelectedProgram(v);
                        setSelectedClass("all");
                        setSelectedSection("all");
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="All Programs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Programs</SelectItem>
                        {programs.map((p) => (
                          <SelectItem key={extractId(p)} value={extractId(p)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Class */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Class</Label>
                    <Select
                      value={selectedClass}
                      onValueChange={(v) => {
                        setSelectedClass(v);
                        setSelectedSection("all");
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="All Classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {filterAvailableClasses.map((c) => (
                          <SelectItem key={extractId(c)} value={extractId(c)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Section */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Section</Label>
                      {isTableClassSelected && !allowSectionsForTableClass && (
                        <span className="text-[10px] text-amber-600 font-medium">N/A for class</span>
                      )}
                    </div>
                    <Select
                      value={selectedSection}
                      disabled={!isTableClassSelected || !allowSectionsForTableClass}
                      onValueChange={(v) => {
                        setSelectedSection(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        <SelectValue
                          placeholder={
                            !isTableClassSelected
                              ? "All Sections"
                              : !allowSectionsForTableClass
                              ? "N/A for class"
                              : "All Sections"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {filterAvailableSections.map((s) => (
                          <SelectItem key={extractId(s)} value={extractId(s)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { value: "pending", label: "Pending" },
                        { value: "partial", label: "Partial" },
                        { value: "paid", label: "Paid" },
                        { value: "overdue", label: "Overdue" },
                        { value: "void", label: "Voided" },
                        { value: "superseded", label: "Superseded" },
                        { value: "settled", label: "Settled" },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-input accent-primary"
                            checked={challanFilter.includes(value)}
                            onChange={(e) => {
                              setChallanFilter(prev =>
                                e.target.checked ? [...prev, value] : prev.filter(v => v !== value)
                              );
                              setPage(1);
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Session */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Session</Label>
                    <Select value={challanSessionFilter} onValueChange={(v) => { setChallanSessionFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="All Sessions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sessions</SelectItem>
                        {academicSessions.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.name}{s.isActive ? " (Active)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Installment */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Installment</Label>
                    <Select value={selectedInstallment} onValueChange={(v) => { setSelectedInstallment(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="All Installments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Installments</SelectItem>
                        {Array.from({ length: Math.max(...feeStructures.map(s => s.installments || 0), 12) }, (_, i) => i + 1).map(num => (
                          <SelectItem key={num} value={num.toString()}>Installment #{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Month */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Month</Label>
                      {selectedMonth && (
                        <button
                          type="button"
                          onClick={() => { setSelectedMonth(""); setPage(1); }}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <MonthPicker
                      value={selectedMonth}
                      onChange={(val) => { setSelectedMonth(val); setPage(1); }}
                      className="h-8 text-xs"
                      placeholder="All Months"
                    />
                  </div>

                  {/* Reset */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-muted-foreground text-xs"
                    onClick={() => {
                      setChallanSearch("");
                      setChallanFilter([]);
                      setChallanSessionFilter(activeSessionId);
                      setSelectedProgram("all");
                      setSelectedClass("all");
                      setSelectedSection("all");
                      setSelectedInstallment("all");
                      setSelectedMonth("");
                      setPage(1);
                    }}
                  >
                    <X className="w-3 h-3 mr-1" /> Reset all filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Active filter chips */}
            <div className="flex flex-wrap gap-1.5 flex-1">
              {challanFilter.map(f => (
                <span key={f} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <button onClick={() => { setChallanFilter(prev => prev.filter(v => v !== f)); setPage(1); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {challanSessionFilter !== activeSessionId && challanSessionFilter !== "all" && (
                <span key="sess" className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  {academicSessions.find(s => s.id.toString() === challanSessionFilter)?.name || "Session"}
                  <button onClick={() => { setChallanSessionFilter(activeSessionId); setPage(1); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedProgram !== "all" && (
                <span key="prog" className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  {programs.find(p => extractId(p) === selectedProgram)?.name || "Program"}
                  <button onClick={() => { setSelectedProgram("all"); setSelectedClass("all"); setSelectedSection("all"); setPage(1); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedClass !== "all" && (
                <span key="cls" className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  {classes.find(c => extractId(c) === selectedClass)?.name || "Class"}
                  <button onClick={() => { setSelectedClass("all"); setSelectedSection("all"); setPage(1); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedSection !== "all" && (
                <span key="sec" className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  {sections.find(s => extractId(s) === selectedSection)?.name || "Section"}
                  <button onClick={() => { setSelectedSection("all"); setPage(1); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedInstallment !== "all" && (
                <span key="inst" className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  Inst #{selectedInstallment}
                  <button onClick={() => { setSelectedInstallment("all"); setPage(1); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedMonth && (
                <span key="m" className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  {selectedMonth}
                  <button onClick={() => { setSelectedMonth(""); setPage(1); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>


            {/* Generate button */}
            {canCreate && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setGenerateResults(null);
                  setGenerateDialogOpen(true);
                }}
                className="h-9 gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" /> Generate Challans
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Challan No</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground">Student</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Installment</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Base Payable</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Arrears</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground hidden xl:table-cell">Extra/Heads</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground hidden xl:table-cell">Fine (Late Fee)</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-foreground bg-slate-100 whitespace-nowrap min-w-[105px]">Total</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-green-700 bg-green-50 hidden lg:table-cell">Paid Amount</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Due Date</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="py-2 px-2 sm:px-3 text-xs text-right font-semibold text-muted-foreground hidden md:table-cell">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isChallansLoading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8">Loading challans...</TableCell></TableRow>
                ) : feeChallans.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground italic">No challans found.</TableCell></TableRow>
                ) : feeChallans.map((challan, idx) => {
                  return (
                    <TableRow
                      key={challan.id}
                      className={cn("cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted/80", idx % 2 === 1 ? "bg-muted/20" : "")}
                      onClick={() => {
                        setSelectedChallanDetails(challan);
                        setDetailsDialogOpen(true);
                      }}
                    >
                      <TableCell className="text-xs sm:text-sm px-2 sm:px-3 font-medium hidden sm:table-cell">{challan.challanNumber}</TableCell>
                      <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm">
                        {(() => {
                          const sName = challan.studentName || `${challan.student?.fName || ''} ${challan.student?.lName || ''}`.trim() || "Student";
                          const fName = challan.fatherName || challan.student?.fatherOrguardian || challan.student?.fatherName || "";
                          const roll = challan.rollNumber || challan.rollNo || challan.student?.rollNumber || "";
                          return (
                            <>
                              <div className="font-medium truncate max-w-[140px] sm:max-w-[220px] leading-tight">
                                {sName}
                              </div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate leading-tight mt-0.5">
                                {roll && <span className="font-mono shrink-0">{roll}</span>}
                                {roll && fName && <span className="text-muted-foreground/40 shrink-0">·</span>}
                                {fName && (
                                  <span className="truncate text-[10px] text-muted-foreground/80 font-normal">
                                    {fName}
                                  </span>
                                )}
                                <span className="sm:hidden text-primary font-semibold shrink-0 ml-auto">#{challan.challanNumber}</span>
                              </div>
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 font-bold text-slate-800">
                            {challan.month || (challan.installmentNumber === 0 ? "Extra" : `Inst #${challan.installmentNumber}`)}
                            {challan.installment?.isLocked && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center cursor-help">
                                    <Lock className="w-3 h-3 text-slate-400" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">Installment is locked (fully paid)</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {challan.session && (
                            <div className="text-[10px] text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded inline-block w-fit">
                              {challan.session}
                            </div>
                          )}
                          {!challan.month && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(challan.coveredInstallments || (challan.installmentNumber === 0 ? "Extra" : `${challan.installmentNumber}`)).split(/[,|-]/).map((num, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] h-4 min-w-[20px] justify-center px-1 rounded-full bg-slate-50 border-slate-200 text-slate-600 font-medium">
                                  {num.trim()}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm px-2 sm:px-3 font-medium hidden lg:table-cell">
                        PKR {formatAmount(challan.snapshotBaseAmount ?? challan.amount)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm px-2 sm:px-3 font-medium hidden lg:table-cell">
                        {(() => {
                          const arrearsVal = challan.arrearsAmount != null
                            ? Number(challan.arrearsAmount)
                            : (challan.snapshotArrearsAmount != null
                                ? Number(challan.snapshotArrearsAmount)
                                : (Array.isArray(challan.arrearAllocations) && challan.arrearAllocations.length > 0
                                    ? challan.arrearAllocations.reduce((sum, a) => sum + (Number(a.amountCarriedForward) || 0), 0)
                                    : Number(getTotalArrears(challan) || 0)
                                  )
                              );
                          return arrearsVal > 0 ? (
                            <span className="text-amber-600 font-semibold">PKR {formatAmount(arrearsVal)}</span>
                          ) : (
                            <span className="text-muted-foreground/60">PKR 0</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm px-2 sm:px-3 font-medium text-orange-600 hidden xl:table-cell">
                        {(() => {
                          const headsAmount = Number(getSelectedHeadsTotal(challan) || 0);
                          const extraFineAmount = Number(challan.snapshotExtraFine ?? challan.installment?.extraFine ?? 0);
                          const absentiesFineAmount = Number(challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine ?? 0);
                          const discountRaw = Number(challan.snapshotDiscount ?? challan.discount ?? challan.installment?.discount ?? 0);
                          const discountTerm = discountRaw > 0 ? -discountRaw : discountRaw;
                          const extraHeadsDisplay = headsAmount + extraFineAmount + absentiesFineAmount + discountTerm;
                          return (
                            <span>PKR {formatAmount(extraHeadsDisplay)}</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm px-2 sm:px-3 font-medium text-red-600 hidden xl:table-cell">
                        {(() => {
                          const isSettledOrVoid = ['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(challan.status);
                          const existingFine = Number(challan.snapshotLateFee ?? challan.lateFeeAmount ?? challan.lateFeeFine ?? 0);
                          const autoFine = (!isSettledOrVoid && challan.dueDate)
                            ? calculateLateFee(challan.dueDate, lateFeeRatePerDay || challan.installment?.lateFeeRatePerDay || 0)
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
                        {challan.status === "VOID" && ((challan.snapshotLateFee ?? challan.lateFeeFine) || 0) > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-1 inline-flex items-center cursor-help">
                                <AlertCircle className="w-3 h-3 text-amber-500" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">
                              Late fee of PKR {formatAmount(challan.snapshotLateFee ?? challan.lateFeeFine)} is preserved for audit.
                              {challan.supersededBy ? ` Included in Challan #${challan.supersededBy.challanNumber}.` : " Rolled into superseding challan."}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm px-2 sm:px-3 font-bold bg-slate-50/50 whitespace-nowrap min-w-[105px]">
                        {(() => {
                          const isSettledOrVoid = ['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(challan.status);
                          const existingFine = Number(challan.snapshotLateFee ?? challan.lateFeeAmount ?? challan.lateFeeFine ?? 0);
                          const effectiveRate = Number(
                            challan.installment?.lateFeeRatePerDay ??
                            challan.lateFeeRatePerDay ??
                            lateFeeRatePerDay ??
                            0
                          );
                          const autoFine = (!isSettledOrVoid && challan.dueDate && effectiveRate > 0)
                            ? calculateLateFee(challan.dueDate, effectiveRate)
                            : 0;
                          const effectiveFine = existingFine > 0 ? existingFine : autoFine;

                          const grossTotal = getChallanGrossTotal(challan);
                          const fineIncluded = existingFine > 0 && Number(challan.lateFeeAmount || challan.snapshotLateFee || 0) > 0;
                          const totalWithFine = fineIncluded ? grossTotal : (grossTotal + effectiveFine);

                          const advanceApplied = Number(challan.advanceApplied || challan.advanceAmount || 0);
                          const directPaid = Number(challan.directPaidAmount ?? challan.paidAmount ?? 0);
                          const netDue = Math.max(0, totalWithFine - advanceApplied - (challan.status === 'SETTLED' ? 0 : directPaid));

                          return (
                            <div className="flex flex-col gap-0.5 whitespace-nowrap">
                              <span className="font-bold text-slate-900">PKR {formatAmount(totalWithFine)}</span>
                              {advanceApplied > 0 && (
                                <span className="text-[11px] text-purple-700 font-semibold font-mono whitespace-nowrap" title={`Net after PKR ${formatAmount(advanceApplied)} advance`}>
                                  Net: PKR {formatAmount(netDue)}
                                </span>
                              )}
                              <div className="md:hidden text-[10px] font-normal text-muted-foreground mt-0.5 whitespace-nowrap">
                                {challan.month || (challan.installmentNumber === 0 ? "Extra" : `Inst #${challan.installmentNumber}`)}
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm px-2 sm:px-3 bg-green-50/50 hidden lg:table-cell">
                        {(() => {
                          const directPaid = Number(challan.directPaidAmount ?? challan.paidAmount ?? 0);
                          const settledArrears = Number(challan.settledViaArrearsAmount ?? challan.settledAmount ?? 0);
                          const isSettled = challan.status === 'SETTLED';
                          const hasArrearsSettlement = settledArrears > 0 || (isSettled && directPaid < (challan.netPayable || challan.totalAmount || 0));
                          const effectiveSettledArrears = settledArrears > 0 
                            ? settledArrears 
                            : (isSettled ? Math.max(0, (challan.netPayable || challan.totalAmount || 0) - directPaid) : 0);
                          const totalEffective = Number(challan.totalSettledAmount ?? (directPaid + effectiveSettledArrears));
                          const settledInChallan = challan.settledByChallanNo || challan.settledByChallanNumber || (challan.supersededBy?.challanNumber || challan.supersededBy?.challanNo);

                          const advanceApplied = Number(challan.advanceApplied || 0);
                          const advanceFromChallanNo = challan.advanceFromChallanNo;
                          const advanceFromMonth = challan.advanceFromMonth;
                          const excessCreditGenerated = Number(challan.excessCreditGenerated || 0);
                          const creditAdjustedTo = Array.isArray(challan.creditAdjustedTo) ? challan.creditAdjustedTo : [];
                          const creditRemaining = Number(challan.creditRemaining || 0);
                          const netPayable = Number(challan.netPayable || challan.totalAmount || 0);
                          const isOverpaid = excessCreditGenerated > 0 || creditAdjustedTo.length > 0 || (directPaid > netPayable && netPayable > 0);

                          if (hasArrearsSettlement && effectiveSettledArrears > 0) {
                            return (
                              <div className="flex flex-col gap-0.5 min-w-[130px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-emerald-700 font-mono text-sm">
                                    PKR {formatAmount(totalEffective)}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-300 text-emerald-700 bg-emerald-50">
                                    Total Settled
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap text-[10px] leading-tight mt-0.5">
                                  <span className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded font-medium border border-slate-200">
                                    Direct: PKR {formatAmount(directPaid)}
                                  </span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded font-medium cursor-help inline-flex items-center gap-0.5 border border-amber-200">
                                        <span>Settled: PKR {formatAmount(effectiveSettledArrears)}</span>
                                        {settledInChallan && <span className="font-mono font-semibold">#{settledInChallan}</span>}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-xs">
                                      <p className="font-semibold text-amber-700 mb-0.5">Settled via Arrears Roll-Forward</p>
                                      <p>PKR {formatAmount(effectiveSettledArrears)} was rolled into {settledInChallan ? `Challan #${settledInChallan}` : 'subsequent challan'} and settled when that challan was paid.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            );
                          }

                          if (advanceApplied > 0 || advanceFromChallanNo) {
                            const advAmount = advanceApplied || directPaid;
                            return (
                              <div className="flex flex-col gap-0.5 min-w-[130px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-purple-700 font-mono text-sm">
                                    PKR {formatAmount(directPaid || advAmount)}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-purple-300 text-purple-700 bg-purple-50">
                                    Advance Paid
                                  </Badge>
                                </div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-purple-800 bg-purple-50 px-1 py-0.5 rounded text-[10px] font-medium cursor-help inline-flex items-center gap-1 border border-purple-200 max-w-fit">
                                      <span>Paid via Advance</span>
                                      {advanceFromChallanNo && (
                                        <span className="font-mono font-semibold">
                                          ({advanceFromMonth ? `${advanceFromMonth} ` : ''}#{advanceFromChallanNo})
                                        </span>
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-xs">
                                    <p className="font-semibold text-purple-700 mb-0.5">Paid via Advance Overpayment</p>
                                    <p>PKR {formatAmount(advAmount)} was settled using advance credit{advanceFromChallanNo ? ` from ${advanceFromMonth ? `${advanceFromMonth} ` : ''}Challan #${advanceFromChallanNo}` : ''}.</p>
                                    {Array.isArray(challan.advanceAllocations) && challan.advanceAllocations.length > 1 && (
                                      <ul className="mt-1 space-y-0.5 text-[11px]">
                                        {challan.advanceAllocations.map((a, idx) => (
                                          <li key={idx}>• PKR {formatAmount(a.amountApplied || a.amount)} from {a.sourceMonth || ''} #{a.sourceChallanNo}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            );
                          }

                          if (isOverpaid) {
                            const excessAmt = excessCreditGenerated || Math.max(0, directPaid - netPayable);
                            return (
                              <div className="flex flex-col gap-0.5 min-w-[130px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-emerald-700 font-mono text-sm">
                                    PKR {formatAmount(directPaid)}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-300 text-blue-700 bg-blue-50">
                                    Overpaid
                                  </Badge>
                                </div>
                                <div className="flex flex-col gap-0.5 text-[10px] leading-tight mt-0.5">
                                  {creditAdjustedTo.length > 0 ? (
                                    creditAdjustedTo.map((adj, i) => (
                                      <Tooltip key={i}>
                                        <TooltipTrigger asChild>
                                          <span className="text-blue-800 bg-blue-50 px-1 py-0.5 rounded font-medium cursor-help inline-flex items-center gap-1 border border-blue-200">
                                            <span>↳ PKR {formatAmount(adj.amount || adj.amountApplied)} to</span>
                                            <span className="font-mono font-semibold">
                                              {adj.month || adj.targetMonth ? `${adj.month || adj.targetMonth} ` : ''}#{adj.challanNo || adj.targetChallanNo}
                                            </span>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs text-xs">
                                          <p className="font-semibold text-blue-700 mb-0.5">Advance Credit Transferred</p>
                                          <p>PKR {formatAmount(adj.amount || adj.amountApplied)} overpayment was adjusted to {adj.month || adj.targetMonth ? `${adj.month || adj.targetMonth} ` : ''}Challan #{adj.challanNo || adj.targetChallanNo}.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ))
                                  ) : null}
                                  {creditRemaining > 0 ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded font-medium cursor-help inline-flex items-center gap-1 border border-emerald-200">
                                          <span>↳ PKR {formatAmount(creditRemaining)} in Advance Credit</span>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-xs">
                                        <p className="font-semibold text-emerald-700 mb-0.5">Remaining Advance Credit</p>
                                        <p>PKR {formatAmount(creditRemaining)} remains available in credit for upcoming installments.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                  {creditAdjustedTo.length === 0 && creditRemaining === 0 && excessAmt > 0 && (
                                    <span className="text-blue-800 bg-blue-50 px-1 py-0.5 rounded font-medium border border-blue-200">
                                      ↳ PKR {formatAmount(excessAmt)} in Advance Credit
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <span className="text-success font-medium">
                              PKR {formatAmount(directPaid)}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm hidden md:table-cell">
                        {challan.dueDate ? new Date(challan.dueDate).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm">
                        <div className="flex flex-col gap-1">
                          <Badge variant={challan.status === "PAID" ? "default" : challan.status === "OVERDUE" ? "destructive" : challan.status === "PARTIAL" ? "secondary" : (challan.status === "VOID" || challan.status === "SUPERSEDED" || challan.status === "SETTLED") ? "outline" : "secondary"}>
                            {challan.status === "VOID" ? "Voided" : 
                             (challan.status === "SUPERSEDED" && (challan.settledAmount || challan.settledViaArrearsAmount || 0) > 0) ? "Partially Settled" :
                             challan.status === "SUPERSEDED" ? "Superseded" : 
                             challan.status === "SETTLED" ? "Settled" : challan.status}
                          </Badge>
                          {(() => {
                            const settledChallanNum = challan.settledByChallanNo || challan.settledByChallanNumber || (challan.supersededBy?.challanNumber || challan.supersededBy?.challanNo);
                            const advNum = challan.advanceFromChallanNo;
                            const advMonth = challan.advanceFromMonth;
                            if (advNum && (challan.status === "PAID" || challan.status === "PARTIAL")) {
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-0.5 text-[9px] text-purple-700 cursor-help">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                      <span className="font-semibold truncate max-w-[120px]">via Advance #{advNum}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    Paid via advance credit from {advMonth ? `${advMonth} ` : ''}Challan #{advNum}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            if ((challan.status === "SUPERSEDED" || challan.status === "SETTLED" || challan.status === "PAID") && settledChallanNum) {
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground cursor-help">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-green-500 shrink-0" />
                                      <span className="text-green-600 font-medium">via #{settledChallanNum}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    {challan.status === "PAID"
                                      ? `Paid indirectly via leading challan #${settledChallanNum}`
                                      : challan.status === "SETTLED"
                                      ? `Settled — balance was paid via leading challan #${settledChallanNum}`
                                      : `Debt absorbed into challan #${settledChallanNum}`}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            return null;
                          })()}
                          {challan.status === "VOID" && challan.supersededBy && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground cursor-help">
                                  <span className="truncate max-w-[80px]">{challan.month || `Inst #${challan.installmentNumber}`}</span>
                                  <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate max-w-[80px] font-medium text-slate-600">#{challan.supersededBy.challanNumber}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                <p className="font-semibold mb-1">Superseding Chain</p>
                                <p>This installment's debt was rolled into Challan #{challan.supersededBy.challanNumber}.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {Number(challan.advanceAmount || 0) > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5 text-[9px] text-blue-600 font-bold cursor-help mt-0.5">
                                  <div className="bg-blue-50 px-1 py-0.5 rounded flex items-center gap-0.5 border border-blue-100">
                                    <span className="uppercase tracking-tighter opacity-70">Adv:</span>
                                    <span>PKR {formatAmount(challan.advanceAmount)}</span>
                                    {challan.advanceFromChallanNo && <span className="opacity-70 ml-0.5">via #{challan.advanceFromChallanNo}</span>}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                {`Paid in advance from Challan #${challan.advanceFromChallanNo}`}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-2 sm:px-3 text-xs sm:text-sm text-right hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-slate-100 data-[state=open]:bg-slate-100 rounded-md"
                                title="Actions"
                              >
                                <span className="sr-only">Open actions menu</span>
                                <MoreVertical className="w-4 h-4 text-slate-600" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 z-50">
                              <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => {
                                  setSelectedChallanDetails(challan);
                                  setDetailsDialogOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4 text-slate-500" />
                                <span>View Details</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => printInstallmentChallan(challan.id, challan)}
                                disabled={printingChallanId === `installment-${challan.id}`}
                              >
                                <Printer className="w-4 h-4 text-slate-500" />
                                <span>Print Challan</span>
                              </DropdownMenuItem>

                              {canPayFee && !['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(challan.status) && (
                                <DropdownMenuItem
                                  className="cursor-pointer gap-2 text-emerald-700 focus:text-emerald-800 focus:bg-emerald-50 font-medium"
                                  onClick={() => {
                                    setItemToPay(challan);
                                    setPaymentDialogOpen(true);
                                  }}
                                >
                                  <DollarSign className="w-4 h-4 text-emerald-600" />
                                  <span>Record Payment</span>
                                </DropdownMenuItem>
                              )}

                              {canUpdate && !['PAID', 'SETTLED'].includes(challan.status) && (
                                <DropdownMenuItem
                                  className="cursor-pointer gap-2"
                                  onClick={() => handleEditChallan(challan)}
                                >
                                  <Edit className="w-4 h-4 text-blue-500" />
                                  <span>Edit Challan</span>
                                </DropdownMenuItem>
                              )}

                              {challan.paymentHistory && (
                                <DropdownMenuItem
                                  className="cursor-pointer gap-2"
                                  onClick={() => {
                                    setSelectedChallanForHistory(challan);
                                    setHistoryDialogOpen(true);
                                  }}
                                >
                                  <History className="w-4 h-4 text-slate-500" />
                                  <span>Payment History</span>
                                </DropdownMenuItem>
                              )}

                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => {
                                      setItemToDelete({
                                        type: "challan",
                                        id: challan.id,
                                        status: challan.status,
                                        number: challan.challanNumber
                                      });
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                    <span>Delete Challan</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isChallansLoading && feeChallans.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No fee challans found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {feeChallans.length} of {challanMeta?.total || 0} challans
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isChallansLoading}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {challanMeta?.lastPage || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= (challanMeta?.lastPage || 1) || isChallansLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Monthly Challans Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={(open) => {
        setGenerateDialogOpen(open);
        if (!open) {
          setGenerateResults(null);
          setBulkDueDate(null);
          setBulkStudents([]);
          setSelectedBulkStudents([]);
          setGenerationErrors({});
        }
      }}>
        <DialogContent className="max-w-4xl p-3 md:p-4 max-h-[96vh] flex flex-col overflow-hidden">
          <DialogHeader className="pb-1 border-b mb-2">
            <DialogTitle className="text-base font-bold">Generate Monthly Challans</DialogTitle>
          </DialogHeader>

          <div className="mx-4 mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-[11px] text-yellow-800 leading-tight">
            <strong>Hint:</strong> To generate challans for fee heads like Fine, Lab Fee, Library Fee, etc. (not tied to installments), please use the <strong>"Extra Challans"</strong> tab.
          </div>

          {!generateResults ? (
            <div className="space-y-2 py-0 overflow-y-auto overflow-x-hidden pr-1 flex-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              <div className="space-y-3">
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Select Month</Label>
                    <MonthPicker
                      value={generateForm.month}
                      onChange={(val) => setGenerateForm(prev => ({ ...prev, month: val }))}
                      className="h-8 text-xs"
                      placeholder="Select Month"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full h-8 text-xs justify-start text-left font-normal px-2", !bulkDueDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {bulkDueDate ? format(bulkDueDate, "PP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={bulkDueDate} onSelect={setBulkDueDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Session</Label>
                    <Select
                      value={generateForm.sessionId}
                      onValueChange={(v) => {
                        sessionManuallySet.current = true;
                        setGenerateForm(prev => ({ ...prev, sessionId: v }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sessions</SelectItem>
                        {academicSessions.map(s => (
                          <SelectItem key={extractId(s)} value={extractId(s)}>
                            {s.name} {s.isActive ? "(Current)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Program</Label>
                    <Select
                      value={generateForm.programId}
                      onValueChange={(v) => setGenerateForm(prev => ({ ...prev, programId: v, classId: "all", sectionId: "all" }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Programs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Programs</SelectItem>
                        {programs.map(p => <SelectItem key={extractId(p)} value={extractId(p)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Class</Label>
                    <Select
                      value={generateForm.classId}
                      onValueChange={(v) => setGenerateForm(prev => ({ ...prev, classId: v, sectionId: "all" }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {availableClasses.map(c => (
                          <SelectItem key={extractId(c)} value={extractId(c)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Section</Label>
                      {isGenClassSelected && !allowSectionsForGenClass && (
                        <span className="text-[9px] text-amber-600 font-medium">N/A for class</span>
                      )}
                    </div>
                    <Select
                      value={generateForm.sectionId}
                      disabled={!isGenClassSelected || !allowSectionsForGenClass}
                      onValueChange={(v) => setGenerateForm(prev => ({ ...prev, sectionId: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                        <SelectValue
                          placeholder={
                            !isGenClassSelected
                              ? "Select class first"
                              : !allowSectionsForGenClass
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
              </div>

              {/* Student List */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                    Students ({selectedBulkStudents.length} of {bulkStudents.length} selected)
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setSelectedBulkStudents(bulkStudents.map(s => s.id))}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-red-500"
                      onClick={() => setSelectedBulkStudents([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="h-7 text-[10px]">
                        <TableHead className="w-8 p-1 text-center">#</TableHead>
                        <TableHead className="p-1">Student</TableHead>
                        <TableHead className="p-1 text-right">Base Tuition</TableHead>
                        <TableHead className="p-1 text-right">Arrears</TableHead>
                        <TableHead className="p-1 text-right">Absent Fine</TableHead>
                        <TableHead className="p-1 text-right">Advance Credit</TableHead>
                        <TableHead className="p-1 text-right">Net Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isFetchingBulkStudents ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground">Fetching students...</TableCell></TableRow>
                      ) : bulkStudents.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground italic">No students match filter.</TableCell></TableRow>
                      ) : (
                        bulkStudents.map(student => {
                          const [, sm] = (generateForm.month || '').split('-').map(Number);
                          const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                          const mName = sm ? (monthNames[sm - 1] || '').toLowerCase() : '';
                          const matchingInst = (student.feeInstallments || []).find(i => (i.month || '').trim().toLowerCase() === mName);
                          const baseAmount = matchingInst?.amount || matchingInst?.basePayable || student.tuitionFee || 0;
                          const currentInstNumber = matchingInst?.installmentNumber || 1;
                          const currentDueDate = matchingInst?.dueDate ? new Date(matchingInst.dueDate) : (bulkDueDate || new Date());

                          // Calculate carried arrears for this student from prior unpaid challans
                          const priorChallans = Array.isArray(student.challans) ? student.challans : [];
                          const unpaidPriorChallans = priorChallans.filter(c =>
                            ['PENDING', 'PARTIAL', 'OVERDUE'].includes(c.status) &&
                            (c.month || '').trim().toLowerCase() !== mName &&
                            (c.installmentNumber < currentInstNumber || (c.dueDate && new Date(c.dueDate) < currentDueDate))
                          );

                          const arrearsFromChallans = unpaidPriorChallans.reduce((sum, c) => {
                            const target = (c.netPayable != null && !isNaN(Number(c.netPayable)) && Number(c.netPayable) > 0)
                              ? Number(c.netPayable)
                              : (Number(c.totalAmount) || Number(c.amount) || Number(c.basePayable) || 0);
                            const paid = Number(c.paidAmount || 0);
                            return sum + Math.max(0, target - paid);
                          }, 0);

                          // Also check prior installments not yet generated into challans that are unpaid
                          const priorInsts = (student.feeInstallments || []).filter(inst => {
                            if (inst.installmentNumber >= currentInstNumber) return false;
                            const isPaid = ['PAID', 'SETTLED', 'SUPERSEDED'].includes(inst.status) || (Number(inst.pendingAmount ?? inst.amount ?? 0) <= Number(inst.paidAmount || 0) && Number(inst.paidAmount || 0) > 0);
                            const hasChallan = priorChallans.some(c =>
                              (c.installmentNumber && c.installmentNumber === inst.installmentNumber) ||
                              (c.installmentId && c.installmentId.toString() === inst._id?.toString()) ||
                              (c.month && inst.month && c.month.toLowerCase() === inst.month.toLowerCase())
                            );
                            return !isPaid && !hasChallan;
                          });

                          const arrearsFromInsts = priorInsts.reduce((sum, inst) => {
                            const pending = Number(inst.pendingAmount ?? inst.amount ?? 0) - Number(inst.paidAmount || 0);
                            return sum + Math.max(0, pending);
                          }, 0);

                          const arrearsAmount = arrearsFromChallans + arrearsFromInsts;
                          const absenteeFine = Number(student.absenteeFineAmount || 0);
                          const absenteeCount = Number(student.absenteeCount || 0);
                          const grossAmount = baseAmount + arrearsAmount + absenteeFine;
                          const availableAdvance = Number(student.availableAdvanceCredit || 0);
                          const advanceCredit = Math.min(grossAmount, availableAdvance);
                          const netAmount = Math.max(0, grossAmount - advanceCredit);

                          return (
                            <TableRow key={student.id} className="h-8 text-xs">
                              <TableCell className="w-8 p-1 text-center">
                                <input
                                  type="checkbox"
                                  className="accent-primary h-3.5 w-3.5 cursor-pointer"
                                  checked={selectedBulkStudents.includes(student.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedBulkStudents([...selectedBulkStudents, student.id]);
                                    else setSelectedBulkStudents(selectedBulkStudents.filter(id => id !== student.id));
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-1 font-medium">
                                <div className="flex flex-col">
                                  <span>
                                    {student.fName} {student.lName || ""}
                                    <span className="text-[10px] text-muted-foreground ml-1.5 uppercase">({student.rollNumber})</span>
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {student.class?.name || student.classId?.name || ""}
                                    {(student.section?.name || student.sectionId?.name) ? ` • ${student.section?.name || student.sectionId?.name}` : ""}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="p-1 text-right font-medium">
                                PKR {formatAmount(baseAmount)}
                              </TableCell>
                              <TableCell className="p-1 text-right font-medium">
                                {arrearsAmount > 0 ? (
                                  <span className="text-amber-600 font-semibold">PKR {formatAmount(arrearsAmount)}</span>
                                ) : (
                                  <span className="text-muted-foreground/60">—</span>
                                )}
                              </TableCell>
                              <TableCell className="p-1 text-right font-medium">
                                {absenteeFine > 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-rose-600 font-semibold font-mono">
                                      PKR {formatAmount(absenteeFine)}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground">
                                      {absenteeCount} {absenteeCount === 1 ? 'absentie' : 'absenties'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/60">—</span>
                                )}
                              </TableCell>
                              <TableCell className="p-1 text-right font-medium">
                                {advanceCredit > 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-purple-600 font-semibold font-mono">
                                      -PKR {formatAmount(advanceCredit)}
                                    </span>
                                    {advanceCredit >= grossAmount ? (
                                      <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                                        Fully Covered
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-purple-700 bg-purple-50 px-1 rounded border border-purple-200">
                                        Advance Adjusted
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/60">—</span>
                                )}
                              </TableCell>
                              <TableCell className="p-1 text-right font-bold text-primary">
                                <div className="flex flex-col items-end">
                                  <span className={netAmount === 0 ? "text-emerald-600 font-mono" : "text-primary font-mono"}>
                                    PKR {formatAmount(netAmount)}
                                  </span>
                                  {netAmount === 0 && grossAmount > 0 && (
                                    <span className="text-[9px] text-emerald-600 font-medium font-sans">
                                      Covered in Advance
                                    </span>
                                  )}
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

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={selectedBulkStudents.length === 0 || !bulkDueDate || isGenerating}
                  onClick={() => {
                    setIsGenerating(true);
                    bulkGenerateChallansMutation.mutate({
                      studentIds: selectedBulkStudents,
                      month: generateForm.month,
                      dueDate: format(bulkDueDate, "yyyy-MM-dd"),
                      sessionId: generateForm.sessionId !== "all" ? generateForm.sessionId : undefined,
                    });
                  }}
                >
                  {isGenerating ? "Generating..." : `Generate (${selectedBulkStudents.length})`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Generation Results</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => printGeneratedChallans(generateResults)}
                    disabled={generatedPrintingKey === "all" || !generateResults.some(r => r.challan?.id)}
                  >
                    <Printer className="w-3.5 h-3.5" /> Print All Generated
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setGenerateResults(null)}>Back to Form</Button>
                </div>
              </div>

              <div className="border rounded-lg max-h-80 overflow-y-auto">
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
                          <Badge className={cn("text-[10px] h-5", res.status === 'CREATED' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                            {res.status}
                          </Badge>
                          {res.reason && <p className="text-[9px] text-red-500 italic mt-0.5">{res.reason}</p>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {res.challanNumber || '-'}
                          {Number(res.challan?.absenteeFineAmount || 0) > 0 && (
                            <span className="block text-[9px] text-rose-600 font-sans">
                              incl. PKR {formatAmount(res.challan.absenteeFineAmount)} absent fine ({res.challan.absenteeCount})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {res.challan?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => printGeneratedChallan(res)}
                              disabled={generatedPrintingKey === res.challan.id}
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

              <div className="flex justify-end pt-2">
                <Button onClick={() => setGenerateDialogOpen(false)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Challan Dialog */}
      <Dialog open={challanOpen} onOpenChange={setChallanOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Fee Challan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2 border rounded-lg p-2 bg-muted/15">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Student</Label>
                <Input
                  value={editingChallan?.student
                    ? `${editingChallan.student.fName} ${editingChallan.student.lName || ''} (${editingChallan.student.rollNumber || ''})`.trim()
                    : (editingChallan?.studentName || "")}
                  disabled
                  className="bg-muted/50 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full h-8 text-xs justify-start text-left font-normal", !challanForm.dueDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {challanForm.dueDate ? format(challanForm.dueDate, "PPP") : "Pick due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={challanForm.dueDate} onSelect={(d) => setChallanForm({ ...challanForm, dueDate: d })} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Base Tuition Amount</Label>
                <Input
                  type="number"
                  value={challanForm.amount}
                  onChange={(e) => setChallanForm({ ...challanForm, amount: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Discount / Scholarship</Label>
                <Input
                  type="number"
                  value={challanForm.discount}
                  onChange={(e) => setChallanForm({ ...challanForm, discount: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Select Additional Fee Heads</Label>
              <div className="grid grid-cols-2 gap-2">
                {feeHeads.filter(h => !h.isTuition).map(head => {
                  const hIdStr = extractId(head.id || head._id);
                  const isChecked = (challanForm.selectedHeads || []).some(id => extractId(id) === hIdStr);
                  return (
                    <div key={hIdStr} className="flex items-center space-x-2 p-2 border rounded hover:bg-slate-50">
                      <input
                        type="checkbox"
                        id={`edit-head-${hIdStr}`}
                        className="accent-primary h-4 w-4"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentIds = (challanForm.selectedHeads || []).map(extractId);
                          if (e.target.checked) {
                            setChallanForm({ ...challanForm, selectedHeads: [...currentIds, hIdStr] });
                          } else {
                            setChallanForm({ ...challanForm, selectedHeads: currentIds.filter(id => id !== hIdStr) });
                          }
                        }}
                      />
                      <label htmlFor={`edit-head-${hIdStr}`} className="text-xs cursor-pointer flex-1 flex justify-between">
                        <span>{head.name}</span>
                        <span className="text-muted-foreground font-semibold">PKR {Number(head.amount || 0).toLocaleString()}</span>
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* Custom Fee Head ('Other') */}
              <div className="border rounded-md p-2.5 bg-slate-50/50 space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-custom-other"
                    className="accent-primary h-4 w-4"
                    checked={challanForm.isOtherEnabled}
                    onChange={(e) => setChallanForm({ ...challanForm, isOtherEnabled: e.target.checked })}
                  />
                  <label htmlFor="edit-custom-other" className="text-xs font-semibold cursor-pointer">
                    Custom Fee Head ('Other' - Amount)
                  </label>
                </div>
                {challanForm.isOtherEnabled && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-bold">Head Title</Label>
                      <Input
                        placeholder="e.g. Fine, Lab Charges, Other"
                        value={challanForm.otherName || ""}
                        onChange={(e) => setChallanForm({ ...challanForm, otherName: e.target.value })}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-bold">Amount (PKR)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={challanForm.otherAmount}
                        onChange={(e) => setChallanForm({ ...challanForm, otherAmount: e.target.value })}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Financial Calculation Summary */}
            {(() => {
              const baseVal = Math.round(parseFloat(challanForm.amount) || 0);
              const selectedHeadIds = (challanForm.selectedHeads || []).map(extractId);
              const catHeadsTotal = (feeHeads || [])
                .filter(h => selectedHeadIds.includes(extractId(h.id || h._id)))
                .reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
              const otherVal = challanForm.isOtherEnabled ? Math.round(parseFloat(challanForm.otherAmount) || 0) : 0;
              const headsTotal = catHeadsTotal + otherVal;
              const arrearsVal = Math.round(parseFloat(challanForm.arrearsAmount) || 0);
              const discVal = Math.round(parseFloat(challanForm.discount) || 0);
              const grossVal = baseVal + headsTotal + arrearsVal;
              const netVal = Math.max(0, grossVal - discVal);

              return (
                <div className="bg-slate-50 border rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base Tuition:</span>
                    <span className="font-medium text-foreground">PKR {baseVal.toLocaleString()}</span>
                  </div>
                  {headsTotal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Additional Heads {otherVal > 0 ? `(incl. ${challanForm.otherName || 'Other'})` : ''}:</span>
                      <span className="font-medium text-foreground">+PKR {headsTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {arrearsVal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Carried Arrears:</span>
                      <span className="font-medium text-amber-600">+PKR {arrearsVal.toLocaleString()}</span>
                    </div>
                  )}
                  {discVal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Discount:</span>
                      <span className="font-medium text-emerald-600">-PKR {discVal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t pt-1.5 flex justify-between font-bold text-sm">
                    <span>Net Total Payable:</span>
                    <span className="text-primary">PKR {netVal.toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-1">
              <Label className="text-xs">Remarks</Label>
              <Textarea
                value={challanForm.remarks}
                onChange={(e) => setChallanForm({ ...challanForm, remarks: e.target.value })}
                placeholder="Optional notes..."
                className="text-xs min-h-[50px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setChallanOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleSubmitChallan}
                disabled={updateChallanMutation.isPending}
              >
                {updateChallanMutation.isPending ? "Saving..." : "Update Challan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Print Dialog */}
      <Dialog open={bulkPrintOpen} onOpenChange={setBulkPrintOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Print Challans</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={bulkPrintFilters.programId}
                onValueChange={(val) => setBulkPrintFilters({ ...bulkPrintFilters, programId: val, classId: "all", sectionId: "all" })}
              >
                <SelectTrigger><SelectValue placeholder="Select Program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={bulkPrintFilters.classId}
                onValueChange={(val) => setBulkPrintFilters({ ...bulkPrintFilters, classId: val, sectionId: "all" })}
                disabled={bulkPrintFilters.programId === "all" || !bulkPrintFilters.programId}
              >
                <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.filter(c => !bulkPrintFilters.programId || bulkPrintFilters.programId === "all" || extractId(c.programId || c.program) === bulkPrintFilters.programId).map(c => (
                    <SelectItem key={extractId(c)} value={extractId(c)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={bulkPrintFilters.sectionId}
                onValueChange={(val) => setBulkPrintFilters({ ...bulkPrintFilters, sectionId: val })}
                disabled={bulkPrintFilters.classId === "all" || !bulkPrintFilters.classId || classes.find(c => extractId(c) === bulkPrintFilters.classId)?.allowSections === false}
              >
                <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.filter(s => extractId(s.classId || s.class) === bulkPrintFilters.classId).map(s => (
                    <SelectItem key={extractId(s)} value={extractId(s)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Session</Label>
              <Select
                value={bulkPrintFilters.sessionId}
                onValueChange={(val) => setBulkPrintFilters({ ...bulkPrintFilters, sessionId: val })}
              >
                <SelectTrigger><SelectValue placeholder="Select Session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {academicSessions.map(s => (
                    <SelectItem key={extractId(s)} value={extractId(s)}>
                      {s.name} {s.isActive ? "(Current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Month</Label>
              <MonthPicker
                value={bulkPrintFilters.month}
                onChange={(val) => setBulkPrintFilters({ ...bulkPrintFilters, month: val })}
                className="h-9 text-sm"
                placeholder="Select Month"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setBulkPrintOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkPrint} disabled={bulkPrinting}>
              {bulkPrinting ? "Preparing..." : "Print Monthly Challans"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Preview Dialog */}
      <Dialog open={bulkPreviewOpen} onOpenChange={setBulkPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center gap-4">
              <div className="flex flex-col">
                <span>Bulk Challan Preview</span>
                <span className="text-xs font-normal text-muted-foreground mt-1">
                  Showing first {Math.min(bulkChallansList.length, 5)} of {bulkChallansList.length} challans
                </span>
              </div>
              <Button onClick={finalizeBulkPrint} className="gap-2 bg-success hover:bg-success/90" disabled={bulkPreviewPrinting}>
                <Printer className="w-4 h-4" /> {bulkPreviewPrinting ? "Preparing..." : `Print All ${bulkChallansList.length} Challans`}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 bg-muted/30 rounded-lg">
            <div dangerouslySetInnerHTML={{ __html: bulkPreviewContent }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction History - {selectedChallanForHistory?.challanNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-sm px-3 py-2 w-[120px]">Date</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Received</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Discount</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Method</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    if (!selectedChallanForHistory?.paymentHistory) {
                      return <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transaction history found.</TableCell></TableRow>;
                    }
                    const hist = typeof selectedChallanForHistory.paymentHistory === 'string' 
                      ? JSON.parse(selectedChallanForHistory.paymentHistory) 
                      : selectedChallanForHistory.paymentHistory;
                    
                    if (!Array.isArray(hist) || hist.length === 0) {
                      return <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transaction history found.</TableCell></TableRow>;
                    }
                    
                    return hist.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm px-3 py-2 text-xs">{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm px-3 py-2 font-bold text-success">PKR {formatAmount(entry.amount)}</TableCell>
                        <TableCell className="text-sm px-3 py-2 font-bold text-orange-600">PKR {formatAmount(entry.discount || 0)}</TableCell>
                        <TableCell className="text-sm px-3 py-2 text-xs">{entry.method || 'Cash'}</TableCell>
                        <TableCell className="text-sm px-3 py-2 text-xs italic">{entry.remarks || '-'}</TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setHistoryDialogOpen(false)}>Close</Button>
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
              <div className="space-y-3">
                {itemToDelete?.status === "PAID" ? (
                  <>
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                      <p className="font-semibold text-destructive text-sm flex items-center gap-1.5">
                        ⚠️ You are deleting a PAID challan
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-destructive/80">
                        <li>All recorded payments on this challan will be <strong>permanently erased</strong>.</li>
                        <li>Any installments that were <strong>settled</strong> by this payment will be restored to unpaid state.</li>
                        <li>The student's installment plan will be reset as if this challan was never paid.</li>
                      </ul>
                    </div>
                    <p className="font-bold text-destructive text-sm">
                      ⛔ This action is irreversible. Deleted payment records cannot be recovered.
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm">Are you sure you want to delete challan #{itemToDelete?.number}? This action will:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Restore the original amounts in the student's installment plan.</li>
                      <li>Remove the challan record permanently.</li>
                    </ul>
                    <p className="font-bold text-destructive text-sm mt-2">This action cannot be undone.</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (itemToDelete?.id) {
                  deleteChallanMutation.mutate(itemToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteChallanMutation.isPending ? "Deleting..." : (itemToDelete?.status === "PAID" ? "Delete Paid Challan" : "Delete")}
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
        lateFeeRatePerDay={lateFeeRatePerDay}
        onPaymentSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['feeChallans'] });
          queryClient.invalidateQueries({ queryKey: ['extraChallans'] });
          queryClient.invalidateQueries({ queryKey: ['installmentSummary'] });
          queryClient.invalidateQueries({ queryKey: ['installmentPlans'] });
          queryClient.invalidateQueries({ queryKey: ['students'] });
          queryClient.invalidateQueries({ queryKey: ['wallets'] });
          queryClient.invalidateQueries({ queryKey: ['walletHistory'] });
        }}
      />

      {/* Challan Details Dialog */}
      <ChallanDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        challan={selectedChallanDetails}
        feeHeads={feeHeads}
        feeChallans={feeChallans}
        classes={classes}
        programs={programs}
        academicSessions={academicSessions}
        lateFeeRatePerDay={lateFeeRatePerDay}
      />
    </div>
  );
};

export default ChallansTab;
