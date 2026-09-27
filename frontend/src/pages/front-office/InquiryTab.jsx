import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Users,
  Edit,
  Trash2,
  Eye,
  Search,
  Plus,
  Check,
  X,
  CalendarClock,
  Clock,
  RotateCcw,
} from "lucide-react";
import { format, addDays, addMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import {
  INPUT_LIMITS,
  firstError,
  formatCnic,
  validateCnic,
  validateEmail,
  validateMaxLength,
  validateNonNegativeNumber,
  validatePkPhone,
  validateRequired,
} from "@/lib/inputValidation";
import {
  createInquiry,
  getProgramNames,
  updateInquiry,
  delInquiry,
  getInquiries,
  createStudent,
  getClasses,
  getSections,
  getLatestRollNumber,
  addInquiryRemark,
  getAcademicSessions,
  createInquiryFollowUp,
  updateInquiryFollowUp,
  deleteInquiryFollowUp,
} from "../../../config/apis";
import StudentForm from "@/components/students/StudentForm";

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "in_progress":
    case "in progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "resolved":
    case "approved":
      return "bg-green-50 text-green-700 border-green-200";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

const getFollowUpStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case "COMPLETED":
      return "bg-green-50 text-green-700 border-green-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
    case "PENDING":
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
};

export default function InquiryTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Front Office", "inquiry");

  const [inquiryDialog, setInquiryDialog] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [inquiryNameSearch, setInquiryNameSearch] = useState("");

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: "" });
  const [rejectDialog, setRejectDialog] = useState({ open: false, inquiry: null });
  const [undoDialog, setUndoDialog] = useState({ open: false, inquiry: null });
  const [viewDetailsDialog, setViewDetailsDialog] = useState({
    open: false,
    data: null,
  });

  const [acceptInquiryDialog, setAcceptInquiryDialog] = useState(false);
  const [selectedInquiryForAccept, setSelectedInquiryForAccept] = useState(null);
  const [studentFormData, setStudentFormData] = useState({
    rollNumber: "",
    classId: "",
    sectionId: "",
    gender: "",
    dob: "",
    parentCNIC: "",
    studentCnic: "",
    documents: "{}",
  });

  const [inquiryForm, setInquiryForm] = useState({
    studentName: "",
    studentCnic: "",
    fatherName: "",
    fatherCnic: "",
    contactNumber: "",
    email: "",
    address: "",
    programInterest: "",
    previousInstitute: "",
    remarks: "",
    inquiryType: "",
    gender: "",
    sessionId: "",
    prospectusSold: false,
    prospectusFee: "",
    prospectusReceipt: "",
    referenceBody: "",
  });
  const [inquiryErrors, setInquiryErrors] = useState({});

  // Follow-up management states
  const [followUpListDialog, setFollowUpListDialog] = useState({
    open: false,
    inquiry: null,
  });
  const [followUpFormDialog, setFollowUpFormDialog] = useState({
    open: false,
    mode: "create", // "create" | "edit"
    followUp: null,
  });
  const [deleteFollowUpDialog, setDeleteFollowUpDialog] = useState({
    open: false,
    followUpId: "",
  });
  const [followUpFormData, setFollowUpFormData] = useState({
    date: "",
    slab: "1_DAY",
    status: "PENDING",
    remarks: "",
  });
  const [followUpErrors, setFollowUpErrors] = useState({});

  const { data: programs } = useQuery({
    queryKey: ["programs"],
    queryFn: getProgramNames,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: getAcademicSessions,
  });

  const {
    data: inquiriesData,
    isLoading: inquiriesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["inquiries", selectedProgram],
    queryFn: ({ pageParam = 1 }) =>
      getInquiries(selectedProgram === "*" ? undefined : selectedProgram || undefined, pageParam, 15),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    initialPageParam: 1,
  });

  const inquiries = useMemo(() => {
    return inquiriesData?.pages.flatMap((page) => page.data) || [];
  }, [inquiriesData]);

  const nameMatches = (value, query) =>
    !query.trim() || String(value || "").toLowerCase().includes(query.trim().toLowerCase());

  const filteredInquiries = useMemo(
    () => inquiries.filter((inquiry) => nameMatches(inquiry.studentName, inquiryNameSearch)),
    [inquiries, inquiryNameSearch]
  );

  const observer = useRef();
  const lastInquiryElementRef = useCallback(
    (node) => {
      if (inquiriesLoading || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [inquiriesLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  const calculatedPrefix = useMemo(() => {
    if (!selectedInquiryForAccept || !studentFormData.classId) return "";
    const pId =
      (typeof selectedInquiryForAccept.programInterest === "object" &&
      selectedInquiryForAccept.programInterest !== null
        ? (
            selectedInquiryForAccept.programInterest._id ||
            selectedInquiryForAccept.programInterest.id
          )?.toString()
        : selectedInquiryForAccept.programInterest?.toString()) ||
      (
        selectedInquiryForAccept.program?._id ||
        selectedInquiryForAccept.program?.id
      )?.toString() ||
      "";
    const pPrefix =
      programs?.find((p) => String(p.id || p._id) === String(pId))?.rollPrefix ||
      selectedInquiryForAccept.programInterest?.rollPrefix ||
      "";
    const cPrefix =
      classes?.find((c) => String(c.id || c._id) === String(studentFormData.classId))
        ?.rollPrefix || "";
    if (pPrefix && cPrefix && cPrefix.startsWith(pPrefix)) {
      return cPrefix;
    }
    return `${pPrefix}${cPrefix}`;
  }, [selectedInquiryForAccept, studentFormData.classId, programs, classes]);

  useEffect(() => {
    if (calculatedPrefix && acceptInquiryDialog) {
      const generateRollNumber = async () => {
        try {
          let yearSub = new Date().getFullYear().toString().slice(-2);
          const sessionId = studentFormData.sessionId;
          if (sessionId) {
            const sessionRecord = academicSessions.find(
              (s) => String(s.id || s._id) === String(sessionId)
            );
            if (sessionRecord?.name) {
              const match = sessionRecord.name.match(/(\d{4})/);
              if (match) yearSub = match[1].slice(-2);
            }
          }
          const searchPrefix = `${calculatedPrefix}${yearSub}-`;
          let latestFull = await getLatestRollNumber(searchPrefix);
          if (!latestFull) {
            latestFull = await getLatestRollNumber(calculatedPrefix);
          }

          let nextSuffix = `${yearSub}-001`;
          if (latestFull) {
            if (typeof latestFull === 'object' && latestFull.nextSuffix) {
              nextSuffix = latestFull.nextSuffix;
            } else {
              const rollStr = typeof latestFull === 'object' ? (latestFull.latestRollNumber || latestFull.rollNumber) : latestFull;
              if (rollStr) {
                const parts = rollStr.split("-");
                const lastPart = parts[parts.length - 1];
                if (!isNaN(parseInt(lastPart))) {
                  const nextNum = parseInt(lastPart, 10) + 1;
                  const nextNumStr = nextNum.toString().padStart(3, "0");
                  nextSuffix = `${yearSub}-${nextNumStr}`;
                }
              }
            }
          }
          setStudentFormData((prev) => ({
            ...prev,
            rollNumber: `${calculatedPrefix}${nextSuffix}`,
          }));
        } catch (error) {
          console.error("Error generating roll number:", error);
          setStudentFormData((prev) => ({ ...prev, rollNumber: calculatedPrefix }));
        }
      };
      generateRollNumber();
    }
  }, [calculatedPrefix, acceptInquiryDialog, studentFormData.sessionId, academicSessions]);

  const createMutation = useMutation({
    mutationFn: createInquiry,
    onSuccess: () => {
      toast({ title: "Inquiry added successfully" });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      closeInquiryDialog();
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to add inquiry", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateInquiry(id, payload),
    onSuccess: () => {
      toast({ title: "Inquiry updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      closeInquiryDialog();
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to update inquiry", variant: "destructive" }),
  });

  const deleteInqMutation = useMutation({
    mutationFn: delInquiry,
    onSuccess: () => {
      toast({ title: "Inquiry deleted" });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      setDeleteDialog({ open: false, id: "" });
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to delete inquiry", variant: "destructive" }),
  });

  const rejectInquiryMutation = useMutation({
    mutationFn: ({ id, currentStatus }) =>
      updateInquiry(id, { status: currentStatus === "REJECTED" ? "NEW" : "REJECTED" }),
    onSuccess: (_, variables) => {
      const action = variables.currentStatus === "REJECTED" ? "reverted to NEW" : "rejected";
      toast({ title: `Inquiry ${action} successfully` });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      setRejectDialog({ open: false, inquiry: null });
      setUndoDialog({ open: false, inquiry: null });
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to update inquiry", variant: "destructive" }),
  });

  const acceptInquiryMutation = useMutation({
    mutationFn: async ({ studentData, inquiryId }) => {
      let studentWithInquiry;
      if (studentData instanceof FormData) {
        studentData.append("inquiryId", String(inquiryId));
        studentWithInquiry = studentData;
      } else {
        studentWithInquiry = { ...studentData, inquiryId: String(inquiryId) };
      }

      const student = await createStudent(studentWithInquiry);
      await updateInquiry(inquiryId, { status: "APPROVED" });
      return student;
    },
    onSuccess: () => {
      toast({ title: "Student created and inquiry approved successfully" });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      closeAcceptInquiryDialog();
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to create student", variant: "destructive" }),
  });

  const addRemarkMutation = useMutation({
    mutationFn: ({ id, remark }) => addInquiryRemark(id, remark),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
    },
    onError: (error) => {
      toast({
        title: error.message || "Failed to add remark",
        variant: "destructive",
      });
    },
  });

  const createFollowUpMutation = useMutation({
    mutationFn: ({ inquiryId, payload }) => createInquiryFollowUp(inquiryId, payload),
    onSuccess: (updatedInquiry) => {
      toast({ title: "Follow-up added successfully" });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      setFollowUpListDialog((prev) => ({
        ...prev,
        inquiry: updatedInquiry || prev.inquiry,
      }));
      closeFollowUpFormDialog();
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to add follow-up", variant: "destructive" }),
  });

  const updateFollowUpMutation = useMutation({
    mutationFn: ({ inquiryId, followUpId, payload }) =>
      updateInquiryFollowUp(inquiryId, followUpId, payload),
    onSuccess: (updatedInquiry) => {
      toast({ title: "Follow-up updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      setFollowUpListDialog((prev) => ({
        ...prev,
        inquiry: updatedInquiry || prev.inquiry,
      }));
      closeFollowUpFormDialog();
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to update follow-up", variant: "destructive" }),
  });

  const deleteFollowUpMutation = useMutation({
    mutationFn: ({ inquiryId, followUpId }) =>
      deleteInquiryFollowUp(inquiryId, followUpId),
    onSuccess: (res) => {
      toast({ title: "Follow-up deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      setFollowUpListDialog((prev) => ({
        ...prev,
        inquiry:
          res?.inquiry ||
          (prev.inquiry
            ? {
                ...prev.inquiry,
                followUps: prev.inquiry.followUps?.filter(
                  (f) => (f.id || f._id) !== deleteFollowUpDialog.followUpId
                ),
              }
            : null),
      }));
      setDeleteFollowUpDialog({ open: false, followUpId: "" });
    },
    onError: (err) =>
      toast({ title: err.message || "Failed to delete follow-up", variant: "destructive" }),
  });

  const handleOpenFollowUps = (inquiry) => {
    setFollowUpListDialog({ open: true, inquiry });
  };

  const handleOpenAddFollowUp = () => {
    setFollowUpFormData({
      date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      slab: "1_DAY",
      status: "PENDING",
      remarks: "",
    });
    setFollowUpErrors({});
    setFollowUpFormDialog({ open: true, mode: "create", followUp: null });
  };

  const handleOpenEditFollowUp = (followUp) => {
    setFollowUpFormData({
      date: followUp.date ? followUp.date.split("T")[0] : "",
      slab: followUp.slab || "CUSTOM",
      status: followUp.status || "PENDING",
      remarks: followUp.remarks || "",
    });
    setFollowUpErrors({});
    setFollowUpFormDialog({ open: true, mode: "edit", followUp });
  };

  const closeFollowUpFormDialog = () => {
    setFollowUpFormDialog({ open: false, mode: "create", followUp: null });
    setFollowUpFormData({
      date: "",
      slab: "1_DAY",
      status: "PENDING",
      remarks: "",
    });
    setFollowUpErrors({});
  };

  const handleFollowUpSlabSelect = (slabVal) => {
    let newDate = followUpFormData.date;
    if (slabVal === "1_DAY") {
      newDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
    } else if (slabVal === "3_DAYS") {
      newDate = format(addDays(new Date(), 3), "yyyy-MM-dd");
    } else if (slabVal === "1_WEEK") {
      newDate = format(addDays(new Date(), 7), "yyyy-MM-dd");
    } else if (slabVal === "2_WEEKS") {
      newDate = format(addDays(new Date(), 14), "yyyy-MM-dd");
    } else if (slabVal === "1_MONTH") {
      newDate = format(addMonths(new Date(), 1), "yyyy-MM-dd");
    }
    setFollowUpFormData((prev) => ({
      ...prev,
      slab: slabVal,
      date: newDate,
    }));
  };

  const handleFollowUpSubmit = () => {
    const errors = {};
    if (!followUpFormData.date) {
      errors.date = "Follow-up date is required";
    }
    if (Object.keys(errors).length > 0) {
      setFollowUpErrors(errors);
      return;
    }
    setFollowUpErrors({});

    const inquiryId =
      followUpListDialog.inquiry?.id || followUpListDialog.inquiry?._id;
    if (!inquiryId) return;

    if (followUpFormDialog.mode === "create") {
      createFollowUpMutation.mutate({
        inquiryId,
        payload: followUpFormData,
      });
    } else {
      const followUpId =
        followUpFormDialog.followUp?.id || followUpFormDialog.followUp?._id;
      updateFollowUpMutation.mutate({
        inquiryId,
        followUpId,
        payload: followUpFormData,
      });
    }
  };

  const closeInquiryDialog = () => {
    setInquiryForm({
      studentName: "",
      studentCnic: "",
      fatherName: "",
      fatherCnic: "",
      contactNumber: "",
      email: "",
      address: "",
      programInterest: "",
      previousInstitute: "",
      remarks: "",
      inquiryType: "",
      gender: "",
      sessionId: "",
      prospectusSold: false,
      prospectusFee: "",
      prospectusReceipt: "",
      referenceBody: "",
    });
    setEditingInquiry(null);
    setInquiryDialog(false);
  };

  const handleInquirySubmit = () => {
    const nextErrors = {
      studentName: firstError(
        validateRequired(inquiryForm.studentName, "Student name"),
        validateMaxLength(inquiryForm.studentName, INPUT_LIMITS.name, "Student name")
      ),
      studentCnic: firstError(
        validateRequired(inquiryForm.studentCnic, "Student CNIC/Form-B"),
        validateCnic(inquiryForm.studentCnic)
      ),
      fatherName: firstError(
        validateRequired(inquiryForm.fatherName, "Father/Guardian name"),
        validateMaxLength(inquiryForm.fatherName, INPUT_LIMITS.name, "Father/Guardian name")
      ),
      fatherCnic: validateCnic(inquiryForm.fatherCnic),
      contactNumber: firstError(
        validateRequired(inquiryForm.contactNumber, "Contact number"),
        validatePkPhone(inquiryForm.contactNumber)
      ),
      email: validateEmail(inquiryForm.email),
      address: validateMaxLength(inquiryForm.address, INPUT_LIMITS.longText, "Address"),
      previousInstitute: validateMaxLength(
        inquiryForm.previousInstitute,
        INPUT_LIMITS.name,
        "Previous institute"
      ),
      remarks: validateMaxLength(inquiryForm.remarks, INPUT_LIMITS.longText, "Remarks"),
      prospectusFee: validateNonNegativeNumber(inquiryForm.prospectusFee, "Prospectus fee"),
      prospectusReceipt: validateMaxLength(
        inquiryForm.prospectusReceipt,
        INPUT_LIMITS.code,
        "Prospectus receipt"
      ),
      referenceBody: validateMaxLength(
        inquiryForm.referenceBody,
        INPUT_LIMITS.name,
        "Reference body"
      ),
    };
    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });
    if (Object.keys(nextErrors).length > 0) {
      setInquiryErrors(nextErrors);
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    setInquiryErrors({});

    const payload = {
      ...inquiryForm,
      programInterest: inquiryForm.programInterest || undefined,
      sessionId: inquiryForm.sessionId || undefined,
      prospectusFee: inquiryForm.prospectusFee ? Number(inquiryForm.prospectusFee) : undefined,
      prospectusSold: !!inquiryForm.prospectusSold,
    };

    if (editingInquiry) {
      const { remarks, ...rest } = payload;
      updateMutation.mutate({ id: editingInquiry.id, payload: rest });
      if (remarks && typeof remarks === "string" && remarks.trim()) {
        addRemarkMutation.mutate({ id: editingInquiry.id, remark: remarks.trim() });
      }
    } else {
      const { remarks, ...rest } = payload;
      const createData = { ...rest, status: "NEW" };
      if (remarks && typeof remarks === "string" && remarks.trim()) {
        createData.remarks = [{ text: remarks.trim(), date: new Date() }];
      }
      createMutation.mutate(createData);
    }
  };

  const handleEditInquiry = (inquiry) => {
    setInquiryForm({
      studentName: inquiry.studentName,
      studentCnic: inquiry.studentCnic || "",
      fatherName: inquiry.fatherName,
      fatherCnic: inquiry.fatherCnic || "",
      contactNumber: inquiry.contactNumber,
      email: inquiry.email || "",
      address: inquiry.address || "",
      programInterest:
        inquiry.programInterest?.id ||
        inquiry.programInterest ||
        inquiry.program?.id ||
        "",
      previousInstitute: inquiry.previousInstitute || "",
      remarks: "",
      inquiryType: inquiry.inquiryType || "",
      gender: inquiry.gender || "",
      sessionId:
        inquiry.sessionId?.id?.toString() ||
        inquiry.sessionId?.toString() ||
        "",
      prospectusSold: inquiry.prospectusSold || false,
      prospectusFee: inquiry.prospectusFee?.toString() || "",
      prospectusReceipt: inquiry.prospectusReceipt || "",
      referenceBody: inquiry.referenceBody || "",
    });
    setEditingInquiry(inquiry);
    setInquiryDialog(true);
  };

  const handleRejectInquiry = (inquiry) => {
    rejectInquiryMutation.mutate({
      id: inquiry.id,
      currentStatus: inquiry.status,
    });
  };

  const handleAcceptInquiry = (inquiry) => {
    setSelectedInquiryForAccept(inquiry);
    const nameParts = (inquiry.studentName || "").trim().split(/\s+/);
    const fName = nameParts[0] || inquiry.studentName || "";
    const lName = nameParts.slice(1).join(" ");

    const programId =
      (typeof inquiry.programInterest === "object" && inquiry.programInterest !== null
        ? (inquiry.programInterest._id || inquiry.programInterest.id)?.toString()
        : typeof inquiry.programInterest === "string"
        ? inquiry.programInterest
        : "") ||
      (typeof inquiry.program === "object" && inquiry.program !== null
        ? (inquiry.program._id || inquiry.program.id)?.toString()
        : typeof inquiry.program === "string"
        ? inquiry.program
        : "") ||
      "";

    const sessionId =
      (typeof inquiry.sessionId === "object" && inquiry.sessionId !== null
        ? (inquiry.sessionId._id || inquiry.sessionId.id)?.toString()
        : typeof inquiry.sessionId === "string"
        ? inquiry.sessionId
        : "") ||
      (typeof inquiry.session === "object" && inquiry.session !== null
        ? (inquiry.session._id || inquiry.session.id)?.toString()
        : typeof inquiry.session === "string"
        ? inquiry.session
        : "") ||
      "";

    const sessionName =
      (typeof inquiry.sessionId === "object" && inquiry.sessionId !== null
        ? inquiry.sessionId.name
        : "") ||
      (typeof inquiry.session === "object" && inquiry.session !== null
        ? inquiry.session.name
        : typeof inquiry.session === "string"
        ? inquiry.session
        : "") ||
      academicSessions?.find(
        (s) => String(s.id || s._id) === String(sessionId)
      )?.name ||
      "";

    let gender = inquiry.gender || "";
    if (gender) {
      const gLower = gender.trim().toLowerCase();
      if (gLower === "male") gender = "Male";
      else if (gLower === "female") gender = "Female";
      else if (gLower === "other") gender = "Other";
    }

    let dob = "";
    if (inquiry.dob) {
      try {
        dob = new Date(inquiry.dob).toISOString().split("T")[0];
      } catch {
        dob = String(inquiry.dob).split("T")[0];
      }
    }

    const classId =
      (typeof inquiry.classId === "object" && inquiry.classId !== null
        ? (inquiry.classId._id || inquiry.classId.id)?.toString()
        : typeof inquiry.classId === "string"
        ? inquiry.classId
        : "") ||
      (typeof inquiry.class === "object" && inquiry.class !== null
        ? (inquiry.class._id || inquiry.class.id)?.toString()
        : "") ||
      "";

    const sectionId =
      (typeof inquiry.sectionId === "object" && inquiry.sectionId !== null
        ? (inquiry.sectionId._id || inquiry.sectionId.id)?.toString()
        : typeof inquiry.sectionId === "string"
        ? inquiry.sectionId
        : "") ||
      (typeof inquiry.section === "object" && inquiry.section !== null
        ? (inquiry.section._id || inquiry.section.id)?.toString()
        : "") ||
      "";

    setStudentFormData({
      fName,
      lName,
      fatherOrguardian: inquiry.fatherName || inquiry.fatherOrguardian || "",
      rollNumber: "",
      parentOrGuardianEmail: inquiry.email || inquiry.parentOrGuardianEmail || "",
      parentOrGuardianPhone:
        inquiry.contactNumber || inquiry.parentOrGuardianPhone || inquiry.phone || "",
      parentCNIC: inquiry.fatherCnic || inquiry.parentCNIC || inquiry.parentCnic || "",
      studentCnic: inquiry.studentCnic || "",
      address: inquiry.address || "",
      programId,
      classId,
      sectionId,
      gender,
      dob,
      sessionId,
      session: sessionName,
      admissionDate: new Date().toISOString().split("T")[0],
      previousBoardName: inquiry.previousBoardName || inquiry.previousInstitute || "",
      previousBoardRollNumber: inquiry.previousBoardRollNumber || "",
      admissionFormNumber: inquiry.admissionFormNumber || inquiry.prospectusReceipt || "",
      documents: {
        fatherCnic: !!(inquiry.fatherCnic || inquiry.parentCNIC),
        address: !!inquiry.address,
        bForm: !!inquiry.studentCnic,
      },
    });
    setAcceptInquiryDialog(true);
  };

  const closeAcceptInquiryDialog = () => {
    setAcceptInquiryDialog(false);
    setSelectedInquiryForAccept(null);
    setStudentFormData({
      rollNumber: "",
      classId: "",
      sectionId: "",
      gender: "",
      dob: "",
      parentCNIC: "",
      studentCnic: "",
      documents: "{}",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          All Inquiries
        </CardTitle>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={inquiryNameSearch}
              onChange={(e) => setInquiryNameSearch(e.target.value)}
              placeholder="Search by name"
              className="w-[220px] pl-9"
            />
          </div>
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="*">All Programs</SelectItem>
              {programs?.map((program) => (
                <SelectItem key={program.id} value={String(program.id)}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button
              onClick={() => {
                closeInquiryDialog();
                setInquiryDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Inquiry
            </Button>
          )}
          <Dialog open={inquiryDialog} onOpenChange={setInquiryDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingInquiry ? "Edit" : "New"} Inquiry</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                {/* Student Information */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Student Information
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Student Name *</Label>
                      <Input
                        value={inquiryForm.studentName}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, studentName: e.target.value })
                        }
                        className={inquiryErrors.studentName ? "border-destructive" : ""}
                      />
                      <FieldError message={inquiryErrors.studentName} />
                    </div>
                    <div className="space-y-1">
                      <Label>Student CNIC / Form-B *</Label>
                      <Input
                        value={inquiryForm.studentCnic}
                        onChange={(e) =>
                          setInquiryForm({
                            ...inquiryForm,
                            studentCnic: formatCnic(e.target.value),
                          })
                        }
                        placeholder="e.g. 12345-1234567-1"
                        className={inquiryErrors.studentCnic ? "border-destructive" : ""}
                      />
                      <FieldError message={inquiryErrors.studentCnic} />
                    </div>
                    <div className="space-y-1">
                      <Label>Father/Guardian Name *</Label>
                      <Input
                        value={inquiryForm.fatherName}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, fatherName: e.target.value })
                        }
                        className={inquiryErrors.fatherName ? "border-destructive" : ""}
                      />
                      <FieldError message={inquiryErrors.fatherName} />
                    </div>
                    <div className="space-y-1">
                      <Label>
                        Father/Guardian CNIC{" "}
                        <span className="text-muted-foreground text-xs">(optional)</span>
                      </Label>
                      <Input
                        value={inquiryForm.fatherCnic}
                        onChange={(e) =>
                          setInquiryForm({
                            ...inquiryForm,
                            fatherCnic: formatCnic(e.target.value),
                          })
                        }
                        placeholder="12345-1234567-1"
                        className={inquiryErrors.fatherCnic ? "border-destructive" : ""}
                      />
                      <FieldError message={inquiryErrors.fatherCnic} />
                    </div>
                    <div className="space-y-1">
                      <Label>Contact Number *</Label>
                      <Input
                        value={inquiryForm.contactNumber}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, contactNumber: e.target.value })
                        }
                        placeholder="0300-1234567"
                        className={inquiryErrors.contactNumber ? "border-destructive" : ""}
                      />
                      <FieldError message={inquiryErrors.contactNumber} />
                    </div>
                    <div className="space-y-1">
                      <Label>
                        Email{" "}
                        <span className="text-muted-foreground text-xs">(optional)</span>
                      </Label>
                      <Input
                        value={inquiryForm.email}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, email: e.target.value })
                        }
                        placeholder="email@example.com"
                        className={inquiryErrors.email ? "border-destructive" : ""}
                      />
                      <FieldError message={inquiryErrors.email} />
                    </div>
                    <div className="space-y-1">
                      <Label>
                        Gender{" "}
                        <span className="text-muted-foreground text-xs">(optional)</span>
                      </Label>
                      <Select
                        value={inquiryForm.gender}
                        onValueChange={(v) => setInquiryForm({ ...inquiryForm, gender: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>
                        Address{" "}
                        <span className="text-muted-foreground text-xs">(optional)</span>
                      </Label>
                      <Input
                        value={inquiryForm.address}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, address: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Inquiry Details */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Inquiry Details
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Program Interest</Label>
                      <Select
                        value={String(inquiryForm.programInterest || "")}
                        onValueChange={(v) =>
                          setInquiryForm({ ...inquiryForm, programInterest: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select program" />
                        </SelectTrigger>
                        <SelectContent>
                          {programs?.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Session</Label>
                      <Select
                        value={inquiryForm.sessionId}
                        onValueChange={(v) =>
                          setInquiryForm({ ...inquiryForm, sessionId: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select session" />
                        </SelectTrigger>
                        <SelectContent>
                          {academicSessions?.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                              {s.isActive ? " (Active)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Inquiry Type</Label>
                      <Select
                        value={inquiryForm.inquiryType}
                        onValueChange={(v) =>
                          setInquiryForm({ ...inquiryForm, inquiryType: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PHYSICAL">Physical</SelectItem>
                          <SelectItem value="HEAD_OFFICE">Head Office (HO)</SelectItem>
                          <SelectItem value="REGIONAL_OFFICE">
                            Regional Office (RO)
                          </SelectItem>
                          <SelectItem value="SOCIAL_MEDIA">Social Media</SelectItem>
                          <SelectItem value="TELEPHONE">Telephone</SelectItem>
                          <SelectItem value="REFERENCE">Reference</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Previous Institute</Label>
                      <Input
                        value={inquiryForm.previousInstitute}
                        onChange={(e) =>
                          setInquiryForm({
                            ...inquiryForm,
                            previousInstitute: e.target.value,
                          })
                        }
                      />
                    </div>
                    {inquiryForm.inquiryType === "REFERENCE" && (
                      <div className="space-y-1">
                        <Label>Reference Name/Body</Label>
                        <Input
                          value={inquiryForm.referenceBody}
                          onChange={(e) =>
                            setInquiryForm({
                              ...inquiryForm,
                              referenceBody: e.target.value,
                            })
                          }
                          placeholder="Enter reference name or body"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Prospectus */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Prospectus
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <Label>Prospectus Sold</Label>
                      <Select
                        value={inquiryForm.prospectusSold ? "yes" : "no"}
                        onValueChange={(v) =>
                          setInquiryForm({
                            ...inquiryForm,
                            prospectusSold: v === "yes",
                            prospectusFee: v === "no" ? "" : inquiryForm.prospectusFee,
                            prospectusReceipt:
                              v === "no" ? "" : inquiryForm.prospectusReceipt,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {inquiryForm.prospectusSold && (
                      <>
                        <div className="space-y-1">
                          <Label>Prospectus Fee (PKR)</Label>
                          <Input
                            type="number"
                            value={inquiryForm.prospectusFee}
                            onChange={(e) =>
                              setInquiryForm({
                                ...inquiryForm,
                                prospectusFee: e.target.value,
                              })
                            }
                            placeholder="e.g. 500"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Receipt Number</Label>
                          <Input
                            value={inquiryForm.prospectusReceipt}
                            onChange={(e) =>
                              setInquiryForm({
                                ...inquiryForm,
                                prospectusReceipt: e.target.value,
                              })
                            }
                            placeholder="Receipt #"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Remarks
                  </p>
                  {editingInquiry &&
                    Array.isArray(editingInquiry.remarks) &&
                    editingInquiry.remarks.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-2 p-2 bg-muted/20 rounded border text-sm mb-2 scrollbar-thin">
                        {editingInquiry.remarks.map((r, i) => (
                          <div key={i} className="border-b last:border-0 pb-1">
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                              <span className="font-semibold">{r.author}</span>
                              <span className="italic">
                                {r.date ? new Date(r.date).toLocaleString() : ""}
                              </span>
                            </div>
                            <p className="text-xs">{r.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  <div className="space-y-1">
                    <Label>{editingInquiry ? "Add New Remark" : "Remark"}</Label>
                    <Textarea
                      value={inquiryForm.remarks}
                      onChange={(e) =>
                        setInquiryForm({ ...inquiryForm, remarks: e.target.value })
                      }
                      placeholder="Add inquiry remarks"
                      rows={2}
                    />
                    <FieldError message={inquiryErrors.remarks} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeInquiryDialog}>
                  Cancel
                </Button>
                <Button onClick={handleInquirySubmit}>
                  {editingInquiry ? "Update" : "Save"} Inquiry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {inquiriesLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading inquiries...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Date</TableHead>
                <TableHead className="py-2 px-3 text-sm">Student Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Father Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Phone</TableHead>
                <TableHead className="py-2 px-3 text-sm">Program</TableHead>
                <TableHead className="py-2 px-3 text-sm">Status</TableHead>
                <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInquiries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-2 px-3 text-sm text-center text-muted-foreground"
                  >
                    No inquiries found.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredInquiries.map((inquiry, index) => (
                    <TableRow
                      key={inquiry.id}
                      ref={
                        index === filteredInquiries.length - 1
                          ? lastInquiryElementRef
                          : null
                      }
                    >
                      <TableCell className="py-2 px-3 text-sm">
                        {inquiry.createdAt?.split("T")[0]}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm font-medium">
                        {inquiry.studentName}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {inquiry.fatherName}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {inquiry.contactNumber}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {inquiry.programInterest?.name || inquiry.program?.name || "—"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            inquiry.status
                          )}`}
                        >
                          {inquiry.status || "NEW"}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <div className="flex gap-2">
                          {/* If inquiry is NEW or pending */}
                          {canUpdate && (inquiry.status === "NEW" || !inquiry.status) && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleAcceptInquiry(inquiry)}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Accept Inquiry</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setRejectDialog({ open: true, inquiry })}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reject Inquiry</TooltipContent>
                              </Tooltip>
                            </>
                          )}

                          {/* If inquiry is REJECTED: show Undo button to revert to NEW */}
                          {canUpdate && inquiry.status === "REJECTED" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => setUndoDialog({ open: true, inquiry })}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Undo Rejection (Revert to NEW)</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="relative text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handleOpenFollowUps(inquiry)}
                              >
                                <CalendarClock className="w-4 h-4" />
                                {Array.isArray(inquiry.followUps) && inquiry.followUps.length > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                    {inquiry.followUps.length}
                                  </span>
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Manage Follow-ups</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setViewDetailsDialog({
                                    open: true,
                                    data: inquiry,
                                  })
                                }
                              >
                                <Eye className="w-4 h-4 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Details</TooltipContent>
                          </Tooltip>
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditInquiry(inquiry)}
                                >
                                  <Edit className="w-4 h-4 text-blue-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Inquiry</TooltipContent>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() =>
                                    setDeleteDialog({ open: true, id: inquiry.id })
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Inquiry</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {isFetchingNextPage && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-2 px-3 text-sm text-center text-muted-foreground animate-pulse"
                      >
                        Loading more inquiries...
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this inquiry record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteInqMutation.mutate(deleteDialog.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog
        open={rejectDialog.open}
        onOpenChange={(open) => setRejectDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Inquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject the inquiry for &quot;{rejectDialog.inquiry?.studentName}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (rejectDialog.inquiry) {
                  rejectInquiryMutation.mutate({
                    id: rejectDialog.inquiry.id || rejectDialog.inquiry._id,
                    currentStatus: "NEW",
                  });
                }
              }}
            >
              {rejectInquiryMutation.isPending ? "Rejecting..." : "Reject Inquiry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo Rejection Confirmation Dialog */}
      <AlertDialog
        open={undoDialog.open}
        onOpenChange={(open) => setUndoDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert Inquiry to NEW?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to undo the rejection and convert the inquiry for &quot;{undoDialog.inquiry?.studentName}&quot; back to &quot;NEW&quot; status?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => {
                if (undoDialog.inquiry) {
                  rejectInquiryMutation.mutate({
                    id: undoDialog.inquiry.id || undoDialog.inquiry._id,
                    currentStatus: "REJECTED",
                  });
                }
              }}
            >
              {rejectInquiryMutation.isPending ? "Reverting..." : "Revert to NEW"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Details Dialog */}
      <Dialog
        open={viewDetailsDialog.open}
        onOpenChange={(open) => setViewDetailsDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-h-[90vh] md:max-w-[680px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold border-b pb-4">
              Inquiry Information
            </DialogTitle>
          </DialogHeader>

          {viewDetailsDialog.data && (
            <div className="space-y-5 mt-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(
                    viewDetailsDialog.data.status
                  )}`}
                >
                  {viewDetailsDialog.data.status || "NEW"}
                </span>
                {viewDetailsDialog.data.inquiryType && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {viewDetailsDialog.data.inquiryType.replace(/_/g, " ")}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {viewDetailsDialog.data.createdAt
                    ? new Date(viewDetailsDialog.data.createdAt).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "long", day: "numeric" }
                      )
                    : ""}
                </span>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Student Information
                </p>
                <div className="grid grid-cols-2 gap-3 bg-muted/20 rounded-lg p-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Student Name
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.studentName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Father Name
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.fatherName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Contact
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.contactNumber || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Email
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.email || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Gender
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.gender || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Student CNIC / Form-B
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.studentCnic || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Father / Guardian CNIC
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.fatherCnic || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Address
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.address || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Inquiry Details
                </p>
                <div className="grid grid-cols-2 gap-3 bg-muted/20 rounded-lg p-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Program Interest
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.programInterest?.name ||
                        viewDetailsDialog.data.program?.name ||
                        "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Session
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.session?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Previous Institute
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.previousInstitute || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Inquiry Type
                    </p>
                    <p className="text-sm font-medium">
                      {viewDetailsDialog.data.inquiryType?.replace(/_/g, " ") || "—"}
                    </p>
                  </div>
                  {viewDetailsDialog.data?.inquiryType === "REFERENCE" && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Reference
                      </p>
                      <p className="text-sm font-medium">
                        {viewDetailsDialog.data.referenceBody || "—"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {viewDetailsDialog.data.prospectusSold && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Prospectus
                  </p>
                  <div className="grid grid-cols-3 gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Sold
                      </p>
                      <p className="text-sm font-medium text-green-700">Yes</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Fee
                      </p>
                      <p className="text-sm font-medium">
                        PKR {viewDetailsDialog.data.prospectusFee || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Receipt #
                      </p>
                      <p className="text-sm font-medium">
                        {viewDetailsDialog.data.prospectusReceipt || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {((Array.isArray(viewDetailsDialog.data.followUps) &&
                viewDetailsDialog.data.followUps.length > 0) ||
                viewDetailsDialog.data.followUpDate ||
                viewDetailsDialog.data.followUpSlab) && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Follow-up History
                  </p>
                  {Array.isArray(viewDetailsDialog.data.followUps) &&
                  viewDetailsDialog.data.followUps.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                      {viewDetailsDialog.data.followUps.map((fu, idx) => (
                        <div
                          key={idx}
                          className="bg-amber-50/50 border border-amber-200/80 rounded-lg p-3 text-sm"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-xs">
                              {fu.date
                                ? new Date(fu.date).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "—"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {fu.slab && (
                                <Badge variant="outline" className="text-[10px] bg-white">
                                  {fu.slab.replace(/_/g, " ")}
                                </Badge>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getFollowUpStatusColor(
                                  fu.status
                                )}`}
                              >
                                {fu.status || "PENDING"}
                              </span>
                            </div>
                          </div>
                          {fu.remarks && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {fu.remarks}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                          Follow Up Date
                        </p>
                        <p className="text-sm font-medium">
                          {viewDetailsDialog.data.followUpDate
                            ? new Date(
                                viewDetailsDialog.data.followUpDate
                              ).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                          Slab
                        </p>
                        <p className="text-sm font-medium">
                          {viewDetailsDialog.data.followUpSlab?.replace(/_/g, " ") ||
                            "—"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {Array.isArray(viewDetailsDialog.data.remarks) &&
                viewDetailsDialog.data.remarks.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Remarks History
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                      {viewDetailsDialog.data.remarks.map((remark, index) => (
                        <div key={index} className="bg-muted/30 p-3 rounded-md text-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-primary text-xs">
                              {remark.author || "Staff"}
                            </span>
                            <span className="text-[10px] text-muted-foreground italic">
                              {remark.date ? new Date(remark.date).toLocaleString() : ""}
                            </span>
                          </div>
                          <p className="text-muted-foreground leading-snug text-xs">
                            {remark.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Accept Inquiry Dialog */}
      <Dialog open={acceptInquiryDialog} onOpenChange={setAcceptInquiryDialog}>
        <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accept Inquiry - Create Student</DialogTitle>
          </DialogHeader>

          {selectedInquiryForAccept && (
            <div className="bg-muted/50 p-4 rounded-lg mb-6 border border-border">
              <div className="flex items-center gap-2 mb-2 text-primary font-semibold">
                <Users className="w-5 h-5" />
                <h3>Inquiry Details</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Student Name</p>
                  <p className="font-medium">{selectedInquiryForAccept.studentName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Father Name</p>
                  <p className="font-medium">{selectedInquiryForAccept.fatherName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact</p>
                  <p className="font-medium">{selectedInquiryForAccept.contactNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Program Interested</p>
                  <Badge className="inline-block" variant="outline">
                    {(typeof selectedInquiryForAccept.programInterest === "object" &&
                      selectedInquiryForAccept.programInterest?.name) ||
                      selectedInquiryForAccept.program?.name ||
                      programs?.find(
                        (p) =>
                          String(p.id || p._id) ===
                          String(
                            selectedInquiryForAccept.programInterest?._id ||
                              selectedInquiryForAccept.programInterest?.id ||
                              selectedInquiryForAccept.programInterest
                          )
                      )?.name ||
                      "N/A"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <StudentForm
            key={
              selectedInquiryForAccept?.id ||
              selectedInquiryForAccept?._id ||
              "accept-inquiry-student-form"
            }
            initialData={studentFormData}
            programs={programs}
            classes={classes}
            sections={sections}
            academicSessions={academicSessions}
            onCancel={closeAcceptInquiryDialog}
            onSubmit={(data) => {
              acceptInquiryMutation.mutate({
                studentData: data,
                inquiryId: selectedInquiryForAccept.id || selectedInquiryForAccept._id,
              });
            }}
            isSubmitting={acceptInquiryMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Follow-ups List Dialog */}
      <Dialog
        open={followUpListDialog.open}
        onOpenChange={(open) =>
          setFollowUpListDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-amber-600" />
                  Follow-ups — {followUpListDialog.inquiry?.studentName}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Contact: {followUpListDialog.inquiry?.contactNumber || "—"} &bull; Program:{" "}
                  {followUpListDialog.inquiry?.programInterest?.name ||
                    followUpListDialog.inquiry?.program?.name ||
                    "—"}
                </p>
              </div>
              {canUpdate && (
                <Button size="sm" onClick={handleOpenAddFollowUp}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Follow-up
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {(!followUpListDialog.inquiry?.followUps ||
              followUpListDialog.inquiry.followUps.length === 0) &&
            !followUpListDialog.inquiry?.followUpDate ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                <CalendarClock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                <p className="text-sm font-medium">No follow-ups recorded yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click &quot;Add Follow-up&quot; above to schedule the first follow-up.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Active follow-ups array */}
                {followUpListDialog.inquiry?.followUps?.map((fu) => {
                  const fuId = fu.id || fu._id;
                  return (
                    <div
                      key={fuId}
                      className="p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {fu.date
                              ? new Date(fu.date).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </span>
                          {fu.slab && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {fu.slab.replace(/_/g, " ")}
                            </Badge>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getFollowUpStatusColor(
                              fu.status
                            )}`}
                          >
                            {fu.status || "PENDING"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleOpenEditFollowUp(fu)}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Follow-up</TooltipContent>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() =>
                                    setDeleteFollowUpDialog({
                                      open: true,
                                      followUpId: fuId,
                                    })
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Follow-up</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      {fu.remarks ? (
                        <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-muted/50">
                          <span className="font-medium text-foreground">Notes: </span>
                          {fu.remarks}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No remarks/notes entered.
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Legacy single follow-up fallback if followUps array is empty */}
                {(!followUpListDialog.inquiry?.followUps ||
                  followUpListDialog.inquiry.followUps.length === 0) &&
                  followUpListDialog.inquiry?.followUpDate && (
                    <div className="p-3 border rounded-lg bg-card flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {new Date(
                              followUpListDialog.inquiry.followUpDate
                            ).toLocaleDateString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {followUpListDialog.inquiry.followUpSlab && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {followUpListDialog.inquiry.followUpSlab.replace(
                                /_/g,
                                " "
                              )}
                            </Badge>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                            LEGACY
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Legacy follow-up date. Click &quot;Add Follow-up&quot; above to convert or record a new one.
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Follow-up Dialog */}
      <Dialog
        open={followUpFormDialog.open}
        onOpenChange={(open) => {
          if (!open) closeFollowUpFormDialog();
          else setFollowUpFormDialog((prev) => ({ ...prev, open }));
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {followUpFormDialog.mode === "create" ? "Add" : "Edit"} Follow-up
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Slab Shortcut */}
            <div className="space-y-1">
              <Label>Quick Follow-up Slab (Shortcut)</Label>
              <Select
                value={followUpFormData.slab}
                onValueChange={handleFollowUpSlabSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shortcut or custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOM">Custom Date</SelectItem>
                  <SelectItem value="1_DAY">Tomorrow (+1 Day)</SelectItem>
                  <SelectItem value="3_DAYS">In 3 Days (+3 Days)</SelectItem>
                  <SelectItem value="1_WEEK">In 1 Week (+7 Days)</SelectItem>
                  <SelectItem value="2_WEEKS">In 2 Weeks (+14 Days)</SelectItem>
                  <SelectItem value="1_MONTH">In 1 Month (+1 Month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Picker - Always interactive and directly editable */}
            <div className="space-y-1">
              <Label>Follow-up Date *</Label>
              <Input
                type="date"
                value={followUpFormData.date}
                onChange={(e) =>
                  setFollowUpFormData((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))
                }
                className={followUpErrors.date ? "border-destructive" : ""}
              />
              <FieldError message={followUpErrors.date} />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={followUpFormData.status}
                onValueChange={(v) =>
                  setFollowUpFormData((prev) => ({ ...prev, status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Remarks / Notes */}
            <div className="space-y-1">
              <Label>Remarks / Notes</Label>
              <Textarea
                value={followUpFormData.remarks}
                onChange={(e) =>
                  setFollowUpFormData((prev) => ({
                    ...prev,
                    remarks: e.target.value,
                  }))
                }
                placeholder="Enter follow-up remarks, discussion notes, outcome..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeFollowUpFormDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleFollowUpSubmit}
              disabled={
                createFollowUpMutation.isPending ||
                updateFollowUpMutation.isPending
              }
            >
              {createFollowUpMutation.isPending ||
              updateFollowUpMutation.isPending
                ? "Saving..."
                : followUpFormDialog.mode === "create"
                ? "Add Follow-up"
                : "Update Follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Follow-up Confirmation Dialog */}
      <AlertDialog
        open={deleteFollowUpDialog.open}
        onOpenChange={(open) =>
          setDeleteFollowUpDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Follow-up?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this follow-up record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const inquiryId =
                  followUpListDialog.inquiry?.id ||
                  followUpListDialog.inquiry?._id;
                if (inquiryId && deleteFollowUpDialog.followUpId) {
                  deleteFollowUpMutation.mutate({
                    inquiryId,
                    followUpId: deleteFollowUpDialog.followUpId,
                  });
                }
              }}
            >
              {deleteFollowUpMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
